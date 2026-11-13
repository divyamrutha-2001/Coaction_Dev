import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Download, ExternalLink, History, Search, X } from 'lucide-react'
import { api } from '../api/client.js'
import { CodeBlock, EmptyState, ErrorState, LoadingState, PageHeader, Panel, shortDate } from '../components/ui.jsx'

// These endpoints create or mutate records, so the sandbox warns before running them.
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function RunRow({ run }) {
  const ok = run.status >= 200 && run.status < 300
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-ink">{run.method} {run.path}</p>
        <p className="text-[11px] text-ink-muted">{run.environment} · {run.user} · {shortDate(run.calledAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${ok ? 'bg-teal-50 text-teal-900' : 'bg-red-50 text-red-900'}`}>{run.status}</span>
        <span className="text-[11px] text-ink-muted">{run.durationMs}ms</span>
      </div>
    </li>
  )
}

export default function Sandbox() {
  const [params, setParams] = useSearchParams()
  const specId = params.get('api') || ''
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const environments = useQuery({ queryKey: ['environments'], queryFn: api.environments })

  const [search, setSearch] = useState('')
  const [environment, setEnvironment] = useState('Sandbox')
  const [pathParams, setPathParams] = useState({})
  const [body, setBody] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const items = catalog.data || []
  const selected = items.find((item) => item.id === specId) || null

  const runs = useQuery({
    queryKey: ['runs', selected?.name || 'all'],
    queryFn: () => api.runs(selected?.name || null, 10),
    enabled: Boolean(catalog.data),
  })

  const pathFields = useMemo(
    () => (selected?.parameters || []).filter((parameter) => parameter.in === 'path'),
    [selected],
  )

  useEffect(() => {
    if (!selected) return
    setPathParams(Object.fromEntries(pathFields.map((parameter) => [parameter.name, String(parameter.example || '')])))
    setBody(selected.sampleRequest ? JSON.stringify(selected.sampleRequest, null, 2) : '')
    setResult(null)
    setError('')
    setConfirming(false)
  }, [selected, pathFields])

  const term = search.trim().toLowerCase()
  const matches = term
    ? items.filter((item) => `${item.name} ${item.endpoint} ${item.owner} ${item.path}`.toLowerCase().includes(term)).slice(0, 8)
    : []

  async function send() {
    setError('')
    let parsed
    if (body.trim()) {
      try {
        parsed = JSON.parse(body)
      } catch {
        setError('Request body must be valid JSON.')
        return
      }
    }
    setPending(true)
    setConfirming(false)
    try {
      setResult(await api.tryApi({ specId: selected.id, mode: 'sandbox', environment, pathParams, body: parsed }))
      runs.refetch()
    } catch (err) {
      setResult(null)
      setError(err.message || 'Unable to run this request.')
    } finally {
      setPending(false)
    }
  }

  function handleSend() {
    if (MUTATING.has(selected.method) && environment !== 'Sandbox' && !confirming) {
      setConfirming(true)
      return
    }
    send()
  }

  if (catalog.isLoading) return <LoadingState label="Loading sandbox" />
  if (catalog.isError) return <ErrorState title="Unable to load the sandbox" onRetry={() => catalog.refetch()} />
  if (!selected) return <Navigate to="/api-library" replace />

  const envList = environments.data || [{ name: 'Sandbox', configured: true }]
  const activeEnv = envList.find((item) => item.name === environment)
  const mutating = MUTATING.has(selected.method)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <Link to="/api-library" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Go back
        </Link>
        <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search to switch API by name, path, or owner"
          aria-label="Switch API"
          className="h-10 w-full rounded-lg border border-line bg-surface-muted pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted outline-none transition focus:border-cyan-500 focus:bg-surface focus:ring-4 focus:ring-cyan-500/10"
        />
        {search.trim() && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-muted">No APIs match “{search}”.</li>
            ) : (
              matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => { setParams({ api: item.id }); setSearch('') }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
                      <span className="block truncate font-mono text-xs text-ink-muted">{item.method} {item.path}</span>
                    </span>
                    {item.id === selected.id && <Check className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        </div>
      </div>
      <PageHeader
        title={selected.name}
        description={selected.desc}
        meta={`${selected.method} ${selected.path}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={api.postmanUrl(selected.id)} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted">
              <Download className="h-4 w-4" aria-hidden="true" /> Postman
            </a>
            <a href={`https://editor.swagger.io/?url=${encodeURIComponent(`${window.location.origin}${api.openApiUrl(selected.id)}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-muted">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Swagger
            </a>
          </div>
        }
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Request" description="Values come from the spec example. Change a required field to see a failed check.">
          <label className="block text-sm font-semibold text-ink">Environment
            <select
              value={environment}
              onChange={(event) => { setEnvironment(event.target.value); setConfirming(false) }}
              className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm font-normal text-ink"
            >
              {envList.map((item) => (
                <option key={item.name} value={item.name}>{item.name}{item.configured ? '' : ' (not configured)'}</option>
              ))}
            </select>
          </label>
          {activeEnv && !activeEnv.configured && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">
              No gateway URL is set for {environment}. Requests will return a configuration error.
            </p>
          )}

          {pathFields.map((parameter) => (
            <label key={parameter.name} className="mt-3 block text-sm font-semibold text-ink">{parameter.description || parameter.name}
              <input
                value={pathParams[parameter.name] || ''}
                onChange={(event) => setPathParams((current) => ({ ...current, [parameter.name]: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 font-mono text-xs font-normal text-ink"
              />
            </label>
          ))}

          {selected.sampleRequest && (
            <label className="mt-3 block text-sm font-semibold text-ink">Request body
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-1 h-56 w-full max-w-full rounded-md border border-line bg-surface p-3 font-mono text-xs font-normal text-ink"
              />
            </label>
          )}

          {mutating && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {selected.method} creates or changes records.
            </p>
          )}

          {confirming ? (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-950">Run {selected.method} against {environment}?</p>
              <p className="mt-1 text-xs text-amber-900">This writes real data outside the sandbox.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={send} className="rounded-md bg-navy px-3 py-1.5 text-sm font-semibold text-white">Yes, run it</button>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={pending}
              className="mt-4 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? 'Running…' : 'Run request'}
            </button>
          )}

          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Result">
            {!result ? (
              <EmptyState title="Nothing has run yet" description="Press Run request. The example values are already filled in." />
            ) : (
              <div className="min-w-0">
                <div className={`rounded-lg border p-3 text-sm ${result.ok ? 'border-teal-200 bg-teal-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="font-semibold text-ink">{result.ok ? 'Pass' : 'Fail'} · Status {result.status}</p>
                  <p className="mt-1 text-ink-muted">{result.summary}</p>
                </div>
                {result.checks?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs">
                    {result.checks.map((check) => (
                      <li key={check.name} className="flex items-start gap-2">
                        {check.ok
                          ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden="true" />
                          : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />}
                        <span className="text-ink-muted">{check.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <CodeBlock title="Response body" value={result.body} />
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Recent runs"
            description={`Last calls recorded for ${selected.name}.`}
            actions={<History className="h-4 w-4 text-ink-muted" aria-hidden="true" />}
          >
            {runs.isLoading ? (
              <p className="text-sm text-ink-muted">Loading history…</p>
            ) : (runs.data || []).length === 0 ? (
              <EmptyState title="No runs yet" description="Runs are recorded once you send a request." />
            ) : (
              <ul className="min-w-0">
                {runs.data.map((run) => <RunRow key={run.id} run={run} />)}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-muted">
              Full traffic is on the <Link to="/usage" className="font-semibold underline">Usage page</Link>.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
