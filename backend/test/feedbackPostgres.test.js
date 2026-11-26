import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import app from '../src/app.js';
import { getDatabasePool } from '../src/config/database.js';

const connectionString = process.env.F11_TEST_DATABASE_URL;

test('F11 feedback and F10 announcements work through the shared PostgreSQL app', {
  skip: connectionString ? false : 'Set F11_TEST_DATABASE_URL to an isolated PostgreSQL database.',
}, async (t) => {
  const schema = 'f11_test_' + randomUUID().replaceAll('-', '');
  const adminPool = new pg.Pool({ connectionString });
  t.after(() => adminPool.end());
  await adminPool.query('CREATE SCHEMA ' + schema);

  const url = new URL(connectionString);
  url.searchParams.set('options', '-c search_path=' + schema);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_SECRET = randomUUID() + randomUUID();
  const pool = getDatabasePool();
  // Register one cleanup so the schema is removed after the app pool closes.
  t.after(async () => {
    await pool.end();
    const cleanup = new pg.Pool({ connectionString });
    try {
      await cleanup.query('DROP SCHEMA ' + schema + ' CASCADE');
    } finally {
      await cleanup.end();
    }
  });

  const migration = await readFile(new URL('../../database/migrations/001_initial_schema.sql', import.meta.url), 'utf8');
  await pool.query(migration);
  const { rows: [officer, attendee, other, admin, inactive] } = await pool.query(`
    INSERT INTO users (full_name, email, password_hash, role, is_active)
    VALUES ('Officer', 'officer@example.test', 'unused', 'club_officer', TRUE),
           ('Attendee', 'attendee@example.test', 'unused', 'student', TRUE),
           ('Other', 'other@example.test', 'unused', 'student', TRUE),
           ('Admin', 'admin@example.test', 'unused', 'campus_admin', TRUE),
           ('Inactive', 'inactive@example.test', 'unused', 'student', FALSE)
    RETURNING id
  `);
  const { rows: [club] } = await pool.query(
    "INSERT INTO clubs (name, officer_user_id) VALUES ('Feedback Club', $1) RETURNING id",
    [officer.id],
  );
  const { rows: [completed, incomplete] } = await pool.query(`
    INSERT INTO events (club_id, created_by, title, description, start_time, end_time, capacity, status)
    VALUES ($1, $2, 'Completed workshop', 'Fixture', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 10, 'completed'),
           ($1, $2, 'Pending workshop', 'Fixture', NOW(), NOW() + INTERVAL '1 hour', 10, 'pending')
    RETURNING id
  `, [club.id, officer.id]);
  const { rows: [completedRegistration, incompleteRegistration] } = await pool.query(`
    INSERT INTO event_registrations (event_id, user_id, status)
    VALUES ($1, $3, 'registered'), ($2, $3, 'registered'), ($1, $4, 'registered')
    RETURNING id
  `, [completed.id, incomplete.id, attendee.id, other.id]);
  await pool.query(
    'INSERT INTO event_attendance (registration_id, checked_in_by) VALUES ($1, $3), ($2, $3)',
    [completedRegistration.id, incompleteRegistration.id, officer.id],
  );
  await pool.query(
    "INSERT INTO club_memberships (club_id, user_id, status) VALUES ($1, $2, 'approved')",
    [club.id, attendee.id],
  );

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    async function request(path, status, { user, claim = 'student', method = 'GET', body } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (user) {
        headers.Authorization = 'Bearer ' + jwt.sign({ id: user.id, role: claim }, process.env.JWT_SECRET);
      }
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
        method, headers, body: JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
      return data;
    }
    const eligiblePath = '/feedback/eligible-events';
    const feedbackPath = '/feedback/events/' + completed.id;
    const incompletePath = '/feedback/events/' + incomplete.id;

    await request(eligiblePath, 401);
    await request(eligiblePath, 403, { user: inactive });
    const eligible = await request(eligiblePath, 200, { user: attendee });
    assert.deepEqual(eligible.events.map(({ id }) => id), [completed.id]);
    assert.deepEqual((await request(eligiblePath, 200, { user: other })).events, []);
    await request(incompletePath, 404);
    await request(incompletePath, 409, { user: attendee, method: 'POST', body: { rating: 4 } });
    await request(feedbackPath, 403, { user: other, method: 'POST', body: { rating: 4 } });
    for (const rating of [0, 6, 3.5, '5', true, [5], null]) {
      await request(feedbackPath, 400, { user: attendee, method: 'POST', body: { rating } });
    }

    const save = (rating, comment) => request(feedbackPath, 201, {
      user: attendee, method: 'POST', body: { rating, comment },
    });
    const { feedback } = await save(5, 'Great workshop');
    const { feedback: updated } = await save(3, 'Updated review');
    assert.equal(updated.id, feedback.id);
    assert.equal(updated.rating, 3);
    assert.equal(updated.comment, 'Updated review');
    const { summary, reviews } = await request(feedbackPath, 200);
    assert.equal(summary.average_rating, 3);
    assert.equal(summary.review_count, 1);
    assert.equal(summary.three_star_count, 1);
    assert.equal(reviews[0].reviewer_name, 'Attendee');
    assert.equal((await request(eligiblePath, 200, { user: attendee })).events[0].existing_comment, 'Updated review');

    const deletePath = '/feedback/' + feedback.id;
    await request(deletePath, 404, { user: other, claim: 'campus_admin', method: 'DELETE' });
    await request(deletePath, 200, { user: attendee, method: 'DELETE' });
    const { feedback: replacement } = await save(4);
    await request('/feedback/' + replacement.id, 200, { user: admin, method: 'DELETE' });
    assert.equal((await request(feedbackPath, 200)).summary.review_count, 0);

    const { announcement } = await request('/announcements', 201, {
      user: officer, method: 'POST', body: { clubId: club.id, title: 'Club update', content: 'Smoke test' },
    });
    assert.equal(announcement.notified_user_count, 1);
    assert.equal((await request('/announcements', 200)).announcements[0].id, announcement.id);
    const { notifications } = await request('/notifications', 200, { user: attendee });
    assert.equal(notifications.length, 1);
    await request('/notifications/' + notifications[0].id + '/read', 200, { user: attendee, method: 'PATCH' });
    assert.equal((await request('/notifications/unread-count', 200, { user: attendee })).unread_count, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
