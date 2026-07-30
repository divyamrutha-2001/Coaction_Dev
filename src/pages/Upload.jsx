import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { AlertCircle, CheckCircle, Upload as UploadIcon } from 'lucide-react'
import { apiClient } from '../services/apiClient'

const DOMAINS = ['Submission', 'Policy', 'Claims', 'Billing']
const TEAMS = ['Architecture Team', 'Submission Team', 'Policy Team', 'Claims Team', 'Billing Team']

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('basic')
  const { register, handleSubmit, formState: { errors }, watch } = useForm()
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
    { id: 'tags', label: '3. Tags' },
    { id: 'version', label: '4. Version' },
  ]

  const formData = watch()

  // Check if each tab is complete
  const isBasicComplete = formData.name?.trim() && formData.type && formData.domain
  const isSpecComplete = true // Optional fields
  const isTagsComplete = true // Optional fields
  
  // Determine which tabs are accessible based on completion of previous tabs
  const canAccessSpec = isBasicComplete
  const canAccessTags = isBasicComplete && isSpecComplete
  const canAccessVersion = isBasicComplete && isSpecComplete && isTagsComplete

  const isTabDisabled = (tabId) => {
    if (tabId === 'basic') return false
    if (tabId === 'spec') return !canAccessSpec
    if (tabId === 'tags') return !canAccessTags
    if (tabId === 'version') return !canAccessVersion
    return true
  }

  const handleTabClick = (tabId) => {
    // Only allow clicking tabs that are not disabled
    if (isTabDisabled(tabId)) {
      return
    }
    setActiveTab(tabId)
    setValidationError('')
  }

  const handleNext = () => {
    const tabOrder = ['basic', 'spec', 'tags', 'version']
    const currentIndex = tabOrder.indexOf(activeTab)
    
    // Validate current tab before moving to next
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
    // Other tabs are optional, just proceed to next
    
    setValidationError('')
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1])
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

    setValidationError('')
    mutation.mutate(data)
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Upload API</h1>
        <p className="text-muted">Register a new API in the catalog</p>
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
                  placeholder="e.g., Claims Bordereaux API"
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
                  type="url"
                  placeholder="https://api.example.com/v1"
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Documentation URL</label>
                <input
                  {...register('docs')}
                  type="url"
                  placeholder="https://docs.example.com"
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

          {activeTab === 'tags' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <input
                  {...register('tags')}
                  type="text"
                  placeholder="Comma-separated tags"
                  className="input-base w-full"
                />
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
                    defaultValue="v1.0.0"
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
                <select {...register('lifecycle')} className="input-base w-full">
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                  <option value="Beta">Beta</option>
                  <option value="Deprecated">Deprecated</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <button type="button" className="btn-ghost px-6 py-2">Cancel</button>
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
