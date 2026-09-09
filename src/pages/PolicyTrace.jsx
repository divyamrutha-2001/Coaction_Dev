import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Clock,
  User as UserIcon,
  Cpu,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Copy,
  Filter,
  ArrowUpRight,
} from 'lucide-react'
import { apiClient } from '../services/apiClient'

const METHOD_COLORS = {
  GET: { bg: 'hsl(172 66% 50% / 0.18)', color: 'hsl(172 66% 25%)' },
  POST: { bg: 'hsl(214 58% 29% / 0.14)', color: 'hsl(var(--primary))' },
  PUT: { bg: 'hsl(221 83% 60% / 0.15)', color: 'hsl(var(--secondary))' },
  PATCH: { bg: 'hsl(221 83% 60% / 0.15)', color: 'hsl(var(--secondary))' },
  DELETE: { bg: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' },
}

const STATUS_COLORS = {
  success: { bg: 'hsl(172 66% 50% / 0.18)', color: 'hsl(172 66% 25%)' },
  redirect: { bg: 'hsl(221 83% 60% / 0.15)', color: 'hsl(var(--secondary))' },
  client_error: { bg: 'hsl(38 92% 50% / 0.18)', color: '#92400e' },
  server_error: { bg: 'hsl(var(--destructive) / 0.14)', color: 'hsl(var(--destructive))' },
}

function statusBucket(code) {
  if (code >= 500) return 'server_error'
  if (code >= 400) return 'client_error'
  if (code >= 300) return 'redirect'
  return 'success'
}

const SAMPLE_OBJECTS = {
  'POL-2026-98765': {
    kind: 'Policy',
    label: 'POL-2026-98765',
    title: 'Acme Manufacturing Inc. — General Liability',
    status: 'Bound',
    statusColor: 'accent',
    openedAgo: '4 min ago',
    openedBy: 'Divya M.',
    relatedTo: [
      { id: 'SUB-2026-10452', relation: 'Submission that produced this policy' },
      { id: 'CLM-2026-45021', relation: 'Claim opened against this policy' },
    ],
    fields: {
      'Line of business': 'General Liability',
      'Effective date': '2026-10-01',
      'Expiry date': '2027-10-01',
      'Written premium': '$185,000',
      Broker: 'ABC Insurance Brokers',
      Underwriter: 'Sara K.',
      Account: 'ACC-10045',
    },
    events: [
      { t: '13:30:00', api: 'Create Submission API', method: 'POST', path: '/api/v1/submissions', status: 201, ms: 178, actor: { name: 'ABC Broker Portal', kind: 'system' }, note: 'SUB-2026-10452 created for Acme Manufacturing' },
      { t: '13:30:05', api: 'Submission Documents API', method: 'POST', path: '/api/v1/submissions/SUB-2026-10452/documents', status: 201, ms: 312, actor: { name: 'James O.', kind: 'user' }, note: 'Acme_Loss_Run_2026.pdf uploaded (DOC-78931)' },
      { t: '13:31:22', api: 'Loss Run API', method: 'GET', path: '/api/v1/accounts/ACC-10045/loss-runs', status: 200, ms: 267, actor: { name: 'System', kind: 'system' }, note: 'Prior claims retrieved · 1 open, 1 closed' },
      { t: '13:31:45', api: 'Reference Data API', method: 'GET', path: '/api/v1/reference/class-codes?lob=GL&state=NJ', status: 200, ms: 22, actor: { name: 'System', kind: 'system' }, note: 'Class code 91580 resolved' },
      { t: '13:32:10', api: 'Appetite Check API', method: 'POST', path: '/api/v1/underwriting/appetite', status: 200, ms: 92, actor: { name: 'System', kind: 'system' }, note: 'ACCEPTABLE · score 84' },
      { t: '13:32:14', api: 'Risk Score API', method: 'POST', path: '/api/v1/underwriting/risk-score', status: 200, ms: 238, actor: { name: 'System', kind: 'system' }, note: 'MODERATE tier · REFER · 2 risk factors' },
      { t: '13:45:03', api: 'Quote API', method: 'POST', path: '/api/v1/quotes', status: 201, ms: 418, actor: { name: 'Sara K.', kind: 'user' }, note: 'QTE-45092 issued · premium $185,000' },
      { t: '14:12:08', api: 'Bind API', method: 'POST', path: '/api/v1/quotes/QTE-45092/bind', status: 502, ms: 3082, actor: { name: 'Sara K.', kind: 'user' }, note: 'Downstream forms service timeout' },
      { t: '14:12:22', api: 'Bind API', method: 'POST', path: '/api/v1/quotes/QTE-45092/bind', status: 200, ms: 372, actor: { name: 'Sara K.', kind: 'user' }, note: 'POL-2026-98765 bound · retry #1' },
      { t: '14:12:24', api: 'Policy Lookup API', method: 'GET', path: '/api/v1/policies/POL-2026-98765', status: 200, ms: 41, actor: { name: 'System', kind: 'system' }, note: 'Post-bind verification' },
      { t: '14:15:33', api: 'Policy Lookup API', method: 'GET', path: '/api/v1/policies/POL-2026-98765', status: 200, ms: 44, actor: { name: 'Divya M.', kind: 'user' }, note: 'Read-only inspection' },
    ],
  },
  'SUB-2026-10488': {
    kind: 'Submission',
    label: 'SUB-2026-10488',
    title: 'Cascade Trucking Co. — GL renewal',
    status: 'Quoted',
    statusColor: 'secondary',
    openedAgo: '1 hr ago',
    openedBy: 'James O.',
    relatedTo: [],
    fields: {
      'Line of business': 'General Liability',
      Broker: 'Cascade Insurance Partners',
      'Received at': '2026-08-16 08:32',
      'Effective date': '2026-11-01',
      Underwriter: 'James O.',
      Priority: 'HIGH',
      Indication: '$62,400',
    },
    events: [
      { t: '08:32:11', api: 'Create Submission API', method: 'POST', path: '/api/v1/submissions', status: 201, ms: 168, actor: { name: 'Cascade Broker Portal', kind: 'system' }, note: 'SUB-2026-10488 received · priority HIGH' },
      { t: '08:32:14', api: 'Submission Documents API', method: 'POST', path: '/api/v1/submissions/SUB-2026-10488/documents', status: 201, ms: 285, actor: { name: 'Cascade Broker Portal', kind: 'system' }, note: 'Application + SOV uploaded' },
      { t: '08:32:18', api: 'Loss Run API', method: 'GET', path: '/api/v1/accounts/ACC-10088/loss-runs', status: 404, ms: 218, actor: { name: 'System', kind: 'system' }, note: 'No prior loss history — new business flag set' },
      { t: '08:32:20', api: 'Reference Data API', method: 'GET', path: '/api/v1/reference/class-codes?lob=GL&state=OR', status: 200, ms: 23, actor: { name: 'System', kind: 'system' }, note: 'Trucking class codes returned' },
      { t: '08:32:22', api: 'Appetite Check API', method: 'POST', path: '/api/v1/underwriting/appetite', status: 200, ms: 108, actor: { name: 'System', kind: 'system' }, note: 'ACCEPTABLE · score 74' },
      { t: '08:33:15', api: 'Submission Status API', method: 'GET', path: '/api/v1/submissions/SUB-2026-10488/status', status: 200, ms: 41, actor: { name: 'James O.', kind: 'user' }, note: 'Under review · James O. assigned' },
      { t: '08:45:22', api: 'Risk Score API', method: 'POST', path: '/api/v1/underwriting/risk-score', status: 200, ms: 251, actor: { name: 'System', kind: 'system' }, note: 'MODERATE tier · 12 yrs in business' },
      { t: '08:47:03', api: 'Quote API', method: 'POST', path: '/api/v1/quotes', status: 201, ms: 402, actor: { name: 'James O.', kind: 'user' }, note: 'QTE-45188 issued · premium $62,400' },
    ],
  },
  'CLM-2026-45021': {
    kind: 'Claim',
    label: 'CLM-2026-45021',
    title: 'Slip and fall — Acme Manufacturing premises',
    status: 'Open · Investigation',
    statusColor: 'destructive',
    openedAgo: 'Yesterday',
    openedBy: 'Michael C.',
    relatedTo: [
      { id: 'POL-2026-98765', relation: 'Policy covering this claim' },
    ],
    fields: {
      'Loss type': 'Bodily Injury',
      'Date of loss': '2026-08-15',
      'Reported at': '2026-08-17 09:00',
      Policy: 'POL-2026-98765',
      Adjuster: 'Emily T.',
      Severity: 'MEDIUM',
      'Total incurred': '$140,000',
    },
    events: [
      { t: '09:00:03', api: 'FNOL API', method: 'POST', path: '/api/v1/claims/fnol', status: 201, ms: 232, actor: { name: 'Michael C.', kind: 'user' }, note: 'CLM-2026-45021 opened · John Carter assigned' },
      { t: '09:00:05', api: 'Policy Lookup API', method: 'GET', path: '/api/v1/policies/POL-2026-98765', status: 200, ms: 43, actor: { name: 'System', kind: 'system' }, note: 'Coverage verification · policy ACTIVE' },
      { t: '09:00:07', api: 'Exposure API', method: 'GET', path: '/api/v1/policies/POL-2026-98765/exposures', status: 200, ms: 76, actor: { name: 'System', kind: 'system' }, note: 'LOC-001 · Newark NJ · 85 employees' },
      { t: '09:00:09', api: 'Loss Run API', method: 'GET', path: '/api/v1/accounts/ACC-10045/loss-runs', status: 200, ms: 271, actor: { name: 'System', kind: 'system' }, note: 'Historical context loaded' },
      { t: '09:15:22', api: 'Claim Status API', method: 'GET', path: '/api/v1/claims/CLM-2026-45021/status', status: 200, ms: 52, actor: { name: 'Emily T.', kind: 'user' }, note: 'Investigation stage · reviewing intake' },
      { t: '14:22:17', api: 'Claim Reserve API', method: 'POST', path: '/api/v1/claims/CLM-2026-45021/reserves', status: 200, ms: 194, actor: { name: 'Emily T.', kind: 'user' }, note: 'Indemnity reserve raised to $125,000' },
      { t: '15:45:03', api: 'Claim Payment API', method: 'POST', path: '/api/v1/claims/CLM-2026-45021/payments', status: 200, ms: 338, actor: { name: 'Emily T.', kind: 'user' }, note: 'Initial ACH payment $15,000 · PAY-55231' },
    ],
  },
}

const SAMPLE_IDS = Object.keys(SAMPLE_OBJECTS)

function detectKind(raw) {
  const q = raw.trim().toUpperCase()
  if (q.startsWith('POL-')) return 'Policy'
  if (q.startsWith('SUB-')) return 'Submission'
  if (q.startsWith('CLM-')) return 'Claim'
  return null
}

function StatusChip({ code }) {
  const s = STATUS_COLORS[statusBucket(code)]
  return (
    <span
      className="inline-flex items-center rounded-md text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.color, padding: '0.15rem 0.5rem' }}
    >
      {code}
    </span>
  )
}

function MethodChip({ method }) {
  const s = METHOD_COLORS[method] || METHOD_COLORS.GET
  return (
    <span
      className="inline-flex items-center rounded-md text-xs font-bold uppercase"
      style={{ backgroundColor: s.bg, color: s.color, padding: '0.15rem 0.5rem', letterSpacing: '0.05em' }}
    >
      {method}
    </span>
  )
}

function ActorChip({ actor }) {
  const isUser = actor.kind === 'user'
  const Icon = isUser ? UserIcon : Cpu
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: 'hsl(var(--muted))' }}
    >
      <Icon className="h-3 w-3" /> {actor.name}
    </span>
  )
}

function StatusBadge({ label, tone }) {
  const map = {
    accent: { bg: 'hsl(var(--accent) / 0.18)', color: 'hsl(172 66% 25%)' },
    secondary: { bg: 'hsl(var(--secondary) / 0.15)', color: 'hsl(var(--secondary))' },
    destructive: { bg: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' },
    primary: { bg: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' },
  }
  const s = map[tone] || map.primary
  return (
    <span
      className="inline-flex items-center rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color, padding: '0.2rem 0.6rem' }}
    >
      {label}
    </span>
  )
}

function TimelineEvent({ ev, index, maxMs }) {
  const bucket = statusBucket(ev.status)
  const isError = bucket === 'client_error' || bucket === 'server_error'
  const barWidth = Math.max(6, Math.round((ev.ms / maxMs) * 100))
  const barColor = isError ? 'hsl(var(--destructive))' : 'hsl(var(--accent))'
  return (
    <div className="relative pl-8 pb-4">
      <div
        style={{
          position: 'absolute',
          left: '0.9rem',
          top: '0.35rem',
          bottom: '-0.5rem',
          width: '2px',
          backgroundColor: 'hsl(var(--border))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '0.55rem',
          top: '0.35rem',
          width: '0.7rem',
          height: '0.7rem',
          borderRadius: '9999px',
          backgroundColor: isError ? 'hsl(var(--destructive))' : 'hsl(var(--accent))',
          border: '2px solid hsl(var(--card))',
          boxShadow: '0 0 0 2px hsl(var(--border))',
        }}
      />
      <div className="card-base p-3" style={{ borderColor: isError ? 'hsl(var(--destructive) / 0.35)' : 'hsl(var(--border))' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-muted" style={{ minWidth: '4.5rem' }}>{ev.t}</span>
          <MethodChip method={ev.method} />
          <code className="text-xs font-mono">{ev.path}</code>
          <StatusChip code={ev.status} />
          <span className="text-xs text-muted">{ev.ms} ms</span>
          <div className="ml-auto flex items-center gap-2">
            <ActorChip actor={ev.actor} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--primary))' }}>{ev.api}</span>
          {ev.note && <span className="text-xs text-muted">· {ev.note}</span>}
        </div>
        <div className="mt-2" title={`${ev.ms} ms`}>
          <div
            style={{
              height: '4px',
              width: `${barWidth}%`,
              backgroundColor: barColor,
              borderRadius: '9999px',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function Hero({ onSearch, query, setQuery }) {
  return (
    <div
      className="rounded-2xl p-8"
      style={{
        background: 'linear-gradient(135deg, hsl(214 58% 29%) 0%, hsl(214 58% 22%) 100%)',
        color: '#ffffff',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--accent))' }}>
          Trace
        </span>
        <span className="text-xs" style={{ color: '#a8c1d7' }}>
          Follow a policy, submission, or claim across every API it touched.
        </span>
      </div>
      <h1 className="text-3xl font-bold mb-6">Where did this business object go?</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSearch(query)
        }}
        className="flex items-center"
        style={{ gap: '0.75rem' }}
      >
        <div className="relative flex-1">
          <Search
            className="h-5 w-5"
            style={{
              position: 'absolute',
              left: '0.9rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#0f2b46',
              opacity: 0.6,
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a policy, submission, or claim ID (e.g. POL-2026-98765)"
            className="w-full rounded-lg text-sm"
            style={{
              padding: '0.85rem 1rem 0.85rem 2.6rem',
              color: '#0f2b46',
              backgroundColor: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          />
        </div>
        <button
          type="submit"
          className="rounded-lg text-sm font-semibold"
          style={{
            backgroundColor: 'hsl(var(--accent))',
            color: '#0f2b46',
            padding: '0.85rem 1.3rem',
          }}
        >
          Trace
        </button>
      </form>
      <div className="mt-5">
        <span className="text-xs block mb-2" style={{ color: '#a8c1d7' }}>
          Try it:
        </span>
        <div className="flex items-center flex-wrap" style={{ gap: '0.6rem' }}>
          {SAMPLE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setQuery(id)
                onSearch(id)
              }}
              className="text-xs font-mono rounded-md"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                padding: '0.4rem 0.75rem',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ObjectSummary({ trace }) {
  return (
    <div className="card-base p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--accent))' }}>
              {trace.kind}
            </span>
            <StatusBadge label={trace.status} tone={trace.statusColor} />
          </div>
          <h2 className="text-2xl font-bold">{trace.label}</h2>
          <p className="text-sm text-muted mt-1">{trace.title}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Events</div>
          <div className="text-2xl font-bold">{trace.events.length}</div>
          <div className="text-xs text-muted mt-2">
            {trace.events.filter((e) => statusBucket(e.status).endsWith('error')).length} errors ·{' '}
            {Math.round(trace.events.reduce((s, e) => s + e.ms, 0))} ms total
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
        {Object.entries(trace.fields).map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-muted uppercase tracking-wide">{k}</div>
            <div className="font-semibold text-sm">{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApiBreakdown({ trace }) {
  const groups = useMemo(() => {
    const map = new Map()
    trace.events.forEach((e) => {
      const cur = map.get(e.api) || { calls: 0, ms: 0, errors: 0 }
      cur.calls += 1
      cur.ms += e.ms
      if (statusBucket(e.status).endsWith('error')) cur.errors += 1
      map.set(e.api, cur)
    })
    return Array.from(map.entries()).sort((a, b) => b[1].calls - a[1].calls)
  }, [trace])
  const totalMs = groups.reduce((s, [, v]) => s + v.ms, 0)
  return (
    <div className="card-base p-6">
      <h3 className="text-lg font-semibold mb-4">APIs involved</h3>
      <div className="space-y-3">
        {groups.map(([name, stats]) => {
          const share = totalMs ? Math.round((stats.ms / totalMs) * 100) : 0
          return (
            <div key={name}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{name}</span>
                <span className="text-xs text-muted">
                  {stats.calls} calls · {stats.ms} ms {stats.errors > 0 && (
                    <span style={{ color: 'hsl(var(--destructive))' }}> · {stats.errors} err</span>
                  )}
                </span>
              </div>
              <div className="mt-1" style={{ height: '6px', backgroundColor: 'hsl(var(--muted) / 0.15)', borderRadius: '9999px' }}>
                <div
                  style={{
                    width: `${share}%`,
                    height: '100%',
                    borderRadius: '9999px',
                    backgroundColor: stats.errors > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PolicyTrace() {
  const [query, setQuery] = useState('POL-2026-98765')
  const [active, setActive] = useState('POL-2026-98765')
  const [filter, setFilter] = useState('all')
  const [notFound, setNotFound] = useState(false)

  const { data: apis = [] } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  const trace = active ? SAMPLE_OBJECTS[active] : null

  const filteredEvents = useMemo(() => {
    if (!trace) return []
    if (filter === 'all') return trace.events
    if (filter === 'errors') return trace.events.filter((e) => statusBucket(e.status).endsWith('error'))
    if (filter === 'users') return trace.events.filter((e) => e.actor.kind === 'user')
    if (filter === 'system') return trace.events.filter((e) => e.actor.kind === 'system')
    return trace.events
  }, [trace, filter])

  const maxMs = useMemo(() => Math.max(...(trace?.events.map((e) => e.ms) || [1])), [trace])

  function handleSearch(rawInput) {
    const raw = (rawInput ?? query).trim().toUpperCase()
    if (SAMPLE_OBJECTS[raw]) {
      setActive(raw)
      setNotFound(false)
      return
    }
    const kind = detectKind(raw)
    if (kind) {
      // Route to first matching sample of same kind so demo always resolves
      const fallback = SAMPLE_IDS.find((id) => SAMPLE_OBJECTS[id].kind === kind)
      setActive(fallback || null)
      setNotFound(!fallback)
    } else {
      setActive(null)
      setNotFound(true)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <Hero query={query} setQuery={setQuery} onSearch={handleSearch} />

      {notFound && (
        <div
          className="card-base p-6 flex items-start gap-3"
          style={{ borderColor: 'hsl(var(--destructive) / 0.35)' }}
        >
          <AlertCircle className="h-5 w-5 mt-0.5" style={{ color: 'hsl(var(--destructive))' }} />
          <div>
            <p className="font-semibold">No trace found for "{query}"</p>
            <p className="text-sm text-muted mt-1">
              We couldn't match this ID to a business object. Try one of the sample IDs above, or use the
              format <code>POL-YYYY-#####</code>, <code>SUB-YYYY-#####</code>, or <code>CLM-YYYY-#####</code>.
            </p>
          </div>
        </div>
      )}

      {trace && (
        <>
          <ObjectSummary trace={trace} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-base p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-semibold">Timeline</h3>
                  <p className="text-xs text-muted">Every API call this object touched, in order.</p>
                </div>
                <div className="flex items-center text-xs" style={{ gap: '0.5rem' }}>
                  <Filter className="h-3.5 w-3.5 text-muted" />
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'errors', label: 'Errors' },
                    { id: 'users', label: 'By people' },
                    { id: 'system', label: 'By system' },
                  ].map((f) => {
                    const active = f.id === filter
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className="rounded-md font-semibold"
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: active ? 'hsl(var(--primary))' : 'transparent',
                          color: active ? '#ffffff' : 'hsl(var(--muted))',
                          border: active ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {filteredEvents.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">No events match this filter.</p>
              ) : (
                <div>
                  {filteredEvents.map((ev, i) => (
                    <TimelineEvent key={`${ev.t}-${i}`} ev={ev} index={i} maxMs={maxMs} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <ApiBreakdown trace={trace} />

              {trace.relatedTo && trace.relatedTo.length > 0 && (
                <div className="card-base p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Related</h3>
                    <span className="text-xs text-muted">from this catalog</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {trace.relatedTo.map((rel) => {
                      const related = SAMPLE_OBJECTS[rel.id]
                      if (!related) return null
                      return (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => {
                            setQuery(rel.id)
                            setActive(rel.id)
                            setNotFound(false)
                          }}
                          className="w-full text-left bg-transparent rounded-md"
                          style={{
                            padding: '0.6rem 0.75rem',
                            border: '1px solid hsl(var(--border))',
                          }}
                        >
                          <div className="flex items-center gap-2 text-xs text-muted mb-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {rel.relation}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono">{rel.id}</span>
                            <StatusBadge label={related.status} tone={related.statusColor} />
                          </div>
                          <div className="text-sm font-semibold mt-1">{related.title}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="card-base p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Recently opened</h3>
                  <button
                    type="button"
                    className="bg-transparent text-xs font-semibold"
                    style={{ color: 'hsl(var(--primary))', padding: 0 }}
                  >
                    Show all
                  </button>
                </div>
                <div className="flex flex-col" style={{ gap: '0.35rem' }}>
                  {SAMPLE_IDS.map((id) => {
                    const o = SAMPLE_OBJECTS[id]
                    const isActive = id === active
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setQuery(id)
                          setActive(id)
                          setNotFound(false)
                        }}
                        className="w-full text-left rounded-md bg-transparent"
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderLeft: isActive ? '3px solid hsl(var(--primary))' : '3px solid transparent',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono" style={{ color: 'hsl(var(--muted))' }}>{id}</span>
                          <span className="text-xs text-muted">{o.openedAgo}</span>
                        </div>
                        <div className="text-sm font-semibold mt-0.5">{o.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                          <span>{o.status}</span>
                          <span>·</span>
                          <span>opened by {o.openedBy}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
