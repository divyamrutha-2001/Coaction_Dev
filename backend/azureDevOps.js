// Azure DevOps Repos connector for catalog sources. PAT stays server-side (AZURE_DEVOPS_PAT).
import { randomUUID } from 'node:crypto'

const API_VERSION = '7.1'
const TIMEOUT_MS = 20000
const MAX_FILES = 200
const MAX_FILE_BYTES = 2 * 1024 * 1024
const SPEC_EXT = /\.(json|ya?ml)$/i

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  error.expose = true
  return error
}

// Only Azure DevOps hosts are allowed so the server PAT can't be sent elsewhere.
export function parseOrganizationUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    throw fail(400, 'Organization URL is not a valid URL.')
  }
  if (url.protocol !== 'https:') throw fail(400, 'Organization URL must use https.')
  const host = url.hostname.toLowerCase()
  if (host === 'dev.azure.com') {
    const org = url.pathname.split('/').filter(Boolean)[0]
    if (!org) throw fail(400, 'Organization URL must include the organization, e.g. https://dev.azure.com/coaction.')
    return `https://dev.azure.com/${encodeURIComponent(decodeURIComponent(org))}`
  }
  if (host.endsWith('.visualstudio.com')) return `https://${host}`
  throw fail(400, 'Organization URL must be an Azure DevOps URL (dev.azure.com or *.visualstudio.com).')
}

function normalizePath(value) {
  const trimmed = String(value || '/').trim().replace(/\\/g, '/')
  if (trimmed.split('/').includes('..')) throw fail(400, 'API catalog path cannot contain "..".')
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`
}

function authHeader(source) {
  if (source.authMode && source.authMode !== 'Personal access token') {
    throw fail(501, `Auth mode "${source.authMode}" is not configured on the server. Use Personal access token.`)
  }
  const pat = process.env.AZURE_DEVOPS_PAT
  if (!pat) throw fail(503, 'Azure DevOps credentials are not configured on the server (AZURE_DEVOPS_PAT).')
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
}

async function adoGet(url, auth, notFoundMessage) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' }, redirect: 'manual', signal: controller.signal })
  } catch (error) {
    throw fail(502, error.name === 'AbortError' ? 'Azure DevOps did not respond in time.' : `Could not reach Azure DevOps: ${error.message}`)
  } finally {
    clearTimeout(timer)
  }
  // ADO answers a bad PAT with 203 + sign-in HTML or a 302 to the login page.
  const contentType = response.headers.get('content-type') || ''
  if (response.status === 401 || response.status === 403 || response.status === 203 || (response.status >= 300 && response.status < 400) || (response.ok && !contentType.includes('json'))) {
    throw fail(401, 'Azure DevOps rejected the credentials. Check that AZURE_DEVOPS_PAT is valid, not expired, and has Code (Read) scope.')
  }
  if (response.status === 404) throw fail(404, notFoundMessage)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw fail(502, `Azure DevOps error ${response.status}: ${body?.message || response.statusText}`)
  }
  return response.json()
}

export function detectSpec(filePath, content) {
  if (/\.json$/i.test(filePath)) {
    try {
      const doc = JSON.parse(content)
      const version = doc.openapi || doc.swagger
      if (!version) return null
      return { format: doc.openapi ? 'OpenAPI' : 'Swagger', specVersion: String(version), title: doc.info?.title || '', apiVersion: doc.info?.version || '' }
    } catch {
      return null
    }
  }
  const match = content.match(/^(openapi|swagger)\s*:\s*['"]?([^'"\s#]+)/m)
  if (!match) return null
  const title = content.match(/^\s{2}title\s*:\s*['"]?(.+?)['"]?\s*$/m)
  const version = content.match(/^\s{2}version\s*:\s*['"]?(.+?)['"]?\s*$/m)
  return { format: match[1] === 'openapi' ? 'OpenAPI' : 'Swagger', specVersion: match[2], title: title?.[1] || '', apiVersion: version?.[1] || '' }
}

// Validates org/project/repo/branch/path, walks the folder recursively, and returns detected specs with content.
export async function syncAzureSource(source) {
  for (const field of ['organizationUrl', 'project', 'repository', 'branch', 'catalogPath']) {
    if (!String(source[field] || '').trim()) throw fail(400, `${field} is required.`)
  }
  const org = parseOrganizationUrl(source.organizationUrl)
  const scopePath = normalizePath(source.catalogPath)
  const auth = authHeader(source)
  const project = encodeURIComponent(source.project.trim())
  const repoName = encodeURIComponent(source.repository.trim())
  const branch = source.branch.trim().replace(/^refs\/heads\//, '')

  await adoGet(`${org}/_apis/projects/${project}?api-version=${API_VERSION}`, auth, `Project "${source.project}" was not found in ${org}.`)
  const repo = await adoGet(`${org}/${project}/_apis/git/repositories/${repoName}?api-version=${API_VERSION}`, auth, `Repository "${source.repository}" was not found in project "${source.project}".`)
  const refs = await adoGet(`${org}/${project}/_apis/git/repositories/${repo.id}/refs?filter=${encodeURIComponent(`heads/${branch}`)}&api-version=${API_VERSION}`, auth, `Branch "${branch}" was not found.`)
  if (!(refs.value || []).some((ref) => ref.name === `refs/heads/${branch}`)) throw fail(404, `Branch "${branch}" was not found in "${source.repository}".`)

  const version = `versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`
  const tree = await adoGet(
    `${org}/${project}/_apis/git/repositories/${repo.id}/items?scopePath=${encodeURIComponent(scopePath)}&recursionLevel=Full&${version}&api-version=${API_VERSION}`,
    auth,
    `Folder "${scopePath}" was not found on branch "${branch}".`,
  )
  const items = tree.value || []
  const target = scopePath.toLowerCase()
  if (scopePath !== '/' && !items.some((item) => item.isFolder && item.path.replace(/\/+$/, '').toLowerCase() === target)) {
    throw fail(404, `"${scopePath}" is not a folder on branch "${branch}".`)
  }
  const candidates = items.filter((item) => !item.isFolder && item.gitObjectType === 'blob' && SPEC_EXT.test(item.path))

  const files = []
  for (const item of candidates.slice(0, MAX_FILES)) {
    const file = await adoGet(
      `${org}/${project}/_apis/git/repositories/${repo.id}/items?path=${encodeURIComponent(item.path)}&includeContent=true&${version}&api-version=${API_VERSION}`,
      auth,
      `File "${item.path}" disappeared during sync.`,
    )
    const content = typeof file.content === 'string' ? file.content : ''
    if (content.length > MAX_FILE_BYTES) continue
    const spec = detectSpec(item.path, content)
    if (spec) files.push({ path: item.path, objectId: item.objectId, commitId: item.commitId, ...spec, content })
  }

  return {
    repositoryId: repo.id,
    defaultBranch: repo.defaultBranch,
    scannedFiles: candidates.length,
    truncated: candidates.length > MAX_FILES,
    files,
  }
}

export async function ensureCatalogSourcesSchema(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS catalog_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'Azure Repos',
      organization_url TEXT NOT NULL,
      project TEXT NOT NULL,
      repository TEXT NOT NULL,
      branch TEXT NOT NULL,
      catalog_path TEXT NOT NULL,
      auth_mode TEXT NOT NULL,
      sync_mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Needs setup',
      last_sync TIMESTAMPTZ,
      last_error TEXT,
      spec_count INTEGER NOT NULL DEFAULT 0,
      discovered_files JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  console.log('✓ Ensured catalog_sources table exists')
}

function toSource(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    organizationUrl: row.organization_url,
    project: row.project,
    repository: row.repository,
    branch: row.branch,
    catalogPath: row.catalog_path,
    authMode: row.auth_mode,
    syncMode: row.sync_mode,
    status: row.status,
    lastSync: row.last_sync,
    lastError: row.last_error,
    specCount: row.spec_count,
    files: (row.discovered_files || []).map(({ content, ...meta }) => meta),
  }
}

function cleanInput(body) {
  const pick = (key, fallback = '') => String(body?.[key] ?? fallback).trim().slice(0, 500)
  return {
    name: pick('name') || pick('repository') || 'Catalog source',
    provider: 'Azure Repos',
    organizationUrl: pick('organizationUrl'),
    project: pick('project'),
    repository: pick('repository'),
    branch: pick('branch', 'main'),
    catalogPath: pick('catalogPath', '/'),
    authMode: pick('authMode', 'Personal access token'),
    syncMode: pick('syncMode', 'Manual'),
  }
}

async function runSync(query, id) {
  const { rows } = await query('SELECT * FROM catalog_sources WHERE id = $1', [id])
  if (!rows[0]) throw fail(404, 'Catalog source not found.')
  const source = toSource(rows[0])
  try {
    const result = await syncAzureSource(source)
    const updated = await query(
      `UPDATE catalog_sources SET status = 'Connected', last_sync = NOW(), last_error = NULL, spec_count = $2,
         discovered_files = $3::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, result.files.length, JSON.stringify(result.files)],
    )
    return { ok: true, source: toSource(updated.rows[0]), scannedFiles: result.scannedFiles, truncated: result.truncated, files: result.files }
  } catch (error) {
    const message = error.expose ? error.message : 'Sync failed unexpectedly.'
    const updated = await query(
      `UPDATE catalog_sources SET status = 'Error', last_error = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, message],
    )
    if (!error.expose) console.error('[catalog-sources] sync failed:', error)
    return { ok: false, status: error.status || 500, message, source: toSource(updated.rows[0]) }
  }
}

export function registerCatalogSourceRoutes(app, { query }) {
  app.get('/api/catalog-sources', async (_req, res, next) => {
    try {
      const { rows } = await query('SELECT * FROM catalog_sources ORDER BY created_at')
      res.json(rows.map(toSource))
    } catch (error) {
      next(error)
    }
  })

  // Saving always runs a real connection check; the stored status reflects the outcome.
  app.post('/api/catalog-sources', async (req, res, next) => {
    try {
      const input = cleanInput(req.body)
      parseOrganizationUrl(input.organizationUrl)
      const id = randomUUID()
      await query(
        `INSERT INTO catalog_sources (id, name, provider, organization_url, project, repository, branch, catalog_path, auth_mode, sync_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, input.name, input.provider, input.organizationUrl, input.project, input.repository, input.branch, input.catalogPath, input.authMode, input.syncMode],
      )
      res.status(201).json(await runSync(query, id))
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/catalog-sources/:id', async (req, res, next) => {
    try {
      const input = cleanInput(req.body)
      parseOrganizationUrl(input.organizationUrl)
      const { rowCount } = await query(
        `UPDATE catalog_sources SET name=$2, organization_url=$3, project=$4, repository=$5, branch=$6, catalog_path=$7,
           auth_mode=$8, sync_mode=$9, updated_at=NOW() WHERE id=$1`,
        [req.params.id, input.name, input.organizationUrl, input.project, input.repository, input.branch, input.catalogPath, input.authMode, input.syncMode],
      )
      if (!rowCount) throw fail(404, 'Catalog source not found.')
      res.json(await runSync(query, req.params.id))
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/catalog-sources/:id', async (req, res, next) => {
    try {
      await query('DELETE FROM catalog_sources WHERE id = $1', [req.params.id])
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/catalog-sources/:id/sync', async (req, res, next) => {
    try {
      res.json(await runSync(query, req.params.id))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/catalog-sources/sync', async (_req, res, next) => {
    try {
      const { rows } = await query('SELECT id FROM catalog_sources ORDER BY created_at')
      const results = []
      for (const row of rows) results.push(await runSync(query, row.id))
      res.json(results.map(({ files, ...rest }) => rest))
    } catch (error) {
      next(error)
    }
  })
}
