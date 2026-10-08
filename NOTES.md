# Notes

How FINON is put together, why I made each call, what I would do with more time, and how I used AI. The README covers running it and shows the screens; this file is the reasoning.

## 1. The approach in one paragraph

The screen has one question to answer: **"am I ready to submit?"** So the server owns every rule and returns a ready count and a clear list of what is wrong; the React app renders that and never re-derives it. I built a thin vertical slice first (add providers, add statements, submit, with validation enforced server-side), proved it with tests, then layered the experience on top: a calm, premium look suited to high-net-worth clients, helpful guidance on every row, and shortcuts that move the client from "what is left" to "done" in as few taps as possible.

## 2. Logic decisions

These are the business rules and the reasoning behind them.

1. **A statement's status is derived, never stored.** Missing means no statement; Outdated means the statement date is before *today minus three calendar months*; anything else is Uploaded. Because it is calculated each time, time passing can never leave a stale status in the database.

![The overview: ready count, progress bar and a status on every row](docs/screenshots/01-overview.png)
2. **Three calendar months, not 90 days, and the boundary is inclusive.** Months differ in length, so the cutoff uses calendar-month arithmetic (31 May minus three months is 28 February, the way `java.time` does it). A statement dated *exactly* three months ago still counts. The clock is injected, so the boundary tests are deterministic.
3. **The server owns readiness.** `GET /api/accounts` returns the rows plus `ready`, `total`, `canSubmit` and the list of issues. The UI shows exactly that. This is why the progress bar, the sentence under it, the Submit button and the server's own check can never disagree.
4. **Submit is enforced on the server, not by a disabled button.** `POST /api/submit` recalculates everything and returns 422 with the providers at fault, so an incomplete set is refused even if someone calls the API directly. An empty list is also refused: with nothing declared there is nothing to advise on. This is a documented product decision, not a brief requirement.

![A premature submit: the server's reason, the providers at fault, and an explanatory notification](docs/screenshots/07-submit-refused.png)
5. **The Submit button looks inactive but can still be pressed** (`aria-disabled`, not `disabled`). A premature attempt then shows the server's explanation and outlines the cards to fix, instead of leaving the client guessing why nothing happens.
6. **Outdated dates can be chosen, future dates cannot.** An old statement is valid input that fails a business rule, so it is saved as Outdated and excluded from readiness; that also keeps all three required statuses demonstrable. A future date can never describe an issued statement, so it is invalid input (400). The calendar explains this before saving, but the server decides.

![The calendar: older dates in red, with a plain-words verdict before saving](docs/screenshots/03-statement-date.png)
7. **No duplicate providers, under any disguise.** One name rule ignores case, accents, spacing, punctuation and "&" versus "and", so `HSBC`, `hsbc `, `H.S.B.C.` and `h s b c` are the same provider. It applies to catalogue picks, typed-in names, the client's current list, repeats within one request, and the catalogue itself (the app refuses to start if two catalogue entries collide). A duplicate request is rejected whole (409), never partially applied.

![Typing H.S.B.C. when HSBC is already on the list: refused, with a link to the existing entry](docs/screenshots/08-duplicate.png)
8. **Providers typed in under "Other" are personal.** The name is stored only on that client's own account. It never touches the shared provider table, so it can never appear in anyone's pick-list, and it disappears when removed. A typed name that matches a catalogue entry resolves to the catalogue entry.
9. **Categories are the client's, visible and editable.** Each account carries a category (Bank, Building society, Insurance, Investments, Pension, Property, Savings, Other, alphabetical with Other last). When adding, each dropdown is pre-filled with the suggestion so the client can see and change what will be saved. Typed-in providers start on Other. The list is grouped by category for the adviser, with typed-in providers in their own "Added by you" section.

![Categories pre-filled and editable in the Add dialog, with a searchable, removable selection](docs/screenshots/02-add-providers.png)

![Dragging a card onto another category; empty categories become drop targets](docs/screenshots/05-drag-and-drop.png)
10. **Uploaded files are checked for being genuinely openable, not for their name.** The server works out what a file really is from its contents, then confirms it is intact: PDFs must load as documents, pictures must decode, Word packages must be complete. Damaged or cut-off files are refused with a clear message and nothing is saved. A genuine file with the wrong extension (a real Word document called `.jpeg`) is accepted and treated as what it is, because refusing it only adds friction; a password-protected PDF is accepted because it is intact. Allowed types are PDF, Word, JPG and PNG, up to 5 MB.

![A damaged file is refused with a clear message, and the client's choices are kept](docs/screenshots/09-damaged-file.png)

![Viewing what was uploaded, with an in-app preview of a Word document](docs/screenshots/04-statement-viewer.png)
11. **Replacing a statement starts with no date chosen.** Pre-filling today's date would make the "current" message appear before the client had chosen anything, and pre-filling the old date would silently keep the statement outdated.
12. **Every row that needs a statement has somewhere to go.** A verified "how to get your statement" page where I have one, otherwise the provider's own website (each checked to respond), otherwise a web search. These links disappear the moment an in-date statement is saved. Only a handful of help links and one phone number are seeded, and only where I could verify them on the provider's own page, because contact details go stale and each one needs upkeep.
13. **The catalogue is a reviewed data file, not a live feed.** About 230 UK providers in `providers.csv`. No free API returns consumer brand names (the FCA register is looked up by legal entity name, and the Bank of England and PRA lists have no pension or platform coverage), so refreshing means editing one file and redeploying.
14. **Search is forgiving.** One matcher ignores capitals and punctuation, matches partial words, understands initials ("hl" finds Hargreaves Lansdown) and forgives a single typo ("vangard"). It drives the list search, the Add dialog and the selection panel.

## 3. Architecture and technology

| Choice | Why |
|---|---|
| React, TypeScript, Vite | Required client stack; small static build that Vercel serves instantly. |
| Tailwind CSS and shadcn/ui | Consistent, accessible building blocks (dialogs, focus handling) so effort goes into the product. |
| TanStack Query | Loading, error and refresh behaviour for every request, so "what is loading, what failed, what succeeded" is handled in one place. |
| Spring Boot 3 and Java 21 | Required back end; clean split of web layer, service rules and data. |
| H2 and Spring Data JPA | Zero set-up database that reseeds on every start. |
| dnd-kit | Drag and drop that also works by touch and keyboard, not only a mouse. |
| docx-preview | Draws Word files in the browser, so a private document is never sent to a third-party viewer and the API needs no office software. |
| Apache PDFBox | Opens uploaded PDFs on the server to confirm they are intact. |

One small, modular service rather than microservices: they would add cost without meeting a requirement.

## 4. Design decisions

- **Brand and tone.** Deep charcoal-green surfaces, mint for actions and progress, amber and coral for outdated and missing, never colour alone (every status has an icon and a word). Copy is calm and discreet for high-net-worth clients, and it makes no security claims the demo cannot back up (there is no sign-in).
- **Guidance over admin.** Rows that need attention explain why in plain words. The progress bar segments and the provider names in the summary sentence jump straight to the right action, and "N providers need attention" filters the list to what is left.
- **Calm microinteractions.** Short transitions that respect reduced-motion, a highlight when a card is jumped to, and a confirmation before anything is removed.
- **Accessible by default.** Keyboard and screen-reader support for the bar, dialogs, calendar and drag and drop, labelled controls, and a layout that stacks cleanly on a phone.

<p align="center"><img src="docs/screenshots/06-mobile.png" alt="FINON on a phone" width="300"></p>

## 5. Testing

I tested the behaviour I most wanted to protect, on both sides, then proved the whole story in a real browser.

- **Backend (48 tests).** Status boundaries with a frozen clock, duplicate rules in every disguise, submit refusal (including calling the API directly), categories, manual providers staying out of the catalogue, and the file rules: real files of each kind accepted, truncated, corrupt and unrecognised files refused, a genuine renamed file accepted.
- **Frontend (94 tests).** Readiness and the Submit button respond to server data; feedback for loading, success and failure; search, filters and shortcuts; the calendar with a frozen date; category choice and moves; the viewer, including Word previews and fallbacks; duplicate and already-added handling.
- **Browser test (Playwright).** One end-to-end story: premature submit refused, a damaged upload refused, statements added and replaced, a Word document previewed, a card dragged to another category, providers added and removed, and the pack submitted. It also guards the dialog scroll height, after a bug where hidden controls inflated it.

## 6. CI and deployment

GitHub Actions runs the backend, frontend and browser tests on every pull request and on `main`. **Production only changes after those checks pass:** Vercel's own deploy-on-push is switched off for `main` and a final CI job triggers the deploy; Render redeploys the API only after the GitHub checks succeed. The frontend is on Vercel and the Java API on Render (Vercel does not run a long-lived JVM).

## 7. Trade-offs and limits

- **In-memory H2.** Zero set-up, but all data resets when the API restarts; the free host also sleeps when idle, so the first request after a quiet spell is slow.
- **Stored files go beyond the brief.** The brief said to treat an upload as a name and a date. I chose to keep the real file so the client can view what they uploaded. It lives in the same in-memory database; for real use it would move to object storage with virus scanning and retention rules.
- **"Submitted" is not persisted.** The API validates and acknowledges but keeps no submission record.
- **Old `.doc` files cannot be previewed** in a browser reliably, so they offer a download. Modern `.docx` files are previewed.
- **No authentication and a single client**, as scoped; the client's first name is a single constant.
- **Some edge cases I cannot detect,** such as a file corrupted in the middle that still looks complete at both ends.

## 8. With more time

- A weekly job that checks the catalogue against the Bank of England and PRA lists and the FCA register, flags closed or renamed firms and opens a pull request for review.
- PostgreSQL, object storage for files, a stored submission record with an audit trail, idempotent submit and optimistic locking.
- Provider logos and aliases ("Lloyds" finding Lloyds Bank), and optimistic UI with per-row pending states.
- Broader browser coverage (mobile viewport, keyboard-only run) and automated accessibility checks.
- Rate limiting and structured logging on the API.

## 9. How I used AI

I used **Claude Code (the command-line tool)** throughout as an implementation partner. I made the decisions and it executed them. Concretely:

- **What I decided.** The stack and deployment split; the visual direction; every product and logic rule above; and the scope calls, such as keeping the Submit button pressable, allowing outdated dates, storing real files beyond the brief, refusing damaged files but accepting renamed ones, keeping typed-in providers separate and personal, one strict definition of duplicate names, categories the client can see and change, and requiring that nothing reaches production unless CI passes.
- **What Claude Code did.** Scaffolded the projects, wrote the Spring Boot and React code to those decisions, generated and ran the tests, took screenshots to check the screens, and wrote first drafts of the documentation.
- **How I steered it.** I worked by trying the running app and giving specific feedback, and the rules above came out of that loop. For example I rejected a file check that blocked a harmless renamed file, asked for broken files to be refused instead, made category suggestions visible rather than hidden, and asked for a confirmation before anything is removed. I did not accept output blindly: I ran it locally before anything was merged, and the work went through pull requests with CI.
- **What I verified myself.** The behaviour in the browser, the wording shown to clients, and the correctness of the rules. Tests were generated by the AI against rules I specified and I used them as a safety net, not as proof of correctness on their own.

I am happy to walk through any file and explain why it looks the way it does.
