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
    <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        title="Upload API"
        description={`Step ${step + 1} of ${steps.length}: ${steps[step]}. Publishing writes an API catalog file into the git catalog.`}
      />
      <ol className="hidden gap-2 sm:grid sm:grid-cols-6">
        {steps.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} className={`rounded-md border px-2 py-2 text-xs font-semibold ${index === step ? 'border-[#1a3a52] bg-[#1a3a52] text-white' : index < step ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-[#d8e0ea] bg-white text-slate-600'}`}>
            <span className="mr-1">{index + 1}</span>{label}
          </li>
        ))}
      </ol>
      <p className="text-sm font-semibold sm:hidden">Step {step + 1} of {steps.length}: {steps[step]}</p>
      <Entered form={form} />
      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      {step === 0 && (
        <div className="grid gap-4">
          <Field id="api-name" label="Name" required value={form.name} error={errors.name} onChange={(value) => update('name', value)} />
          <Field id="api-type" label="Type" required value={form.type} error={errors.type} onChange={(value) => update('type', value)} />
          <Field id="api-domain" label="Domain" required value={form.domain} error={errors.domain} onChange={(value) => update('domain', value)} />
          <Field id="api-owner" label="Owner" required value={form.owner} error={errors.owner} onChange={(value) => update('owner', value)} />
          <Field id="api-desc" label="Description" value={form.desc} onChange={(value) => update('desc', value)} />
        </div>
      )}
      {step === 1 && <Field id="api-endpoint" label="Endpoint" value={form.endpoint} onChange={(value) => update('endpoint', value)} />}
      {step === 2 && (
        <div className="grid gap-4">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0} className="rounded-md border bg-white px-4 py-2 text-sm disabled:opacity-50">Back</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled className="rounded-md border bg-slate-100 px-4 py-2 text-sm text-slate-500" title="Draft saving is not available yet">Save draft</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={next} className="rounded-md bg-[#1a3a52] px-4 py-2 text-sm font-semibold text-white">Continue</button>
          ) : (
            <button type="submit" disabled={create.isPending} className="rounded-md bg-[#1a3a52] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{create.isPending ? 'Publishing…' : 'Publish'}</button>
          )}
        </div>
      </div>
    </form>
  )
}

function Entered({ form }) {
  const bits = [form.name, form.domain, form.owner, form.endpoint].filter(Boolean)
  if (!bits.length) return null
  return <p className="rounded-md border border-[#d8e0ea] bg-white px-3 py-2 text-sm text-slate-600">Entered: {bits.join(' · ')}</p>
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
    <div className="rounded-lg border border-[#d8e0ea] bg-white p-4">
      <h2 className="font-bold">Review before publish</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
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
      <input id={id} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#d8e0ea] px-3 font-normal" />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  )
}

function SelectField({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#d8e0ea] bg-white px-3">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  )
}

function JsonField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} spellCheck="false" className="mt-1 h-40 w-full rounded-md border border-[#d8e0ea] bg-slate-950 p-3 font-mono text-xs text-slate-100" />
    </div>
  )
}
