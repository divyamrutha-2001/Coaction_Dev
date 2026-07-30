import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/apiClient'

const categories = [
  { title: 'Business Domain', chips: ['Policy', 'Claims', 'Billing', 'Submission'] },
  { title: 'Technical Type', chips: ['REST', 'SOAP', 'Internal'] },
  { title: 'Lifecycle', chips: ['Published', 'Beta', 'Deprecated', 'Draft'] },
  { title: 'Security Level', chips: ['Public', 'Internal-Only', 'Confidential'] },
]

export default function Tags() {
  const { data: apis = [] } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Context Tags & Metadata</h1>
        <p className="text-muted">Organize and discover APIs by business and technical tags</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <div key={cat.title} className="card-base p-6">
            <h3 className="font-semibold mb-4">{cat.title}</h3>
            <div className="flex flex-wrap gap-2">
              {cat.chips.map((chip) => (
                <span key={chip} className="badge badge-primary text-xs">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card-base p-6">
        <h2 className="text-2xl font-semibold mb-6">APIs by Domain</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['Policy', 'Claims', 'Billing', 'Submission'].map((domain) => {
            const domainApis = apis.filter((a) => a.domain === domain)
            return (
              <div key={domain}>
                <h3 className="font-semibold mb-3">{domain}</h3>
                <div className="space-y-2">
                  {domainApis.map((api) => (
                    <div key={api.id} className="p-2 rounded bg-muted/50 text-sm">
                      {api.name}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card-base p-6">
        <h2 className="text-2xl font-semibold mb-4">Indexing Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{apis.length}</p>
            <p className="text-sm text-muted">APIs Indexed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-accent">{apis.length * 26}</p>
            <p className="text-sm text-muted">Endpoints Indexed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{apis.length * 1.3}</p>
            <p className="text-sm text-muted">Schemas Indexed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-accent">{apis.length * 4}</p>
            <p className="text-sm text-muted">Docs & Release Notes</p>
          </div>
        </div>
      </div>
    </div>
  )
}
