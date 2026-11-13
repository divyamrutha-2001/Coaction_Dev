import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Activity,
  ArrowRight,
  Boxes,
  CircleAlert,
  Download,
  GitBranch,
  Library,
  Network,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react'
import { api, formatNumber } from '../api/client.js'
import { ErrorState, LoadingState, StatusBadge, shortDate, useNarrow } from '../components/ui.jsx'

const launches = [
  { to: '/api-library', label: 'Browse APIs', icon: Library },
  { to: '/upload', label: 'Publish API', icon: Upload },
  { to: '/trace', label: 'Trace object', icon: GitBranch },
  { to: '/access', label: 'Review access', icon: ShieldCheck },
  { to: '/download', label: 'Export package', icon: Download },
]

export default function Dashboard() {
  const narrow = useNarrow()
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const access = useQuery({ queryKey: ['access'], queryFn: api.access })
  const source = useQuery({ queryKey: ['catalog-source'], queryFn: api.catalogSource })

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
  const totalErrors = sum(days, 'errors')
  const errorRate = totalCalls ? ((totalErrors / totalCalls) * 100).toFixed(2) : '0.00'
  const peakCalls = [...days].sort((a, b) => b.calls - a.calls)[0]
  const peakErrors = [...days].sort((a, b) => (b.errors || 0) - (a.errors || 0))[0]
  const publishedPercent = data.totalApis ? Math.round((data.publishedCnt / data.totalApis) * 100) : 0
  const sourceMeta = source.data
    ? `${source.data.specCount} specs · ${source.data.branch || 'main'}${source.data.commit ? ` @ ${source.data.commit}` : ''}`
    : 'Catalog source loading'

  const publicationTone = draftCount || deprecatedCount ? 'Needs review' : 'All published'
  const ownerChart = (data.topOwners || []).map((owner) => ({
    owner: owner.owner.replace(' Team', ''),
    calls: owner.calls,
  }))

  return (
    <div className="control-tower flex flex-col gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">Control tower</span>
              <span className="rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-900 ring-1 ring-cyan-200">{sourceMeta}</span>
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">API Developer Workbench</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Operational view of publication status, traffic quality, consumer demand, and governance work.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {launches.slice(0, 3).map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.to} to={item.to} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 transition hover:border-cyan-300 hover:bg-cyan-50">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-[#1a3a52] p-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Published APIs</p>
                <p className="mt-2 text-5xl font-black">{data.publishedCnt}<span className="text-2xl text-slate-300">/{data.totalApis}</span></p>
              </div>
              <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${publicationTone === 'All published' ? 'bg-emerald-300 text-emerald-950' : 'bg-amber-300 text-amber-950'}`}>
                {publicationTone}
              </span>
            </div>
            <div className="mt-4 h-2 rounded-md bg-white/10">
              <div className="h-full rounded-md bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${publishedPercent}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Published" value={`${publishedPercent}%`} />
              <MiniStat label="Draft" value={draftCount} />
              <MiniStat label="Deprecated" value={deprecatedCount} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={Boxes} label="Catalog" value={formatNumber(data.totalApis)} detail={`${formatNumber(data.publishedCnt)} published`} />
        <Kpi icon={CircleAlert} label="Needs action" value={formatNumber(flagged.length + pendingAccess)} detail={`${draftCount} draft · ${pendingAccess} access`} tone={flagged.length + pendingAccess ? 'amber' : 'slate'} />
        <Kpi icon={Activity} label="Error rate" value={`${errorRate}%`} detail={peakErrors?.errors ? `${formatNumber(peakErrors.errors)} peak errors` : 'No errors'} tone={Number(errorRate) ? 'violet' : 'slate'} />
        <Kpi icon={Users} label="Consumers" value={formatNumber(data.consumersCnt)} detail={`${formatNumber(data.addedThisMonthCnt)} APIs added`} />
        <Kpi icon={Network} label="Peak calls" value={peakCalls ? formatNumber(peakCalls.calls) : '0'} detail={peakCalls ? shortDate(peakCalls.date) : 'No calls'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.85fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Traffic quality</h2>
              <p className="mt-1 text-sm text-slate-600">Call volume and error pressure across the current 30-day window.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {peakCalls && <span className="rounded-md bg-cyan-50 px-2.5 py-1.5 text-cyan-950 ring-1 ring-cyan-200">Peak {shortDate(peakCalls.date)} · {formatNumber(peakCalls.calls)}</span>}
              {peakErrors?.errors > 0 && <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-950 ring-1 ring-amber-200">Errors {shortDate(peakErrors.date)} · {formatNumber(peakErrors.errors)}</span>}
            </div>
          </div>
          <div className="h-72 min-w-0">
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
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 7" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} interval={narrow ? 6 : 3} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} width={56} tickFormatter={(value) => formatNumber(value)} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #d8e0ea', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)' }}
                  formatter={(value, name) => [formatNumber(value), name === 'calls' ? 'Calls' : 'Errors']}
                  labelFormatter={(label) => `Date ${label}`}
                />
                <Area type="monotone" dataKey="calls" name="calls" stroke="#2563eb" strokeWidth={2.5} fill="url(#callsFill)" />
                <Area type="monotone" dataKey="errors" name="errors" stroke="#f97316" strokeWidth={2.25} fill="url(#errorsFill)" strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Consumer demand</h2>
              <p className="mt-1 text-sm text-slate-600">Top owners ranked by call volume.</p>
            </div>
            <Link to="/usage" className="inline-flex items-center gap-1 text-sm font-bold text-cyan-700 hover:text-cyan-900">
              Usage <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-5">
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerChart} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 7" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="owner" width={88} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
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
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <span className="rounded-lg p-2.5">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">{detail}</p>
    </article>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.08] px-3 py-2 ring-1 ring-white/10">
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  )
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0)
}
