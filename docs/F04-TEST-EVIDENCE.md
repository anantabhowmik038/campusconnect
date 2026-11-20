# F04 Event Proposal & Approval test evidence

Branch `feat/f04-event-proposal` | Verification date November 19, 2026

## User stories and acceptance criteria

| User story | Acceptance criteria | Evidence |
| --- | --- | --- |
| As a club officer, I can save and edit a proposal for my club. | Create a draft for an assigned active club. Edit a draft or rejected proposal for a currently assigned club. Reject invalid input and cross-club writes. | Verified through HTTP and PostgreSQL. |
| As a club officer, I can send my proposal for review and see feedback. | Drafts and rejected proposals move to pending. The officer list is scoped to current club assignments and includes status and feedback. Rejection feedback stays visible until resubmission, when the previous review fields are cleared. | Verified through HTTP and PostgreSQL. |
| As a campus admin, I can review pending proposals. | Only admins can access the queue or approve/reject. Rejection requires nonblank feedback. A decision stores the authenticated reviewer and review time. Only one simultaneous decision succeeds. | Verified through HTTP and PostgreSQL with identities supplied by the isolated test app. |
| As a CampusConnect user, I can only access proposal data with verified sign-in. | All six production routes return 401 before F01 is integrated. Client-provided identities and roles do not grant access. | Verified through the normal Express application. |
| As an officer or admin, I can complete my workflow from the CampusConnect UI. | Officer views include create, edit, list, submit/resubmit and feedback. Admin views include pending proposals and approve/reject. Both current entry points show the F01 integration status. | Pages compile. Signed-in browser acceptance and screenshots are pending. |

The active-club restriction applies to draft creation. Assigned officers can still edit and submit existing drafts for a club that becomes inactive. Club reassignment transfers proposal access to the currently assigned officer and preserves the original creator.

## Code review finding and correction

An administrator could approve a revised proposal using a form opened before another administrator rejected it. After an officer edited and resubmitted the proposal, its status returned to `pending`. The row lock serialized decisions, but the status alone did not identify which submission the administrator had read.

Migration `database/migrations/002_event_submission_version.sql` adds a nonnegative integer `events.submission_version`. Existing records start at version 0 and each submission or resubmission increments the version in the same update that sets `pending`. The initial migration remains unchanged. The approval queue captures the version displayed when the form opens. The service compares it under the existing event row lock and returns `409 STALE_SUBMISSION` on a mismatch. The queue closes the stale form, shows a conflict message, and reloads its data.

**PostgreSQL regression passed.** Admin A opened the pending proposal, Admin B rejected it, and the officer edited and resubmitted it. Admin A's old approval returned 409. A direct PostgreSQL comparison confirmed that the entire revised row remained unchanged and pending. Admin A refreshed the queue and successfully approved the current version. The simultaneous-review test also passed with one successful decision and one 409.

## API endpoint evidence

| Endpoint | Executed checks |
| --- | --- |
| `POST /api/events` | 201 draft with server-derived creator; 400 invalid capacity; 403 student, another club, or inactive club; 401 without verified identity. |
| `PATCH /api/events/:eventId` | 200 draft/rejected edit; 400 invalid combined date range; 403 cross-club or former officer; 404 missing event; 409 pending edit; 401 without verified identity. |
| `POST /api/events/:eventId/submit` | 200 for draft or rejected proposal; review fields clear on resubmission; 400 server-controlled body field; 403 cross-club; 409 pending or approved; 401 without verified identity. |
| `GET /api/events/proposals` | 200 assigned-club list with pagination, status and feedback; other clubs excluded; 401 without verified identity. |
| `GET /api/events/pending` | 200 admin-only pending queue; 403 officer; 401 without verified identity. |
| `PATCH /api/events/:eventId/review` | 200 approval/rejection with reviewer and time; 400 blank rejection feedback or missing version; 403 student/officer; 409 invalid prior state, concurrent second review, or stale submission; 401 without verified identity. |

Additional validation checks covered absent fields, UUIDs, timestamp timezone and calendar validity, noninteger and out-of-range capacity, and attempts to set server-controlled fields. Public event discovery, registration, and publication routes returned 404.

## Database verification and test output

### Local database initialization

The owner confirmed that the configured `campusconnect` database is the intended local development target. The connection resolved to PostgreSQL 18.7 on loopback. Before migration, the catalog showed an empty `public` schema, no additional user schemas, and no large objects. The configured application role had permission to create objects in `public`.

Applied `001_initial_schema.sql` followed by `002_event_submission_version.sql` to the existing database. Both completed successfully. The database was not dropped, recreated, or seeded. Afterward all 13 expected tables existed and contained zero rows. Catalog verification matched 13 primary keys on `id`, all 25 foreign keys and their delete actions, seven unique constraints, 15 validated check constraints, and nine secondary indexes. This included the event status, capacity, and time-range checks and `events.submission_version INTEGER NOT NULL DEFAULT 0` with a validated `CHECK (submission_version >= 0)`.

The actual Express endpoint `GET /api/health/database` returned HTTP 200 with `{"status":"connected"}` using the configured local connection.

### Disposable PostgreSQL verification

Migration 002 consists of a transactional `ALTER TABLE` that adds the version column. It contains no statements that update or delete existing event fields. In a disposable PostgreSQL 18 instance, migration 001 was applied and a pending event was inserted before running 002. The event count and every preexisting field matched after migration, and the existing event reported version 0. A subsequent insert that omitted the version also defaulted to 0. The database catalog confirmed integer, `NOT NULL`, default 0, and a validated `CHECK (submission_version >= 0)`. Writes of negative and null versions were rejected.

The regular local application role could connect but lacked CREATE permission on its database, so the initial opt-in run could not create a test schema. No privileges were changed. The final run used a disposable PostgreSQL 18 instance. The test applied migrations 001 and 002 in a generated schema, inserted test users and clubs, exercised the HTTP workflow, queried persisted rows directly, and dropped its generated schema.

To reproduce, set the process environment variable `F04_TEST_DATABASE_URL` to a disposable local PostgreSQL database using a test role with CREATE permission in that database. Then run `npm test`. Without this variable, the PostgreSQL suite reports a skip. Never use production credentials or record them here.

Final PowerShell commands used `npm.cmd` because the shell execution policy blocked `npm.ps1`.

```text
npm.cmd test   (F04_TEST_DATABASE_URL configured)
tests 17
pass 17
fail 0
skipped 0

npm.cmd run build
Vite 8.3.8
26 modules transformed
build succeeded

git diff --check
passed
```

## Files created or modified

| Area | Files |
| --- | --- |
| Backend wiring | Modified `backend/src/app.js` |
| Backend feature | Added `backend/src/routes/eventRoutes.js`, `backend/src/controllers/eventController.js`, `backend/src/services/eventService.js`, `backend/src/services/eventError.js`, `backend/src/models/eventModel.js`, `backend/src/validation/eventValidation.js` |
| Database migration | Added `database/migrations/002_event_submission_version.sql` |
| Automated tests | Added `backend/test/eventService.test.js`, `backend/test/eventRoutes.test.js`, `backend/test/eventPostgres.test.js` |
| Frontend wiring | Modified `frontend/src/App.jsx`, `frontend/src/layouts/AppShell.jsx` |
| Frontend feature | Added `frontend/src/features/events/EventWorkspace.jsx`, `frontend/src/features/events/EventProposalsPage.jsx`, `frontend/src/features/events/EventProposalForm.jsx`, `frontend/src/features/events/EventApprovalQueuePage.jsx`, `frontend/src/features/events/EventList.jsx`, `frontend/src/features/events/eventApi.js`, `frontend/src/features/events/events.css` |
| Documentation | Added `docs/F04-TEST-EVIDENCE.md` and updated the F04 review payload in `docs/API-CONTRACTS-V1.md` |

## Frontend screenshots required

No screenshots were captured in this verification run.

- Officer and admin integration-status views on desktop and mobile.
- Signed-in officer creating a draft and editing a rejected proposal.
- My Proposals with statuses and rejection feedback.
- Admin queue and approval/rejection form, including blank rejection feedback and stale-submission conflict recovery.
- Mobile layouts for the proposal form and admin queue.

## Integration blockers and remaining acceptance criteria

- F01 must supply verified `req.user` identity to Express before the F04 routes and supply the frontend's session and authenticated request function. Then verify the actual signed-in officer/admin journeys and capture screenshots.
- The create form currently takes an assigned club UUID. Connect an eligible-club selector when the F02 interface is available.
- Publication remains pending the F08 venue policy. F04 approval ends in `approved`.
- Commit reference and pull request reference are pending authorization. No commit, push, or merge was made for this phase.
