import { apis } from '../src/data/apis.js'
import { samplePayloads } from '../src/data/samplePayloads.js'
import { SEED_EXPLANATIONS } from '../src/data/explanations.js'
import { getApiDocument } from '../src/data/apiDocuments.js'
import { getApiSchema } from '../src/data/schemas.js'
import { auditSeed, requests, roles, tagDefinitions, users } from './seed/reference.js'
import { traces } from './seed/traces.js'
import { query, withTransaction } from './db.js'

const AUDIENCES = ['Business', 'Developer', 'Partner']
const ADDED_THIS_MONTH = new Set(['Loss Run API', 'Reference Data API'])

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function splitEndpoint(endpoint) {
  const match = String(endpoint || '').trim().match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i)
  if (!match) return { method: 'GET', path: String(endpoint || '').trim() }
  return { method: match[1].toUpperCase(), path: match[2] }
}

function parseCount(label) {
  const raw = String(label || '0').replace(/,/g, '').trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  if (/m$/i.test(raw)) return Math.round(value * 1_000_000)
  if (/k$/i.test(raw)) return Math.round(value * 1_000)
  return Math.round(value)
}

function parseLatency(label) {
  const value = Number.parseInt(String(label || '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(value) ? value : 0
}

function parseErrorRate(label) {
  const value = Number.parseFloat(String(label || '').replace('%', ''))
  return Number.isFinite(value) ? value / 100 : 0
}

function lifecycleTag(lifecycle) {
  if (/deprecated/i.test(lifecycle || '')) return 'Deprecated'
  if (/draft/i.test(lifecycle || '')) return 'Draft'
  return 'Published'
}

function inferredTags(api) {
  const text = [api.name, api.desc, api.endpoint, ...(api.tags || [])].join(' ').toLowerCase()
  const tags = new Set(api.tags || [])
  tags.add(api.domain)
  tags.add(api.type || 'REST')
  tags.add(lifecycleTag(api.lifecycle))
  if (/pii|insured|claimant|payee|policy|claim|loss|payment|document/.test(text)) tags.add('PII')
  if (/premium|reserve|payment|quote|bind|financial|taxes|fees/.test(text)) tags.add('Financial')
  return [...tags].filter(Boolean)
}

function changelogRows(api, method, path) {
  const hasParam = path.includes('{')
  const writes = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
  return [
    {
      date: '2026-09-15',
      version: api.version || 'v1.0',
      type: 'Current',
      title: 'Catalog documentation refreshed',
      description: `${api.name} now includes structured schema fields, examples, Try It guidance, and owner notes in the workbench.`,
      impact: 'No breaking change. Existing consumers can continue using the endpoint as documented.',
      action: 'Review the Schema and Examples tabs before new testing or integration work.',
    },
    {
      date: '2026-08-22',
      version: api.version || 'v1.0',
      type: writes ? 'Validation' : 'Response',
      title: writes ? 'Request validation clarified' : 'Response metadata documented',
      description: writes
        ? `Required payload fields are now called out for ${method} ${path}, including validation expectations for missing or malformed values.`
        : `Response fields are now documented for ${method} ${path}, including identifiers, status values, and date fields.`,
      impact: writes
        ? 'Requests missing required values may receive 400 validation responses.'
        : 'No request change. Response consumers should map the documented fields explicitly.',
      action: writes
        ? 'Confirm required fields are present in Postman, Swagger, and portal Try It requests.'
        : 'Update client models to match the documented response schema.',
    },
    {
      date: '2026-07-18',
      version: 'v0.9',
      type: 'Sandbox',
      title: 'Sandbox testing enabled',
      description: hasParam
        ? `Sandbox examples were added with realistic test identifiers for ${path}.`
        : `Sandbox examples were added with realistic request and response payloads for ${api.name}.`,
      impact: 'No production impact. Sandbox data is representative and safe for integration testing.',
      action: 'Use the Test menu or Try It panel to validate requests before requesting production access.',
    },
  ]
}

function explanationFor(api, method, path, audience) {
  const seeded = SEED_EXPLANATIONS[`${method} ${path}`]?.[audience]
  if (seeded) return seeded
  return {
    summary: api.desc,
    evaluates: [`${method} ${path}`],
    returns: ['The documented response for this operation'],
  }
}

function usageDays(callTotal, errorRate) {
  const end = new Date('2026-09-25T00:00:00Z')
  const recentWeights = []
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(end)
    day.setUTCDate(end.getUTCDate() - offset)
    const weekday = day.getUTCDay()
    recentWeights.push({ day, weight: weekday === 0 || weekday === 6 ? 0.55 : 1 })
  }
  const weightSum = recentWeights.reduce((sum, item) => sum + item.weight, 0)
  const rows = []
  for (let age = 89; age >= 30; age -= 1) {
    const day = new Date(end)
    day.setUTCDate(end.getUTCDate() - age)
    const calls = Math.round((callTotal / 30) * 0.45)
    rows.push({ day, calls, errors: Math.round(calls * errorRate) })
  }
  let assigned = 0
  recentWeights.forEach((item, index) => {
    const calls = index === recentWeights.length - 1
      ? Math.max(callTotal - assigned, 0)
      : Math.round((callTotal * item.weight) / weightSum)
    assigned += calls
    rows.push({ day: item.day, calls, errors: Math.round(calls * errorRate) })
  })
  return rows
}

async function insertApi(client, api) {
  const { method, path } = splitEndpoint(api.endpoint)
  const createdAt = ADDED_THIS_MONTH.has(api.name) ? '2026-09-10T12:00:00Z' : '2026-08-01T12:00:00Z'
  const inserted = await client.query(
    `INSERT INTO workbench.api (
      api_bk, name, description, endpoint, http_method, path, domain, api_type, version, lifecycle,
      owner, consumers_cnt, status, environment, restricted_flag, test_tool, calls_label, latency_label,
      error_rate_label, error_level, trend_label, trend_level, published_at, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,'Active','Production',false,$13,$14,$15,
      $16,$17,$18,$19,$20,$21,$21
    ) RETURNING api_key`,
    [
      `${slug(api.name)}-${slug(api.domain)}`,
      api.name,
      api.desc,
      api.endpoint,
      method,
      path,
      api.domain,
      api.type,
      api.version,
      api.lifecycle || 'Draft',
      api.owner,
      api.consumers,
      api.testTool || 'Swagger',
      api.calls,
      api.latency,
      api.errorRate,
      api.errorLevel,
      api.trend,
      api.trendLevel,
      api.lifecycle === 'Published' ? createdAt : null,
      createdAt,
    ],
  )
  return { apiKey: inserted.rows[0].api_key, method, path }
}

export async function seedDatabase() {
  const existing = await query('SELECT COUNT(*)::int AS cnt FROM workbench.api')
  if ((existing.rows[0]?.cnt || 0) > 0) {
    console.log(`Workbench already loaded (${existing.rows[0].cnt} APIs).`)
    return
  }

  const knownTags = new Map(tagDefinitions.map((tag) => [tag.tag, tag]))

  await withTransaction(async (client) => {
    for (const tag of tagDefinitions) {
      await client.query(
        `INSERT INTO workbench.tag_definition (tag_name, category, description, owner, rules_json, color, background)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [tag.tag, tag.category, tag.description, tag.owner, JSON.stringify(tag.rules), tag.color, tag.background],
      )
    }

    const apiKeys = new Map()
    for (const api of apis) {
      const { apiKey, method, path } = await insertApi(client, api)
      apiKeys.set(api.name, apiKey)
      const payload = samplePayloads[api.name] || {}
      await client.query(
        `INSERT INTO workbench.api_sample (api_key, request_json, response_json) VALUES ($1, $2::jsonb, $3::jsonb)`,
        [apiKey, payload.request ? JSON.stringify(payload.request) : null, payload.response ? JSON.stringify(payload.response) : null],
      )

      for (const tagName of inferredTags(api)) {
        if (!knownTags.has(tagName)) {
          await client.query(
            `INSERT INTO workbench.tag_definition (tag_name, category, description, owner, rules_json)
             VALUES ($1, 'Uncategorized', $2, 'Needs owner', $3::jsonb)
             ON CONFLICT (tag_name) DO NOTHING`,
            [tagName, 'Tag discovered from API metadata. Add a definition before promoting it as a governed tag.', JSON.stringify(['Review naming, ownership, and usage before broad adoption.'])],
          )
          knownTags.set(tagName, true)
        }
        await client.query(
          `INSERT INTO workbench.api_tag (api_key, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [apiKey, tagName],
        )
      }

      for (const audience of AUDIENCES) {
        const explanation = explanationFor(api, method, path, audience)
        await client.query(
          `INSERT INTO workbench.api_explanation (api_key, audience, summary, evaluates_json, returns_json)
           VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
          [apiKey, audience, explanation.summary, JSON.stringify(explanation.evaluates || []), JSON.stringify(explanation.returns || [])],
        )
      }

      const document = getApiDocument(api, method, path)
      await client.query(
        `INSERT INTO workbench.api_document (api_key, purpose, when_to_use, notes_json, errors_json)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
        [apiKey, document.purpose, document.whenToUse, JSON.stringify(document.notes), JSON.stringify(document.errors)],
      )

      const schema = getApiSchema(api, payload, path)
      const sections = [
        ['path', schema.pathParameters],
        ['request', schema.request],
        ['response', schema.response],
      ]
      for (const [section, fields] of sections) {
        for (const [index, field] of fields.entries()) {
          await client.query(
            `INSERT INTO workbench.api_schema_field
              (api_key, section, field_name, field_type, required_flag, description, example, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [apiKey, section, field.name, field.type, Boolean(field.required), field.description, String(field.example ?? ''), index],
          )
        }
      }

      for (const change of changelogRows(api, method, path)) {
        await client.query(
          `INSERT INTO workbench.api_changelog
            (api_key, change_dt, version, change_type, title, description, impact, developer_action, owner)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [apiKey, change.date, change.version, change.type, change.title, change.description, change.impact, change.action, api.owner],
        )
      }

      const callTotal = parseCount(api.calls)
      const errorRate = parseErrorRate(api.errorRate)
      const latency = parseLatency(api.latency)
      for (const day of usageDays(callTotal, errorRate)) {
        await client.query(
          `INSERT INTO workbench.usage_daily (usage_dt, api_key, call_cnt, error_cnt, latency_ms)
           VALUES ($1,$2,$3,$4,$5)`,
          [day.day.toISOString().slice(0, 10), apiKey, day.calls, day.errors, latency],
        )
      }
    }

    for (const role of roles) {
      await client.query(
        `INSERT INTO workbench.role_permission (role_name, docs, try_it, publish, approve, admin_access)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [role.role, role.docs, role.tryIt, role.publish, role.approve, role.admin],
      )
    }

    for (const user of users) {
      await client.query(
        `INSERT INTO workbench.app_user
          (user_key, name, email, team, role_name, access_scope, status, last_active, expires_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user.id, user.name, user.email, user.team, user.role, user.access, user.status, user.lastActive, user.expires],
      )
      const names = user.apis === '*' ? [...apiKeys.keys()] : user.apis
      for (const name of names) {
        const apiKey = apiKeys.get(name)
        if (!apiKey) continue
        await client.query(
          `INSERT INTO workbench.user_api_access (user_key, api_key) VALUES ($1,$2)`,
          [user.id, apiKey],
        )
      }
    }

    for (const request of requests) {
      await client.query(
        `INSERT INTO workbench.access_request
          (request_key, requester, team, api_name, access_type, risk, reason, requested_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [request.id, request.requester, request.team, request.api, request.accessType, request.risk, request.reason, request.requestedAt],
      )
    }

    for (const event of auditSeed) {
      await client.query(
        `INSERT INTO workbench.audit_event (occurred_label, actor, action, target, result, created_at)
         VALUES ($1,$2,$3,$4,$5, NOW())`,
        [event.when, event.actor, event.action, event.target, event.result],
      )
    }

    for (const [objectBk, trace] of Object.entries(traces)) {
      await client.query(
        `INSERT INTO workbench.trace_object
          (object_bk, kind, title, status, status_color, opened_ago, opened_by, fields_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [objectBk, trace.kind, trace.title, trace.status, trace.statusColor, trace.openedAgo, trace.openedBy, JSON.stringify(trace.fields || {})],
      )
      for (const related of trace.relatedTo || []) {
        await client.query(
          `INSERT INTO workbench.trace_relation (object_bk, related_bk, relation) VALUES ($1,$2,$3)`,
          [objectBk, related.id, related.relation],
        )
      }
      for (const [index, event] of trace.events.entries()) {
        await client.query(
          `INSERT INTO workbench.trace_event
            (object_bk, seq, event_time, api_name, http_method, path, status_code, duration_ms, actor_name, actor_kind, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [objectBk, index + 1, event.t, event.api, event.method, event.path, event.status, event.ms, event.actor.name, event.actor.kind, event.note || ''],
        )
      }
    }
  })

  console.log(`Seeded ${apis.length} APIs and related workbench tables.`)
}
