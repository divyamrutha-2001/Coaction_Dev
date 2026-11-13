import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Clock3, UserRound } from 'lucide-react'
import { api, formatNumber } from '../api/client.js'
import { copyText, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SegmentedControl, StatusBadge } from '../components/ui.jsx'

const filters = [
  { value: 'all', label: 'All' },
  { value: 'errors', label: 'Errors' },
  { value: 'users', label: 'By people' },
  { value: 'system', label: 'By system' },
]

export default function Trace() {
  const traces = useQuery({ queryKey: ['traces'], queryFn: api.traces })
  const [draft, setDraft] = useState('POL-2026-98765')
  const [activeId, setActiveId] = useState('POL-2026-98765')
  const [filter, setFilter] = useState('all')
  const trace = useQuery({
    queryKey: ['trace', activeId],
    queryFn: () => api.trace(activeId),
    enabled: Boolean(activeId),
    retry: false,
  })

  function search(value) {
    const next = (value || draft).trim().toUpperCase()
    setDraft(next)
    setActiveId(next)
    setFilter('all')
  }

  const events = (trace.data?.events || []).filter((event) => {
    if (filter === 'errors') return event.status >= 400
    if (filter === 'users') return event.actorKind === 'user'
    if (filter === 'system') return event.actorKind === 'system'
    return true
  })
  const elapsed = (trace.data?.events || []).reduce((sum, event) => sum + Number(event.ms || 0), 0)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader eyebrow="Trace" title="Policy Trace" description="Follow a policy, submission, or claim through the APIs that touched it." />
      <Panel>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); search() }}>
          <div className="min-w-0 flex-1">
            <label htmlFor="trace-id" className="mb-1 block text-xs font-semibold text-slate-600">Object ID</label>
            <input id="trace-id" value={draft} onChange={(event) => setDraft(event.target.value)} className="h-11 w-full rounded-md border border-[#d8e0ea] px-3 font-mono text-sm" placeholder="POL-2026-98765" />
          </div>
          <button type="submit" className="h-11 rounded-md bg-[#1a3a52] px-5 text-sm font-semibold text-white">Trace</button>
        </form>
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-slate-600">Sample IDs</p>
          <div className="flex flex-wrap gap-2">
            {(traces.data || []).map((item) => (
              <button key={item.id} type="button" onClick={() => search(item.id)} className="rounded-md border border-[#d8e0ea] bg-white px-3 py-1 font-mono text-xs">{item.id}</button>
            ))}
          </div>
        </div>
      </Panel>
      {trace.isLoading && <LoadingState label="Looking up the trace" />}
      {trace.isError && (
        <ErrorState title={`No trace found for ${activeId}`} description="Use one of the sample IDs, or check the object ID format." onRetry={() => trace.refetch()} />
      )}
      {trace.data && (
        <>
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-teal-800">{trace.data.kind}</p>
                <h2 className="break-anywhere text-2xl font-bold">{trace.data.id}</h2>
                <p className="text-sm text-slate-600">{trace.data.title}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge>{trace.data.status}</StatusBadge>
                <button type="button" onClick={() => copyText(trace.data.id, 'Object ID')} className="rounded-md border px-2 py-1 text-xs font-semibold">Copy ID</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><div className="text-xs uppercase text-slate-500">Steps</div><div className="font-semibold">{trace.data.events.length}</div></div>
              <div><div className="text-xs uppercase text-slate-500">Elapsed</div><div className="font-semibold">{formatNumber(elapsed)} ms</div></div>
              <div><div className="text-xs uppercase text-slate-500">Opened</div><div className="font-semibold">{trace.data.openedAgo || '—'} · {trace.data.openedBy || '—'}</div></div>
              {Object.entries(trace.data.fields || {}).map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs uppercase text-slate-500">{label}</div>
                  <div className="break-anywhere font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Timeline" actions={<SegmentedControl label="Show" value={filter} onChange={setFilter} options={filters} />}>
            {events.length === 0 ? (
              <EmptyState title="No events in this view" description="This filter hides every step. Choose All to see the full timeline." />
            ) : (
              <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                {events.map((event) => {
                  const failed = event.status >= 400
                  const Icon = failed ? AlertCircle : event.actorKind === 'user' ? UserRound : CheckCircle2
                  return (
                    <li key={`${event.time}-${event.path}-${event.status}`} className="text-sm">
                      <Icon className={`absolute -left-2 mt-1 h-4 w-4 ${failed ? 'text-red-700' : 'text-teal-800'}`} aria-hidden="true" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span className="font-mono text-xs text-slate-500">{event.time}</span>
                        <span className="font-bold">{event.method}</span>
                        <code className="break-anywhere text-xs">{event.path}</code>
                        <StatusBadge tone={failed ? 'danger' : 'success'}>{event.status}</StatusBadge>
                        <span className="text-slate-600">{formatNumber(event.ms)} ms</span>
                        <span className="text-slate-600">{event.actorKind === 'user' ? 'Person' : 'System'} · {event.actor}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{event.api} · {event.note}</p>
                    </li>
                  )
                })}
              </ol>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
