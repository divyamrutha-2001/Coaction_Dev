import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Download as DownloadIcon,
  Play,
  Plus,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Terminal,
  FileCode,
  BookOpen,
  Zap,
  CheckCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import { apiClient } from '../services/apiClient'
import { getSamplePayload } from '../data/samplePayloads'
import { getExplanation, getAvailableAudiences } from '../data/explanations'

const METHOD_COLORS = {
  GET: { bg: 'hsl(172 66% 50% / 0.18)', color: 'hsl(172 66% 25%)' },
  POST: { bg: 'hsl(214 58% 29% / 0.14)', color: 'hsl(var(--primary))' },
  PUT: { bg: 'hsl(221 83% 60% / 0.15)', color: 'hsl(var(--secondary))' },
  DELETE: { bg: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' },
}

function inferMethod(api) {
  const ep = String(api.endpoint || '').trim().toUpperCase()
  if (ep.startsWith('POST')) return 'POST'
  if (ep.startsWith('PUT')) return 'PUT'
  if (ep.startsWith('DELETE')) return 'DELETE'
  if (ep.startsWith('GET')) return 'GET'
  if (api.type === 'SOAP') return 'POST'
  return 'GET'
}

function endpointPath(api) {
  const raw = String(api.endpoint || '')
  const match = raw.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.*)$/i)
  if (match) return match[2]
  return raw
}

function MethodBadge({ method }) {
  const s = METHOD_COLORS[method] || METHOD_COLORS.GET
  return (
    <span
      className="inline-flex items-center rounded-md text-xs font-bold uppercase"
      style={{ backgroundColor: s.bg, color: s.color, padding: '0.25rem 0.5rem', letterSpacing: '0.05em' }}
    >
      {method}
    </span>
  )
}

function buildCurl(api) {
  const method = inferMethod(api)
  const path = endpointPath(api)
  const payload = getSamplePayload(api)
  const bodyPart = payload?.request
    ? ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(payload.request)}'`
    : ''
  return `curl -X ${method} '${path}' \\\n  -H 'Authorization: Bearer YOUR_TOKEN' \\\n  -H 'Accept: application/json'${bodyPart}`
}

function buildNodeSample(api) {
  const method = inferMethod(api)
  const path = endpointPath(api)
  const payload = getSamplePayload(api)
  const bodyPart = payload?.request
    ? `,\n  body: JSON.stringify(${JSON.stringify(payload.request, null, 2).replace(/\n/g, '\n  ')}),`
    : ''
  const contentType = payload?.request
    ? `\n    'Content-Type': 'application/json',`
    : ''
  return `const response = await fetch('${path}', {\n  method: '${method}',\n  headers: {\n    Authorization: 'Bearer ' + process.env.TOKEN,${contentType}\n    Accept: 'application/json',\n  }${bodyPart}\n})\nconst data = await response.json()`
}

function buildPythonSample(api) {
  const method = inferMethod(api)
  const path = endpointPath(api)
  const payload = getSamplePayload(api)
  const bodyPart = payload?.request
    ? `,\n    json=${JSON.stringify(payload.request, null, 2).replace(/\n/g, '\n    ')}`
    : ''
  return `import os, requests\n\nresponse = requests.${method.toLowerCase()}(\n    '${path}',\n    headers={\n        'Authorization': f\"Bearer {os.environ['TOKEN']}\",\n        'Accept': 'application/json',\n    }${bodyPart},\n)\ndata = response.json()`
}

function buildOpenApiYaml(api) {
  const method = inferMethod(api).toLowerCase()
  const path = endpointPath(api)
  return [
    'openapi: 3.0.0',
    'info:',
    `  title: ${api.name}`,
    `  version: "${api.version}"`,
    `  description: ${JSON.stringify(api.desc || '')}`,
    'servers:',
    '  - url: https://api.coaction.com',
    'paths:',
    `  ${path.startsWith('/') ? path : '/' + path}:`,
    `    ${method}:`,
    `      summary: ${api.name}`,
    `      operationId: ${api.name.replace(/\s+/g, '')}`,
    '      responses:',
    "        '200':",
    '          description: Successful response',
    '',
  ].join('\n')
}

function buildPostmanCollection(api) {
  const method = inferMethod(api)
  const path = endpointPath(api)
  return {
    info: {
      name: api.name,
      _postman_id: `coaction-${api.id ?? api.name.replace(/\s+/g, '-').toLowerCase()}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: api.desc || '',
    },
    item: [
      {
        name: api.name,
        request: {
          method,
          header: [
            { key: 'Authorization', value: 'Bearer {{token}}' },
            { key: 'Accept', value: 'application/json' },
          ],
          url: {
            raw: `https://api.coaction.com${path.startsWith('/') ? path : '/' + path}`,
            protocol: 'https',
            host: ['api', 'coaction', 'com'],
            path: path.replace(/^\//, '').split('/'),
          },
        },
      },
    ],
    variable: [{ key: 'token', value: 'YOUR_TOKEN' }],
  }
}

function downloadBlob(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Toast({ message, type }) {
  if (!message) return null
  const isError = type === 'error'
  return (
    <div
      className="flex items-center gap-3 rounded-lg shadow-lg"
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: 50,
        backgroundColor: isError ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--accent) / 0.18)',
        color: isError ? 'hsl(var(--destructive))' : 'hsl(172 66% 25%)',
        border: `1px solid ${isError ? 'hsl(var(--destructive) / 0.35)' : 'hsl(var(--accent) / 0.45)'}`,
        padding: '0.75rem 1rem',
      }}
    >
      {isError ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}

// — DIFF: ExplainPanel component for inline card expansion
function ExplainPanel({ api, method, path, onCacheUpdate }) {
  const [isLoading, setIsLoading] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [audience, setAudience] = useState('Developer')
  const [timestamp, setTimestamp] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')

  const loadExplanation = (aud = audience) => {
    setIsLoading(true)
    // Simulate loading delay
    setTimeout(() => {
      const exp = getExplanation(method, path, aud)
      setExplanation(exp)
      setTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
      onCacheUpdate(true)
      setIsLoading(false)
    }, 400)
  }

  useEffect(() => {
    loadExplanation()
  }, [])

  const handleAudienceChange = (aud) => {
    setAudience(aud)
    setFeedback(null)
    setIsLoading(true)
    setTimeout(() => {
      const exp = getExplanation(method, path, aud)
      setExplanation(exp)
      setTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
      setIsLoading(false)
    }, 300)
  }

  const handleCopy = () => {
    if (!explanation) return
    const text = `${explanation.summary}\n\nWhat it evaluates:\n${explanation.evaluates.join('\n')}\n\nWhat you get back:\n${explanation.returns.join('\n')}`
    navigator.clipboard.writeText(text)
  }

  const handleSaveAsDescription = async () => {
    if (!explanation) return
    setSaveMessage('Saved as description')
    setTimeout(() => setSaveMessage(''), 2000)
    // In future: call API to persist explanation to catalog
  }

  const availableAudiences = getAvailableAudiences(method, path)

  return (
    <div 
      className="mt-2 p-4 rounded-lg"
      style={{
        backgroundColor: 'hsl(var(--primary) / 0.08)',
        border: '1px solid hsl(var(--primary) / 0.25)',
      }}
    >
      {/* Header with label and audience buttons */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted uppercase tracking-wider">generated summary</p>
        <div className="flex gap-2">
          {availableAudiences.map((aud) => (
            <button
              key={aud}
              onClick={() => handleAudienceChange(aud)}
              type="button"
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                audience === aud
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent border border-border text-foreground hover:bg-muted/20'
              }`}
            >
              {aud}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State — skeleton lines with shimmer */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-3 bg-muted/30 rounded"
              style={{
                width: `${85 - i * 15}%`,
                animation: 'shimmer 2s infinite',
              }}
            />
          ))}
        </div>
      ) : explanation ? (
        <div className="space-y-4">
          {/* Main explanation — larger, prominent */}
          <p className="text-sm font-semibold text-foreground leading-relaxed">
            {explanation.summary}
          </p>

          {/* What it evaluates */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wider font-medium mb-2">
              what it evaluates
            </p>
            <ul className="space-y-1.5 text-foreground ml-4">
              {explanation.evaluates.slice(0, 3).map((item, idx) => (
                <li key={idx} className="list-disc text-xs leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What you get back */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wider font-medium mb-2">
              what you get back
            </p>
            <ul className="space-y-1.5 text-foreground ml-4">
              {explanation.returns.slice(0, 2).map((item, idx) => (
                <li key={idx} className="list-disc text-xs leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer strip */}
          <div className="pt-3 mt-1 border-t border-border flex items-center justify-between">
            <code className="text-muted font-mono text-xs">
              spec v{api.version} · {timestamp}
            </code>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                className={`p-1.5 rounded transition-colors ${
                  feedback === 'up'
                    ? 'bg-muted/40 text-foreground'
                    : 'text-muted hover:bg-muted/20'
                }`}
                title="Helpful"
              >
                <ThumbsUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => loadExplanation(audience)}
                className="p-1.5 rounded text-muted hover:bg-muted/20 transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded text-muted hover:bg-muted/20 transition-colors"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleSaveAsDescription}
                className="px-2 py-1.5 rounded text-muted hover:bg-muted/20 transition-colors text-sm"
                title="Save as description"
              >
                Save as description
              </button>
            </div>
          </div>
          {saveMessage && (
            <p className="text-xs text-muted text-right italic">{saveMessage}</p>
          )}
        </div>
      ) : null}

      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

export default function ApiLibrary() {
  const navigate = useNavigate()
  const [selectedTags, setSelectedTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPreview, setExpandedPreview] = useState(null)
  const [expandedExplain, setExpandedExplain] = useState(null)
  const [explanationCache, setExplanationCache] = useState({})
  const [previewLang, setPreviewLang] = useState({})
  const [activeTestMenu, setActiveTestMenu] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const testMenuRef = useRef(null)

  useEffect(() => {
    if (!activeTestMenu) return
    function onDocClick(e) {
      if (testMenuRef.current && !testMenuRef.current.contains(e.target)) {
        setActiveTestMenu(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [activeTestMenu])

  function notify(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }

  const { data: apis = [], isLoading } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  const allTags = useMemo(() => {
    const tags = new Set()
    apis.forEach(api => {
      if (api.tags && Array.isArray(api.tags)) {
        api.tags.forEach(tag => tags.add(tag))
      }
    })
    return Array.from(tags).sort()
  }, [apis])

  const stats = useMemo(() => {
    return {
      total: apis.length,
      beta: apis.filter(a => a.status === 'beta').length,
      internal: apis.filter(a => a.type === 'Internal').length,
    }
  }, [apis])

  const filtered = useMemo(() => {
    return apis.filter((api) => {
      const tagFilter = selectedTags.length === 0 || (api.tags && api.tags.some(tag => selectedTags.includes(tag)))
      const searchFilter = searchQuery === '' || 
        api.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (api.desc && api.desc.toLowerCase().includes(searchQuery.toLowerCase()))
      return tagFilter && searchFilter
    })
  }, [apis, selectedTags, searchQuery])

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleDownload = async (api) => {
    try {
      await apiClient.createDownload({ 
        artifact: `${api.name}-${api.version}.zip`,
        api: api.name,
        apiId: api.id,
      })
      const filename = `${api.name.toLowerCase().replace(/\s+/g, '-')}-${api.version}.zip`
      const blob = new Blob([`API: ${api.name}\nVersion: ${api.version}\nEndpoint: ${api.endpoint}`], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const handlePreviewToggle = (api) => {
    const nextExpanded = expandedPreview === api.id ? null : api.id
    setExpandedPreview(nextExpanded)
    if (nextExpanded === api.id && !previewLang[api.id]) {
      setPreviewLang((current) => ({ ...current, [api.id]: 'request' }))
    }
  }

  const handlePreviewLangSelect = (api, lang) => {
    setPreviewLang((current) => ({ ...current, [api.id]: lang }))
  }

  async function copyToClipboard(text, message = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text)
      notify(message)
    } catch {
      notify('Copy failed', 'error')
    }
  }

  function handleTestAction(api, action) {
    setActiveTestMenu(null)
    const collection = buildPostmanCollection(api)
    const openApi = buildOpenApiYaml(api)
    const safeName = api.name.replace(/\s+/g, '-').toLowerCase()

    switch (action) {
      case 'postman-web': {
        downloadBlob(`${safeName}.postman_collection.json`, JSON.stringify(collection, null, 2), 'application/json')
        window.open('https://web.postman.co/', '_blank', 'noopener,noreferrer')
        notify('Collection downloaded — import it in Postman Web')
        break
      }
      case 'swagger': {
        downloadBlob(`${safeName}.openapi.yaml`, openApi, 'application/yaml')
        window.open('https://editor.swagger.io/', '_blank', 'noopener,noreferrer')
        notify('OpenAPI spec downloaded — paste it in Swagger Editor')
        break
      }
      case 'curl': {
        copyToClipboard(buildCurl(api), 'cURL command copied')
        break
      }
      case 'download-postman': {
        downloadBlob(`${safeName}.postman_collection.json`, JSON.stringify(collection, null, 2), 'application/json')
        notify('Postman collection downloaded')
        break
      }
      case 'mock': {
        notify('Mock sandbox coming soon — will run against the CoAction test cluster')
        break
      }
      default:
        break
    }
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header with Stats Cards */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">API Library</h1>
          <p className="text-muted text-sm">Search and discover CoAction's REST and Internal APIs by name, endpoint, domain, owner, or tag</p>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4">
          <div className="p-4 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: '#f5f5f5', minWidth: '110px' }}>
            <p className="text-2xl font-bold" style={{ color: '#1a3a52' }}>{filtered.length}</p>
            <p className="text-xs font-semibold text-gray-600 mt-2 tracking-wider">TOTAL APIs</p>
          </div>
          <div className="p-4 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: '#d1fae5', minWidth: '110px' }}>
            <p className="text-2xl font-bold" style={{ color: '#059669' }}>{apis.filter(a => a.lifecycle === 'beta').length}</p>
            <p className="text-xs font-semibold text-gray-600 mt-2 tracking-wider">BETA</p>
          </div>
          <div className="p-4 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: '#dbeafe', minWidth: '110px' }}>
            <p className="text-2xl font-bold" style={{ color: '#0369a1' }}>{apis.filter(a => a.type === 'Internal').length}</p>
            <p className="text-xs font-semibold text-gray-600 mt-2 tracking-wider">INTERNAL</p>
          </div>
        </div>
      </div>

      {/* Tags Filter and Search */}
      <div className="flex items-center gap-3 justify-between">
        {/* Tags - Scrollable */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-1">
          {/* All Filter Button */}
          <button
            onClick={() => setSelectedTags([])}
            className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
              selectedTags.length === 0
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>

          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search APIs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 text-sm border-2 border-primary rounded-lg bg-white dark:bg-slate-900 text-foreground placeholder-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary whitespace-nowrap font-medium"
        />
      </div>

      {/* API Cards */}
      {isLoading ? (
        <p className="text-muted">Loading APIs...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted text-center py-8">No APIs found matching your criteria</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((api) => (
            <div key={api.id} className="card-base p-4 border border-border hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{api.name}</h3>
                  <p className="text-sm text-muted mt-1">{api.desc || 'No description'}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleDownload(api)}
                    className="btn-primary px-3 py-2 text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <DownloadIcon className="h-4 w-4" /> Download
                  </button>
                  <div className="relative" ref={activeTestMenu === api.id ? testMenuRef : null}>
                    <button
                      onClick={() =>
                        setActiveTestMenu((cur) => (cur === api.id ? null : api.id))
                      }
                      className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5 whitespace-nowrap"
                      title="Test this API"
                    >
                      <Play className="h-4 w-4" /> Test
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          activeTestMenu === api.id ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {activeTestMenu === api.id && (
                      <div
                        className="absolute right-0 mt-2 rounded-md border border-border shadow-lg z-20"
                        style={{ backgroundColor: 'hsl(var(--card))', minWidth: '20rem' }}
                      >
                        {[
                          {
                            id: 'postman-web',
                            icon: ExternalLink,
                            label: 'Open in Postman Web',
                            hint: 'Downloads collection & opens Postman',
                          },
                          {
                            id: 'swagger',
                            icon: BookOpen,
                            label: 'Open in Swagger UI',
                            hint: 'Downloads OpenAPI & opens Swagger Editor',
                          },
                          {
                            id: 'curl',
                            icon: Terminal,
                            label: 'Copy cURL request',
                            hint: 'Paste in your terminal',
                          },
                          {
                            id: 'download-postman',
                            icon: FileCode,
                            label: 'Download Postman collection',
                            hint: '.postman_collection.json',
                          },
                          {
                            id: 'mock',
                            icon: Zap,
                            label: 'Test in browser (mock server)',
                            hint: 'Runs against sandbox',
                          },
                        ].map((it, idx, arr) => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => handleTestAction(api, it.id)}
                            className="w-full text-left bg-transparent hover:bg-muted/30"
                            style={{
                              padding: '0.7rem 0.9rem',
                              borderBottom:
                                idx === arr.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <it.icon
                                className="h-4 w-4 mt-0.5"
                                style={{ color: 'hsl(var(--primary))' }}
                              />
                              <div>
                                <div className="text-sm font-semibold">{it.label}</div>
                                <div className="text-xs text-muted">{it.hint}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Metadata Grid — 4 columns */}
              <div className="grid grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t border-border">
                <div>
                  <span className="text-xs text-muted uppercase tracking-wide">Type</span>
                  <p className="font-semibold text-foreground">{api.type}</p>
                </div>
                <div>
                  <span className="text-xs text-muted uppercase tracking-wide">Version</span>
                  <p className="font-semibold text-foreground">{api.version}</p>
                </div>
                <div>
                  <span className="text-xs text-muted uppercase tracking-wide">Owner</span>
                  <p className="font-semibold text-foreground">{api.owner}</p>
                </div>
                <div>
                  <span className="text-xs text-muted uppercase tracking-wide">Consumers</span>
                  <p className="font-semibold text-foreground">{api.consumers}</p>
                </div>
              </div>

              {/* Footer Row — Explain + Preview + Endpoint Path */}
              <div className="mt-3 pt-20 border-t border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Explain Button */}
                  <button
                    onClick={() => setExpandedExplain(expandedExplain === api.id ? null : api.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded font-medium text-sm transition-all hover:opacity-80"
                    style={{
                      backgroundColor: expandedExplain === api.id || explanationCache[api.id]
                        ? 'hsl(var(--primary))'
                        : 'transparent',
                      border: expandedExplain === api.id || explanationCache[api.id]
                        ? 'none'
                        : '1px solid hsl(var(--border))',
                      color: expandedExplain === api.id || explanationCache[api.id] ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                    }}
                    title="Explain this API"
                  >
                    <Sparkles
                      className="h-4 w-4"
                      style={{
                        fill: expandedExplain === api.id || explanationCache[api.id] ? 'currentColor' : 'none',
                      }}
                    />
                    <span>{explanationCache[api.id] ? 'Summarized' : 'AI summary'}</span>
                  </button>

                  {/* Preview Button */}
                  <button
                    onClick={() => handlePreviewToggle(api)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded font-medium text-sm transition-all hover:opacity-80"
                    style={{
                      backgroundColor: expandedPreview === api.id 
                        ? 'hsl(var(--primary))' 
                        : 'transparent',
                      border: expandedPreview === api.id
                        ? 'none'
                        : '1px solid hsl(var(--border))',
                      color: expandedPreview === api.id ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                    }}
                  >
                    Preview
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        expandedPreview === api.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Endpoint Path — right side, mono, muted, 11px */}
                <code className="text-muted ml-auto text-xs font-mono" style={{ fontSize: '11px' }}>
                  {inferMethod(api)} {endpointPath(api)}
                </code>
              </div>

              {/* Explain Panel + Preview Panel */}
              <>
                {expandedExplain === api.id && (
                  <ExplainPanel
                    api={api}
                    method={inferMethod(api)}
                    path={endpointPath(api)}
                    onCacheUpdate={(cached) => setExplanationCache((prev) => ({ ...prev, [api.id]: cached }))}
                  />
                )}

                {expandedPreview === api.id && (() => {
                  const method = inferMethod(api)
                  const path = endpointPath(api)
                  const lang = previewLang[api.id] || 'request'
                  const payload = getSamplePayload(api)
                  const samples = {
                    request: payload?.request
                      ? JSON.stringify(payload.request, null, 2)
                      : '// This endpoint has no request body.',
                    response: payload?.response
                      ? JSON.stringify(payload.response, null, 2)
                      : '// No sample response available.',
                  }
                  const tabs = [
                    ...(payload?.request ? [{ id: 'request', label: 'Request' }] : []),
                    ...(payload?.response ? [{ id: 'response', label: 'Response' }] : []),
                  ]
                  return (
                    <div className="mt-3 rounded-lg border border-border p-4" style={{ backgroundColor: 'hsl(var(--muted) / 0.05)' }}>
                      <div
                        className="flex items-center gap-3 rounded-md p-3 mb-4"
                        style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      >
                        <MethodBadge method={method} />
                        <code className="text-sm font-mono">{path}</code>
                        <span className="ml-auto text-xs text-muted">{api.version}</span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <p className="text-sm">{api.desc || 'No description available.'}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-xs text-muted uppercase tracking-wide">Version</span>
                              <p className="font-semibold text-sm">{api.version}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted uppercase tracking-wide">Owner</span>
                              <p className="font-semibold text-sm">{api.owner}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted uppercase tracking-wide">Type</span>
                              <p className="font-semibold text-sm">{api.type}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted uppercase tracking-wide">Consumers</span>
                              <p className="font-semibold text-sm">{api.consumers}</p>
                            </div>
                          </div>

                        </div>

                        <div
                          className="rounded-md border border-border overflow-hidden"
                          style={{ backgroundColor: '#0f172a' }}
                        >
                          <div className="flex items-center gap-1 px-2 pt-2">
                            {tabs.map((t) => {
                              const active = t.id === lang
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handlePreviewLangSelect(api, t.id)}
                                  className="text-xs font-semibold bg-transparent"
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    color: active ? '#f1f5f9' : '#64748b',
                                    borderBottom: active
                                      ? '2px solid hsl(var(--accent))'
                                      : '2px solid transparent',
                                  }}
                                >
                                  {t.label}
                                </button>
                              )
                            })}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(samples[lang], 'Sample copied')}
                              className="ml-auto bg-transparent inline-flex items-center gap-1 text-xs"
                              style={{ color: '#94a3b8', padding: '0.25rem 0.6rem' }}
                            >
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          </div>
                          <pre
                            className="text-xs font-mono p-3 overflow-x-auto"
                            style={{ color: '#e2e8f0', margin: 0 }}
                          >
{samples[lang]}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </>
            </div>
          ))}
        </div>
      )}
      <Toast message={toast.message} type={toast.type} />
    </div>
  )
}
