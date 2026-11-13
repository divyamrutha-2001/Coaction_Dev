import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { api } from '../api/client.js'
import { CodeBlock, copyText, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SearchField, StatusBadge } from '../components/ui.jsx'

const tabs = ['Overview', 'Try It', 'Schema', 'Examples', 'Document', 'Access', 'Change Log']

export default function Library() {
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const source = useQuery({ queryKey: ['catalog-source'], queryFn: api.catalogSource })
  const access = useQuery({ queryKey: ['access'], queryFn: api.access })
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') || '')
  const [tag, setTag] = useState('')
  const [domain, setDomain] = useState('')
  const [lifecycle, setLifecycle] = useState('')
  const [type, setType] = useState('')
  const [owner, setOwner] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [audience, setAudience] = useState('Business')

  const items = catalog.data || []
  const options = useMemo(() => ({
    tags: unique(items.flatMap((item) => item.tags || [])),
    domains: unique(items.map((item) => item.domain)),
    lifecycles: unique(items.map((item) => item.lifecycle)),
    types: unique(items.map((item) => item.type)),
    owners: unique(items.map((item) => item.owner)),
  }), [items])

  const visible = useMemo(() => items.filter((item) => {
    const haystack = `${item.name} ${item.desc} ${item.endpoint} ${item.owner}`.toLowerCase()
    return (!tag || item.tags?.includes(tag))
      && (!domain || item.domain === domain)
      && (!lifecycle || item.lifecycle === lifecycle)
      && (!type || item.type === type)
      && (!owner || item.owner === owner)
      && haystack.includes(query.toLowerCase())
  }), [items, query, tag, domain, lifecycle, type, owner])

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

  const sourceMeta = source.data
    ? `Git ${source.data.branch} @ ${String(source.data.commit || '').slice(0, 7)} · ${source.data.specCount} specs${source.data.remote ? ` · ${source.data.remote}` : ' · local catalog repo'}`
    : null

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title="API Library"
        description="Open an API, press Try this API, and the workbench checks the request against the spec."
        meta={sourceMeta}
        actions={<div className="rounded-lg border border-[#d8e0ea] bg-white px-4 py-2 text-center"><div className="text-xl font-bold">{items.length}</div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total APIs</div></div>}
      />
      <section className="rounded-lg border border-[#d8e0ea] bg-white p-4 shadow-[0_1px_2px_rgba(18,32,51,0.04)]">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(260px,1.35fr)_repeat(4,minmax(140px,0.7fr))]">
          <SearchField id="api-search" label="Search APIs" value={query} onChange={setQuery} placeholder="Name, path, or owner" />
          <Filter label="Domain" value={domain} onChange={setDomain} options={options.domains} />
          <Filter label="Lifecycle" value={lifecycle} onChange={setLifecycle} options={options.lifecycles} />
          <Filter label="Type" value={type} onChange={setType} options={options.types} />
          <Filter label="Owner" value={owner} onChange={setOwner} options={options.owners} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</span>
          <Chip active={tag === ''} onClick={() => setTag('')}>All</Chip>
          {options.tags.map((value) => <Chip key={value} active={tag === value} onClick={() => setTag(value)}>{value}</Chip>)}
        </div>
      </section>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            {visible.length === 0 && (
              <EmptyState title="No APIs match" description="Clear a filter or try a shorter search." action={<button type="button" className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" onClick={() => { setQuery(''); setTag(''); setDomain(''); setLifecycle(''); setType(''); setOwner('') }}>Clear filters</button>} />
            )}
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSelectedId(item.id); setTab('Overview') }}
                aria-pressed={selected?.id === item.id}
                className={`rounded-lg bg-white p-3 text-left shadow-[0_1px_2px_rgba(18,32,51,0.04)] ring-1 transition hover:bg-slate-50 ${selected?.id === item.id ? 'bg-slate-50 ring-[#1a3a52]' : 'ring-[#d8e0ea]/80'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold">{item.name}</h2>
                  <StatusBadge>{item.lifecycle}</StatusBadge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.desc}</p>
                <p className="mt-2 break-anywhere font-mono text-[11px] text-slate-500">{item.endpoint}</p>
                <p className="mt-2 text-[11px] text-slate-500">{item.domain} · {item.type} {item.version} · {item.owner}</p>
              </button>
            ))}
          </div>
          <div className="min-w-0">
            {!selected && <EmptyState title="Select an API" description="Choose an API from the list to review the spec, try a request, or read the change log." />}
            {selected && (
              <Panel className="overflow-hidden">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold">{selected.name}</h2>
                    <p className="mt-1 break-anywhere font-mono text-xs text-slate-600">{selected.endpoint}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge>{selected.lifecycle}</StatusBadge>
                      <span className="text-xs text-slate-600">{selected.type} {selected.version}</span>
                      <span className="text-xs text-slate-600">{selected.owner}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => copyText(selected.endpoint, 'Endpoint')} className="inline-flex items-center gap-1 rounded-md border border-[#d8e0ea] px-2 py-1 text-xs font-semibold">
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy endpoint
                  </button>
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
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === name ? 'bg-[#1a3a52] text-white' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={`api-panel-${tab}`} aria-labelledby={`api-tab-${tab}`} className="min-w-0">
                  {tab === 'Overview' && <Overview item={selected} />}
                  {tab === 'Try It' && <TryIt key={selected.id} api={selected} />}
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
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
            <dd className="mt-1 break-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1">
        {(item.tags || []).map((value) => <StatusBadge key={value} tone="info">{value}</StatusBadge>)}
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
        <p className="text-sm text-slate-600">{item.explanations?.Business?.summary || item.desc}</p>
        <p className="text-xs text-slate-500">The example is filled in. Change a required field to see a failed check.</p>
        {pathFields.map((parameter) => (
          <label key={parameter.name} className="block text-sm font-semibold">{parameter.description || parameter.name}
            <input value={pathParams[parameter.name] || ''} onChange={(event) => setPathParams((current) => ({ ...current, [parameter.name]: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-[#d8e0ea] px-3 font-mono text-xs font-normal" />
          </label>
        ))}
        {item.sampleRequest && (
          <label className="block text-sm font-semibold">Request body
            <textarea value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 h-48 w-full max-w-full rounded-md border border-[#d8e0ea] p-3 font-mono text-xs font-normal" />
          </label>
        )}
        <button type="button" onClick={send} disabled={pending} className="rounded-md bg-[#1a3a52] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Checking…' : 'Try this API'}</button>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
      </div>
      <div className="min-w-0" aria-live="polite">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Result</p>
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
            {result.body && <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(result.body, null, 2)}</pre>}
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
        <p className="mt-1 text-slate-700">{item.document.whenToUse}</p>
      </section>
      <section>
        <h3 className="font-semibold">Notes</h3>
        {item.document.notes?.length ? <ul className="mt-1 list-disc pl-5">{item.document.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="mt-1 text-slate-600">No notes stored.</p>}
      </section>
      <section>
        <h3 className="font-semibold">Errors</h3>
        {item.document.errors?.length ? <ul className="mt-1 list-disc pl-5">{item.document.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="mt-1 text-slate-600">No error notes stored.</p>}
      </section>
    </div>
  )
}

function AccessTab({ item, audience, setAudience, readers }) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Audience" className="flex flex-wrap gap-1">
        {['Business', 'Developer', 'Partner'].map((name) => (
          <button key={name} type="button" role="radio" aria-checked={audience === name} onClick={() => setAudience(name)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${audience === name ? 'bg-[#1a3a52] text-white' : 'bg-slate-100'}`}>{name}</button>
        ))}
      </div>
      <p className="text-sm">{item.explanations[audience]?.summary || 'No explanation is stored for this audience.'}</p>
      <p className="text-sm text-slate-600">{readers.length} {readers.length === 1 ? 'user has' : 'users have'} this API in user access{readers.length ? `: ${readers.map((user) => user.name).join(', ')}` : '.'}</p>
    </div>
  )
}

function ChangeLog({ changelog }) {
  if (!changelog?.length) return <EmptyState title="No change log" description="Git history for this spec is empty." />
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {changelog.map((change) => (
        <li key={`${change.date}-${change.title}`} className="text-sm">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-[#1a3a52]" aria-hidden="true" />
          <div className="font-semibold">{change.date} · {change.version} · {change.type}</div>
          <div className="mt-1">{change.title}</div>
          <p className="mt-1 text-slate-600">{change.description}</p>
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
          {fields.length === 0 ? <p className="text-sm text-slate-500">No fields stored.</p> : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-500">
                      <th className="sticky left-0 bg-white py-2">Field</th>
                      <th>Type</th>
                      <th>Requirement</th>
                      <th>Description</th>
                      <th>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.name} className="border-b border-slate-100">
                        <td className="sticky left-0 bg-white py-2 font-mono text-xs">{field.name}</td>
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
                  <article key={field.name} className="rounded-md border border-[#d8e0ea] p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold">{field.name}</span>
                      <StatusBadge tone={field.required ? 'warning' : 'neutral'}>{field.required ? 'Required' : 'Optional'}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{field.type}</p>
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
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-[#d8e0ea] bg-white px-2 text-sm">
        <option value="">All</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${active ? 'border-[#1a3a52] bg-[#1a3a52] text-white' : 'border-[#d8e0ea] bg-white hover:bg-slate-50'}`}>
      {children}
    </button>
  )
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort()
}
