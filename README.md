# CampusConnect
## Campus Event & Club Management System

**CSE451 — Software Engineering** · Academic release documented November 28, 2026

CampusConnect is a web application for organizing campus events, administering clubs, booking venues, tracking attendance, and sharing announcements and feedback.

## Current release

This README describes the integrated application on `main` at `825c3d4`. PR #23 corrected the dashboard release status. PR #24 integrated JSDoc 4.0.5 through documentation commit c4147f0.

The team previously reported **73 automated tests passed, 0 failed, 0 skipped**, including five PostgreSQL integration suites. The Vite production build and JSDoc generation also passed in prior verification. These are historical results. The README update did not rerun the suite or build. Tracked feature-level evidence is available in the [F04 report](docs/F04-TEST-EVIDENCE.md) and [F05 report](docs/F05-TEST-EVIDENCE.md).

## Development team and feature ownership

| ID | Planned feature | Owner | Status |
|---|---|---|---|
| F01 | Authentication and RBAC | Tasnim Binte Rabbani | Integrated |
| F02 | Club Directory and Administration | Tasnim Binte Rabbani | Integrated |
| F03 | Club Membership Management | Tasnim Binte Rabbani | Future Scope |
| F04 | Event Proposal and Approval | Ananta Bhowmik | Integrated |
| F05 | Event Discovery and Filtering | Ananta Bhowmik | Integrated |
| F06 | Registration and Waitlist | Ananta Bhowmik | Future Scope |
| F07 | QR Attendance | Rayed Mahmud | Integrated |
| F08 | Venue Booking and Conflict Detection | Rayed Mahmud | Integrated |
| F09 | Volunteer Recruitment and Shifts | Rayed Mahmud | Future Scope |
| F10 | Announcements and Notifications | Omar Khaium | Integrated |
| F11 | Feedback and Ratings | Omar Khaium | Integrated |
| F12 | Analytics Dashboard | Omar Khaium | Future Scope |

## System users and role-based access

| User | Access |
|---|---|
| Public visitor | Registers, signs in, browses visible clubs and published events, and reads announcements. The API also exposes feedback summaries for completed events. |
| Student (`student`) | Opens their inbox, views eligible venue schedules, requests a ticket for their existing registration, and manages their own eligible feedback. Public registration creates a student account. |
| Club officer (`club_officer`) | Manages permitted club details and proposals, requests bookings, and manages assigned-club attendance. Authorized officers can create announcements through the API. |
| Campus administrator (`campus_admin`) | Administers club status and officer assignment, reviews proposals and bookings, manages attendance, and uses administrative communication and feedback operations. |

Protected routes verify bearer JWTs. Server-side guards enforce role and ownership requirements.

## Technology stack and architecture

- **Frontend** — JavaScript, React, React Router and Vite. QR functionality uses `qrcode.react` and `@zxing/browser`.
- **Backend** — Node.js, Express, `pg`, `jsonwebtoken`, `bcryptjs`, `dotenv` and `cors`.
- **Database** — PostgreSQL with tracked SQL migrations and local demonstration fixtures.
- **Tooling** — npm workspaces, Node.js test runner, Vite production build and JSDoc 4.0.5.

CampusConnect is a layered client–server application with MVC-inspired organization. React renders the UI and calls the Express JSON API over HTTP. One modular monolithic backend mounts feature routers and shares a PostgreSQL pool. F04 uses routes, controllers, validation, services and models. F05 calls its SQL model from its controller. F07 uses route handlers with a service, and several services execute SQL directly.

## Repository structure

```text
.
├── package.json
├── package-lock.json
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── validation/
│   └── test/
├── frontend/
│   ├── src/
│   └── vite.config.js
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
└── jsdoc.json
```

## Prerequisites and installation

Install Git, Node.js **22.12.0 or newer** with npm, and PostgreSQL **13 or newer** with `psql`. Install both workspaces from the repository root. Terminal examples use Windows CMD unless marked as SQL.

```cmd
git clone https://github.com/anantabhowmik038/campusconnect.git
cd campusconnect
npm ci
```

## Environment configuration

Copy the backend template on a fresh checkout and replace its placeholders locally. Keep the resulting file out of version control.

```cmd
copy backend\.env.example backend\.env
```

```dotenv
DATABASE_URL=postgresql://campusconnect_dev:REPLACE_WITH_LOCAL_PASSWORD@127.0.0.1:5432/campusconnect
JWT_SECRET=REPLACE_WITH_A_RANDOM_JWT_SECRET
ATTENDANCE_TICKET_SECRET=REPLACE_WITH_A_DIFFERENT_RANDOM_TICKET_SECRET
PORT=5000
NODE_ENV=development
```

| Variable | Configuration |
|---|---|
| `DATABASE_URL` | Required for database-backed operations. Use the local role and database below. URL-encode reserved characters in the password. |
| `JWT_SECRET` | Required and nonblank at backend startup. Use a high-entropy random secret. |
| `ATTENDANCE_TICKET_SECRET` | Required for F07 ticket signing and verification. Use a random value of at least 32 bytes after trimming, distinct from `JWT_SECRET`. |
| `PORT` | Optional. Defaults to 5000. Keep that value for the documented local setup. |
| `NODE_ENV` | Optional environment label. The health endpoint defaults to `development` when unset. |
| `VITE_API_BASE_URL` | Optional public setting in `frontend/.env`. Features that read it default to `/api`, which Vite proxies to port 5000 in development. Login and registration currently call `http://localhost:5000` directly. Keep secrets out of Vite variables. |

## PostgreSQL setup and migrations

Use an empty local database and a dedicated login role that owns it. For example, connect as your local PostgreSQL administrator with `psql -h 127.0.0.1 -U postgres -d postgres`, then run the following. The password prompt keeps the password out of command text.

```sql
CREATE ROLE campusconnect_dev LOGIN;
\password campusconnect_dev
CREATE DATABASE campusconnect OWNER campusconnect_dev;
\q
```

Apply the initial schema and then the submission-version migration once per database. Run the read-only schema verifier afterward. Stop and resolve any error before continuing.

```cmd
psql -h 127.0.0.1 -U campusconnect_dev -d campusconnect -v ON_ERROR_STOP=1 -f database/migrations/001_initial_schema.sql
psql -h 127.0.0.1 -U campusconnect_dev -d campusconnect -v ON_ERROR_STOP=1 -f database/migrations/002_event_submission_version.sql
psql -h 127.0.0.1 -U campusconnect_dev -d campusconnect -v ON_ERROR_STOP=1 -f database/migrations/001_verify_schema.sql
```

### Optional local demonstration seeds

`002_f05_browser_demo.sql` requires the local `campusconnect` database over loopback TCP and adds published-event fixtures. `001_demo_data.sql` requires a separate database named `campusconnect_test` and includes disabled demo accounts. For the latter, create that database with the same role as owner and apply both schema migrations to it first. Keep it separate from the disposable regression database.

```cmd
psql -h 127.0.0.1 -U campusconnect_dev -d campusconnect -v ON_ERROR_STOP=1 -f database/seeds/002_f05_browser_demo.sql
psql -h 127.0.0.1 -U campusconnect_dev -d campusconnect_test -v ON_ERROR_STOP=1 -f database/seeds/001_demo_data.sql
```

## Start the application

Run each command from the repository root in a separate terminal.

```cmd
npm run dev:backend
```

```cmd
npm run dev:frontend
```

| URL | Purpose |
|---|---|
| `http://localhost:5173` | React application |
| `http://localhost:5000/api/health` | Express health |
| `http://localhost:5000/api/health/database` | PostgreSQL connectivity |

## Automated testing

The root `npm test` command delegates to the backend's `node --test` script. For the normal run, use a CMD session without an inherited development `DATABASE_URL` or integration database settings. The five PostgreSQL suites skip when their dedicated variables are absent. Set a dummy loopback URL for the mock-backed tests so local dotenv configuration cannot supply a development connection.

```cmd
set "DATABASE_URL=postgresql://unused:unused@127.0.0.1:1/campusconnect_unit"
npm test
```

### Full PostgreSQL regression

Provision an **isolated, disposable database**, such as `campusconnect_regression`, with a dedicated login that can create schemas in it. The suites create and remove their own schemas and load the SQL they need. Use the disposable connection for all five variables. Never point these suites at the normal development database, a shared database or production.

This Windows CMD invocation is reproducible from the test sources. The original regression shell transcript is unavailable. Replace the placeholder locally.

```cmd
set "CC_REGRESSION_URL=postgresql://campusconnect_test_runner:REPLACE_WITH_TEST_PASSWORD@127.0.0.1:5432/campusconnect_regression"
set "DATABASE_URL=%CC_REGRESSION_URL%"
set "F04_TEST_DATABASE_URL=%CC_REGRESSION_URL%"
set "F05_TEST_DATABASE_URL=%CC_REGRESSION_URL%"
set "F07_TEST_DATABASE_URL=%CC_REGRESSION_URL%"
set "F08_TEST_DATABASE_URL=%CC_REGRESSION_URL%"
set "F11_TEST_DATABASE_URL=%CC_REGRESSION_URL%"
npm test
```

Close the dedicated CMD session afterward to clear its environment.

## Frontend production build

```cmd
npm run build
```

Vite writes the frontend assets to `frontend/dist/`. Deployment still requires API routing and security configuration.

## JSDoc generation

```cmd
npm run docs:generate
```

JSDoc processes `backend/src` in pedantic mode. Open `docs/generated/jsdoc/index.html` after generation. Git ignores the generated directory.

## GitHub Wiki and academic documentation

The [CampusConnect GitHub Wiki](https://github.com/anantabhowmik038/campusconnect/wiki) is the entry point for the required academic sections.

1. **01 — Software Requirements Specification**
2. **02 — Software Design Specification**
3. **03 — Trello and Discord Usage**
4. **04 — Architectural Pattern**
5. **05 — Coding Standards**
6. **06 — Source Code Documentation**
7. **07 — UI Design**
8. **08 — Nielsen's Usability Heuristics**
9. **09 — Code Review**
10. **10 — Git Usage and Version Control**
11. **11 — Unit Testing**
12. **12 — Individual Contributions**

## Development workflow and collaboration

Develop on feature branches, use descriptive commits, and open GitHub pull requests. Record test evidence, address review findings, and merge ready changes into `main`. GitHub supports version control, PR review and the Wiki. Trello tracks assignments and progress, Discord supports technical coordination, and Overleaf supports the academic report.

## Known limitations and Future Scope

- F03 membership management, F06 registration and waitlist, F09 volunteer recruitment and shifts, and F12 analytics remain deferred.
- F04 approval stores `approved`. F05 reads `published` events. The integrated release has no transition that publishes an approved proposal.
- F07 requires existing registration records. F11 feedback submission requires a completed event and recorded attendance.
- F10 announcement creation is available through the API. The frontend has no dedicated creation form.
- Independent peer approval was incomplete across the integration PRs.
- Production CORS restrictions and security hardening remain necessary.
- Complete browser, mobile and physical camera testing has not been established. A code coverage percentage has not been measured.
