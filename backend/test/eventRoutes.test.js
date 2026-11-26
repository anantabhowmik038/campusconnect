import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import app from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = 'http://127.0.0.1:' + server.address().port + '/api/events';
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

test('the application fails closed on all six F04 routes', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  for (const [method, path] of [
    ['POST', ''], ['PATCH', '/' + id], ['POST', '/' + id + '/submit'],
    ['GET', '/proposals'], ['GET', '/pending'], ['PATCH', '/' + id + '/review'],
    ['GET', '/PROPOSALS'], ['GET', '/PENDING'],
    ['GET', '/proposals/'], ['GET', '/pending/'],
    ['GET', '/PROPOSALS/'], ['GET', '/PENDING/'],
  ]) {
    const response = await fetch(baseUrl + path, {
      method,
      headers: {
        Authorization: 'Bearer unverified',
        'X-Role': 'campus_admin',
        'X-User-Id': id,
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : '{malformed JSON',
    });
    assert.equal(response.status, 401, method + ' ' + path);
    assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
  }
});

test('the combined app leaves publishing and registration routes unimplemented', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  for (const path of ['/' + id + '/publish', '/' + id + '/registrations']) {
    const response = await fetch(baseUrl + path, { method: 'POST' });
    assert.equal(response.status, 404);
  }
});
