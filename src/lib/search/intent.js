// Universal search intent router.
// Turns a raw query into a ranked list of jump actions so every search resolves
// to a destination. Pure and synchronous — the only async piece (the grounded
// answer card) stays in the component.

// Pages the search can route to, with the words that should surface them.
export const PAGE_TARGETS = [
  { route: '/', label: 'Dashboard', keywords: ['dashboard', 'home', 'overview', 'control tower'] },
  { route: '/api-library', label: 'API Library', keywords: ['api library', 'library', 'catalog', 'browse apis', 'all apis'] },
  { route: '/sandbox', label: 'Sandbox', keywords: ['sandbox', 'try it', 'request builder', 'run request'] },
  { route: '/tags', label: 'Context Tags', keywords: ['tags', 'context tags', 'taxonomy', 'domains', 'categories'] },
  { route: '/usage', label: 'Usage & KPIs', keywords: ['usage', 'kpi', 'kpis', 'metrics', 'traffic', 'volume', 'consumers', 'adoption', 'analytics', 'calling', 'callers'] },
  { route: '/trace', label: 'Policy Trace', keywords: ['trace', 'policy trace', 'lineage', 'journey', 'timeline'] },
  { route: '/settings', label: 'Configuration', keywords: ['settings', 'configuration', 'config', 'configure', 'environments', 'connection', 'preferences'] },
  { route: '/upload', label: 'Upload API', keywords: ['upload', 'publish', 'onboard', 'register api', 'add api', 'new api', 'import spec'] },
  { route: '/access', label: 'Access', keywords: ['access', 'permission', 'permissions', 'who can', 'entitlement', 'entitlements', 'roles'] },
]

const ID_RE = /\b(PK\d{4,}|(?:POL|SUB|QTE|CLM|ACC)-[A-Z0-9-]+)\b/i
const ID_EXACT_RE = /^(PK\d{4,}|(?:POL|SUB|QTE|CLM|ACC)-[A-Z0-9-]+)$/i
const PATH_EXACT_RE = /^\/[a-z0-9/{}._-]+$/i
const TEST_VERBS = /\b(test|try|run|call|execute|invoke|hit|send)\b/i

function normPath(value) {
  return String(value || '').toLowerCase().replace(/\{[^}]+\}/g, '{}').replace(/\/+$/, '')
}

function endpointPath(item) {
  return normPath(String(item.endpoint || '').split(/\s+/).pop() || '')
}

function pathToken(query) {
  const match = query.match(/\/[a-z0-9/{}._-]+/i)
  return match ? normPath(match[0]) : null
}

function findApiByPath(apis, target) {
  if (!target || target.length < 6) return null
  return apis.find((item) => {
    const path = endpointPath(item)
    return path && (path === target || path.includes(target) || target.includes(path))
  }) || null
}

function scoreApi(item, lower, tokens) {
  const name = String(item.name || '').toLowerCase()
  const hay = `${item.name} ${item.endpoint} ${item.owner} ${item.domain}`.toLowerCase()
  let score = 0
  if (name === lower) score += 50
  else if (name.startsWith(lower)) score += 28
  else if (name.includes(lower)) score += 18
  for (const token of tokens) {
    if (token.length < 2) continue
    if (name.includes(token)) score += 6
    else if (hay.includes(token)) score += 2
  }
  return score
}

function scorePage(page, lower) {
  const padded = ` ${lower} `
  let best = 0
  for (const kw of page.keywords) {
    if (lower === kw) best = Math.max(best, 100)
    else if (padded.includes(` ${kw} `)) best = Math.max(best, 45 + kw.length)
    else if (lower.includes(kw)) best = Math.max(best, 20 + kw.length)
  }
  return best
}

// Returns { suggestions, exact }. `exact` is a confident, unambiguous hit the
// caller may auto-navigate to; it is null when the query needs Enter/click.
export function resolveIntent(rawQuery, { apis = [] } = {}) {
  const query = (rawQuery || '').trim()
  if (!query) return { suggestions: [], exact: null }

  const lower = query.toLowerCase()
  const tokens = lower.split(/\s+/).filter(Boolean)
  const wantsTest = TEST_VERBS.test(lower)
  const candidates = []

  // Object ID -> Policy Trace.
  const idMatch = query.match(ID_RE)
  if (idMatch) {
    const id = idMatch[1].toUpperCase()
    candidates.push({
      kind: 'trace',
      route: `/trace?id=${encodeURIComponent(id)}`,
      label: `Trace ${id}`,
      sublabel: 'Policy Trace',
      badge: 'Trace',
      score: ID_EXACT_RE.test(query) ? 100 : 88,
    })
  }

  // Endpoint path -> Sandbox for the matched spec.
  const pathApi = findApiByPath(apis, pathToken(query))
  if (pathApi) {
    candidates.push({
      kind: 'sandbox',
      route: `/sandbox?api=${encodeURIComponent(pathApi.id)}`,
      label: `Test ${pathApi.name} in the Sandbox`,
      sublabel: String(pathApi.endpoint || ''),
      badge: 'Sandbox',
      score: PATH_EXACT_RE.test(query) ? 98 : 86,
    })
  }

  // Catalog matches by name/owner/domain/path.
  const scored = apis
    .map((item) => ({ item, score: scoreApi(item, lower, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
  for (const { item, score } of scored) {
    if (wantsTest) {
      candidates.push({
        kind: 'sandbox',
        route: `/sandbox?api=${encodeURIComponent(item.id)}`,
        label: `Test ${item.name} in the Sandbox`,
        sublabel: String(item.endpoint || ''),
        badge: 'Sandbox',
        score: 60 + score,
      })
    }
    candidates.push({
      kind: 'library',
      route: `/api-library?q=${encodeURIComponent(item.name)}`,
      label: item.name,
      sublabel: String(item.endpoint || ''),
      badge: 'API',
      score: 45 + score,
    })
  }

  // Page / navigation targets by keyword.
  for (const page of PAGE_TARGETS) {
    const score = scorePage(page, lower)
    if (score > 0) {
      candidates.push({ kind: 'page', route: page.route, label: page.label, sublabel: 'Open page', badge: 'Page', score })
    }
  }

  // Fallback so Enter never dead-ends.
  candidates.push({
    kind: 'search',
    route: `/api-library?q=${encodeURIComponent(query)}`,
    label: `Search the Library for \u201c${query}\u201d`,
    sublabel: 'API Library',
    badge: 'Search',
    score: 5,
  })

  const seen = new Set()
  const suggestions = candidates
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = `${item.kind}:${item.route}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 7)

  // Confident, unambiguous hits are safe to auto-jump to.
  let exact = null
  if (ID_EXACT_RE.test(query) && query.length >= 10) {
    exact = { route: `/trace?id=${encodeURIComponent(query.toUpperCase())}`, kind: 'trace' }
  } else if (PATH_EXACT_RE.test(query)) {
    const target = normPath(query)
    const hit = apis.find((item) => endpointPath(item) === target)
    if (hit) exact = { route: `/sandbox?api=${encodeURIComponent(hit.id)}`, kind: 'sandbox' }
  } else {
    const page = PAGE_TARGETS.find((target) => target.keywords.some((kw) => lower === kw))
    if (page) exact = { route: page.route, kind: 'page' }
  }

  return { suggestions, exact }
}
