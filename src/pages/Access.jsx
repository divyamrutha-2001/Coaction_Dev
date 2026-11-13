import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Minus, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client.js'
import { DataTable, ErrorState, LoadingState, MetricCard, PageHeader, SegmentedControl, StatusBadge, statusToneFor, useNarrow } from '../components/ui.jsx'

const tabs = [
  { value: 'Users', label: 'Users' },
  { value: 'Requests', label: 'Requests' },
  { value: 'Roles', label: 'Roles' },
  { value: 'Audit', label: 'Audit' },
]

export default function Access() {
  const queryClient = useQueryClient()
  const access = useQuery({ queryKey: ['access'], queryFn: api.access })
  const [tab, setTab] = useState('Users')
  const [selectedId, setSelectedId] = useState(null)
  const narrow = useNarrow()
  const statusChange = useMutation({
    mutationFn: ({ id, status }) => api.setUserStatus(id, status),
    onSuccess: () => {
      toast.success('User status updated')
      queryClient.invalidateQueries({ queryKey: ['access'] })
    },
    onError: () => toast.error('Unable to update user status'),
  })
  const decision = useMutation({
    mutationFn: ({ id, decision: value }) => api.decideRequest(id, value),
    onSuccess: (_data, variables) => {
      toast.success(variables.decision === 'Approved' ? 'Request approved' : 'Request denied')
      queryClient.invalidateQueries({ queryKey: ['access'] })
    },
    onError: () => toast.error('Unable to update the request'),
  })

  const selected = access.data?.users.find((user) => user.id === selectedId) || null
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (access.isLoading) return <LoadingState label="Loading user access" />
  if (access.isError) return <ErrorState title="Unable to load user access" onRetry={() => access.refetch()} />

  const data = access.data
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader eyebrow="Access governance" title="User Access" description="Review users, pending requests, role permissions, and recent audit events." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active users" value={data.summary.activeUsers} hint="Status is Active" />
        <MetricCard label="Pending requests" value={data.summary.pendingRequests} hint="Waiting for a decision" tone={data.summary.pendingRequests ? 'warning' : 'neutral'} />
        <MetricCard label="Privileged users" value={data.summary.privilegedUsers} hint="Admin and API Owner" />
        <MetricCard label="Expiring access" value={data.summary.expiringAccess} hint="Users with an end date" tone={data.summary.expiringAccess ? 'danger' : 'neutral'} />
      </div>
      <SegmentedControl label="Section" value={tab} onChange={setTab} options={tabs} />
      {tab === 'Users' && (
        narrow ? (
          <div className="grid gap-2">
            {data.users.map((user) => (
              <article key={user.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{user.name}</h2>
                    <p className="text-xs text-ink-muted">{user.email}</p>
                  </div>
                  <StatusBadge>{user.status}</StatusBadge>
                </div>
                <p className="mt-2 text-sm">{user.team} · {user.role}</p>
                <button type="button" onClick={() => setSelectedId(user.id)} className="mt-3 rounded-md border px-3 py-1.5 text-sm font-semibold">Manage</button>
              </article>
            ))}
          </div>
        ) : (
          <DataTable
            rows={data.users}
            getRowKey={(user) => user.id}
            columns={[
              { key: 'name', header: 'Name', render: (user) => <div><div className="font-semibold">{user.name}</div><div className="text-xs text-ink-muted">{user.email}</div></div> },
              { key: 'team', header: 'Team', render: (user) => user.team },
              { key: 'role', header: 'Role', render: (user) => user.role },
              { key: 'status', header: 'Status', render: (user) => <StatusBadge>{user.status}</StatusBadge> },
              { key: 'action', header: 'Action', render: (user) => <button type="button" onClick={() => setSelectedId(user.id)} className="rounded-md border px-3 py-1 text-sm font-semibold">Manage</button> },
            ]}
          />
        )
      )}
      {tab === 'Requests' && (
        <div className="grid gap-3">
          {data.requests.map((request) => {
            const pending = decision.isPending && decision.variables?.id === request.id
            return (
              <article key={request.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-bold">{request.requester} · {request.api}</div>
                    <div className="text-ink-muted">{request.reason}</div>
                    <div className="mt-1 text-xs text-ink-muted">{request.team} · {request.accessType} · {request.requestedAt}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={request.risk === 'High' ? 'danger' : request.risk === 'Medium' ? 'warning' : 'neutral'}>{request.risk} risk</StatusBadge>
                    <StatusBadge>{request.status}</StatusBadge>
                    {request.status === 'Pending' && (
                      <>
                        <button type="button" disabled={pending} onClick={() => decision.mutate({ id: request.id, decision: 'Approved' })} className="rounded-md bg-navy px-3 py-1.5 text-white disabled:opacity-60">{pending ? 'Saving…' : 'Approve'}</button>
                        <button type="button" disabled={pending} onClick={() => decision.mutate({ id: request.id, decision: 'Denied' })} className="rounded-md border px-3 py-1.5 disabled:opacity-60">Deny</button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {tab === 'Roles' && (
        <DataTable
          minWidth="720px"
          rows={data.roles}
          getRowKey={(role) => role.role}
          columns={[
            { key: 'role', header: 'Role', render: (role) => <span className="font-semibold">{role.role}</span> },
            { key: 'docs', header: 'Docs', render: (role) => <Permission value={role.docs} /> },
            { key: 'tryIt', header: 'Try It', render: (role) => <Permission value={role.tryIt} /> },
            { key: 'publish', header: 'Publish', render: (role) => <Permission value={role.publish} /> },
            { key: 'approve', header: 'Approve', render: (role) => <Permission value={role.approve} /> },
            { key: 'admin', header: 'Admin', render: (role) => <Permission value={role.admin} /> },
          ]}
        />
      )}
      {tab === 'Audit' && (
        <DataTable
          rows={data.audit}
          getRowKey={(event) => event.id}
          columns={[
            { key: 'when', header: 'When', render: (event) => event.when },
            { key: 'actor', header: 'Actor', render: (event) => event.actor },
            { key: 'action', header: 'Action', render: (event) => event.action },
            { key: 'target', header: 'Target', render: (event) => event.target },
            { key: 'result', header: 'Result', render: (event) => <StatusBadge tone={statusToneFor(event.result)}>{event.result}</StatusBadge> },
          ]}
        />
      )}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close user panel" onClick={() => setSelectedId(null)} />
          <aside role="dialog" aria-modal="true" aria-labelledby="manage-user-title" className="relative h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="manage-user-title" className="text-2xl font-bold">{selected.name}</h2>
                <p className="text-sm text-ink-muted">{selected.access}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-md border px-3 py-1 text-sm font-semibold">Close</button>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <div><dt className="text-xs uppercase text-ink-muted">Status</dt><dd><StatusBadge>{selected.status}</StatusBadge></dd></div>
              <div><dt className="text-xs uppercase text-ink-muted">Role</dt><dd>{selected.role} · {selected.team}</dd></div>
              <div><dt className="text-xs uppercase text-ink-muted">Expires</dt><dd>{selected.expires}</dd></div>
              <div><dt className="text-xs uppercase text-ink-muted">APIs</dt><dd>{selected.apis?.length ? selected.apis.join(', ') : 'None assigned'}</dd></div>
            </dl>
            <button
              type="button"
              disabled={statusChange.isPending}
              onClick={() => statusChange.mutate({ id: selected.id, status: selected.status === 'Suspended' ? 'Active' : 'Suspended' })}
              className="mt-5 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {statusChange.isPending ? 'Saving…' : selected.status === 'Suspended' ? 'Reactivate' : 'Suspend'}
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}

function Permission({ value }) {
  const text = String(value)
  const normalized = text.toLowerCase()
  if (normalized === 'yes') return <span className="inline-flex items-center gap-1 text-teal-900"><Check className="h-4 w-4" aria-hidden="true" /> Yes</span>
  if (normalized === 'no') return <span className="inline-flex items-center gap-1 text-red-900"><X className="h-4 w-4" aria-hidden="true" /> No</span>
  return <span className="inline-flex items-center gap-1 text-amber-950"><Minus className="h-4 w-4" aria-hidden="true" /> {text}</span>
}
