-- Development fixtures for F05 browser acceptance.
-- Use a TCP connection to the local campusconnect database.
-- Fixed IDs make this insert-only seed safe to rerun.
BEGIN;

DO $$
BEGIN
    IF current_database() <> 'campusconnect'
       OR inet_server_addr() IS NULL
       OR NOT (inet_server_addr() <<= inet '127.0.0.0/8' OR inet_server_addr() = inet '::1') THEN
        RAISE EXCEPTION 'F05 browser fixtures require local campusconnect over loopback';
    END IF;
END $$;

INSERT INTO public.users (id, full_name, email, password_hash, role, is_active)
VALUES ('f0500000-0000-4000-8000-000000000001', '[F05 Demo] Club Officer',
        'f05.browser.officer@campusconnect.invalid', 'DISABLED_DEMO_ACCOUNT', 'club_officer', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, description, category, officer_user_id)
VALUES ('f0500000-0000-4000-8000-000000000101', '[F05 Demo] Campus Activities Club',
        'Development-only host for event discovery acceptance.', 'Campus Activities',
        'f0500000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Abort on a fixture ID collision with unrelated parent records.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users u JOIN public.clubs c ON c.officer_user_id = u.id
        WHERE u.id = 'f0500000-0000-4000-8000-000000000001'
          AND u.email = 'f05.browser.officer@campusconnect.invalid'
          AND NOT u.is_active
          AND c.id = 'f0500000-0000-4000-8000-000000000101'
          AND c.name = '[F05 Demo] Campus Activities Club'
    ) THEN
        RAISE EXCEPTION 'F05 fixture user or club ID is already in use';
    END IF;
END $$;

WITH fixture (id, title, description, category, days_ahead, status) AS (
    VALUES
        ('f0500000-0000-4000-8000-000000000201', '[F05 Demo] Robotics Workshop',
         'Build a line-following robot with the campus activities club.', 'Workshop', 2, 'published'),
        ('f0500000-0000-4000-8000-000000000202', '[F05 Demo] Campus Coding Lab',
         'A hands-on practice session for ROBOTICS and software projects.', 'Workshop', 2, 'published'),
        ('f0500000-0000-4000-8000-000000000203', '[F05 Demo] Cultural Showcase',
         'Student performances and campus arts exhibits.', 'Cultural', 4, 'published'),
        ('f0500000-0000-4000-8000-000000000204', '[F05 Demo] Campus Volunteer Meetup',
         'Meet student volunteers and learn about campus activities.', NULL, 7, 'published'),
        ('f0500000-0000-4000-8000-000000000205', '[F05 Demo] Hidden Robotics Draft',
         'A draft fixture for public visibility checks.', 'Workshop', 2, 'draft'),
        ('f0500000-0000-4000-8000-000000000206', '[F05 Demo] Hidden Robotics Approval',
         'An approved but unpublished fixture for public visibility checks.', 'Workshop', 2, 'approved')
), scheduled AS (
    SELECT fixture.*,
           (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date + days_ahead)
             + TIME '10:00') AT TIME ZONE 'Asia/Dhaka' AS starts_at
    FROM fixture
)
INSERT INTO public.events (id, club_id, created_by, title, description, category, start_time, end_time, capacity, status)
SELECT id::uuid, 'f0500000-0000-4000-8000-000000000101', 'f0500000-0000-4000-8000-000000000001',
       title, description, category, starts_at, starts_at + INTERVAL '2 hours', 40, status
FROM scheduled
ON CONFLICT (id) DO NOTHING;

COMMIT;
