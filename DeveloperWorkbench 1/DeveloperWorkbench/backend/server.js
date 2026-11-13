import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { catalogSource, listCatalogApis, listCatalogTags, postmanCollection, syncCatalog, tryOperation, writeSpec } from './catalog.js'
import { ensureSchema, query } from './db.js'
import { seedDatabase } from './seed.js'

const PORT = Number(process.env.PORT || 8787)
const LIST_LIMIT = 200
const ranges = { '7d': 7, '30d': 30, '90d': 90 }
const hits = new Map()

const createApiSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(40),
  domain: z.string().trim().min(1).max(80),
  owner: z.string().trim().min(1).max(120),
  desc: z.string().trim().max(2000).optional().default(''),
  endpoint: z.string().trim().max(300).optional().default(''),
  version: z.string().trim().max(40).optional().default('v1.0'),
  lifecycle: z.enum(['Draft', 'Published', 'Deprecated']).optional().default('Draft'),
  environment: z.enum(['Development', 'QA', 'Production']).optional().default('QA'),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
  sampleRequest: z.unknown().optional(),
  sampleResponse: z.unknown().optional(),
}).strict()

const downloadSchema = z.object({
  artifact: z.string().trim().min(1).max(200),
  apiId: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  by: z.string().trim().min(1).max(120).optional().default('You'),
}).strict()

const trySchema = z.object({
  specId: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  mode: z.enum(['sandbox', 'live']).optional().default('sandbox'),
  pathParams: z.record(z.string().max(80), z.string().max(200)).optional().default({}),
  body: z.unknown().optional(),
}).strict()

const statusSchema = z.object({
  status: z.enum(['Active', 'Suspended', 'Pending']),
}).strict()

const decisionSchema = z.object({
  decision: z.enum(['Approved', 'Denied']),
}).strict()

function day(value) {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const date = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${month}-${date}`
  }
  return String(value).slice(0, 10)
}

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function splitEndpoint(endpoint) {
  const match = String(endpoint || '').trim().match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i)
  if (!match) return { method: 'GET', path: String(endpoint || '').trim() }
  return { method: match[1].toUpperCase(), path: match[2] }
}

function jsonValue(value) {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw fail(400, 'Check the required fields and try again.')
  return JSON.stringify(value).slice(0, 20000)
}

function rateLimit(req, res, next) {
  const key = req.ip || 'local'
  const now = Date.now()
  const bucket = (hits.get(key) || []).filter((time) => now - time < 60_000)
  if (bucket.length >= 60) {
    res.status(429).json({ message: 'Unable to process request' })
    return
  }
  bucket.push(now)
  hits.set(key, bucket)
  next()
}

function groupBy(rows, key) {
  const grouped = new Map()
  for (const row of rows) {
    const id = row[key]
    if (!grouped.has(id)) grouped.set(id, [])
    grouped.get(id).push(row)
  }
  return grouped
}

function shapeApi(row, tags, sample, explanations, document, fields, changelog) {
  const schema = { pathParameters: [], request: [], response: [] }
  for (const field of fields || []) {
    const item = {
      name: field.field_name,
      type: field.field_type,
      required: field.required_flag,
      description: field.description,
      example: field.example,
    }
    if (field.section === 'path') schema.pathParameters.push(item)
    if (field.section === 'request') schema.request.push(item)
    if (field.section === 'response') schema.response.push(item)
  }
  const explanationMap = {}
  for (const item of explanations || []) {
    explanationMap[item.audience] = {
      summary: item.summary,
      evaluates: item.evaluates_json || [],
      returns: item.returns_json || [],
    }
  }
  return {
    id: row.api_key,
    name: row.name,
    desc: row.description,
    endpoint: row.endpoint,
    method: row.http_method,
    path: row.path,
    domain: row.domain,
    type: row.api_type,
    version: row.version,
    lifecycle: row.lifecycle,
    tags: (tags || []).map((tag) => tag.tag_name),
    owner: row.owner,
    consumers: row.consumers_cnt,
    testTool: row.test_tool,
    calls: row.calls_label,
    latency: row.latency_label,
    errorRate: row.error_rate_label,
    errorLevel: row.error_level,
    trend: row.trend_label,
    trendLevel: row.trend_level,
    environment: row.environment,
    sampleRequest: sample?.request_json ?? null,
    sampleResponse: sample?.response_json ?? null,
    explanations: explanationMap,
    document: document
      ? {
          purpose: document.purpose,
          whenToUse: document.when_to_use,
          notes: document.notes_json || [],
          errors: document.errors_json || [],
          owner: row.owner,
        }
      : null,
    schema,
    changelog: (changelog || []).map((item) => ({
      date: day(item.change_dt),
      version: item.version,
      type: item.change_type,
      title: item.title,
      description: item.description,
      impact: item.impact,
      action: item.developer_action,
      owner: item.owner,
    })),
    createdAt: row.created_at,
  }
}

async function loadApis() {
  const apis = await query('SELECT * FROM workbench.api ORDER BY api_key ASC LIMIT $1', [LIST_LIMIT])
  const keys = apis.rows.map((row) => row.api_key)
  if (!keys.length) return []
  const [tags, samples, explanations, documents, fields, changelog] = await Promise.all([
    query('SELECT api_key, tag_name FROM workbench.api_tag WHERE api_key = ANY($1::int[]) ORDER BY tag_name', [keys]),
    query('SELECT * FROM workbench.api_sample WHERE api_key = ANY($1::int[])', [keys]),
    query('SELECT * FROM workbench.api_explanation WHERE api_key = ANY($1::int[]) ORDER BY audience', [keys]),
    query('SELECT * FROM workbench.api_document WHERE api_key = ANY($1::int[])', [keys]),
    query('SELECT * FROM workbench.api_schema_field WHERE api_key = ANY($1::int[]) ORDER BY sort_order', [keys]),
    query('SELECT * FROM workbench.api_changelog WHERE api_key = ANY($1::int[]) ORDER BY change_dt DESC', [keys]),
  ])
  const tagsByApi = groupBy(tags.rows, 'api_key')
  const sampleByApi = new Map(samples.rows.map((row) => [row.api_key, row]))
  const explanationByApi = groupBy(explanations.rows, 'api_key')
  const documentByApi = new Map(documents.rows.map((row) => [row.api_key, row]))
  const fieldsByApi = groupBy(fields.rows, 'api_key')
  const changelogByApi = groupBy(changelog.rows, 'api_key')
  return apis.rows.map((row) => shapeApi(
    row,
    tagsByApi.get(row.api_key),
    sampleByApi.get(row.api_key),
    explanationByApi.get(row.api_key),
    documentByApi.get(row.api_key),
    fieldsByApi.get(row.api_key),
    changelogByApi.get(row.api_key),
  ))
}

async function recordAudit(actor, action, target, result) {
  await query(
    `INSERT INTO workbench.audit_event (occurred_label, actor, action, target, result)
     VALUES ('Just now', $1, $2, $3, $4)`,
    [actor, action, target, result],
  )
}

function buildApp() {
  const app = express()
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  app.disable('x-powered-by')
  app.use(cors({ origin: origins, methods: ['GET', 'POST'] }))
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', async (_req, res, next) => {
    try {
      const result = await query(
        `SELECT current_database() AS database, (SELECT COUNT(*)::int FROM workbench.api) AS apis`,
      )
      res.json({ ok: true, schema: 'workbench', ...result.rows[0] })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/dashboard', async (_req, res, next) => {
    try {
      const [summary, series, owners, lifecycle] = await Promise.all([
        query(`
          SELECT
            COUNT(*)::int AS total_apis,
            COUNT(*) FILTER (WHERE lifecycle = 'Published')::int AS published_cnt,
            COALESCE(SUM(consumers_cnt), 0)::int AS consumers_cnt,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS added_this_month_cnt
          FROM workbench.api
        `),
        query(`
          WITH anchor AS (SELECT MAX(usage_dt) AS end_dt FROM workbench.usage_daily)
          SELECT usage_dt, SUM(call_cnt)::int AS calls, SUM(error_cnt)::int AS errors
          FROM workbench.usage_daily
          WHERE usage_dt >= (SELECT end_dt FROM anchor) - 29
          GROUP BY usage_dt
          ORDER BY usage_dt
        `),
        query(`
          WITH anchor AS (SELECT MAX(usage_dt) AS end_dt FROM workbench.usage_daily)
          SELECT a.owner, SUM(u.call_cnt)::int AS calls
          FROM workbench.usage_daily u
          JOIN workbench.api a ON a.api_key = u.api_key
          WHERE u.usage_dt >= (SELECT end_dt FROM anchor) - 29
          GROUP BY a.owner
          ORDER BY calls DESC
          LIMIT 4
        `),
        query(`
          SELECT lifecycle, COUNT(*)::int AS count
          FROM workbench.api
          GROUP BY lifecycle
          ORDER BY lifecycle
        `),
      ])
      const row = summary.rows[0]
      res.json({
        totalApis: row.total_apis,
        publishedCnt: row.published_cnt,
        consumersCnt: row.consumers_cnt,
        addedThisMonthCnt: row.added_this_month_cnt,
        callsByDay: series.rows.map((item) => ({
          date: day(item.usage_dt),
          calls: item.calls,
          errors: item.errors,
        })),
        topOwners: owners.rows,
        lifecycle: lifecycle.rows,
      })
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

  app.post('/api/catalog/sync', rateLimit, async (_req, res, next) => {
    try {
      res.json(await syncCatalog())
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/apis', async (_req, res, next) => {
    try {
      res.json(await listCatalogApis())
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/apis', rateLimit, async (req, res, next) => {
    try {
      const payload = createApiSchema.parse(req.body || {})
      const created = await writeSpec(payload)
      res.status(201).json(created)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/catalog/try', rateLimit, async (req, res, next) => {
    try {
      const payload = trySchema.parse(req.body || {})
      if (payload.body != null && JSON.stringify(payload.body).length > 100_000) {
        throw fail(400, 'Check the required fields and try again.')
      }
      res.json(await tryOperation(payload))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/catalog/:specId/postman', async (req, res, next) => {
    try {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.params.specId)) throw fail(400, 'Check the required fields and try again.')
      const collection = postmanCollection(req.params.specId)
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.specId}.postman_collection.json"`)
      res.json(collection)
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


  app.get('/api/downloads', async (_req, res, next) => {
    try {
      const result = await query(`
        SELECT d.artifact_name, COALESCE(a.name, d.api_name, d.spec_id) AS api_name, d.downloaded_by, d.created_at
        FROM workbench.download d
        LEFT JOIN workbench.api a ON a.api_key = d.api_key
        ORDER BY d.created_at DESC
        LIMIT 20
      `)
      res.json(result.rows.map((row) => ({
        artifact: row.artifact_name,
        api: row.api_name,
        by: row.downloaded_by,
        date: row.created_at,
      })))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/downloads', rateLimit, async (req, res, next) => {
    try {
      const payload = downloadSchema.parse(req.body || {})
      const apis = await listCatalogApis()
      const api = apis.find((item) => item.id === payload.apiId)
      if (!api) throw fail(400, 'Check the required fields and try again.')
      const createdAt = new Date().toISOString()
      await query(
        `INSERT INTO workbench.download (api_key, spec_id, api_name, artifact_name, downloaded_by, created_at)
         VALUES (NULL, $1, $2, $3, $4, $5)`,
        [payload.apiId, api.name, payload.artifact, payload.by, createdAt],
      )
      res.status(201).json({
        artifact: payload.artifact,
        api: api.name,
        by: payload.by,
        date: createdAt,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/access', async (_req, res, next) => {
    try {
      const [users, access, roles, requests, audit] = await Promise.all([
        query('SELECT * FROM workbench.app_user ORDER BY name LIMIT $1', [LIST_LIMIT]),
        query(`
          SELECT x.user_key, a.name
          FROM workbench.user_api_access x
          JOIN workbench.api a ON a.api_key = x.api_key
          ORDER BY a.name
        `),
        query('SELECT * FROM workbench.role_permission ORDER BY role_name'),
        query('SELECT * FROM workbench.access_request ORDER BY request_key LIMIT $1', [LIST_LIMIT]),
        query('SELECT * FROM workbench.audit_event ORDER BY audit_key DESC LIMIT 50'),
      ])
      const apisByUser = groupBy(access.rows, 'user_key')
      const shapedUsers = users.rows.map((user) => ({
        id: user.user_key,
        name: user.name,
        email: user.email,
        team: user.team,
        role: user.role_name,
        access: user.access_scope,
        status: user.status,
        lastActive: user.last_active,
        expires: user.expires_on,
        apis: (apisByUser.get(user.user_key) || []).map((item) => item.name),
      }))
      res.json({
        summary: {
          activeUsers: shapedUsers.filter((user) => user.status === 'Active').length,
          pendingRequests: requests.rows.filter((item) => item.status === 'Pending').length,
          privilegedUsers: shapedUsers.filter((user) => user.role === 'Admin' || user.role === 'API Owner').length,
          expiringAccess: shapedUsers.filter((user) => user.expires !== 'None').length,
        },
        users: shapedUsers,
        requests: requests.rows.map((item) => ({
          id: item.request_key,
          requester: item.requester,
          team: item.team,
          api: item.api_name,
          accessType: item.access_type,
          risk: item.risk,
          reason: item.reason,
          requestedAt: item.requested_at,
          status: item.status,
        })),
        roles: roles.rows.map((role) => ({
          role: role.role_name,
          docs: role.docs,
          tryIt: role.try_it,
          publish: role.publish,
          approve: role.approve,
          admin: role.admin_access,
        })),
        audit: audit.rows.map((event) => ({
          id: event.audit_key,
          when: event.occurred_label,
          actor: event.actor,
          action: event.action,
          target: event.target,
          result: event.result,
        })),
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/access/users/:userKey/status', rateLimit, async (req, res, next) => {
    try {
      if (!/^u\d{1,6}$/.test(req.params.userKey)) throw fail(400, 'Check the required fields and try again.')
      const payload = statusSchema.parse(req.body || {})
      const updated = await query(
        `UPDATE workbench.app_user SET status = $1 WHERE user_key = $2 RETURNING name, status`,
        [payload.status, req.params.userKey],
      )
      if (!updated.rows[0]) throw fail(400, 'Check the required fields and try again.')
      await recordAudit('Divya M.', 'Changed user status', updated.rows[0].name, payload.status)
      res.json({ ok: true, status: updated.rows[0].status })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/access/requests/:requestKey/decision', rateLimit, async (req, res, next) => {
    try {
      if (!/^r\d{1,6}$/.test(req.params.requestKey)) throw fail(400, 'Check the required fields and try again.')
      const payload = decisionSchema.parse(req.body || {})
      const updated = await query(
        `UPDATE workbench.access_request
         SET status = $1
         WHERE request_key = $2 AND status = 'Pending'
         RETURNING requester, api_name, status`,
        [payload.decision, req.params.requestKey],
      )
      if (!updated.rows[0]) throw fail(400, 'Check the required fields and try again.')
      await recordAudit('Divya M.', 'Decided access request', `${updated.rows[0].api_name} - ${updated.rows[0].requester}`, payload.decision)
      res.json({ ok: true, status: updated.rows[0].status })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/usage', async (req, res, next) => {
    try {
      const range = ranges[req.query.range] ? req.query.range : '30d'
      const days = ranges[range]
      const byApi = await query(`
        WITH anchor AS (SELECT MAX(usage_dt) AS end_dt FROM workbench.usage_daily)
        SELECT a.name, a.owner, a.api_type, a.lifecycle, a.domain, a.consumers_cnt,
               COALESCE(SUM(u.call_cnt), 0)::int AS calls,
               COALESCE(SUM(u.error_cnt), 0)::int AS errors,
               COALESCE(ROUND(SUM(u.latency_ms * u.call_cnt)::numeric / NULLIF(SUM(u.call_cnt), 0)), 0)::int AS latency
        FROM workbench.api a
        LEFT JOIN workbench.usage_daily u
          ON u.api_key = a.api_key
         AND u.usage_dt >= (SELECT end_dt FROM anchor) - ($1::int - 1)
         AND u.usage_dt <= (SELECT end_dt FROM anchor)
        GROUP BY a.api_key
        ORDER BY calls DESC
        LIMIT $2
      `, [days, LIST_LIMIT])
      const totals = byApi.rows.reduce((sum, row) => {
        sum.calls += row.calls
        sum.errors += row.errors
        sum.latencyWeight += row.latency * row.calls
        sum.consumers += row.consumers_cnt
        return sum
      }, { calls: 0, errors: 0, latencyWeight: 0, consumers: 0 })
      res.json({
        range,
        totals: {
          calls: totals.calls,
          errors: totals.errors,
          errorRate: totals.calls ? totals.errors / totals.calls : 0,
          avgLatency: totals.calls ? Math.round(totals.latencyWeight / totals.calls) : 0,
          consumers: totals.consumers,
        },
        apis: byApi.rows.map((row) => ({
          name: row.name,
          owner: row.owner,
          type: row.api_type,
          lifecycle: row.lifecycle,
          domain: row.domain,
          consumers: row.consumers_cnt,
          calls: row.calls,
          errors: row.errors,
          latency: row.latency,
        })),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/traces', async (_req, res, next) => {
    try {
      const result = await query(`
        SELECT object_bk, kind, title, status
        FROM workbench.trace_object
        ORDER BY object_bk
        LIMIT $1
      `, [LIST_LIMIT])
      res.json(result.rows.map((row) => ({
        id: row.object_bk,
        kind: row.kind,
        title: row.title,
        status: row.status,
      })))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/traces/:objectBk', async (req, res, next) => {
    try {
      const objectBk = String(req.params.objectBk || '').toUpperCase()
      if (!/^[A-Z]{3}-\d{4}-\d{1,12}$/.test(objectBk)) throw fail(400, 'Check the required fields and try again.')
      const trace = await query('SELECT * FROM workbench.trace_object WHERE object_bk = $1', [objectBk])
      if (!trace.rows[0]) {
        res.status(404).json({ message: 'No trace found.' })
        return
      }
      const [events, relations] = await Promise.all([
        query('SELECT * FROM workbench.trace_event WHERE object_bk = $1 ORDER BY seq', [objectBk]),
        query('SELECT related_bk, relation FROM workbench.trace_relation WHERE object_bk = $1 ORDER BY related_bk', [objectBk]),
      ])
      const row = trace.rows[0]
      res.json({
        id: row.object_bk,
        kind: row.kind,
        title: row.title,
        status: row.status,
        statusColor: row.status_color,
        openedAgo: row.opened_ago,
        openedBy: row.opened_by,
        fields: row.fields_json || {},
        related: relations.rows.map((item) => ({ id: item.related_bk, relation: item.relation })),
        events: events.rows.map((event) => ({
          time: event.event_time,
          api: event.api_name,
          method: event.http_method,
          path: event.path,
          status: event.status_code,
          ms: event.duration_ms,
          actor: event.actor_name,
          actorKind: event.actor_kind,
          note: event.note,
        })),
      })
    } catch (error) {
      next(error)
    }
  })

  const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
  if (fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, fallthrough: true }))
    app.get(/^\/(?!api\/).*/, (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      res.sendFile(path.join(staticDir, 'index.html'), (error) => {
        if (error) next(error)
      })
    })
  }

  app.use((error, _req, res, _next) => {
    if (error.expose) {
      res.status(error.status || 400).json({ message: String(error.message).slice(0, 300) })
      return
    }
    if (error instanceof z.ZodError || error.status === 400) {
      res.status(400).json({ message: 'Check the required fields and try again.' })
      return
    }
    console.error('Request failed:', error.message)
    res.status(error.status || 500).json({ message: 'Unable to process request' })
  })

  return app
}

async function startServer() {
  await ensureSchema()
  await query('ALTER TABLE workbench.download ALTER COLUMN api_key DROP NOT NULL')
  await query('ALTER TABLE workbench.download ADD COLUMN IF NOT EXISTS spec_id TEXT')
  await query('ALTER TABLE workbench.download ADD COLUMN IF NOT EXISTS api_name TEXT')
  await query('DROP TABLE IF EXISTS public.downloads')
  await query('DROP TABLE IF EXISTS public.apis')
  await seedDatabase()
  const app = buildApp()
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`)
    console.log('Schema: workbench')
    console.log(`Database: ${process.env.DB_NAME}`)
  })
}

startServer().catch((error) => {
  console.error('Backend startup failed:', error)
  process.exit(1)
})
