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

## Trade-offs

- H2 in memory: zero setup, but all changes vanish on restart. Fine for a demo, wrong for anything real.
- "Submitted" is a client-side confirmation only; the API validates and acknowledges but does not persist a submission record.
- Uploads store a file name and a date only, per the brief.
- No authentication, single client.

## With more time

- Persistent PostgreSQL and a stored submission record with audit trail.
- Idempotent submit and optimistic locking on accounts.
- Real file storage with type and size validation.
- Optimistic UI for remove, and per-row pending states.
- Broader e2e coverage (mobile viewport, keyboard-only run) and automated accessibility checks.
- Rate limiting and structured logging on the API.

## AI assistance

AI tooling was used to help scaffold the project and draft code and tests. Behaviour, rules and trade-offs above are mine to explain and defend.
