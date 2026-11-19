# Feature Implementation Notes

Local planning notes for Member 4's approved scope. Implement and validate one
feature at a time. Do not change unrelated modules.

## Confirmed Scope

- **F10** - Announcements & In-App Notifications
- **F11** - Post-Event Feedback & Ratings
- **F12** - Club & Event Analytics Dashboard
- Responsibilities: frontend, backend APIs/business logic, database integration,
  validation/error handling, testing, and documentation.
- Requirements source: Member 4 notification received on 2026-11-19.

## Implementation Order

1. **F10 first**: establishes announcement publishing and the notification
   delivery/read-state foundation.
2. **F11 second**: depends on completed events, registrations, and attendance
   data from the shared schema and can create notifications where appropriate.
3. **F12 third**: reads the stable data from F10/F11 plus registrations and
   attendance; add export only after dashboard queries are verified.

## F10 - Announcements & In-App Notifications

- Requirements:
  - Club and event announcements.
  - Targeted user notifications.
  - Registration and event updates.
  - Read/unread notification tracking.
- Existing schema:
  - `announcements` supports club/event ownership and authoring.
  - `notifications` supports per-user messages, type, reference URL, and
    read state.
- Plan:
  1. Confirm target audience rules and authorized publisher roles against the
     SRS before coding.
  2. Add announcement and notification service/controller/routes using the
     existing tables.
  3. Add targeted notification creation for campus administrators, plus
      notification list, unread count, mark-read, and mark-all-read APIs.
  4. Add announcement creation/list/detail UI and an in-app notification
     panel with unread state.
  5. Add event-registration/status notification hooks without duplicating
     notification creation logic.
  6. Document API contracts and test authorization, targeting, validation,
     unread transitions, and error responses.
- Expected files: new F10 routes/controllers/services/tests, related frontend
  components/pages, and a migration only if approved audience data cannot be
  represented by the existing schema.
- Status: Implemented in the current branch; authentication integration and
  final audience rules remain pending SRS/team approval.

## F11 - Post-Event Feedback & Ratings

- Requirements:
  - Event feedback submission.
  - Rating and review management.
  - Attendance-based eligibility.
  - Feedback summaries.
- Existing schema:
  - `event_feedback` enforces one review per user/event and a 1-5 rating.
  - `event_attendance` links attendance to `event_registrations`.
- Plan:
  1. Define the eligibility rule: completed event plus a matching attendance
     record; confirm whether edits/deletes and moderation are required.
  2. Enforce eligibility in the backend transaction/service, not only in UI.
  3. Add submit, update/delete if approved, list, and moderation endpoints.
  4. Add attendee feedback form and event feedback summary UI.
  5. Add rating aggregation queries with empty-result handling.
  6. Test duplicate submissions, non-attendees, invalid ratings, closed
     events, authorization, and summary calculations.
- Expected files: F11 routes/controllers/services/tests, feedback UI, and a
  migration only for approved moderation/status requirements.
- Status: Implemented in the current branch; authentication integration and
  final moderation policy remain pending SRS/team approval.

## F12 - Club & Event Analytics Dashboard

- Requirements:
  - Club performance statistics.
  - Event registration analytics.
  - Attendance and participation reports.
  - Feedback and rating analysis.
  - Data visualization and export.
- Existing data sources:
  - `clubs`, `events`, `event_registrations`, `event_attendance`,
    `event_feedback`, and `volunteer_applications`.
- Plan:
  1. Confirm dashboard audience and access boundaries (club officer versus
     campus admin) from the SRS.
  2. Define metric formulas and date/status filters before implementation.
  3. Add parameterized aggregate endpoints with authorization and bounded
     date ranges.
  4. Build dashboard cards, tables, and charts using the existing frontend
     style; show loading, empty, and error states.
  5. Add CSV export from the same authorized aggregate query results.
  6. Test metric calculations, date boundaries, zero-data cases, access
     control, export shape, and large result limits.
- Expected files: F12 analytics routes/controllers/services/tests, dashboard
  components/pages, and export utility/documentation.
- Status: Planned; depends on F10/F11 data and confirmed metric definitions.

## Decisions To Confirm Before Coding

- SRS-approved roles and audience targeting rules for F10.
- Whether announcements need an explicit audience table or can fan out to
  `notifications` using existing relationships.
- Feedback edit/delete/moderation policy for F11.
- Dashboard roles, metric definitions, date ranges, and export format for F12.

## Working Rules

- Implement one feature at a time.
- Do not modify unrelated behavior or files.
- Record decisions and validation results under the relevant feature.
- Keep secrets and local configuration out of Git.
