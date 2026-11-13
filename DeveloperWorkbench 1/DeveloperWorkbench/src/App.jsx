import { Component, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import {
  BarChart3,
  Command,
  Download,
  GitBranch,
  LayoutDashboard,
  Library,
  Menu,
  Search,
  Settings,
  Tags,
  Upload,
  X,
} from 'lucide-react'
import { api } from './api/client.js'
import logo from '../Coaction_Developer_Workbench_Transparent.png'
import Dashboard from './pages/Dashboard.jsx'
import ApiLibrary from './pages/Library.jsx'
import TagsPage from './pages/Tags.jsx'
import Access from './pages/Access.jsx'
import Usage from './pages/Usage.jsx'
import UploadPage from './pages/Upload.jsx'
import Downloads from './pages/Downloads.jsx'
import Trace from './pages/Trace.jsx'
import Direction from './pages/Direction.jsx'
import SettingsPage from './pages/Settings.jsx'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/api-library', label: 'API Library', icon: Library },
  { to: '/tags', label: 'Context Tags', icon: Tags },
  { to: '/usage', label: 'Usage & KPIs', icon: BarChart3 },
  { to: '/download', label: 'Downloads', icon: Download },
  { to: '/trace', label: 'Policy Trace', icon: GitBranch },
  { to: '/settings', label: 'Settings', icon: Settings },
]

class PageBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-lg bg-white p-4 text-sm text-red-800 ring-1 ring-red-200">
          <p className="font-semibold">Unable to show this page.</p>
          <button type="button" className="mt-3 rounded-md bg-[#1a3a52] px-3 py-2 text-sm font-semibold text-white" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

function navClass(isActive) {
  return `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-[#101827] text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const access = useQuery({ queryKey: ['access'], queryFn: api.access })
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const draftCount = (catalog.data || []).filter((item) => item.lifecycle === 'Draft' || item.lifecycle === 'Deprecated').length
  const pendingCount = access.data?.summary?.pendingRequests || 0
  const attentionCount = draftCount + pendingCount

  function submitSearch(event) {
    event.preventDefault()
    const term = search.trim()
    navigate(term ? `/api-library?q=${encodeURIComponent(term)}` : '/api-library')
  }

  return (
    <div className="workbench-shell min-h-screen text-slate-950">
      <Toaster position="top-right" closeButton />
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex h-[4.75rem] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            <span className="sr-only">{menuOpen ? 'Close navigation' : 'Open navigation'}</span>
          </button>
          <NavLink to="/" className="flex shrink-0 items-center lg:hidden" aria-label="CoAction Developer Workbench home">
            <img src={logo} alt="CoAction Developer Workbench" className="h-14 w-auto contrast-125 saturate-125" />
          </NavLink>
          <NavLink to="/" className="absolute left-0 top-0 hidden h-full w-64 items-center justify-center lg:flex" aria-label="CoAction Developer Workbench home">
            <img src={logo} alt="CoAction Developer Workbench" className="h-16 w-auto contrast-125 saturate-125" />
          </NavLink>
          <div className="hidden w-64 shrink-0 lg:block" aria-hidden="true" />
          <form role="search" onSubmit={submitSearch} className="mx-auto hidden min-w-0 max-w-2xl flex-1 sm:block">
            <label htmlFor="global-search" className="sr-only">Search APIs</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="global-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search APIs, owners, traces"
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-24 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 lg:inline-flex">
                <Command className="h-3 w-3" aria-hidden="true" /> K
              </span>
            </div>
          </form>
          <NavLink to="/upload" aria-label="Upload API" title="Upload API" className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#101827] text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px] hover:bg-slate-800">
            <Upload className="h-4 w-4" aria-hidden="true" />
          </NavLink>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1a3a52] text-sm font-black text-white shadow-[0_10px_22px_rgba(26,58,82,0.18)]" aria-label="Admin" title="Admin">
            A
          </div>
        </div>
      </header>
      <div className="flex w-full">
        <aside id="app-nav" className={`${menuOpen ? 'fixed inset-x-0 top-[7.85rem] z-20 max-h-[calc(100vh-7.85rem)] overflow-y-auto bg-white p-3 shadow-2xl md:top-[4.75rem] md:max-h-[calc(100vh-4.75rem)] lg:static lg:max-h-none lg:shadow-none' : 'hidden'} w-full shrink-0 lg:sticky lg:top-[4.75rem] lg:block lg:h-[calc(100vh-4.75rem)] lg:w-64 lg:overflow-y-auto lg:border-r lg:border-slate-200/80 lg:bg-white/70 lg:p-4`}>
          <nav aria-label="Primary" className="flex flex-col gap-1">
            {links.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.end} title={item.label} className={({ isActive }) => navClass(isActive)}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-800">Workbench Pulse</p>
            <p className="mt-2 text-sm text-slate-700">{attentionCount ? `${attentionCount} items need review before this catalog is consumer-ready.` : 'Catalog is clear from the current visible checks.'}</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-0 py-3 text-[#122033] sm:px-3 lg:px-4">
          <PageBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/api-library" element={<ApiLibrary />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/access" element={<Access />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/download" element={<Downloads />} />
            <Route path="/trace" element={<Trace />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Hidden demo route. Intentionally omitted from the primary navigation. */}
            <Route path="/direction2" element={<Direction />} />
          </Routes>
          </PageBoundary>
        </main>
      </div>
    </div>
  )
}
