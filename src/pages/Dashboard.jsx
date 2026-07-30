import { useQuery } from '@tanstack/react-query'
import { Activity, TrendingUp, Users, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiClient } from '../services/apiClient'

const chartData = [
  { month: 'Jan', calls: 800 },
  { month: 'Feb', calls: 950 },
  { month: 'Mar', calls: 700 },
  { month: 'Apr', calls: 1100 },
  { month: 'May', calls: 850 },
  { month: 'Jun', calls: 1200 },
]

const teamCalls = [
  { team: 'BDX Team', calls: '1200', width: '100%' },
  { team: 'Submission Team', calls: '1100', width: '92%' },
  { team: 'Policy Team', calls: '900', width: '75%' },
  { team: 'Architecture Team', calls: '750', width: '62%' },
]

export default function Dashboard() {
  const { data: apis = [] } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  const stats = [
    { label: 'Total APIs', value: apis.length, icon: Zap },
    { label: 'Active', value: apis.filter(a => a.lifecycle === 'Published').length, icon: Activity },
    { label: 'Consumers', value: apis.reduce((sum, a) => sum + (Number(a.consumers) || 0), 0), icon: Users },
    { label: 'Growth', value: '+12%', icon: TrendingUp },
  ]

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="bg-gradient-primary text-white rounded-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-2">API Catalog Dashboard</h1>
        <p className="text-lg opacity-90">Publication status, versions, consumers, and health</p>
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
          <h2 className="text-xl font-semibold mb-6">API Calls Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted))" />
              <YAxis stroke="hsl(var(--muted))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card-base p-6">
          <h2 className="text-xl font-semibold mb-6">Top Consumers</h2>
          <div className="space-y-4">
            {teamCalls.map((team) => (
              <div key={team.team}>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium">{team.team}</p>
                  <p className="text-xs text-muted">{team.calls} calls</p>
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
