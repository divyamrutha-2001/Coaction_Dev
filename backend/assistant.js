// Answers catalog and request questions from the specs themselves, so every claim is traceable.
// Retrieval and intent matching are deterministic; pass `options.generate` to hand the same
// grounded context to a real model later without changing callers.

const STOPWORDS = new Set([
  'a', 'about', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'by', 'call', 'called', 'can', 'do',
  'does', 'for', 'from', 'get', 'give', 'has', 'have', 'how', 'i', 'in', 'into', 'is', 'it', 'its',
  'me', 'my', 'need', 'of', 'on', 'or', 'our', 'please', 'show', 'tell', 'that', 'the', 'their',
  'there', 'these', 'this', 'those', 'to', 'use', 'used', 'want', 'was', 'what', 'when', 'where',
  'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
])

const MAX_QUESTION = 500

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
}

function singular(word) {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  return word
}

function fieldNames(spec) {
  const schema = spec.schema || {}
  return [...(schema.pathParameters || []), ...(schema.request || []), ...(schema.response || [])]
    .map((field) => field.name)
}

// Weighted so a name or domain hit outranks an incidental word in a description.
function scoreSpec(spec, tokens) {
  if (!tokens.length) return 0
  const zones = [
    { weight: 12, text: spec.name },
    { weight: 8, text: spec.domain },
    { weight: 6, text: (spec.tags || []).join(' ') },
    { weight: 5, text: spec.path },
    { weight: 4, text: fieldNames(spec).join(' ') },
    { weight: 3, text: spec.desc },
    { weight: 3, text: spec.document?.whenToUse },
    { weight: 2, text: spec.document?.purpose },
    { weight: 2, text: (spec.document?.notes || []).join(' ') },
    { weight: 2, text: (spec.document?.errors || []).join(' ') },
    { weight: 2, text: summariesOf(spec) },
    { weight: 1, text: spec.owner },
  ]

  let score = 0
  for (const zone of zones) {
    const haystack = String(zone.text || '').toLowerCase()
    if (!haystack) continue
    for (const token of tokens) {
      if (haystack.includes(token) || haystack.includes(singular(token))) score += zone.weight
    }
  }
  return score
}

function summariesOf(spec) {
  return Object.values(spec.explanations || {})
    .map((entry) => [entry?.summary, ...(entry?.evaluates || []), ...(entry?.returns || [])].join(' '))
    .join(' ')
}

function rankSpecs(apis, question, limit = 3) {
  const tokens = tokenize(question)
  return apis
    .map((spec) => ({ spec, score: scoreSpec(spec, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.spec.name.localeCompare(b.spec.name))
    .slice(0, limit)
}

function sourceOf(spec) {
  return { id: spec.id, name: spec.name, endpoint: spec.endpoint, domain: spec.domain }
}

// Specs carry placeholder servers like `sandbox://spec`, so only trust real HTTP URLs.
function baseUrlOf(spec, fallback) {
  const declared = spec.servers?.[0]?.url || ''
  return /^https?:\/\//i.test(declared) ? declared : (fallback || '')
}

function curlFor(spec, baseUrl) {
  const path = String(spec.path || '').replace(/\{(\w+)\}/g, (_match, name) => `<${name}>`)
  const lines = [`curl -X ${spec.method} "${baseUrlOf(spec, baseUrl)}${path}"`, `  -H "Content-Type: application/json"`]
  if (spec.sampleRequest && spec.method !== 'GET') {
    lines.push(`  -d '${JSON.stringify(spec.sampleRequest)}'`)
  }
  return lines.join(' \\\n')
}

function requiredFieldsOf(spec) {
  const schema = spec.schema || {}
  return [
    ...(schema.pathParameters || []).map((field) => ({ ...field, required: true, in: 'path' })),
    ...(schema.request || []).filter((field) => field.required).map((field) => ({ ...field, in: 'body' })),
  ]
}

function bullet(items) {
  return items.map((line) => `• ${line}`).join('\n')
}

function describeSpec(spec) {
  const detail = spec.document?.purpose || spec.desc
  return `${spec.name} — ${detail}`
}

// --- intent handlers -------------------------------------------------------

function answerFields(spec) {
  const schema = spec.schema || {}
  const required = requiredFieldsOf(spec)
  const optional = (schema.request || []).filter((field) => !field.required)
  const parts = [`${spec.name} takes ${required.length} required ${required.length === 1 ? 'value' : 'values'}.`]

  if (required.length) {
    parts.push(`\nRequired:\n${bullet(required.map((f) => `${f.name} (${f.type}, ${f.in}) — ${f.description}`))}`)
  }
  if (optional.length) {
    parts.push(`\nOptional:\n${bullet(optional.map((f) => `${f.name} (${f.type}) — ${f.description}`))}`)
  }
  if (!required.length && !optional.length) {
    parts.push('It takes no request body or path parameters.')
  }
  return parts.join('\n')
}

function answerResponse(spec) {
  const fields = spec.schema?.response || []
  const head = `${spec.name} returns ${spec.responseStatus || 200} with ${fields.length} ${fields.length === 1 ? 'field' : 'fields'}.`
  if (!fields.length) return head
  return `${head}\n\n${bullet(fields.map((f) => `${f.name} (${f.type}) — ${f.description}`))}`
}

function answerErrors(spec) {
  const errors = spec.document?.errors || []
  if (!errors.length) return `${spec.name} does not list named error cases in its spec.`
  return `${spec.name} documents these failure cases:\n\n${bullet(errors)}\n\nA request that does not match the spec is rejected before it is sent, so check required values first.`
}

function answerHowToCall(spec, baseUrl) {
  const required = requiredFieldsOf(spec)
  const lines = [`Call ${spec.endpoint}.`]
  if (spec.document?.whenToUse) lines.push(spec.document.whenToUse)
  if (required.length) lines.push(`\nYou must supply: ${required.map((f) => f.name).join(', ')}.`)
  return { answer: lines.join('\n'), code: { label: 'curl', body: curlFor(spec, baseUrl) } }
}

function answerSample(spec) {
  const payload = spec.method === 'GET' ? spec.sampleResponse : spec.sampleRequest
  const label = spec.method === 'GET' ? 'Example response' : 'Example request body'
  if (!payload) return { answer: `${spec.name} has no stored example payload.` }
  return {
    answer: `${label} for ${spec.name}, taken from its spec.`,
    code: { label, body: JSON.stringify(payload, null, 2) },
  }
}

function answerExplain(spec, audience) {
  const entry = spec.explanations?.[audience] || spec.explanations?.Business
  if (!entry) return describeSpec(spec)
  const parts = [entry.summary]
  if (entry.evaluates?.length) parts.push(`\nIt looks at:\n${bullet(entry.evaluates)}`)
  if (entry.returns?.length) parts.push(`\nIt gives back:\n${bullet(entry.returns)}`)
  return parts.join('\n')
}

function answerCatalogOverview(apis) {
  const byDomain = apis.reduce((acc, spec) => {
    acc[spec.domain] = (acc[spec.domain] || 0) + 1
    return acc
  }, {})
  const domains = Object.entries(byDomain)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => `${domain} — ${count} ${count === 1 ? 'API' : 'APIs'}`)
  return `The catalog holds ${apis.length} APIs across ${Object.keys(byDomain).length} domains.\n\n${bullet(domains)}`
}

function answerDomain(apis, domain) {
  const matches = apis.filter((spec) => spec.domain.toLowerCase() === domain.toLowerCase())
  return {
    answer: `${matches.length} ${matches.length === 1 ? 'API is' : 'APIs are'} in ${matches[0]?.domain || domain}:\n\n${bullet(matches.map(describeSpec))}`,
    sources: matches.map(sourceOf),
  }
}

// --- main ------------------------------------------------------------------

export async function answerQuestion({ question, context = {} }, { apis, baseUrl, generate } = {}) {
  const asked = String(question || '').slice(0, MAX_QUESTION).trim()
  if (!asked) {
    return { answer: 'Ask about an API, the values it needs, or why a request failed.', sources: [], followUps: starterQuestions(apis) }
  }

  const lower = asked.toLowerCase()
  const catalog = apis || []
  const focused = context.specId ? catalog.find((spec) => spec.id === context.specId) : null
  const ranked = rankSpecs(catalog, asked)
  // The open API wins ties, since "what does this need?" nearly always means the one on screen.
  const target = (focused && (!ranked.length || ranked[0].score < 12)) ? focused : ranked[0]?.spec || focused

  const grounded = {
    question: asked,
    focusedSpecId: focused?.id || null,
    candidates: ranked.map((entry) => entry.spec.id),
  }
  if (typeof generate === 'function') {
    const produced = await generate({ ...grounded, specs: ranked.map((entry) => entry.spec), focused })
    if (produced) return { ...produced, sources: produced.sources || ranked.map((entry) => sourceOf(entry.spec)) }
  }

  const domainHit = catalog.find((spec) => lower.includes(spec.domain.toLowerCase()))
  const wantsList = /\b(list|all|how many|catalog|overview|what apis|which apis)\b/.test(lower)

  if (wantsList && domainHit && !/\ball apis\b/.test(lower)) {
    const result = answerDomain(catalog, domainHit.domain)
    return { ...result, followUps: ['How do I call it?', 'What values does it need?'] }
  }
  if (wantsList) {
    return { answer: answerCatalogOverview(catalog), sources: [], followUps: starterQuestions(catalog) }
  }

  if (!target) {
    return {
      answer: `Nothing in the catalog matches that. The workbench only knows the ${catalog.length} published specs, so try an API name, a domain like Claims or Underwriting, or a field name.`,
      sources: [],
      followUps: starterQuestions(catalog),
    }
  }

  const sources = [sourceOf(target)]
  const alternates = ranked.filter((entry) => entry.spec.id !== target.id).map((entry) => sourceOf(entry.spec))
  const followUps = ['What values does it need?', 'How do I call it?', 'What can go wrong?']

  if (/\b(error|fail|failed|failing|reject|invalid|wrong|4\d\d|5\d\d|problem|issue)\b/.test(lower)) {
    return { answer: answerErrors(target), sources, alternates, followUps }
  }
  if (/\b(field|fields|value|values|param|parameter|parameters|require|required|body|payload|input|send)\b/.test(lower)) {
    return { answer: answerFields(target), sources, alternates, followUps }
  }
  if (/\b(return|returns|response|output|back|result)\b/.test(lower)) {
    return { answer: answerResponse(target), sources, alternates, followUps }
  }
  if (/\b(sample|example|payload|json|body)\b/.test(lower)) {
    return { ...answerSample(target), sources, alternates, followUps }
  }
  if (/\b(call|curl|invoke|request|endpoint|url|test|try)\b/.test(lower)) {
    return { ...answerHowToCall(target, baseUrl), sources, alternates, followUps }
  }

  const audience = /\b(developer|technical|code|schema)\b/.test(lower) ? 'Developer' : 'Business'
  return { answer: answerExplain(target, audience), sources, alternates, followUps }
}

export function starterQuestions(apis = []) {
  const sample = apis[0]?.name
  return [
    'Which APIs are in Claims?',
    sample ? `What values does ${sample} need?` : 'What values does it need?',
    'How many APIs are in the catalog?',
  ]
}

export function requestHelp({ specId, status, error }, { apis, baseUrl } = {}) {
  const spec = (apis || []).find((item) => item.id === specId)
  if (!spec) return { answer: 'Pick an API first and I can check the request against its spec.', sources: [] }

  const required = requiredFieldsOf(spec)
  const parts = []

  if (status && Number(status) >= 400) {
    parts.push(`Status ${status} means the call reached the API but was refused.`)
  }
  if (error) parts.push(`Reported problem: ${error}`)

  parts.push(required.length
    ? `${spec.name} needs these before it will pass:\n${bullet(required.map((f) => `${f.name} (${f.type}, ${f.in})`))}`
    : `${spec.name} needs no required values.`)

  const documented = spec.document?.errors || []
  if (documented.length) parts.push(`\nKnown failure cases:\n${bullet(documented)}`)

  return {
    answer: parts.join('\n\n'),
    code: spec.sampleRequest && spec.method !== 'GET'
      ? { label: 'Known-good body', body: JSON.stringify(spec.sampleRequest, null, 2) }
      : { label: 'curl', body: curlFor(spec, baseUrl) },
    sources: [sourceOf(spec)],
    followUps: ['What can go wrong?', 'What does it return?'],
  }
}
