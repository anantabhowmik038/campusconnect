
-- CampusConnect - Demo Seed Data V1
-- For local test database only.
-- Demo users are disabled and cannot log in.
-- Run with PostgreSQL psql, not a generic SQL runner.

\set ON_ERROR_STOP on

BEGIN;

-- Prevent accidental execution on the main or production database.
DO $$
BEGIN
    IF current_database() <> 'campusconnect_test' THEN
        RAISE EXCEPTION
        'Demo seed allowed only in campusconnect_test';
    END IF;
END $$;

-- 1. Demo Users (non-login accounts)
INSERT INTO users
    (id, full_name, email, password_hash, role, is_active)
VALUES
    (
      '00000000-0000-4000-8000-000000001001',
      'Demo Campus Admin',
      'demo.admin@campusconnect.invalid',
      'DISABLED_DEMO_ACCOUNT',
      'campus_admin',
      FALSE
    ),
    (
      '00000000-0000-4000-8000-000000001002',
      'Demo Club Officer',
      'demo.officer@campusconnect.invalid',
      'DISABLED_DEMO_ACCOUNT',
      'club_officer',
      FALSE
    ),
    (
      '00000000-0000-4000-8000-000000001003',
      'Demo Student',
      'demo.student@campusconnect.invalid',
      'DISABLED_DEMO_ACCOUNT',
      'student',
      FALSE
    )
ON CONFLICT (id) DO NOTHING;

-- 2. Demo Clubs
INSERT INTO clubs
    (id, name, description, category, officer_user_id)
VALUES
    (
      '00000000-0000-4000-8000-000000002001',
      'Campus Coding Club Demo',
      'Student programming and software development club.',
      'Technology',
      '00000000-0000-4000-8000-000000001002'
    ),
    (
      '00000000-0000-4000-8000-000000002002',
      'Campus Cultural Club Demo',
      'Student cultural events and activities.',
      'Cultural',
      '00000000-0000-4000-8000-000000001002'
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Demo Events
INSERT INTO events
    (
      id, club_id, created_by, title, description,
      category, start_time, end_time, capacity, status
    )
VALUES
    (
      '00000000-0000-4000-8000-000000003001',
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000001002',
      'Campus Coding Workshop',
      'An introductory software development workshop.',
      'Technology',
      CURRENT_TIMESTAMP + INTERVAL '7 days',
      CURRENT_TIMESTAMP + INTERVAL '7 days 3 hours',
      50,
      'published'
    ),
    (
      '00000000-0000-4000-8000-000000003002',
      '00000000-0000-4000-8000-000000002002',
      '00000000-0000-4000-8000-000000001002',
      'Campus Cultural Festival',
      'A student cultural celebration.',
      'Cultural',
      CURRENT_TIMESTAMP + INTERVAL '14 days',
      CURRENT_TIMESTAMP + INTERVAL '14 days 4 hours',
      100,
      'published'
    )
ON CONFLICT (id) DO NOTHING;

-- 4. Demo Venues
INSERT INTO venues
    (id, name, location, capacity)
VALUES
    (
      '00000000-0000-4000-8000-000000004001',
      'Demo Auditorium',
      'Main Campus',
      200
    ),
    (
      '00000000-0000-4000-8000-000000004002',
      'Demo Seminar Room',
      'Academic Building',
      60
    )
ON CONFLICT (id) DO NOTHING;

-- 5. Demo Registration
INSERT INTO event_registrations
    (id, event_id, user_id, status, registered_at)
VALUES
    (
      '00000000-0000-4000-8000-000000005001',
      '00000000-0000-4000-8000-000000003001',
      '00000000-0000-4000-8000-000000001003',
      'registered',
      CURRENT_TIMESTAMP
    )
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification summary
SELECT 'users' AS table_name, COUNT(*) AS total FROM users
UNION ALL
SELECT 'clubs', COUNT(*) FROM clubs
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'venues', COUNT(*) FROM venues
UNION ALL
SELECT 'event_registrations', COUNT(*) FROM event_registrations;
