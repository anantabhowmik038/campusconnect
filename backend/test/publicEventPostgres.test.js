import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import express from 'express';
import pg from 'pg';
import { createPublicEventRouter } from '../src/routes/publicEventRoutes.js';

const connectionString = process.env.F05_TEST_DATABASE_URL;
const listFields = ['id', 'title', 'category', 'image_url', 'start_time', 'end_time',
  'capacity', 'status', 'club_id', 'club_name'];
const eventId = (number) => '00000000-0000-4000-8000-' + String(number).padStart(12, '0');

test('F05 HTTP reads against PostgreSQL', {
  skip: connectionString ? false : 'Set F05_TEST_DATABASE_URL to an isolated disposable PostgreSQL database.',
}, async (t) => {
  const schema = 'f05_' + randomBytes(8).toString('hex');
  const admin = new pg.Pool({ connectionString });
  t.after(() => admin.end());
  await admin.query('CREATE SCHEMA ' + schema);
  const pool = new pg.Pool({ connectionString, options: '-c search_path=' + schema });
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
  const { rows: [user] } = await pool.query(
    "INSERT INTO users (full_name, email, password_hash) VALUES ('Fixture', 'f05@example.test', 'unused') RETURNING id",
  );
  const { rows: [club] } = await pool.query(
    "INSERT INTO clubs (name, officer_user_id) VALUES ('Robotics Club', $1) RETURNING id", [user.id],
  );

  async function insert(number, { title = 'Robotics', description = 'Practice', category = 'Workshop',
    start = '2026-12-01T18:00:00Z', status = 'published' } = {}) {
    await pool.query(
      `INSERT INTO events (id, club_id, created_by, title, description, category, start_time, end_time,
        capacity, status, reviewed_by, reviewed_at, review_note)
        VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz + INTERVAL '1 hour',
        25, $8, $3, now(), 'Internal review')`,
      [eventId(number), club.id, user.id, title, description, category, start, status],
    );
  }
  await insert(1, { start: '2026-12-01T17:59:59.999Z' });
  await insert(2, { title: ' Robotics 100%_done', category: 'WORKSHOP' });
  await insert(3, { title: 'Build night', description: 'ROBOTICS at 100axdone' });
  await insert(4, { start: '2026-12-02T17:59:59.999Z', category: null });
  await insert(5, { start: '2026-12-02T18:00:00Z' });
  const privateStatuses = ['draft', 'pending', 'approved', 'rejected', 'cancelled', 'completed'];
  for (const [index, status] of privateStatuses.entries()) await insert(10 + index, { status });

  const app = express();
  app.use('/api/events', createPublicEventRouter(() => pool));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/events';

  async function get(path = '', status = 200) {
    const response = await fetch(url + path);
    assert.equal(response.status, status, path);
    return response.json();
  }
  async function ids(path, expected, total = expected.length) {
    const payload = await get(path);
    assert.deepEqual(payload.data.map((event) => event.id), expected.map(eventId));
    assert.equal(payload.pagination.total, total);
    return payload;
  }

  await t.test('anonymous list and detail have exact public fields and indistinguishable 404s', async () => {
    const payload = await ids('', [1, 2, 3, 4, 5]);
    assert.deepEqual(payload.pagination, { page: 1, limit: 20, total: 5 });
    for (const event of payload.data) {
      assert.equal(event.status, 'published');
      assert.equal(event.club_name, 'Robotics Club');
      assert.deepEqual(Object.keys(event).sort(), [...listFields].sort());
    }
    const { data } = await get('/' + eventId(3));
    assert.equal(data.description, 'ROBOTICS at 100axdone');
    assert.deepEqual(Object.keys(data).sort(), [...listFields, 'description'].sort());
    const unknown = await get('/' + eventId(99), 404);
    assert.equal(unknown.error.code, 'EVENT_NOT_FOUND');
    for (const index of privateStatuses.keys()) {
      assert.deepEqual(await get('/' + eventId(10 + index), 404), unknown);
    }
  });

  await t.test('case-insensitive search, literal wildcards, categories and Dhaka boundaries compose', async () => {
    await ids('?search=%20rObOtIcS%20', [1, 2, 3, 4, 5]);
    await ids('?search=100%25_done', [2]);
    await ids('?category=workshop', [1, 2, 3, 5]);
    await ids('?category=work', []);
    await ids('?from=2026-12-02', [2, 3, 4, 5]);
    await ids('?to=2026-12-02', [1, 2, 3, 4]);
    await ids('?from=2026-12-02&to=2026-12-02', [2, 3, 4]);
    await ids('?search=robotics&category=workshop&from=2026-12-02&to=2026-12-02&sort=start_desc', [3, 2]);
  });

  await t.test('pagination orders ties and preserves the total when a page is empty', async () => {
    const page = await ids('?limit=2&page=2', [3, 4], 5);
    assert.deepEqual(page.pagination, { page: 2, limit: 2, total: 5 });
    await ids('?sort=start_desc&limit=3', [5, 4, 3], 5);
    await ids('?sort=start_desc&limit=3&page=2', [2, 1], 5);
    await ids('?limit=2&page=99', [], 5);
  });

  await t.test('a status change removes the event from both reads', async () => {
    await pool.query("UPDATE events SET status = 'cancelled' WHERE id = $1", [eventId(3)]);
    await ids('', [1, 2, 4, 5]);
    await get('/' + eventId(3), 404);
  });
});
