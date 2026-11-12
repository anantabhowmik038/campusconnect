# CampusConnect — Shared Integration Contracts (DRAFT)

This document is not an approved schema. Discuss and approve it in Discord before implementation.

## Owners
- Tasnim: F01–F03 — users, clubs, club membership
- Ananta: F04–F06 — event proposals, discovery, registration/waitlist
- Rayed: F07–F09 — attendance, venues, volunteers
- Omar: F10–F12 — announcements, feedback, analytics

## Proposed roles — pending team approval
- Student
- Club Officer
- Campus Administrator

## Foundation API endpoints (actually implemented)
- `GET /api/health` → HTTP 200, basic server status
- `GET /api/health/database` → HTTP 200/503, PostgreSQL connection status

## Items to finalize before feature development
1. Shared PostgreSQL schema: users, clubs, members, events, proposals, registrations, attendance, venues, shifts, notifications, feedback.
2. Primary-key types, foreign-key relationships, enum/status values, migrations.
3. Authentication strategy, login API, current-user API, role permissions.
4. Feature API endpoints, request/response examples, validation/error conventions.
5. UI components/tokens and routing rules from the approved design.
6. Test approach, code review workflow, coding standards, documentation approach.

Update this document after approval, and publish the final outcome in GitHub Wiki.
