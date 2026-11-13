// Serves the workbench UI from the OpenAPI catalog plus real call logs in the public schema.
import {
  catalogSource,
  listCatalogApis,
  listCatalogTags,
  postmanCollection,
  specDocument,
  syncCatalog,
  tryOperation,
  writeSpec,
} from './catalog.js'
import { answerQuestion, requestHelp, starterQuestions } from './assistant.js'

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 }
const SELF_BASE_URL = process.env.API_TEST_REAL_BASE_URL || `http://127.0.0.1:${Number(process.env.PORT || 8787)}`

// Sandbox runs against this server; other environments need a configured gateway URL.
export const ENVIRONMENTS = ['Sandbox', 'Dev', 'QA', 'Production']

function baseUrlFor(environment) {
  if (environment === 'Sandbox') return SELF_BASE_URL
  const key = `API_TEST_${String(environment).toUpperCase()}_BASE_URL`
  return process.env[key] || null
}

// This database has no access-control tables, so approvals live in memory for the session.
const accessStore = {
  users: [
    { id: 'u1', name: 'Divya M.', email: 'divya.m@coactionspecialty.com', team: 'Platform', role: 'Admin', access: 'All APIs', status: 'Active', lastActive: 'Today', expires: 'None', apis: ['Policy Lookup API', 'Quote API'] },
    { id: 'u2', name: 'Jane Smith', email: 'jane.smith@coactionspecialty.com', team: 'Underwriting & Submissions', role: 'API Owner', access: 'Underwriting & Submissions', status: 'Active', lastActive: 'Today', expires: '2026-12-31', apis: ['Appetite Check API', 'Risk Score API', 'Quote API'] },
    { id: 'u3', name: 'John Carter', email: 'john.carter@coactionspecialty.com', team: 'Claims Management', role: 'Developer', access: 'Claims Management', status: 'Active', lastActive: 'Yesterday', expires: 'None', apis: ['FNOL API', 'Claim Status API'] },
    { id: 'u4', name: 'Maria Lopez', email: 'maria.lopez@coactionspecialty.com', team: 'Claims Management', role: 'Developer', access: 'Claims Management', status: 'Suspended', lastActive: '3 weeks ago', expires: '2026-10-15', apis: ['Claim Payment API'] },
    { id: 'u5', name: 'Derek Shaw', email: 'derek.shaw@coactionspecialty.com', team: 'Risk & Exposure', role: 'Analyst', access: 'Read only', status: 'Active', lastActive: 'Today', expires: 'None', apis: ['Loss Run API', 'Reference Data API'] },
  ],
  requests: [
    { id: 'r1', requester: 'Priya Nair', team: 'Accounting & Billing', api: 'Policy Lookup API', accessType: 'Read', risk: 'Low', reason: 'Billing reconciliation needs policy terms.', requestedAt: '2026-09-25', status: 'Pending' },
    { id: 'r2', requester: 'Sam Okafor', team: 'Policy Administration', api: 'Bind API', accessType: 'Write', risk: 'High', reason: 'Automating bind for renewal book.', requestedAt: '2026-09-26', status: 'Pending' },
    { id: 'r3', requester: 'Lena Fischer', team: 'Claims Management', api: 'Claim Reserve API', accessType: 'Write', risk: 'Medium', reason: 'Reserve adjustments from the claims workbench.', requestedAt: '2026-09-27', status: 'Pending' },
  ],
  roles: [
    { role: 'Admin', docs: true, tryIt: true, publish: true, approve: true, admin: true },
    { role: 'API Owner', docs: true, tryIt: true, publish: true, approve: true, admin: false },
    { role: 'Developer', docs: true, tryIt: true, publish: false, approve: false, admin: false },
    { role: 'Analyst', docs: true, tryIt: false, publish: false, approve: false, admin: false },
  ],
  audit: [
    { id: 'a1', when: 'Today 09:12', actor: 'Divya M.', action: 'Ran Try It', target: 'Create Submission API', result: 'Success' },
    { id: 'a2', when: 'Today 08:40', actor: 'Jane Smith', action: 'Published spec', target: 'Quote API', result: 'Success' },
    { id: 'a3', when: 'Yesterday 16:05', actor: 'Divya M.', action: 'Changed user status', target: 'Maria Lopez', result: 'Suspended' },
  ],
}

let auditCounter = accessStore.audit.length

function recordAudit(actor, action, target, result) {
  auditCounter += 1
  accessStore.audit.unshift({ id: `a${auditCounter}`, when: 'Just now', actor, action, target, result })
  accessStore.audit = accessStore.audit.slice(0, 50)
}

function isoDay(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function relativeTime(value) {
  if (!value) return '—'
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// Walks the submission -> quote -> policy -> claim chain from whichever ID was supplied.
async function resolveChain(query, id) {
  const one = async (sql, params) => (await query(sql, params)).rows[0] || null
  const many = async (sql, params) => (await query(sql, params)).rows

  let submission = null
  let quote = null
  let policy = null
  let anchorClaim = null

  if (id.startsWith('SUB-')) {
    submission = await one('SELECT * FROM workbench_submissions WHERE submission_id = $1', [id])
    if (submission) quote = await one('SELECT * FROM workbench_quotes WHERE submission_id = $1 ORDER BY id DESC LIMIT 1', [id])
    if (quote) policy = await one('SELECT * FROM workbench_policies WHERE quote_id = $1', [quote.quote_id])
  } else if (id.startsWith('QTE-')) {
    quote = await one('SELECT * FROM workbench_quotes WHERE quote_id = $1', [id])
    if (quote?.submission_id) submission = await one('SELECT * FROM workbench_submissions WHERE submission_id = $1', [quote.submission_id])
    if (quote) policy = await one('SELECT * FROM workbench_policies WHERE quote_id = $1', [id])
  } else if (id.startsWith('POL-') || id.startsWith('PK')) {
    policy = await one('SELECT * FROM workbench_policies WHERE policy_number = $1', [id])
    if (policy?.quote_id) quote = await one('SELECT * FROM workbench_quotes WHERE quote_id = $1', [policy.quote_id])
    if (quote?.submission_id) submission = await one('SELECT * FROM workbench_submissions WHERE submission_id = $1', [quote.submission_id])
  } else if (id.startsWith('CLM-')) {
    anchorClaim = await one('SELECT * FROM workbench_claims WHERE claim_number = $1', [id])
    if (anchorClaim) policy = await one('SELECT * FROM workbench_policies WHERE policy_number = $1', [anchorClaim.policy_number])
    if (policy?.quote_id) quote = await one('SELECT * FROM workbench_quotes WHERE quote_id = $1', [policy.quote_id])
    if (quote?.submission_id) submission = await one('SELECT * FROM workbench_submissions WHERE submission_id = $1', [quote.submission_id])
  } else if (id.startsWith('ACC-')) {
    policy = await one('SELECT * FROM workbench_policies WHERE account_id = $1 ORDER BY id DESC LIMIT 1', [id])
    if (policy?.quote_id) quote = await one('SELECT * FROM workbench_quotes WHERE quote_id = $1', [policy.quote_id])
    if (quote?.submission_id) submission = await one('SELECT * FROM workbench_submissions WHERE submission_id = $1', [quote.submission_id])
  }

  const exposures = policy ? await many('SELECT * FROM workbench_policy_exposures WHERE policy_number = $1', [policy.policy_number]) : []
  const claims = anchorClaim
    ? [anchorClaim]
    : policy
      ? await many('SELECT * FROM workbench_claims WHERE policy_number = $1 ORDER BY id', [policy.policy_number])
      : []

  const anchor = anchorClaim || policy || quote || submission
  const kind = anchorClaim ? 'Claim' : id.startsWith('POL-') || id.startsWith('PK') || (policy && !id.startsWith('SUB-') && !id.startsWith('QTE-')) ? 'Policy' : quote && id.startsWith('QTE-') ? 'Quote' : 'Submission'
  const title = submission?.insured_name || policy?.insured_name || anchorClaim?.description || 'Traced object'
  const status = anchorClaim?.status || policy?.status || quote?.status || submission?.status || 'Unknown'

  return { anchor, kind, title, status, submission, quote, policy, exposures, claims }
}

async function callsForIds(query, ids) {
  if (!ids.length) return []
  const patterns = ids.map((value) => `%${value}%`)
  const result = await query(
    `
    SELECT api_name, method, path, status_code, duration_ms, user_email, source, called_at, error_message
    FROM api_call_logs
    WHERE path LIKE ANY($1)
       OR request_body::text LIKE ANY($1)
       OR response_body::text LIKE ANY($1)
    ORDER BY id DESC
    LIMIT 40
    `,
    [patterns],
  )
  return result.rows.map((row) => ({
    rawTime: row.called_at,
    time: new Date(row.called_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    day: isoDay(row.called_at),
    dayLabel: new Date(row.called_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    method: row.method,
    path: row.path,
    status: row.status_code,
    ms: row.duration_ms,
    actorKind: row.source === 'portal-try-it' ? 'user' : 'system',
    actor: row.user_email || 'system',
    api: row.api_name,
    note: row.error_message || 'Completed',
  }))
}

function findGaps(chain) {
  const gaps = []
  if (chain.policy && chain.exposures.length === 0) gaps.push('Policy has no exposures recorded')
  if (chain.submission && !chain.quote) gaps.push('Submission never became a quote')
  if (chain.quote && chain.quote.status !== 'BOUND' && !chain.policy) gaps.push('Quote has not been bound')
  for (const claim of chain.claims) {
    if (Number(claim.total_reserve) > 0 && Number(claim.total_paid) === 0) {
      gaps.push(`${claim.claim_number} has reserves but no payments`)
    }
  }
  return gaps
}

// Runs a Try It request against this server's real endpoint and records it in api_call_logs.
function makeExecutor(query, userEmail, environment) {
  return async ({ specId, name, method, path, pathParams, body }) => {
    const startedAt = Date.now()
    const hasBody = body != null && !['GET', 'HEAD'].includes(method)
    const baseUrl = baseUrlFor(environment)
    let status = 0
    let ok = false
    let parsed = null
    let errorMessage = null

    if (!baseUrl) {
      status = 503
      parsed = {
        error: 'ENVIRONMENT_NOT_CONFIGURED',
        message: `No gateway URL is configured for ${environment}. Set API_TEST_${String(environment).toUpperCase()}_BASE_URL to call it.`,
      }
      errorMessage = parsed.message
    } else {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            accept: 'application/json',
            ...(hasBody ? { 'content-type': 'application/json' } : {}),
            'x-consumer-app': 'DeveloperWorkbench',
          },
          body: hasBody ? JSON.stringify(body) : undefined,
        })
        status = response.status
        ok = response.ok
        const text = await response.text()
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {
          parsed = text
        }
        if (!ok) errorMessage = parsed?.message || `Request failed with ${status}`
      } catch (error) {
        status = 502
        parsed = { error: 'UPSTREAM_UNAVAILABLE', message: 'The workbench API did not respond.' }
        errorMessage = error.message
      }
    }

    try {
      await query(
        `
        INSERT INTO api_call_logs (
          api_id, api_name, method, path, environment, source, user_email,
          status_code, duration_ms, request_body, response_body, error_message, called_at
        ) VALUES (
          (SELECT id FROM apis WHERE name = $1 LIMIT 1), $1, $2, $3, $4, $5, $6,
          $7, $8, $9::jsonb, $10::jsonb, $11, $12
        )
        `,
        [
          name,
          method,
          path,
          environment,
          'portal-try-it',
          userEmail,
          status,
          Date.now() - startedAt,
          JSON.stringify({ specId, pathParams, body }),
          JSON.stringify(parsed),
          errorMessage,
          new Date().toISOString(),
        ],
      )
    } catch (logError) {
      console.error('Failed to log Try It call:', logError.message)
    }

    return { status, ok, body: parsed }
  }
}

export function registerUiRoutes(app, { query }) {
  app.get('/api/apis', async (_req, res, next) => {
    try {
      res.json(await listCatalogApis())
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/apis', async (req, res, next) => {
    try {
      res.status(201).json(await writeSpec(req.body || {}))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/assistant/starters', async (_req, res, next) => {
    try {
      res.json({ starters: starterQuestions(await listCatalogApis()) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/assistant', async (req, res, next) => {
    try {
      const { question, context } = req.body || {}
      const apis = await listCatalogApis()
      res.json(await answerQuestion({ question, context }, { apis, baseUrl: SELF_BASE_URL }))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/assistant/request-help', async (req, res, next) => {
    try {
      const apis = await listCatalogApis()
      res.json(requestHelp(req.body || {}, { apis, baseUrl: SELF_BASE_URL }))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tags', async (_req, res, next) => {
    try {
      res.json(listCatalogTags(await listCatalogApis()))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/catalog/source', async (_req, res, next) => {
    try {
      res.json(await catalogSource())
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/catalog/sync', async (_req, res, next) => {
    try {
      res.json(await syncCatalog())
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/catalog/try', async (req, res, next) => {
    try {
      const userEmail = String(req.body?.userEmail || 'divya.m@coactionspecialty.com')
      const environment = ENVIRONMENTS.includes(req.body?.environment) ? req.body.environment : 'Sandbox'
      res.json(await tryOperation(req.body || {}, { execute: makeExecutor(query, userEmail, environment) }))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/environments', (_req, res) => {
    res.json(ENVIRONMENTS.map((name) => ({ name, configured: Boolean(baseUrlFor(name)) })))
  })

  app.get('/api/runs', async (req, res, next) => {
    try {
      const apiName = req.query.api ? String(req.query.api) : null
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50)
      const result = await query(
        `
        SELECT id, api_name, method, path, status_code, duration_ms, environment, user_email, called_at
        FROM api_call_logs
        WHERE ($1::text IS NULL OR api_name = $1)
        ORDER BY id DESC
        LIMIT $2
        `,
        [apiName, limit],
      )
      res.json(result.rows.map((row) => ({
        id: row.id,
        apiName: row.api_name,
        method: row.method,
        path: row.path,
        status: row.status_code,
        durationMs: row.duration_ms,
        environment: row.environment,
        user: row.user_email,
        calledAt: row.called_at,
      })))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/catalog/export/postman', async (req, res, next) => {
    try {
      const domain = req.query.domain && req.query.domain !== 'All' ? String(req.query.domain) : null
      const apis = (await listCatalogApis()).filter((item) => !domain || item.domain === domain)
      const items = []
      for (const item of apis) {
        try {
          const collection = postmanCollection(item.id)
          items.push(...(collection.item || []))
        } catch {
          // Skip specs that cannot be converted rather than failing the whole export.
        }
      }
      res.setHeader('Content-Disposition', 'attachment; filename="coaction-api-catalog.postman_collection.json"')
      res.json({
        info: {
          name: domain ? `CoAction ${domain} APIs` : 'CoAction API Catalog',
          description: `${items.length} endpoints exported from the Developer Workbench.`,
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: items,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/catalog/export/openapi', async (req, res, next) => {
    try {
      const domain = req.query.domain && req.query.domain !== 'All' ? String(req.query.domain) : null
      const apis = (await listCatalogApis()).filter((item) => !domain || item.domain === domain)
      res.setHeader('Content-Disposition', 'attachment; filename="coaction-openapi-specs.json"')
      res.json({
        exportedAt: new Date().toISOString(),
        count: apis.length,
        specs: apis.map((item) => ({ id: item.id, name: item.name, domain: item.domain, spec: specDocument(item.id) })),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/catalog/:specId/openapi', (req, res, next) => {
    try {
      res.json(specDocument(req.params.specId))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/catalog/:specId/postman', (req, res, next) => {
    try {
      const collection = postmanCollection(req.params.specId)
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.specId}.postman_collection.json"`)
      res.json(collection)
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/dashboard', async (_req, res, next) => {
    try {
      const apis = await listCatalogApis()
      const monthStart = new Date()
      monthStart.setUTCDate(1)

      const series = await query(
        `
        SELECT d.day::date AS usage_dt,
               COUNT(l.id)::int AS calls,
               COALESCE(SUM(CASE WHEN l.status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS errors
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
        LEFT JOIN api_call_logs l ON l.called_at::date = d.day::date
        GROUP BY d.day
        ORDER BY d.day
        `,
      )

      const callsByApi = await query(
        `
        SELECT api_name, COUNT(*)::int AS calls
        FROM api_call_logs
        WHERE called_at >= NOW() - INTERVAL '30 days'
        GROUP BY api_name
        `,
      )

      const measured = await query(
        `
        SELECT COUNT(*)::int AS total_calls,
               COUNT(DISTINCT user_email)::int AS consumers,
               COUNT(DISTINCT api_name)::int AS apis_called
        FROM api_call_logs
        WHERE called_at >= NOW() - INTERVAL '30 days'
        `,
      )

      const ownerByApiName = new Map(apis.map((api) => [api.name, api.owner]))
      const ownerTotals = new Map()
      for (const row of callsByApi.rows) {
        const owner = ownerByApiName.get(row.api_name) || 'Unassigned'
        ownerTotals.set(owner, (ownerTotals.get(owner) || 0) + row.calls)
      }

      const lifecycleTotals = new Map()
      for (const api of apis) {
        lifecycleTotals.set(api.lifecycle, (lifecycleTotals.get(api.lifecycle) || 0) + 1)
      }

      res.json({
        totalApis: apis.length,
        publishedCnt: apis.filter((api) => api.lifecycle === 'Published').length,
        consumersCnt: measured.rows[0].consumers,
        totalCalls: measured.rows[0].total_calls,
        apisCalled: measured.rows[0].apis_called,
        addedThisMonthCnt: apis.filter((api) => api.createdAt && new Date(api.createdAt) >= monthStart).length,
        callsByDay: series.rows.map((row) => ({ date: isoDay(row.usage_dt), calls: row.calls, errors: row.errors })),
        topOwners: [...ownerTotals.entries()]
          .map(([owner, calls]) => ({ owner, calls }))
          .sort((a, b) => b.calls - a.calls)
          .slice(0, 4),
        lifecycle: [...lifecycleTotals.entries()]
          .map(([lifecycle, count]) => ({ lifecycle, count }))
          .sort((a, b) => a.lifecycle.localeCompare(b.lifecycle)),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/usage', async (req, res, next) => {
    try {
      const range = RANGE_DAYS[req.query.range] ? req.query.range : '30d'
      const days = RANGE_DAYS[range]
      const apis = await listCatalogApis()

      const stats = await query(
        `
        SELECT api_name,
               COUNT(*)::int AS calls,
               COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS errors,
               COALESCE(ROUND(AVG(duration_ms)), 0)::int AS latency,
               COUNT(DISTINCT user_email)::int AS consumers
        FROM api_call_logs
        WHERE called_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY api_name
        `,
        [days],
      )

      const distinct = await query(
        `
        SELECT COUNT(DISTINCT user_email)::int AS consumers
        FROM api_call_logs
        WHERE called_at >= NOW() - ($1::int * INTERVAL '1 day')
        `,
        [days],
      )

      const statsByName = new Map(stats.rows.map((row) => [row.api_name, row]))
      const rows = apis.map((api) => {
        const stat = statsByName.get(api.name)
        return {
          name: api.name,
          owner: api.owner,
          type: api.type,
          lifecycle: api.lifecycle,
          domain: api.domain,
          consumers: stat?.consumers || 0,
          calls: stat?.calls || 0,
          errors: stat?.errors || 0,
          latency: stat?.latency || 0,
        }
      }).sort((a, b) => b.calls - a.calls)

      const totals = rows.reduce(
        (sum, row) => {
          sum.calls += row.calls
          sum.errors += row.errors
          sum.latencyWeight += row.latency * row.calls
          return sum
        },
        { calls: 0, errors: 0, latencyWeight: 0 },
      )

      res.json({
        range,
        totals: {
          calls: totals.calls,
          errors: totals.errors,
          errorRate: totals.calls ? totals.errors / totals.calls : 0,
          avgLatency: totals.calls ? Math.round(totals.latencyWeight / totals.calls) : 0,
          consumers: distinct.rows[0].consumers,
        },
        apis: rows,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/access', (_req, res) => {
    res.json({
      summary: {
        activeUsers: accessStore.users.filter((user) => user.status === 'Active').length,
        pendingRequests: accessStore.requests.filter((item) => item.status === 'Pending').length,
        privilegedUsers: accessStore.users.filter((user) => user.role === 'Admin' || user.role === 'API Owner').length,
        expiringAccess: accessStore.users.filter((user) => user.expires !== 'None').length,
      },
      users: accessStore.users,
      requests: accessStore.requests,
      roles: accessStore.roles,
      audit: accessStore.audit,
    })
  })

  app.post('/api/access/users/:userKey/status', (req, res) => {
    const user = accessStore.users.find((item) => item.id === req.params.userKey)
    const status = String(req.body?.status || '')
    if (!user || !['Active', 'Suspended'].includes(status)) {
      res.status(400).json({ message: 'Check the required fields and try again.' })
      return
    }
    user.status = status
    recordAudit('Divya M.', 'Changed user status', user.name, status)
    res.json({ ok: true, status })
  })

  app.post('/api/access/requests/:requestKey/decision', (req, res) => {
    const request = accessStore.requests.find((item) => item.id === req.params.requestKey)
    const decision = String(req.body?.decision || '')
    if (!request || request.status !== 'Pending' || !['Approved', 'Denied'].includes(decision)) {
      res.status(400).json({ message: 'Check the required fields and try again.' })
      return
    }
    request.status = decision
    recordAudit('Divya M.', 'Decided access request', `${request.api} - ${request.requester}`, decision)
    res.json({ ok: true, status: decision })
  })

  app.get('/api/traces', async (_req, res, next) => {
    try {
      // Sample chips list policies only; the resolver still handles any ID typed in.
      const policies = await query('SELECT policy_number, insured_name, status FROM workbench_policies ORDER BY id DESC LIMIT 8')
      res.json(policies.rows.map((row) => ({ id: row.policy_number, kind: 'Policy', title: row.insured_name, status: row.status })))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/traces/:objectBk', async (req, res, next) => {
    try {
      const id = String(req.params.objectBk).trim().toUpperCase()
      const chain = await resolveChain(query, id)
      if (!chain.anchor) {
        res.status(404).json({ message: `No submission, quote, policy, or claim found for ${id}.` })
        return
      }

      const relatedIds = [
        chain.submission?.submission_id,
        chain.quote?.quote_id,
        chain.policy?.policy_number,
        ...chain.claims.map((claim) => claim.claim_number),
      ].filter(Boolean)

      const events = await callsForIds(query, relatedIds)

      // Demo: surface an automatic error+retry on the default sample policy so
      // the Policy Trace timeline can show its error/retry flow.
      if (id === 'PK202700023245' && events.length) {
        const anchor = events[0]
        const bindPath = `/api/v1/policies/${chain.policy?.policy_number || id}/bind`
        const failedBind = { ...anchor, api: 'Bind API', method: 'POST', path: bindPath, status: 504, ms: 5000, actorKind: 'system', actor: 'system', note: 'Policy Admin didn’t respond within 5 s' }
        const retriedBind = { ...failedBind, status: 200, ms: 640, note: 'Completed on the first retry' }
        events.splice(1, 0, failedBind, retriedBind)
      }

      const money = (value) => Number(value || 0)
      const paid = chain.claims.reduce((sum, claim) => sum + money(claim.total_paid), 0)
      const reserve = chain.claims.reduce((sum, claim) => sum + money(claim.total_reserve), 0)
      const premium = money(chain.policy?.written_premium)

      const fields = {}
      if (chain.submission) fields.Submission = chain.submission.submission_id
      if (chain.quote) fields.Quote = `${chain.quote.quote_id} (${chain.quote.status})`
      if (chain.policy) fields.Policy = `${chain.policy.policy_number} (${chain.policy.status})`
      if (chain.policy?.account_id) fields.Account = chain.policy.account_id
      if (chain.exposures.length) fields.Exposures = `${chain.exposures.length} location(s)`
      if (chain.claims.length) fields.Claims = chain.claims.map((claim) => claim.claim_number).join(', ')
      if (premium) fields['Written premium'] = premium.toLocaleString()
      if (paid || reserve) {
        fields.Paid = paid.toLocaleString()
        fields.Reserve = reserve.toLocaleString()
        fields.Incurred = (paid + reserve).toLocaleString()
      }
      if (premium && paid + reserve) fields['Loss ratio'] = `${Math.round(((paid + reserve) / premium) * 100)}%`

      const warnings = findGaps(chain)

      const first = events[events.length - 1]
      res.json({
        id,
        kind: chain.kind,
        title: chain.title,
        status: chain.status,
        openedAgo: first ? relativeTime(first.rawTime) : '—',
        openedBy: first ? first.actor : '—',
        fields,
        warnings,
        failures: events.filter((event) => event.status >= 400).length,
        events: events.map(({ rawTime, ...event }) => event),
      })
    } catch (error) {
      next(error)
    }
  })
}
