import { EventError } from '../services/eventError.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const proposalFields = ['title', 'description', 'category', 'image_url', 'start_time', 'end_time', 'capacity'];
const requiredFields = ['title', 'description', 'start_time', 'end_time', 'capacity'];

function invalid(message) {
  throw new EventError(400, 'VALIDATION_ERROR', message);
}

export function isUuid(value) {
  return typeof value === 'string' && uuid.test(value);
}

export function validateId(value, label) {
  if (!isUuid(value)) invalid(label + ' must be a UUID.');
  return value.toLowerCase();
}

function checkFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Expected a JSON object.');
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) invalid('Unexpected field: ' + key);
  }
}

function text(value, field, max, optional = false) {
  if (optional && value === null) return null;
  if (typeof value !== 'string') invalid(field + ' must be text.');
  const trimmed = value.trim();
  if ((!optional && !trimmed) || [...trimmed].length > max || trimmed.includes('\0')) {
    invalid(field + ' must contain valid text up to ' + max + ' characters.');
  }
  return trimmed || null;
}

function dateTime(value, field) {
  if (typeof value !== 'string' || !timestamp.test(value) || value.startsWith('0000')) {
    invalid(field + ' must be an ISO 8601 timestamp with a timezone.');
  }
  const day = new Date(value.slice(0, 10) + 'T00:00:00Z');
  const date = new Date(value);
  if (!Number.isFinite(+date) || !Number.isFinite(+day) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    invalid(field + ' must be a valid calendar date and time.');
  }
  return date.toISOString();
}

export function validateDateRange(start, end) {
  if (new Date(end) <= new Date(start)) invalid('end_time must be after start_time.');
}

export function validateProposal(body, creating) {
  checkFields(body, creating ? [...proposalFields, 'club_id'] : proposalFields);
  if (!creating && !Object.keys(body).length) invalid('Provide at least one editable field.');
  const result = {};
  if (creating) {
    result.club_id = validateId(body.club_id, 'club_id');
    for (const field of requiredFields) {
      if (!Object.hasOwn(body, field)) invalid(field + ' is required.');
    }
  }
  for (const [field, max, optional] of [
    ['title', 200, false], ['description', 10000, false],
    ['category', 80, true], ['image_url', 2048, true],
  ]) {
    if (Object.hasOwn(body, field)) result[field] = text(body[field], field, max, optional);
  }
  if (result.image_url && !URL.canParse(result.image_url)) invalid('image_url must be an absolute HTTP(S) URL.');
  if (result.image_url && !['http:', 'https:'].includes(new URL(result.image_url).protocol)) {
    invalid('image_url must be an absolute HTTP(S) URL.');
  }
  for (const field of ['start_time', 'end_time']) {
    if (Object.hasOwn(body, field)) result[field] = dateTime(body[field], field);
  }
  if (Object.hasOwn(body, 'capacity')) {
    if (!Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 2147483647) {
      invalid('capacity must be a positive PostgreSQL integer.');
    }
    result.capacity = body.capacity;
  }
  if (result.start_time && result.end_time) validateDateRange(result.start_time, result.end_time);
  return result;
}

export function validateReview(body) {
  checkFields(body, ['decision', 'review_note', 'submission_version']);
  const { decision, review_note, submission_version } = body;
  if (decision !== 'approved' && decision !== 'rejected') invalid('decision must be approved or rejected.');
  if (!Number.isInteger(submission_version) || submission_version < 0 || submission_version > 2147483647) {
    invalid('submission_version must be a nonnegative PostgreSQL integer.');
  }
  return {
    decision,
    submission_version,
    review_note: text(review_note === undefined ? null : review_note, 'review_note', 2000, decision === 'approved'),
  };
}

export function validatePage(query) {
  checkFields(query, ['page', 'limit']);
  const { page = '1', limit = '20' } = query;
  if (typeof page !== 'string' || typeof limit !== 'string' ||
      !/^[1-9]\d{0,9}$/.test(page) || !/^[1-9]\d{0,2}$/.test(limit) ||
      Number(page) > 2147483647 || Number(limit) > 100) {
    invalid('page must be a positive integer and limit must be between 1 and 100.');
  }
  return { page: Number(page), limit: Number(limit) };
}
