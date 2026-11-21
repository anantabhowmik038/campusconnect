import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import app from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters';
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
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
