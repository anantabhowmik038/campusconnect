# CampusConnect — Team Approval Checklist

**Date:** November 13, 2026 | **Status:** Pending team review

## 1. Repository foundation
- [ ] Confirm GitHub PR #1 has official GitHub review approval (not just green no-conflicts).
- [ ] Merge PR #1 into `main` using **Create a merge commit** to retain all 11 existing commits.
- [ ] Verify `main` contains `/frontend`, `/backend`, `/database`, `/docs` and starts locally.
- [ ] Confirm docs/database-schema-v1 PR targets the correct updated `main` and includes only its intended new documentation file. Do not merge until reviewed.

## 2. Database and roles
- [ ] Team approves `DATABASE-SCHEMA-V1.md` or records corrections.
- [ ] Confirm `users`, `clubs`, `events`, `event_registrations` shared columns and UUID strategy.
- [ ] Confirm per-club officer authorization; admin vs officer vs student.
- [ ] Confirm event status flow (draft → pending → approved/rejected → published → completed/cancelled).
- [ ] Confirm venue booking approval before/after event publication.
- [ ] Confirm event registration capacity and FIFO waitlist behavior.
- [ ] Confirm QR token check-in rules, volunteer shift acceptance rules, notification triggers, feedback eligibility.
- [ ] Agree migration ownership/order and schema review rules.

## 3. API contract approval
- [ ] Review `API-CONTRACTS-V1.md` endpoint names and HTTP methods.
- [ ] Confirm login/session model and `req.user` identity format.
- [ ] Confirm success, error and pagination format.
- [ ] Confirm authorization for each protected endpoint.
- [ ] Confirm event search filters and analytics metric definitions.
- [ ] Note decisions with date, members and rationale in Discord `#decisions`.

## 4. Member local setup
- [ ] Tasnim — app runs, backend health and tests pass.
- [ ] Ananta — app runs, backend health and tests pass.
- [ ] Rayed — app runs, backend health and tests pass.
- [ ] Omar — app runs, backend health and tests pass.
- [ ] Each person creates their own local `.env` and database credentials; no secrets shared.
- [ ] All members have accepted GitHub collaborator invitations and can open feature PRs.

## 5. First PR allocation
- [ ] Tasnim: auth and roles interface or F01 UI/tests.
- [ ] Ananta: F04 proposal form and service contract/tests.
- [ ] Rayed: F08 booking UI and clash/overlap test cases.
- [ ] Omar: F10 notifications UI and testable mock service.
- [ ] Each member links work to implementation Trello card and posts progress in Discord.

## 6. Approval record

| Decision | Agreed value | Approved by | Date | Link to Discord/PR |
|---|---|---|---|---|
| GitHub foundation merged | TBD | TBD | TBD | TBD |
| PostgreSQL schema V1 | TBD | TBD | TBD | TBD |
| Auth session and identity | TBD | TBD | TBD | TBD |
| REST API conventions | TBD | TBD | TBD | TBD |
| Event/venue workflow | TBD | TBD | TBD | TBD |
| Feature branches started | TBD | TBD | TBD | TBD |

Do not mark approvals as complete based only on a verbal promise. Record actual decisions and evidence.
