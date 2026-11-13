# CampusConnect — Team Development Kickoff Guide

**Version:** 1.0 Draft | **Date:** November 13, 2026 | **Status:** Review required

## Immediate goal

Allow all four members to progress without waiting for another person's entire feature to be implemented. Independent UI, API controllers with mocked dependencies, validation, tests, and documentation can be developed in parallel; shared database migrations and authentication integration must follow approved contracts.

## Repository and branching

Repository: https://github.com/anantabhowmik038/campusconnect

1. Coordinator confirms PR #1 (`setup/project-foundation`) has an official GitHub approval and is merged into `main` **using a merge commit**, preserving the original eleven commits. A green 'No conflicts' indicator is not a review approval.
2. Coordinator confirms `main` includes the shared foundation before teammates branch off it.
3. Each teammate clones and creates a dedicated feature branch **from updated main**:

```bash
git clone https://github.com/anantabhowmik038/campusconnect.git
cd campusconnect
npm install
git switch main
git pull origin main
git switch -c feat/f01-auth-rbac
```

Use an appropriate branch name instead: `feat/f04-event-proposal`, `feat/f07-qr-attendance`, `feat/f10-notifications`. Create further focused branches as needed.

4. Never commit `.env`, passwords, generated build files, `node_modules`, or secrets.
5. Do not push directly to `main`; push feature branch, open PR, assign reviewer, attach PR in Trello.
6. The database design and API documentation remain **DRAFT** until the team approves them.

## Local setup for each member

- Install Node.js compatible with repo dependencies, npm, and PostgreSQL.
- Inspect root `package.json` scripts, `docs/SETUP.md`, and `backend/.env.example` in the repo; use the repository's real instructions as the source of truth.
- Create a **local** PostgreSQL `campusconnect` database and least-privilege local application role. Each member sets their **own** `backend/.env` based on `.env.example`. Never share a database password via GitHub or Discord.
- Start frontend and backend using the scripts documented in root `package.json` (previous foundation verification used `npm run dev:frontend` and `npm run dev:backend`).
- Verify front end loads and backend `/api/health` returns status ok. If available, verify local `/api/health/database` returns connected.
- Run `npm test` and `npm run build` to confirm baseline before feature edits. Initial foundation tests cover only two basic API cases; they do not verify the twelve features.
- Share sanitized results and blockers in Discord `#task-updates`.

## Parallel development assignments

### Tasnim — F01/F02/F03

**Start today:** register/login pages, validation and auth tests; `GET /api/auth/me` mock; club directory/cards; membership request/review screens; documented per-club officer permission policy.

**Shared blocker:** final login/session approach and permissions matrix. Own proposed `users`, `clubs`, and `club_memberships` schema. Other members need an agreed identity shape (`user.id`, `user.role`) even before real auth is finished.

**First useful PR:** Auth UI + validation + tested mock auth interface (no hardcoded secrets). Separate final auth/backend integration after decisions.

### Ananta — F04/F05/F06

**Start today:** event proposal form and validation, event listing/filtering UI, registration/waitlist states, use-case tests, draft event status transitions and transactional waitlist algorithm.

**Shared blocker:** auth identity, club authorization, venue-publication rules. Own `events` and `event_registrations`.

**First useful PR:** Event proposal UI + service interface and tests with mocked club/user context.

### Rayed — F07/F08/F09

**Start today:** QR check-in screen with safe mock, booking availability UI, volunteer shift/apply UI, test scenarios for duplicate scans and venue overlap; shared Figma screens and UI review.

**Shared blocker:** `event_registrations` identity and status, event dates, QR token signing/validation, PostgreSQL booking conflict strategy. Own `venues`, `venue_bookings`, `event_attendance`, `volunteer_shifts`, `volunteer_applications`.

**First useful PR:** Venue booking UI + overlap validation tests (without treating client-side checks as sufficient booking protection).

### Omar — F10/F11/F12

**Start today:** announcement/notification UI, mark-as-read UI with mocks, feedback form/rating validation, analytics dashboard with labeled mock data; architecture document and review checklist.

**Shared blocker:** notification trigger interface, post-event feedback eligibility and analytics metric definitions. Own `announcements`, `notifications`, `event_feedback`.

**First useful PR:** Notification UI and feedback validation with mock data, tested.

## PR review assignments

- Tasnim feature PRs → Omar
- Ananta feature PRs → Rayed
- Rayed feature PRs → Ananta
- Omar feature PRs → Tasnim

Reviewers must actually inspect the diff, test relevant behavior, and submit a GitHub review. A Discord message or 'No conflicts' badge does not replace formal approval.

## Coding and evidence rules

- Match repo's existing React, Express, JavaScript, ESLint/Prettier and JSDoc conventions.
- Keep API handling, business logic, and data access separate according to the proposed MVC + Service Layer structure.
- Add focused tests for every meaningful feature, especially invalid input/permissions/duplicate actions.
- Use meaningful commits with scoped titles; do not commit everything as 'final update'.
- Track Trello cards in `DOING`, then `REVIEW`, then `DONE` if those columns exist; otherwise use existing board status columns only.
- In Discord: assignments in `#announcements`, reviews and progress in `#task-updates`, technical decisions in `#decisions`.
- The final GitHub Wiki and Overleaf report must reference **actual** outcomes and test evidence, not imagined results.

## Definition of ready to implement integrated modules

- [ ] Foundation PR #1 officially approved and merged to `main`
- [ ] Teammates can clone, install, run the app and baseline tests locally
- [ ] Agreed user identity/auth middleware interface
- [ ] Approved table names, PK/FK, status values and event↔venue relationships
- [ ] Approved API method/path/role/payload/response/error contracts
- [ ] Feature-specific branch owned by each teammate

Until all items are complete, work on independent UI, tests, mock services and documentation; avoid merging conflicting shared DB/auth changes.
