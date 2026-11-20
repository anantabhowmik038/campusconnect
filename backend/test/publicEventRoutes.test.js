import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import app from '../src/app.js';
import { createPublicEventRouter } from '../src/routes/publicEventRoutes.js';

let server;
let url;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  url = 'http://127.0.0.1:' + server.address().port + '/api/events';
});

after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test('the normal app rejects invalid public event requests before accessing PostgreSQL', async () => {
  const invalid = [
    '?status=draft', '?search=one&search=two', '?category%5B%5D=workshop',
    '?from=2026-02-29', '?from=2026-2-01', '?to=2026-12-01T00:00:00Z',
    '?from=2026-12-02&to=2026-12-01', '?page=0', '?page=2147483648', '?page=1.5',
    '?limit=101', '?sort=title', '?search=%00', '?search=' + 'a'.repeat(121),
    '?category=' + 'a'.repeat(81), '/bad-id', '/00000000-0000-0000-0000-000000000001?page=1',
  ];
  for (const path of invalid) {
    const response = await fetch(url + path);
    assert.equal(response.status, 400, path);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR', path);
  }
});

test('the combined app protects proposal creation under the shared events path', async () => {
  const response = await fetch(url, { method: 'POST' });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
});

test('malformed detail and query encodings return a safe structured 400', async () => {
  for (const path of ['/%E0%A4', '/%ZZ', '?search=%FF', '?category=%', '?%ZZ=value']) {
    const response = await fetch(url + path);
    assert.equal(response.status, 400, path);
    const { error } = await response.json();
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.match(error.message, /valid URL encoding/);
    assert.ok(!error.message.includes('%'));
  }
});

test('F05 rejects oversize queries and validates parameters beyond the framework parser cutoff', async () => {
  const ignoredSeparators = '&'.repeat(1000);
  const id = '/00000000-0000-4000-8000-000000000001';
  const invalid = [
    ['', '?search=' + 'x'.repeat(4096), /4096 bytes/],
    ['', '?search=first' + ignoredSeparators + 'search=last', /each supported filter at most once/],
    ['', '?search=first' + ignoredSeparators + 'status=draft', /each supported filter at most once/],
    ['', '?search=first&%73earch=last', /each supported filter at most once/],
    ['', '??search=first', /each supported filter at most once/],
    [id, '?search=' + 'x'.repeat(4096), /4096 bytes/],
  ];
  for (const [path, query, message] of invalid) {
    const response = await fetch(url + path + query);
    assert.equal(response.status, 400);
    const { error } = await response.json();
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.match(error.message, message);
  }
});

test('F05 passes through to protected routes mounted after it and serves anonymous detail', async (t) => {
  const id = '00000000-0000-4000-8000-000000000001';
  const event = { id, title: 'Published workshop', status: 'published' };
  const accessed = [];
  const combinedApp = express();
  combinedApp.use('/api/events', createPublicEventRouter(() => ({
    async query(_sql, values) {
      accessed.push(values);
      return { rows: [event] };
    },
  })));
  const protectedRouter = express.Router();
  for (const route of ['proposals', 'pending']) {
    protectedRouter.get('/' + route, (_req, res) => res.status(401).json({ protectedRoute: route }));
  }
  combinedApp.use('/api/events', protectedRouter);
  const combinedServer = combinedApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => combinedServer.once('listening', resolve));
  t.after(() => new Promise((resolve) => combinedServer.close(resolve)));
  const combinedUrl = 'http://127.0.0.1:' + combinedServer.address().port + '/api/events/';
  for (const path of ['proposals', 'pending', 'PROPOSALS', 'pending/']) {
    const response = await fetch(combinedUrl + path);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { protectedRoute: path.toLowerCase().replace(/\/$/, '') });
  }
  const unsupportedWrite = await fetch(combinedUrl, { method: 'POST' });
  assert.equal(unsupportedWrite.status, 404);
  assert.deepEqual(accessed, []);
  const response = await fetch(combinedUrl + id);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: event });
  assert.deepEqual(accessed, [[id]]);
});
