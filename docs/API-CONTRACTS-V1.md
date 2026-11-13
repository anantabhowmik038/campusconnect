# CampusConnect — Shared REST API Contracts V1

**Project:** CampusConnect — Campus Event & Club Management System  
**Date:** November 13, 2026  
**Status:** DRAFT — Team review required  
**Owners:** Tasnim (F01–F03), Ananta (F04–F06), Rayed (F07–F09), Omar (F10–F12)

> These are proposed contracts, **not implemented endpoints**. Finalize authentication, permissions, status transitions, and database relationships before merging dependent code. The only confirmed starter endpoint is `GET /api/health` (and a local database health endpoint).

## 1. Shared conventions

- Base path: `/api`; JSON request and response bodies; UTF-8; UUID identifiers.
- Timestamps: ISO 8601 with timezone; persist as PostgreSQL `TIMESTAMPTZ`.
- Authentication: propose `Authorization: Bearer <token>` with server-side verification. **Token/session mechanism is not approved**; Tasnim owns implementation.
- Never trust `user_id`, `created_by`, or `reviewed_by` supplied by a client for authenticated actions; derive them from the authenticated user.
- Response success (proposed): `{ "data": { ... } }`; list response: `{ "data": [ ... ], "pagination": { "page": 1, "limit": 20, "total": 0 } }`.
- Response error (proposed): `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }`.
- HTTP statuses: 200 read/update, 201 create, 204 successful delete/no body, 400 invalid input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 business-rule failure, 500 unexpected failure.
- Pagination: `?page=1&limit=20` (max `limit=100`); sorting/filtering only through allowlisted fields.
- Authorization defaults: `student` reads public content and manages own records; `club_officer` manages **authorized clubs**, not all clubs; `campus_admin` has institution-wide approval rights. Permission matrix requires sign-off.
- No routes should allow arbitrary role escalation, unrestricted access to another user's data, or direct public changes to approval fields.
- `PATCH` changes only whitelisted fields; business status transitions are service-layer operations, not arbitrary database updates.

## 2. Proposed endpoint register (all routes tentative)

| Feature | Method | Endpoint | Access | Purpose |
|---|---|---|---|---|
| F01 | POST | `/api/auth/register` | Public | Student signup |
| F01 | POST | `/api/auth/login` | Public | Login |
| F01 | GET | `/api/auth/me` | Authenticated | Current identity and role |
| F01 | POST | `/api/auth/logout` | Authenticated | End session (mechanism TBD) |
| F02 | GET | `/api/clubs` | Public | Club directory |
| F02 | GET | `/api/clubs/:clubId` | Public | Club details |
| F02 | POST | `/api/clubs` | Campus admin | Create club |
| F02 | PATCH | `/api/clubs/:clubId` | Authorized officer/admin | Update club |
| F03 | POST | `/api/clubs/:clubId/memberships` | Student | Request membership |
| F03 | GET | `/api/clubs/:clubId/memberships` | Officer of club/admin | Review memberships |
| F03 | PATCH | `/api/clubs/:clubId/memberships/:membershipId/review` | Officer of club/admin | Approve/reject |
| F03 | GET | `/api/me/memberships` | Authenticated | Own membership list |
| F04 | POST | `/api/events` | Authorized club officer | Create draft event |
| F04 | PATCH | `/api/events/:eventId` | Owner officer; only editable states | Edit proposal |
| F04 | POST | `/api/events/:eventId/submit` | Owner officer | Submit for approval |
| F04 | PATCH | `/api/events/:eventId/review` | Campus admin | Approve/reject proposal |
| F04 | POST | `/api/events/:eventId/publish` | Authorized officer/admin; policy TBD | Publish approved event |
| F04 | GET | `/api/events/pending` | Campus admin | Approval queue |
| F05 | GET | `/api/events` | Public | Published events with filters |
| F05 | GET | `/api/events/:eventId` | Public for published events; authorized otherwise | Event details |
| F06 | POST | `/api/events/:eventId/registrations` | Student | Register or waitlist |
| F06 | GET | `/api/events/:eventId/registrations/me` | Authenticated | Own registration status |
| F06 | DELETE | `/api/events/:eventId/registrations/me` | Authenticated | Cancel registration |
| F06 | GET | `/api/events/:eventId/registrations` | Authorized officer/admin | Roster/waitlist |
| F07 | POST | `/api/attendance/check-in` | Authorized check-in staff | Verify QR and check in |
| F07 | GET | `/api/events/:eventId/attendance` | Authorized officer/admin | Attendance roster |
| F08 | GET | `/api/venues` | Authenticated | Available venue directory |
| F08 | POST | `/api/venue-bookings` | Authorized officer | Request booking |
| F08 | GET | `/api/venues/:venueId/bookings` | Authorized officer/admin | Booking calendar |
| F08 | PATCH | `/api/venue-bookings/:bookingId/review` | Campus admin | Approve/reject booking |
| F09 | GET | `/api/events/:eventId/volunteer-shifts` | Authenticated | View shifts |
| F09 | POST | `/api/events/:eventId/volunteer-shifts` | Authorized officer | Create shift |
| F09 | POST | `/api/volunteer-shifts/:shiftId/applications` | Student | Apply |
| F09 | PATCH | `/api/volunteer-applications/:applicationId/review` | Authorized officer | Accept/reject |
| F10 | GET | `/api/announcements` | Authenticated/public per visibility policy | Announcements |
| F10 | POST | `/api/announcements` | Authorized officer/admin | Create announcement |
| F10 | GET | `/api/notifications` | Authenticated | Own inbox |
| F10 | PATCH | `/api/notifications/:notificationId/read` | Notification owner | Mark read |
| F11 | POST | `/api/events/:eventId/feedback` | Eligible attendee | Submit rating |
| F11 | GET | `/api/events/:eventId/feedback` | Public/authorized per privacy policy | View feedback |
| F12 | GET | `/api/analytics/overview` | Campus admin | Overall counts |
| F12 | GET | `/api/analytics/clubs/:clubId` | Officer of club/admin | Club statistics |

## 3. Example request and response contracts

### F01 — Login

`POST /api/auth/login`

Request:
```json
{ "email": "student@example.edu", "password": "example-password" }
```

Success response (token mechanism TBD):
```json
{
  "data": {
    "user": { "id": "<uuid>", "full_name": "Example Student", "email": "student@example.edu", "role": "student" },
    "access_token": "<token-if-token-auth-selected>"
  }
}
```

**Decision needed:** bearer-token vs secure cookie session; expiration, logout, refresh, and local development strategy. No real passwords or tokens in documentation.

### F04 — Create event proposal

`POST /api/events` (authorized club officer)

```json
{
  "club_id": "<uuid>",
  "title": "Programming Workshop",
  "description": "Introductory workshop for students",
  "category": "Workshop",
  "start_time": "2026-12-04T10:00:00+06:00",
  "end_time": "2026-12-04T12:00:00+06:00",
  "capacity": 80
}
```

201:
```json
{ "data": { "id": "<uuid>", "status": "draft", "title": "Programming Workshop", "club_id": "<uuid>" } }
```

Server derives `created_by` from authenticated identity and checks officer's permission for `club_id`.

### F04 — Submit and review proposal

`POST /api/events/:eventId/submit` -> `{ "data": { "id": "<uuid>", "status": "pending" } }`

`PATCH /api/events/:eventId/review` (campus admin):
```json
{ "decision": "approved", "review_note": "Approved for publication" }
```

Response: `{ "data": { "id": "<uuid>", "status": "approved" } }`.

`decision` must be `approved` or `rejected`; server records `reviewed_by` and `reviewed_at`. Publishing is a separate proposed action until venue policy is agreed.

### F05 — Published event search

`GET /api/events?category=Workshop&search=programming&from=2026-12-01&page=1&limit=20`

200:
```json
{ "data": [{ "id": "<uuid>", "title": "Programming Workshop", "status": "published", "capacity": 80 }], "pagination": { "page": 1, "limit": 20, "total": 1 } }
```

Default public results contain only `published` events; private draft/review routes enforce authentication.

### F06 — Registration and waitlist

`POST /api/events/:eventId/registrations` (student): request body `{}`.

201, seat available:
```json
{ "data": { "id": "<registration-uuid>", "event_id": "<uuid>", "status": "registered" } }
```

201, no seat available:
```json
{ "data": { "id": "<registration-uuid>", "event_id": "<uuid>", "status": "waitlisted" } }
```

409 for duplicate active registration. Transactional seat count and waitlist promotion mandatory. Status values match DATABASE-SCHEMA-V1.md.

### F07 — Check in

`POST /api/attendance/check-in`

```json
{ "ticket_token": "<signed-or-secure-random-token>" }
```

201:
```json
{ "data": { "registration_id": "<uuid>", "checked_in_at": "2026-12-04T10:15:00+06:00" } }
```

The draft schema stores attendance, not a persistent ticket token. Token generation/verification strategy must be finalized with Rayed and Ananta before implementation; never accept an arbitrary client-provided registration ID as proof.

### F08 — Request venue booking

`POST /api/venue-bookings`

```json
{
  "event_id": "<uuid>",
  "venue_id": "<uuid>",
  "start_time": "2026-12-04T09:00:00+06:00",
  "end_time": "2026-12-04T13:00:00+06:00"
}
```

201: `{ "data": { "id": "<uuid>", "status": "pending" } }`; 409 for confirmed schedule conflict at approval time.

### F09 — Volunteer application

`POST /api/volunteer-shifts/:shiftId/applications` -> `{}`; 201 returns `pending` application; 409 for duplicate application or conflicting accepted shift as policy requires.

### F10 — Notifications

`GET /api/notifications?page=1&limit=20` returns own notifications only. `PATCH /api/notifications/:notificationId/read` returns updated `is_read: true`. Other modules call an internal notification service, not a public endpoint for creating arbitrary notifications.

### F11 — Feedback

`POST /api/events/:eventId/feedback`
```json
{ "rating": 5, "comment": "Well organized event" }
```

201 returns created feedback; 403 if not eligible; 409 if duplicate; 422 for rating outside 1–5.

### F12 — Analytics

`GET /api/analytics/overview` returns calculated figures, with metric definitions approved before implementation:
```json
{ "data": { "total_users": 0, "active_clubs": 0, "published_events": 0, "registrations": 0 } }
```

## 4. Shared decisions still required

- [ ] Confirm PostgreSQL, 13 tables, UUID generation and FK rules.
- [ ] Confirm how a `club_officer` is authorized for specific clubs (currently `clubs.officer_user_id`; multi-officer support deferred).
- [ ] Confirm auth/session mechanism and middleware contract (e.g., `req.user = { id, role }`).
- [ ] Confirm exact event status transitions; whether published requires approved venue.
- [ ] Confirm registrations, cancellation, re-registration and FIFO waitlist promotion.
- [ ] Confirm QR token persistence/signing/expiration and permission to check in attendees.
- [ ] Confirm exclusion constraint or transactional booking conflict protection.
- [ ] Confirm notification triggers and feedback eligibility.
- [ ] Confirm final payload formats and field naming; examples above are drafts.

## 5. Team rule for development

Each member may build UI components, local mock services, input validation, tests, and module-only APIs on a private feature branch while team review is pending. Do not merge dependent DB migrations or make incompatible changes to shared authentication/contracts. All changes require PR review before merging to `main`.
