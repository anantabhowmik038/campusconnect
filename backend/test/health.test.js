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

test('F11 validates feedback event identifiers', async () => {
  const response = await fetch(`${baseUrl}/api/feedback/events/not-a-uuid`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'eventId must be a valid UUID.' });
});

test('F11 validates feedback ratings before database access', async () => {
  const response = await fetch(
    `${baseUrl}/api/feedback/events/00000000-0000-4000-8000-000000000000`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating: 6 }),
    },
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Authentication token is missing.' });
});

test('F11 requires bearer authentication for protected operations', async () => {
  const eventId = '00000000-0000-4000-8000-000000000000';
  const response = await fetch(`${baseUrl}/api/feedback/events/${eventId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 5 }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Authentication token is missing.' });
});

function f11Token(userId, role = 'student') {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET);
}

function mockF11User(userId, role = 'student') {
  pg.Pool.prototype.query = async function (sql, values) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: values[0], role, is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
}

test('F11 validates ratings after authenticated database access', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const eventId = '00000000-0000-4000-8000-000000000002';
  mockF11User(userId);
  const response = await fetch(`${baseUrl}/api/feedback/events/${eventId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${f11Token(userId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rating: 6 }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'rating must be an integer from 1 to 5.' });
});

test('F11 rejects feedback from a non-attendee', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const eventId = '00000000-0000-4000-8000-000000000002';
  mockF11User(userId);
  pg.Pool.prototype.query = async function (sql, values) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'student', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'student' }] };
    }
    if (sql.includes('FROM event_attendance ea')) return { rows: [] };
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/feedback/events/${eventId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${f11Token(userId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rating: 4 }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Feedback is available only to users who attended the event.' });
});

test('F11 rejects feedback for an incomplete event', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const eventId = '00000000-0000-4000-8000-000000000002';
  mockF11User(userId);
  pg.Pool.prototype.query = async function (sql, values) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'student', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'student' }] };
    }
    if (sql.includes('FROM event_attendance ea')) return { rows: [{ status: 'published' }] };
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/feedback/events/${eventId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${f11Token(userId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rating: 5, comment: 'Great event' }),
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Feedback is available after the event is completed.' });
});

test('F11 creates or updates feedback with a 2000-character comment', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const eventId = '00000000-0000-4000-8000-000000000002';
  const feedbackId = '00000000-0000-4000-8000-000000000003';
  mockF11User(userId);
  pg.Pool.prototype.query = async function (sql, values) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'student', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'student' }] };
    }
    if (sql.includes('FROM event_attendance ea')) return { rows: [{ status: 'completed' }] };
    if (sql.includes('INSERT INTO event_feedback')) {
      return { rows: [{ id: feedbackId, event_id: eventId, user_id: userId, rating: values[2], comment: values[3], created_at: '2026-11-21T15:00:00.000Z' }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/feedback/events/${eventId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${f11Token(userId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rating: 5, comment: 'x'.repeat(2000) }),
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.feedback.id, feedbackId);
  assert.equal(payload.feedback.rating, 5);
  assert.equal(payload.feedback.comment.length, 2000);
});

test('F11 calculates rating summaries and review lists', async () => {
  const eventId = '00000000-0000-4000-8000-000000000002';
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, title, status FROM events')) {
      return { rows: [{ id: eventId, title: 'Workshop', status: 'completed' }] };
    }
    if (sql.includes('COUNT(*)::int AS review_count')) {
      return { rows: [{ review_count: 2, average_rating: 4.5, five_star_count: 1, four_star_count: 1, three_star_count: 0, two_star_count: 0, one_star_count: 0 }] };
    }
    if (sql.includes('FROM event_feedback ef')) {
      return { rows: [{ id: '00000000-0000-4000-8000-000000000003', rating: 5, comment: 'Excellent', created_at: '2026-11-21T15:00:00.000Z', reviewer_name: 'Test User' }] };
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/feedback/events/${eventId}`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.summary.review_count, 2);
  assert.equal(payload.summary.average_rating, 4.5);
  assert.equal(payload.reviews.length, 1);
});

test('F11 allows an author or campus admin to delete feedback', async () => {
  const feedbackId = '00000000-0000-4000-8000-000000000003';
  const userId = '00000000-0000-4000-8000-000000000001';
  mockF11User(userId, 'campus_admin');
  pg.Pool.prototype.query = async function (sql, values) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'campus_admin' }] };
    }
    if (sql.includes('DELETE FROM event_feedback')) return { rows: [{ id: feedbackId }] };
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/feedback/${feedbackId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${f11Token(userId, 'campus_admin')}` },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
});

test('F11 rejects deletion by a different student', async () => {
  const feedbackId = '00000000-0000-4000-8000-000000000003';
  const userId = '00000000-0000-4000-8000-000000000001';
  mockF11User(userId, 'student');
  pg.Pool.prototype.query = async function (sql) {
    if (sql.includes('SELECT id, role, is_active FROM users')) {
      return { rows: [{ id: userId, role: 'student', is_active: true }] };
    }
    if (sql.includes('SELECT id, role FROM users')) {
      return { rows: [{ id: userId, role: 'student' }] };
    }
    if (sql.includes('DELETE FROM event_feedback')) return { rows: [] };
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  const response = await fetch(`${baseUrl}/api/feedback/${feedbackId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${f11Token(userId)}` },
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Feedback was not found or cannot be deleted.' });
});
