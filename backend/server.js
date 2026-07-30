import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { apis as seedApis } from '../src/data/apis.js'

const PORT = Number(process.env.PORT || 8787)
const DB_SCHEMA = process.env.DB_SCHEMA || 'public'

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

  const attempts = [
    {
      sql: `
        INSERT INTO apis (
          api_id, name, version, lifecycle, type, description,
          owner, consumers, status, published, endpoint,
          environment, restricted, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15
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
        createdAt,
        updatedAt,
      ],
    },
    {
      sql: `
        INSERT INTO apis (
          name, desc, endpoint, domain, type, version, lifecycle,
          tags_json, owner, consumers, test_tool, artifacts_json,
          calls, latency, error_rate, error_level, trend, trend_level, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9, $10, $11, $12::jsonb,
          $13, $14, $15, $16, $17, $18, $19
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
        JSON.stringify(payload.tags || []),
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

async function ensureSchema() {
  await query(`SET search_path TO ${DB_SCHEMA}`)
  
  // Add tags_json column if it doesn't exist
  try {
    await query(`
      ALTER TABLE apis 
      ADD COLUMN IF NOT EXISTS tags_json jsonb DEFAULT '[]'::jsonb
    `)
    console.log('✓ Ensured tags_json column exists')
  } catch (error) {
    console.log('tags_json column already exists or error:', error.message)
  }
}

async function seedDatabase() {
  await ensureSchema()

  const existing = await query('SELECT tags_json FROM apis LIMIT 1')
  
  if (existing.rows.length > 0) {
    const tagsJson = existing.rows[0].tags_json
    // Check if tags_json has real tag data (not empty array or null)
    const hasRealTags = tagsJson && Array.isArray(tagsJson) && tagsJson.length > 0
    
    if (hasRealTags) {
      console.log('Database already seeded with API data (including tags).')
      return
    }
    
    console.log('Database has API data but missing tags. Clearing and re-seeding...')
    await query('DELETE FROM downloads')
    await query('DELETE FROM apis')
  }

  console.log('Seeding database with sample API data...')

  for (const api of seedApis) {
    try {
      const slug = String(api.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      await query(
        `
        INSERT INTO apis (
          api_id, name, version, lifecycle, type, description,
          owner, consumers, status, published, endpoint,
          environment, restricted, tags_json, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16
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
          new Date().toISOString(),
          new Date().toISOString(),
        ]
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

  const app = express()
  app.use(cors())
  app.use(express.json())

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
