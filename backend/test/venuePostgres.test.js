import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import app from '../src/app.js';
import { getDatabasePool } from '../src/config/database.js';

const connectionString = process.env.F08_TEST_DATABASE_URL;

test('F08 HTTP workflows and concurrent venue reviews on PostgreSQL', {
  skip: connectionString ? false : 'Set F08_TEST_DATABASE_URL to an isolated PostgreSQL database.',
}, async (t) => {
  const schema = 'f08_test_' + randomUUID().replaceAll('-', '');
  const adminPool = new pg.Pool({ connectionString });
  await adminPool.query('CREATE SCHEMA ' + schema);
  const url = new URL(connectionString);
  url.searchParams.set('options', '-c search_path=' + schema);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_SECRET = randomUUID() + randomUUID();
  const pool = getDatabasePool();
  let server;
  t.after(async () => {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      await pool.end();
    } finally {
      try {
        await adminPool.query('DROP SCHEMA ' + schema + ' CASCADE');
      } finally {
        await adminPool.end();
      }
    }
  });

  await pool.query(await readFile(new URL('../../database/migrations/001_initial_schema.sql', import.meta.url), 'utf8'));
  const { rows: [officer, otherOfficer, admin, student, inactive] } = await pool.query(`
    INSERT INTO users (full_name, email, password_hash, role, is_active)
    VALUES ('Officer', 'officer@example.test', 'unused', 'club_officer', TRUE),
           ('Other officer', 'other@example.test', 'unused', 'club_officer', TRUE),
           ('Admin', 'admin@example.test', 'unused', 'campus_admin', TRUE),
           ('Student', 'student@example.test', 'unused', 'student', TRUE),
           ('Inactive', 'inactive@example.test', 'unused', 'campus_admin', FALSE)
    RETURNING id
  `);
  const { rows: [club, otherClub, inactiveClub] } = await pool.query(`
    INSERT INTO clubs (name, officer_user_id, status)
    VALUES ('First club', $1, 'active'), ('Other club', $2, 'active'), ('Inactive club', $1, 'inactive')
    RETURNING id
  `, [officer.id, otherOfficer.id]);
  const { rows: [event, otherEvent, inactiveEvent] } = await pool.query(`
    INSERT INTO events (club_id, created_by, title, description, start_time, end_time, capacity)
    VALUES ($1, $4, 'First proposal', 'Fixture', NOW(), NOW() + INTERVAL '1 hour', 10),
           ($2, $5, 'Other proposal', 'Fixture', NOW(), NOW() + INTERVAL '1 hour', 10),
           ($3, $4, 'Inactive club proposal', 'Fixture', NOW(), NOW() + INTERVAL '1 hour', 10)
    RETURNING id
  `, [club.id, otherClub.id, inactiveClub.id, officer.id, otherOfficer.id]);
  const { rows: [hall, secondHall, closedHall] } = await pool.query(`
    INSERT INTO venues (name, location, capacity, is_active)
    VALUES ('Hall A', 'North', 100, TRUE), ('Hall B', 'South', 60, TRUE), ('Closed hall', 'East', 40, FALSE)
    RETURNING id
  `);

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  async function request(path, { user, claim = 'student', method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = 'Bearer ' + jwt.sign({ id: user.id, role: claim }, process.env.JWT_SECRET);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      headers, method, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  async function expect(path, status, options) {
    const response = await request(path, options);
    assert.equal(response.status, status, `${options?.method ?? 'GET'} ${path}: ${JSON.stringify(response.body)}`);
    return response.body.data;
  }

  const bookingPath = '/venue-bookings';
  const calendar = '/venues/' + hall.id + '/bookings';
  const range = {
    event_id: event.id, venue_id: hall.id,
    start_time: '2030-06-01T10:00:00Z', end_time: '2030-06-01T11:00:00Z',
  };
  const create = (body, user = officer, status = 201, claim) =>
    expect(bookingPath, status, { body, user, claim, method: 'POST' });
  const reviewOptions = (status, user = admin, claim) => ({
    body: { status }, user, claim, method: 'PATCH',
  });
  const reviewPath = (id) => bookingPath + '/' + id + '/review';

  await t.test('authentication, live roles, listing and validation', async () => {
    await expect('/venues', 401);
    await expect('/venues', 403, { user: inactive });
    assert.deepEqual((await expect('/venues', 200, { user: student })).map(({ id }) => id), [hall.id, secondHall.id]);
    assert.equal((await expect('/venues', 200, { user: admin })).length, 3);
    assert.deepEqual((await expect(bookingPath + '/events', 200, { user: officer })).map(({ id }) => id), [event.id]);
    await expect(bookingPath + '/events', 403, { user: student, claim: 'club_officer' });
    await create(range, student, 403, 'club_officer');
    await create(range, otherOfficer, 403);
    await create({ ...range, event_id: inactiveEvent.id }, officer, 403);
    await create({ ...range, event_id: randomUUID() }, officer, 404);
    await create({ ...range, venue_id: closedHall.id }, officer, 404);
    await create({ ...range, venue_id: randomUUID() }, officer, 404);
    await expect('/venues/non-uuid/bookings', 400, { user: officer });
    await expect('/venues/' + randomUUID() + '/bookings', 404, { user: officer });
    await expect(reviewPath('invalid'), 400, reviewOptions('approved'));
    await expect(reviewPath(randomUUID()), 404, reviewOptions('approved'));
    for (const changes of [
      { event_id: 'bad' }, { venue_id: [hall.id] }, { start_time: 0 },
      { start_time: '2030-02-30T10:00:00Z' }, { start_time: '2030-06-01T10:00:00' },
      { end_time: range.start_time },
    ]) await create({ ...range, ...changes }, officer, 400);
  });

  await t.test('calendar privacy, concurrent overlap, adjacency and review transitions', async () => {
    const first = await create(range);
    const second = await create({ ...range, event_id: otherEvent.id, start_time: '2030-06-01T10:30:00Z' }, otherOfficer);
    const adjacent = await create({
      ...range, start_time: '2030-06-01T17:00:00+06:00', end_time: '2030-06-01T18:00:00+06:00',
    });
    const separateVenue = await create({ ...range, venue_id: secondHall.id });

    assert.equal(first.status, 'pending');
    assert.deepEqual(await expect(calendar, 200, { user: student }), []);
    const own = await expect(calendar, 200, { user: officer });
    assert.deepEqual(own.map(({ id }) => id), [first.id, adjacent.id]);
    assert.equal((await expect(calendar, 200, { user: admin })).length, 3);

    await expect(reviewPath(first.id), 403, reviewOptions('approved', officer, 'campus_admin'));
    await expect(reviewPath(first.id), 400, reviewOptions('cancelled'));
    const competing = await Promise.all([first, second].map((booking) =>
      request(reviewPath(booking.id), reviewOptions('approved'))));
    assert.deepEqual(competing.map(({ status }) => status).sort(), [200, 409]);
    assert.match(competing.find(({ status }) => status === 409).body.error, /time conflict/);
    const winner = competing.find(({ status }) => status === 200).body.data;
    assert.equal(winner.reviewed_by, admin.id);
    const loser = winner.id === first.id ? second : first;
    assert.equal((await expect(reviewPath(loser.id), 200, reviewOptions('rejected'))).status, 'rejected');
    await expect(reviewPath(loser.id), 409, reviewOptions('approved'));
    await create(range, officer, 409);

    const studentCalendar = await expect(calendar, 200, { user: student });
    assert.deepEqual(studentCalendar.map(({ id, event_id, event_title, status }) => [id, event_id, event_title, status]),
      [[winner.id, null, null, 'approved']]);
    await expect(reviewPath(adjacent.id), 200, reviewOptions('approved'));
    await expect(reviewPath(separateVenue.id), 200, reviewOptions('approved'));
    const { rows: [result] } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM venue_bookings WHERE venue_id = $1 AND status = 'approved'",
      [hall.id],
    );
    assert.equal(result.count, 2);
  });

  await t.test('a booking can be reviewed only once and inactive venues cannot be approved', async () => {
    const future = { ...range, start_time: '2030-06-02T10:00:00Z', end_time: '2030-06-02T11:00:00Z' };
    const pending = await create(future);
    const results = await Promise.all(['approved', 'rejected'].map((status) =>
      request(reviewPath(pending.id), reviewOptions(status))));
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);

    const second = await create({ ...future, venue_id: secondHall.id });
    await pool.query('UPDATE venues SET is_active = FALSE WHERE id = $1', [secondHall.id]);
    await expect(reviewPath(second.id), 409, reviewOptions('approved'));
    await expect(reviewPath(second.id), 200, reviewOptions('rejected'));
  });
});
