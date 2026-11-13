import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client.js'
import { DataTable, EmptyState, ErrorState, LoadingState, MetricCard, PageHeader, Panel, SearchField, SegmentedControl, StatusBadge, useNarrow } from '../components/ui.jsx'

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
  const [selected, setSelected] = useState('')
  const narrow = useNarrow()
  const categories = useMemo(() => ['All', ...new Set((tags.data || []).map((tag) => tag.category))], [tags.data])
  const visible = (tags.data || []).filter((tag) => {
    const matchesCategory = category === 'All' || tag.category === category
    const haystack = `${tag.tag} ${tag.description} ${tag.owner}`.toLowerCase()
    return matchesCategory && haystack.includes(query.toLowerCase())
  })
  const selectedTag = visible.find((tag) => tag.tag === selected) || null

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
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {visible.length === 0 ? (
          <EmptyState title="No tags match" description="Try another category or a shorter search." />
        ) : narrow ? (
          <div className="grid gap-2">
            {visible.map((tag) => (
              <button key={tag.tag} type="button" onClick={() => setSelected(tag.tag)} className="rounded-lg border border-[#d8e0ea] bg-white p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge tone={categoryTone[tag.category]}>{tag.tag}</StatusBadge>
                  <span className="text-sm font-bold">{tag.count}</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">{tag.category} · {tag.owner}</p>
                <p className="mt-1 text-sm">{tag.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <DataTable
            rows={visible}
            getRowKey={(tag) => tag.tag}
            minWidth="720px"
            columns={[
              { key: 'tag', header: 'Tag', render: (tag) => <button type="button" className="font-bold" onClick={() => setSelected(tag.tag)}>{tag.tag}</button> },
              { key: 'category', header: 'Category', render: (tag) => <StatusBadge tone={categoryTone[tag.category]}>{tag.category}</StatusBadge> },
              { key: 'owner', header: 'Owner', render: (tag) => tag.owner },
              { key: 'count', header: 'APIs', render: (tag) => tag.count },
              { key: 'description', header: 'Description', render: (tag) => tag.description },
            ]}
          />
        )}
        <Panel title="Tag detail">
          {!selectedTag && <p className="text-sm text-slate-600">Select a tag to see its rules and the APIs that use it.</p>}
          {selectedTag && (
            <div className="space-y-3 text-sm">
              <StatusBadge tone={categoryTone[selectedTag.category]}>{selectedTag.tag}</StatusBadge>
              <p>{selectedTag.description}</p>
              <p className="text-slate-600">Owner: {selectedTag.owner}</p>
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Rules</h3>
                {selectedTag.rules?.length ? <ul className="mt-1 list-disc pl-4">{selectedTag.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : <p className="mt-1 text-slate-600">No rules stored.</p>}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-slate-500">APIs</h3>
                {selectedTag.apis?.length ? <ul className="mt-1">{selectedTag.apis.map((name) => <li key={name}>{name}</li>)}</ul> : <p className="mt-1 text-slate-600">No APIs use this tag.</p>}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
