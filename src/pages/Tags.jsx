import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client.js'
import { DataTable, EmptyState, ErrorState, LoadingState, MetricCard, PageHeader, SearchField, SegmentedControl, StatusBadge, useNarrow } from '../components/ui.jsx'

const categoryTone = {
  Security: 'danger',
  Lifecycle: 'warning',
  'Technical Type': 'success',
  'Business Domain': 'info',
  Environment: 'neutral',
}

export default function Tags() {
  const tags = useQuery({ queryKey: ['tags'], queryFn: api.tags })
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const narrow = useNarrow()
  const categories = useMemo(() => ['All', ...new Set((tags.data || []).map((tag) => tag.category))], [tags.data])
  const visible = (tags.data || []).filter((tag) => {
    const matchesCategory = category === 'All' || tag.category === category
    const haystack = `${tag.tag} ${tag.description} ${tag.owner}`.toLowerCase()
    return matchesCategory && haystack.includes(query.toLowerCase())
  })

  if (tags.isLoading) return <LoadingState label="Loading tags" />
  if (tags.isError) return <ErrorState title="Unable to load tags" onRetry={() => tags.refetch()} />

  const assignments = tags.data.reduce((sum, tag) => sum + tag.count, 0)
  const covered = new Set(tags.data.flatMap((tag) => tag.apis)).size
  const owners = new Set(tags.data.map((tag) => tag.owner)).size

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader eyebrow="Metadata governance" title="Context Tags" description="Governance labels used to classify APIs by domain, security, lifecycle, and environment." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assignments" value={assignments} hint="Tag uses across the catalog" />
        <MetricCard label="Categories" value={categories.length - 1} hint="Distinct tag groups" />
        <MetricCard label="Owners" value={owners} hint="Teams responsible for a tag" />
        <MetricCard label="Covered APIs" value={covered} hint="APIs with at least one tag" />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchField id="tag-search" label="Search tags" value={query} onChange={setQuery} placeholder="Tag, owner, or description" />
        <SegmentedControl label="Category" value={category} onChange={setCategory} options={categories.map((value) => ({ value, label: value }))} />
      </div>
      <div className="min-w-0">
        {visible.length === 0 ? (
          <EmptyState title="No tags match" description="Try another category or a shorter search." />
        ) : narrow ? (
          <div className="grid gap-2">
            {visible.map((tag) => (
              <div key={tag.tag} className="rounded-lg border border-line bg-surface p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge tone={categoryTone[tag.category]}>{tag.tag}</StatusBadge>
                  <span className="text-sm font-bold">{tag.count}</span>
                </div>
                <p className="mt-2 text-xs text-ink-muted">{tag.category} · {tag.owner}</p>
                <p className="mt-1 text-sm">{tag.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <DataTable
            rows={visible}
            getRowKey={(tag) => tag.tag}
            minWidth="720px"
            columns={[
              { key: 'tag', header: 'Tag', render: (tag) => <span className="font-bold">{tag.tag}</span> },
              { key: 'category', header: 'Category', render: (tag) => <StatusBadge tone={categoryTone[tag.category]}>{tag.category}</StatusBadge> },
              { key: 'owner', header: 'Owner', render: (tag) => tag.owner },
              { key: 'count', header: 'APIs', render: (tag) => tag.count },
              { key: 'description', header: 'Description', render: (tag) => tag.description },
            ]}
          />
        )}
      </div>
    </div>
  )
}
