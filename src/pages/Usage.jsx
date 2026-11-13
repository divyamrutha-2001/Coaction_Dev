import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CircleAlert, Download, Gauge, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, formatNumber } from '../api/client.js'
import { DataTable, EmptyState, ErrorState, formatWhen, LoadingState, MetricCard, PageHeader, Panel, SearchField, SegmentedControl, StatusBadge, useNarrow } from '../components/ui.jsx'

const ranges = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)',
}

export default function Usage() {
  const [range, setRange] = useState('30d')
  const [query, setQuery] = useState('')
  const narrow = useNarrow()
  const usage = useQuery({ queryKey: ['usage', range], queryFn: () => api.usage(range) })
  const downloads = useQuery({ queryKey: ['downloads'], queryFn: api.downloads })
  const rows = useMemo(() => (usage.data?.apis || []).filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [usage.data, query])
  if (usage.isLoading) return <LoadingState label="Loading usage" />
  if (usage.isError) return <ErrorState title="Unable to load usage" onRetry={() => usage.refetch()} />
  const totals = usage.data.totals
  const errorRate = totals.calls ? `${((totals.errors / totals.calls) * 100).toFixed(2)}%` : '0%'
  const chartData = usage.data.apis.slice(0, 8).map((item) => ({ ...item, short: item.name.replace(' API', '') }))

  return (
    <div className="control-tower flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow="Usage analytics"
        title="Usage & KPIs"
        description="Calls, errors, and latency for the selected window."
        actions={<SegmentedControl label="Range" value={range} onChange={setRange} options={ranges} />}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Activity} label="API calls" value={formatNumber(totals.calls)} hint={ranges.find((item) => item.value === range)?.label} />
        <MetricCard icon={CircleAlert} label="Errors" value={formatNumber(totals.errors)} hint={`${errorRate} of calls`} tone={totals.errors ? 'amber' : 'slate'} />
        <MetricCard icon={Gauge} label="Avg latency" value={`${totals.avgLatency} ms`} hint="Weighted by call volume" tone="violet" />
        <MetricCard icon={Users} label="Consumers" value={formatNumber(totals.consumers)} hint="Across listed APIs" />
      </div>
      <Panel title="Calls and errors by API" description="Navy bars are calls. Amber bars are errors. Both are labeled in the legend.">
        <div className="h-80 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            {narrow ? (
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="short" width={108} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatNumber(value), name === 'calls' ? 'Calls' : 'Errors']} />
                <Legend formatter={(value) => (value === 'calls' ? 'Calls' : 'Errors')} />
                <Bar dataKey="calls" name="calls" fill="#2563eb" radius={[0, 4, 4, 0]} />
                <Bar dataKey="errors" name="errors" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 7" vertical={false} />
                <XAxis dataKey="short" interval={0} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(value) => (value.length > 16 ? `${value.slice(0, 14)}...` : value)} height={48} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={56} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatNumber(value), name === 'calls' ? 'Calls' : 'Errors']} />
                <Legend formatter={(value) => (value === 'calls' ? 'Calls' : 'Errors')} />
                <Bar dataKey="calls" name="calls" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="errors" name="errors" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="API KPI detail" actions={<SearchField id="usage-search" label="Search APIs" value={query} onChange={setQuery} placeholder="API name" />}>
        {rows.length === 0 ? <EmptyState title="No APIs match" description="Try a different name." /> : narrow ? (
          <div className="grid gap-2">
            {rows.map((row) => (
              <article key={row.name} className="rounded-md border border-line p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{row.name}</h3>
                    <p className="text-xs text-ink-muted">{row.owner} · {row.type}</p>
                  </div>
                  <StatusBadge>{row.lifecycle}</StatusBadge>
                </div>
                <p className="mt-2 text-ink">{formatNumber(row.calls)} calls · {formatNumber(row.errors)} errors · {row.latency} ms</p>
              </article>
            ))}
          </div>
        ) : (
          <DataTable
            rows={rows}
            getRowKey={(row) => row.name}
            columns={[
              { key: 'name', header: 'API', render: (row) => <div><div className="font-semibold">{row.name}</div><div className="text-xs text-ink-muted">{row.owner} · {row.type}</div></div> },
              { key: 'calls', header: 'Calls', render: (row) => formatNumber(row.calls) },
              { key: 'errors', header: 'Errors', render: (row) => formatNumber(row.errors) },
              { key: 'latency', header: 'Latency', render: (row) => `${row.latency} ms` },
              { key: 'lifecycle', header: 'Lifecycle', render: (row) => <StatusBadge>{row.lifecycle}</StatusBadge> },
            ]}
          />
        )}
      </Panel>
      <Panel
        title="Artifact downloads"
        description="Specs and collections exported from the Sandbox."
        actions={<Download className="h-4 w-4 text-ink-muted" aria-hidden="true" />}
      >
        {(downloads.data || []).length === 0 ? (
          <EmptyState title="No downloads yet" description="Export an OpenAPI spec or Postman collection from the Sandbox and it will appear here." />
        ) : (
          <DataTable
            rows={downloads.data}
            getRowKey={(row) => `${row.artifact}-${row.api}-${row.date}`}
            columns={[
              { key: 'artifact', header: 'Artifact', render: (row) => <span className="font-semibold">{row.artifact}</span> },
              { key: 'api', header: 'API' },
              { key: 'by', header: 'By' },
              { key: 'date', header: 'When', render: (row) => formatWhen(row.date) },
            ]}
          />
        )}
      </Panel>
    </div>
  )
}
