const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export async function eventRequest(authenticatedFetch, path, { method = 'GET', body } = {}) {
  const response = await authenticatedFetch(apiBase + '/events' + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'The proposal request failed (' + response.status + ').');
    error.status = response.status;
    throw error;
  }
  if (!payload || !Object.hasOwn(payload, 'data')) throw new Error('The proposal API returned an unexpected response.');
  return payload;
}
