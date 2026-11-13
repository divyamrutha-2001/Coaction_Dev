// Sample request/response bodies for each API, sourced from the P&C Insurance
// API Library & Sample Payloads PDF. Keyed by API name. GET endpoints omit
// `request` because they carry no body.

export const samplePayloads = {
  'Create Submission API': {
    request: {
      brokerId: 'BRK-10021',
      insuredName: 'Acme Manufacturing Inc.',
      lineOfBusiness: 'General Liability',
      effectiveDate: '2026-10-01',
      annualRevenue: 25000000,
      states: ['NJ', 'NY', 'PA'],
    },
    response: {
      submissionId: 'SUB-2026-10452',
      status: 'RECEIVED',
      createdDate: '2026-08-17T13:30:00Z',
    },
  },

  'Submission Status API': {
    response: {
      submissionId: 'SUB-2026-10452',
      status: 'UNDER_REVIEW',
      underwriter: 'Jane Smith',
      priority: 'HIGH',
      lastUpdated: '2026-08-17T15:10:00Z',
    },
  },

  'Submission Documents API': {
    request: {
      documentType: 'LOSS_RUN',
      fileName: 'Acme_Loss_Run_2026.pdf',
      documentDate: '2026-08-15',
      source: 'BROKER_PORTAL',
    },
    response: {
      documentId: 'DOC-78931',
      status: 'UPLOADED',
      extractionStatus: 'PROCESSING',
    },
  },

  'Appetite Check API': {
    request: {
      lineOfBusiness: 'General Liability',
      industry: 'Manufacturing',
      naicsCode: '332710',
      state: 'NJ',
      annualRevenue: 25000000,
      priorLossCount: 2,
    },
    response: {
      appetite: 'ACCEPTABLE',
      score: 84,
      referralRequired: false,
      reasons: [],
    },
  },

  'Risk Score API': {
    request: {
      submissionId: 'SUB-2026-10452',
      annualRevenue: 25000000,
      employeeCount: 175,
      priorLossCount: 3,
      priorLossAmount: 425000,
      yearsInBusiness: 12,
    },
    response: {
      riskScore: 72,
      riskTier: 'MODERATE',
      recommendation: 'REFER',
      factors: [
        'Elevated loss frequency',
        'Loss severity above peer average',
      ],
    },
  },

  'Quote API': {
    request: {
      submissionId: 'SUB-2026-10452',
      coverage: 'GENERAL_LIABILITY',
      limit: 2000000,
      deductible: 25000,
      effectiveDate: '2026-10-01',
    },
    response: {
      quoteId: 'QTE-45092',
      premium: 185000,
      taxesAndFees: 8200,
      totalCost: 193200,
      expirationDate: '2026-09-15',
    },
  },

  'Bind API': {
    request: {
      bindRequestedBy: 'broker@abc.com',
      bindDate: '2026-09-10',
      paymentPlan: 'QUARTERLY',
    },
    response: {
      policyNumber: 'POL-2026-98765',
      status: 'BOUND',
      effectiveDate: '2026-10-01',
    },
  },

  'Policy Lookup API': {
    response: {
      policyNumber: 'POL-2026-98765',
      insuredName: 'Acme Manufacturing Inc.',
      lineOfBusiness: 'General Liability',
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      status: 'ACTIVE',
      writtenPremium: 185000,
    },
  },

  'Exposure API': {
    response: {
      policyNumber: 'POL-2026-98765',
      exposures: [
        {
          locationId: 'LOC-001',
          address: '100 Industrial Way, Newark, NJ',
          classCode: '91580',
          payroll: 4200000,
          employeeCount: 85,
        },
        {
          locationId: 'LOC-002',
          address: '25 Commerce Drive, Edison, NJ',
          classCode: '91580',
          payroll: 3100000,
          employeeCount: 62,
        },
      ],
    },
  },

  'FNOL API': {
    request: {
      policyNumber: 'POL-2026-98765',
      dateOfLoss: '2026-08-15',
      reportedDate: '2026-08-17',
      lossType: 'BODILY_INJURY',
      lossLocation: 'Newark, NJ',
      description: 'Visitor slipped and fell at insured premises.',
    },
    response: {
      claimNumber: 'CLM-2026-45021',
      status: 'OPEN',
      adjusterAssigned: 'John Carter',
      severity: 'MEDIUM',
    },
  },

  'Claim Status API': {
    response: {
      claimNumber: 'CLM-2026-45021',
      status: 'OPEN',
      claimStage: 'INVESTIGATION',
      adjuster: 'John Carter',
      totalIncurred: 95000,
      nextReviewDate: '2026-09-01',
    },
  },

  'Claim Reserve API': {
    request: {
      reserveType: 'INDEMNITY',
      transactionType: 'INCREASE',
      amount: 50000,
      reason: 'Updated medical evaluation',
    },
    response: {
      transactionId: 'RSV-90021',
      previousReserve: 75000,
      newReserve: 125000,
      status: 'POSTED',
    },
  },

  'Claim Payment API': {
    request: {
      paymentType: 'INDEMNITY',
      payee: 'John Doe',
      amount: 15000,
      paymentMethod: 'ACH',
      invoiceNumber: 'INV-7821',
    },
    response: {
      paymentId: 'PAY-55231',
      amount: 15000,
      status: 'APPROVED',
      paymentDate: '2026-08-18',
    },
  },

  'Loss Run API': {
    response: {
      accountId: 'ACC-10045',
      valuationDate: '2026-08-17',
      claims: [
        {
          claimNumber: 'CLM-2025-10014',
          dateOfLoss: '2025-03-11',
          status: 'CLOSED',
          paid: 85000,
          reserve: 0,
          totalIncurred: 85000,
        },
        {
          claimNumber: 'CLM-2026-45021',
          dateOfLoss: '2026-08-15',
          status: 'OPEN',
          paid: 15000,
          reserve: 125000,
          totalIncurred: 140000,
        },
      ],
    },
  },

  'Reference Data API': {
    response: {
      lineOfBusiness: 'Workers Compensation',
      state: 'NJ',
      classCodes: [
        {
          code: '8810',
          description: 'Clerical Office Employees',
          effectiveDate: '2026-01-01',
        },
        {
          code: '8742',
          description: 'Outside Sales Employees',
          effectiveDate: '2026-01-01',
        },
      ],
    },
  },
}

export function getSamplePayload(api) {
  if (!api) return null
  // Prefer payloads stored on the API row itself (returned from the backend);
  // fall back to the static PDF-sourced map keyed by name for demo APIs.
  if (api.sampleRequest || api.sampleResponse) {
    return { request: api.sampleRequest, response: api.sampleResponse }
  }
  if (!api.name) return null
  return samplePayloads[api.name] || null
}
