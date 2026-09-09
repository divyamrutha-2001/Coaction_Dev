import { useState } from 'react'
import { Sparkles, ChevronDown, Copy, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { getExplanation, getAvailableAudiences } from '../data/explanations'

// Mock operation list for a single API
const MOCK_OPERATIONS = [
  {
    id: 1,
    method: 'POST',
    path: '/api/v1/underwriting/appetite',
    summary: 'Check underwriting appetite',
  },
  {
    id: 2,
    method: 'GET',
    path: '/api/v1/policies/{policyNumber}',
    summary: 'Retrieve policy details',
  },
  {
    id: 3,
    method: 'POST',
    path: '/api/v1/quotes',
    summary: 'Generate a quote',
  },
  {
    id: 4,
    method: 'POST',
    path: '/api/v1/quotes/{id}/bind',
    summary: 'Bind a quote to policy',
  },
  {
    id: 5,
    method: 'GET',
    path: '/api/v1/policies/{policyNumber}/exposures',
    summary: 'List policy exposures',
  },
]

const METHOD_COLORS = {
  GET: { bg: 'hsl(172 66% 50% / 0.18)', color: 'hsl(172 66% 25%)' },
  POST: { bg: 'hsl(214 58% 29% / 0.14)', color: 'hsl(var(--primary))' },
  PUT: { bg: 'hsl(221 83% 60% / 0.15)', color: 'hsl(var(--secondary))' },
  DELETE: { bg: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' },
}

function MethodBadge({ method }) {
  const colors = METHOD_COLORS[method] || METHOD_COLORS.GET
  return (
    <span
      className="text-xs font-bold px-2 py-1 rounded"
      style={{ backgroundColor: colors.bg, color: colors.color }}
    >
      {method}
    </span>
  )
}

export function EndpointListView({ apiName = 'Policy Lookup API' }) {
  const [expandedEndpoint, setExpandedEndpoint] = useState(null)
  const [expandedAudience, setExpandedAudience] = useState({})
  const [isLoading, setIsLoading] = useState({})
  const [explanations, setExplanations] = useState({})
  const [feedback, setFeedback] = useState({})
  const [timestamp, setTimestamp] = useState({})

  const loadExplanation = (opId, method, path, audience = 'Developer') => {
    const key = `${opId}-${audience}`
    setIsLoading((prev) => ({ ...prev, [opId]: true }))

    // Simulate loading
    setTimeout(() => {
      const exp = getExplanation(method, path, audience)
      setExplanations((prev) => ({ ...prev, [key]: exp }))
      setTimestamp((prev) => ({ ...prev, [opId]: new Date().toLocaleTimeString() }))
      setIsLoading((prev) => ({ ...prev, [opId]: false }))
    }, 400)
  }

  const toggleEndpoint = (opId, method, path) => {
    if (expandedEndpoint === opId) {
      setExpandedEndpoint(null)
    } else {
      setExpandedEndpoint(opId)
      const aud = expandedAudience[opId] || 'Developer'
      if (!explanations[`${opId}-${aud}`]) {
        loadExplanation(opId, method, path, aud)
      }
    }
  }

  const handleAudienceChange = (opId, method, path, audience) => {
    setExpandedAudience((prev) => ({ ...prev, [opId]: audience }))
    setFeedback((prev) => ({ ...prev, [opId]: null }))
    const key = `${opId}-${audience}`
    if (!explanations[key]) {
      loadExplanation(opId, method, path, audience)
    }
  }

  const handleCopy = (opId, method, path, audience) => {
    const key = `${opId}-${audience}`
    const exp = explanations[key]
    if (!exp) return
    const text = `${exp.summary}\n\nWhat it evaluates:\n${exp.evaluates.join('\n')}\n\nWhat you get back:\n${exp.returns.join('\n')}`
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex flex-col gap-0 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-slate-900 px-4 py-3 border-b border-border">
        <h2 className="text-lg font-bold">{apiName}</h2>
        <p className="text-xs text-muted mt-1">Click ✨ on any endpoint to learn what it does</p>
      </div>

      {/* Endpoint Rows */}
      {MOCK_OPERATIONS.map((op, idx) => {
        const isExpanded = expandedEndpoint === op.id
        const audience = expandedAudience[op.id] || 'Developer'
        const key = `${op.id}-${audience}`
        const explanation = explanations[key]
        const isLoadingOp = isLoading[op.id]
        const availableAudiences = getAvailableAudiences(op.method, op.path)

        return (
          <div key={op.id}>
            {/* Operation Row */}
            <div
              className="px-4 py-3 border-b border-border hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors"
              style={{
                backgroundColor: isExpanded ? 'hsl(var(--muted) / 0.05)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Sparkles Button */}
                <button
                  onClick={() => toggleEndpoint(op.id, op.method, op.path)}
                  className={`flex-shrink-0 p-1.5 rounded transition-colors ${
                    isExpanded || explanation
                      ? 'text-violet-600 hover:bg-violet-100'
                      : 'text-gray-400 hover:text-violet-600 hover:bg-gray-100'
                  }`}
                  title="Explain this endpoint"
                >
                  <Sparkles
                    className={`h-5 w-5 ${isExpanded || explanation ? 'fill-violet-600' : ''}`}
                  />
                </button>

                {/* Method + Path */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <MethodBadge method={op.method} />
                  <code className="text-sm font-mono text-foreground truncate">{op.path}</code>
                </div>

                {/* Summary */}
                <p className="text-xs text-muted hidden lg:block flex-shrink-0">
                  {op.summary}
                </p>

                {/* Chevron */}
                <ChevronDown
                  className={`h-4 w-4 text-muted flex-shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Accordion Panel */}
            {isExpanded && (
              <div className="px-4 py-4 bg-violet-50 dark:bg-violet-950/20 border-b border-violet-200 dark:border-violet-800">
                <div className="space-y-3">
                  {/* Audience Segmented Control */}
                  <div className="flex gap-2">
                    {availableAudiences.map((aud) => (
                      <button
                        key={aud}
                        onClick={() => handleAudienceChange(op.id, op.method, op.path, aud)}
                        className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                          audience === aud
                            ? 'bg-violet-500 text-white'
                            : 'bg-white text-violet-600 border border-violet-200 hover:bg-violet-50'
                        }`}
                      >
                        {aud}
                      </button>
                    ))}
                  </div>

                  {/* Loading State */}
                  {isLoadingOp ? (
                    <div className="space-y-2 py-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-3 bg-violet-200 rounded animate-pulse"
                          style={{
                            width: `${85 - i * 15}%`,
                            animation: 'shimmer 2s infinite',
                          }}
                        />
                      ))}
                    </div>
                  ) : explanation ? (
                    <div className="space-y-2 text-xs">
                      {/* Summary */}
                      <p className="font-semibold text-violet-900 dark:text-violet-100 leading-snug">
                        {explanation.summary}
                      </p>

                      {/* What it evaluates */}
                      <div>
                        <p className="font-medium text-violet-800 dark:text-violet-200 text-xs mb-1">
                          What it evaluates
                        </p>
                        <ul className="space-y-0.5 text-violet-700 dark:text-violet-300">
                          {explanation.evaluates.map((item, idx) => (
                            <li key={idx} className="text-xs leading-snug">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* What you get back */}
                      <div>
                        <p className="font-medium text-violet-800 dark:text-violet-200 text-xs mb-1">
                          What you get back
                        </p>
                        <ul className="space-y-0.5 text-violet-700 dark:text-violet-300">
                          {explanation.returns.map((item, idx) => (
                            <li key={idx} className="text-xs leading-snug">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Footer */}
                      <div className="pt-2 mt-2 border-t border-violet-200 dark:border-violet-800 flex items-center justify-between">
                        <span className="text-xs text-violet-600 dark:text-violet-400">
                          Generated {timestamp[op.id]}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              setFeedback((prev) => ({
                                ...prev,
                                [op.id]: feedback[op.id] === 'up' ? null : 'up',
                              }))
                            }
                            className={`p-1 rounded transition-colors ${
                              feedback[op.id] === 'up'
                                ? 'bg-violet-300 text-violet-900'
                                : 'hover:bg-violet-100 text-violet-600'
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() =>
                              setFeedback((prev) => ({
                                ...prev,
                                [op.id]: feedback[op.id] === 'down' ? null : 'down',
                              }))
                            }
                            className={`p-1 rounded transition-colors ${
                              feedback[op.id] === 'down'
                                ? 'bg-violet-300 text-violet-900'
                                : 'hover:bg-violet-100 text-violet-600'
                            }`}
                            title="Not helpful"
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => loadExplanation(op.id, op.method, op.path, audience)}
                            className="p-1 rounded hover:bg-violet-100 text-violet-600 transition-colors"
                            title="Regenerate"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleCopy(op.id, op.method, op.path, audience)}
                            className="p-1 rounded hover:bg-violet-100 text-violet-600 transition-colors"
                            title="Copy explanation"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.6; transform: translateX(-100%); }
          50% { opacity: 1; }
          100% { opacity: 0.6; transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
