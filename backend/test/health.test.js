import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import app from '../src/app.js';

let server;
let baseUrl;
let originalPoolQuery;
let originalPoolConnect;

before(async () => {
  process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters';
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
  originalPoolQuery = pg.Pool.prototype.query;
  originalPoolConnect = pg.Pool.prototype.connect;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  pg.Pool.prototype.query = originalPoolQuery;
  pg.Pool.prototype.connect = originalPoolConnect;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test('GET /api/health returns a safe health response', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, 'ok');
  assert.equal(payload.application, 'CampusConnect API');
});

test('Unrecognized API routes return HTTP 404', async () => {
  const response = await fetch(`${baseUrl}/api/not-found`);
  assert.equal(response.status, 404);
});

test('F10 rejects malformed announcement filters before database access', async () => {
  const response = await fetch(`${baseUrl}/api/announcements?clubId=not-a-uuid`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'clubId must be a valid UUID.' });
});

test('F10 requires bearer authentication for notification reads', async () => {
  const response = await fetch(`${baseUrl}/api/notifications`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Authentication token is missing.' });
});

test('F10 rejects an invalid bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/notifications`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid or expired authentication token.' });
});

test('F10 creates an announcement and fans out notifications to approved club members', async () => {
  const adminId = '11111111-1111-4111-8111-111111111111';
  const clubId = '22222222-2222-4222-8222-222222222222';
  const announcementId = '33333333-3333-4333-8333-333333333333';
  const recipientIds = [
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555',
  ];
  const token = jwt.sign(
    { id: adminId, email: 'admin@example.com', role: 'campus_admin' },
    process.env.JWT_SECRET,
  );

  pg.Pool.prototype.query = async function (sql, values) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: adminId, role: 'campus_admin', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: adminId, role: 'campus_admin' }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };

  pg.Pool.prototype.connect = async function () {
    return {
      async query(sql, values) {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0 };
        if (sql.includes('INSERT INTO announcements')) {
          return {
            rows: [{
              id: announcementId,
              club_id: clubId,
              event_id: null,
              title: 'Campus maintenance',
              content: 'The library closes early tonight.',
              created_by: adminId,
              created_at: '2026-11-21T15:00:00.000Z',
            }],
          };
        }
        if (sql.includes('FROM club_memberships cm')) {
          return { rows: recipientIds.map((userId) => ({ user_id: userId })) };
        }
        if (sql.includes('INSERT INTO notifications')) {
          return { rowCount: 1 };
        }
        throw new Error(`Unexpected transaction query: ${sql}`);
      },
      release() {},
    };
  };

  const response = await fetch(`${baseUrl}/api/announcements`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clubId,
      title: 'Campus maintenance',
      content: 'The library closes early tonight.',
    }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    announcement: {
      id: announcementId,
      club_id: clubId,
      event_id: null,
      title: 'Campus maintenance',
      content: 'The library closes early tonight.',
      created_by: adminId,
      created_at: '2026-11-21T15:00:00.000Z',
      notified_user_count: 2,
    },
  });
});
