import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Shield,
  Users,
  KeyRound,
  UserPlus,
  Check,
  X,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Copy,
} from 'lucide-react'
import { apiClient } from '../services/apiClient'

const ROLE_STYLES = {
  Admin: { bg: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' },
  Developer: { bg: 'hsl(var(--accent) / 0.18)', color: 'hsl(172 66% 25%)' },
  Viewer: { bg: 'hsl(var(--muted) / 0.15)', color: 'hsl(var(--muted))' },
}

const STATUS_STYLES = {
  Active: {
    bg: 'hsl(var(--accent) / 0.18)',
    color: 'hsl(172 66% 25%)',
    dot: 'hsl(var(--accent))',
  },
  Invited: {
    bg: 'hsl(var(--secondary) / 0.15)',
    color: 'hsl(var(--secondary))',
    dot: 'hsl(var(--secondary))',
  },
  Suspended: {
    bg: 'hsl(var(--destructive) / 0.12)',
    color: 'hsl(var(--destructive))',
    dot: 'hsl(var(--destructive))',
  },
}

const INITIAL_USERS = [
  { id: 'u1', name: 'Divya M.', email: 'divya.m@coaction.com', role: 'Admin', team: 'Underwriting Team', status: 'Active', lastActive: '2 min ago' },
  { id: 'u2', name: 'Sara K.', email: 'sara.k@coaction.com', role: 'Developer', team: 'Underwriting Team', status: 'Active', lastActive: '18 min ago' },
  { id: 'u3', name: 'Michael C.', email: 'michael.c@coaction.com', role: 'Developer', team: 'Submissions Team', status: 'Active', lastActive: '1 hr ago' },
  { id: 'u4', name: 'Priya R.', email: 'priya.r@coaction.com', role: 'Viewer', team: 'Data Services Team', status: 'Active', lastActive: '3 hr ago' },
  { id: 'u5', name: 'James O.', email: 'james.o@coaction.com', role: 'Developer', team: 'Policy Team', status: 'Invited', lastActive: 'Pending' },
  { id: 'u6', name: 'Emily T.', email: 'emily.t@coaction.com', role: 'Admin', team: 'Claims Team', status: 'Active', lastActive: 'Yesterday' },
  { id: 'u7', name: 'Raj P.', email: 'raj.p@coaction.com', role: 'Viewer', team: 'Claims Team', status: 'Suspended', lastActive: '4 days ago' },
]

const INITIAL_REQUESTS = [
  { id: 'r1', requester: 'John D.', email: 'john.d@coaction.com', target: 'FNOL API', reason: 'Broker portal FNOL intake for Q3 rollout', requestedAt: '2 hr ago' },
  { id: 'r2', requester: 'Aditi S.', email: 'aditi.s@coaction.com', target: 'Admin role upgrade', reason: 'Managing Submissions Team onboarding', requestedAt: '5 hr ago' },
  { id: 'r3', requester: 'Marcus H.', email: 'marcus.h@partner.com', target: 'Policy Lookup API (Read)', reason: 'External partner integration POC', requestedAt: '1 day ago' },
]

const IDENTITY_PROVIDERS = [
  { id: 'azure', name: 'Azure Active Directory', description: 'Primary SSO for coaction.com', connected: true, users: 42 },
  { id: 'okta', name: 'Okta', description: 'Federated identity for partners', connected: true, users: 8 },
  { id: 'google', name: 'Google Workspace', description: 'Not currently configured', connected: false, users: 0 },
]

const API_KEYS = [
  { id: 'k1', label: 'CI/CD — Build Pipeline', prefix: 'ck_live_9f2a…', owner: 'Underwriting Team', scope: 'Read + Publish', createdAt: '2026-06-14', lastUsed: '4 min ago' },
  { id: 'k2', label: 'Submissions ETL Worker', prefix: 'ck_live_a71b…', owner: 'Submissions Team', scope: 'Read', createdAt: '2026-05-02', lastUsed: '32 min ago' },
  { id: 'k3', label: 'Partner Sandbox — Marcus H.', prefix: 'ck_test_44c9…', owner: 'External', scope: 'Read (sandbox)', createdAt: '2026-08-01', lastUsed: 'Yesterday' },
]

const AUDIT_LOG = [
  { id: 'a1', when: '2 min ago', actor: 'Divya M.', action: 'Approved access request', target: 'FNOL API — John D.' },
  { id: 'a2', when: '18 min ago', actor: 'Sara K.', action: 'Rotated API key', target: 'ck_live_a71b… (Submissions ETL Worker)' },
  { id: 'a3', when: '1 hr ago', actor: 'System', action: 'SSO login', target: 'michael.c@coaction.com via Azure AD' },
  { id: 'a4', when: '3 hr ago', actor: 'Emily T.', action: 'Changed role', target: 'Priya R. → Viewer' },
  { id: 'a5', when: 'Yesterday', actor: 'Divya M.', action: 'Suspended user', target: 'Raj P.' },
]

function Toast({ message, type }) {
  if (!message) return null
  const isError = type === 'error'
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg"
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: 50,
        backgroundColor: isError ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--accent) / 0.18)',
        color: isError ? 'hsl(var(--destructive))' : 'hsl(172 66% 25%)',
        border: `1px solid ${isError ? 'hsl(var(--destructive) / 0.35)' : 'hsl(var(--accent) / 0.45)'}`,
      }}
    >
      {isError ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}

function Badge({ children, style }) {
  return (
    <span
      className="inline-flex items-center rounded-full text-xs font-semibold"
      style={{ padding: '0.15rem 0.6rem', ...style }}
    >
      {children}
    </span>
  )
}

export default function Access() {
  const { data: apis = [] } = useQuery({
    queryKey: ['apis'],
    queryFn: () => apiClient.getApis(),
  })

  const [users, setUsers] = useState(INITIAL_USERS)
  const [requests, setRequests] = useState(INITIAL_REQUESTS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [toast, setToast] = useState({ message: '', type: 'success' })

  function notify(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 2500)
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchesRole = roleFilter === 'All' || u.role === roleFilter
      if (!matchesRole) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.team.toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter])

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === 'Admin').length
    const active = users.filter((u) => u.status === 'Active').length
    return [
      { label: 'Total Users', value: users.length, icon: Users },
      { label: 'Admins', value: admins, icon: Shield },
      { label: 'Active Sessions', value: active, icon: CheckCircle },
      { label: 'Pending Requests', value: requests.length, icon: Clock },
    ]
  }, [users, requests])

  function approveRequest(req) {
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
    notify(`Approved: ${req.requester} → ${req.target}`)
  }

  function denyRequest(req) {
    setRequests((prev) => prev.filter((r) => r.id !== req.id))
    notify(`Denied: ${req.requester} → ${req.target}`, 'error')
  }

  function changeRole(userId, nextRole) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)))
    notify(`Role updated to ${nextRole}`)
  }

  function toggleSuspend(user) {
    const nextStatus = user.status === 'Suspended' ? 'Active' : 'Suspended'
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)))
    notify(
      `${user.name} ${nextStatus === 'Suspended' ? 'suspended' : 'reactivated'}`,
      nextStatus === 'Suspended' ? 'error' : 'success',
    )
  }

  function copyKey(prefix) {
    navigator.clipboard?.writeText(prefix.replace('…', '')).catch(() => {})
    notify('Key prefix copied to clipboard')
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <Toast message={toast.message} type={toast.type} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-2">Admin Access</h1>
          <p className="text-muted">
            Manage users, roles, API keys, and identity providers for CoAction.
          </p>
        </div>
        <button
          type="button"
          onClick={() => notify('Invite dialog would open here')}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: 'hsl(var(--primary))' }}
        >
          <UserPlus className="h-4 w-4" /> Invite User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card-base p-6">
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
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h2 className="text-xl font-semibold">Users & Roles</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, team…"
                  className="input-base"
                  style={{ paddingLeft: '2.25rem', minWidth: '18rem' }}
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="input-base"
                style={{ minWidth: '9rem' }}
              >
                <option>All</option>
                <option>Admin</option>
                <option>Developer</option>
                <option>Viewer</option>
              </select>
            </div>
          </div>

          <div
            className="scrollable border border-border rounded-md"
            style={{ maxHeight: '420px', overflowY: 'auto' }}
          >
            <table className="w-full text-sm">
              <thead className="border-b border-border sticky top-0 bg-card" style={{ position: 'sticky', top: 0 }}>
                <tr>
                  <th className="pb-3 pt-3 font-bold text-left px-4">User</th>
                  <th className="pb-3 pt-3 font-bold text-left px-4">Team</th>
                  <th className="pb-3 pt-3 font-bold text-left px-4">Role</th>
                  <th className="pb-3 pt-3 font-bold text-left px-4">Status</th>
                  <th className="pb-3 pt-3 font-bold text-left px-4">Last Active</th>
                  <th className="pb-3 pt-3 font-bold text-right px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const statusStyle = STATUS_STYLES[u.status]
                  return (
                    <tr key={u.id} className="hover:bg-muted transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">{u.team}</td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="rounded-full border border-border text-xs font-semibold"
                          style={{
                            backgroundColor: ROLE_STYLES[u.role].bg,
                            color: ROLE_STYLES[u.role].color,
                            padding: '0.15rem 0.6rem',
                          }}
                        >
                          <option>Admin</option>
                          <option>Developer</option>
                          <option>Viewer</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <Badge style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '0.5rem',
                              height: '0.5rem',
                              borderRadius: '9999px',
                              backgroundColor: statusStyle.dot,
                              marginRight: '0.4rem',
                            }}
                          />
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted">{u.lastActive}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSuspend(u)}
                          className="p-0 bg-transparent text-xs font-semibold underline"
                          style={{
                            color:
                              u.status === 'Suspended'
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--destructive))',
                          }}
                        >
                          {u.status === 'Suspended' ? 'Reactivate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted">
                      No users match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-base p-6">
          <h2 className="text-xl font-semibold mb-4">Pending Access Requests</h2>
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{req.requester}</p>
                    <p className="text-xs text-muted">{req.email}</p>
                  </div>
                  <span className="text-xs text-muted">{req.requestedAt}</span>
                </div>
                <p className="text-sm mt-2">
                  Requesting <span className="font-semibold">{req.target}</span>
                </p>
                <p className="text-xs text-muted mt-1">"{req.reason}"</p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => approveRequest(req)}
                    className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-white"
                    style={{ backgroundColor: 'hsl(var(--primary))', padding: '0.4rem 0.75rem' }}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => denyRequest(req)}
                    className="inline-flex items-center gap-1 rounded-md text-xs font-semibold"
                    style={{
                      backgroundColor: 'hsl(var(--destructive) / 0.12)',
                      color: 'hsl(var(--destructive))',
                      padding: '0.4rem 0.75rem',
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Deny
                  </button>
                </div>
              </div>
            ))}
            {requests.length === 0 && (
              <div className="text-sm text-muted text-center py-6 border border-dashed border-border rounded-lg">
                No pending requests. You're all caught up.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-base p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Access Activity</h2>
          <span className="text-xs text-muted">Every action is audit-logged</span>
        </div>
        <div
          className="scrollable border border-border rounded-md"
          style={{ maxHeight: '320px', overflowY: 'auto' }}
        >
          <table className="w-full text-sm">
            <thead className="border-b border-border sticky top-0 bg-card" style={{ position: 'sticky', top: 0 }}>
              <tr>
                <th className="pb-3 pt-3 font-bold text-left px-4">When</th>
                <th className="pb-3 pt-3 font-bold text-left px-4">Actor</th>
                <th className="pb-3 pt-3 font-bold text-left px-4">Action</th>
                <th className="pb-3 pt-3 font-bold text-left px-4">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {AUDIT_LOG.map((row) => (
                <tr key={row.id} className="hover:bg-muted transition-colors">
                  <td className="py-3 px-4 text-muted">{row.when}</td>
                  <td className="py-3 px-4 font-medium">{row.actor}</td>
                  <td className="py-3 px-4">{row.action}</td>
                  <td className="py-3 px-4 text-muted">{row.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {apis.length > 0 && (
          <p className="text-xs text-muted mt-3">
            Governing access across {apis.length} catalog APIs and{' '}
            {new Set(apis.map((a) => a.owner)).size} owning teams.
          </p>
        )}
      </div>
    </div>
  )
}
