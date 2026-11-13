import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowRight,
  Boxes,
  CircleAlert,
  Network,
  Users,
} from 'lucide-react'
import { api, formatNumber } from '../api/client.js'
import { ErrorState, LoadingState, StatusBadge, shortDate, useNarrow } from '../components/ui.jsx'

export default function Dashboard() {
  const narrow = useNarrow()
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const access = useQuery({ queryKey: ['access'], queryFn: api.access })

  useEffect(() => {
    if (window.location.hash === '#attention') {
      document.getElementById('attention')?.scrollIntoView({ block: 'start' })
    }
  }, [dashboard.data])

  if (dashboard.isLoading) return <LoadingState label="Loading workbench dashboard" />
  if (dashboard.isError) return <ErrorState title="Unable to load the dashboard" onRetry={() => dashboard.refetch()} />

  const data = dashboard.data
  const apis = catalog.data || []
  const days = data.callsByDay || []
  const flagged = apis.filter((item) => item.lifecycle === 'Draft' || item.lifecycle === 'Deprecated')
  const draftCount = flagged.filter((item) => item.lifecycle === 'Draft').length
  const deprecatedCount = flagged.filter((item) => item.lifecycle === 'Deprecated').length
  const pendingAccess = access.data?.summary?.pendingRequests || 0
  const totalCalls = sum(days, 'calls')
  const peakCalls = [...days].sort((a, b) => b.calls - a.calls)[0]
  const peakErrors = [...days].sort((a, b) => (b.errors || 0) - (a.errors || 0))[0]
  const publishedPercent = data.totalApis ? Math.round((data.publishedCnt / data.totalApis) * 100) : 0

  const ownerChart = (data.topOwners || []).map((owner) => ({
    owner: owner.owner.replace(' Team', ''),
    calls: owner.calls,
  }))

  return (
    <div className="control-tower flex flex-col gap-3">
      <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-graphite px-2.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">Control tower</span>
            </div>
            <div className="mt-3">
              <h1 className="text-3xl font-bold text-ink">API Developer Workbench</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
                One place to publish APIs, browse the catalog, try requests in the Sandbox, and trace a policy across the services that touched it.
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-navy p-4 text-white">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-100">Published APIs</p>
              <p className="text-2xl font-black">{data.publishedCnt}<span className="text-base text-slate-300">/{data.totalApis}</span></p>
            </div>
            <div className="mt-2 h-1.5 rounded-md bg-white/10">
              <div className="h-full rounded-md bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${publishedPercent}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Published" value={`${publishedPercent}%`} />
              <MiniStat label="Draft" value={draftCount} highlight={draftCount > 0} />
              <MiniStat label="Deprecated" value={deprecatedCount} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Boxes} label="Catalog" value={formatNumber(data.totalApis)} detail={`${formatNumber(data.publishedCnt)} published`} />
        <Kpi icon={CircleAlert} label="Needs action" value={formatNumber(flagged.length + pendingAccess)} detail={`${draftCount} draft · ${pendingAccess} access`} tone={flagged.length + pendingAccess ? 'amber' : 'slate'} />
        <Kpi icon={Users} label="Consumers" value={formatNumber(data.consumersCnt)} detail={`${formatNumber(data.apisCalled || 0)} of ${formatNumber(data.totalApis)} APIs called`} />
        <PeakCallsKpi days={days} peakCalls={peakCalls} />
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-ink">Traffic quality</h2>
              <p className="mt-1 text-sm text-ink-muted">Call volume and error pressure across the current 30-day window.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {peakCalls && <span className="rounded-md bg-cyan-50 px-2.5 py-1.5 text-cyan-950 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-500/30">Peak {shortDate(peakCalls.date)} · {formatNumber(peakCalls.calls)}</span>}
              {peakErrors?.errors > 0 && <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">Errors {shortDate(peakErrors.date)} · {formatNumber(peakErrors.errors)}</span>}
            </div>
          </div>
          <div className="h-56 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ left: 0, right: 8, top: 12 }}>
                <defs>
                  <linearGradient id="callsFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="errorsFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 7" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} interval={narrow ? 6 : 3} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} width={56} tickFormatter={(value) => formatNumber(value)} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)' }}
                  formatter={(value, name) => [formatNumber(value), name === 'calls' ? 'Calls' : 'Errors']}
                  labelFormatter={(label) => `Date ${label}`}
                />
                <Area type="monotone" dataKey="calls" name="calls" stroke="#2563eb" strokeWidth={2.5} fill="url(#callsFill)" />
                <Area type="monotone" dataKey="errors" name="errors" stroke="#f97316" strokeWidth={2.25} fill="url(#errorsFill)" strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-ink">Consumer demand</h2>
              <p className="mt-1 text-sm text-ink-muted">Top owners ranked by call volume.</p>
            </div>
            <Link to="/usage" className="inline-flex items-center gap-1 text-sm font-bold text-cyan-700 hover:text-cyan-900">
              Usage <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-5">
            <div className="h-56 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerChart} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 7" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="owner" width={168} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [formatNumber(value), 'Calls']} />
                  <Bar dataKey="calls" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}

function Kpi({ icon: Icon, label, value, detail, tone = 'cyan' }) {
  return (
    <article className={`kpi-tile kpi-${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">{label}</p>
          <p className="mt-2 text-3xl font-black text-ink">{value}</p>
        </div>
        <span className="rounded-lg p-2.5">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-ink-muted">{detail}</p>
    </article>
  )
}

function PeakCallsKpi({ days, peakCalls }) {
  const [hover, setHover] = useState(null)
  const W = 200
  const H = 36
  const BASE = 26
  const beats = days
  const values = beats.map((day) => Number(day.calls || 0))
  const max = Math.max(1, peakCalls?.calls || 0, ...values)
  const seg = values.length ? W / values.length : W
  const center = (i) => i * seg + seg * 0.5
  const points = [`0,${BASE}`]
  values.forEach((v, i) => {
    // Days with no calls stay flat; spikes scale against the peak day.
    if (v <= 0) return
    const s = i * seg
    const a = v / max
    const r = 3 + a * 21
    points.push(
      `${s + seg * 0.2},${BASE}`,
      `${s + seg * 0.28},${BASE - r * 0.12}`,
      `${s + seg * 0.36},${BASE}`,
      `${s + seg * 0.42},${BASE + r * 0.1}`,
      `${s + seg * 0.5},${BASE - r}`,
      `${s + seg * 0.58},${BASE + Math.min(8, r * 0.3)}`,
      `${s + seg * 0.64},${BASE}`,
      `${s + seg * 0.76},${BASE - r * 0.15}`,
      `${s + seg * 0.88},${BASE}`,
    )
  })
  points.push(`${W},${BASE}`)
  const active = hover == null ? null : beats[hover]
  const shown = active ? active.calls : peakCalls?.calls || 0

  function onMove(event) {
    if (!values.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(0.9999, Math.max(0, (event.clientX - rect.left) / rect.width))
    setHover(Math.floor(ratio * values.length))
  }

  return (
    <article className="kpi-tile kpi-cyan">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">{active ? 'Calls that day' : 'Peak calls'}</p>
          <p className="mt-2 text-3xl font-black text-ink">{formatNumber(shown)}</p>
          <p className={`mt-0.5 text-xs font-medium text-ink-muted ${active ? 'invisible' : ''}`}>
            {peakCalls ? `Peak on ${formatLongDay(peakCalls.date)}` : 'No calls yet'}
          </p>
        </div>
        <span className="rounded-lg p-2.5">
          <Network className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="relative mt-2 h-9 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
          {active && <rect x={hover * seg} y="0" width={seg} height={H} fill="#2563eb" opacity="0.12" />}
          <polyline points={points.join(' ')} fill="none" stroke="#2563eb" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {values.length > 0 && <span className="pulse-end-dot" />}
        {active && (
          <span
            className="pointer-events-none absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-md bg-graphite px-2 py-1 text-[11px] font-semibold text-white shadow"
            style={{ left: `${Math.min(80, Math.max(20, (center(hover) / W) * 100))}%` }}
          >
            {formatLongDay(active.date)} · {formatNumber(active.calls)} calls
          </span>
        )}
      </div>
    </article>
  )
}

function formatLongDay(value) {
  // Parse YYYY-MM-DD as a local date so it doesn't shift a day in US time zones.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  const date = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value)
  if (Number.isNaN(date.getTime())) return shortDate(value)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function MiniStat({ label, value, highlight }) {
  return (
    <div className={`rounded-lg px-2 py-2 ring-1 ${highlight ? 'bg-amber-400/15 ring-amber-300/50' : 'bg-white/[0.07] ring-white/10'}`}>
      <p className={`text-xl font-bold leading-tight ${highlight ? 'text-amber-200' : 'text-white'}`}>{value}</p>
      <p className={`mt-0.5 text-xs font-medium ${highlight ? 'text-amber-100' : 'text-slate-200'}`}>{label}</p>
    </div>
  )
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0)
}
