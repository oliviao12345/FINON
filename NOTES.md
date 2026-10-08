# Notes

The README covers running FINON and shows the screens and diagrams. This file is the reasoning: where each piece of logic lives, the rules I enforce, what I chose not to build, and how I used AI. It is meant to be read in five minutes.

1. [Engineering approach and key decisions](#1-engineering-approach-and-key-decisions)
2. [State modelling and ownership](#2-state-modelling-and-ownership)
3. [Business rules and validation](#3-business-rules-and-validation)
4. [API design and error handling](#4-api-design-and-error-handling)
5. [UX decisions and accessibility](#5-ux-decisions-and-accessibility)
6. [Testing strategy and CI](#6-testing-strategy-and-ci)
7. [Trade-offs, limitations and next steps](#7-trade-offs-limitations-and-next-steps)
8. [AI-assisted development and verification](#8-ai-assisted-development-and-verification)

## 1. Engineering approach and key decisions

The screen exists to answer one question: **"am I ready to submit?"** Everything follows from where I decided that answer should be calculated.

| Decision | Alternative I considered | Why I chose this |
|---|---|---|
| The **server** works out statement status and submission readiness. | Compute readiness in React from the statement dates. | One source of truth. Duplicating a business rule in two languages is how the screen and the API end up disagreeing. |
| **Submit is re-validated on the server.** | Trust the disabled button. | UI validation is guidance, not enforcement. Someone calling the API directly must not be able to submit an incomplete set. |
| Keep a thin, modular **single service**. | Microservices, or a separate readiness service. | The brief has one bounded context. More moving parts would add cost without meeting a requirement. |
| **Build the rules first, then the experience.** | Start with the screen. | I proved add, upload and submit end to end with tests, then layered the interface on top, so the polish never outran the logic. |

## 2. State modelling and ownership

I separated what is **stored** from what is **derived**, and kept UI-only state out of both.

| Kind | Examples | Owner | Why |
|---|---|---|---|
| **Persisted** | Provider catalogue, the client's accounts and chosen category, statement file name, date and the stored file | Backend database | This is the data the client actually supplied. |
| **Derived** | Statement status (Missing, Uploaded, Outdated), the ready count, `canSubmit`, the list of issues | Backend, calculated on every read | Time passing changes the answer. Storing it would mean a statement could still read "Uploaded" the day after it expired. |
| **Server state in the client** | The account list, the catalogue | TanStack Query (fetch, cache, refresh) | Gives loading, error and success handling for every request in one place. Every change invalidates the lists so the screen is always redrawn from the server. |
| **UI-only state** | Selected filter, search text, open dialogs, the draft in a form | React local state | Nothing outside the screen needs it. |

**The alternative I rejected** was calculating readiness in React. It would have saved a field on the response but created two implementations of the same rule. As it stands the progress bar, the sentence beneath it, the Submit button and the server's own check cannot drift apart, because they all render one response.

## 3. Business rules and validation

### Statement status

| Scenario | Result | Reason |
|---|---|---|
| No statement | **Missing** | No evidence supplied. |
| Dated within the last three calendar months | **Uploaded** | Meets the freshness rule. |
| Dated exactly three calendar months ago | **Uploaded** | The boundary is inclusive. |
| Older than three calendar months | **Outdated** | Kept on record, but does not count and blocks submission. |
| Dated in the future | **Rejected (400)** | Invalid input: it cannot describe an issued statement. |
| Any provider Missing or Outdated, or no providers at all | **Submit rejected (422)** | The server enforces completeness. |

Two things I want to be able to defend:

- **Three calendar months, not 90 days.** Months differ in length, so the cutoff uses calendar-month arithmetic (31 May minus three months is 28 February, as `java.time` does it). The clock is injected, so the boundary is tested on the exact day rather than approximated.
- **An outdated statement is accepted, not refused.** It is valid data that fails a business requirement, so I save it as Outdated and exclude it from readiness. The client sees what needs replacing instead of losing the record, and all three required statuses stay demonstrable. The calendar warns about it before saving; the server decides.

<p align="center"><img src="docs/screenshots/07-submit-refused.png" alt="A premature submit: the server's reason and the providers at fault" width="520" height="148"></p>

### Other invariants the server owns

- **No duplicate providers, under any disguise.** One definition of "the same name" ignores case, accents, spacing, punctuation and "&" versus "and", so `HSBC`, `H.S.B.C.` and `hsbc` collide. It is applied to catalogue picks, typed-in names, the client's list, repeats in one request, and the catalogue itself (the app refuses to start if two entries collide). A duplicate request is rejected whole (409), never partly applied.
- **Providers typed in under "Other" are personal.** Stored only on the client's own account, never in the shared catalogue, so they cannot appear in anyone's pick-list.
- **Uploaded files must be genuinely openable.** The server decides what a file is from its contents and confirms it is intact (PDFs load, pictures decode, Word packages are complete). Damaged files are refused and nothing is saved. A real file with the wrong extension is accepted, because rejecting it adds friction without protecting anything.
- **Categories are the client's call.** Pre-filled with a suggestion, visible and editable, and validated against a fixed list.

<table>
<tr>
<td align="center" valign="top"><img src="docs/screenshots/03-statement-date.png" alt="Calendar: older dates in red with a verdict" width="240" height="500"></td>
<td align="center" valign="top"><img src="docs/screenshots/08-duplicate.png" alt="A disguised duplicate refused with a link to the existing entry" width="240" height="257"></td>
<td align="center" valign="top"><img src="docs/screenshots/09-damaged-file.png" alt="A damaged file refused, choices kept" width="240" height="333"></td>
</tr>
<tr>
<td align="center"><sub>Date rule shown before saving</sub></td>
<td align="center"><sub>Duplicate caught, with a way to the entry</sub></td>
<td align="center"><sub>Damaged file refused, nothing lost</sub></td>
</tr>
</table>

## 4. API design and error handling

The endpoint table is in the [README](README.md#api). The design choices behind it:

- **Resource-shaped, with the aggregate on read.** `GET /api/accounts` returns the rows *and* the readiness summary, so the client never needs a second call to know whether it may submit.
- **Mutations return the updated state.** Adding returns the refreshed list, so a response is never out of step with the screen.
- **One error shape for every failure:** `{ code, message, issues[] }`, produced in a single exception handler. `code` is stable for programmes and tests, `message` is written for the client and shown as it is, and `issues` carries the providers at fault when a submit is refused.
- **Status codes mean something:** 400 for invalid input (future date, bad name, bad category, unsupported or unreadable file), 404 for unknown references, 409 for a duplicate, 413 for an oversized file, 422 for a well-formed submit that breaks a business rule. I separated 400 from 422 deliberately: the request was valid, the *state* was not ready.
- **Validate at the boundary, once.** Shape and size checks sit on the request; the rules (duplicates, dates, completeness) sit in the service, where tests can reach them without HTTP.

## 5. UX decisions and accessibility

- **Submit uses `aria-disabled`, not `disabled`.** It looks inactive but can still be pressed, so a premature attempt surfaces the server's explanation and outlines the cards to fix. A dead button tells the client nothing. I think this is the clearest place where a business rule changed a UI choice.
- **Move from "what is left" to done in one tap.** Every progress-bar segment, and every provider name in the summary, opens the right action for that provider; "N providers need attention" filters the list to what is left. Hovering or tabbing to a bar says what a tap will do ("Add statement?").
- **Show the verdict before the client commits.** The calendar knows today's date, marks older dates red and states in words whether the statement counts. Nothing is pre-selected, so no message appears about a date the client hasn't chosen.
- **Make defaults visible.** Category dropdowns are pre-filled with a suggestion the client can see and change, rather than applied silently.
- **Reversible and confirmed.** Removing a provider asks first; an upload that fails keeps the chosen file and date so nothing has to be re-entered.
- **Accessible by default.** Keyboard and screen-reader support for the bar, dialogs, calendar and drag and drop; status is never colour alone (always an icon and a word); motion respects reduced-motion; the layout stacks cleanly on a phone.

<p align="center"><img src="docs/screenshots/10-progress-shortcuts.png" alt="Hovering a bar segment: provider, status and what a tap does; names below are tappable" width="520" height="194"></p>

<table>
<tr>
<td align="center" valign="top"><img src="docs/screenshots/02-add-providers.png" alt="Add providers: pre-filled categories, searchable and removable selection" width="260" height="416"></td>
<td align="center" valign="top"><img src="docs/screenshots/04-statement-viewer.png" alt="Viewing an uploaded statement with an in-app Word preview" width="260" height="343"></td>
</tr>
<tr>
<td align="center"><sub>Visible, editable categories</sub></td>
<td align="center"><sub>View what was uploaded, in place</sub></td>
</tr>
</table>

## 6. Testing strategy and CI

I tested the behaviour I most wanted to protect, close to where it lives, then proved the whole story in a real browser.

| Layer | Count | What it protects |
|---|---|---|
| Backend (JUnit, Spring Boot Test) | **48** | The rules: status boundaries on a frozen clock, duplicates in every disguise, submit refusal including direct API calls, categories, personal providers staying out of the catalogue, and the file rules (real files accepted, truncated or corrupt ones refused, a renamed genuine file accepted). |
| Frontend (Vitest, Testing Library) | **94** | That the screen follows server data, gives feedback for loading, success and failure, and handles search, filters, shortcuts, the calendar, categories, the viewer and duplicates. |
| Browser (Playwright) | **2** | One full journey: premature submit refused, a damaged upload refused, statements added and replaced, a Word preview, a drag between categories, providers added and removed, then submit. Plus a layout guard for a scrolling dialog, added after a real bug. |

**CI and release.** GitHub Actions runs all three layers on every pull request and on `main`. Production changes only after they pass: Vercel's deploy-on-push is switched off for `main` and a final CI job triggers the deploy; Render redeploys the API only after the checks succeed. I merged through pull requests throughout.

**A caveat on the tests:** most were written with AI assistance, so I treated them as a safety net, not proof. What matters is that each assertion reflects a rule I specified.

## 7. Trade-offs, limitations and next steps

| Choice | Alternative | Consequence I accepted |
|---|---|---|
| In-memory H2 | PostgreSQL | Zero set-up and a fresh demo every start; all data, including files, is lost on restart, and the free host sleeps when idle. |
| Store the real file (beyond the brief, which said a name and a date) | Treat an upload as a name and a date | The client can view what they uploaded, at the cost of storing documents. See the security note below. |
| Catalogue as a reviewed data file | A live feed | No free source returns consumer brand names, so refreshing means editing one file. Cheap and reviewable; stale unless someone maintains it. |
| Preview `.docx` in the browser | Hand it to a third-party viewer | Private documents never leave the app; legacy `.doc` cannot be drawn reliably, so it offers a download. |
| "Submitted" is not persisted | A stored submission record | The API validates and acknowledges but keeps no audit trail. |

**Java rather than Kotlin.** The brief allowed either ("Kotlin/Java"), and I used Java 21. Nothing in the design depends on that: the request and response types are records (they map to Kotlin data classes), and the rules sit in plain service methods behind a thin controller, which translate directly.

**Not suitable for real documents as it stands.** The demo deliberately has no sign-in and a single client, yet it stores uploaded files. A real version would need authentication and per-client access control, encrypted object storage, malware scanning, retention rules and an audit log. I did not build these, and the demo should not be given real financial documents.

**What I chose not to build:** authentication, multiple clients, a persistent database, an audit trail, and a live provider feed. Each was out of scope or needs infrastructure the exercise doesn't have.

**With more time:** PostgreSQL and object storage; a stored submission record with idempotent submit and optimistic locking; a scheduled check of the catalogue against the Bank of England, PRA and FCA registers; rate limiting and structured logging; and broader browser coverage (mobile viewport, keyboard-only) with automated accessibility checks.

## 8. AI-assisted development and verification

I used **Claude Code** as an implementation partner, mainly for scaffolding, component and endpoint implementation, test generation and drafting documentation. I made the decisions and it executed them.

**How I worked.** I stated the behaviour and constraints first, had the AI implement against them, then reviewed the result in the running app and corrected it. It was iterative, not one prompt to an application.

**Decisions I made and directed:** the stack and the Vercel/Render split; the server-owned readiness model; keeping Submit pressable; accepting outdated statements; storing real files beyond the brief; personal providers kept out of the catalogue; one strict duplicate rule; visible, editable categories; and a rule that nothing reaches production unless CI passes.

**Two places where review changed the outcome:**

- *Upload validation.* The first version rejected a file whose contents didn't match its extension. I pushed back: a genuine document with the wrong extension isn't a problem, whereas a *broken* file is. We moved to content-based checks that refuse damaged files and accept renamed ones.
- *Category selection.* The first version applied a suggested category silently. After using it in the browser I asked for the suggestion to be visible and editable before saving.

**How I verified.** Automated tests at three levels, hands-on checks in the browser, and pull requests with CI gating every merge. I did not accept generated tests as independent proof; I read them against the rules I had specified.

I can walk through any file and explain why it looks the way it does.
