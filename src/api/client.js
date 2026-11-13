import { getToken, setToken, clearToken } from '../lib/auth/token.js'

// Exchanges a still-signed (possibly expired) token for a fresh one. Direct fetch to avoid recursion.
async function refreshOnce() {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      clearToken()
      return null
    }
    const data = await res.json()
    if (data?.token) {
      setToken(data.token)
      return data.token
    }
  } catch {
    /* network error — fall through */
  }
  return null
}

async function request(path, options = {}, retry = true) {
  const token = getToken()
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })
  // On a 401, refresh once and replay the original request.
  if (response.status === 401 && retry && getToken()) {
    const fresh = await refreshOnce()
    if (fresh) return request(path, options, false)
  }
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
  catalogSources: () => request('/api/catalog-sources'),
  createCatalogSource: (payload) => request('/api/catalog-sources', { method: 'POST', body: JSON.stringify(payload) }),
  updateCatalogSource: (id, payload) => request(`/api/catalog-sources/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCatalogSource: (id) => request(`/api/catalog-sources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  syncCatalogSources: () => request('/api/catalog-sources/sync', { method: 'POST' }),
  tryApi: (payload) => request('/api/catalog/try', { method: 'POST', body: JSON.stringify(payload) }),
  createApi: (payload) => request('/api/apis', { method: 'POST', body: JSON.stringify(payload) }),
  tags: () => request('/api/tags'),
  downloads: () => request('/api/downloads'),
  createDownload: (payload) => request('/api/downloads', { method: 'POST', body: JSON.stringify(payload) }),
  access: () => request('/api/access'),
  setUserStatus: (userKey, status) => request(`/api/access/users/${userKey}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  decideRequest: (requestKey, decision) => request(`/api/access/requests/${requestKey}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }),
  usage: (range) => request(`/api/usage?range=${encodeURIComponent(range)}`),
  environments: () => request('/api/environments'),
  runs: (apiName, limit = 10) => request(`/api/runs?${apiName ? `api=${encodeURIComponent(apiName)}&` : ''}limit=${limit}`),
  postmanUrl: (specId) => `/api/catalog/${encodeURIComponent(specId)}/postman`,
  openApiUrl: (specId) => `/api/catalog/${encodeURIComponent(specId)}/openapi`,
  exportPostmanUrl: (domain) => `/api/catalog/export/postman${domain && domain !== 'All' ? `?domain=${encodeURIComponent(domain)}` : ''}`,
  exportOpenApiUrl: (domain) => `/api/catalog/export/openapi${domain && domain !== 'All' ? `?domain=${encodeURIComponent(domain)}` : ''}`,
  traces: () => request('/api/traces'),
  trace: (id) => request(`/api/traces/${encodeURIComponent(id)}`),
  ask: (question, context) => request('/api/assistant', { method: 'POST', body: JSON.stringify({ question, context }) }),
  assistantStarters: () => request('/api/assistant/starters'),
  requestHelp: (payload) => request('/api/assistant/request-help', { method: 'POST', body: JSON.stringify(payload) }),
  authConfig: () => request('/api/auth/okta/config'),
  me: () => request('/api/auth/me'),
  localLogin: async (email) => {
    const data = await request('/api/auth/local/login', { method: 'POST', body: JSON.stringify({ email }) })
    if (data?.token) setToken(data.token)
    return data
  },
  logout: () => clearToken(),
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}
