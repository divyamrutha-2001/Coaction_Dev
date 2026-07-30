import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download as DownloadIcon, ChevronDown } from 'lucide-react'
import { apiClient } from '../services/apiClient'

const DOMAINS = ['Policy', 'Claims', 'Billing', 'Subscription']
const API_TYPES = ['REST', 'Internal', 'SOAP']

function getArtifactsForApi(api) {
  if (api.type === 'SOAP') {
    return ['WSDL', 'Sample SOAP', 'Docs']
  }

  return ['OpenAPI', 'Postman', 'Samples', 'Docs']
}

function getPreviewLines(api, artifact) {
  if (artifact === 'Docs') {
    return [
      `# ${api.name} Documentation`,
      '',
      `Version: ${api.version}`,
      `Type: ${api.type}`,
      `Owner: ${api.owner || 'N/A'}`,
      `Endpoint: ${api.endpoint}`,
      '',
      api.desc || 'No description available.',
    ]
  }

  if (artifact === 'Postman') {
    return [
      '{',
      '  "info": {',
      `    "name": "${api.name}",`,
      `    "version": "${api.version}"`,
      '  },',
      '  "item": [',
      '    {',
      `      "name": "Get ${api.name}",`,
      `      "request": { "method": "GET", "url": "${api.endpoint}" }`,
      '    }',
      '  ]',
      '}',
    ]
  }

  if (artifact === 'Samples') {
    return [
      `fetch('${api.endpoint}', {`,
      "  method: 'GET',",
      "  headers: { 'Content-Type': 'application/json' }",
      '})',
      '  .then((response) => response.json())',
      '  .then((data) => console.log(data))',
      '  .catch((error) => console.error(error))',
    ]
  }

  if (artifact === 'Sample SOAP') {
    return [
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">',
      '  <soapenv:Header/>',
      '  <soapenv:Body>',
      `    <Get${api.name.replace(/\s+/g, '')}Request />`,
      '  </soapenv:Body>',
      '</soapenv:Envelope>',
    ]
  }

  if (artifact === 'WSDL') {
    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">',
      `  <service name="${api.name.replace(/\s+/g, '')}">`,
      '    <port binding="tns:Binding">',
      `      <soap:address location="${api.endpoint}" />`,
      '    </port>',
      '  </service>',
      '</definitions>',
    ]
  }

  return [
    'openapi: 3.0.0',
    'info:',
    `  title: ${api.name}`,
    `  version: ${api.version}`,
    'paths:',
    `  ${api.endpoint}:`,
    '    get:',
    `      summary: Get ${api.name}`,
  ]
}

export default function Download() {
  const [domain, setDomain] = useState('All')
  const [apiType, setApiType] = useState('All')
  const [expandedApi, setExpandedApi] = useState(null)
  const [expandedPreview, setExpandedPreview] = useState(null)
  const [previewArtifacts, setPreviewArtifacts] = useState({})
  const [searchQuery, setSearchQuery] = useState('')

  const { data: apis = [] } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  const { data: downloads = [] } = useQuery({
    queryKey: ['downloads'],
    queryFn: () => apiClient.getDownloads(),
  })

  const stats = useMemo(() => {
    return {
      total: apis.length,
      rest: apis.filter(a => a.type === 'REST').length,
      internal: apis.filter(a => a.type === 'Internal').length,
    }
  }, [apis])

  const filtered = useMemo(() => {
    return apis.filter((api) => {
      const matchDomain = domain === 'All' || api.domain === domain
      const matchType = apiType === 'All' || api.type === apiType
      const matchSearch = searchQuery === '' || api.name.toLowerCase().includes(searchQuery.toLowerCase()) || api.desc.toLowerCase().includes(searchQuery.toLowerCase())
      return matchDomain && matchType && matchSearch
    })
  }, [apis, domain, apiType, searchQuery])

  const handleDownload = async (api, artifact = 'API Package') => {
    try {
      await apiClient.createDownload({ artifact, api: api.name, apiId: api.id, by: 'You' })
      const filename = `${api.name.toLowerCase().replace(/\s+/g, '-')}-${api.version}.zip`
      const blob = new Blob([`API: ${api.name}\nVersion: ${api.version}\nArtifact: ${artifact}\nEndpoint: ${api.endpoint}`], { type: 'text/plain' })
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

    if (nextExpanded === api.id && !previewArtifacts[api.id]) {
      setPreviewArtifacts((current) => ({
        ...current,
        [api.id]: getArtifactsForApi(api)[0],
      }))
    }
  }

  const handlePreviewArtifactSelect = (api, artifact) => {
    setPreviewArtifacts((current) => ({
      ...current,
      [api.id]: artifact,
    }))
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header with Stats Cards */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Download API</h1>
          <p className="text-muted text-sm">Download OpenAPI, WSDL, Postman collections, and documentation for any published API</p>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4">
          <div className="p-4 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: '#f5f5f5', minWidth: '110px' }}>
            <p className="text-2xl font-bold" style={{ color: '#1a3a52' }}>{stats.total}</p>
            <p className="text-xs font-semibold text-gray-600 mt-2 tracking-wider">TOTAL APIS</p>
          </div>
          <div className="p-4 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: '#d1fae5', minWidth: '110px' }}>
            <p className="text-2xl font-bold" style={{ color: '#059669' }}>{stats.rest}</p>
            <p className="text-xs font-semibold text-gray-600 mt-2 tracking-wider">REST</p>
          </div>
          <div className="p-4 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: '#dbeafe', minWidth: '110px' }}>
            <p className="text-2xl font-bold" style={{ color: '#0369a1' }}>{stats.internal}</p>
            <p className="text-xs font-semibold text-gray-600 mt-2 tracking-wider">INTERNAL</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center gap-3 justify-between">
        {/* Filter Buttons - Scrollable */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-1">
          {/* All Filter Button */}
          <button
            onClick={() => {
              setApiType('All')
              setDomain('All')
            }}
            className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
              apiType === 'All' && domain === 'All'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>

          {/* Type Filters */}
          {API_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => {
                setApiType(type)
                setDomain('All')
              }}
              className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                apiType === type
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type}
            </button>
          ))}

          {/* Domain Filters */}
          {DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setDomain(d)
                setApiType('All')
              }}
              className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                domain === d
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}
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
      <div className="grid gap-4">
        {filtered.map((api) => (
          <div key={api.id} className="card-base p-4 border border-border hover:shadow-card-hover transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{api.name}</h3>
                <p className="text-sm text-muted mt-1">{api.desc || 'No description'}</p>
              </div>
              <div className="flex gap-2 ml-4 whitespace-nowrap">
                <button 
                  onClick={() => handleDownload(api)}
                  className="btn-primary px-3 py-2 text-sm flex items-center gap-2"
                >
                  <DownloadIcon className="h-4 w-4" /> Download
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t border-border">
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
                <p className="font-semibold text-foreground">{api.owner || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-muted uppercase tracking-wide">Consumers</span>
                <p className="font-semibold text-foreground">{api.consumers || '0'}</p>
              </div>
            </div>
            
            {/* Preview Dropdown */}
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => handlePreviewToggle(api)}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                Preview
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedPreview === api.id ? 'rotate-180' : ''}`} />
              </button>
              {expandedPreview === api.id && (
                <div className="mt-3 space-y-4 bg-gray-50 dark:bg-slate-900/50 p-4 rounded-lg">
                  {(() => {
                    const selectedArtifact = previewArtifacts[api.id] || getArtifactsForApi(api)[0]
                    const previewLines = getPreviewLines(api, selectedArtifact)

                    return (
                      <>
                  {/* Artifacts Section */}
                  <div>
                    <h4 className="font-semibold text-xs uppercase text-muted mb-2">Artifacts you are going to download</h4>
                    <div className="flex flex-wrap gap-2">
                      {getArtifactsForApi(api).map((artifact) => (
                        <button
                          key={artifact}
                          onClick={() => handlePreviewArtifactSelect(api, artifact)}
                          className={`text-xs px-3 py-1.5 rounded transition-colors ${
                            selectedArtifact === artifact
                              ? 'bg-primary text-white'
                              : 'bg-white text-primary border border-primary'
                          }`}
                        >
                          {artifact}
                        </button>
                      ))}
                      <button
                        onClick={() => handleDownload(api, selectedArtifact)}
                        className="bg-primary text-white text-xs px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
                      >
                        Download selected
                      </button>
                    </div>
                  </div>

                  {/* Code Preview */}
                  <div className="bg-gray-900 dark:bg-slate-950 border border-border rounded-lg p-3 font-mono text-xs text-gray-200 overflow-x-auto">
                    <div className="text-gray-400 mb-2">Previewing {selectedArtifact}</div>
                    <div className="space-y-1">
                      {previewLines.map((line, index) => (
                        <div key={`${selectedArtifact}-${index}`}>{line}</div>
                      ))}
                    </div>
                  </div>

                  {/* Contract Preview */}
                  <div>
                    <h4 className="font-semibold text-xs uppercase text-muted mb-2">Contract preview</h4>
                    <div className="space-y-1 text-xs">
                      <div><span className="text-foreground">Artifact:</span> <span className="text-muted">{selectedArtifact}</span></div>
                      <div><span className="text-foreground">API:</span> <span className="text-muted">{api.name}</span></div>
                      <div><span className="text-foreground">Version:</span> <span className="text-muted">{api.version}</span></div>
                      <div><span className="text-foreground">Type:</span> <span className="text-muted">{api.type}</span></div>
                      <div><span className="text-foreground">Endpoint:</span> <span className="text-muted">{api.endpoint}</span></div>
                      <div><span className="text-foreground">Owner:</span> <span className="text-muted">{api.owner}</span></div>
                    </div>
                  </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
            
            {/* Artifacts Dropdown */}
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => setExpandedApi(expandedApi === api.id ? null : api.id)}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                {api.type === 'SOAP' ? 'WSDL' : 'OpenAPI (YAML)'}
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedApi === api.id ? 'rotate-180' : ''}`} />
              </button>
              {expandedApi === api.id && (
                <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded">
                  {api.type === 'SOAP' ? (
                    <>
                      <button onClick={() => handleDownload(api, 'WSDL')} className="block text-xs text-primary hover:underline font-medium w-full text-left px-2 py-1">WSDL</button>
                      <button onClick={() => handleDownload(api, 'Sample SOAP')} className="block text-xs text-primary hover:underline font-medium w-full text-left px-2 py-1">Sample SOAP</button>
                      <button onClick={() => handleDownload(api, 'Docs')} className="block text-xs text-primary hover:underline font-medium w-full text-left px-2 py-1">Docs</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleDownload(api, 'OpenAPI')} className="block text-xs text-primary hover:underline font-medium w-full text-left px-2 py-1">OpenAPI (YAML)</button>
                      <button onClick={() => handleDownload(api, 'Postman')} className="block text-xs text-primary hover:underline font-medium w-full text-left px-2 py-1">Postman</button>
                      <button onClick={() => handleDownload(api, 'Samples')} className="block text-xs text-primary hover:underline font-medium w-full text-left px-2 py-1">Samples</button>
                      <button onClick={() => handleDownload(api, 'Docs')} className="block text-xs text-primary hover:underline font-medium w-full text-left px-2 py-1">Docs</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Downloads */}
      <div className="mt-6">
        <h2 className="text-xl font-bold mb-4">Recent Downloads</h2>
        <div className="card-base border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left p-4 text-xs font-semibold text-foreground">ARTIFACT</th>
                <th className="text-left p-4 text-xs font-semibold text-foreground">API</th>
                <th className="text-left p-4 text-xs font-semibold text-foreground">DOWNLOADED BY</th>
                <th className="text-left p-4 text-xs font-semibold text-foreground">DATE</th>
              </tr>
            </thead>
            <tbody>
              {downloads.slice(0, 5).map((dl, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-foreground text-xs">{dl.artifact}</td>
                  <td className="p-4 text-foreground text-xs">{dl.api}</td>
                  <td className="p-4 text-muted text-xs">{dl.by}</td>
                  <td className="p-4 text-muted text-xs">{new Date(dl.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {downloads.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-4 text-muted text-xs text-center">No downloads yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
