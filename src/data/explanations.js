// Seed explanations keyed by "METHOD /path" in all 3 audience registers
export const SEED_EXPLANATIONS = {
  'POST /api/v1/submissions': {
    Business: {
      summary: 'Creates a new broker or MGA submission and returns the carrier submission identifier.',
      evaluates: [
        'Broker and MGA information',
        'Insured name, address, and contact',
        'Line of business and coverage requested',
      ],
      returns: [
        'New submission ID',
        'Submission status and timestamp',
      ],
    },
    Developer: {
      summary: 'Accepts a submission JSON and returns a 201 with the new submission record and ID. Validates schema and required fields.',
      evaluates: [
        'Request body JSON schema',
        'Required fields (insured, broker, lob)',
        'Auth and idempotency key header',
      ],
      returns: [
        'HTTP 201 with submission object',
        'Location header with submission URI',
      ],
    },
    Partner: {
      summary: 'Submit a new submission with insured and coverage details. Get back a submission ID.',
      evaluates: [
        'Insured information',
        'Coverage and line of business',
      ],
      returns: [
        'Submission ID',
        'Status confirmation',
      ],
    },
  },
  'GET /api/v1/submissions/{id}/status': {
    Business: {
      summary: 'Tells you where a submission currently sits in underwriting — who owns it, what stage it has reached, and how urgent it is.',
      evaluates: [
        'Submission ID',
      ],
      returns: [
        'Current workflow stage',
        'Assigned underwriter and next steps',
      ],
    },
    Developer: {
      summary: 'Fetches the current submission state by ID. Returns 404 if not found. Supports ETag caching with 304 Not Modified.',
      evaluates: [
        'Submission ID parameter',
        'If-None-Match header for conditional requests',
      ],
      returns: [
        'HTTP 200 with submission status object',
        'ETag and Cache-Control headers',
      ],
    },
    Partner: {
      summary: 'Check where your submission is in the underwriting process.',
      evaluates: [
        'Submission ID',
      ],
      returns: [
        'Current status and owner',
        'Estimated next action date',
      ],
    },
  },
  'POST /api/v1/submissions/{id}/documents': {
    Business: {
      summary: 'Registers submission documents such as applications, SOVs, schedules and loss runs.',
      evaluates: [
        'Submission ID',
        'Document type (application, schedule, loss run)',
        'File and metadata',
      ],
      returns: [
        'Document ID',
        'Upload confirmation and timestamp',
      ],
    },
    Developer: {
      summary: 'Uploads a document attachment to a submission. Returns 201 on success. Supports multipart/form-data.',
      evaluates: [
        'Submission exists and is not closed',
        'File size and mime type',
        'Authorization scope for document upload',
      ],
      returns: [
        'HTTP 201 with document metadata',
        'Document ID and storage reference',
      ],
    },
    Partner: {
      summary: 'Upload documents (applications, schedules) to a submission.',
      evaluates: [
        'Submission ID',
        'Document file and metadata',
      ],
      returns: [
        'Document ID',
        'Confirmation',
      ],
    },
  },
  'POST /api/v1/underwriting/appetite': {
    Business: {
      summary: 'Checks whether a submitted risk fits the carrier\'s underwriting appetite based on key business factors.',
      evaluates: [
        'Line of business and industry type',
        'Geographic location and territory',
        'Company revenue and financial stability',
        'Prior loss history and claims',
      ],
      returns: [
        'Accept, Refer, or Decline decision',
        'Business reasons for the decision',
      ],
    },
    Developer: {
      summary: 'Evaluates underwriting appetite using risk parameters and returns an accept/refer/decline decision with HTTP 200 or 400.',
      evaluates: [
        'Line of business, industry, geography',
        'Annual revenue and loss experience',
        'Request schema validation',
        '401 on missing auth, 429 on rate limit',
      ],
      returns: [
        'JSON with decision, score, and explanation',
        'Idempotent on retry with same idempotency-key',
      ],
    },
    Partner: {
      summary: 'Post risk details to check appetite. Returns a decision plus referral rules.',
      evaluates: [
        'Business type and location',
        'Financial metrics and loss history',
      ],
      returns: [
        'Decision (Accept/Refer/Decline)',
        'Referral instructions if applicable',
      ],
    },
  },
  'POST /api/v1/claims/fnol': {
    Business: {
      summary: 'Opens a new claim from a First Notice of Loss and assigns it to an adjuster.',
      evaluates: [
        'Policy number and insured identity',
        'Loss date, type, and severity',
        'Claimant information and contact details',
      ],
      returns: [
        'New claim number',
        'Assigned adjuster name and contact',
      ],
    },
    Developer: {
      summary: 'Creates a claim record from FNOL data and returns the claim ID and adjuster assignment. Returns 201 on success.',
      evaluates: [
        'Policy lookup and active status',
        'FNOL schema and required fields',
        'Adjuster availability and workload',
      ],
      returns: [
        'HTTP 201 with claim object and adjuster assignment',
        'Location header with claim URI for idempotency',
      ],
    },
    Partner: {
      summary: 'Submit loss details to create a claim. Get back a claim ID and who\'s handling it.',
      evaluates: [
        'Policy and policyholder details',
        'Loss description and date',
      ],
      returns: [
        'Claim ID',
        'Adjuster assignment',
      ],
    },
  },
  'GET /api/v1/policies/{policyNumber}/exposures': {
    Business: {
      summary: 'Retrieves all insured exposures (locations, vehicles, payroll, etc.) for a policy.',
      evaluates: [
        'Policy number',
        'Exposure type (location, vehicle, payroll)',
      ],
      returns: [
        'List of all exposures with addresses and details',
        'Limit and deductible for each exposure',
      ],
    },
    Developer: {
      summary: 'Fetches exposure data for a policy. Returns a paginated array of exposure objects or 404 if policy not found.',
      evaluates: [
        'Policy number format and existence',
        'Query parameters (limit, offset)',
      ],
      returns: [
        'HTTP 200 with exposure array and pagination info',
        'Caching via ETag and Cache-Control headers',
      ],
    },
    Partner: {
      summary: 'Get all exposures (buildings, vehicles, etc.) for a policy by number.',
      evaluates: [
        'Policy number',
      ],
      returns: [
        'Array of exposures with details',
      ],
    },
  },
  'POST /api/v1/quotes': {
    Business: {
      summary: 'Generates an underwriting quote for requested coverage and terms.',
      evaluates: [
        'Insured profile and risk factors',
        'Coverage type and limit selection',
        'Term length and renewal history',
      ],
      returns: [
        'Premium amount and quote ID',
        'Quote expiration date and effective date',
      ],
    },
    Developer: {
      summary: 'Submits a quote request with coverage parameters and returns a quote object with ID and premium. Returns 202 for async pricing.',
      evaluates: [
        'Request body schema and validation',
        'Risk data completeness',
        'Pricing engine availability',
      ],
      returns: [
        'HTTP 200 or 202 with quote object',
        'Quote ID for bind operations',
      ],
    },
    Partner: {
      summary: 'Request a quote with coverage details. Get a quote ID, premium, and expiration date.',
      evaluates: [
        'Insured and coverage information',
      ],
      returns: [
        'Quote ID and premium',
        'Valid until date',
      ],
    },
  },
  'POST /api/v1/quotes/{id}/bind': {
    Business: {
      summary: 'Binds an accepted quote and issues a policy.',
      evaluates: [
        'Quote ID and status',
        'Quote expiration',
      ],
      returns: [
        'Policy number',
        'Effective and expiration dates',
      ],
    },
    Developer: {
      summary: 'Transitions a quote to a bound policy. Returns 409 if quote expired or already bound.',
      evaluates: [
        'Quote exists and is in Quoted state',
        'No concurrent bind attempts (idempotency key)',
      ],
      returns: [
        'HTTP 200 with policy object',
        'Policy number in response',
      ],
    },
    Partner: {
      summary: 'Accept a quote to bind it. Get back a policy number and effective date.',
      evaluates: [
        'Quote ID',
      ],
      returns: [
        'Policy number',
        'Start and end dates',
      ],
    },
  },
  'GET /api/v1/policies/{policyNumber}': {
    Business: {
      summary: 'Retrieves the current policy details including coverage, premium, and insured information.',
      evaluates: [
        'Policy number',
      ],
      returns: [
        'Policy header with insured name and address',
        'Premium, term dates, and coverage summary',
      ],
    },
    Developer: {
      summary: 'Fetches a policy by number. Returns 404 if not found. Supports ETag caching.',
      evaluates: [
        'Policy number format and existence',
      ],
      returns: [
        'HTTP 200 with full policy object',
        'ETag header for conditional requests',
      ],
    },
    Partner: {
      summary: 'Look up a policy by number. Returns policy details and coverage info.',
      evaluates: [
        'Policy number',
      ],
      returns: [
        'Policy details and insured info',
      ],
    },
  },
  'GET /api/v1/accounts/{accountId}/loss-runs': {
    Business: {
      summary: 'Retrieves historical loss data for an account to assess past claims experience.',
      evaluates: [
        'Account ID',
        'Valuation date',
      ],
      returns: [
        'List of prior claims with dates and amounts',
        'Total losses and frequency metrics',
      ],
    },
    Developer: {
      summary: 'Fetches loss run data for an account as of a specific date. Returns a loss run object with claims array.',
      evaluates: [
        'Account exists and is accessible',
        'Valuation date parameter',
      ],
      returns: [
        'HTTP 200 with loss run and claims array',
        'Sorted by claim date descending',
      ],
    },
    Partner: {
      summary: 'Get loss history for an account. See prior claims and total loss amounts.',
      evaluates: [
        'Account ID and valuation date',
      ],
      returns: [
        'List of prior claims',
        'Loss totals',
      ],
    },
  },
  'GET /api/v1/reference/class-codes': {
    Business: {
      summary: 'Retrieves the current lookup tables for class codes, coverage codes, and territories.',
      evaluates: [
        'Reference type (class, coverage, territory)',
      ],
      returns: [
        'List of valid codes and descriptions',
        'Effective and expiration dates for each',
      ],
    },
    Developer: {
      summary: 'Serves reference data for form dropdowns. Cached and ETag-validated. Returns 304 if unchanged.',
      evaluates: [
        'Query parameters for filtering',
      ],
      returns: [
        'HTTP 200 with reference array',
        'Cache-Control: max-age=86400',
      ],
    },
    Partner: {
      summary: 'Get lookup tables for class codes, coverage types, and territories.',
      evaluates: [
        'Reference type requested',
      ],
      returns: [
        'List of codes and labels',
      ],
    },
  },
}

// Helper to get explanation with fallback
export function getExplanation(method, path, audience = 'Developer') {
  const key = `${method} ${path}`
  const explanation = SEED_EXPLANATIONS[key]?.[audience]
  return explanation || null
}

// Get all available audiences for an operation
export function getAvailableAudiences(method, path) {
  const key = `${method} ${path}`
  return Object.keys(SEED_EXPLANATIONS[key] || {})
}
