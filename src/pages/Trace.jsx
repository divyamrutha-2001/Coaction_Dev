import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api, formatNumber } from '../api/client.js'
import { copyText, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SegmentedControl, StatusBadge } from '../components/ui.jsx'

const filters = [
  { value: 'all', label: 'All' },
  { value: 'errors', label: 'Errors' },
  { value: 'retries', label: 'Retries' },
  { value: 'users', label: 'People' },
  { value: 'system', label: 'System' },
]

const ranges = [
  { value: 'all', label: 'All time', hours: null },
  { value: '24h', label: 'Last 24 hours', hours: 24 },
  { value: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { value: '30d', label: 'Last 30 days', hours: 24 * 30 },
]

function inRange(event, range, now) {
  if (!range.hours) return true
  const at = new Date(event.rawTime).getTime()
  return Number.isFinite(at) && now - at <= range.hours * 3600 * 1000
}

const matchesFilter = {
  all: () => true,
  errors: (event) => event.status >= 400,
  users: (event) => event.actorKind === 'user',
  system: (event) => event.actorKind === 'system',
}

const STATUS_WORDS = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  301: 'Moved', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  409: 'Conflict', 422: 'Unprocessable', 429: 'Too Many',
  500: 'Server Error', 502: 'Bad Gateway', 503: 'Unavailable', 504: 'Timeout',
}

function statusWord(status) {
  const word = STATUS_WORDS[status]
  return word ? `${status} ${word}` : String(status)
}

function actionLabel(event) {
  return String(event?.api || 'Call').replace(/\s*API$/i, '').trim() || 'Call'
}

function formatDuration(ms) {
  const n = Number(ms || 0)
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`
}

function sameEndpoint(a, b) {
  return Boolean(a && b && a.api === b.api && a.method === b.method && a.path === b.path)
}

// Group the flat event list into flow nodes. A failed call immediately followed
// by a call to the same endpoint is treated as a retry group (attempts 1..n).
function buildFlowNodes(events) {
  const nodes = []
  for (let i = 0; i < events.length;) {
    const event = events[i]
    if (event.status >= 400 && events[i + 1] && sameEndpoint(event, events[i + 1])) {
      const attempts = [event, events[i + 1]]
      let j = i + 1
      while (events[j].status >= 400 && events[j + 1] && sameEndpoint(events[j], events[j + 1])) {
        j += 1
        attempts.push(events[j])
      }
      nodes.push({ type: 'retry', attempts })
      i = j + 1
    } else {
      nodes.push({ type: 'step', event })
      i += 1
    }
  }
  return nodes
}

function buildPayload(event) {
  return JSON.stringify({ api: event.api, method: event.method, path: event.path, status: event.status, duration_ms: event.ms, error: event.note }, null, 2)
}

function nodeIncident(node) {
  if (node.type === 'retry') {
    const firstFail = node.attempts.find((attempt) => attempt.status >= 400) || node.attempts[0]
    const final = node.attempts[node.attempts.length - 1]
    const retries = node.attempts.length - 1
    return {
      title: firstFail.note && firstFail.note !== 'Completed' ? firstFail.note : `${actionLabel(firstFail)} returned ${firstFail.status}`,
      detail: final.status < 400
        ? `Recovered automatically on ${retries === 1 ? 'the first retry' : `retry ${retries}`}. No action needed unless this repeats.`
        : `Did not recover after ${retries} ${retries === 1 ? 'retry' : 'retries'}. This step may need attention.`,
      payload: buildPayload(firstFail),
    }
  }
  const event = node.event
  if (event.status < 400) return null
  return {
    title: event.note && event.note !== 'Completed' ? event.note : `${actionLabel(event)} returned ${event.status}`,
    detail: 'This call failed and was not retried. It may need attention.',
    payload: buildPayload(event),
  }
}

function groupByDay(nodes) {
  const groups = []
  nodes.forEach((node) => {
    const first = node.type === 'retry' ? node.attempts[0] : node.event
    const key = first.day || 'unknown'
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: first.dayLabel || 'Unknown date', nodes: [] }
      groups.push(group)
    }
    group.nodes.push(node)
  })
  return groups
}

function TimelineRow({ node, last, open, onToggle }) {
  const isRetry = node.type === 'retry'
  const event = isRetry ? node.attempts[node.attempts.length - 1] : node.event
  const failed = event.status >= 400
  const recovered = isRetry && !failed
  const incident = nodeIncident(node)
  const totalMs = isRetry ? node.attempts.reduce((sum, item) => sum + Number(item.ms || 0), 0) : event.ms
  const dot = failed ? 'bg-red-500' : recovered ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <li className="relative pb-4 pl-7 last:pb-0">
      {!last && <span className="absolute bottom-0 left-[5px] top-4 w-px bg-line" aria-hidden="true" />}
      <span className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-surface ${dot}`} aria-hidden="true" />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-16 shrink-0 font-mono text-xs text-ink-muted">{event.time}</span>
        <span className="font-semibold text-ink">{actionLabel(event)}</span>
        <span className={`font-mono text-xs ${failed ? 'font-semibold text-red-700 dark:text-red-300' : 'text-ink-muted'}`}>{statusWord(event.status)}</span>
        <span className="text-xs text-ink-muted">{formatDuration(totalMs)}</span>
        {isRetry && (
          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            Retried {node.attempts.length - 1}×
          </span>
        )}
        <span className="ml-auto text-xs text-ink-muted">{event.actor === 'system' ? 'System' : event.actor}</span>
      </div>
      {incident && (
        <div className="mt-1 pl-0 text-sm sm:pl-[76px]">
          <p className={failed ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-200'}>
            <span className="font-semibold">{incident.title.replace(/\.+$/, '')}.</span> {incident.detail}{' '}
            <button type="button" onClick={onToggle} className="font-semibold underline-offset-2 hover:underline">
              {open ? 'Hide payload' : 'View payload'}
            </button>
          </p>
          {open && (
            <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-surface-muted px-3 py-2 font-mono text-xs text-ink">{incident.payload}</pre>
          )}
        </div>
      )}
    </li>
  )
}

export default function Trace() {
  const traces = useQuery({ queryKey: ['traces'], queryFn: api.traces })
  const [params] = useSearchParams()
  const initialId = (params.get('id') || 'PK202700023245').trim().toUpperCase()
  const [draft, setDraft] = useState(initialId)
  const [activeId, setActiveId] = useState(initialId)
  const [filter, setFilter] = useState('all')
  const [rangeKey, setRangeKey] = useState('all')
  const [openError, setOpenError] = useState(null)
  const trace = useQuery({
    queryKey: ['trace', activeId],
    queryFn: () => api.trace(activeId),
    enabled: Boolean(activeId),
    retry: false,
  })

  // React to an id arriving from the global search bar.
  useEffect(() => {
    const id = params.get('id')
    if (!id) return
    const next = id.trim().toUpperCase()
    setDraft(next)
    setActiveId(next)
    setFilter('all')
  }, [params])

  function search(value) {
    const next = (value || draft).trim().toUpperCase()
    setDraft(next)
    setActiveId(next)
    setFilter('all')
  }

  const allEvents = trace.data?.events || []
  const now = Date.now()
  const range = ranges.find((item) => item.value === rangeKey)
  const rangeEvents = allEvents.filter((event) => inRange(event, range, now))
  const rangeNodes = buildFlowNodes(rangeEvents)
  const retryNodes = rangeNodes.filter((node) => node.type === 'retry')
  const counts = {
    all: rangeEvents.length,
    errors: rangeEvents.filter(matchesFilter.errors).length,
    retries: retryNodes.length,
    users: rangeEvents.filter(matchesFilter.users).length,
    system: rangeEvents.filter(matchesFilter.system).length,
  }
  const filterOptions = filters.map((item) => ({ ...item, label: `${item.label} (${counts[item.value]})` }))
  const nodes = filter === 'retries' ? retryNodes : buildFlowNodes(rangeEvents.filter(matchesFilter[filter]))
  const events = nodes.flatMap((node) => (node.type === 'retry' ? node.attempts : [node.event]))
  const elapsed = events.reduce((sum, event) => sum + Number(event.ms || 0), 0)
  const days = [...new Set(allEvents.map((event) => event.day).filter(Boolean))]
  const spansDays = days.length > 1
  const dayGroups = groupByDay(nodes)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader eyebrow="Trace" title="Policy Trace" description="Follow a policy, submission, or claim through the APIs that touched it." />
      <Panel>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); search() }}>
          <div className="min-w-0 flex-1">
            <label htmlFor="trace-id" className="mb-1 block text-xs font-semibold text-ink-muted">Object ID</label>
            <input id="trace-id" value={draft} onChange={(event) => setDraft(event.target.value)} className="h-11 w-full rounded-md border border-line px-3 font-mono text-sm" placeholder="PK202700023245" />
          </div>
          <button type="submit" className="h-11 rounded-md bg-navy px-5 text-sm font-semibold text-white">Trace</button>
        </form>
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-ink-muted">Sample IDs</p>
          <div className="flex flex-wrap gap-2">
            {(traces.data || []).map((item) => (
              <button key={item.id} type="button" onClick={() => search(item.id)} className="rounded-md border border-line bg-surface px-3 py-1 font-mono text-xs">{item.id}</button>
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
                <p className="text-xs font-semibold uppercase text-teal-700">{trace.data.kind}</p>
                <h2 className="break-anywhere text-2xl font-bold">{trace.data.id}</h2>
                <p className="text-sm text-ink-muted">{trace.data.title}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge>{trace.data.status}</StatusBadge>
                <button type="button" onClick={() => copyText(trace.data.id, 'Object ID')} className="rounded-md border px-2 py-1 text-xs font-semibold">Copy ID</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><div className="text-xs uppercase text-ink-muted">Steps</div><div className="font-semibold">{trace.data.events.length}{spansDays ? ` over ${days.length} days` : ''}</div></div>
              {['Policy', 'Account', 'Written premium']
                .filter((label) => trace.data.fields?.[label])
                .map((label) => (
                  <div key={label}>
                    <div className="text-xs uppercase text-ink-muted">{label}</div>
                    <div className="break-anywhere font-semibold">{trace.data.fields[label]}</div>
                  </div>
                ))}
            </div>
          </Panel>
          {(trace.data.warnings || []).length > 0 && (
            <Panel
              title={`${trace.data.warnings.length} ${trace.data.warnings.length === 1 ? 'thing needs' : 'things need'} attention`}
              description="Every API call succeeded, so these are gaps in the object's own history rather than request failures."
              actions={<AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />}
            >
              <ul className="space-y-2">
                {trace.data.warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel
            title="Timeline"
            actions={(
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="trace-range" className="mb-1 block text-xs font-semibold text-ink-muted">Time range</label>
                  <select
                    id="trace-range"
                    value={rangeKey}
                    onChange={(event) => { setRangeKey(event.target.value); setOpenError(null) }}
                    className="h-[42px] rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink shadow-sm"
                  >
                    {ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <SegmentedControl label="Show" value={filter} onChange={(value) => { setFilter(value); setOpenError(null) }} options={filterOptions} />
              </div>
            )}
          >
            {events.length === 0 ? (
              rangeEvents.length === 0
                ? <EmptyState title={`No calls in the ${range.label.toLowerCase()}`} description={`${trace.data.id} has ${allEvents.length} calls in total. Choose a longer time range to see them.`} />
                : filter === 'errors'
                  ? <EmptyState title="No failed calls" description={`All ${rangeEvents.length} calls in this range returned a success status.`} />
                  : filter === 'retries'
                    ? <EmptyState title="No retries" description="No call in this range had to be retried." />
                    : <EmptyState title="No events in this view" description="This filter hides every step. Choose All to see the full timeline." />
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-end gap-2 text-xs text-ink-muted">
                  <span className="whitespace-nowrap">{events.length} {events.length === 1 ? 'call' : 'calls'} · Total: <span className="font-semibold text-ink">{formatNumber(elapsed)} ms</span></span>
                </div>
                <div className="flex flex-col gap-5">
                  {dayGroups.map((group) => (
                    <section key={group.key}>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{group.label}</h3>
                      <ol>
                        {group.nodes.map((node, index) => {
                          const id = `${group.key}-${index}`
                          return (
                            <TimelineRow
                              key={id}
                              node={node}
                              last={index === group.nodes.length - 1}
                              open={openError === id}
                              onToggle={() => setOpenError(openError === id ? null : id)}
                            />
                          )
                        })}
                      </ol>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
