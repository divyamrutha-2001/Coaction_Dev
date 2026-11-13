import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client.js'
import { DataTable, EmptyState, ErrorState, formatWhen, LoadingState, PageHeader, Panel, SearchField, SegmentedControl, StatusBadge } from '../components/ui.jsx'

export default function Downloads() {
  const queryClient = useQueryClient()
  const apis = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const downloads = useQuery({ queryKey: ['downloads'], queryFn: api.downloads })
  const [domain, setDomain] = useState('All')
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState('')
  const record = useMutation({
    mutationFn: api.createDownload,
    onSuccess: () => {
      toast.success('Download recorded')
      queryClient.invalidateQueries({ queryKey: ['downloads'] })
    },
    onError: () => toast.error('Unable to record the download'),
    onSettled: () => setPendingId(''),
  })
  const domains = useMemo(() => ['All', ...new Set((apis.data || []).map((item) => item.domain))], [apis.data])
  const visible = (apis.data || []).filter((item) => {
    const matchesDomain = domain === 'All' || item.domain === domain
    const haystack = `${item.name} ${item.desc}`.toLowerCase()
    return matchesDomain && haystack.includes(query.toLowerCase())
  })

  function download(item) {
    const artifact = `${item.name} package`
    const fileName = `${item.name.toLowerCase().replace(/\s+/g, '-')}-${item.version}.txt`
    const blob = new Blob([`API: ${item.name}\nVersion: ${item.version}\nArtifact: ${artifact}\nEndpoint: ${item.endpoint}\n`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    setPendingId(item.id)
    record.mutate({ artifact, apiId: item.id, by: 'You' })
  }

  if (apis.isLoading || downloads.isLoading) return <LoadingState label="Loading downloads" />
  if (apis.isError || downloads.isError) return <ErrorState title="Unable to load downloads" onRetry={() => { apis.refetch(); downloads.refetch() }} />

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader title="Downloads" description={`${apis.data.length} APIs in the catalog. Each download saves a local text file and records it here.`} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchField id="download-search" label="Search artifacts" value={query} onChange={setQuery} placeholder="API name" />
        <SegmentedControl label="Domain" value={domain} onChange={setDomain} options={domains.map((value) => ({ value, label: value }))} />
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No artifacts match" description="Try another domain or clear the search." />
      ) : (
        <div className="grid gap-3 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((item) => (
            <article key={item.id} className="flex flex-col justify-between rounded-lg border border-[#d8e0ea] bg-white p-3 shadow-[0_1px_2px_rgba(18,32,51,0.04)]">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 text-sm font-bold leading-snug">{item.name}</h2>
                  <StatusBadge>{item.lifecycle}</StatusBadge>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-600">{item.domain} · {item.version} · {item.type}</p>
                <p className="mt-2 line-clamp-1 break-anywhere font-mono text-[11px] text-slate-500">{item.endpoint}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Package</span>
                <button type="button" onClick={() => download(item)} disabled={pendingId === item.id} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#d8e0ea] px-2.5 py-1.5 text-xs font-bold disabled:opacity-60">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {pendingId === item.id ? 'Recording…' : 'Download'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Panel title="Recent downloads">
        <DataTable
          minWidth="520px"
          rows={downloads.data}
          getRowKey={(item) => `${item.artifact}-${item.date}`}
          empty={<EmptyState title="No downloads yet" description="Download a package above. It will show up in this list." />}
          columns={[
            { key: 'artifact', header: 'Artifact', render: (item) => item.artifact },
            { key: 'api', header: 'API', render: (item) => item.api },
            { key: 'by', header: 'Downloaded by', render: (item) => item.by },
            { key: 'date', header: 'Date', render: (item) => formatWhen(item.date) },
          ]}
        />
      </Panel>
    </div>
  )
}
