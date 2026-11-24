import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import app from '../src/app.js';

let server;
let baseUrl;
let originalPoolQuery;

before(async () => {
  process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters';
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
  originalPoolQuery = pg.Pool.prototype.query;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  pg.Pool.prototype.query = originalPoolQuery;
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

function analyticsToken(userId, role = 'campus_admin') {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET);
}

test('F12 requires authentication for analytics', async () => {
  const response = await fetch(`${baseUrl}/api/analytics/overview`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Authentication token is missing.' });
});

test('F12 rejects invalid JWT tokens', async () => {
  const response = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid or expired authentication token.' });
});

test('F12 rejects expired JWT tokens', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: -1 });
  const response = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid or expired authentication token.' });
});

test('F12 rejects inactive users', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin', is_active: false }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId)}` },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Active user identity is required.' });
});

test('F12 overview is available to campus admins', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin' }] };
    }
    if (sql.includes('SELECT') && sql.includes('active_clubs')) {
      return { rows: [{ active_clubs: 4, total_events: 12, completed_events: 8, registrations: 300, attendance: 240, feedback_count: 180, average_rating: 4.35 }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId)}` },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.analytics.active_clubs, 4);
  assert.equal(payload.analytics.average_rating, 4.35);
});

test('F12 prevents students from viewing overview analytics', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'student', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'student' }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId, 'student')}` },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Campus administrator access is required.' });
});

test('F12 validates club UUIDs', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin', is_active: true }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/clubs/not-a-uuid`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId)}` },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'clubId must be a valid UUID.' });
});

test('F12 prevents club officers from viewing another club', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const clubId = '22222222-2222-4222-8222-222222222222';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'club_officer', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'club_officer' }] };
    }
    if (sql.includes('SELECT id FROM clubs')) return { rows: [] };
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/clubs/${clubId}`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId, 'club_officer')}` },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'You are not authorized to view analytics for this club.' });
});

test('F12 calculates club metrics and event rows', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const clubId = '22222222-2222-4222-8222-222222222222';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin' }] };
    }
    if (sql.includes('SELECT id, name, status FROM clubs')) {
      return { rows: [{ id: clubId, name: 'Code Club', status: 'active' }] };
    }
    if (sql.includes('WITH event_stats AS')) {
      return { rows: [{ total_events: 3, completed_events: 2, registrations: 90, attendance: 75, feedback_count: 60, average_rating: 4.5 }] };
    }
    if (sql.includes('SELECT e.id, e.title, e.status')) {
      return { rows: [{ id: '33333333-3333-4333-8333-333333333333', title: 'Workshop', status: 'completed', registrations: 30, attendance: 25, feedback_count: 20, average_rating: 4.5 }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/clubs/${clubId}`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId)}` },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.analytics.metrics.registrations, 90);
  assert.equal(payload.analytics.events.length, 1);
});

test('F12 calculates event attendance and rating distribution', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const eventId = '33333333-3333-4333-8333-333333333333';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin' }] };
    }
    if (sql.includes('FROM events e JOIN clubs c')) {
      return { rows: [{ id: eventId, title: 'Workshop', status: 'completed', capacity: 40, club_id: '22222222-2222-4222-8222-222222222222', club_name: 'Code Club' }] };
    }
    if (sql.includes('waitlist_count')) {
      return { rows: [{ registrations: 30, waitlist_count: 5, attendance: 25, feedback_count: 20, average_rating: 4.5, five_star_count: 12, four_star_count: 6, three_star_count: 2, two_star_count: 0, one_star_count: 0 }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/events/${eventId}`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId)}` },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.analytics.metrics.attendance, 25);
  assert.equal(payload.analytics.metrics.five_star_count, 12);
});

test('F12 exports CSV analytics', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin' }] };
    }
    if (sql.includes('FROM clubs c')) {
      return { rows: [{ club_name: 'Code Club', event_title: 'Workshop', status: 'completed', registrations: 30, attendance: 25, feedback_count: 20, average_rating: 4.5 }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/analytics/export`, {
    headers: { Authorization: `Bearer ${analyticsToken(userId)}` },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
  const csv = await response.text();
  assert.match(csv, /club_name,event_title,status/);
  assert.match(csv, /Code Club,Workshop,completed/);
});
