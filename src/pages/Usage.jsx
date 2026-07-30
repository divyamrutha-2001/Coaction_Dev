import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { apiClient } from '../services/apiClient'

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f97316', '#ec4899']

function parseCallMetric(value) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return 0

  const normalized = value.trim().toUpperCase()
  if (normalized.endsWith('K')) {
    return Math.round(Number.parseFloat(normalized.slice(0, -1)) * 1000)
  }

  return Number.parseInt(normalized, 10) || 0
}

export default function Usage() {
  const { data: apis = [] } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  const usageApis = apis.slice(0, 8)
  const monthlyCallFactor = 0.08
  const totalCalls30d = apis.reduce((sum, api) => sum + Math.round(parseCallMetric(api.calls) * monthlyCallFactor), 0)

  const chartData = usageApis.map((api) => ({
    name: api.name.substring(0, 10),
    calls: Math.round(parseCallMetric(api.calls) * monthlyCallFactor),
    errors: Math.max(3, Math.round(parseCallMetric(api.calls) * 0.0012)),
  }))

  const typeDistribution = [
    { name: 'REST', value: apis.filter((a) => a.type === 'REST').length },
    { name: 'SOAP', value: apis.filter((a) => a.type === 'SOAP').length },
    { name: 'Internal', value: apis.filter((a) => a.type === 'Internal').length },
  ]

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Usage & KPIs</h1>
        <p className="text-muted">API performance metrics and adoption analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-base p-6">
          <h3 className="text-sm text-muted mb-2">Total API Calls (30d)</h3>
          <p className="text-3xl font-bold text-primary">{totalCalls30d.toLocaleString()}</p>
        </div>
        <div className="card-base p-6">
          <h3 className="text-sm text-muted mb-2">Avg Error Rate</h3>
          <p className="text-3xl font-bold text-accent">0.42%</p>
        </div>
        <div className="card-base p-6">
          <h3 className="text-sm text-muted mb-2">Avg Response Time</h3>
          <p className="text-3xl font-bold text-primary">240ms</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-base p-6">
          <h2 className="text-xl font-semibold mb-6">Calls & Errors by API</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted))" />
              <YAxis stroke="hsl(var(--muted))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="errors" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-base p-6">
          <h2 className="text-xl font-semibold mb-6">API Type Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={typeDistribution} cx="50%" cy="50%" labelLine={false} label>
                {typeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {typeDistribution.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-sm">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-base p-6">
        <h2 className="text-xl font-semibold mb-6">Top Performing APIs (Last 7 Days)</h2>
        <div className="space-y-3">
          {usageApis.slice(0, 5).map((api) => {
            const availability = Math.floor(Math.random() * 5) + 95
            const weeklyCalls = Math.max(120, Math.round(parseCallMetric(api.calls) * 0.018))
            const weeklyErrors = Math.max(1, Math.round(weeklyCalls * 0.004))
            return (
              <div key={api.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <p className="font-medium">{api.name}</p>
                  <p className="text-xs text-muted">Calls: {weeklyCalls.toLocaleString()} | Errors: {weeklyErrors.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">{availability}%</p>
                  <p className="text-xs text-muted">Availability</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
