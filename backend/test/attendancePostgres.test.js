import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import app from '../src/app.js';
import { getDatabasePool } from '../src/config/database.js';

const connectionString = process.env.F07_TEST_DATABASE_URL;

test('F07 signed tickets, authorization and concurrent check-in on PostgreSQL', {
  skip: connectionString ? false : 'Set F07_TEST_DATABASE_URL to an isolated PostgreSQL database.',
}, async (t) => {
  const schema = 'f07_test_' + randomUUID().replaceAll('-', '');
  const adminPool = new pg.Pool({ connectionString });
  await adminPool.query('CREATE SCHEMA ' + schema);
  const url = new URL(connectionString);
  url.searchParams.set('options', '-c search_path=' + schema);
  process.env.DATABASE_URL = url.href;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const ticketSecret = randomBytes(32).toString('hex');
  process.env.ATTENDANCE_TICKET_SECRET = ticketSecret;
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
  const { rows: [student, secondStudent, officer, unrelatedOfficer, admin, inactive] } = await pool.query(`
    INSERT INTO users (full_name, email, password_hash, role, is_active)
    VALUES ('Alex', 'alex@example.test', 'unused', 'student', TRUE),
           ('Blair', 'blair@example.test', 'unused', 'student', TRUE),
           ('Officer', 'officer@example.test', 'unused', 'club_officer', TRUE),
           ('Other Officer', 'other@example.test', 'unused', 'club_officer', TRUE),
           ('Admin', 'admin@example.test', 'unused', 'campus_admin', TRUE),
           ('Inactive', 'inactive@example.test', 'unused', 'campus_admin', FALSE)
    RETURNING id
  `);
  const { rows: [club, otherClub] } = await pool.query(`
    INSERT INTO clubs (name, officer_user_id)
    VALUES ('First club', $1), ('Other club', $2) RETURNING id
  `, [officer.id, unrelatedOfficer.id]);
  const { rows: [event, otherEvent, emptyEvent] } = await pool.query(`
    INSERT INTO events (club_id, created_by, title, description, start_time, end_time, capacity, status)
    VALUES ($1, $3, 'First event', 'Fixture', NOW(), NOW() + INTERVAL '1 hour', 10, 'published'),
           ($2, $4, 'Other event', 'Fixture', NOW(), NOW() + INTERVAL '1 hour', 10, 'published'),
           ($1, $3, 'Empty event', 'Fixture', NOW(), NOW() + INTERVAL '1 hour', 10, 'published')
    RETURNING id
  `, [club.id, otherClub.id, officer.id, unrelatedOfficer.id]);
  const { rows: [registration, waiting, revocable, secondRegistration] } = await pool.query(`
    INSERT INTO event_registrations (event_id, user_id, status)
    VALUES ($1, $3, 'registered'), ($2, $3, 'waitlisted'),
           ($2, $4, 'registered'), ($1, $4, 'registered')
    RETURNING id
  `, [event.id, otherEvent.id, student.id, secondStudent.id]);

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  async function request(path, { user, claim = 'student', method = 'GET', body, authorization } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = 'Bearer ' + jwt.sign({ id: user.id, role: claim }, process.env.JWT_SECRET);
    if (authorization) headers.Authorization = authorization;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers, body: JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }

  async function expect(path, status, options) {
    const response = await request(path, options);
    assert.equal(response.status, status, `${options?.method ?? 'GET'} ${path}: ${JSON.stringify(response.body)}`);
    return response.body.data;
  }

  const tickets = '/attendance/tickets';
  const checkIn = '/attendance/check-in';
  const roster = (id) => '/events/' + id + '/attendance';
  const issue = (registrationId, user = student) => ({
    user, method: 'POST', body: { registration_id: registrationId },
  });
  const scan = (token, user = officer, eventId = event.id, claim) => ({
    user, claim, method: 'POST', body: { ticket_token: token, event_id: eventId },
  });
  let ticket;

  await t.test('only current eligible registrations can receive tickets', async () => {
    await expect('/attendance/registrations', 401);
    await expect(tickets, 401, { ...issue(registration.id), authorization: 'Bearer invalid' });
    assert.deepEqual((await expect('/attendance/registrations', 200, { user: student })).map(({ id }) => id), [registration.id]);
    await expect(tickets, 400, issue([registration.id]));
    await expect(tickets, 404, issue(registration.id, secondStudent));
    await expect(tickets, 404, issue(registration.id, admin));
    await expect(tickets, 409, issue(waiting.id));

    for (const badSecret of ['', 'too-short', process.env.JWT_SECRET]) {
      process.env.ATTENDANCE_TICKET_SECRET = badSecret;
      try {
        await expect(tickets, 503, issue(registration.id));
      } finally {
        process.env.ATTENDANCE_TICKET_SECRET = ticketSecret;
      }
    }

    const issued = await request(tickets, issue(registration.id));
    assert.equal(issued.status, 200);
    assert.equal(issued.headers.get('cache-control'), 'no-store');
    ticket = issued.body.data;
    const [id, expiry, signature] = ticket.ticket_token.split('.');
    assert.equal(id, registration.id);
    assert.equal(Date.parse(ticket.expires_at), Number(expiry) * 1000);
    assert.ok(Date.parse(ticket.expires_at) > Date.now() + 23 * 60 * 60 * 1000);
    assert.equal(signature, createHmac('sha256', ticketSecret).update(id + '.' + expiry).digest('hex'));
  });

  await t.test('signatures, expiration, selected event and live permissions are enforced', async () => {
    const [id, expiry, signature] = ticket.ticket_token.split('.');
    const expiredPayload = id + '.' + (Math.floor(Date.now() / 1000) - 1);
    const expired = expiredPayload + '.' + createHmac('sha256', ticketSecret).update(expiredPayload).digest('hex');
    for (const forged of ['bad', [ticket.ticket_token], id + '.' + (Number(expiry) + 1) + '.' + signature,
      secondRegistration.id + '.' + expiry + '.' + signature]) {
      await expect(checkIn, 400, scan(forged));
    }
    const expiration = await request(checkIn, scan(expired));
    assert.equal(expiration.status, 400);
    assert.match(expiration.body.error, /expired/);
    await expect(checkIn, 403, scan(ticket.ticket_token, student, event.id, 'campus_admin'));
    await expect(checkIn, 403, scan(ticket.ticket_token, inactive));
    await expect(checkIn, 403, scan(ticket.ticket_token, unrelatedOfficer, event.id, 'campus_admin'));
    await expect(checkIn, 400, scan(ticket.ticket_token, admin, 'invalid'));
    await expect(checkIn, 409, scan(ticket.ticket_token, admin, otherEvent.id));

    const revoked = await expect(tickets, 200, issue(revocable.id, secondStudent));
    await pool.query("UPDATE event_registrations SET status = 'cancelled' WHERE id = $1", [revocable.id]);
    await expect(tickets, 409, issue(revocable.id, secondStudent));
    await expect(checkIn, 409, scan(revoked.ticket_token, admin, otherEvent.id));
    assert.equal((await pool.query('SELECT id FROM event_attendance')).rowCount, 0);
  });

  await t.test('one concurrent check-in succeeds, roster stays scoped and F11 sees attendance', async () => {
    assert.deepEqual((await expect('/attendance/events', 200, { user: officer })).map(({ id }) => id), [event.id]);
    assert.equal((await expect('/attendance/events', 200, { user: admin })).length, 2);
    await expect('/attendance/events', 403, { user: student, claim: 'club_officer' });
    await expect(roster(event.id), 403, { user: student });
    await expect(roster(event.id), 403, { user: unrelatedOfficer });
    await expect(roster('invalid'), 400, { user: admin });
    await expect(roster(randomUUID()), 404, { user: admin });
    assert.deepEqual(await expect(roster(emptyEvent.id), 200, { user: officer }), []);
    assert.deepEqual((await expect(roster(event.id), 200, { user: officer })).map(({ checked_in }) => checked_in), [false, false]);

    const attempts = await Promise.all([officer, admin, officer].map((user) =>
      request(checkIn, scan(ticket.ticket_token, user))));
    assert.deepEqual(attempts.map(({ status }) => status).sort(), [201, 409, 409]);
    const { data: recorded } = attempts.find(({ status }) => status === 201).body;
    assert.equal(recorded.registration_id, registration.id);
    await expect(checkIn, 409, scan(ticket.ticket_token));
    await expect(tickets, 409, issue(registration.id));
    assert.deepEqual(await expect('/attendance/registrations', 200, { user: student }), []);

    const entries = await expect(roster(event.id), 200, { user: admin });
    assert.deepEqual(entries.map(({ checked_in }) => checked_in), [true, false]);
    assert.ok([officer.id, admin.id].includes(entries[0].checked_in_by));
    assert.equal((await pool.query('SELECT id FROM event_attendance')).rowCount, 1);

    await pool.query("UPDATE events SET status = 'completed' WHERE id = $1", [event.id]);
    const eligible = await request('/feedback/eligible-events', { user: student });
    assert.equal(eligible.status, 200);
    assert.deepEqual(eligible.body.events.map(({ id }) => id), [event.id]);
  });
});
