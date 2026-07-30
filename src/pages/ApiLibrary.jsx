import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download as DownloadIcon, Play, Plus } from 'lucide-react'
import { apiClient } from '../services/apiClient'

export default function ApiLibrary() {
  const navigate = useNavigate()
  const [selectedTags, setSelectedTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

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
            <p className="text-xs font-semibold text-gray-600 mt-2 tracking-wider">TOTAL APIS</p>
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
                  <button 
                    className="btn-primary px-3 py-2 text-sm flex items-center gap-2 whitespace-nowrap hover:opacity-90 transition-opacity"
                    title="Test with Swagger/Postman"
                  >
                    <Play className="h-4 w-4" /> Test
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
                  <p className="font-semibold text-foreground">{api.owner}</p>
                </div>
                <div>
                  <span className="text-xs text-muted uppercase tracking-wide">Consumers</span>
                  <p className="font-semibold text-foreground">{api.consumers}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
