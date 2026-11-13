
# CampusConnect — Shared Database Schema V1

**Project:** CampusConnect — Campus Event & Club Management System  
**Course:** CSE451 — Software Engineering  
**Database:** PostgreSQL  
**Document Version:** 1.0 (Draft)  
**Prepared By:** Ananta Bhowmik — Project Coordinator  
**Date:** November 12, 2026  
**Status:** Proposed — Pending Team Review and Approval

---

## 1. Purpose

This document defines the proposed shared database structure for the CampusConnect web application.

It provides consistent table names, column definitions, data types, primary keys, foreign keys, constraints, and ownership responsibilities for all four development team members.

The proposed schema supports all 12 functional features (F01–F12).

This is a design document, not an executed SQL migration. All members must review shared relationships and integration requirements before implementation.

## 2. Database Design Conventions

| Item | Proposed Standard |
|---|---|
| Database System | PostgreSQL |
| Database Name | campusconnect |
| Table Naming | Lowercase plural snake_case |
| Column Naming | Lowercase snake_case |
| Primary Key | UUID named `id` |
| Foreign Keys | UUID ending with `_id` |
| Date and Time | TIMESTAMPTZ |
| Status Fields | VARCHAR with CHECK constraints |
| Default Timestamps | CURRENT_TIMESTAMP |
| Character Encoding | UTF-8 |
| Database Changes | Version-controlled SQL migrations |

UUID generation will use an agreed PostgreSQL-supported method, such as `gen_random_uuid()`.

Where present, `updated_at` must be maintained by application logic or an approved database trigger.

Primary and foreign keys must be consistent across all feature modules.

## 3. Team Ownership

| Member | Feature IDs | Primary Database Tables |
|---|---|---|
| Tasnim Binte Rabbani | F01–F03 | users, clubs, club_memberships |
| Ananta Bhowmik | F04–F06 | events, event_registrations |
| Rayed Mahmud | F07–F09 | venues, venue_bookings, event_attendance, volunteer_shifts, volunteer_applications |
| Omar Khaium | F10–F12 | announcements, notifications, event_feedback |

**Ownership rule:** Each member owns the initial design and implementation of the listed tables. Changes affecting shared columns, relationships, or API contracts require team review.

---

# 4. Detailed Table Specifications

## 4.1 users — F01 Authentication and RBAC

**Owner:** Tasnim Binte Rabbani  
**Purpose:** Store user identity, login information, and primary system role.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| full_name | VARCHAR(120) | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| role | VARCHAR(30) | NOT NULL, DEFAULT 'student' |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Proposed role values:**
- student
- club_officer
- campus_admin

**Business rules:**
- Email addresses must be validated and normalized consistently.
- Store secure password hashes only; never store plaintext passwords.
- Role-based authorization must be enforced on the backend.
- The exact authentication/session mechanism requires team approval.
- A primary `role` is sufficient for the initial MVP, but per-club officer permissions must be explicitly defined.

## 4.2 clubs — F02 Club Directory and Administration

**Owner:** Tasnim Binte Rabbani  
**Purpose:** Store university club details and administration information.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| name | VARCHAR(150) | NOT NULL, UNIQUE |
| description | TEXT | NULL |
| category | VARCHAR(80) | NULL |
| logo_url | TEXT | NULL |
| officer_user_id | UUID | NOT NULL, FK → users.id |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Proposed statuses:** active, inactive

**Business rules:**
- Only authorized users may create or modify clubs.
- A club has one designated officer in this initial design.
- Supporting multiple officers per club is a possible future extension.
- The `officer_user_id` relationship must be validated against approved authorization rules.

## 4.3 club_memberships — F03 Membership Management

**Owner:** Tasnim Binte Rabbani  
**Purpose:** Manage students' applications and memberships in clubs.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| club_id | UUID | NOT NULL, FK → clubs.id |
| user_id | UUID | NOT NULL, FK → users.id |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' |
| reviewed_by | UUID | NULL, FK → users.id |
| joined_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Proposed statuses:** pending, approved, rejected, left

**Constraints:**
- UNIQUE (club_id, user_id)

**Business rules:**
- A student cannot have duplicate membership records for the same club.
- Authorized club officers may approve or reject requests.
- Leaving and rejoining a club must follow an agreed status-transition policy.

---

## 4.4 events — F04 Event Proposal and F05 Discovery

**Owner:** Ananta Bhowmik  
**Purpose:** Store proposed, reviewed, published, and completed campus events.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| club_id | UUID | NOT NULL, FK → clubs.id |
| created_by | UUID | NOT NULL, FK → users.id |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | NOT NULL |
| category | VARCHAR(80) | NULL |
| image_url | TEXT | NULL |
| start_time | TIMESTAMPTZ | NOT NULL |
| end_time | TIMESTAMPTZ | NOT NULL |
| capacity | INTEGER | NOT NULL, CHECK (capacity > 0) |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'draft' |
| reviewed_by | UUID | NULL, FK → users.id |
| reviewed_at | TIMESTAMPTZ | NULL |
| review_note | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Proposed statuses:**
- draft
- pending
- approved
- rejected
- published
- cancelled
- completed

**Constraints:**
- CHECK (end_time > start_time)
- CHECK (capacity > 0)

**Business rules:**
- Authorized club officers create event proposals.
- Campus administrators review proposals.
- Rejected proposals include review feedback.
- Only published events appear in public event discovery.
- Registration should be limited to eligible published events.
- Venue approval and publication dependencies require team agreement.
- Status transitions must be validated in the backend.

## 4.5 event_registrations — F06 Registration and Waitlist

**Owner:** Ananta Bhowmik  
**Purpose:** Manage event registrations, cancellations, and waitlisting.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| event_id | UUID | NOT NULL, FK → events.id |
| user_id | UUID | NOT NULL, FK → users.id |
| status | VARCHAR(20) | NOT NULL |
| registered_at | TIMESTAMPTZ | NULL |
| waitlisted_at | TIMESTAMPTZ | NULL |
| cancelled_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Proposed statuses:**
- registered
- waitlisted
- cancelled

**Constraints:**
- UNIQUE (event_id, user_id)

**Business rules:**
- A user may have only one current registration record per event.
- Registration must respect event capacity.
- When capacity is full, eligible users may join the waitlist.
- Waitlist order initially follows `waitlisted_at`, then `id`.
- A cancelled registration may trigger waitlist promotion.
- Seat allocation and promotion must use database transactions and concurrency control.
- Re-registration behavior after cancellation requires an approved rule.

---

## 4.6 venues — F08 Venue Information

**Owner:** Rayed Mahmud  
**Purpose:** Store campus venues that can be reserved for events.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| name | VARCHAR(150) | NOT NULL |
| location | VARCHAR(200) | NOT NULL |
| capacity | INTEGER | NOT NULL, CHECK (capacity > 0) |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Business rules:**
- Only active venues are available for new bookings.
- Venue capacity should be checked against event requirements.
- Venue names should be distinguishable by location.

## 4.7 venue_bookings — F08 Booking and Conflict Detection

**Owner:** Rayed Mahmud  
**Purpose:** Manage venue reservations and booking conflicts.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| venue_id | UUID | NOT NULL, FK → venues.id |
| event_id | UUID | NOT NULL, FK → events.id |
| requested_by | UUID | NOT NULL, FK → users.id |
| start_time | TIMESTAMPTZ | NOT NULL |
| end_time | TIMESTAMPTZ | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' |
| reviewed_by | UUID | NULL, FK → users.id |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Proposed statuses:**
- pending
- approved
- rejected
- cancelled

**Constraints:**
- CHECK (end_time > start_time)

**Business rules:**
- Approved reservations for the same venue must not overlap.
- Conflict detection must account for simultaneous booking requests.
- Booking time must be compatible with event time.
- Backend checks alone may be insufficient for concurrency safety; a PostgreSQL exclusion constraint or transactional locking approach should be agreed.
- The policy for multiple bookings per event requires team approval.

## 4.8 event_attendance — F07 QR-Based Attendance

**Owner:** Rayed Mahmud  
**Purpose:** Record successful event attendance and QR check-in.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| registration_id | UUID | NOT NULL, UNIQUE, FK → event_registrations.id |
| checked_in_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| checked_in_by | UUID | NOT NULL, FK → users.id |

**Business rules:**
- Only eligible registered attendees can check in.
- Each event registration can have only one attendance record.
- Duplicate QR scans must not create duplicate attendance.
- QR validation must be performed on the backend.
- Use a signed or securely generated ticket token rather than treating an unverified registration ID as proof of authorization.

## 4.9 volunteer_shifts — F09 Volunteer Scheduling

**Owner:** Rayed Mahmud  
**Purpose:** Define volunteer positions and time slots for events.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| event_id | UUID | NOT NULL, FK → events.id |
| title | VARCHAR(150) | NOT NULL |
| start_time | TIMESTAMPTZ | NOT NULL |
| end_time | TIMESTAMPTZ | NOT NULL |
| required_volunteers | INTEGER | NOT NULL, CHECK (required_volunteers > 0) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Constraints:**
- CHECK (end_time > start_time)

**Business rules:**
- Shifts should fall within an appropriate event schedule.
- Accepted applications should not exceed the number of available positions.
- Overlapping shift assignments require an agreed policy.

## 4.10 volunteer_applications — F09 Volunteer Applications

**Owner:** Rayed Mahmud  
**Purpose:** Manage student applications for event volunteer shifts.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| shift_id | UUID | NOT NULL, FK → volunteer_shifts.id |
| user_id | UUID | NOT NULL, FK → users.id |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' |
| reviewed_by | UUID | NULL, FK → users.id |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Proposed statuses:**
- pending
- accepted
- rejected
- withdrawn

**Constraints:**
- UNIQUE (shift_id, user_id)

**Business rules:**
- Duplicate applications for the same shift are not allowed.
- Authorized organizers manage application decisions.
- Shift capacity must be enforced when accepting volunteers.

---

## 4.11 announcements — F10 Announcements

**Owner:** Omar Khaium  
**Purpose:** Store club and event announcements.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| club_id | UUID | NULL, FK → clubs.id |
| event_id | UUID | NULL, FK → events.id |
| created_by | UUID | NOT NULL, FK → users.id |
| title | VARCHAR(200) | NOT NULL |
| content | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Business rules:**
- Only authorized users may publish announcements.
- Announcement visibility depends on its club or event association.
- The permitted combinations of `club_id` and `event_id` require agreement.

## 4.12 notifications — F10 In-App Notifications

**Owner:** Omar Khaium  
**Purpose:** Store notifications delivered to application users.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| user_id | UUID | NOT NULL, FK → users.id |
| title | VARCHAR(200) | NOT NULL |
| message | TEXT | NOT NULL |
| type | VARCHAR(40) | NOT NULL |
| reference_url | TEXT | NULL |
| is_read | BOOLEAN | NOT NULL, DEFAULT FALSE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Possible notification types:**
- event_approved
- event_rejected
- registration_confirmed
- waitlist_promoted
- membership_approved
- announcement

**Business rules:**
- Notifications belong to an individual recipient.
- Users must not read another user's notifications.
- The notification creation mechanism should be coordinated with event, membership, and registration services.
- Reference links must be validated to avoid unsafe redirects.

## 4.13 event_feedback — F11 Feedback and Ratings

**Owner:** Omar Khaium  
**Purpose:** Store post-event ratings and written feedback.

| Column | Data Type | Constraints |
|---|---|---|
| id | UUID | PRIMARY KEY |
| event_id | UUID | NOT NULL, FK → events.id |
| user_id | UUID | NOT NULL, FK → users.id |
| rating | SMALLINT | NOT NULL, CHECK (rating BETWEEN 1 AND 5) |
| comment | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Constraints:**
- UNIQUE (event_id, user_id)
- CHECK (rating BETWEEN 1 AND 5)

**Business rules:**
- One feedback record per student per event.
- Feedback should be accepted only for completed events.
- Eligibility should be validated using the approved event attendance/registration policy.

---

# 5. F12 Analytics Database Strategy

**Owner:** Omar Khaium

F12 initially uses read-only aggregate queries over existing tables rather than creating a separate analytics table.

**Possible metrics:**
- Total registered students
- Total active clubs
- Total published events
- Event registration counts
- Attendance rate
- Club membership counts
- Average event ratings
- Volunteer participation

Metrics must define their calculation rules before implementation.

For example, attendance rate may be calculated as:

Attendance Rate = Checked-in Registrations / Eligible Registered Participants × 100

The denominator and treatment of cancelled registrations must be defined consistently.

No additional analytics table is required for the initial MVP.

---

# 6. Main Foreign Key Relationships

| Parent Table | Child Table | Foreign Key | Relationship |
|---|---|---|---|
| users | clubs | officer_user_id | One user to many clubs |
| users | club_memberships | user_id | One user to many memberships |
| clubs | club_memberships | club_id | One club to many memberships |
| clubs | events | club_id | One club to many events |
| users | events | created_by | One user to many created events |
| users | events | reviewed_by | One user to many reviewed events |
| events | event_registrations | event_id | One event to many registrations |
| users | event_registrations | user_id | One user to many registrations |
| venues | venue_bookings | venue_id | One venue to many bookings |
| events | venue_bookings | event_id | One event to many bookings |
| event_registrations | event_attendance | registration_id | One registration to zero or one check-in |
| events | volunteer_shifts | event_id | One event to many shifts |
| volunteer_shifts | volunteer_applications | shift_id | One shift to many applications |
| users | volunteer_applications | user_id | One user to many applications |
| clubs | announcements | club_id | Optional club association |
| events | announcements | event_id | Optional event association |
| users | notifications | user_id | One user to many notifications |
| events | event_feedback | event_id | One event to many feedback records |
| users | event_feedback | user_id | One user to many feedback records |

Additional references to reviewers, requesters, and check-in staff use `users.id` as defined in their respective tables.

---

# 7. Cross-Module Integration Dependencies

## 7.1 Authentication Dependency

Tasnim's F01 module provides the common authenticated user identity and role information for the other modules.

The team must agree on:
- Authentication mechanism
- Current user endpoint
- Authorization middleware
- User ID format
- Required roles for each protected operation

## 7.2 Event Management Dependency

Ananta's F04–F06 modules depend on:
- `users`
- `clubs`
- `events`
- `event_registrations`

Rayed's attendance and venue modules depend on approved event and registration identifiers.

Omar's notification and feedback modules depend on approved event, user, and registration data.

## 7.3 Event Approval and Venue Booking

The team must define whether:
1. Event approval happens before venue booking.
2. Venue approval is required before publication.
3. Venue conflicts block publication.
4. A published event can change its venue or scheduled time.

## 7.4 Notifications

Cross-module actions may generate notifications.

Examples:
- Membership approved
- Event proposal approved or rejected
- Registration confirmed
- Student promoted from waitlist

Define an approved service interface before connecting these features.

---

# 8. Proposed Indexing Strategy

Indexes should support frequently used lookup and filtering queries.

| Table | Candidate Index |
|---|---|
| users | email (covered by UNIQUE constraint) |
| clubs | status, category |
| club_memberships | club_id, status |
| events | status, start_time |
| events | club_id, start_time |
| event_registrations | event_id, status |
| event_registrations | event_id, waitlisted_at |
| venue_bookings | venue_id, start_time, end_time |
| notifications | user_id, is_read, created_at |
| event_feedback | event_id |

Indexes should be finalized after reviewing the actual queries and workload.

---

# 9. Security and Data Integrity

The implementation must follow these rules:

1. Never store plaintext passwords.
2. Never commit `.env` files or database credentials.
3. Validate all input data on the backend.
4. Use parameterized PostgreSQL queries.
5. Apply role-based authorization to protected operations.
6. Enforce foreign key constraints.
7. Use transactions for capacity-sensitive operations.
8. Avoid exposing sensitive user information in API responses.
9. Restrict users to their authorized records.
10. Review deletion and cascading behavior before creating migrations.

---

# 10. Pending Team Decisions

The following items must be approved before the schema becomes final:

- [ ] Confirm PostgreSQL as the database
- [ ] Confirm UUID primary keys
- [ ] Confirm all 13 table names
- [ ] Approve exact columns and data types
- [ ] Approve foreign key relationships
- [ ] Approve role and authorization rules
- [ ] Approve event proposal status transitions
- [ ] Approve event registration and waitlist behavior
- [ ] Approve venue booking conflict handling
- [ ] Approve volunteer shift assignment rules
- [ ] Approve notification event triggers
- [ ] Approve feedback eligibility rules
- [ ] Define safe deletion and retention rules
- [ ] Approve the migration and seed-data strategy

---

# 11. Implementation Plan

**Phase 1 — Schema Review**
- All four members inspect the proposed tables and relationships.
- Resolve conflicting field requirements.
- Record final decisions in Discord.

**Phase 2 — Approved SQL Migration**
- Convert the approved schema into PostgreSQL CREATE TABLE statements.
- Add constraints, indexes, and foreign keys.
- Review and test migrations on a fresh database.

**Phase 3 — Shared Backend Integration**
- Implement approved data access models.
- Define REST API contracts.
- Implement authentication and authorization.
- Connect feature modules to the shared database.

**Phase 4 — Testing**
- Validate constraints and foreign keys.
- Test normal and invalid input.
- Test duplicate submissions and concurrency-sensitive operations.
- Collect actual test evidence.

---

# 12. Approval Record

| Member | Responsibility | Review Status |
|---|---|---|
| Tasnim Binte Rabbani | F01–F03 | Pending |
| Ananta Bhowmik | F04–F06 | Draft Prepared |
| Rayed Mahmud | F07–F09 | Pending |
| Omar Khaium | F10–F12 | Pending |

**Final Approval Date:** TBD

**Approved Schema Version:** TBD

---

## Document Status

**Version 1.0 — Draft**

This document is intended for team review and may change before implementation.

It must not be treated as the final database migration or the official approved ER diagram.

After team approval, the finalized schema and SQL migrations will be version-controlled in GitHub and referenced in the SDS and GitHub Wiki.
