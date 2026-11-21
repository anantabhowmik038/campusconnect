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
- `GET /api/announcements` → HTTP 200, latest announcements; optional `clubId` or `eventId` filters
- `POST /api/announcements` → HTTP 201, creates an announcement and notifies approved club members or registered event users
- `GET /api/notifications` → HTTP 200, current user's notifications; requires bearer authentication
- `POST /api/notifications` → HTTP 201, direct notification for an active user; campus administrator bearer authentication required
- `GET /api/notifications/unread-count` → HTTP 200, current user's unread count; requires bearer authentication
- `PATCH /api/notifications/:notificationId/read` → HTTP 200, marks one notification read; requires bearer authentication
- `PATCH /api/notifications/read-all` → HTTP 200, marks all current-user notifications read; requires bearer authentication

Protected F10 routes use F01's bearer JWT authentication. The backend derives identity and role from `req.user`; client-controlled identity headers are not accepted.
is approved and implemented. It must be replaced by authenticated request
context before production use.

## Items to finalize before feature development
1. Shared PostgreSQL schema: users, clubs, members, events, proposals, registrations, attendance, venues, shifts, notifications, feedback.
2. Primary-key types, foreign-key relationships, enum/status values, migrations.
3. Authentication strategy, login API, current-user API, role permissions.
4. Feature API endpoints, request/response examples, validation/error conventions.
5. UI components/tokens and routing rules from the approved design.
6. Test approach, code review workflow, coding standards, documentation approach.

Update this document after approval, and publish the final outcome in GitHub Wiki.
