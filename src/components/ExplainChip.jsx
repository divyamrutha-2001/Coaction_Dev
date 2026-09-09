import { useState, useEffect } from 'react'
import { Sparkles, Copy, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { getExplanation, getAvailableAudiences } from '../data/explanations'

export function ExplainChip({ api }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [audience, setAudience] = useState('Developer')
  const [timestamp, setTimestamp] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // Extract method and path from endpoint
  const method = api.endpoint.split(' ')[0] || 'GET'
  const path = api.endpoint.split(' ').slice(1).join(' ') || '/api/v1'

  // Get explanation from seed data (or Claude in future)
  const loadExplanation = (aud = audience) => {
    setIsLoading(true)
    // Simulate loading delay
    setTimeout(() => {
      const exp = getExplanation(method, path, aud)
      setExplanation(exp)
      setTimestamp(new Date().toLocaleTimeString())
      setIsLoading(false)
    }, 400)
  }

  const handleChipClick = () => {
    if (!isExpanded) {
      setIsExpanded(true)
      if (!explanation) {
        loadExplanation()
      }
    } else {
      setIsExpanded(false)
    }
  }

  const handleAudienceChange = (aud) => {
    setAudience(aud)
    setFeedback(null)
    setIsLoading(true)
    setTimeout(() => {
      const exp = getExplanation(method, path, aud)
      setExplanation(exp)
      setTimestamp(new Date().toLocaleTimeString())
      setIsLoading(false)
    }, 300)
  }

  const handleCopy = () => {
    const text = `${explanation.summary}\n\nWhat it evaluates:\n${explanation.evaluates.join('\n')}\n\nWhat you get back:\n${explanation.returns.join('\n')}`
    navigator.clipboard.writeText(text)
  }

  const availableAudiences = getAvailableAudiences(method, path)
  const isAvailable = availableAudiences.length > 0

  return (
    <div className="w-full">
      {/* ✨ Chip Button */}
      <button
        onClick={handleChipClick}
        disabled={!isAvailable}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
          isAvailable
            ? isExpanded || explanation
              ? 'bg-violet-100 text-violet-700 border border-violet-300'
              : 'border border-violet-200 text-violet-600 hover:border-violet-300'
            : 'border border-gray-300 text-gray-400 cursor-not-allowed'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Explain</span>
      </button>

      {/* Expansion Panel */}
      {isExpanded && isAvailable && (
        <div className="mt-3 p-3 rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/20 space-y-2">
          {/* Audience Segmented Control */}
          <div className="flex gap-1">
            {availableAudiences.map((aud) => (
              <button
                key={aud}
                onClick={() => handleAudienceChange(aud)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                  audience === aud
                    ? 'bg-violet-500 text-white'
                    : 'bg-white text-violet-600 border border-violet-200 hover:bg-violet-50'
                }`}
              >
                {aud}
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
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
                  Generated {timestamp}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFeedback('up')}
                    className={`p-1 rounded transition-colors ${
                      feedback === 'up'
                        ? 'bg-violet-300 text-violet-900'
                        : 'hover:bg-violet-100 text-violet-600'
                    }`}
                    title="Helpful"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setFeedback('down')}
                    className={`p-1 rounded transition-colors ${
                      feedback === 'down'
                        ? 'bg-violet-300 text-violet-900'
                        : 'hover:bg-violet-100 text-violet-600'
                    }`}
                    title="Not helpful"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => loadExplanation(audience)}
                    className="p-1 rounded hover:bg-violet-100 text-violet-600 transition-colors"
                    title="Regenerate"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleCopy}
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
      )}

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
