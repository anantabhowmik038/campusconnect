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

- `GET /api/feedback/eligible-events` → HTTP 200, completed events attended by the current user; requires bearer authentication
- `GET /api/feedback/events/:eventId` → HTTP 200, completed event feedback summary and reviews
- `POST /api/feedback/events/:eventId` → HTTP 201, creates or updates an attendee's feedback; requires bearer authentication
- `DELETE /api/feedback/:feedbackId` → HTTP 200, removes the review for its author or a campus administrator; requires bearer authentication

Protected F11 routes use F01's bearer JWT authentication and database-backed roles. Saving feedback requires an attendance record for a completed event. Ratings must be JSON integers from 1 to 5.

## F07 attendance endpoints

- `GET /api/attendance/registrations` lists the signed-in user?s eligible registrations.
- `GET /api/attendance/events` lists events with registrations that the signed-in staff member can manage.
- `POST /api/attendance/tickets` issues a signed 24-hour ticket for the owner of an active registration.
- `POST /api/attendance/check-in` verifies `ticket_token` and records a single check-in. When supplied, `event_id` must match the registration.
- `GET /api/events/:eventId/attendance` returns the roster for the assigned club officer or a campus administrator.

Set `ATTENDANCE_TICKET_SECRET` in the backend environment to an independent random secret of at least 32 bytes. Grant staff access to check-in over HTTPS for browser camera support. The workspace also accepts manual ticket codes.

## Items to finalize before feature development
1. Shared PostgreSQL schema: users, clubs, members, events, proposals, registrations, attendance, venues, shifts, notifications, feedback.
2. Primary-key types, foreign-key relationships, enum/status values, migrations.
3. Authentication strategy, login API, current-user API, role permissions.
4. Feature API endpoints, request/response examples, validation/error conventions.
5. UI components/tokens and routing rules from the approved design.
6. Test approach, code review workflow, coding standards, documentation approach.

Update this document after approval, and publish the final outcome in GitHub Wiki.
