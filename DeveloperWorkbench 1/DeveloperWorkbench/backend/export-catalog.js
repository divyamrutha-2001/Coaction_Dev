import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apis } from '../src/data/apis.js'
import { samplePayloads } from '../src/data/samplePayloads.js'
import { SEED_EXPLANATIONS } from '../src/data/explanations.js'
import { getApiDocument } from '../src/data/apiDocuments.js'
import { getApiSchema } from '../src/data/schemas.js'
import { tagDefinitions } from './seed/reference.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../catalog')
const specDir = path.join(root, 'openapi')

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function splitEndpoint(endpoint) {
  const match = String(endpoint || '').trim().match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i)
  if (!match) return { method: 'get', path: String(endpoint || '').trim() }
  return { method: match[1].toLowerCase(), path: match[2] }
}

function schemaFor(value, optionalNames = new Set()) {
  if (Array.isArray(value)) {
    return { type: 'array', items: value.length ? schemaFor(value[0], optionalNames) : { type: 'string' } }
  }
  if (value && typeof value === 'object') {
    const properties = {}
    const required = []
    for (const [key, child] of Object.entries(value)) {
      properties[key] = schemaFor(child, optionalNames)
      if (!optionalNames.has(key)) required.push(key)
    }
    return { type: 'object', properties, ...(required.length ? { required } : {}) }
  }
  if (typeof value === 'boolean') return { type: 'boolean', example: value }
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number', example: value }
  return { type: 'string', example: value == null ? '' : value }
}

function parameters(apiPath) {
  return [...String(apiPath).matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    description: `${match[1]} identifies the record you want.`,
    schema: {
      type: 'string',
      example: match[1].toLowerCase().includes('policy')
        ? 'POL-2026-98765'
        : match[1].toLowerCase().includes('claim')
          ? 'CLM-2026-45021'
          : match[1].toLowerCase().includes('account')
            ? 'ACC-10045'
            : 'SUB-2026-10452',
    },
  }))
}

fs.mkdirSync(specDir, { recursive: true })

const index = []
for (const api of apis) {
  const { method, path: apiPath } = splitEndpoint(api.endpoint)
  const payload = samplePayloads[api.name] || {}
  const operationKey = `${method.toUpperCase()} ${apiPath}`
  const document = getApiDocument(api, method.toUpperCase(), apiPath)
  const fields = getApiSchema(api, payload, apiPath)
  const success = method === 'post' ? '201' : '200'
  const operation = {
    operationId: slug(api.name),
    summary: api.desc,
    tags: api.tags,
    parameters: parameters(apiPath),
    responses: {
      [success]: {
        description: document.whenToUse,
        content: {
          'application/json': {
            schema: schemaFor(payload.response || {}),
            example: payload.response || {},
          },
        },
      },
    },
  }
  if (payload.request) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: schemaFor(payload.request, new Set(['annualRevenue', 'priorLossCount', 'priorLossAmount', 'employeeCount', 'yearsInBusiness', 'invoiceNumber'])),
          example: payload.request,
        },
      },
    }
  }
  const spec = {
    openapi: '3.0.3',
    info: {
      title: api.name,
      version: api.version,
      description: api.desc,
      'x-domain': api.domain,
      'x-owner': api.owner,
      'x-lifecycle': api.lifecycle,
      'x-consumers': api.consumers,
      'x-document': document,
      'x-explanations': SEED_EXPLANATIONS[operationKey] || {
        Business: { summary: api.desc, evaluates: [operationKey], returns: ['The example response in this spec'] },
        Developer: { summary: api.desc, evaluates: [operationKey], returns: ['The example response in this spec'] },
        Partner: { summary: api.desc, evaluates: [operationKey], returns: ['The example response in this spec'] },
      },
      'x-fields': fields,
    },
    servers: [
      { url: 'sandbox://spec', description: 'Sandbox. Try It returns the example saved in this file.' },
    ],
    paths: {
      [apiPath]: { [method]: operation },
    },
  }
  const file = `${slug(api.name)}.openapi.json`
  fs.writeFileSync(path.join(specDir, file), `${JSON.stringify(spec, null, 2)}\n`)
  index.push({ file, name: api.name, method: method.toUpperCase(), path: apiPath })
}

fs.writeFileSync(path.join(root, 'tags.json'), `${JSON.stringify(tagDefinitions, null, 2)}\n`)
fs.writeFileSync(path.join(root, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
console.log(`Wrote ${index.length} OpenAPI specs to ${specDir}`)
