import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client.js'

export default function Direction() {
  const catalog = useQuery({ queryKey: ['apis'], queryFn: api.apis })
  const [openId, setOpenId] = useState(null)
  if (catalog.isLoading) return <p>Loading endpoints…</p>
  if (catalog.isError) return <p>Unable to load endpoints.</p>
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-4xl font-bold">Direction 2: Endpoint Accordion</h1>
      <p className="text-sm text-ink-muted">Each operation opens the explanation stored for that API.</p>
      {catalog.data.map((item) => (
        <article key={item.id} className="rounded-lg border bg-surface">
          <button type="button" onClick={() => setOpenId(openId === item.id ? null : item.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span><strong className="mr-3">{item.method}</strong>{item.path}</span>
            <span className="text-sm text-ink-muted">{item.name}</span>
          </button>
          {openId === item.id && (
            <div className="space-y-3 border-t px-4 py-4 text-sm">
              {Object.entries(item.explanations).map(([audience, explanation]) => (
                <div key={audience}>
                  <div className="font-bold">{audience}</div>
                  <p>{explanation.summary}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
