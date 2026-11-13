
# CampusConnect — Authentication & RBAC Contract V1

**Project:** CampusConnect — Campus Event & Club Management System  
**Course:** CSE451 — Software Engineering  
**Document Version:** 1.0 (Draft)  
**Date:** November 13, 2026  
**Prepared By:** Ananta Bhowmik  
**Feature Owner:** Tasnim Binte Rabbani (F01–F03)  
**Status:** Proposed — Pending Team Approval

---

## 1. Purpose

This document defines the proposed authentication workflow, user roles, authorization rules, and access permissions for CampusConnect.

It provides a shared security contract for all four development modules.

All protected operations must enforce authorization on the backend.

## 2. Proposed User Roles

| Role | Description |
|---|---|
| Student | General user who can discover clubs, join clubs, register for events, and manage personal participation |
| Club Officer | Authorized organizer responsible for managing assigned club activities |
| Campus Admin | University administrator responsible for approving and managing campus-wide operations |

The initial database stores the primary role in `users.role`.

**Proposed role values:**
- `student`
- `club_officer`
- `campus_admin`

A club officer must only manage clubs they are authorized to administer. A global `club_officer` role must not automatically grant access to every club.

## 3. Proposed Role Permission Matrix

| Operation | Student | Club Officer | Campus Admin |
|---|---|---|---|
| Register and log in | Yes | Yes | Yes |
| View published events | Yes | Yes | Yes |
| View active clubs | Yes | Yes | Yes |
| Request club membership | Yes | Yes | Yes |
| Approve club membership | No | Own club | Yes |
| Create event proposal | No | Own club | Yes |
| Review and approve event | No | No | Yes |
| Register for event | Yes | Yes | Yes |
| Cancel own registration | Yes | Yes | Yes |
| Manage venue booking | No | Own event request | Yes |
| Approve venue booking | No | No | Yes |
| View own QR ticket | Yes | Yes | Yes |
| Verify QR attendance | No | Authorized event organizer | Yes |
| Apply for volunteer shift | Yes | Yes | Yes |
| Review volunteer applications | No | Own club/event | Yes |
| Publish announcements | No | Own club/event | Yes |
| View own notifications | Yes | Yes | Yes |
| Submit eligible event feedback | Yes | Yes | Yes |
| View personal participation history | Yes | Yes | Yes |
| View club/event analytics | No | Own club/event | Yes |
| Manage user roles | No | No | Yes |

**Important:** These permissions are proposed and must be reviewed with the feature owners before implementation.

## 4. Authentication Workflow

### 4.1 Registration

1. User opens the registration page.
2. User enters full name, email address, and password.
3. Backend validates the input.
4. Backend checks whether the email already exists.
5. Backend securely hashes the password.
6. Backend creates the user with the default `student` role.
7. Backend returns a safe response without `password_hash`.

Public registration must not allow users to assign themselves `club_officer` or `campus_admin`.

### 4.2 Login

1. User enters email and password.
2. Backend checks the submitted credentials.
3. Backend verifies the stored password hash.
4. Backend checks whether the user account is active.
5. Backend creates an authenticated session or issues an approved authentication token.
6. Frontend loads the current user and their role.
7. User is redirected to an authorized application page.

Invalid credentials must not reveal whether the email exists.

### 4.3 Protected API Request

1. Frontend sends a request using the approved authentication mechanism.
2. Backend authentication middleware verifies the user identity.
3. Backend authorization middleware checks the required role.
4. Resource ownership checks verify club, event, or user-specific permissions.
5. Authorized requests proceed.
6. Unauthorized requests are rejected with the appropriate HTTP status.

### 4.4 Logout

1. User selects Logout.
2. The application ends or invalidates the authenticated session according to the approved mechanism.
3. Frontend clears its authenticated user state.
4. Protected pages require authentication again.

## 5. Recommended Authentication Approach

**Proposed MVP approach:** Server-managed sessions with secure, HttpOnly cookies.

Recommended controls:
- Use secure password hashing such as Argon2id or bcrypt.
- Use HttpOnly cookies for session identifiers.
- Enable Secure cookies when running over HTTPS.
- Set an appropriate SameSite policy.
- Protect state-changing requests against CSRF where applicable.
- Regenerate session identifiers after successful authentication.
- Apply rate limiting to login attempts.
- Configure session expiration and logout invalidation.
- Restrict cross-origin credential access to approved frontend origins.

The final mechanism must be approved by Tasnim and the team before implementation.

**Alternative:** A JWT-based authentication design may be selected if the team explicitly agrees on token transport, expiration, refresh, revocation, and storage rules.

Do not implement both mechanisms without a clear requirement.

## 6. Proposed Authentication API Contracts

Final endpoint names and response formats must be reconciled with `docs/API-CONTRACTS-V1.md`.

### POST /api/auth/register

**Access:** Public

Example request:

```json
{
  "full_name": "Demo Student",
  "email": "student@example.com",
  "password": "ExamplePassword123!"
}
```

Expected behavior:
- Validate input.
- Reject duplicate email.
- Hash password.
- Assign the `student` role.
- Return safe user details.

### POST /api/auth/login

**Access:** Public

Example request:

```json
{
  "email": "student@example.com",
  "password": "ExamplePassword123!"
}
```

Expected behavior:
- Validate credentials.
- Establish authentication.
- Return safe session/user information.

### GET /api/auth/me

**Access:** Authenticated

Proposed response:

```json
{
  "id": "user-uuid",
  "full_name": "Demo Student",
  "email": "student@example.com",
  "role": "student"
}
```

The example ID is illustrative, not a real UUID.

### POST /api/auth/logout

**Access:** Authenticated

Expected behavior:
- End the active authenticated session.
- Return a successful logout response.

## 7. HTTP Status Rules

| Status | Meaning |
|---|---|
| 200 | Successful request |
| 201 | User created |
| 400 | Invalid input |
| 401 | Unauthenticated or invalid credentials |
| 403 | Authenticated but not authorized |
| 409 | Email or resource conflict |
| 429 | Too many requests |
| 500 | Unexpected server error |

Error responses must use a consistent format agreed in the shared API contract.

## 8. Authorization Rules

### 8.1 Club Ownership

A club officer can manage a club only when their authenticated user ID matches the authorized club officer relationship.

For the initial database design:

`clubs.officer_user_id = authenticated_user.id`

A future multiple-officer design may require a separate authorization relationship.

### 8.2 Event Proposal

Only an authorized club officer or campus administrator may create a proposal on behalf of a club.

The backend must verify the relationship rather than trusting a `club_id` supplied by the frontend.

### 8.3 Event Approval

Only a campus administrator may approve or reject event proposals.

The backend must record the reviewer and review timestamp.

### 8.4 Registration and Attendance

Users must not register or cancel registrations on behalf of another user unless a separately approved administrative workflow permits it.

QR check-in requires authorized event staff and a valid registration.

### 8.5 Notifications

A user may access only their own notifications, except for an explicitly authorized administrative workflow.

## 9. Security Requirements

1. Never store plaintext passwords.
2. Never return password hashes in API responses.
3. Never trust frontend-only role checks.
4. Validate and sanitize inputs appropriately.
5. Use parameterized database queries.
6. Prevent privilege escalation.
7. Restrict access to user-specific and club-specific records.
8. Do not commit authentication secrets or `.env` files.
9. Apply rate limiting where appropriate.
10. Test authentication and authorization failures.

## 10. Required Authentication Tests

- [ ] Successful student registration
- [ ] Duplicate email rejected
- [ ] Invalid registration input rejected
- [ ] Successful login
- [ ] Invalid password rejected
- [ ] Inactive account rejected
- [ ] Protected endpoint rejects unauthenticated requests
- [ ] Student cannot approve event proposals
- [ ] Club officer cannot manage another club
- [ ] Campus admin can approve an event
- [ ] Logout invalidates authentication
- [ ] Password hashes are never exposed

These are planned tests, not completed test results.

## 11. Pending Team Decisions

- [ ] Approve the authentication mechanism
- [ ] Confirm role definitions
- [ ] Confirm permissions and club ownership rules
- [ ] Reconcile authentication endpoints with API Contracts V1
- [ ] Confirm session expiration and logout behavior
- [ ] Define account role assignment and promotion workflow
- [ ] Confirm CSRF and credential-handling requirements
- [ ] Approve authorization middleware responsibilities

## 12. Team Review

| Member | Review Responsibility | Status |
|---|---|---|
| Tasnim Binte Rabbani | Authentication implementation owner | Pending |
| Ananta Bhowmik | Event approval and registration integration | Draft Prepared |
| Rayed Mahmud | Venue, attendance, and volunteer permissions | Pending |
| Omar Khaium | Announcement, notification, and analytics permissions | Pending |

## Document Status

**Version 1.0 — Draft**

This contract must be reviewed and aligned with the existing database schema and REST API contracts before being finalized.
