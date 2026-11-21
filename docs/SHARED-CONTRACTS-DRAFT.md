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
- `GET /api/feedback/eligible-events` → HTTP 200, completed events attended by the current user; requires bearer authentication
- `GET /api/feedback/events/:eventId` → HTTP 200, event feedback summary and reviews
- `POST /api/feedback/events/:eventId` → HTTP 201, creates or updates an attendee's feedback; requires bearer authentication
- `DELETE /api/feedback/:feedbackId` → HTTP 200, removes the review for its author or a campus administrator; requires bearer authentication

## Items to finalize before feature development
1. Shared PostgreSQL schema: users, clubs, members, events, proposals, registrations, attendance, venues, shifts, notifications, feedback.
2. Primary-key types, foreign-key relationships, enum/status values, migrations.
3. Authentication strategy, login API, current-user API, role permissions.
4. Feature API endpoints, request/response examples, validation/error conventions.
5. UI components/tokens and routing rules from the approved design.
6. Test approach, code review workflow, coding standards, documentation approach.

Update this document after approval, and publish the final outcome in GitHub Wiki.
