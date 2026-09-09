import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { AlertCircle, CheckCircle, Upload as UploadIcon } from 'lucide-react'
import { apiClient } from '../services/apiClient'

const DOMAINS = ['Submissions', 'Underwriting', 'Policy', 'Claims', 'Data Services']
const TEAMS = ['Submissions Team', 'Underwriting Team', 'Policy Team', 'Claims Team', 'Data Services Team']
const TAB_ORDER = ['basic', 'spec', 'samples', 'tags', 'version']

function validateJson(text) {
  if (!text || !text.trim()) return { ok: true, parsed: null }
  try {
    return { ok: true, parsed: JSON.parse(text) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('basic')
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm()
  const [success, setSuccess] = useState('')
  const [validationError, setValidationError] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [filePreview, setFilePreview] = useState('')

  const mutation = useMutation({
    mutationFn: (data) => apiClient.createApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apis'] })
      setSuccess('API uploaded successfully!')
      setTimeout(() => navigate('/api-library'), 1200)
    },
  })

  const tabs = [
    { id: 'basic', label: '1. Basic Info' },
    { id: 'spec', label: '2. Documentation' },
    { id: 'samples', label: '3. Sample Payloads' },
    { id: 'tags', label: '4. Tags' },
    { id: 'version', label: '5. Version' },
  ]

  const formData = watch()

  const isBasicComplete =
    Boolean(formData.name?.trim()) && Boolean(formData.type) && Boolean(formData.domain)

  const canAccess = {
    basic: true,
    spec: isBasicComplete,
    samples: isBasicComplete,
    tags: isBasicComplete,
    version: isBasicComplete,
  }

  const isTabDisabled = (tabId) => !canAccess[tabId]

  const handleTabClick = (tabId) => {
    // Only allow clicking tabs that are not disabled
    if (isTabDisabled(tabId)) {
      return
    }
    setActiveTab(tabId)
    setValidationError('')
  }

  const handleNext = () => {
    const currentIndex = TAB_ORDER.indexOf(activeTab)

    if (activeTab === 'basic') {
      if (!formData.name || !formData.name.trim()) {
        setValidationError('API Name is required')
        return
      }
      if (!formData.type) {
        setValidationError('Type is required')
        return
      }
      if (!formData.domain) {
        setValidationError('Domain is required')
        return
      }
    }

    if (activeTab === 'samples') {
      const req = validateJson(formData.sampleRequest)
      if (!req.ok) {
        setValidationError(`Sample request is not valid JSON: ${req.error}`)
        return
      }
      const res = validateJson(formData.sampleResponse)
      if (!res.ok) {
        setValidationError(`Sample response is not valid JSON: ${res.error}`)
        return
      }
    }

    setValidationError('')
    if (currentIndex < TAB_ORDER.length - 1) {
      setActiveTab(TAB_ORDER[currentIndex + 1])
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    const validTypes = ['application/json', 'application/xml', 'application/yaml', 'text/yaml', 'text/plain', 'application/pdf']
    const validExtensions = ['.json', '.xml', '.yaml', '.yml', '.txt', '.pdf', '.openapi', '.wsdl']
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    const isValidType = validTypes.includes(file.type) || validExtensions.includes(fileExtension)

    if (!isValidType) {
      setValidationError('Please upload a valid API documentation file (JSON, YAML, XML, WSDL, OpenAPI, PDF, or TXT)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationError('File size must be less than 5MB')
      return
    }

    setUploadedFile(file)
    setValidationError('')

    // Read file for preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result || ''
      // Show first 500 characters as preview
      if (file.type === 'application/pdf') {
        setFilePreview('📄 PDF file uploaded (preview not available)')
      } else {
        setFilePreview(content.substring(0, 500) + (content.length > 500 ? '...' : ''))
      }
    }
    reader.readAsText(file)
  }

  const handleFileRemove = () => {
    setUploadedFile(null)
    setFilePreview('')
  }

  function prettyPrintField(field) {
    const parsed = validateJson(formData[field])
    if (parsed.ok && parsed.parsed !== null) {
      setValue(field, JSON.stringify(parsed.parsed, null, 2), { shouldDirty: true })
    }
  }

  const onSubmit = (data) => {
    // Final validation before submitting
    if (!data.name || !data.name.trim()) {
      setValidationError('API Name is required')
      setActiveTab('basic')
      return
    }
    if (!data.type) {
      setValidationError('Type is required')
      setActiveTab('basic')
      return
    }
    if (!data.domain) {
      setValidationError('Domain is required')
      setActiveTab('basic')
      return
    }
    if (!data.owner) {
      setValidationError('Owner is required')
      return
    }

    const req = validateJson(data.sampleRequest)
    if (!req.ok) {
      setValidationError(`Sample request is not valid JSON: ${req.error}`)
      setActiveTab('samples')
      return
    }
    const res = validateJson(data.sampleResponse)
    if (!res.ok) {
      setValidationError(`Sample response is not valid JSON: ${res.error}`)
      setActiveTab('samples')
      return
    }

    setValidationError('')
    mutation.mutate({
      ...data,
      sampleRequest: req.parsed,
      sampleResponse: res.parsed,
    })
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Upload API</h1>
        <p className="text-muted">
          Register a new API in the CoAction catalog. Fields marked * are required; everything else can be filled in later.
        </p>
      </div>

      {success && (
        <div className="card-base bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <p className="text-green-800 dark:text-green-300">{success}</p>
        </div>
      )}

      {validationError && (
        <div className="card-base bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-300">{validationError}</p>
        </div>
      )}

      {mutation.error && (
        <div className="card-base bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-300">{mutation.error?.message || 'Upload failed'}</p>
        </div>
      )}

      <div className="card-base">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              disabled={isTabDisabled(tab.id)}
              className={`px-6 py-3 font-medium transition-colors ${
                isTabDisabled(tab.id)
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                  : activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted hover:text-foreground cursor-pointer'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">API Name *</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  type="text"
                  placeholder="e.g., Quote API, FNOL API, Policy Lookup API"
                  className="input-base w-full"
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type *</label>
                  <select {...register('type', { required: 'Type is required' })} className="input-base w-full">
                    <option value="">Select a type</option>
                    <option value="REST">REST</option>
                    <option value="SOAP">SOAP</option>
                    <option value="Internal">Internal</option>
                  </select>
                  {errors.type && <p className="text-xs text-destructive mt-1">{errors.type.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Domain *</label>
                  <select {...register('domain', { required: 'Domain is required' })} className="input-base w-full">
                    <option value="">Select a domain</option>
                    {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.domain && <p className="text-xs text-destructive mt-1">{errors.domain.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  {...register('desc')}
                  placeholder="Brief description of the API"
                  className="input-base w-full min-h-24"
                />
              </div>
            </div>
          )}

          {activeTab === 'spec' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Endpoint</label>
                <input
                  {...register('endpoint')}
                  type="text"
                  placeholder="e.g., POST /api/v1/quotes"
                  className="input-base w-full"
                />
                <p className="text-xs text-muted mt-1">
                  Include the HTTP method for REST endpoints (e.g., <code>GET /api/v1/policies/{'{policyNumber}'}</code>).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Documentation URL</label>
                <input
                  {...register('docs')}
                  type="url"
                  placeholder="https://docs.coaction.com/apis/quote"
                  className="input-base w-full"
                />
              </div>
              
              {/* API File Upload Section */}
              <div className="pt-4 border-t border-border">
                <label className="block text-sm font-medium mb-3">Upload API Documentation</label>
                <div className="space-y-3">
                  {!uploadedFile ? (
                    <div className="border-2 border-dashed border-primary rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                         onClick={() => document.getElementById('file-input')?.click()}>
                      <UploadIcon className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">Drag and drop your API file here</p>
                      <p className="text-xs text-muted mt-1">or click to browse</p>
                      <p className="text-xs text-muted mt-2">Supported: OpenAPI (JSON/YAML), WSDL (XML), PDF, TXT</p>
                      <p className="text-xs text-muted mt-1">Max size: 5MB</p>
                      <input 
                        id="file-input"
                        type="file"
                        hidden
                        accept=".json,.yaml,.yml,.xml,.wsdl,.pdf,.txt,.openapi"
                        onChange={handleFileUpload}
                      />
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-white">
                              {uploadedFile.name.split('.').pop()?.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{uploadedFile.name}</p>
                            <p className="text-xs text-muted">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={handleFileRemove}
                          className="text-sm text-destructive hover:text-destructive/80 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      
                      {filePreview && (
                        <div className="mt-3 bg-gray-900 dark:bg-slate-950 rounded p-3 max-h-32 overflow-y-auto">
                          <p className="text-xs text-gray-400 mb-2 font-mono">Preview:</p>
                          <p className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words">{filePreview}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="space-y-6">
              <p className="text-sm text-muted">
                Paste example JSON so developers see what a real request and response look like. These show up in
                the API Library preview under the{' '}
                <span className="font-semibold text-foreground">Request</span> and{' '}
                <span className="font-semibold text-foreground">Response</span> tabs. Leave either blank if it
                doesn't apply — GET endpoints, for example, have no request body.
              </p>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Sample Request (JSON)</label>
                  <button
                    type="button"
                    onClick={() => prettyPrintField('sampleRequest')}
                    className="bg-transparent text-xs font-semibold underline"
                    style={{ color: 'hsl(var(--primary))', padding: 0 }}
                  >
                    Format
                  </button>
                </div>
                <textarea
                  {...register('sampleRequest')}
                  placeholder={`{\n  "submissionId": "SUB-2026-10452",\n  "coverage": "GENERAL_LIABILITY",\n  "limit": 2000000,\n  "deductible": 25000\n}`}
                  className="input-base w-full font-mono text-xs"
                  style={{ minHeight: '9rem', whiteSpace: 'pre' }}
                />
                <p className="text-xs text-muted mt-1">Leave blank for GET endpoints. Must be valid JSON.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Sample Response (JSON)</label>
                  <button
                    type="button"
                    onClick={() => prettyPrintField('sampleResponse')}
                    className="bg-transparent text-xs font-semibold underline"
                    style={{ color: 'hsl(var(--primary))', padding: 0 }}
                  >
                    Format
                  </button>
                </div>
                <textarea
                  {...register('sampleResponse')}
                  placeholder={`{\n  "quoteId": "QTE-45092",\n  "premium": 185000,\n  "totalCost": 193200\n}`}
                  className="input-base w-full font-mono text-xs"
                  style={{ minHeight: '9rem', whiteSpace: 'pre' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <input
                  {...register('tags')}
                  type="text"
                  placeholder="Comma-separated, e.g. Production, ACORD, Underwriting"
                  className="input-base w-full"
                />
                <p className="text-xs text-muted mt-1">
                  Common CoAction tags: Production, QA, Beta, ACORD, Underwriting, Claims, Data Services, PII.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'version' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Version</label>
                  <input
                    {...register('version')}
                    type="text"
                    defaultValue="v1.0"
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Owner *</label>
                  <select {...register('owner', { required: 'Owner is required' })} className="input-base w-full">
                    <option value="">Select an owner</option>
                    {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.owner && <p className="text-xs text-destructive mt-1">{errors.owner.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Lifecycle</label>
                <select {...register('lifecycle')} className="input-base w-full" defaultValue="Draft">
                  <option value="Draft">Draft</option>
                  <option value="Beta">Beta</option>
                  <option value="Published">Published</option>
                  <option value="Deprecated">Deprecated</option>
                </select>
                <p className="text-xs text-muted mt-1">
                  New APIs typically land as <span className="font-semibold text-foreground">Draft</span> and are promoted to Published after review.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/api-library')}
              className="btn-ghost px-6 py-2"
            >
              Cancel
            </button>
            {activeTab !== 'version' ? (
              <button 
                type="button" 
                onClick={handleNext}
                className="btn-primary px-6 py-2"
              >
                Next
              </button>
            ) : (
              <button 
                type="submit" 
                className="btn-primary px-6 py-2" 
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Submitting...' : 'Submit for Review'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
