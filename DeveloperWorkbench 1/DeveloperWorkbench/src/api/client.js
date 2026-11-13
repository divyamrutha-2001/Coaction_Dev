async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(body?.message || 'Unable to process request')
  }
  return body
}

export const api = {
  dashboard: () => request('/api/dashboard'),
  apis: () => request('/api/apis'),
  catalogSource: () => request('/api/catalog/source'),
  syncCatalog: () => request('/api/catalog/sync', { method: 'POST' }),
  tryApi: (payload) => request('/api/catalog/try', { method: 'POST', body: JSON.stringify(payload) }),
  createApi: (payload) => request('/api/apis', { method: 'POST', body: JSON.stringify(payload) }),
  tags: () => request('/api/tags'),
  downloads: () => request('/api/downloads'),
  createDownload: (payload) => request('/api/downloads', { method: 'POST', body: JSON.stringify(payload) }),
  access: () => request('/api/access'),
  setUserStatus: (userKey, status) => request(`/api/access/users/${userKey}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  decideRequest: (requestKey, decision) => request(`/api/access/requests/${requestKey}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }),
  usage: (range) => request(`/api/usage?range=${encodeURIComponent(range)}`),
  traces: () => request('/api/traces'),
  trace: (id) => request(`/api/traces/${encodeURIComponent(id)}`),
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}
