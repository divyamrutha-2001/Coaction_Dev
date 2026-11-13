import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../api/client.js'
import { PageHeader } from '../components/ui.jsx'

const steps = ['Basic Info', 'Documentation', 'Sample Payloads', 'Tags', 'Version', 'Review']

const empty = {
  name: '',
  type: 'REST',
  domain: '',
  owner: '',
  desc: '',
  endpoint: '',
  version: 'v1.0',
  lifecycle: 'Draft',
  environment: 'QA',
  tags: '',
  sampleRequest: '',
  sampleResponse: '',
}

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const create = useMutation({
    mutationFn: api.createApi,
    onSuccess: async () => {
      toast.success('API published to the catalog')
      await queryClient.invalidateQueries({ queryKey: ['apis'] })
      navigate('/api-library')
    },
    onError: () => setError('Check the required fields and try again.'),
  })

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  function validateBasics() {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.type.trim()) next.type = 'Type is required.'
    if (!form.domain.trim()) next.domain = 'Domain is required.'
    if (!form.owner.trim()) next.owner = 'Owner is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function validateJson() {
    try {
      if (form.sampleRequest.trim()) JSON.parse(form.sampleRequest)
      if (form.sampleResponse.trim()) JSON.parse(form.sampleResponse)
      return true
    } catch {
      setError('Sample payloads must be JSON objects.')
      return false
    }
  }

  function next() {
    setError('')
    if (step === 0 && !validateBasics()) return
    if (step === 2 && !validateJson()) return
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  function submit(event) {
    event.preventDefault()
    if (!validateBasics()) {
      setStep(0)
      return
    }
    if (!validateJson()) {
      setStep(2)
      return
    }
    let sampleRequest = null
    let sampleResponse = null
    if (form.sampleRequest.trim()) sampleRequest = JSON.parse(form.sampleRequest)
    if (form.sampleResponse.trim()) sampleResponse = JSON.parse(form.sampleResponse)
    create.mutate({
      name: form.name,
      type: form.type,
      domain: form.domain,
      owner: form.owner,
      desc: form.desc,
      endpoint: form.endpoint,
      version: form.version,
      lifecycle: form.lifecycle,
      environment: form.environment,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      sampleRequest,
      sampleResponse,
    })
  }

  return (
    <form onSubmit={submit} className="control-tower flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow="Publish"
        title="Upload API"
        description="Publishing writes an API catalog file into the git catalog."
        meta={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}
      />
      <ol className="hidden gap-3 sm:grid sm:grid-cols-6">
        {steps.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold shadow-sm ${index === step ? 'border-graphite bg-graphite text-white' : index < step ? 'border-line bg-surface text-ink' : 'border-line bg-surface text-ink-muted'}`}>
            <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs ${index === step ? 'bg-white/15' : index < step ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200' : 'bg-surface-muted'}`}>{index < step ? '✓' : index + 1}</span>
            <span className="truncate">{label}</span>
          </li>
        ))}
      </ol>
      <section className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-black text-ink">{steps[step]}</h2>
        <p className="mt-1 text-sm text-ink-muted sm:hidden">Step {step + 1} of {steps.length}</p>
      </div>
      <Entered form={form} />
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200" role="alert">{error}</p>}
      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="api-name" label="Name" required value={form.name} error={errors.name} onChange={(value) => update('name', value)} />
          <Field id="api-type" label="Type" required value={form.type} error={errors.type} onChange={(value) => update('type', value)} />
          <Field id="api-domain" label="Domain" required value={form.domain} error={errors.domain} onChange={(value) => update('domain', value)} />
          <Field id="api-owner" label="Owner" required value={form.owner} error={errors.owner} onChange={(value) => update('owner', value)} />
          <div className="md:col-span-2">
            <Field id="api-desc" label="Description" value={form.desc} onChange={(value) => update('desc', value)} />
          </div>
        </div>
      )}
      {step === 1 && <Field id="api-endpoint" label="Endpoint" value={form.endpoint} onChange={(value) => update('endpoint', value)} />}
      {step === 2 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <JsonField id="sample-request" label="Sample request JSON" value={form.sampleRequest} onChange={(value) => update('sampleRequest', value)} />
          <JsonField id="sample-response" label="Sample response JSON" value={form.sampleResponse} onChange={(value) => update('sampleResponse', value)} />
        </div>
      )}
      {step === 3 && <Field id="api-tags" label="Tags, comma separated" value={form.tags} onChange={(value) => update('tags', value)} />}
      {step === 4 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="api-version" label="Version" value={form.version} onChange={(value) => update('version', value)} />
          <SelectField id="api-lifecycle" label="Lifecycle" value={form.lifecycle} onChange={(value) => update('lifecycle', value)} options={['Draft', 'Published', 'Deprecated']} />
          <SelectField id="api-environment" label="Environment" value={form.environment} onChange={(value) => update('environment', value)} options={['Development', 'QA', 'Production']} />
        </div>
      )}
      {step === 5 && <Review form={form} />}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
        <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">Back</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled className="rounded-lg border border-line bg-surface-muted px-4 py-2 text-sm font-bold text-ink-muted" title="Draft saving is not available yet">Save draft</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={next} className="rounded-lg bg-graphite px-4 py-2 text-sm font-bold text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)]">Continue</button>
          ) : (
            <button type="submit" disabled={create.isPending} className="rounded-lg bg-graphite px-4 py-2 text-sm font-bold text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)] disabled:opacity-60">{create.isPending ? 'Publishing…' : 'Publish'}</button>
          )}
        </div>
      </div>
      </section>
    </form>
  )
}

function Entered({ form }) {
  const bits = [form.name, form.domain, form.owner, form.endpoint].filter(Boolean)
  if (!bits.length) return null
  return <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm text-ink-muted">Entered: {bits.join(' · ')}</p>
}

function Review({ form }) {
  const rows = [
    ['Name', form.name],
    ['Type', form.type],
    ['Domain', form.domain],
    ['Owner', form.owner],
    ['Description', form.desc || '—'],
    ['Endpoint', form.endpoint || '—'],
    ['Tags', form.tags || '—'],
    ['Version', form.version],
    ['Lifecycle', form.lifecycle],
    ['Environment', form.environment],
  ]
  return (
    <div className="rounded-lg border border-line bg-surface-muted p-4">
      <h2 className="text-base font-black text-ink">Review before publish</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase text-ink-muted">{label}</dt>
            <dd className="break-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Field({ id, label, value, onChange, required, error }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}{required && <span className="text-red-700"> *</span>}</label>
      <input id={id} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 font-normal text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  )
}

function SelectField({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  )
}

function JsonField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} spellCheck="false" className="mt-1 h-40 w-full rounded-lg border border-line bg-graphite p-3 font-mono text-xs text-slate-100" />
    </div>
  )
}
