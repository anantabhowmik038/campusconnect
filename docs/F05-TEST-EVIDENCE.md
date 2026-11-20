# F05 Event Discovery & Filtering test evidence

Branch `feat/f05-event-discovery` | Verification date November 19, 2026

## User stories and acceptance criteria

| User story | Acceptance criteria | Evidence |
| --- | --- | --- |
| As a visitor, I can discover published campus events without an account. | The list includes only published events and returns public fields and a filtered total. | Verified through HTTP and PostgreSQL for all seven event statuses. |
| As a visitor, I can narrow the catalog and browse the results. | Search matches title and description without regard to case. The category filter matches exactly without regard to case. Campus dates include both selected days. Combined filters, sorting, ties, and pagination produce consistent results. | Verified through HTTP and PostgreSQL, including literal percent and underscore, both campus midnight boundaries, and an empty page with a nonzero total. |
| As a visitor, I can open an event directly and go back to the same results. | Published details work anonymously. Unknown and nonpublic event UUIDs return the same response. Filter and pagination values travel in the browser URLs. | API behavior and Vite direct-detail HTML verified. The user reported that Back to events restored all filters, sort, and page. |
| As a visitor on desktop or mobile, I can use the filter form and understand the page state. | Events navigation, labeled controls, loading, empty, retry, and unavailable states are present in the UI. | The user reported mobile layout, keyboard navigation, unavailable state, and offline retry checks. See the manual results below for coverage. |

## Implemented endpoints

| Endpoint | Verified behavior |
| --- | --- |
| `GET /api/events` | Anonymous list with `search`, `category`, `from`, `to`, `page`, `limit`, and `sort`. Exact public projection, published-only filtering and totals, and structured validation errors. |
| `GET /api/events/:eventId` | Anonymous detail with public description, 400 for invalid UUID or query parameters, and identical 404 responses for all nonpublic statuses and a missing UUID. |

## Technical audit fixes and regressions

| Original finding | Fix and verified regression |
| --- | --- |
| The public detail route captured `/proposals` and `/pending` before F04 could authorize them. | The Express detail route skips those reserved names. With F05 mounted first, both downstream stand-in protected handlers returned 401 to anonymous requests, including case and trailing-slash variants. The stand-ins were reached without querying event storage. An anonymous UUID detail still returned 200. |
| Malformed detail encoding returned 500, and the framework query parser could ignore a repeated parameter past its cutoff. | The F05 router maps malformed path encoding to a safe, structured 400. F05 checks the complete raw query within a 4,096-byte limit before decoding it and rejects malformed encoding, repeated names, and unsupported names before obtaining a PostgreSQL pool. Regression tests cover both routes, including a duplicate and an unsupported key past the former cutoff, and duplicates whose names use different URL encodings. |

## Automated and database verification

- The final pre-commit run of `npm.cmd test` with `F05_TEST_DATABASE_URL` set to disposable PostgreSQL 18.7 passed **12 tests, 0 failures, 0 skips**. This includes the existing health smoke tests, all three audit regressions, and the PostgreSQL suite.
- The integration suite applied migration `001_initial_schema.sql` to a generated schema and inserted a club, a user, and events covering every status. The suite verified the exact public keys, combined filters, and removal from both endpoints after a published fixture changed to cancelled. PostgreSQL ran with its session default time zone set to UTC, so the date assertions checked the explicit Dhaka conversion.
- The PostgreSQL tests skip with an explicit message when `F05_TEST_DATABASE_URL` is absent. To reproduce the full run, point it at a disposable PostgreSQL database with a test role that can create schemas, then run `npm.cmd test`.
- During initial F05 verification, a separate smoke check started the normal Express app and the Vite dev proxy using two published demo fixtures in a disposable cluster. The proxied paginated list, detail API, database health endpoint, and direct detail HTML all responded as expected.
- The F05 browser seed rejected a connection to a database with the wrong name. Two runs against a disposable `campusconnect` database over loopback left four published events, one draft, one approved event, one club, and one disabled user. The insert-only seed uses fixed IDs and a disabled-account placeholder. It contains no credentials.
- `npm.cmd run build` passed with Vite 8.3.8. `git diff --check` passed.

## Manual browser acceptance

The user reported the following results from manual testing with the local F05 demo fixtures. These observations are separate from the automated runs above.

| Check | User-reported result |
| --- | --- |
| Published listing | Displayed all four demo events. |
| Keyword search | `robotics` returned two matching events. |
| Category filter | `Workshop` returned two events. |
| Date range | November 21, 2026 as both bounds returned two events. |
| Combined filters and pagination | `limit=1` and `page=2` displayed Campus Coding Lab. |
| Event details | Displayed the expected public information. |
| Back to events | Preserved search, category, date range, sorting, and page number. |
| Direct unpublished detail | The draft URL displayed **Event unavailable**. |
| Mobile visual check | Layout checked at 440 px and 360 px. |
| Keyboard navigation | Tab and Enter worked. |
| Offline recovery | The offline request displayed an error. Retry after reconnecting restored all four events. |

Screenshots are pending attachment. No acceptance screenshots are stored in the repository.

## Files changed

| Area | Files |
| --- | --- |
| Backend wiring | Modified `backend/src/app.js` |
| Backend feature | Added `backend/src/controllers/publicEventController.js`, `backend/src/models/publicEventModel.js`, `backend/src/routes/publicEventRoutes.js`, `backend/src/validation/publicEventValidation.js` |
| Automated tests | Added `backend/test/publicEventRoutes.test.js`, `backend/test/publicEventPostgres.test.js` |
| Development fixtures | Added `database/seeds/002_f05_browser_demo.sql` |
| Frontend wiring | Modified `frontend/src/App.jsx`, `frontend/src/layouts/AppShell.jsx` |
| Frontend feature | Added `frontend/src/features/events/EventCard.jsx`, `frontend/src/features/events/EventFilters.jsx`, `frontend/src/features/events/PublicEvents.jsx`, `frontend/src/features/events/eventDiscovery.css`, `frontend/src/features/events/publicEventApi.js` |
| Documentation | Modified `docs/API-CONTRACTS-V1.md` and added `docs/F05-TEST-EVIDENCE.md` |

## Integration dependencies

- F05 uses the existing initial schema and runs independently of F01. When integrating F01, preserve anonymous access and add the public list and detail paths to the integrated frontend router. The deployment host must serve the Vite app for direct detail URLs.
- F05 yields F04 PR #7's `/proposals` and `/pending` routes even when F05 is mounted first. Mount both routers before the shared API 404 handler, and scope authentication to protected operations so it does not gate the public list or detail. Add any future protected single-segment GET paths to F05's reserved set or register them ahead of the public detail route.
- Newly approved events become discoverable once the separate F04/F08 publication workflow sets their status to `published`. F05 supplies read-only discovery for rows already in that state.

- GitHub PR · Pending
- Commit · Pending
