import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarPlus, Users, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiClient } from '../services/apiClient'

const RANGE_OPTIONS = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
]

// Deterministic pseudo-random in [0, 1) so daily values stay stable across re-renders.
function seededRandom(seedStr) {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function formatCount(n) {
  return Math.round(n).toLocaleString()
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CallsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '0.5rem',
        padding: '0.6rem 0.9rem',
        boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
        fontSize: '0.85rem',
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ color: 'hsl(var(--muted))' }}>{payload[0].value.toLocaleString()} calls</p>
    </div>
  )
}

// Distribute the ~18K monthly aggregate across active consumers so Top Consumers totals match the chart.
const CALLS_PER_CONSUMER_MONTHLY = 450

export default function Dashboard() {
  const { data: apis = [] } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  const addedThisMonth = apis.length ? Math.max(1, Math.round(apis.length * 0.12)) : 0

  const stats = [
    { label: 'Total APIs', value: apis.length, icon: Zap },
    { label: 'Active', value: apis.filter(a => a.lifecycle === 'Published').length, icon: Activity },
    { label: 'Consumers', value: apis.reduce((sum, a) => sum + (Number(a.consumers) || 0), 0), icon: Users },
    { label: 'Added This Month', value: addedThisMonth, icon: CalendarPlus },
  ]

  const [range, setRange] = useState('30d')
  const days = RANGE_OPTIONS.find((r) => r.key === range).days

  const callsOverTime = useMemo(() => {
    const now = new Date()
    const rows = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const rnd = seededRandom(`calls-${d.toISOString().slice(0, 10)}`)
      rows.push({ date: formatDay(d), calls: Math.round(200 + rnd * 800) })
    }
    return rows
  }, [days])

  const xTickInterval = Math.max(0, Math.floor(days / 6) - 1)

  const teamCalls = useMemo(() => {
    if (!apis.length) return []
    const totals = new Map()
    for (const api of apis) {
      const owner = api.owner || 'Unknown Team'
      const monthly = (Number(api.consumers) || 0) * CALLS_PER_CONSUMER_MONTHLY
      totals.set(owner, (totals.get(owner) || 0) + monthly)
    }
    const sorted = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    const max = sorted[0]?.[1] || 1
    return sorted.map(([team, calls]) => ({
      team,
      calls,
      width: `${Math.round((calls / max) * 100)}%`,
    }))
  }, [apis])

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="bg-gradient-primary text-white rounded-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-2">API Developer Workbench</h1>
        <p className="text-lg opacity-90">Publication status, versions, and consumers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className="card-base p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <Icon className="h-8 w-8 text-primary opacity-70" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">API calls over time</h2>
              <p className="text-xs text-muted">all environments</p>
            </div>
            <div className="inline-flex rounded-md bg-muted p-1">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRange(opt.key)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    range === opt.key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {opt.key}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={callsOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted))"
                tickLine={false}
                axisLine={false}
                interval={xTickInterval}
              />
              <YAxis
                stroke="hsl(var(--muted))"
                tickFormatter={formatCount}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CallsTooltip />} />
              <Area
                type="monotone"
                dataKey="calls"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#callsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-base p-6">
          <h2 className="text-xl font-semibold mb-6">Top Consumers</h2>
          <div className="space-y-4">
            {teamCalls.map((team) => (
              <div key={team.team}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium">{team.team}</p>
                  <p className="text-xs text-muted">{team.calls.toLocaleString()} calls</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-gradient-primary h-full rounded-full" style={{ width: team.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-base p-6">
        <h2 className="text-xl font-semibold mb-6">API Lifecycle</h2>
        <div className="scrollable border border-border rounded-md" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="w-full text-sm">
            <thead className="border-b border-border sticky top-0 bg-card" style={{ position: 'sticky', top: 0 }}>
              <tr>
                <th className="pb-3 font-bold text-foreground text-left px-4">API Name</th>
                <th className="pb-3 font-bold text-foreground text-left px-4">Version</th>
                <th className="pb-3 font-bold text-foreground text-left px-4">Status</th>
                <th className="pb-3 font-bold text-foreground text-left px-4">Owner</th>
                <th className="pb-3 font-bold text-foreground text-right px-4">Consumers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apis.slice(0, 10).map((api) => (
                <tr key={api.id} className="hover:bg-muted transition-colors">
                  <td className="py-3 font-medium px-4">{api.name}</td>
                  <td className="py-3 px-4">{api.version}</td>
                  <td className="py-3 px-4">{api.lifecycle || '—'}</td>
                  <td className="py-3 text-sm px-4">{api.owner}</td>
                  <td className="py-3 text-right px-4">{api.consumers || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
