const OPTIONAL_REQUEST_FIELDS = new Set([
  'annualRevenue',
  'priorLossCount',
  'priorLossAmount',
  'employeeCount',
  'yearsInBusiness',
  'invoiceNumber',
])

const FIELD_DESCRIPTIONS = {
  accountId: 'Account identifier used to request account-level insurance data.',
  address: 'Insured or exposure location address.',
  adjuster: 'Claim adjuster currently assigned to the claim.',
  adjusterAssigned: 'Claim adjuster assigned when the claim is opened.',
  annualRevenue: 'Annual business revenue used for underwriting and appetite decisions.',
  appetite: 'Underwriting appetite result returned by the appetite service.',
  bindDate: 'Requested date for binding the quote into a policy.',
  bindRequestedBy: 'User or broker email requesting the bind action.',
  brokerId: 'Broker or MGA identifier submitting the account.',
  claimNumber: 'Claim identifier assigned by the claims system.',
  claimStage: 'Current claim handling stage.',
  claims: 'Claim records included in the loss run response.',
  classCode: 'Insurance class code associated with an exposure or reference-data result.',
  classCodes: 'Class-code records returned for the requested line of business and state.',
  code: 'Reference-data code value.',
  coverage: 'Coverage being quoted or evaluated.',
  dateOfLoss: 'Date when the loss occurred.',
  deductible: 'Deductible amount selected for the quote.',
  description: 'Human-readable description of the record or event.',
  documentDate: 'Date associated with the uploaded document.',
  documentId: 'Document identifier returned after registration.',
  documentType: 'Type of document being registered.',
  effectiveDate: 'Date when the policy, quote, or bind action becomes effective.',
  employeeCount: 'Number of employees used for risk scoring or exposure data.',
  expirationDate: 'Date when the quote or policy expires.',
  extractionStatus: 'Document extraction or processing status.',
  factors: 'Risk factors that influenced the score or recommendation.',
  fileName: 'File name of the document being registered.',
  industry: 'Industry classification used for underwriting decisions.',
  insuredName: 'Named insured business or account name.',
  invoiceNumber: 'Invoice number associated with a claim payment.',
  lastUpdated: 'Timestamp when the status was last updated.',
  limit: 'Requested insurance coverage limit.',
  lineOfBusiness: 'Insurance line of business for the request or response.',
  locationId: 'Exposure location identifier.',
  lossLocation: 'Location where the loss occurred.',
  lossType: 'Type or category of loss being reported.',
  naicsCode: 'NAICS industry code used in underwriting evaluation.',
  newReserve: 'Reserve amount after the transaction is posted.',
  nextReviewDate: 'Next scheduled review date for the claim.',
  paid: 'Amount paid on a claim.',
  payee: 'Payment recipient.',
  paymentDate: 'Date the payment is scheduled or approved.',
  paymentId: 'Payment identifier returned by the claims payment service.',
  paymentMethod: 'Payment method used for the transaction.',
  paymentPlan: 'Payment plan selected for the bound policy.',
  paymentType: 'Type of claim payment being requested.',
  payroll: 'Payroll amount associated with an exposure location.',
  policyNumber: 'Policy identifier assigned by the policy administration system.',
  premium: 'Base premium returned for a quote.',
  previousReserve: 'Reserve amount before the transaction is posted.',
  priorLossAmount: 'Total prior loss amount used in risk scoring.',
  priorLossCount: 'Number of prior losses used in underwriting or scoring.',
  priority: 'Workflow or underwriting priority.',
  quoteId: 'Quote identifier returned by the quoting service.',
  reasons: 'Reasons explaining the appetite or referral result.',
  recommendation: 'Recommended underwriting action.',
  referralRequired: 'Indicates whether underwriting referral is required.',
  reportedDate: 'Date when the loss was reported.',
  reserve: 'Current claim reserve amount.',
  reserveType: 'Reserve category being adjusted.',
  riskScore: 'Numeric risk score produced by the scoring model.',
  riskTier: 'Risk tier derived from the numeric score.',
  score: 'Numeric score returned by the service.',
  severity: 'Claim severity classification.',
  source: 'Source system or channel submitting the record.',
  state: 'US state for rating, appetite, exposure, or reference-data lookup.',
  states: 'States where coverage is requested or applies.',
  status: 'Current lifecycle, workflow, policy, claim, or transaction status.',
  submissionId: 'Submission identifier assigned by the submissions system.',
  taxesAndFees: 'Taxes and fees added to the quote premium.',
  totalCost: 'Total quoted cost including premium, taxes, and fees.',
  totalIncurred: 'Paid plus reserved amount for a claim.',
  transactionId: 'Identifier for a posted reserve or financial transaction.',
  transactionType: 'Type of reserve transaction being requested.',
  underwriter: 'Underwriter assigned to the submission.',
  valuationDate: 'Date as of which loss-run values are calculated.',
  writtenPremium: 'Written premium on the policy.',
  yearsInBusiness: 'Number of years the insured has been operating.',
}

function inferType(value) {
  if (Array.isArray(value)) {
    if (!value.length) return 'array'
    return `${inferType(value[0])}[]`
  }
  if (value === null) return 'nullable'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  if (typeof value === 'object') return 'object'
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) return 'date-time string'
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return 'date string'
  return 'string'
}

function formatExample(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value)
  }
  return String(value)
}

function fieldDescription(name) {
  return FIELD_DESCRIPTIONS[name] || `Value for ${name}.`
}

function fieldsFromObject(value, section, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []

  return Object.entries(value).flatMap(([name, fieldValue]) => {
    const fieldName = prefix ? `${prefix}.${name}` : name
    const isNestedArray = Array.isArray(fieldValue) && fieldValue[0] && typeof fieldValue[0] === 'object'
    const isNestedObject = fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)
    const currentField = {
      name: fieldName,
      type: inferType(fieldValue),
      required: section === 'request' ? !OPTIONAL_REQUEST_FIELDS.has(name) : true,
      description: fieldDescription(name),
      example: formatExample(fieldValue),
    }

    if (isNestedArray) {
      return [currentField, ...fieldsFromObject(fieldValue[0], section, `${fieldName}[]`)]
    }
    if (isNestedObject) {
      return [currentField, ...fieldsFromObject(fieldValue, section, fieldName)]
    }
    return [currentField]
  })
}

function pathFields(path) {
  const matches = String(path || '').matchAll(/\{([^}]+)\}/g)
  return Array.from(matches, ([, name]) => ({
    name,
    type: 'string',
    required: true,
    description: `${name} path parameter used to identify the target resource.`,
    example: name.toLowerCase().includes('policy')
      ? 'POL-2026-98765'
      : name.toLowerCase().includes('claim')
        ? 'CLM-2026-45021'
        : name.toLowerCase().includes('account')
          ? 'ACC-10045'
          : 'SUB-2026-10452',
  }))
}

export function getApiSchema(api, payload, path) {
  return {
    pathParameters: pathFields(path),
    request: payload?.request ? fieldsFromObject(payload.request, 'request') : [],
    response: payload?.response ? fieldsFromObject(payload.response, 'response') : [],
  }
}