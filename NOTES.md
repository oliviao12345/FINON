# Notes

The README shows how to run FINON, with screenshots and diagrams. This file is my reasoning: where each rule lives, what I chose and turned down, and how I used AI.

**Terms.** The *frontend* is the screen in the browser. The *backend* is the Java program behind it, which holds the rules and the data in its *database*.

1. [Approach and key decisions](#1-engineering-approach-and-key-decisions)
2. [Where information lives](#2-state-modelling-and-ownership)
3. [The business rules](#3-business-rules-and-validation)
4. [How the screen and backend talk](#4-api-design-and-error-handling)
5. [Design and accessibility](#5-ux-decisions-and-accessibility)
6. [Testing and automatic checks](#6-testing-strategy-and-ci)
7. [Trade-offs, limits and next steps](#7-trade-offs-limitations-and-next-steps)
8. [How I used AI](#8-ai-assisted-development-and-verification)

## 1. Engineering approach and key decisions

The screen has one job: answer **"is the client ready to submit?"** So the key decision is where that answer is worked out.

| Decision | Alternative | Why |
|---|---|---|
| The **backend** decides whether a statement counts and whether the client may submit. | Work it out on the screen. | One place knows the answer. The same rule in two places can drift apart. |
| The backend **checks again when Submit is pressed**. | Trust the Submit button. | The screen is only a guide. Anyone can call the backend directly. |
| **One backend program.** | Several small services. | A small task with one purpose. More pieces add work without helping. |
| **Rules and tests first, screen second.** | Start with how it looks. | The polish never ran ahead of the logic. |

## 2. State modelling and ownership

| Kind | Examples | Lives in | Why |
|---|---|---|---|
| **Saved** | Providers, the client's accounts and categories, each statement's file name, date and file | The database | What the client actually supplied. |
| **Worked out each time** | Statement status, ready count, whether the client can submit | The backend, on every request | Time changes the answer. A saved status would still say "Uploaded" the day after it expired. |
| **A temporary copy on the screen** | The last list the backend sent | TanStack Query (frontend) | Handles loading and errors, and re-fetches after every change. |
| **Screen-only details** | Selected filter, search text, open pop-ups | The frontend | Nothing else needs them. |

## 3. Business rules and validation

| Situation | Result | Why |
|---|---|---|
| No statement | **Missing** | Nothing supplied. |
| Dated within the last three calendar months, including exactly three months ago | **Uploaded** | Recent enough. The cut-off day counts. |
| Older than three calendar months | **Outdated** | Kept, but it does not count and blocks submitting. |
| Dated in the future | **Refused (400)** | It cannot have been issued yet. |
| Any provider Missing or Outdated, or no providers | **Submit refused (422)** | Only a complete set is accepted. |

- **Three calendar months, not 90 days.** Months differ in length, so I count back on the calendar (31 May minus three months is 28 February). The clock is injectable, so the tests pin the exact boundary day.
- **An outdated statement is accepted, not turned away.** It is real information that is not recent enough. The client sees what to replace, and all three statuses exist. The backend has the final say.

<p align="center"><img src="docs/screenshots/07-submit-refused.png" alt="A premature submit: the backend's reason and the providers at fault" width="520" height="148"></p>

- **No provider twice, however it is typed.** One rule ignores capitals, accents, spaces and punctuation and treats "&" like "and", so `HSBC`, `H.S.B.C.` and `hsbc` match. It covers the catalogue, typed-in names, the client's list and repeats within a request. A duplicate refuses the whole request.
- **Providers typed under "Other" stay personal.** They never join the shared list.
- **An uploaded file must actually open.** The backend works out what the file really is and checks it is whole: PDFs must load, pictures display, Word files be complete. Damaged files are refused and nothing is saved. A genuine file with the wrong ending is accepted. A password-protected PDF is accepted as intact, but the preview then asks for the password, so an adviser could not read it unless the client supplied it. I have not solved that.
- **Categories are the client's choice**, pre-filled with a visible suggestion, from a fixed list.

<table>
<tr>
<td align="center" valign="top"><img src="docs/screenshots/03-statement-date.png" alt="Calendar: older dates in red with a verdict" width="240" height="500"></td>
<td align="center" valign="top"><img src="docs/screenshots/08-duplicate.png" alt="A disguised duplicate refused with a link to the existing entry" width="240" height="257"></td>
<td align="center" valign="top"><img src="docs/screenshots/09-damaged-file.png" alt="A damaged file refused, choices kept" width="240" height="333"></td>
</tr>
<tr>
<td align="center"><sub>Date rule shown before saving</sub></td>
<td align="center"><sub>Duplicate caught, with a link to it</sub></td>
<td align="center"><sub>Damaged file refused, nothing lost</sub></td>
</tr>
</table>

## 4. API design and error handling

The endpoint list is in the [README](README.md#api). The choices behind it:

- **One request gives the whole picture:** the accounts request returns the list and the ready summary together.
- **Every error has one shape:** a code (for programs and tests), a client-friendly message shown as written, and, for a refused submit, the providers holding it up. They come from one place in the code.
- **The numbers mean something:** 400 the request was wrong, 404 not found, 409 duplicate, 413 file too big, 422 the request was fine but the situation is not ready.
- **Checks sit where tests can reach them:** simple shape and size checks as a request arrives, the real rules in the backend's main logic.

## 5. UX decisions and accessibility

- **Submit looks switched off but can still be pressed** (`aria-disabled`, not truly disabled). Pressing it early shows the backend's reason and outlines the cards to fix. I weighed a truly disabled button (cannot explain itself) and a normal button (looks like it will work). The downside is that a button that looks off yet responds could puzzle some people, so a plain line beside it says "Submit unavailable - 2 providers need attention" and the refusal is announced as an alert. If an accessibility review preferred another option, it is a small change because the rule lives in the backend.
- **One tap from "what is left?" to done.** Each progress-bar segment and each provider name in the summary opens the right action, and "N providers need attention" filters to what is left.
- **The verdict comes before the commitment.** The calendar knows today's date and says in words whether a statement counts. No date is pre-selected.
- **Hard to lose work.** Removing asks first, and a failed upload keeps the file and date.
- **Usable by everyone.** Keyboard and screen-reader support, status never by colour alone, reduced-motion respected, and a layout that works on a phone.

<p align="center"><img src="docs/screenshots/10-progress-shortcuts.png" alt="Hovering a bar segment: provider, status and what a tap does; names below are tappable" width="520" height="194"></p>

## 6. Testing strategy and CI

| Where | Tests | What they protect |
|---|---|---|
| **Backend** | **48** | The rules: boundary day, duplicates, refused submits (including direct API calls), categories, personal providers, file checks. |
| **Frontend** | **94** | The screen follows the backend and handles loading, errors, search, the calendar, categories, the viewer and duplicates. |
| **Real browser** (Playwright) | **2** | One full journey from refused submit to successful submit, plus a layout check added after a real bug. |

**Nothing goes live unless the checks pass.** GitHub runs all three layers on every pull request and every merge to `main`. The deploy step needs them all to pass, Vercel's own deploy-on-push is off for `main`, and Render only updates after the checks succeed. Since the checks were set up, every change has gone through a pull request. The first two commits went straight to `main` and I have not switched on branch protection, so nothing forces pull requests yet; that is the next setting I would turn on.

**Verify it yourself.** Results are at https://github.com/oliviao12345/FINON/actions. Locally: `cd backend && mvn test`, `cd frontend && npm test`, `cd frontend && npm run e2e`.

## 7. Trade-offs, limitations and next steps

| I chose | Instead of | Cost |
|---|---|---|
| Data in the backend's **short-term memory** (H2) | A saved database such as PostgreSQL | Nothing to install and every demo starts the same, but everything, including uploaded files, is lost when the backend restarts or the free host sleeps. |
| **Keeping the actual file** | Just a name and a date | The client can open what they uploaded, but the app now stores documents. |
| A **provider list in a reviewed file** | A live feed | No free service lists everyday consumer providers. It only stays current if someone updates it. |
| **Drawing Word files in the page** | Google's or Microsoft's viewer | Private documents never leave the app. Old `.doc` files cannot be drawn, so they download. |
| **TanStack Query** | Plain React state with `fetch` | Handles loading, errors and refreshing for every request, at the cost of one more library. |
| **Not saving the "submitted" moment** | A record of each submission | No history of submissions. |

**Java, not Kotlin.** The brief allowed either ("Kotlin/Java") and I used Java 21. The data shapes are records (Kotlin data classes) and the rules sit in plain methods, so the design translates directly.

**Where I went beyond the brief.** The brief treated an upload as a name and a date, in about two hours. I knowingly built more: real files, file checks, previews, categories with drag and drop, a custom calendar and smart search, because the product is only convincing if a client can see and trust what they uploaded. A strict two-hour version would cut file storage and previews, drag and drop, categories, the custom calendar and the shortcuts, and keep backend-owned readiness, the three statuses, duplicate protection and the tests, because those are the brief.

**File handling and the onboarding rules are separate on purpose.** File checks only ask whether a file is supported and readable. The onboarding rules work on metadata: the provider, the statement date and the resulting status. The backend works out readiness from those alone and enforces it on submit, and FINON never reads balances, transactions or dates out of a document. The one link: the screen records a statement only after its file passes the checks. The API also still accepts the original metadata-only request (a name and a date), which counts the same way. The statement date is whatever the client enters, so FINON confirms the client *says* a statement is recent, not that the document proves it. Keeping these apart means a new file type or a better document check can never change who may submit, and the document handling can be removed without touching the onboarding logic.

**Not safe for real documents.** The demo has no sign-in and one client (the brief put both out of scope), yet it stores files, so **do not upload real financial documents to it**. A file that opens is not a safe file: my checks do not scan for malware or prove a file is a genuine statement. A real version would need sign-in, access rules, encrypted storage, virus scanning, retention rules and an audit log.

**Next feature: warn before a statement runs out.** If a statement will stop counting within 14 days, show a small note on the card (not a pop-up) suggesting a newer one. It would never block an upload and would not add a status or change the rules. I left it out to stay inside the brief's three statuses and one submit rule.

**With more time:** a permanent database and file storage; a saved submission record that is safe to repeat; a regular check of the provider list against the Bank of England, PRA and FCA registers; rate limiting and better logging; branch protection; and more browser and accessibility tests.

## 8. AI-assisted development and verification

I used **Claude Code CLI** as an implementation partner, mostly to set up the projects, write the screen and backend code, generate tests and draft documentation. I made the decisions and it carried them out. I described the behaviour and the rules first, then tried each result in the running app and sent it back for changes.

**Design.** I defined the user as a high-net-worth client expecting a premium, professional, trustworthy experience, and gave the AI references from fintech products including Investa and Finary for typography, colour, layout and feel (not their trading screens). I refined the output by how well it communicated onboarding progress, showed what was outstanding and guided the client to submit, not just how attractive it looked.

**What I decided:** the tools and the Vercel/Render split; backend-owned readiness; a pressable Submit; accepting outdated statements; keeping real files; personal providers outside the shared list; one strict duplicate rule; visible, editable categories; and nothing live unless the checks pass.

**Two places review changed the result.** The first file check refused any file whose contents did not match its ending; I pushed back, since a genuine renamed file is fine and a *broken* one is not, so it now looks inside the file. The first version quietly assumed a category; I asked for the suggestion to be visible and editable before saving.

**How I checked.** Most tests were written with AI help, so I treated them as a safety net, not proof: I read them against my rules, tried the app in the browser and, once the checks existed, merged only through pull requests with passing checks.

I can walk through any file and explain why it looks the way it does.
