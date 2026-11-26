import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import express from 'express';
import pg from 'pg';
import { createEventModel } from '../src/models/eventModel.js';
import { createEventRouter } from '../src/routes/eventRoutes.js';
import { createEventService } from '../src/services/eventService.js';

const connectionString = process.env.F04_TEST_DATABASE_URL;

test('F04 HTTP workflow persists in an isolated PostgreSQL schema', {
  skip: !connectionString && 'Set F04_TEST_DATABASE_URL to run against a local PostgreSQL database.',
}, async (t) => {
  const schema = 'f04_test_' + randomUUID().replaceAll('-', '');
  const adminPool = new pg.Pool({ connectionString });
  t.after(() => adminPool.end());
  await adminPool.query('CREATE SCHEMA ' + schema);
  const pool = new pg.Pool({ connectionString, options: '-c search_path=' + schema });
  t.after(async () => {
    // Only this test run's generated schema is removed.
    try {
      await pool.end();
    } finally {
      const cleanup = new pg.Pool({ connectionString });
      try {
        await cleanup.query('DROP SCHEMA ' + schema + ' CASCADE');
      } finally {
        await cleanup.end();
      }
    }
  });

  const schemaSql = await readFile(new URL('../../database/migrations/001_initial_schema.sql', import.meta.url), 'utf8');
  await pool.query(schemaSql);
  const versionSql = await readFile(new URL('../../database/migrations/002_event_submission_version.sql', import.meta.url), 'utf8');
  await pool.query(versionSql);

  const actors = new Map();
  for (const [name, role] of [
    ['officer', 'club_officer'], ['other', 'club_officer'],
    ['student', 'student'], ['admin', 'campus_admin'], ['other-admin', 'campus_admin'],
  ]) {
    const { rows: [actor] } = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, role',
      [name, name + '@f04.test', 'unused-test-fixture', role],
    );
    actors.set(name, actor);
  }
  async function club(name, officer, status = 'active') {
    const { rows: [row] } = await pool.query(
      'INSERT INTO clubs (name, officer_user_id, status) VALUES ($1, $2, $3) RETURNING id',
      [name, actors.get(officer).id, status],
    );
    return row.id;
  }
  const assignedClub = await club('Robotics', 'officer');
  const otherClub = await club('Photography', 'other');
  const inactiveClub = await club('Inactive', 'officer', 'inactive');

  const app = express();
  // These credentials resolve only inside this isolated test app.
  app.use((req, _res, next) => {
    req.user = actors.get(req.get('Authorization')?.replace(/^Bearer /, ''));
    next();
  });
  app.use('/api/events', createEventRouter(createEventService(createEventModel(() => pool))));
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  async function request(method, path, actor, body, status) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/events' + path, {
      method,
      headers: { Authorization: 'Bearer ' + actor, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (status !== undefined) assert.equal(response.status, status, JSON.stringify(payload));
    return { ...payload, httpStatus: response.status };
  }

  const proposal = {
    title: 'Programming workshop',
    description: 'Hands-on workshop',
    club_id: assignedClub,
    start_time: '2026-12-04T10:00:00+06:00',
    end_time: '2026-12-04T12:00:00+06:00',
    capacity: 80,
  };
  let eventId;
  await t.test('creation validates data and restricts writes to an assigned active club', async () => {
    await request('POST', '', 'student', proposal, 403);
    await request('POST', '', 'officer', { ...proposal, club_id: otherClub }, 403);
    await request('POST', '', 'officer', { ...proposal, club_id: inactiveClub }, 403);
    await request('POST', '', 'officer', { ...proposal, capacity: 0 }, 400);
    const { data } = await request('POST', '', 'officer', proposal, 201);
    eventId = data.id;
    assert.equal(data.status, 'draft');
    assert.equal(data.submission_version, 0);
    assert.equal(data.created_by, actors.get('officer').id);
    assert.equal(data.start_time, '2026-12-04T04:00:00.000Z');
    assert.equal(data.reviewed_by, null);
  });

  await t.test('proposal list is scoped and draft edits validate combined dates', async () => {
    const path = '/' + eventId;
    const { data, pagination } = await request('GET', '/proposals?limit=1', 'officer', undefined, 200);
    assert.deepEqual(pagination, { page: 1, limit: 1, total: 1 });
    assert.equal(data[0].id, eventId);
    assert.equal(data[0].club_name, 'Robotics');
    const other = await request('GET', '/proposals', 'other', undefined, 200);
    assert.deepEqual(other.data, []);
    await request('PATCH', path, 'other', { title: 'Cross-club' }, 403);
    await request('PATCH', path, 'officer', { end_time: proposal.start_time }, 400);
    await request('PATCH', path, 'officer', { title: 'Updated workshop' }, 200);
    await request('PATCH', '/' + randomUUID(), 'officer', { title: 'Missing' }, 404);
  });

  await t.test('draft submission is authorized, queues the proposal and prevents invalid transitions', async () => {
    const path = '/' + eventId;
    await request('PATCH', path + '/review', 'admin', { decision: 'approved', submission_version: 0 }, 409);
    await request('POST', path + '/submit', 'other', undefined, 403);
    await request('POST', path + '/submit', 'officer', { status: 'approved' }, 400);
    const { data } = await request('POST', path + '/submit', 'officer', undefined, 200);
    assert.equal(data.status, 'pending');
    assert.equal(data.submission_version, 1);
    await request('GET', '/pending', 'officer', undefined, 403);
    const queue = await request('GET', '/pending', 'admin', undefined, 200);
    assert.deepEqual(queue.data.map((item) => item.id), [eventId]);
    await request('PATCH', path, 'officer', { title: 'Locked' }, 409);
    await request('POST', path + '/submit', 'officer', undefined, 409);
  });

  await t.test('admin rejection requires feedback, which the officer sees until resubmission', async () => {
    const path = '/' + eventId;
    await request('PATCH', path + '/review', 'student', { decision: 'approved' }, 403);
    await request('PATCH', path + '/review', 'officer', { decision: 'approved' }, 403);
    await request('PATCH', path + '/review', 'admin', { decision: 'approved' }, 400);
    await request('PATCH', path + '/review', 'admin', { decision: 'rejected', submission_version: 1, review_note: ' ' }, 400);
    const { data } = await request('PATCH', path + '/review', 'admin', {
      decision: 'rejected', submission_version: 1, review_note: '  Add more detail.  ',
    }, 200);
    assert.equal(data.status, 'rejected');
    assert.equal(data.reviewed_by, actors.get('admin').id);
    assert.ok(Number.isFinite(Date.parse(data.reviewed_at)));
    const list = await request('GET', '/proposals', 'officer', undefined, 200);
    assert.equal(list.data[0].review_note, 'Add more detail.');
    const edited = await request('PATCH', path, 'officer', { description: 'Updated workshop details' }, 200);
    assert.equal(edited.data.review_note, 'Add more detail.');
    const resubmitted = await request('POST', path + '/submit', 'officer', undefined, 200);
    assert.equal(resubmitted.data.status, 'pending');
    assert.equal(resubmitted.data.submission_version, 2);
    assert.equal(resubmitted.data.review_note, null);
    assert.equal(resubmitted.data.reviewed_by, null);
    assert.equal(resubmitted.data.reviewed_at, null);
  });

  await t.test('concurrent decisions commit only one approval and persist reviewer and proposal fields', async () => {
    const path = '/' + eventId;
    const results = await Promise.all([
      request('PATCH', path + '/review', 'admin', { decision: 'approved', submission_version: 2 }),
      request('PATCH', path + '/review', 'other-admin', { decision: 'approved', submission_version: 2 }),
    ]);
    assert.deepEqual(results.map((result) => result.httpStatus).sort(), [200, 409]);
    const { rows: [saved] } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    assert.equal(saved.status, 'approved');
    assert.equal(saved.title, 'Updated workshop');
    assert.equal(saved.description, 'Updated workshop details');
    assert.equal(saved.created_by, actors.get('officer').id);
    assert.equal(saved.reviewed_by, results.find((result) => result.httpStatus === 200).data.reviewed_by);
    assert.ok(saved.reviewed_at instanceof Date);
    const queue = await request('GET', '/pending', 'admin', undefined, 200);
    assert.deepEqual(queue.data, []);
    await request('POST', path + '/submit', 'officer', undefined, 409);
  });

  await t.test('stale admin review cannot decide a rejected, edited and resubmitted proposal', async () => {
    const { data: draft } = await request('POST', '', 'officer', proposal, 201);
    const path = '/' + draft.id;
    await request('POST', path + '/submit', 'officer', undefined, 200);
    const { data: firstQueue } = await request('GET', '/pending', 'admin', undefined, 200);
    const firstVersion = firstQueue.find((item) => item.id === draft.id).submission_version;

    await request('PATCH', path + '/review', 'other-admin', {
      decision: 'rejected', review_note: 'Revise the description.', submission_version: firstVersion,
    }, 200);
    await request('PATCH', path, 'officer', { description: 'Revised proposal for review' }, 200);
    const { data: revised } = await request('POST', path + '/submit', 'officer', undefined, 200);
    assert.equal(revised.submission_version, firstVersion + 1);
    const { rows: [before] } = await pool.query('SELECT * FROM events WHERE id = $1', [draft.id]);

    const stale = await request('PATCH', path + '/review', 'admin', {
      decision: 'approved', submission_version: firstVersion,
    }, 409);
    assert.equal(stale.error.code, 'STALE_SUBMISSION');
    const { rows: [after] } = await pool.query('SELECT * FROM events WHERE id = $1', [draft.id]);
    assert.deepEqual(after, before);
    assert.equal(after.status, 'pending');
    assert.equal(after.description, 'Revised proposal for review');
    assert.equal(after.reviewed_by, null);
    assert.equal(after.reviewed_at, null);

    const { data: refreshedQueue } = await request('GET', '/pending', 'admin', undefined, 200);
    const refreshed = refreshedQueue.find((item) => item.id === draft.id);
    assert.equal(refreshed.submission_version, revised.submission_version);
    const { data: approved } = await request('PATCH', path + '/review', 'admin', {
      decision: 'approved', submission_version: refreshed.submission_version,
    }, 200);
    assert.equal(approved.status, 'approved');
    assert.equal(approved.reviewed_by, actors.get('admin').id);
  });

  await t.test('club reassignment removes the former officer access immediately', async () => {
    const { data } = await request('POST', '', 'officer', proposal, 201);
    await pool.query('UPDATE clubs SET officer_user_id = $1 WHERE id = $2', [actors.get('other').id, assignedClub]);
    await request('PATCH', '/' + data.id, 'officer', { title: 'Former officer' }, 403);
    const previous = await request('GET', '/proposals', 'officer', undefined, 200);
    assert.deepEqual(previous.data, []);
    await pool.query("UPDATE clubs SET status = 'inactive' WHERE id = $1", [assignedClub]);
    const updated = await request('PATCH', '/' + data.id, 'other', { title: 'Current officer' }, 200);
    assert.equal(updated.data.created_by, actors.get('officer').id);
    const submitted = await request('POST', '/' + data.id + '/submit', 'other', undefined, 200);
    assert.equal(submitted.data.status, 'pending');
  });
});
