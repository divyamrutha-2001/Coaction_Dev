import { Component, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useTheme } from 'next-themes'
import {
  BarChart3,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Library,
  Loader2,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Tags,
  Upload,
  X,
} from 'lucide-react'
import { api } from './api/client.js'
import { setToken } from './lib/auth/token.js'
import logo from '../Coaction_Developer_Workbench_Transparent.png'
import Dashboard from './pages/Dashboard.jsx'
import ApiLibrary from './pages/Library.jsx'
import SandboxPage from './pages/Sandbox.jsx'
import TagsPage from './pages/Tags.jsx'
import Access from './pages/Access.jsx'
import Usage from './pages/Usage.jsx'
import UploadPage from './pages/Upload.jsx'
import Trace from './pages/Trace.jsx'
import Direction from './pages/Direction.jsx'
import SettingsPage from './pages/Settings.jsx'
import Assistant from './components/Assistant.jsx'
import { resolveIntent } from './lib/search/intent.js'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/api-library', label: 'API Library', icon: Library },
  { to: '/tags', label: 'Context Tags', icon: Tags },
  { to: '/usage', label: 'Usage & KPIs', icon: BarChart3 },
  { to: '/trace', label: 'Policy Trace', icon: GitBranch },
  { to: '/settings', label: 'Configuration', icon: Settings },
]

const PAGE_ICONS = {
  '/': LayoutDashboard,
  '/api-library': Library,
  '/sandbox': FlaskConical,
  '/tags': Tags,
  '/usage': BarChart3,
  '/trace': GitBranch,
  '/settings': Settings,
  '/upload': Upload,
  '/access': ShieldCheck,
}

function iconForSuggestion(suggestion) {
  if (suggestion.kind === 'trace') return GitBranch
  if (suggestion.kind === 'sandbox') return FlaskConical
  if (suggestion.kind === 'page') return PAGE_ICONS[suggestion.route] || LayoutDashboard
  return Library
}

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
        <div role="alert" className="rounded-lg bg-surface p-4 text-sm text-red-800 ring-1 ring-red-200">
          <p className="font-semibold">Unable to show this page.</p>
          <button type="button" className="mt-3 rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

function navClass(isActive, collapsed) {
  return `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${collapsed ? 'lg:gap-0 lg:justify-center lg:px-0' : ''} ${isActive ? 'bg-graphite text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'}`
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('nav-collapsed') === '1' } catch { return false }
  })
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [answer, setAnswer] = useState(null)
  const [answerLoading, setAnswerLoading] = useState(false)
  const searchRef = useRef(null)
  const { resolvedTheme, setTheme } = useTheme()
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })

  // Capture a session token handed back on the post-login redirect, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return
    setToken(token, params.get('id_token'))
    params.delete('token')
    params.delete('id_token')
    const clean = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash
    window.history.replaceState({}, '', clean)
  }, [])

  useEffect(() => { setMenuOpen(false); setSearchOpen(false) }, [location.pathname])

  useEffect(() => {
    try { localStorage.setItem('nav-collapsed', collapsed ? '1' : '0') } catch { /* storage unavailable */ }
  }, [collapsed])

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { suggestions, exact } = useMemo(
    () => resolveIntent(search, { apis: catalog.data || [] }),
    [search, catalog.data],
  )

  // Question-like queries get an inline grounded answer from the assistant engine.
  useEffect(() => {
    const q = search.trim()
    const questionLike = /\?$/.test(q) || (/\s/.test(q) && q.length >= 6) || /^(what|how|why|which|who|does|can|list|show|explain)\b/i.test(q)
    const hasId = /\b(PK\d{4,}|(?:POL|SUB|QTE|CLM|ACC)-[A-Z0-9-]+)\b/i.test(q)
    if (!searchOpen || !questionLike || hasId) { setAnswer(null); setAnswerLoading(false); return }
    setAnswerLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.ask(q, { page: location.pathname })
        setAnswer({ question: q, ...res })
      } catch {
        setAnswer(null)
      } finally {
        setAnswerLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [search, searchOpen, location.pathname])

  // Exact, unambiguous hits jump on their own; everything else waits for Enter.
  useEffect(() => {
    if (!exact || !searchOpen) return
    if (exact.route === `${location.pathname}${location.search}`) return
    const timer = setTimeout(() => {
      setSearch('')
      setSearchOpen(false)
      setActiveIndex(0)
      navigate(exact.route)
    }, 600)
    return () => clearTimeout(timer)
  }, [exact, searchOpen, location.pathname, location.search, navigate])

  function pickSuggestion(suggestion) {
    if (!suggestion) return
    setSearch('')
    setSearchOpen(false)
    setActiveIndex(0)
    navigate(suggestion.route)
  }

  function submitSearch(event) {
    event.preventDefault()
    const choice = suggestions[activeIndex] || suggestions[0]
    if (choice) {
      pickSuggestion(choice)
      return
    }
    const term = search.trim()
    setSearchOpen(false)
    navigate(term ? `/api-library?q=${encodeURIComponent(term)}` : '/api-library')
  }

  function onSearchKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSearchOpen(true)
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Escape') {
      setSearchOpen(false)
      setActiveIndex(0)
    }
  }

  return (
    <div className="workbench-shell min-h-screen text-ink">
      <Toaster position="top-right" closeButton theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-xl dark:bg-surface-muted/90">
        <div className="flex h-[4.75rem] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted lg:hidden"
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
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                id="global-search"
                ref={searchRef}
                value={search}
                onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); setActiveIndex(0) }}
                onFocus={() => { if (search.trim()) setSearchOpen(true) }}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search APIs, ask a question, or jump to any page…"
                role="combobox"
                aria-expanded={searchOpen && (suggestions.length > 0 || Boolean(answer))}
                aria-controls="global-search-results"
                aria-autocomplete="list"
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-line bg-surface-muted pl-11 pr-4 text-sm text-ink placeholder:text-ink-muted outline-none transition focus:border-cyan-500 focus:bg-surface focus:ring-4 focus:ring-cyan-500/10"
              />
              {searchOpen && (suggestions.length > 0 || answerLoading || (answer && !/^Nothing in the catalog/i.test(answer.answer))) && (
                <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
                  {suggestions.map((suggestion, index) => {
                    const Icon = iconForSuggestion(suggestion)
                    return (
                      <button
                        key={`${suggestion.kind}:${suggestion.route}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => pickSuggestion(suggestion)}
                        className={`flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left transition ${index === activeIndex ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{suggestion.label}</span>
                          {suggestion.sublabel && <span className="block truncate font-mono text-[11px] text-ink-muted">{suggestion.sublabel}</span>}
                        </span>
                        <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{suggestion.badge}</span>
                        {index === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />}
                      </button>
                    )
                  })}
                  {answerLoading && (
                    <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 text-sm text-ink-muted">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Thinking…
                    </div>
                  )}
                  {!answerLoading && answer && !/^Nothing in the catalog/i.test(answer.answer) && (
                    <div className="border-b border-line bg-surface-muted/60 px-3 py-3">
                      <div className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-pre-line text-sm leading-6 text-ink line-clamp-4">{answer.answer}</p>
                          {answer.sources?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {answer.sources.slice(0, 4).map((source) => (
                                <button key={source.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSearchOpen(false); navigate(`/api-library?q=${encodeURIComponent(source.name)}`) }} className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted transition hover:text-ink">{source.name}</button>
                              ))}
                            </div>
                          )}
                          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSearchOpen(false); window.dispatchEvent(new CustomEvent('open-assistant', { detail: { question: answer.question } })) }} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700 transition hover:text-cyan-900">
                            <Bot className="h-3 w-3" aria-hidden="true" /> Continue in assistant
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-surface-muted"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
          <NavLink to="/upload" aria-label="Upload API" title="Upload API" className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-graphite text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px] hover:opacity-90">
            <Upload className="h-4 w-4" aria-hidden="true" />
          </NavLink>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy text-sm font-black text-white shadow-[0_10px_22px_rgba(26,58,82,0.18)]" aria-label="Admin" title="Admin">
            A
          </div>
        </div>
      </header>
      <div className="flex w-full">
        <aside id="app-nav" className={`${menuOpen ? 'fixed inset-x-0 top-[7.85rem] z-20 max-h-[calc(100vh-7.85rem)] overflow-y-auto bg-surface p-3 shadow-2xl md:top-[4.75rem] md:max-h-[calc(100vh-4.75rem)] lg:static lg:max-h-none lg:shadow-none' : 'hidden'} w-full shrink-0 lg:sticky lg:top-[4.75rem] lg:block lg:h-[calc(100vh-4.75rem-1px)] lg:overflow-y-auto lg:border-r lg:border-line lg:bg-surface/70 lg:transition-[width] lg:duration-200 ${collapsed ? 'lg:w-[4.75rem] lg:px-2 lg:py-4' : 'lg:w-64 lg:p-4'}`}>
          <div className={`mb-2 hidden lg:flex ${collapsed ? 'lg:justify-center' : 'lg:justify-end'}`}>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden="true" /> : <ChevronsLeft className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <nav aria-label="Primary" className="flex flex-col gap-1">
            {links.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.end} title={item.label} className={({ isActive }) => navClass(isActive, collapsed)}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-0 py-3 text-ink sm:px-3 lg:px-4">
          <PageBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/api-library" element={<ApiLibrary />} />
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/access" element={<Access />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/trace" element={<Trace />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Hidden demo route. Intentionally omitted from the primary navigation. */}
            <Route path="/direction2" element={<Direction />} />
          </Routes>
          </PageBoundary>
        </main>
      </div>
      <Assistant />
    </div>
  )
}
