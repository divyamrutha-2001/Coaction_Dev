import { EndpointListView } from '../components/EndpointListView'

export default function Direction2Demo() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Direction 2: Endpoint Accordion</h1>
        <p className="text-muted text-sm max-w-2xl">
          Each operation row has a ✨ icon in the left gutter. Click to expand an accordion panel below
          the row with the full Explain experience. Multiple endpoints can be open at once for side-by-side
          comparison. This provides full presence and context-aware explanations at the operation level.
        </p>
      </div>

      {/* Endpoint List Demo */}
      <div className="max-w-4xl">
        <EndpointListView apiName="Policy Lookup API" />
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
        <div className="p-4 rounded-lg border border-border bg-card">
          <h3 className="font-semibold text-sm mb-2">✨ In Left Gutter</h3>
          <p className="text-xs text-muted">Subtle icon in the operation row, not competing with other controls</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <h3 className="font-semibold text-sm mb-2">Accordion Expansion</h3>
          <p className="text-xs text-muted">Panel expands below the row; multiple can be open for comparison</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <h3 className="font-semibold text-sm mb-2">Full Presence</h3>
          <p className="text-xs text-muted">Iris panel, audience control, streaming, footer actions all visible</p>
        </div>
      </div>
    </div>
  )
}
