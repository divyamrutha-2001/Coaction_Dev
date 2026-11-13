import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Inbox, LoaderCircle, Search } from 'lucide-react'
import { toast } from 'sonner'

export function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
}

export function PageHeader({ eyebrow, title, description, actions, meta }) {
  return (
    <header className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 inline-flex rounded-md bg-graphite px-2.5 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">{eyebrow}</p>}
        <h1 className="text-3xl font-black text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{description}</p>}
        {meta && <div className="mt-2 text-xs font-bold text-ink-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

const tones = {
  success: 'bg-teal-50 text-teal-900 ring-teal-700/30 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-500/25',
  warning: 'bg-amber-50 text-amber-950 ring-amber-700/30 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25',
  danger: 'bg-red-50 text-red-900 ring-red-700/30 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/25',
  neutral: 'bg-surface-muted text-ink ring-line',
  info: 'bg-sky-50 text-sky-950 ring-sky-800/25 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/25',
}

const statusTone = {
  Published: 'success',
  Active: 'success',
  Approved: 'success',
  Success: 'success',
  Updated: 'info',
  Draft: 'warning',
  Pending: 'warning',
  Deprecated: 'danger',
  Suspended: 'danger',
  Denied: 'danger',
  Error: 'danger',
}

export function statusToneFor(value) {
  return statusTone[value] || 'neutral'
}

export function StatusBadge({ children, tone }) {
  const resolved = tone || statusToneFor(children)
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[resolved] || tones.neutral}`}>
      <span aria-hidden="true" className="text-[10px]">{resolved === 'danger' ? '!' : resolved === 'warning' ? '–' : '●'}</span>
      {children}
    </span>
  )
}

export function MetricCard({ label, value, hint, icon: Icon, tone = 'neutral' }) {
  const tileTone = tone === 'danger' ? 'amber' : tone === 'warning' ? 'amber' : tone === 'neutral' ? 'cyan' : tone
  return (
    <article className={`kpi-tile kpi-${tileTone}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">{label}</p>
        {Icon && (
          <span className="rounded-lg p-2.5">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-black text-ink">{value}</p>
      {hint && <p className="mt-3 text-sm font-medium text-ink-muted">{hint}</p>}
    </article>
  )
}

export function Panel({ title, description, children, className = '', actions }) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-surface p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-xl font-black text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-4 grid gap-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
        <div className="h-24 animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  )
}

export function ErrorState({ title = 'Unable to load this page', description = 'The workbench could not load this data. Try again.', onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-surface p-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-red-700" aria-hidden="true" />
        <div>
          <h2 className="font-bold text-red-900">{title}</h2>
          <p className="mt-1 text-sm text-red-800">{description}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-muted px-4 py-8 text-center">
      <Inbox className="mx-auto h-5 w-5 text-ink-muted" aria-hidden="true" />
      <h3 className="mt-2 font-semibold text-ink">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function SearchField({ id, label, value, onChange, placeholder }) {
  const generated = useId()
  const fieldId = id || generated
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={fieldId} className="mb-1 block text-xs font-semibold text-ink-muted">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <input
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-line bg-surface-muted pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted outline-none transition focus:border-cyan-500 focus:bg-surface focus:ring-4 focus:ring-cyan-500/10"
        />
      </div>
    </div>
  )
}

export function SegmentedControl({ label, value, onChange, options, name }) {
  const labelId = useId()
  return (
    <div>
      <div id={labelId} className="mb-1 text-xs font-semibold text-ink-muted">{label}</div>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              name={name}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${selected ? 'bg-navy text-white shadow-sm' : 'text-ink hover:bg-surface-muted'}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DataTable({ columns, rows, getRowKey, empty, minWidth = '640px' }) {
  if (!rows?.length) return empty || null
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="bg-surface-muted text-xs uppercase tracking-[0.12em] text-ink-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`sticky top-0 bg-surface-muted px-4 py-3 font-black ${column.headerClassName || ''}`}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-t border-line transition hover:bg-surface-muted">
              {columns.map((column, index) => (
                <td key={column.key} className={`px-4 py-3 align-top ${index === 0 ? 'sticky left-0 bg-surface' : ''} ${column.className || ''}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CodeBlock({ title, value, empty = 'Nothing to show.' }) {
  const text = value == null || value === '' ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          disabled={!text}
          onClick={() => copyText(text, title)}
          className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-semibold disabled:opacity-50"
        >
          Copy
        </button>
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg bg-graphite p-3 text-xs text-slate-100">{text || empty}</pre>
    </div>
  )
}

export async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(String(text))
    toast.success(`${label} copied`)
  } catch {
    toast.error('Unable to copy')
  }
}

export function formatWhen(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '')
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortDate(value) {
  const text = String(value || '')
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[2]}/${match[3]}`
  return text.slice(5, 10)
}
