const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

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
