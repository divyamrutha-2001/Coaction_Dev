import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function catalogDir() {
  const configured = process.env.CATALOG_DIR
    ? path.resolve(process.env.CATALOG_DIR)
    : path.join(projectRoot, 'catalog')
  const specDir = path.join(configured, 'openapi')
  if (!specDir.startsWith(configured)) throw new Error('Invalid catalog path')
  return configured
}

function specDir() {
  return path.join(catalogDir(), 'openapi')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

async function git(args) {
  const { stdout } = await execFileAsync('git', ['-C', catalogDir(), '-c', 'core.hooksPath=/dev/null', ...args], {
    timeout: 20000,
    maxBuffer: 1_000_000,
  })
  return stdout.trim()
}

export async function catalogSource() {
  let commit = ''
  let branch = ''
  let remote = ''
  try {
    commit = await git(['rev-parse', '--short', 'HEAD'])
    branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
    remote = await git(['remote', 'get-url', 'origin']).catch(() => '')
  } catch {
    commit = ''
  }
  const files = fs.existsSync(specDir())
    ? fs.readdirSync(specDir()).filter((name) => name.endsWith('.openapi.json'))
    : []
  return {
    path: catalogDir(),
    branch: branch || 'uncommitted',
    commit: commit || 'none',
    remote: remote || '',
    specCount: files.length,
  }
}

function httpsGitUrl(value) {
  return /^https:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(value || '')
}

export async function syncCatalog() {
  let remote = await git(['remote', 'get-url', 'origin']).catch(() => '')
  const configured = process.env.CATALOG_GIT_URL || ''
  if (!remote && configured) {
    if (!httpsGitUrl(configured)) {
      const error = new Error('CATALOG_GIT_URL must be an https git URL.')
      error.status = 400
      error.expose = true
      throw error
    }
    await git(['remote', 'add', 'origin', configured])
    remote = configured
  }
  if (!remote) {
    const source = await catalogSource()
    return { ...source, pulled: false, message: 'This catalog is a local git repo. Add an origin remote when the specs live on a server.' }
  }
  if (!httpsGitUrl(remote)) {
    const error = new Error('Catalog remote must be an https git URL.')
    error.status = 400
    error.expose = true
    throw error
  }
  await git(['pull', '--ff-only'])
  const source = await catalogSource()
  return { ...source, pulled: true, message: 'Catalog updated from git.' }
}

function fieldsFromSchema(schema, section, prefix = '') {
  if (!schema || schema.type !== 'object' || !schema.properties) return []
  const required = new Set(schema.required || [])
  return Object.entries(schema.properties).flatMap(([name, child]) => {
    const fieldName = prefix ? `${prefix}.${name}` : name
    const current = {
      name: fieldName,
      type: child.type || 'string',
      required: section === 'request' ? required.has(name) : true,
      description: child.description || `Value for ${name}.`,
      example: child.example == null ? '' : typeof child.example === 'string' ? child.example : JSON.stringify(child.example),
    }
    if (child.type === 'object') return [current, ...fieldsFromSchema(child, section, fieldName)]
    if (child.type === 'array' && child.items?.type === 'object') {
      return [current, ...fieldsFromSchema(child.items, section, `${fieldName}[]`)]
    }
    return [current]
  })
}

function shapeSpec(fileName, spec, history) {
  const pathName = Object.keys(spec.paths || {})[0]
  const method = Object.keys(spec.paths?.[pathName] || {})[0]
  const operation = spec.paths?.[pathName]?.[method]
  if (!pathName || !method || !operation) return null
  const requestExample = operation.requestBody?.content?.['application/json']?.example ?? null
  const responseCode = Object.keys(operation.responses || {})[0] || '200'
  const responseExample = operation.responses?.[responseCode]?.content?.['application/json']?.example ?? null
  const storedFields = spec.info?.['x-fields']
  const requestSchema = operation.requestBody?.content?.['application/json']?.schema
  const responseSchema = operation.responses?.[responseCode]?.content?.['application/json']?.schema
  const id = fileName.replace(/\.openapi\.json$/, '')
  return {
    id,
    specFile: `openapi/${fileName}`,
    name: spec.info?.title || id,
    desc: spec.info?.description || operation.summary || '',
    endpoint: `${method.toUpperCase()} ${pathName}`,
    method: method.toUpperCase(),
    path: pathName,
    domain: spec.info?.['x-domain'] || 'Uncategorized',
    type: 'REST',
    version: spec.info?.version || 'v1.0',
    lifecycle: spec.info?.['x-lifecycle'] || 'Draft',
    tags: operation.tags || [],
    owner: spec.info?.['x-owner'] || 'Unassigned',
    consumers: Number(spec.info?.['x-consumers'] || 0),
    sampleRequest: requestExample,
    sampleResponse: responseExample,
    responseStatus: Number(responseCode),
    explanations: spec.info?.['x-explanations'] || {},
    document: spec.info?.['x-document'] || null,
    schema: storedFields || {
      pathParameters: (operation.parameters || []).filter((item) => item.in === 'path').map((item) => ({
        name: item.name,
        type: item.schema?.type || 'string',
        required: Boolean(item.required),
        description: item.description || '',
        example: item.schema?.example || '',
      })),
      request: fieldsFromSchema(requestSchema, 'request'),
      response: fieldsFromSchema(responseSchema, 'response'),
    },
    parameters: (operation.parameters || []).map((item) => ({
      name: item.name,
      in: item.in,
      required: Boolean(item.required),
      description: item.description || '',
      example: item.schema?.example ?? '',
    })),
    servers: (spec.servers || []).map((server) => ({ url: server.url, description: server.description || '' })),
    changelog: history,
    createdAt: history[0]?.date || null,
  }
}

async function historyFor(fileName) {
  try {
    const log = await git(['log', '-8', '--format=%h%x09%ad%x09%s', '--date=short', '--', `openapi/${fileName}`])
    if (!log) return []
    return log.split('\n').filter(Boolean).map((line) => {
      const [commit, date, ...rest] = line.split('\t')
      return {
        date,
        version: commit,
        type: 'Git',
        title: rest.join('\t') || 'Spec updated',
        description: `Commit ${commit} changed openapi/${fileName}.`,
        impact: 'Review the spec diff before testing or sharing this API.',
        action: 'Open Try It and send the example request.',
        owner: 'Catalog repo',
      }
    })
  } catch {
    return []
  }
}

export async function listCatalogApis() {
  const dir = specDir()
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.openapi.json')).sort()
  const apis = []
  for (const fileName of files) {
    const spec = readJson(path.join(dir, fileName))
    const history = await historyFor(fileName)
    const shaped = shapeSpec(fileName, spec, history)
    if (shaped) apis.push(shaped)
  }
  return apis
}

export function listCatalogTags(apis) {
  const file = path.join(catalogDir(), 'tags.json')
  const definitions = fs.existsSync(file) ? readJson(file) : []
  const byName = new Map(definitions.map((tag) => [tag.tag, tag]))
  const used = new Map()
  for (const api of apis) {
    for (const tagName of api.tags || []) {
      if (!used.has(tagName)) used.set(tagName, [])
      used.get(tagName).push(api.name)
    }
  }
  const names = new Set([...byName.keys(), ...used.keys()])
  return [...names].map((tagName) => {
    const defined = byName.get(tagName)
    const apisUsing = used.get(tagName) || []
    return {
      tag: tagName,
      category: defined?.category || 'Uncategorized',
      description: defined?.description || 'Tag found on an OpenAPI spec.',
      owner: defined?.owner || 'Needs owner',
      rules: defined?.rules || [],
      color: defined?.color || '',
      background: defined?.background || '',
      apis: apisUsing,
      count: apisUsing.length,
    }
  }).sort((a, b) => a.category.localeCompare(b.category) || a.tag.localeCompare(b.tag))
}

function loadOperation(specId) {
  if (!SPEC_ID.test(specId)) {
    const error = new Error('Unknown API spec.')
    error.status = 400
    error.expose = true
    throw error
  }
  const fileName = `${specId}.openapi.json`
  const file = path.join(specDir(), fileName)
  if (!file.startsWith(specDir() + path.sep) || !fs.existsSync(file)) {
    const error = new Error('Unknown API spec.')
    error.status = 400
    error.expose = true
    throw error
  }
  const spec = readJson(file)
  const pathName = Object.keys(spec.paths || {})[0]
  const method = Object.keys(spec.paths?.[pathName] || {})[0]
  const operation = spec.paths?.[pathName]?.[method]
  return { spec, pathName, method, operation, fileName }
}

export function postmanCollection(specId) {
  const { spec, pathName, method, operation } = loadOperation(specId)
  const example = operation.requestBody?.content?.['application/json']?.example
  return {
    info: {
      name: spec.info?.title || specId,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [{ key: 'baseUrl', value: 'sandbox://spec' }],
    item: [
      {
        name: spec.info?.title || specId,
        request: {
          method: method.toUpperCase(),
          header: [{ key: 'Content-Type', value: 'application/json' }],
          url: `{{baseUrl}}${pathName}`,
          description: spec.info?.description || '',
          body: example ? { mode: 'raw', raw: JSON.stringify(example, null, 2) } : undefined,
        },
      },
    ],
  }
}

function fillPath(apiPath, pathParams) {
  return String(apiPath).replace(/\{([^}]+)\}/g, (_match, name) => {
    const value = pathParams?.[name]
    if (value == null || value === '') {
      const error = new Error('Check the required fields and try again.')
      error.status = 400
    error.expose = true
      throw error
    }
    return encodeURIComponent(String(value))
  })
}

function explainStatus(status) {
  if (status >= 200 && status < 300) return 'The API accepted the request.'
  if (status === 400) return 'The API rejected the request because something was missing or invalid.'
  if (status === 401 || status === 403) return 'The API refused the request because this caller is not allowed.'
  if (status === 404) return 'The API could not find that record.'
  if (status >= 500) return 'The API server had a problem and did not finish the request.'
  return `The API returned status ${status}.`
}

function assertLiveUrl(target) {
  let url
  try {
    url = new URL(target)
  } catch {
    const error = new Error('This spec does not have a live server URL yet.')
    error.status = 400
    error.expose = true
    throw error
  }
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) {
    const error = new Error('Live tests only allow http and https servers from the spec.')
    error.status = 400
    error.expose = true
    throw error
  }
  const allow = (process.env.API_TEST_ALLOWLIST || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)
  if (!allow.includes(url.hostname.toLowerCase())) {
    const error = new Error('This server is not on the test allowlist. Use the sandbox, or add the host to API_TEST_ALLOWLIST.')
    error.status = 400
    error.expose = true
    throw error
  }
  return url
}

function typeMatches(value, type) {
  if (type === 'string') return typeof value === 'string'
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  return true
}

function validateRequest(operation, input) {
  const checks = []
  for (const parameter of operation.parameters || []) {
    if (parameter.in !== 'path') continue
    const value = input.pathParams?.[parameter.name]
    const ok = value != null && String(value).trim() !== ''
    checks.push({
      name: parameter.name,
      ok,
      message: ok ? `${parameter.name} is filled in.` : `${parameter.name} is required in the path.`,
    })
  }
  const schema = operation.requestBody?.content?.['application/json']?.schema
  if (schema?.type === 'object') {
    const body = input.body
    const isObject = Boolean(body) && typeof body === 'object' && !Array.isArray(body)
    if (!isObject) {
      checks.push({ name: 'body', ok: false, message: 'The request body must be a JSON object.' })
    } else {
      for (const [name, property] of Object.entries(schema.properties || {})) {
        const required = (schema.required || []).includes(name)
        const value = body[name]
        const missing = value == null || value === ''
        if (missing && required) {
          checks.push({ name, ok: false, message: `${name} is required.` })
        } else if (!missing && property.type && !typeMatches(value, property.type)) {
          checks.push({ name, ok: false, message: `${name} should be a ${property.type}.` })
        } else if (!missing) {
          checks.push({ name, ok: true, message: `${name} looks right.` })
        }
      }
    }
  }
  return checks
}

export async function tryOperation(input) {
  const { spec, pathName, method, operation } = loadOperation(input.specId)
  const mode = input.mode === 'live' ? 'live' : 'sandbox'
  const responseCode = Object.keys(operation.responses || {})[0] || '200'
  const example = operation.responses?.[responseCode]?.content?.['application/json']?.example ?? {}
  const checks = validateRequest(operation, input)
  const failed = checks.filter((check) => !check.ok)
  if (failed.length) {
    return {
      mode,
      status: 400,
      ok: false,
      summary: `This request does not match the spec. ${failed[0].message}`,
      checks,
      body: null,
    }
  }
  if (mode === 'sandbox') {
    const status = Number(responseCode)
    return {
      mode,
      status,
      ok: status >= 200 && status < 300,
      summary: `Request matches the spec. ${explainStatus(status)} This is the sample response from the OpenAPI file.`,
      checks,
      body: example,
    }
  }
  const server = (spec.servers || []).find((item) => /^https?:\/\//.test(item.url || ''))
  if (!server) {
    const error = new Error('This spec only has a sandbox server. Add an https server URL to the OpenAPI file to call a real API.')
    error.status = 400
    error.expose = true
    throw error
  }
  const pathValue = fillPath(pathName, input.pathParams || {})
  const url = assertLiveUrl(new URL(pathValue, server.url.endsWith('/') ? server.url : `${server.url}/`).toString())
  const headers = { accept: 'application/json' }
  let body
  if (input.body != null && !['get', 'head'].includes(method)) {
    body = JSON.stringify(input.body)
    headers['content-type'] = 'application/json'
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { method: method.toUpperCase(), headers, body, redirect: 'manual', signal: controller.signal })
    const text = await response.text()
    const trimmed = text.slice(0, 100_000)
    let parsed = trimmed
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      parsed = trimmed
    }
    return {
      mode,
      status: response.status,
      ok: response.ok,
      summary: explainStatus(response.status),
      checks,
      body: parsed,
    }
  } catch {
    const error = new Error('The live API did not respond.')
    error.status = 502
    error.expose = true
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function writeSpec(payload) {
  const id = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (!SPEC_ID.test(id)) {
    const error = new Error('Check the required fields and try again.')
    error.status = 400
    error.expose = true
    throw error
  }
  const endpoint = String(payload.endpoint || '').trim().match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)$/i)
  const method = endpoint ? endpoint[1].toLowerCase() : 'get'
  const apiPath = endpoint ? endpoint[2] : `/${id}`
  const spec = {
    openapi: '3.0.3',
    info: {
      title: payload.name,
      version: payload.version || 'v1.0',
      description: payload.desc || payload.name,
      'x-domain': payload.domain,
      'x-owner': payload.owner,
      'x-lifecycle': payload.lifecycle || 'Draft',
      'x-explanations': {
        Business: { summary: payload.desc || payload.name, evaluates: [], returns: [] },
        Developer: { summary: payload.desc || payload.name, evaluates: [], returns: [] },
        Partner: { summary: payload.desc || payload.name, evaluates: [], returns: [] },
      },
    },
    servers: [{ url: 'sandbox://spec', description: 'Sandbox. Try It returns the example saved in this file.' }],
    paths: {
      [apiPath]: {
        [method]: {
          operationId: id,
          summary: payload.desc || payload.name,
          tags: payload.tags || [],
          responses: {
            '200': {
              description: payload.desc || 'Example response',
              content: { 'application/json': { example: payload.sampleResponse || { ok: true } } },
            },
          },
          ...(payload.sampleRequest
            ? { requestBody: { required: true, content: { 'application/json': { example: payload.sampleRequest } } } }
            : {}),
        },
      },
    },
  }
  const dir = specDir()
  fs.mkdirSync(dir, { recursive: true })
  const fileName = `${id}.openapi.json`
  const file = path.join(dir, fileName)
  if (!file.startsWith(dir + path.sep)) {
    const error = new Error('Check the required fields and try again.')
    error.status = 400
    error.expose = true
    throw error
  }
  fs.writeFileSync(file, `${JSON.stringify(spec, null, 2)}\n`)
  await git(['add', '--', `openapi/${fileName}`])
  await git(['-c', 'user.name=CoAction Workbench', '-c', 'user.email=workbench@local', 'commit', '-m', `Add ${payload.name} spec`]).catch((error) => {
    if (!/nothing to commit/i.test(String(error.stderr || error.stdout || error.message))) throw error
  })
  const apis = await listCatalogApis()
  return apis.find((api) => api.id === id)
}
