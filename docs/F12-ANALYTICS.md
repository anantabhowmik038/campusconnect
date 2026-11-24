# F12 — Club & Event Analytics Dashboard

## Objective

Provide authorized overview, club, and event metrics for campus administrators
and club officers, plus CSV export for the authorized data scope.

## Authentication

- Protected analytics routes require `Authorization: Bearer <JWT>`.
- F12 reads `req.user.id` from verified authentication middleware.
- Inactive users are rejected.
- Campus administrators may access overview analytics and all club/event exports.
- Club officers may access only clubs they own and events belonging to those clubs.
- Students may not access analytics endpoints.

F01 authentication must use the same JWT secret and database-backed active-user
lookup contract before F12 is merged. The frontend reads the F01 convention
from `localStorage.token`.

## API endpoints

| Method | Endpoint | Authorization | Purpose |
|---|---|---|---|
| GET | `/api/analytics/overview` | Campus admin | Campus-wide counts and averages |
| GET | `/api/analytics/clubs/:clubId` | Admin or owning club officer | Club and event metrics |
| GET | `/api/analytics/events/:eventId` | Admin or owning club officer | Event registration, attendance, and feedback |
| GET | `/api/analytics/export?clubId=<uuid>` | Admin or owning club officer | Download authorized CSV data |

The `clubId` export query parameter is optional for campus administrators.

## Database tables

- `clubs`
- `events`
- `event_registrations`
- `event_attendance`
- `event_feedback`
- `users`

## Metric definitions

- Registrations count records with `status = 'registered'`.
- Waitlist count records with `status = 'waitlisted'`.
- Attendance joins checked-in records to registered registrations.
- Feedback count counts `event_feedback` records.
- Average rating is rounded to two decimal places.
- Event and club lists are limited to 100 rows; CSV export is limited to 1,000 rows.

## Frontend

The F12 workspace supports:

- Campus overview cards.
- Club UUID lookup and event performance table.
- Event UUID lookup and rating distribution chart.
- Login-required and API error states.
- CSV download for all authorized analytics or one authorized club.

## Testing

The Node test suite verifies authentication, invalid and expired JWTs, inactive
users, role boundaries, UUID validation, club/event metrics, rating
distribution, and CSV output. Database-backed behavior is isolated with mocked
PostgreSQL pool responses until an approved disposable test database is used.

## Known limitations

- F01 authentication routes and shared middleware are not yet merged into this
  branch.
- Real PostgreSQL integration tests require a disposable database.
- The dashboard does not implement F12 chart libraries; it uses native HTML,
  CSS bars, and tables.
