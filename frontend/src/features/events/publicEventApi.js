const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

const eventFilters = new Set(['search', 'category', 'from', 'to', 'page', 'limit', 'sort']);

export function getEventFilterQuery(search) {
  // Preserve the original encoding and repeated values for API validation.
  const filters = search.slice(1).split('&').filter((parameter) => {
    const [name] = new URLSearchParams('?' + parameter).keys();
    return eventFilters.has(name);
  });
  return filters.length ? '?' + filters.join('&') : '';
}

export async function requestPublicEvents(path, signal) {
  const response = await fetch(apiBase + '/events' + path, { signal, cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error?.message || 'Could not load events. Please try again.');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
