import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Bot, CornerDownLeft, Loader2, X } from 'lucide-react'
import { api } from '../api/client.js'
import { copyText } from './ui.jsx'

const GREETING = {
  role: 'assistant',
  answer: 'Ask about any API in the catalog — what it does, what it needs, or why a call failed. Every answer comes from the published specs.',
}

export default function Assistant() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([GREETING])
  const [pending, setPending] = useState(false)
  const [starters, setStarters] = useState([])
  const [pendingAsk, setPendingAsk] = useState(null)
  const location = useLocation()
  const [params] = useSearchParams()
  const inputRef = useRef(null)
  const endRef = useRef(null)

  // The open API becomes context, so "what does it need?" resolves without naming it.
  const context = useMemo(() => ({
    page: location.pathname,
    specId: params.get('api') || undefined,
  }), [location.pathname, params])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    if (!starters.length) api.assistantStarters().then((data) => setStarters(data.starters || [])).catch(() => {})
  }, [open, starters.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pending])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Any surface can open the assistant, optionally with a question to auto-send.
  useEffect(() => {
    function openIt(event) {
      setOpen(true)
      if (event.detail?.question) setPendingAsk(event.detail.question)
    }
    window.addEventListener('open-assistant', openIt)
    return () => window.removeEventListener('open-assistant', openIt)
  }, [])

  useEffect(() => {
    if (open && pendingAsk) {
      send(pendingAsk)
      setPendingAsk(null)
    }
  }, [open, pendingAsk])

  async function send(text) {
    const asked = (text ?? question).trim()
    if (!asked || pending) return
    setMessages((prev) => [...prev, { role: 'user', answer: asked }])
    setQuestion('')
    setPending(true)
    try {
      const reply = await api.ask(asked, context)
      setMessages((prev) => [...prev, { role: 'assistant', ...reply }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', answer: 'I could not reach the catalog just then. Try again in a moment.' }])
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the API assistant"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-lg transition hover:scale-105 hover:opacity-95"
      >
        <Bot className="h-6 w-6" aria-hidden="true" />
      </button>
    )
  }

  return (
    <aside
      role="dialog"
      aria-label="API assistant"
      className="fixed bottom-5 right-5 z-40 flex h-[min(34rem,calc(100vh-3rem))] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-muted px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-ink" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-ink">API Assistant</h2>
            <p className="text-[11px] text-ink-muted">Grounded in your published specs</p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close the assistant" className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface hover:text-ink">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((message, index) => (
          <Message key={index} message={message} onAsk={send} />
        ))}
        {pending && (
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking the specs…
          </p>
        )}
        {messages.length === 1 && starters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {starters.map((item) => (
              <button key={item} type="button" onClick={() => send(item)} className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-surface">
                {item}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => { event.preventDefault(); send() }}
        className="flex items-center gap-2 border-t border-line bg-surface-muted px-3 py-2.5"
      >
        <label htmlFor="assistant-input" className="sr-only">Ask about an API</label>
        <input
          id="assistant-input"
          ref={inputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about an API…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          aria-label="Send question"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </aside>
  )
}

function Message({ message, onAsk }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] break-anywhere rounded-lg rounded-br-sm bg-navy px-3 py-2 text-sm text-white">{message.answer}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap break-anywhere rounded-lg rounded-bl-sm bg-surface-muted px-3 py-2 text-sm text-ink">{message.answer}</p>

      {message.code && (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="flex items-center justify-between gap-2 bg-surface-muted px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{message.code.label}</span>
            <button type="button" onClick={() => copyText(message.code.body, message.code.label)} className="text-[11px] font-semibold text-ink-muted transition hover:text-ink">Copy</button>
          </div>
          <pre className="max-h-44 overflow-auto bg-graphite px-3 py-2 text-[11px] leading-relaxed text-white"><code>{message.code.body}</code></pre>
        </div>
      )}

      {message.sources?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">From</span>
          {message.sources.map((source) => (
            <a key={source.id} href={`/sandbox?api=${encodeURIComponent(source.id)}`} className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink transition hover:bg-surface-muted">
              {source.name}
            </a>
          ))}
        </div>
      )}

      {message.followUps?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.followUps.map((item) => (
            <button key={item} type="button" onClick={() => onAsk(item)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-surface-muted">
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
