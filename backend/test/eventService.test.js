import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEventService } from '../src/services/eventService.js';
import { validateProposal, validateReview } from '../src/validation/eventValidation.js';

const id = '12345678-1234-1234-1234-123456789abc';
const draft = {
  club_id: id,
  title: '  Programming workshop  ',
  description: 'Hands-on workshop',
  start_time: '2026-12-04T10:00:00+06:00',
  end_time: '2026-12-04T12:00:00+06:00',
  capacity: 80,
};

test('creation trims content and normalizes timezone-bearing dates', () => {
  assert.deepEqual(validateProposal(draft, true), {
    ...draft,
    title: 'Programming workshop',
    start_time: '2026-12-04T04:00:00.000Z',
    end_time: '2026-12-04T06:00:00.000Z',
  });
});

test('creation rejects missing, invalid and server-controlled fields', () => {
  for (const key of Object.keys(draft)) {
    const input = { ...draft };
    delete input[key];
    assert.throws(() => validateProposal(input, true), { status: 400 });
  }
  for (const fields of [
    { title: ' ' }, { title: 'x'.repeat(201) }, { description: '\0' },
    { category: 1 }, { club_id: 'bad' }, { image_url: 'file:///image.png' },
    { status: 'approved' }, { created_by: id }, { reviewed_by: id },
  ]) {
    assert.throws(() => validateProposal({ ...draft, ...fields }, true), { status: 400 });
  }
  assert.throws(() => validateProposal({ club_id: id }, false), { status: 400 });
  assert.throws(() => validateProposal({}, false), { status: 400 });
});

test('validation rejects invalid dates and capacity', () => {
  for (const fields of [
    { end_time: draft.start_time }, { start_time: draft.end_time },
    { start_time: '2026-02-30T11:00:00Z' }, { start_time: '2026-12-04T10:00:00' },
    { capacity: 0 }, { capacity: -1 }, { capacity: 1.5 }, { capacity: '80' }, { capacity: 2147483648 },
  ]) {
    assert.throws(() => validateProposal({ ...draft, ...fields }, true), { status: 400 });
  }
});

test('review requires nonempty feedback for rejection and rejects arbitrary decisions', () => {
  for (const body of [{ decision: 'rejected' }, { decision: 'rejected', review_note: '  ' }, { decision: 'published' }]) {
    assert.throws(() => validateReview({ submission_version: 1, ...body }), { status: 400 });
  }
  for (const submission_version of [undefined, null, '1', -1, 1.5, 2147483648]) {
    assert.throws(() => validateReview({ decision: 'approved', submission_version }), { status: 400 });
  }
  assert.deepEqual(validateReview({ decision: 'approved', submission_version: 0 }), {
    decision: 'approved', submission_version: 0, review_note: null,
  });
  assert.deepEqual(validateReview({ decision: 'rejected', submission_version: 1, review_note: ' Needs a new date. ' }), {
    decision: 'rejected', submission_version: 1, review_note: 'Needs a new date.',
  });
});

test('the service itself requires trusted identity and role before invoking the model', async () => {
  const service = createEventService({});
  await assert.rejects(service.create(undefined, draft), { status: 401 });
  await assert.rejects(service.create({ id, role: 'campus_admin' }, draft), { status: 403 });
  await assert.rejects(service.listPending({ id, role: 'club_officer' }, {}), { status: 403 });
  await assert.rejects(service.review({ id, role: 'student' }, id, {}), { status: 403 });
  await assert.rejects(service.listProposals({ id, role: 'club_officer' }, { limit: '101' }), { status: 400 });
  await assert.rejects(service.listProposals({ id, role: 'club_officer' }, { page: ['1', '2'] }), { status: 400 });
});
