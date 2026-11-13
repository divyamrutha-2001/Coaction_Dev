const DOCUMENT_OVERRIDES = {
  'Create Submission API': {
    whenToUse: 'Use this when a broker, MGA, or intake workflow needs to create a new submission for underwriting review.',
    notes: ['Validate broker and insured information before sending.', 'Use the returned submission ID for later status, document, appetite, risk, quote, and bind calls.'],
    errors: ['Missing broker or insured information', 'Unsupported state or line of business', 'Invalid effective date'],
  },
  'Submission Status API': {
    whenToUse: 'Use this to check where a submission is in the underwriting workflow.',
    notes: ['This is a read-only lookup.', 'The priority and underwriter fields help route follow-up work.'],
    errors: ['Submission ID not found', 'User does not have access to the submission'],
  },
  'Submission Documents API': {
    whenToUse: 'Use this to register loss runs, applications, schedules, or other supporting submission documents.',
    notes: ['Document extraction may continue asynchronously after upload.', 'Store the returned document ID for downstream processing.'],
    errors: ['Unsupported document type', 'Missing file name', 'Submission ID not found'],
  },
  'Appetite Check API': {
    whenToUse: 'Use this before quoting to confirm whether an account fits underwriting appetite.',
    notes: ['A referral-required result should route the account to underwriting review.', 'Reasons explain why an account is outside straight-through processing.'],
    errors: ['Unsupported industry or state', 'Missing line of business', 'Invalid NAICS code'],
  },
  'Risk Score API': {
    whenToUse: 'Use this when underwriting needs a modeled risk score and recommendation.',
    notes: ['Factors explain major drivers behind the score.', 'Scores should support underwriting judgment, not replace it.'],
    errors: ['Submission ID not found', 'Incomplete exposure or loss data'],
  },
  'Quote API': {
    whenToUse: 'Use this to generate a quote for an approved or referred submission.',
    notes: ['Quote expiration date should be displayed to brokers.', 'Premium, taxes, and fees should be shown separately when possible.'],
    errors: ['Submission not eligible to quote', 'Invalid limit or deductible', 'Expired submission data'],
  },
  'Bind API': {
    whenToUse: 'Use this to convert an accepted quote into a bound policy.',
    notes: ['Binding is a business-critical write action.', 'Confirm quote authority and payment plan before calling.'],
    errors: ['Quote ID not found', 'Quote expired', 'User not authorized to bind'],
  },
  'Policy Lookup API': {
    whenToUse: 'Use this to retrieve current policy-level details.',
    notes: ['This is a read-only policy lookup.', 'Policy number is required in the path.'],
    errors: ['Policy not found', 'User does not have policy access'],
  },
  'Exposure API': {
    whenToUse: 'Use this to retrieve policy exposure locations and rating characteristics.',
    notes: ['Exposure records may include multiple insured locations.', 'Use location IDs when reconciling downstream data.'],
    errors: ['Policy not found', 'No exposures available for policy'],
  },
  'FNOL API': {
    whenToUse: 'Use this to create a first notice of loss for a policy.',
    notes: ['This is a claims write action.', 'Capture enough loss detail for initial assignment and severity triage.'],
    errors: ['Policy not active on date of loss', 'Missing loss description', 'Invalid loss date'],
  },
  'Claim Status API': {
    whenToUse: 'Use this to check the current status and handling stage of a claim.',
    notes: ['This is a read-only claim lookup.', 'Use next review date for workflow follow-up.'],
    errors: ['Claim not found', 'User does not have claim access'],
  },
  'Claim Reserve API': {
    whenToUse: 'Use this to post a claim reserve adjustment.',
    notes: ['Reserve changes should be audited.', 'Reason is important for financial review.'],
    errors: ['Invalid reserve type', 'Claim not open', 'Amount exceeds authority'],
  },
  'Claim Payment API': {
    whenToUse: 'Use this to request or approve a claim payment.',
    notes: ['Payment calls are sensitive financial transactions.', 'Production testing should be blocked unless explicitly approved.'],
    errors: ['Invalid payee', 'Amount exceeds authority', 'Duplicate invoice number'],
  },
  'Loss Run API': {
    whenToUse: 'Use this to retrieve claim history for an account.',
    notes: ['Valuation date controls the point-in-time claim totals.', 'Loss runs may contain sensitive claims information.'],
    errors: ['Account not found', 'No loss history available', 'User does not have account access'],
  },
  'Reference Data API': {
    whenToUse: 'Use this to retrieve approved class codes and reference values.',
    notes: ['Reference data is generally read-only.', 'Consumers should cache stable reference values where allowed.'],
    errors: ['Unsupported state', 'Unsupported line of business'],
  },
}

export function getApiDocument(api, method, path) {
  const override = DOCUMENT_OVERRIDES[api?.name] || {}
  return {
    purpose: api?.desc || 'API documentation notes are not available yet.',
    whenToUse: override.whenToUse || `Use this ${method} operation when consumers need to work with ${api?.name || 'this API'}.`,
    notes: override.notes || [
      `Endpoint: ${method} ${path}`,
      `Coordinate production access and breaking changes with ${api?.owner || 'the owning team'}.`,
    ],
    errors: override.errors || ['Invalid request data', 'Resource not found', 'User is not authorized for this API'],
    owner: api?.owner || 'Owner not assigned',
  }
}