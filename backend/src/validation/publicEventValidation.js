const fields = new Set(['search', 'category', 'from', 'to', 'page', 'limit', 'sort']);
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const maxQueryBytes = 4096;

export function readPublicEventQuery(originalUrl) {
  const separator = originalUrl.indexOf('?');
  const raw = separator === -1 ? '' : originalUrl.slice(separator + 1);
  if (Buffer.byteLength(raw) > maxQueryBytes) {
    return { error: 'The event query must be at most 4096 bytes.' };
  }
  try {
    // URLSearchParams handles form encoding but tolerates malformed escapes.
    decodeURIComponent(raw);
  } catch {
    return { error: 'Use valid URL encoding for event filters.' };
  }
  const query = Object.create(null);
  for (const [key, value] of new URLSearchParams('?' + raw)) {
    if (!fields.has(key)) return { error: 'Use only supported event filters.' };
    if (Object.hasOwn(query, key)) {
      return { error: 'Use each supported filter at most once.' };
    }
    query[key] = value;
  }
  return { query };
}

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validatePublicEventQuery(query) {
  const { from, to, page = '1', limit = '20', sort = 'start_asc' } = query;
  const search = query.search?.trim();
  const category = query.category?.trim();
  if (search?.length > 120 || category?.length > 80 || search?.includes('\0') || category?.includes('\0')) {
    return { error: 'Search and category must be valid text within 120 and 80 characters, respectively.' };
  }
  if ((from !== undefined && !calendarDate(from)) || (to !== undefined && !calendarDate(to)) ||
      (from && to && from > to)) {
    return { error: 'Enter valid dates in YYYY-MM-DD order.' };
  }
  if (!/^[1-9]\d{0,9}$/.test(page) || Number(page) > 2147483647 ||
      !/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > 100) {
    return { error: 'Page must be a positive integer and limit must be between 1 and 100.' };
  }
  if (sort !== 'start_asc' && sort !== 'start_desc') {
    return { error: 'Sort must be start_asc or start_desc.' };
  }
  return { filters: { search, category, from, to, page: Number(page), limit: Number(limit), sort } };
}

export function isPublicEventId(value) {
  return uuidPattern.test(value);
}
