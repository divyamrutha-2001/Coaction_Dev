import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, GitBranch, KeyRound, Pencil, Plus, RefreshCw, Save, ServerCog, ShieldCheck, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client.js'
import { PageHeader, StatusBadge } from '../components/ui.jsx'

const emptySource = {
  id: '',
  name: '',
  provider: 'Azure Repos',
  organizationUrl: '',
  project: '',
  repository: '',
  branch: 'main',
  catalogPath: '/catalog/apis',
  authMode: 'Personal access token',
  syncMode: 'Manual',
  status: 'Needs setup',
  lastSync: '',
}

export default function Settings() {
  const queryClient = useQueryClient()
  const sourcesQuery = useQuery({ queryKey: ['catalogSources'], queryFn: api.catalogSources })
  const sources = useMemo(() => sourcesQuery.data || [], [sourcesQuery.data])
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(emptySource)
  const access = useQuery({ queryKey: ['access'], queryFn: api.access })
  const refreshSources = () => queryClient.invalidateQueries({ queryKey: ['catalogSources'] })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }) => (id ? api.updateCatalogSource(id, payload) : api.createCatalogSource(payload)),
    onSuccess: (result, { id }) => {
      refreshSources()
      resetForm()
      if (result?.ok) toast.success(`${id ? 'Catalog source updated' : 'Catalog source added'} · ${result.files.length} API ${result.files.length === 1 ? 'spec' : 'specs'} found`)
      else toast.error(`Saved, but connection failed: ${result?.message || 'Unknown error'}`)
    },
    onError: (error) => toast.error(error.message),
  })

  const configuredCount = useMemo(() => sources.filter(isConfigured).length, [sources])
  const editing = Boolean(editingId)
  const formConfigured = isConfigured(form)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setEditingId('')
    setForm(emptySource)
  }

  function saveSource(event) {
    event.preventDefault()
    saveMutation.mutate({ id: editingId, payload: { ...form, name: form.name || form.repository || 'Catalog source' } })
  }

  function editSource(source) {
    setEditingId(source.id)
    setForm(source)
  }

  async function removeSource(id) {
    try {
      await api.deleteCatalogSource(id)
      refreshSources()
      if (editingId === id) resetForm()
      toast.success('Catalog source removed')
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function syncAll() {
    if (configuredCount === 0) {
      toast.error('Add a configured source before syncing')
      return
    }
    try {
      const results = await api.syncCatalogSources()
      refreshSources()
      const failed = results.filter((item) => !item.ok)
      if (failed.length) toast.error(`${failed.length} of ${results.length} sources failed: ${failed[0].message}`)
      else toast.success(`Synced ${results.length} ${results.length === 1 ? 'source' : 'sources'}`)
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="control-tower flex min-w-0 flex-col gap-5">
      <PageHeader
        title="Configuration"
        description="Configure catalog source sync and workbench preferences."
        actions={(
          <button type="button" onClick={syncAll} className="inline-flex items-center gap-2 rounded-lg bg-[#101827] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sync all sources
          </button>
        )}
      />

      <section className="grid gap-3 md:grid-cols-2">
        <Link to="/access" className="group rounded-lg border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-navy" aria-hidden="true" />
                <h2 className="text-xl font-black text-ink">User access</h2>
              </div>
              <p className="mt-1 text-sm text-ink-muted">Manage users, approval requests, roles, and audit events.</p>
            </div>
            <StatusBadge tone={access.data?.summary?.pendingRequests ? 'warning' : 'success'}>
              {access.data?.summary?.pendingRequests || 0} pending
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Active users" value={access.data?.summary?.activeUsers ?? '-'} />
            <MiniStat label="Privileged" value={access.data?.summary?.privilegedUsers ?? '-'} />
            <MiniStat label="Expiring" value={access.data?.summary?.expiringAccess ?? '-'} />
          </div>
        </Link>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-navy" aria-hidden="true" />
            <h2 className="text-xl font-black text-ink">Workbench controls</h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Catalog sources and sync behavior are configured below.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Catalog sources" value={sources.length} />
            <MiniStat label="Ready to sync" value={configuredCount} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ServerCog className="h-5 w-5 text-navy" aria-hidden="true" />
                <h2 className="text-xl font-black text-ink">Catalog sources</h2>
              </div>
              <p className="mt-1 text-sm text-ink-muted">Connect multiple Azure Repos that contain API catalog files.</p>
            </div>
            <StatusBadge tone={configuredCount ? 'success' : 'warning'}>{configuredCount} configured</StatusBadge>
          </div>

          {sources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-surface-muted p-6 text-sm text-ink-muted">
              No catalog sources yet. Add one repo source to begin syncing API catalog files.
            </div>
          ) : (
            <div className="grid gap-3">
              {sources.map((source) => (
                <article key={source.id} className="rounded-lg border border-line bg-surface-muted p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-ink">{source.name}</h3>
                        <StatusBadge tone={source.status === 'Connected' ? 'success' : source.status === 'Error' ? 'danger' : 'warning'}>
                          <span title={source.lastError || (source.lastSync ? `Last sync ${new Date(source.lastSync).toLocaleString()} · ${source.specCount} specs` : '')}>{source.status || 'Needs setup'}</span>
                        </StatusBadge>
                      </div>
                      <p className="mt-1 break-anywhere text-sm text-ink-muted">{source.organizationUrl || 'No organization URL'} · {source.project || 'No project'}</p>
                      <p className="mt-1 break-anywhere font-mono text-xs text-ink-muted">{source.repository || 'No repo'} / {source.branch || 'main'} / {source.catalogPath || 'No path'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => editSource(source)} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-surface-muted">
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button type="button" onClick={() => removeSource(source.id)} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-surface px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={saveSource} className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-navy" aria-hidden="true" />
                <h2 className="text-lg font-black text-ink">{editing ? 'Edit source' : 'Add source'}</h2>
              </div>
              <p className="mt-1 text-sm text-ink-muted">Each source maps one repo, branch, and catalog path.</p>
            </div>
            <StatusBadge tone={formConfigured ? 'success' : 'warning'}>{formConfigured ? 'Ready' : 'Draft'}</StatusBadge>
          </div>

          <div className="grid gap-4">
            <Field label="Source name" value={form.name} onChange={(value) => update('name', value)} placeholder="Claims API catalog" />
            <Field label="Provider" value={form.provider} onChange={(value) => update('provider', value)} disabled />
            <Field label="Organization URL" value={form.organizationUrl} onChange={(value) => update('organizationUrl', value)} placeholder="https://dev.azure.com/coaction" />
            <Field label="Project" value={form.project} onChange={(value) => update('project', value)} placeholder="Developer Workbench" />
            <Field label="Repository" value={form.repository} onChange={(value) => update('repository', value)} placeholder="claims-api-catalog" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Branch" value={form.branch} onChange={(value) => update('branch', value)} placeholder="main" />
              <Field label="API catalog path" value={form.catalogPath} onChange={(value) => update('catalogPath', value)} placeholder="/catalog/apis" />
            </div>
            <label className="block text-sm font-semibold text-ink">Auth mode
              <select value={form.authMode} onChange={(event) => update('authMode', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 font-normal">
                <option>Personal access token</option>
                <option>Managed identity</option>
                <option>OAuth app</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-ink">Sync mode
              <select value={form.syncMode} onChange={(event) => update('syncMode', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 font-normal">
                <option>Manual</option>
                <option>On schedule</option>
                <option>On repository change</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" disabled={saveMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#101827] px-4 py-2 text-sm font-bold text-white">
              {editing ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              {editing ? 'Update source' : 'Add source'}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-bold text-ink">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-navy" aria-hidden="true" />
          <h2 className="text-xl font-black text-ink">Backend requirements</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <PreviewItem icon={CheckCircle2} label="Source model" value="Many repos per workbench" />
          <PreviewItem icon={GitBranch} label="API identity" value="sourceId + apiId + version" />
          <PreviewItem icon={RefreshCw} label="Sync actions" value="Sync one source or all sources" />
        </div>
      </section>
    </div>
  )
}

function isConfigured(source) {
  return Boolean(source.organizationUrl && source.project && source.repository && source.branch && (source.catalogPath || source.folderPath))
}

function Field({ label, value, onChange, placeholder, disabled }) {
  return (
    <label className="block text-sm font-semibold text-ink">{label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 font-normal disabled:bg-surface-muted disabled:text-ink-muted"
      />
    </label>
  )
}

function PreviewItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 break-anywhere text-sm font-bold text-ink">{value}</p>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3 ring-1 ring-slate-200">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      <div className="mt-1 text-lg font-black text-ink">{value}</div>
    </div>
  )
}
