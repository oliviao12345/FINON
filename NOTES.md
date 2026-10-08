# Notes

## Key decisions

- **Status is derived, never stored.** A statement is Outdated when its date is before today minus three calendar months; a statement exactly three months old is still current. The clock is injected, so boundary tests are deterministic.
- **The server owns readiness.** `GET /api/accounts` returns the rows plus `ready / total / canSubmit / issues`. The UI renders that and never recomputes it, so the two cannot drift.
- **Submit is enforced on the server.** `POST /api/submit` re-validates and returns 422 with the offending providers. An empty selection is deliberately not submittable: there is nothing to advise on.
- **Duplicates are rejected as a whole.** Adding a set that contains an already-added provider returns 409 and adds nothing, rather than partially applying. The catalogue endpoint also hides added providers, and the database enforces uniqueness.
- **Future-dated statements are rejected** (400), since they would otherwise always read as current.
- **The Submit button uses `aria-disabled`, not `disabled`.** It looks inactive but can still be pressed, so a premature attempt surfaces the server's explanation and highlights the rows to fix.
- **Replacing a statement defaults the date to today**, not the previous date, which would have silently kept it Outdated.
- **One state source on the client.** TanStack Query holds server state; every mutation invalidates accounts and providers.

- **The catalogue is a reviewed data file, not a feed.** `backend/src/main/resources/providers.csv` holds about 240 UK providers (banks, building societies, investment platforms, pension schemes, insurers, savings). Refreshing it means editing one file and redeploying. No free API returns consumer brand names: the FCA register is looked up by firm and uses legal entity names, and the Bank of England and PRA publish downloadable bank lists with no pension or platform coverage.
- **"Other" covers anything missing, and stays personal.** The client can type a provider or institution. The server tidies and validates the name, matches it against the catalogue case-insensitively (so "monzo" resolves to Monzo), refuses repeats, and otherwise stores the name on the client's own account only. It is never written to the provider table, so it can never appear in the shared list, and it disappears when removed.
- **Statement help is small and verified.** Five providers carry an official "how to get your statement" link, checked on the provider's own site; one has a phone number that appears on its own page. Start-up refuses links that are not https or have no verified date, because contact details go stale and each one needs upkeep.
- **Uploaded files are stored, not just named (a deliberate step beyond the brief).** The brief says to treat an upload as a file name and a date; at the product owner's request the actual file is kept so the client can view it again. It is limited to PDF, Word, JPG and PNG up to 5 MB, and the server opens it to check it: it works out what the file really is from its contents, then confirms it is intact (PDFs load as documents, pictures decode, Word packages are complete). Damaged or cut-off files are refused with a clear message and nothing is saved; a genuine file that was merely renamed is accepted and handled as what it really is, and password-protected PDFs are accepted. Each file is returned as its real type with `nosniff` and no caching; PDFs and images are inline, Word files are downloads. Files live in the same in-memory database, so they disappear on restart; for anything real this would move to object storage with virus scanning and retention rules.
- **Word documents are previewed in the browser, privately.** Modern .docx files are drawn client-side by a small library loaded only when needed, so a private document is never handed to a third-party viewer and the API needs no office software. Legacy .doc files can't be rendered reliably in a browser, so they offer a download instead.
- **Every row that needs a statement has a link.** A verified how-to page where we have one, otherwise the provider's own website (checked to respond), otherwise a web search.
- **Search is forgiving.** One matcher handles capitals, punctuation, partial words, initials and a single typo, and drives both the list search and the Add dialog.
- **Statements only accept PDF, Word (.doc, .docx), JPG, JPEG and PNG**, enforced on the server by file-name extension as well as in the picker.

- **A calm, personal welcome.** The screen greets the client by name (a single constant, since there is no sign-in) with understated copy suited to high-net-worth clients, and deliberately makes no security claims the demo cannot back up.

- **The date picker explains validity before saving, but the server decides.** The calendar opens on today, computes the three-calendar-month cutoff the same way Java does (month ends clamp), colours older dates red, disables future dates, and states in words whether the statement is current or outdated. Outdated dates stay selectable on purpose: an old statement is valid input that fails a business rule, so it is saved as Outdated and excluded from readiness, which also keeps the third status demonstrable. Future dates are invalid input and are rejected by the API.
- **Categories are visible and the client's to change.** When adding, each provider's category dropdown is pre-filled with the suggestion (typed-in ones start on Other) and can be switched before saving; what is shown is what is stored. It stays editable later by dropdown or drag and drop. The list is grouped by category for the adviser, and anything typed in under Other sits in its own "Added by you" section while keeping its category.
- **"Same name" has one definition.** Case, accents, spacing, punctuation and "&" versus "and" are ignored, so "HSBC", "H.S.B.C." and "hsbc" collide everywhere: catalogue, typed-in names, the client's list and a single request. The app refuses to start if the catalogue contains two names that collide.
- **The progress bar is a shortcut, not a decoration.** Each segment jumps to its provider and opens Add or Replace; the "N providers need attention" line filters the list to what is left.

## Trade-offs

- H2 in memory: zero setup, but all changes vanish on restart. Fine for a demo, wrong for anything real.
- "Submitted" is a client-side confirmation only; the API validates and acknowledges but does not persist a submission record.
- Files are held in memory (see above), not in durable storage.
- No authentication, single client.

## With more time

- A weekly job that checks `providers.csv` against the Bank of England and PRA lists and the FCA register (free API key), flags closed or renamed firms and opens a pull request for review.
- Provider logos and aliases (for example "Lloyds" finding Lloyds Bank).

- Persistent PostgreSQL and a stored submission record with audit trail.
- Idempotent submit and optimistic locking on accounts.
- Real file storage with type and size validation.
- Optimistic UI for remove, and per-row pending states.
- Broader e2e coverage (mobile viewport, keyboard-only run) and automated accessibility checks.
- Rate limiting and structured logging on the API.

## AI assistance

AI tooling was used to help scaffold the project and draft code and tests. Behaviour, rules and trade-offs above are mine to explain and defend.
