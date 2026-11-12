# CampusConnect — Development Foundation Setup

This is a **working starter scaffold**, not a completed 12-feature application.
Use only on `setup/project-foundation` until reviewed and approved.

## Requirements

- Node.js **22.12 or later**, npm, Git and VS Code
- PostgreSQL, if you want to test the database connection

## Install

Open a VS Code terminal in the root `campusconnect` folder:

```powershell
node --version
npm --version
npm install
```

`npm install` uses npm workspaces and creates a root `package-lock.json`. Commit the lockfile with the foundation changes.

## Run in two terminals

Terminal 1:

```powershell
npm run dev:backend
```

Terminal 2:

```powershell
npm run dev:frontend
```

- Frontend: http://localhost:5173
- API health: http://localhost:5000/api/health
- Database health: http://localhost:5000/api/health/database

Open the frontend and press **Check API**. Expect `CampusConnect API is running` when the backend is online.

## PostgreSQL connection

The frontend and Express health endpoint can start **without PostgreSQL**. To test your database:

1. Create a local PostgreSQL database named `campusconnect`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Replace `YOUR_LOCAL_PASSWORD` with your own local credentials.
4. Restart the backend.
5. Open http://localhost:5000/api/health/database — expect `{"status":"connected"}`.

Without `DATABASE_URL`, database-health returns HTTP 503 with `not_configured`.
A failed connection returns HTTP 503 with `unavailable`.

**Never commit `backend/.env`, passwords, tokens, or other secrets.**

## Test and build

```powershell
npm test
npm run build
```

The initial tests cover **only basic server behavior**, not real feature tests.

## Folder boundaries

- `frontend/src/layouts` — common application layout
- `frontend/src/components` — shared UI components
- `frontend/src/features` — assigned feature React code
- `backend/src/routes` — route declarations
- `backend/src/controllers` — HTTP handling
- `backend/src/services` — business and database-check logic
- `backend/src/models` — future approved data access modules
- `backend/src/middleware` — error/security middleware
- `database/migrations` — only reviewed SQL migrations

## Collaborative flow

1. Review proposal and select final technologies.
2. Run both servers locally, run backend tests, and collect screenshots.
3. Commit and push `setup/project-foundation`.
4. Open a Pull Request to `main` and obtain the team's review.
5. After merge, each member pulls the latest `main` and makes their own feature branch.
6. Agree on schema and API contracts **before** implementing dependent features.

Read `docs/SHARED-CONTRACTS-DRAFT.md` — it lists pending joint decisions.
