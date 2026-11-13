import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Copy, FlaskConical } from 'lucide-react'
import { api } from '../api/client.js'
import { CodeBlock, copyText, EmptyState, ErrorState, LoadingState, Panel, SearchField, StatusBadge } from '../components/ui.jsx'

const tabs = ['Overview', 'Schema', 'Examples', 'Document', 'Access', 'Change Log']

const DOMAIN_PALETTE = [
  { bar: 'bg-sky-400 dark:bg-sky-400/80', dot: 'bg-sky-300', border: 'border-sky-400 dark:border-sky-400/70', soft: 'bg-sky-50 dark:bg-sky-500/10', ring: 'ring-sky-600/15 dark:ring-sky-500/25', text: 'text-sky-700 dark:text-sky-200', hex: '#7dd3fc' },
  { bar: 'bg-emerald-400 dark:bg-emerald-400/80', dot: 'bg-emerald-300', border: 'border-emerald-400 dark:border-emerald-400/70', soft: 'bg-emerald-50 dark:bg-emerald-500/10', ring: 'ring-emerald-600/15 dark:ring-emerald-500/25', text: 'text-emerald-700 dark:text-emerald-200', hex: '#6ee7b7' },
  { bar: 'bg-violet-400 dark:bg-violet-400/80', dot: 'bg-violet-300', border: 'border-violet-400 dark:border-violet-400/70', soft: 'bg-violet-50 dark:bg-violet-500/10', ring: 'ring-violet-600/15 dark:ring-violet-500/25', text: 'text-violet-700 dark:text-violet-200', hex: '#c4b5fd' },
  { bar: 'bg-amber-400 dark:bg-amber-400/80', dot: 'bg-amber-300', border: 'border-amber-400 dark:border-amber-400/70', soft: 'bg-amber-50 dark:bg-amber-500/10', ring: 'ring-amber-600/15 dark:ring-amber-500/25', text: 'text-amber-700 dark:text-amber-200', hex: '#fcd34d' },
  { bar: 'bg-cyan-400 dark:bg-cyan-400/80', dot: 'bg-cyan-300', border: 'border-cyan-400 dark:border-cyan-400/70', soft: 'bg-cyan-50 dark:bg-cyan-500/10', ring: 'ring-cyan-600/15 dark:ring-cyan-500/25', text: 'text-cyan-700 dark:text-cyan-200', hex: '#67e8f9' },
  { bar: 'bg-teal-400 dark:bg-teal-400/80', dot: 'bg-teal-300', border: 'border-teal-400 dark:border-teal-400/70', soft: 'bg-teal-50 dark:bg-teal-500/10', ring: 'ring-teal-600/15 dark:ring-teal-500/25', text: 'text-teal-700 dark:text-teal-200', hex: '#5eead4' },
  { bar: 'bg-indigo-400 dark:bg-indigo-400/80', dot: 'bg-indigo-300', border: 'border-indigo-400 dark:border-indigo-400/70', soft: 'bg-indigo-50 dark:bg-indigo-500/10', ring: 'ring-indigo-600/15 dark:ring-indigo-500/25', text: 'text-indigo-700 dark:text-indigo-200', hex: '#a5b4fc' },
  { bar: 'bg-fuchsia-400 dark:bg-fuchsia-400/80', dot: 'bg-fuchsia-300', border: 'border-fuchsia-400 dark:border-fuchsia-400/70', soft: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', ring: 'ring-fuchsia-600/15 dark:ring-fuchsia-500/25', text: 'text-fuchsia-700 dark:text-fuchsia-200', hex: '#f0abfc' },
]

export default function Library() {
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const access = useQuery({ queryKey: ['access'], queryFn: api.access })
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') || '')
  const [tag, setTag] = useState('')
  const [domain, setDomain] = useState('')
  const [lifecycle, setLifecycle] = useState('')
  const [method, setMethod] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [audience, setAudience] = useState('Business')

  const items = catalog.data || []
  const options = useMemo(() => ({
    tags: unique(items.flatMap((item) => item.tags || [])),
    domains: unique(items.map((item) => item.domain)),
    lifecycles: unique(items.map((item) => item.lifecycle)),
    methods: unique(items.map((item) => item.method)),
  }), [items])

  const domainBreakdown = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const key = item.domain || 'Uncategorized'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  const visible = useMemo(() => items.filter((item) => {
    const haystack = `${item.name} ${item.desc} ${item.endpoint} ${item.owner}`.toLowerCase()
    return (!tag || item.tags?.includes(tag))
      && (!domain || item.domain === domain)
      && (!lifecycle || item.lifecycle === lifecycle)
      && (!method || item.method === method)
      && haystack.includes(query.toLowerCase())
  }), [items, query, tag, domain, lifecycle, method])

  const selected = visible.find((item) => item.id === selectedId) || null
  useEffect(() => {
    setQuery(params.get('q') || '')
  }, [params])

  useEffect(() => {
    if (selectedId && !visible.some((item) => item.id === selectedId)) setSelectedId(null)
  }, [selectedId, visible])

  const readers = (access.data?.users || []).filter((user) => selected && Array.isArray(user.apis) && user.apis.includes(selected.name))

  if (catalog.isLoading) return <LoadingState label="Loading API library" />
  if (catalog.isError) return <ErrorState title="Unable to load the API library" onRetry={() => catalog.refetch()} />

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-black text-ink sm:text-4xl">API Library</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">Open an API, press Try this API, and the workbench checks the request against the spec.</p>
          </div>
          <div className="w-full shrink-0 rounded-lg border border-line bg-surface p-4 lg:w-[460px]">
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-3xl font-black leading-none text-ink">{items.length}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Total APIs</span>
              </div>
              <div className="flex h-2.5 min-w-0 flex-1 items-stretch overflow-hidden rounded-full">
                {domainBreakdown.map((entry, index) => {
                  const tone = DOMAIN_PALETTE[index % DOMAIN_PALETTE.length]
                  return <div key={entry.name} className={`h-full ${tone.bar}`} style={{ flexGrow: entry.count, flexBasis: 0 }} title={`${entry.name}: ${entry.count}`} />
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {domainBreakdown.map((entry, index) => {
                const tone = DOMAIN_PALETTE[index % DOMAIN_PALETTE.length]
                const isTop = index === 0
                return (
                  <div key={entry.name} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${tone.bar}`} />
                    <span className={isTop ? 'font-bold text-ink' : 'text-ink-muted'}>{entry.name}</span>
                    <span className="font-semibold text-ink">{entry.count}</span>
                    {isTop && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${tone.soft} ${tone.text} ${tone.ring}`}>Most used</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </header>
      <section className="rounded-lg border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(18,32,51,0.04)]">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(260px,1.35fr)_repeat(3,minmax(140px,0.7fr))]">
          <SearchField id="api-search" label="Search APIs" value={query} onChange={setQuery} placeholder="Name, path, or owner" />
          <Filter label="Domain" value={domain} onChange={setDomain} options={options.domains} />
          <Filter label="Lifecycle" value={lifecycle} onChange={setLifecycle} options={options.lifecycles} />
          <Filter label="Method" value={method} onChange={setMethod} options={options.methods} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Tags</span>
          <Chip active={tag === ''} onClick={() => setTag('')}>All</Chip>
          {options.tags.map((value) => <Chip key={value} active={tag === value} onClick={() => setTag(value)}>{value}</Chip>)}
        </div>
      </section>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            {visible.length === 0 && (
              <EmptyState title="No APIs match" description="Clear a filter or try a shorter search." action={<button type="button" className="rounded-md border bg-surface px-3 py-2 text-sm font-semibold" onClick={() => { setQuery(''); setTag(''); setDomain(''); setLifecycle(''); setMethod('') }}>Clear filters</button>} />
            )}
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSelectedId(item.id); setTab('Overview') }}
                aria-pressed={selected?.id === item.id}
                className={`rounded-lg bg-surface p-3 text-left shadow-[0_1px_2px_rgba(18,32,51,0.04)] ring-1 transition hover:bg-surface-muted ${selected?.id === item.id ? 'bg-surface-muted ring-navy' : 'ring-line/80'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold">{item.name}</h2>
                  <StatusBadge>{item.lifecycle}</StatusBadge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{item.desc}</p>
                <p className="mt-2 break-anywhere font-mono text-[11px] text-ink-muted">{item.endpoint}</p>
                <p className="mt-2 text-[11px] text-ink-muted">{item.domain} · {item.type} {item.version} · {item.owner}</p>
              </button>
            ))}
          </div>
          <div className="min-w-0">
            {!selected && <EmptyState title="Select an API" description="Choose an API from the list to review the spec, try a request, or read the change log." />}
            {selected && (
              <Panel className="overflow-hidden">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold">{selected.name}</h2>
                    <p className="mt-1 break-anywhere font-mono text-xs text-ink-muted">{selected.endpoint}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge>{selected.lifecycle}</StatusBadge>
                      <span className="text-xs text-ink-muted">{selected.type} {selected.version}</span>
                      <span className="text-xs text-ink-muted">{selected.owner}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      to={`/sandbox?api=${encodeURIComponent(selected.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                    >
                      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                      Try it in Sandbox
                    </Link>
                    <button type="button" onClick={() => copyText(selected.endpoint, 'Endpoint')} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold">
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy endpoint
                    </button>
                  </div>
                </div>
                <div role="tablist" aria-label="API details" className="mb-4 flex flex-wrap gap-1">
                  {tabs.map((name) => (
                    <button
                      key={name}
                      id={`api-tab-${name}`}
                      type="button"
                      role="tab"
                      aria-selected={tab === name}
                      aria-controls={`api-panel-${name}`}
                      onClick={() => setTab(name)}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === name ? 'bg-navy text-white' : 'bg-surface-muted text-ink'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={`api-panel-${tab}`} aria-labelledby={`api-tab-${tab}`} className="min-w-0">
                  {tab === 'Overview' && <Overview item={selected} />}
                  {tab === 'Schema' && <Schema schema={selected.schema} />}
                  {tab === 'Examples' && <Examples item={selected} />}
                  {tab === 'Document' && <Document item={selected} />}
                  {tab === 'Access' && <AccessTab item={selected} audience={audience} setAudience={setAudience} readers={readers} />}
                  {tab === 'Change Log' && <ChangeLog changelog={selected.changelog} />}
                </div>
              </Panel>
            )}
          </div>
      </div>
    </div>
  )
}

function Overview({ item }) {
  const rows = [
    ['Purpose', item.desc],
    ['Endpoint', item.endpoint],
    ['Owner', item.owner],
    ['Lifecycle', item.lifecycle],
    ['Version', item.version],
    ['Environment', item.environment || item.servers?.[0]?.description || 'Not recorded on this spec'],
    ['When to use', item.document?.whenToUse || 'No usage note is stored on this spec.'],
  ]
  const chipPalette = [
    'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/25',
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25',
    'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/25',
    'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25',
    'bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-500/25',
    'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/25',
    'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-500/25',
  ]
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-bold uppercase text-ink">{label}</dt>
            <dd className="mt-1 break-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1">
        {(item.tags || []).map((value, index) => (
          <span key={value} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${chipPalette[index % chipPalette.length]}`}>
            <span aria-hidden="true" className="text-[10px]">●</span>
            {value}
          </span>
        ))}
      </div>
    </div>
  )
}

function TryIt({ api: item }) {
  const pathFields = (item.parameters || []).filter((parameter) => parameter.in === 'path')
  const [pathParams, setPathParams] = useState(() => Object.fromEntries(pathFields.map((parameter) => [parameter.name, String(parameter.example || '')])))
  const [body, setBody] = useState(item.sampleRequest ? JSON.stringify(item.sampleRequest, null, 2) : '')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

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
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Request body must be a JSON object.')
        return
      }
    }
    setPending(true)
    try {
      setResult(await api.tryApi({ specId: item.id, mode: 'sandbox', pathParams, body: parsed }))
    } catch (err) {
      setResult(null)
      setError(err.message || 'Unable to run this request.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-ink-muted">{item.explanations?.Business?.summary || item.desc}</p>
        <p className="text-xs text-ink-muted">The example is filled in. Change a required field to see a failed check.</p>
        {pathFields.map((parameter) => (
          <label key={parameter.name} className="block text-sm font-semibold">{parameter.description || parameter.name}
            <input value={pathParams[parameter.name] || ''} onChange={(event) => setPathParams((current) => ({ ...current, [parameter.name]: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-line px-3 font-mono text-xs font-normal" />
          </label>
        ))}
        {item.sampleRequest && (
          <label className="block text-sm font-semibold">Request body
            <textarea value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 h-48 w-full max-w-full rounded-md border border-line p-3 font-mono text-xs font-normal" />
          </label>
        )}
        <button type="button" onClick={send} disabled={pending} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Checking…' : 'Try this API'}</button>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
      </div>
      <div className="min-w-0" aria-live="polite">
        <p className="mb-2 text-xs font-semibold uppercase text-ink-muted">Result</p>
        {!result && <EmptyState title="Try It has not run" description="Press Try this API. The example values are already filled in." />}
        {result && (
          <div className={`rounded-lg border p-3 text-sm ${result.ok ? 'border-teal-200 bg-teal-50' : 'border-red-200 bg-red-50'}`}>
            <p className="font-semibold">{result.ok ? 'Pass' : 'Fail'} · Status {result.status}</p>
            <p className="mt-1">{result.summary}</p>
            <ul className="mt-3 space-y-1 text-xs">
              {(result.checks || []).map((check) => (
                <li key={check.name} className={check.ok ? 'text-teal-900' : 'text-red-900'}>{check.ok ? 'Pass' : 'Fail'} · {check.message}</li>
              ))}
            </ul>
            {result.body && <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-graphite p-3 text-xs text-slate-100">{JSON.stringify(result.body, null, 2)}</pre>}
          </div>
        )}
      </div>
    </div>
  )
}

function Examples({ item }) {
  if (!item.sampleRequest && !item.sampleResponse) {
    return <EmptyState title="No samples stored" description="This spec does not include a request or response example." />
  }
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <CodeBlock title="Request" value={item.sampleRequest} empty="No request sample stored." />
      <CodeBlock title="Response" value={item.sampleResponse} empty="No response sample stored." />
    </div>
  )
}

function Document({ item }) {
  if (!item.document) return <EmptyState title="No document details" description="This spec does not include usage notes or error guidance." />
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold">When to use</h3>
        <p className="mt-1 text-ink">{item.document.whenToUse}</p>
      </section>
      <section>
        <h3 className="font-semibold">Notes</h3>
        {item.document.notes?.length ? <ul className="mt-1 list-disc pl-5">{item.document.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="mt-1 text-ink-muted">No notes stored.</p>}
      </section>
      <section>
        <h3 className="font-semibold">Errors</h3>
        {item.document.errors?.length ? <ul className="mt-1 list-disc pl-5">{item.document.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="mt-1 text-ink-muted">No error notes stored.</p>}
      </section>
    </div>
  )
}

function AccessTab({ item, audience, setAudience, readers }) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Audience" className="flex flex-wrap gap-1">
        {['Business', 'Developer', 'Partner'].map((name) => (
          <button key={name} type="button" role="radio" aria-checked={audience === name} onClick={() => setAudience(name)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${audience === name ? 'bg-navy text-white' : 'bg-surface-muted'}`}>{name}</button>
        ))}
      </div>
      <p className="text-sm">{item.explanations[audience]?.summary || 'No explanation is stored for this audience.'}</p>
      <p className="text-sm text-ink-muted">{readers.length} {readers.length === 1 ? 'user has' : 'users have'} this API in user access{readers.length ? `: ${readers.map((user) => user.name).join(', ')}` : '.'}</p>
    </div>
  )
}

function ChangeLog({ changelog }) {
  if (!changelog?.length) return <EmptyState title="No change log" description="Git history for this spec is empty." />
  return (
    <ol className="relative space-y-4 border-l border-line pl-4">
      {changelog.map((change) => (
        <li key={`${change.date}-${change.title}`} className="text-sm">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-navy" aria-hidden="true" />
          <div className="font-semibold">{change.date} · {change.version} · {change.type}</div>
          <div className="mt-1">{change.title}</div>
          <p className="mt-1 text-ink-muted">{change.description}</p>
          <p className="mt-2"><span className="font-semibold">Impact. </span>{change.impact}</p>
          <p><span className="font-semibold">Developer action. </span>{change.action}</p>
          <p><span className="font-semibold">Owner. </span>{change.owner}</p>
        </li>
      ))}
    </ol>
  )
}

function Schema({ schema }) {
  const sections = [
    ['Path parameters', schema?.pathParameters || []],
    ['Request', schema?.request || []],
    ['Response', schema?.response || []],
  ]
  return (
    <div className="space-y-5">
      {sections.map(([title, fields]) => (
        <section key={title}>
          <h3 className="mb-2 font-semibold">{title}</h3>
          {fields.length === 0 ? <p className="text-sm text-ink-muted">No fields stored.</p> : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-ink-muted">
                      <th className="sticky left-0 bg-surface py-2">Field</th>
                      <th>Type</th>
                      <th>Requirement</th>
                      <th>Description</th>
                      <th>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.name} className="border-b border-line">
                        <td className="sticky left-0 bg-surface py-2 font-mono text-xs">{field.name}</td>
                        <td>{field.type}</td>
                        <td><StatusBadge tone={field.required ? 'warning' : 'neutral'}>{field.required ? 'Required' : 'Optional'}</StatusBadge></td>
                        <td>{field.description}</td>
                        <td className="break-anywhere font-mono text-xs">{field.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 md:hidden">
                {fields.map((field) => (
                  <article key={field.name} className="rounded-md border border-line p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold">{field.name}</span>
                      <StatusBadge tone={field.required ? 'warning' : 'neutral'}>{field.required ? 'Required' : 'Optional'}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{field.type}</p>
                    <p className="mt-1">{field.description}</p>
                    <p className="mt-1 break-anywhere font-mono text-xs">{field.example}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  )
}

function Filter({ label, value, onChange, options }) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-ink-muted">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-line bg-surface px-2 text-sm">
        <option value="">All</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${active ? 'border-navy bg-navy text-white' : 'border-line bg-surface hover:bg-surface-muted'}`}>
      {children}
    </button>
  )
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort()
}
