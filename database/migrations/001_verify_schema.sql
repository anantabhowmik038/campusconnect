-- Run after 001_initial_schema.sql in a disposable/local test database.
-- Should return exactly 13 application tables.
SELECT COUNT(*) AS application_table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name IN (
    'users','clubs','club_memberships','events','event_registrations',
    'venues','venue_bookings','event_attendance','volunteer_shifts',
    'volunteer_applications','announcements','notifications','event_feedback'
  );

-- Inspect created tables.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Inspect foreign keys: should return linked relationships.
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table,
       ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
