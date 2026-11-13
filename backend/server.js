import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { apis as seedApis } from '../src/data/apis.js'
import { samplePayloads } from '../src/data/samplePayloads.js'
import cookieParser from 'cookie-parser'
import { registerUiRoutes } from './uiRoutes.js'
import { ensureCatalogSourcesSchema, registerCatalogSourceRoutes } from './azureDevOps.js'
import { registerAuthRoutes, ensureAuthSchema } from './auth.js'

const PORT = Number(process.env.PORT || 8787)
const DB_SCHEMA = process.env.DB_SCHEMA || 'public'
const TEST_REQUEST_TIMEOUT_MS = Number(process.env.API_TEST_TIMEOUT_MS || 10000)

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
})

async function withClient(work) {
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${DB_SCHEMA}`)
    return await work(client)
  } finally {
    client.release()
  }
}

async function query(sql, params = []) {
  return withClient((client) => client.query(sql, params))
}

async function tryDownloadInsert(payload, createdAt) {
  const attempts = [
    {
      sql: 'INSERT INTO downloads (download_id, api_id, artifact_name, downloaded_by, created_at) VALUES ($1, $2, $3, $4, $5)',
      params: [payload.downloadId, payload.apiId, payload.artifact, payload.by, createdAt],
    },
    {
      sql: 'INSERT INTO downloads (artifact, api_name, downloaded_by, created_at) VALUES ($1, $2, $3, $4)',
      params: [payload.artifact, payload.api, payload.by, createdAt],
    },
    {
      sql: 'INSERT INTO downloads (artifact_name, api_name, downloaded_by, created_at) VALUES ($1, $2, $3, $4)',
      params: [payload.artifact, payload.api, payload.by, createdAt],
    },
    {
      sql: 'INSERT INTO downloads (artifact, api, downloaded_by, created_at) VALUES ($1, $2, $3, $4)',
      params: [payload.artifact, payload.api, payload.by, createdAt],
    },
    {
      sql: 'INSERT INTO downloads (artifact_name, api, downloaded_by, created_at) VALUES ($1, $2, $3, $4)',
      params: [payload.artifact, payload.api, payload.by, createdAt],
    },
  ]

  let lastError = null
  for (const attempt of attempts) {
    try {
      await query(attempt.sql, attempt.params)
      return
    } catch (error) {
      console.error('Download insert attempt failed:', error.message)
      lastError = error
    }
  }

  throw lastError
}

function formatApiRow(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.desc || row.description,
    endpoint: row.endpoint,
    domain: row.domain,
    type: row.type,
    version: row.version,
    lifecycle: row.lifecycle,
    tags: row.tags_json || [],
    owner: row.owner,
    consumers: Number(row.consumers || 0),
    testTool: row.test_tool,
    artifacts: row.artifacts_json || [],
    calls: row.calls,
    latency: row.latency,
    errorRate: row.error_rate,
    errorLevel: row.error_level,
    trend: row.trend,
    trendLevel: row.trend_level,
    sampleRequest: row.sample_request || null,
    sampleResponse: row.sample_response || null,
    createdAt: row.created_at,
  }
}

async function tryApiInsert(payload, createdAt) {
  const updatedAt = createdAt
  const publishedAt = createdAt
  const slug = String(payload.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const sampleRequestJson = payload.sampleRequest ? JSON.stringify(payload.sampleRequest) : null
  const sampleResponseJson = payload.sampleResponse ? JSON.stringify(payload.sampleResponse) : null
  const tagsFromString =
    typeof payload.tags === 'string'
      ? payload.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : Array.isArray(payload.tags)
      ? payload.tags
      : []

  const attempts = [
    {
      sql: `
        INSERT INTO apis (
          api_id, name, version, lifecycle, type, description,
          owner, consumers, status, published, endpoint,
          environment, restricted, tags_json, sample_request, sample_response,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14::jsonb, $15::jsonb, $16::jsonb,
          $17, $18
        )
        RETURNING *
      `,
      params: [
        `${slug || 'new-api'}-${(payload.environment || 'qa').toLowerCase()}`,
        String(payload.name),
        String(payload.version || 'v1.0.0'),
        String(payload.lifecycle || 'Published'),
        String(payload.type),
        String(payload.desc || 'Published from Upload API workflow.'),
        String(payload.owner),
        Number(payload.consumers || 0),
        'Active',
        publishedAt,
        String(payload.endpoint || ''),
        String(payload.environment || 'QA'),
        false,
        JSON.stringify(tagsFromString),
        sampleRequestJson,
        sampleResponseJson,
        createdAt,
        updatedAt,
      ],
    },
    {
      sql: `
        INSERT INTO apis (
          name, desc, endpoint, domain, type, version, lifecycle,
          tags_json, owner, consumers, test_tool, artifacts_json,
          calls, latency, error_rate, error_level, trend, trend_level,
          sample_request, sample_response, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9, $10, $11, $12::jsonb,
          $13, $14, $15, $16, $17, $18,
          $19::jsonb, $20::jsonb, $21
        )
        RETURNING *
      `,
      params: [
        String(payload.name),
        String(payload.desc || 'Published from Upload API workflow.'),
        String(payload.endpoint || ''),
        String(payload.domain),
        String(payload.type),
        String(payload.version || 'v1.0.0'),
        payload.lifecycle || null,
        JSON.stringify(tagsFromString),
        String(payload.owner),
        Number(payload.consumers || 0),
        String(payload.testTool || 'Swagger'),
        JSON.stringify(payload.artifacts || []),
        String(payload.calls || '0'),
        String(payload.latency || '--'),
        String(payload.errorRate || '--'),
        String(payload.errorLevel || 'muted'),
        String(payload.trend || 'new'),
        String(payload.trendLevel || 'muted'),
        sampleRequestJson,
        sampleResponseJson,
        createdAt,
      ],
    },
  ]

  let lastError = null
  for (const attempt of attempts) {
    try {
      const result = await query(attempt.sql, attempt.params)
      return result.rows[0]
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

function formatDownloadRow(row) {
  return {
    artifact: row.artifact_name || row.artifact || row.artifact_label || '—',
    api: row.api_name || row.api || row.api_label || '—',
    by: row.downloaded_by || row.by || row.user_name || 'User',
    date: row.created_at || row.date || new Date().toISOString(),
  }
}

function validateSubmissionPayload(payload) {
  const errors = []
  const text = (value) => (typeof value === 'string' ? value.trim() : '')

  const brokerId = text(payload.brokerId)
  const insuredName = text(payload.insuredName)
  const lineOfBusiness = text(payload.lineOfBusiness)
  const effectiveDate = text(payload.effectiveDate)

  if (!brokerId) errors.push({ field: 'brokerId', message: 'brokerId is required.' })
  if (!insuredName) errors.push({ field: 'insuredName', message: 'insuredName is required.' })
  if (!lineOfBusiness) errors.push({ field: 'lineOfBusiness', message: 'lineOfBusiness is required.' })

  if (!effectiveDate) {
    errors.push({ field: 'effectiveDate', message: 'effectiveDate is required.' })
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || Number.isNaN(Date.parse(effectiveDate))) {
    errors.push({ field: 'effectiveDate', message: 'effectiveDate must be a valid YYYY-MM-DD date.' })
  }

  let annualRevenue = null
  if (payload.annualRevenue !== undefined && payload.annualRevenue !== null && payload.annualRevenue !== '') {
    annualRevenue = Number(payload.annualRevenue)
    if (!Number.isFinite(annualRevenue) || annualRevenue < 0) {
      errors.push({ field: 'annualRevenue', message: 'annualRevenue must be a non-negative number.' })
      annualRevenue = null
    }
  }

  let states = []
  if (!Array.isArray(payload.states) || payload.states.length === 0) {
    errors.push({ field: 'states', message: 'states must be a non-empty array of state codes.' })
  } else {
    states = payload.states.map((entry) => text(entry).toUpperCase()).filter(Boolean)
    if (states.length !== payload.states.length) {
      errors.push({ field: 'states', message: 'states must contain only non-empty state codes.' })
    }
  }

  return {
    errors,
    value: { brokerId, insuredName, lineOfBusiness, effectiveDate, annualRevenue, states },
  }
}

function submissionPriority(annualRevenue) {
  if (annualRevenue >= 20000000) return 'HIGH'
  if (annualRevenue >= 5000000) return 'MEDIUM'
  return 'LOW'
}

async function nextSequenceValue(sequenceName) {
  const result = await query(`SELECT nextval('public.${sequenceName}') AS seq`)
  return result.rows[0].seq
}

function isoInstant(value) {
  return value ? new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z') : null
}

function isoDate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function shiftDate(value, { days = 0, years = 0 }) {
  const base = new Date(`${isoDate(value)}T00:00:00Z`)
  if (years) base.setUTCFullYear(base.getUTCFullYear() + years)
  if (days) base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function money(value) {
  return value === null || value === undefined ? null : Number(value)
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function notFound(res, message) {
  res.status(404).json({ error: 'NOT_FOUND', message })
}

function validationFailed(res, details) {
  res.status(400).json({
    error: 'VALIDATION_FAILED',
    message: 'One or more request fields are invalid.',
    details,
  })
}

function serverError(res, error, label) {
  console.error(`${label}:`, error)
  res.status(500).json({ error: 'REQUEST_FAILED', message: label })
}

async function createSubmission(value) {
  const submissionId = `SUB-${new Date().getFullYear()}-${await nextSequenceValue('workbench_submission_seq')}`

  const inserted = await query(
    `
    INSERT INTO workbench_submissions (
      submission_id, broker_id, insured_name, line_of_business,
      effective_date, annual_revenue, states, status, underwriter, priority
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
    RETURNING submission_id, status, created_at
    `,
    [
      submissionId,
      value.brokerId,
      value.insuredName,
      value.lineOfBusiness,
      value.effectiveDate,
      value.annualRevenue,
      JSON.stringify(value.states),
      'RECEIVED',
      'Unassigned',
      submissionPriority(Number(value.annualRevenue) || 0),
    ],
  )

  const row = inserted.rows[0]
  return {
    submissionId: row.submission_id,
    status: row.status,
    createdDate: isoInstant(row.created_at),
  }
}

function defaultPathParameterValue(api, parameterName) {
  const lowerName = String(parameterName).toLowerCase()
  const apiName = String(api.name || '').toLowerCase()

  if (lowerName.includes('account') || apiName.includes('loss run')) return 'ACC-10045'
  if (lowerName.includes('policy') || apiName.includes('policy')) return 'PK202700023245'
  if (lowerName.includes('submission') || apiName.includes('submission')) return 'SUB-2026-10452'
  if (lowerName.includes('claim') || apiName.includes('claim')) return 'CLM-2026-45021'
  if (lowerName.includes('quote') || apiName.includes('quote') || apiName.includes('bind')) return 'QTE-45091'
  return 'ID-2026-10001'
}

function buildFallbackResponse(api, parameterName, parameterValue) {
  return {
    api: api.name,
    version: api.version,
    status: 'Success',
    [parameterName || 'id']: parameterValue || defaultPathParameterValue(api, parameterName),
    owner: api.owner,
    generatedAt: new Date().toISOString(),
  }
}

function statusTextFor(statusCode) {
  const labels = {
    200: 'OK',
    400: 'Bad Request',
    404: 'Not Found',
    500: 'Internal Server Error',
  }
  return labels[statusCode] || 'OK'
}

function resolveExecutablePath(path, parameterName, parameterValue) {
  if (!parameterName) return path
  const token = `{${parameterName}}`
  return String(path || '').replace(token, encodeURIComponent(parameterValue || ''))
}

// Endpoints implemented for real in this backend; everything else falls back to the mock upstream.
const IMPLEMENTED_ENDPOINT_PATTERNS = [
  /^POST \/api\/v1\/submissions$/,
  /^GET \/api\/v1\/submissions\/[^/]+\/status$/,
  /^POST \/api\/v1\/submissions\/[^/]+\/documents$/,
  /^POST \/api\/v1\/underwriting\/appetite$/,
  /^POST \/api\/v1\/underwriting\/risk-score$/,
  /^POST \/api\/v1\/quotes$/,
  /^POST \/api\/v1\/quotes\/[^/]+\/bind$/,
  /^GET \/api\/v1\/policies\/[^/]+$/,
  /^GET \/api\/v1\/policies\/[^/]+\/exposures$/,
  /^POST \/api\/v1\/claims\/fnol$/,
  /^GET \/api\/v1\/claims\/[^/]+\/status$/,
  /^POST \/api\/v1\/claims\/[^/]+\/reserves$/,
  /^POST \/api\/v1\/claims\/[^/]+\/payments$/,
  /^GET \/api\/v1\/accounts\/[^/]+\/loss-runs$/,
  /^GET \/api\/v1\/reference\/class-codes/,
]

function testBaseUrlFor(environment, method, path) {
  const signature = `${method} ${path}`
  if (IMPLEMENTED_ENDPOINT_PATTERNS.some((pattern) => pattern.test(signature))) {
    return process.env.API_TEST_REAL_BASE_URL || `http://localhost:${PORT}`
  }

  const normalized = String(environment || 'QA').toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  return (
    process.env[`API_TEST_${normalized}_BASE_URL`] ||
    process.env.API_TEST_BASE_URL ||
    `http://localhost:${PORT}/mock-api`
  )
}

function joinUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const cleanPath = String(path || '').replace(/^\/+/, '')
  return `${base}/${cleanPath}`
}

function filteredResponseHeaders(headers) {
  const allowed = ['content-type', 'x-correlation-id', 'x-request-id', 'x-mock-upstream']
  return allowed.reduce((result, name) => {
    const value = headers.get(name)
    if (value) result[name] = value
    return result
  }, {})
}

async function parseResponseBody(response) {
  const text = await response.text()
  if (!text) return null

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  return text
}

async function callTargetApi({ api, method, path, environment, requestBody }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TEST_REQUEST_TIMEOUT_MS)
  const targetUrl = joinUrl(testBaseUrlFor(environment, method, path), path)

  try {
    const hasBody = !['GET', 'HEAD'].includes(method) && requestBody !== null
    const response = await fetch(targetUrl, {
      method,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
        'x-consumer-app': 'DeveloperWorkbench',
        'x-workbench-api-name': api.name,
      },
      body: hasBody ? JSON.stringify(requestBody) : undefined,
    })

    return {
      statusCode: response.status,
      statusText: response.statusText || statusTextFor(response.status),
      headers: filteredResponseHeaders(response.headers),
      body: await parseResponseBody(response),
      targetUrl,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function insertApiCallLog(payload) {
  const result = await query(
    `
    INSERT INTO api_call_logs (
      api_id, api_name, method, path, environment, source, user_email,
      status_code, duration_ms, request_body, response_body, error_message, called_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10::jsonb, $11::jsonb, $12, $13
    )
    RETURNING id
    `,
    [
      payload.apiId,
      payload.apiName,
      payload.method,
      payload.path,
      payload.environment,
      payload.source,
      payload.userEmail,
      payload.statusCode,
      payload.durationMs,
      JSON.stringify(payload.requestBody ?? null),
      JSON.stringify(payload.responseBody ?? null),
      payload.errorMessage || null,
      payload.calledAt,
    ],
  )
  return result.rows[0]?.id
}

function rangeDays(value) {
  const parsed = Number.parseInt(String(value || '').replace(/[^0-9]/g, ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 30
  return Math.min(parsed, 365)
}

async function ensureSchema() {
  await query(`SET search_path TO ${DB_SCHEMA}`)

  try {
    await query(`
      ALTER TABLE apis
      ADD COLUMN IF NOT EXISTS tags_json jsonb DEFAULT '[]'::jsonb
    `)
    console.log('✓ Ensured tags_json column exists')
  } catch (error) {
    console.log('tags_json column already exists or error:', error.message)
  }

  try {
    await query(`
      ALTER TABLE apis
      ADD COLUMN IF NOT EXISTS sample_request jsonb,
      ADD COLUMN IF NOT EXISTS sample_response jsonb
    `)
    console.log('✓ Ensured sample_request / sample_response columns exist')
  } catch (error) {
    console.log('sample payload columns already exist or error:', error.message)
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS api_call_logs (
        id SERIAL PRIMARY KEY,
        api_id INTEGER,
        api_name TEXT,
        method TEXT,
        path TEXT,
        environment TEXT,
        source TEXT,
        user_email TEXT,
        status_code INTEGER,
        duration_ms INTEGER,
        request_body JSONB,
        response_body JSONB,
        error_message TEXT,
        called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Ensured api_call_logs table exists')
  } catch (error) {
    console.log('api_call_logs table already exists or error:', error.message)
  }
}

async function seedDatabase() {
  await ensureSchema()

  const countRow = await query('SELECT COUNT(*)::int AS cnt FROM apis')
  const currentCount = countRow.rows[0]?.cnt ?? 0

  // Always reseed if count doesn't match (data changed)
  if (currentCount !== seedApis.length) {
    console.log(
      `Seed data changed (DB has ${currentCount}, seed has ${seedApis.length}) — clearing and re-seeding...`,
    )
    await query('DELETE FROM downloads')
    await query('DELETE FROM apis')
  } else {
    // Spot check: verify one API has matching lifecycle
    const lastApi = seedApis[seedApis.length - 1]
    const check = await query('SELECT lifecycle FROM apis WHERE name = $1 LIMIT 1', [lastApi.name])
    if (check.rows[0]?.lifecycle !== lastApi.lifecycle) {
      console.log(`Lifecycle changed for ${lastApi.name} — clearing and re-seeding...`)
      await query('DELETE FROM downloads')
      await query('DELETE FROM apis')
    } else {
      console.log(`Database already seeded (${currentCount} APIs match).`)
      return
    }
  }

  console.log('Seeding database with sample API data...')

  for (const api of seedApis) {
    try {
      const slug = String(api.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      const payload = samplePayloads[api.name] || {}

      await query(
        `
        INSERT INTO apis (
          api_id, name, version, lifecycle, type, description,
          owner, consumers, status, published, endpoint,
          environment, restricted, tags_json, sample_request, sample_response,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15::jsonb, $16::jsonb,
          $17, $18
        )
        `,
        [
          `${slug}-${api.domain.toLowerCase()}`,
          api.name,
          api.version,
          api.lifecycle || null,
          api.type,
          api.desc,
          api.owner,
          api.consumers,
          'Active',
          new Date().toISOString(),
          api.endpoint,
          'Production',
          false,
          JSON.stringify(api.tags || []),
          payload.request ? JSON.stringify(payload.request) : null,
          payload.response ? JSON.stringify(payload.response) : null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      )
      console.log(`✓ Seeded: ${api.name}`)
    } catch (error) {
      console.error(`✗ Failed to seed ${api.name}:`, error.message)
    }
  }

  console.log('Database seeding complete!')
}

async function startServer() {
  await seedDatabase()
  await ensureAuthSchema(query)
  await ensureCatalogSourcesSchema(query)

  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(cookieParser())

  // Auth first so /api/auth/* stays available regardless of the catalog routes below.
  registerAuthRoutes(app, { query })

  // Registered first so the workbench UI contract wins over the older catalog routes below.
  registerUiRoutes(app, { query })
  registerCatalogSourceRoutes(app, { query })

  app.get('/api/health', async (_req, res) => {
    try {
      const result = await query('SELECT current_database() AS database, current_schema() AS schema')
      res.json({ ok: true, ...result.rows[0] })
    } catch (error) {
      res.status(500).json({ message: 'Database health check failed.' })
    }
  })

  app.get('/api/apis', async (_req, res) => {
    try {
      const result = await query('SELECT * FROM apis ORDER BY id ASC')
      res.json(result.rows.map(formatApiRow))
    } catch (error) {
      res.status(500).json({ message: 'Failed to load APIs.' })
    }
  })

  app.post('/api/apis', async (req, res) => {
    try {
      const payload = req.body || {}
      if (!payload.name || !payload.type || !payload.domain || !payload.owner) {
        res.status(400).json({ message: 'Missing required API fields.' })
        return
      }

      const createdAt = new Date().toISOString()
      const createdRow = await tryApiInsert(payload, createdAt)
      res.status(201).json(formatApiRow(createdRow))
    } catch (error) {
      console.error('Failed to create API:', error)
      res.status(500).json({ message: 'Failed to create API.' })
    }
  })

  app.get('/api/downloads', async (_req, res) => {
    try {
      const result = await query(
        `
        SELECT d.*, a.name AS api_name
        FROM downloads d
        LEFT JOIN apis a ON a.id = d.api_id
        ORDER BY d.id DESC
        LIMIT 20
        `
      )
      res.json(result.rows.map(formatDownloadRow))
    } catch (error) {
      res.status(500).json({ message: 'Failed to load downloads.' })
    }
  })

  app.post('/api/downloads', async (req, res) => {
    try {
      const payload = req.body || {}
      if (!payload.artifact || !payload.api) {
        res.status(400).json({ message: 'Missing download fields.' })
        return
      }

      const createdAt = new Date().toISOString()
      let resolvedApiId = Number(payload.apiId || 0)

      if (!Number.isInteger(resolvedApiId) || resolvedApiId <= 0) {
        const lookup = await query('SELECT id FROM apis WHERE name = $1 ORDER BY id DESC LIMIT 1', [String(payload.api)])
        resolvedApiId = Number(lookup.rows[0]?.id || 0)
      }

      if (!Number.isInteger(resolvedApiId) || resolvedApiId <= 0) {
        res.status(400).json({ message: 'Unable to resolve API for download record.' })
        return
      }

      await tryDownloadInsert(
        {
          downloadId: String(payload.downloadId || randomUUID()),
          apiId: resolvedApiId,
          artifact: String(payload.artifact),
          api: String(payload.api),
          by: String(payload.by || 'You'),
        },
        createdAt
      )

      res.status(201).json({
        artifact: String(payload.artifact),
        api: String(payload.api),
        by: String(payload.by || 'You'),
        date: createdAt,
      })
    } catch (error) {
      console.error('Failed to store download record:', error)
      res.status(500).json({ message: 'Failed to store download record.' })
    }
  })

  app.get('/api/usage/summary', async (req, res) => {
    try {
      const days = rangeDays(req.query.range)

      const traffic = await query(
        `
        SELECT
          COUNT(*)::int AS total_calls,
          COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS error_count,
          COALESCE(ROUND(AVG(duration_ms)), 0)::int AS avg_latency_ms,
          COUNT(DISTINCT user_email)::int AS unique_consumers
        FROM api_call_logs
        WHERE called_at >= NOW() - ($1::int * INTERVAL '1 day')
        `,
        [days],
      )

      const catalog = await query(
        `
        SELECT
          COUNT(*)::int AS total_apis,
          COALESCE(SUM(CASE WHEN lifecycle = 'Published' THEN 1 ELSE 0 END), 0)::int AS active_apis,
          COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END), 0)::int AS added_this_month
        FROM apis
        `,
      )

      res.json({
        rangeDays: days,
        totalCalls: traffic.rows[0].total_calls,
        errorCount: traffic.rows[0].error_count,
        avgLatencyMs: traffic.rows[0].avg_latency_ms,
        uniqueConsumers: traffic.rows[0].unique_consumers,
        totalApis: catalog.rows[0].total_apis,
        activeApis: catalog.rows[0].active_apis,
        addedThisMonth: catalog.rows[0].added_this_month,
      })
    } catch (error) {
      console.error('Failed to load usage summary:', error)
      res.status(500).json({ message: 'Failed to load usage summary.' })
    }
  })

  app.get('/api/usage/timeseries', async (req, res) => {
    try {
      const days = rangeDays(req.query.range)
      const result = await query(
        `
        SELECT
          d.day::date AS date,
          COUNT(l.id)::int AS calls,
          COALESCE(SUM(CASE WHEN l.status_code >= 400 THEN 1 ELSE 0 END), 0)::int AS errors
        FROM generate_series(
          CURRENT_DATE - (($1::int - 1) * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS d(day)
        LEFT JOIN api_call_logs l ON l.called_at::date = d.day::date
        GROUP BY d.day
        ORDER BY d.day
        `,
        [days],
      )

      res.json(result.rows.map((row) => ({
        date: row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date).slice(0, 10),
        calls: row.calls,
        errors: row.errors,
      })))
    } catch (error) {
      console.error('Failed to load usage timeseries:', error)
      res.status(500).json({ message: 'Failed to load usage timeseries.' })
    }
  })

  app.get('/api/usage/top-consumers', async (req, res) => {
    try {
      const days = rangeDays(req.query.range)
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 20)
      const result = await query(
        `
        SELECT
          COALESCE(NULLIF(TRIM(user_email), ''), 'Unknown') AS consumer,
          COUNT(*)::int AS calls
        FROM api_call_logs
        WHERE called_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY calls DESC
        LIMIT $2
        `,
        [days, limit],
      )
      res.json(result.rows)
    } catch (error) {
      console.error('Failed to load top consumers:', error)
      res.status(500).json({ message: 'Failed to load top consumers.' })
    }
  })

  app.post('/api/v1/submissions', async (req, res) => {
    try {
      const { errors, value } = validateSubmissionPayload(req.body || {})
      if (errors.length) {
        res.status(400).json({
          error: 'VALIDATION_FAILED',
          message: 'One or more submission fields are invalid.',
          details: errors,
        })
        return
      }

      res.status(201).json(await createSubmission(value))
    } catch (error) {
      console.error('Failed to create submission:', error)
      res.status(500).json({
        error: 'SUBMISSION_FAILED',
        message: 'Failed to create submission.',
      })
    }
  })

  app.get('/api/v1/submissions/:submissionId/status', async (req, res) => {
    try {
      const result = await query(
        `SELECT submission_id, status, underwriter, priority, annual_revenue, updated_at
         FROM workbench_submissions WHERE submission_id = $1`,
        [req.params.submissionId],
      )
      const row = result.rows[0]
      if (!row) {
        notFound(res, `Submission ${req.params.submissionId} was not found.`)
        return
      }

      res.json({
        submissionId: row.submission_id,
        status: row.status,
        underwriter: row.underwriter || 'Unassigned',
        priority: row.priority || submissionPriority(Number(row.annual_revenue) || 0),
        lastUpdated: isoInstant(row.updated_at),
      })
    } catch (error) {
      serverError(res, error, 'Failed to load submission status.')
    }
  })

  app.post('/api/v1/submissions/:submissionId/documents', async (req, res) => {
    try {
      const payload = req.body || {}
      const documentType = String(payload.documentType || '').trim()
      const fileName = String(payload.fileName || '').trim()

      const errors = []
      if (!documentType) errors.push({ field: 'documentType', message: 'documentType is required.' })
      if (!fileName) errors.push({ field: 'fileName', message: 'fileName is required.' })
      if (payload.documentDate && !isValidDate(String(payload.documentDate))) {
        errors.push({ field: 'documentDate', message: 'documentDate must be a valid YYYY-MM-DD date.' })
      }
      if (errors.length) {
        validationFailed(res, errors)
        return
      }

      const submission = await query(
        'SELECT submission_id FROM workbench_submissions WHERE submission_id = $1',
        [req.params.submissionId],
      )
      if (!submission.rowCount) {
        notFound(res, `Submission ${req.params.submissionId} was not found.`)
        return
      }

      const documentId = `DOC-${await nextSequenceValue('workbench_document_seq')}`
      const inserted = await query(
        `INSERT INTO workbench_submission_documents (
           document_id, submission_id, document_type, file_name, document_date, source
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING document_id, status, extraction_status`,
        [
          documentId,
          req.params.submissionId,
          documentType,
          fileName,
          payload.documentDate || null,
          String(payload.source || 'API').trim(),
        ],
      )

      const row = inserted.rows[0]
      res.status(201).json({
        documentId: row.document_id,
        status: row.status,
        extractionStatus: row.extraction_status,
      })
    } catch (error) {
      serverError(res, error, 'Failed to register submission document.')
    }
  })

  app.post('/api/v1/underwriting/appetite', async (req, res) => {
    try {
      const payload = req.body || {}
      const lineOfBusiness = String(payload.lineOfBusiness || '').trim()
      const state = String(payload.state || '').trim().toUpperCase()

      const errors = []
      if (!lineOfBusiness) errors.push({ field: 'lineOfBusiness', message: 'lineOfBusiness is required.' })
      if (!state) errors.push({ field: 'state', message: 'state is required.' })
      if (errors.length) {
        validationFailed(res, errors)
        return
      }

      const annualRevenue = Number(payload.annualRevenue) || 0
      const priorLossCount = Number(payload.priorLossCount) || 0
      const restrictedStates = new Set(['FL', 'LA', 'CA'])

      let score = 100
      const reasons = []
      if (priorLossCount >= 4) {
        score -= 25
        reasons.push('Prior loss count above appetite threshold.')
      } else if (priorLossCount >= 2) {
        score -= 10
      }
      if (annualRevenue > 50000000) {
        score -= 15
        reasons.push('Annual revenue exceeds standard appetite band.')
      }
      if (restrictedStates.has(state)) {
        score -= 20
        reasons.push(`${state} requires additional underwriting review.`)
      }

      score = Math.max(0, Math.min(100, score))
      const appetite = score >= 75 ? 'ACCEPTABLE' : score >= 50 ? 'REFER' : 'DECLINE'

      res.json({ appetite, score, referralRequired: appetite !== 'ACCEPTABLE', reasons })
    } catch (error) {
      serverError(res, error, 'Failed to evaluate appetite.')
    }
  })

  app.post('/api/v1/underwriting/risk-score', async (req, res) => {
    try {
      const payload = req.body || {}
      const annualRevenue = Number(payload.annualRevenue) || 0
      const employeeCount = Number(payload.employeeCount) || 0
      const priorLossCount = Number(payload.priorLossCount) || 0
      const priorLossAmount = Number(payload.priorLossAmount) || 0
      const yearsInBusiness = Number(payload.yearsInBusiness) || 0

      let riskScore = 50
      const factors = []

      if (priorLossCount >= 3) {
        riskScore += 10
        factors.push('Elevated loss frequency')
      } else if (priorLossCount >= 1) {
        riskScore += 4
      }
      if (priorLossAmount > 250000) {
        riskScore += 12
        factors.push('Loss severity above peer average')
      }
      if (yearsInBusiness > 0 && yearsInBusiness < 5) {
        riskScore += 10
        factors.push('Limited operating history')
      } else if (yearsInBusiness >= 15) {
        riskScore -= 8
      }
      if (employeeCount > 500) riskScore += 5

      const lossRatio = annualRevenue > 0 ? priorLossAmount / annualRevenue : 0
      if (lossRatio > 0.02) {
        riskScore += 10
        factors.push('Loss cost ratio above threshold')
      }

      riskScore = Math.max(1, Math.min(100, Math.round(riskScore)))
      const riskTier = riskScore >= 75 ? 'HIGH' : riskScore >= 50 ? 'MODERATE' : 'LOW'
      const recommendation = riskScore >= 75 ? 'DECLINE' : riskScore >= 60 ? 'REFER' : 'ACCEPT'

      res.json({ riskScore, riskTier, recommendation, factors })
    } catch (error) {
      serverError(res, error, 'Failed to calculate risk score.')
    }
  })

  app.post('/api/v1/quotes', async (req, res) => {
    try {
      const payload = req.body || {}
      const coverage = String(payload.coverage || '').trim()
      const effectiveDate = String(payload.effectiveDate || '').trim()
      const coverageLimit = Number(payload.limit ?? payload.coverageLimit) || 0
      const deductible = Number(payload.deductible) || 0

      const errors = []
      if (!coverage) errors.push({ field: 'coverage', message: 'coverage is required.' })
      if (!effectiveDate || !isValidDate(effectiveDate)) {
        errors.push({ field: 'effectiveDate', message: 'effectiveDate must be a valid YYYY-MM-DD date.' })
      }
      if (coverageLimit <= 0) errors.push({ field: 'limit', message: 'limit must be greater than zero.' })
      if (deductible < 0) errors.push({ field: 'deductible', message: 'deductible cannot be negative.' })
      if (errors.length) {
        validationFailed(res, errors)
        return
      }

      const submissionId = payload.submissionId ? String(payload.submissionId).trim() : null
      if (submissionId) {
        const submission = await query(
          'SELECT submission_id FROM workbench_submissions WHERE submission_id = $1',
          [submissionId],
        )
        if (!submission.rowCount) {
          notFound(res, `Submission ${submissionId} was not found.`)
          return
        }
      }

      const premium = Math.max(0, Math.round(coverageLimit * 0.095 - deductible * 0.2))
      const taxesAndFees = Math.round((premium * 0.0443) / 100) * 100
      const totalCost = premium + taxesAndFees
      const quoteId = `QTE-${await nextSequenceValue('workbench_quote_seq')}`
      const expirationDate = shiftDate(new Date().toISOString().slice(0, 10), { days: 30 })

      await query(
        `INSERT INTO workbench_quotes (
           quote_id, submission_id, coverage, coverage_limit, deductible,
           effective_date, premium, taxes_and_fees, total_cost, expiration_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          quoteId,
          submissionId,
          coverage,
          coverageLimit,
          deductible,
          effectiveDate,
          premium,
          taxesAndFees,
          totalCost,
          expirationDate,
        ],
      )

      res.status(201).json({ quoteId, premium, taxesAndFees, totalCost, expirationDate })
    } catch (error) {
      serverError(res, error, 'Failed to create quote.')
    }
  })

  app.post('/api/v1/quotes/:quoteId/bind', async (req, res) => {
    try {
      const payload = req.body || {}
      const quoteResult = await query('SELECT * FROM workbench_quotes WHERE quote_id = $1', [req.params.quoteId])
      const quote = quoteResult.rows[0]

      if (!quote) {
        notFound(res, `Quote ${req.params.quoteId} was not found.`)
        return
      }
      if (quote.status === 'BOUND') {
        res.status(409).json({
          error: 'ALREADY_BOUND',
          message: `Quote ${quote.quote_id} has already been bound.`,
        })
        return
      }

      const submission = await query(
        'SELECT insured_name, line_of_business FROM workbench_submissions WHERE submission_id = $1',
        [quote.submission_id],
      )
      const insuredName = submission.rows[0]?.insured_name || 'Unknown Insured'
      const lineOfBusiness = submission.rows[0]?.line_of_business || quote.coverage

      const policyNumber = `POL-${new Date().getFullYear()}-${await nextSequenceValue('workbench_policy_seq')}`
      const effectiveDate = isoDate(quote.effective_date)
      const expirationDate = shiftDate(effectiveDate, { years: 1 })

      await query(
        `INSERT INTO workbench_policies (
           policy_number, quote_id, account_id, insured_name, line_of_business,
           effective_date, expiration_date, status, written_premium, bind_requested_by, payment_plan
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          policyNumber,
          quote.quote_id,
          payload.accountId ? String(payload.accountId).trim() : null,
          insuredName,
          lineOfBusiness,
          effectiveDate,
          expirationDate,
          'ACTIVE',
          quote.premium,
          payload.bindRequestedBy ? String(payload.bindRequestedBy).trim() : null,
          payload.paymentPlan ? String(payload.paymentPlan).trim() : null,
        ],
      )

      await query('UPDATE workbench_quotes SET status = $1 WHERE quote_id = $2', ['BOUND', quote.quote_id])

      res.status(201).json({ policyNumber, status: 'BOUND', effectiveDate })
    } catch (error) {
      serverError(res, error, 'Failed to bind quote.')
    }
  })

  app.get('/api/v1/policies/:policyNumber', async (req, res) => {
    try {
      const result = await query(
        `SELECT policy_number, insured_name, line_of_business, effective_date,
                expiration_date, status, written_premium
         FROM workbench_policies WHERE policy_number = $1`,
        [req.params.policyNumber],
      )
      const row = result.rows[0]
      if (!row) {
        notFound(res, `Policy ${req.params.policyNumber} was not found.`)
        return
      }

      res.json({
        policyNumber: row.policy_number,
        insuredName: row.insured_name,
        lineOfBusiness: row.line_of_business,
        effectiveDate: isoDate(row.effective_date),
        expirationDate: isoDate(row.expiration_date),
        status: row.status,
        writtenPremium: money(row.written_premium),
      })
    } catch (error) {
      serverError(res, error, 'Failed to load policy.')
    }
  })

  app.get('/api/v1/policies/:policyNumber/exposures', async (req, res) => {
    try {
      const policy = await query(
        'SELECT policy_number FROM workbench_policies WHERE policy_number = $1',
        [req.params.policyNumber],
      )
      if (!policy.rowCount) {
        notFound(res, `Policy ${req.params.policyNumber} was not found.`)
        return
      }

      const result = await query(
        `SELECT location_id, address, class_code, payroll, employee_count
         FROM workbench_policy_exposures WHERE policy_number = $1 ORDER BY location_id`,
        [req.params.policyNumber],
      )

      res.json({
        policyNumber: req.params.policyNumber,
        exposures: result.rows.map((row) => ({
          locationId: row.location_id,
          address: row.address,
          classCode: row.class_code,
          payroll: money(row.payroll),
          employeeCount: row.employee_count,
        })),
      })
    } catch (error) {
      serverError(res, error, 'Failed to load policy exposures.')
    }
  })

  app.post('/api/v1/claims/fnol', async (req, res) => {
    try {
      const payload = req.body || {}
      const policyNumber = String(payload.policyNumber || '').trim()
      const dateOfLoss = String(payload.dateOfLoss || '').trim()

      const errors = []
      if (!policyNumber) errors.push({ field: 'policyNumber', message: 'policyNumber is required.' })
      if (!dateOfLoss || !isValidDate(dateOfLoss)) {
        errors.push({ field: 'dateOfLoss', message: 'dateOfLoss must be a valid YYYY-MM-DD date.' })
      }
      if (payload.reportedDate && !isValidDate(String(payload.reportedDate))) {
        errors.push({ field: 'reportedDate', message: 'reportedDate must be a valid YYYY-MM-DD date.' })
      }
      if (errors.length) {
        validationFailed(res, errors)
        return
      }

      const policy = await query(
        'SELECT policy_number FROM workbench_policies WHERE policy_number = $1',
        [policyNumber],
      )
      if (!policy.rowCount) {
        notFound(res, `Policy ${policyNumber} was not found.`)
        return
      }

      const severityByLossType = {
        BODILY_INJURY: 'MEDIUM',
        PROPERTY_DAMAGE: 'LOW',
        FIRE: 'HIGH',
        CATASTROPHE: 'HIGH',
      }
      const adjusters = ['John Carter', 'Maria Lopez', 'Derek Shaw']

      const sequenceValue = await nextSequenceValue('workbench_claim_seq')
      const claimNumber = `CLM-${new Date().getFullYear()}-${sequenceValue}`
      const lossType = String(payload.lossType || 'OTHER').trim().toUpperCase()
      const severity = severityByLossType[lossType] || 'MEDIUM'
      const adjuster = adjusters[Number(sequenceValue) % adjusters.length]

      const inserted = await query(
        `INSERT INTO workbench_claims (
           claim_number, policy_number, date_of_loss, reported_date, loss_type,
           loss_location, description, adjuster, severity, next_review_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING claim_number, status`,
        [
          claimNumber,
          policyNumber,
          dateOfLoss,
          payload.reportedDate || null,
          lossType,
          payload.lossLocation ? String(payload.lossLocation).trim() : null,
          payload.description ? String(payload.description).trim() : null,
          adjuster,
          severity,
          shiftDate(dateOfLoss, { days: 15 }),
        ],
      )

      res.status(201).json({
        claimNumber: inserted.rows[0].claim_number,
        status: inserted.rows[0].status,
        adjusterAssigned: adjuster,
        severity,
      })
    } catch (error) {
      serverError(res, error, 'Failed to create claim from FNOL.')
    }
  })

  app.get('/api/v1/claims/:claimNumber/status', async (req, res) => {
    try {
      const result = await query(
        `SELECT claim_number, status, claim_stage, adjuster, total_paid, total_reserve, next_review_date
         FROM workbench_claims WHERE claim_number = $1`,
        [req.params.claimNumber],
      )
      const row = result.rows[0]
      if (!row) {
        notFound(res, `Claim ${req.params.claimNumber} was not found.`)
        return
      }

      res.json({
        claimNumber: row.claim_number,
        status: row.status,
        claimStage: row.claim_stage,
        adjuster: row.adjuster,
        totalIncurred: money(row.total_paid) + money(row.total_reserve),
        nextReviewDate: isoDate(row.next_review_date),
      })
    } catch (error) {
      serverError(res, error, 'Failed to load claim status.')
    }
  })

  app.post('/api/v1/claims/:claimNumber/reserves', async (req, res) => {
    try {
      const payload = req.body || {}
      const reserveType = String(payload.reserveType || '').trim().toUpperCase()
      const transactionType = String(payload.transactionType || '').trim().toUpperCase()
      const amount = Number(payload.amount)

      const errors = []
      if (!reserveType) errors.push({ field: 'reserveType', message: 'reserveType is required.' })
      if (!['INCREASE', 'DECREASE', 'SET'].includes(transactionType)) {
        errors.push({ field: 'transactionType', message: 'transactionType must be INCREASE, DECREASE, or SET.' })
      }
      if (!Number.isFinite(amount) || amount < 0) {
        errors.push({ field: 'amount', message: 'amount must be a non-negative number.' })
      }
      if (errors.length) {
        validationFailed(res, errors)
        return
      }

      const claimResult = await query(
        'SELECT claim_number, total_reserve FROM workbench_claims WHERE claim_number = $1',
        [req.params.claimNumber],
      )
      const claim = claimResult.rows[0]
      if (!claim) {
        notFound(res, `Claim ${req.params.claimNumber} was not found.`)
        return
      }

      const previousReserve = money(claim.total_reserve)
      let newReserve = previousReserve
      if (transactionType === 'INCREASE') newReserve = previousReserve + amount
      else if (transactionType === 'DECREASE') newReserve = Math.max(0, previousReserve - amount)
      else newReserve = amount

      const transactionId = `RSV-${await nextSequenceValue('workbench_reserve_seq')}`
      const inserted = await query(
        `INSERT INTO workbench_claim_reserves (
           transaction_id, claim_number, reserve_type, transaction_type,
           amount, previous_reserve, new_reserve, reason
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING transaction_id, status`,
        [
          transactionId,
          claim.claim_number,
          reserveType,
          transactionType,
          amount,
          previousReserve,
          newReserve,
          payload.reason ? String(payload.reason).trim() : null,
        ],
      )

      await query('UPDATE workbench_claims SET total_reserve = $1 WHERE claim_number = $2', [
        newReserve,
        claim.claim_number,
      ])

      res.status(201).json({
        transactionId: inserted.rows[0].transaction_id,
        previousReserve,
        newReserve,
        status: inserted.rows[0].status,
      })
    } catch (error) {
      serverError(res, error, 'Failed to post reserve transaction.')
    }
  })

  app.post('/api/v1/claims/:claimNumber/payments', async (req, res) => {
    try {
      const payload = req.body || {}
      const paymentType = String(payload.paymentType || '').trim().toUpperCase()
      const payee = String(payload.payee || '').trim()
      const amount = Number(payload.amount)

      const errors = []
      if (!paymentType) errors.push({ field: 'paymentType', message: 'paymentType is required.' })
      if (!payee) errors.push({ field: 'payee', message: 'payee is required.' })
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({ field: 'amount', message: 'amount must be greater than zero.' })
      }
      if (errors.length) {
        validationFailed(res, errors)
        return
      }

      const claimResult = await query(
        'SELECT claim_number, total_paid, total_reserve FROM workbench_claims WHERE claim_number = $1',
        [req.params.claimNumber],
      )
      const claim = claimResult.rows[0]
      if (!claim) {
        notFound(res, `Claim ${req.params.claimNumber} was not found.`)
        return
      }

      const paymentId = `PAY-${await nextSequenceValue('workbench_payment_seq')}`
      const inserted = await query(
        `INSERT INTO workbench_claim_payments (
           payment_id, claim_number, payment_type, payee, amount, payment_method, invoice_number
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING payment_id, amount, status, payment_date`,
        [
          paymentId,
          claim.claim_number,
          paymentType,
          payee,
          amount,
          payload.paymentMethod ? String(payload.paymentMethod).trim() : null,
          payload.invoiceNumber ? String(payload.invoiceNumber).trim() : null,
        ],
      )

      await query(
        `UPDATE workbench_claims
            SET total_paid = total_paid + $1,
                total_reserve = GREATEST(0, total_reserve - $1)
          WHERE claim_number = $2`,
        [amount, claim.claim_number],
      )

      const row = inserted.rows[0]
      res.status(201).json({
        paymentId: row.payment_id,
        amount: money(row.amount),
        status: row.status,
        paymentDate: isoDate(row.payment_date),
      })
    } catch (error) {
      serverError(res, error, 'Failed to record claim payment.')
    }
  })

  app.get('/api/v1/accounts/:accountId/loss-runs', async (req, res) => {
    try {
      const result = await query(
        `SELECT c.claim_number, c.date_of_loss, c.status, c.total_paid, c.total_reserve
         FROM workbench_claims c
         JOIN workbench_policies p ON p.policy_number = c.policy_number
         WHERE p.account_id = $1
         ORDER BY c.date_of_loss`,
        [req.params.accountId],
      )

      if (!result.rowCount) {
        notFound(res, `No policies or claims were found for account ${req.params.accountId}.`)
        return
      }

      res.json({
        accountId: req.params.accountId,
        valuationDate: new Date().toISOString().slice(0, 10),
        claims: result.rows.map((row) => ({
          claimNumber: row.claim_number,
          dateOfLoss: isoDate(row.date_of_loss),
          status: row.status,
          paid: money(row.total_paid),
          reserve: money(row.total_reserve),
          totalIncurred: money(row.total_paid) + money(row.total_reserve),
        })),
      })
    } catch (error) {
      serverError(res, error, 'Failed to load loss runs.')
    }
  })

  app.get('/api/v1/reference/class-codes', async (req, res) => {
    try {
      const lineOfBusiness = req.query.lineOfBusiness ? String(req.query.lineOfBusiness).trim() : null
      const state = req.query.state ? String(req.query.state).trim().toUpperCase() : null

      const result = await query(
        `SELECT class_code, description, effective_date
         FROM workbench_class_codes
         WHERE ($1::text IS NULL OR line_of_business = $1)
           AND ($2::text IS NULL OR state = $2)
         ORDER BY class_code`,
        [lineOfBusiness, state],
      )

      res.json({
        lineOfBusiness: lineOfBusiness || 'ALL',
        state: state || 'ALL',
        classCodes: result.rows.map((row) => ({
          code: row.class_code,
          description: row.description,
          effectiveDate: isoDate(row.effective_date),
        })),
      })
    } catch (error) {
      serverError(res, error, 'Failed to load reference class codes.')
    }
  })

  app.all('/mock-api/*', (req, res) => {
    const apiName = String(req.header('x-workbench-api-name') || '')
    const path = req.path.replace(/^\/mock-api/, '')
    const sample = samplePayloads[apiName] || {}

    if (/404|not[-_ ]?found|missing/i.test(path)) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'The requested mock resource was not found.',
        path,
      })
      return
    }

    res
      .set('x-mock-upstream', 'coaction-workbench')
      .json(sample.response || {
        status: 'Success',
        api: apiName || 'Mock API',
        method: req.method,
        path,
        receivedBody: req.body || null,
      })
  })

  app.post('/api/test-run', async (req, res) => {
    const startedAt = Date.now()
    const payload = req.body || {}

    try {
      const apiId = Number(payload.apiId || 0)
      if (!Number.isInteger(apiId) || apiId <= 0) {
        res.status(400).json({ message: 'Missing API id for test run.' })
        return
      }

      const lookup = await query('SELECT * FROM apis WHERE id = $1 LIMIT 1', [apiId])
      const api = lookup.rows[0]
      if (!api) {
        res.status(404).json({ message: 'API not found for test run.' })
        return
      }

      const method = String(payload.method || 'GET').toUpperCase()
      const environment = String(payload.environment || 'QA')
      const parameterName = String(payload.pathParameterName || '')
      const parameterValue = String(payload.pathParameterValue || '').trim()
      const path = resolveExecutablePath(
        String(payload.path || api.endpoint || ''),
        parameterName,
        parameterValue || defaultPathParameterValue(api, parameterName),
      )

      let requestBody = null
      if (typeof payload.requestBodyText === 'string' && payload.requestBodyText.trim()) {
        requestBody = JSON.parse(payload.requestBodyText)
      } else if (payload.requestBody && typeof payload.requestBody === 'object') {
        requestBody = payload.requestBody
      }

      const missingPathParameter = parameterName && !parameterValue
      const notFoundParameter = /404|not[-_ ]?found|missing/i.test(parameterValue)
      const targetResult = missingPathParameter || notFoundParameter
        ? {
            statusCode: 404,
            statusText: 'Not Found',
            headers: { 'content-type': 'application/json' },
            body: {
              error: 'NOT_FOUND',
              message: `${parameterName || 'Path parameter'} was not found in the selected environment.`,
              [parameterName || 'id']: parameterValue || null,
            },
            targetUrl: null,
          }
        : await callTargetApi({
            api,
            method,
            path,
            environment,
            requestBody,
          })
      const responseBody = targetResult.body || buildFallbackResponse(api, parameterName, parameterValue)
      const elapsedMs = Date.now() - startedAt

      const logId = await insertApiCallLog({
        apiId,
        apiName: api.name,
        method,
        path,
        environment,
        source: 'portal-try-it',
        userEmail: String(payload.userEmail || 'developer-workbench-user'),
        statusCode: targetResult.statusCode,
        durationMs: elapsedMs,
        requestBody: {
          pathParameter: parameterName ? { [parameterName]: parameterValue } : null,
          body: requestBody,
        },
        responseBody,
        errorMessage: targetResult.statusCode >= 400 ? responseBody.message : null,
        calledAt: new Date().toISOString(),
      })

      res.json({
        statusCode: targetResult.statusCode,
        statusText: targetResult.statusText,
        elapsedMs,
        environment,
        method,
        path,
        source: 'portal-try-it',
        logId,
        upstream: targetResult.targetUrl ? 'configured-target' : 'validation',
        headers: targetResult.headers,
        body: responseBody,
      })
    } catch (error) {
      const elapsedMs = Date.now() - startedAt
      const responseBody = {
        error: 'TEST_RUN_FAILED',
        message: error instanceof SyntaxError ? 'Request body must be valid JSON.' : 'Failed to run API test.',
      }
      console.error('Failed to run API test:', error)
      res.json({
        statusCode: error instanceof SyntaxError ? 400 : 500,
        statusText: error instanceof SyntaxError ? 'Bad Request' : 'Internal Server Error',
        elapsedMs,
        body: responseBody,
      })
    }
  })

  app.use((error, _req, res, _next) => {
    const status = error?.status || 500
    console.error('Request failed:', error?.message || error)
    res.status(status).json({ message: error?.expose ? error.message : 'Unable to process request' })
  })

  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`)
    console.log(`Schema: ${DB_SCHEMA}`)
    console.log(`Database: ${process.env.DB_NAME}`)
  })
}

startServer().catch((error) => {
  console.error('Backend startup failed:', error)
  process.exit(1)
})
