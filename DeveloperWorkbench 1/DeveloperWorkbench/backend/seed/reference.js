export const tagDefinitions = [
  { tag: 'Submissions', category: 'Business Domain', description: 'APIs that create, update, or support new business submissions.', owner: 'Submissions Team', rules: ['Use for broker intake, submission documents, and underwriting handoff.'], color: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.1)' },
  { tag: 'Underwriting', category: 'Business Domain', description: 'APIs used for appetite, risk scoring, quoting, and bind workflows.', owner: 'Underwriting Team', rules: ['Use when the API affects underwriting decisions or quote lifecycle.'], color: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.1)' },
  { tag: 'Policy', category: 'Business Domain', description: 'APIs that expose policy header, term, premium, or exposure information.', owner: 'Policy Team', rules: ['Use for policy administration and policy lookup operations.'], color: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.1)' },
  { tag: 'Claims', category: 'Business Domain', description: 'APIs that create, view, or update claim and loss information.', owner: 'Claims Team', rules: ['Use for FNOL, claim status, reserve, payment, and loss-run data.'], color: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.1)' },
  { tag: 'Data Services', category: 'Business Domain', description: 'Shared data and reference-data APIs used across consuming teams.', owner: 'Data Services Team', rules: ['Use for read-heavy shared data, reference data, and reporting extracts.'], color: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.1)' },
  { tag: 'REST', category: 'Technical Type', description: 'HTTP-based JSON API exposed as REST operations.', owner: 'Architecture', rules: ['Document method, path parameters, request schema, response schema, and examples.'], color: 'hsl(172 66% 25%)', background: 'hsl(var(--accent) / 0.18)' },
  { tag: 'ACORD', category: 'Technical Type', description: 'API uses or aligns with ACORD insurance data conventions.', owner: 'Enterprise Data', rules: ['Confirm field naming and message shape with data standards.'], color: 'hsl(172 66% 25%)', background: 'hsl(var(--accent) / 0.18)' },
  { tag: 'PII', category: 'Security', description: 'API may expose personally identifiable customer, insured, claimant, or payee data.', owner: 'Data Governance', rules: ['Require access approval.', 'Mask sensitive values in lower environments where possible.'], color: 'hsl(var(--destructive))', background: 'hsl(var(--destructive) / 0.1)' },
  { tag: 'Financial', category: 'Security', description: 'API can expose or affect premium, reserve, payment, or financial transaction data.', owner: 'Finance Controls', rules: ['Audit every production call.', 'Restrict write operations to approved roles.'], color: 'hsl(var(--destructive))', background: 'hsl(var(--destructive) / 0.1)' },
  { tag: 'Published', category: 'Lifecycle', description: 'API is approved for catalog discovery and consumer onboarding.', owner: 'API Governance', rules: ['Published APIs need owner, version, examples, schema, and change notes.'], color: 'hsl(143 64% 28%)', background: 'hsl(143 64% 90%)' },
  { tag: 'Draft', category: 'Lifecycle', description: 'API is being prepared and should not be treated as consumer-ready.', owner: 'API Governance', rules: ['Draft APIs should not be used by production consumers.'], color: 'hsl(143 64% 28%)', background: 'hsl(143 64% 90%)' },
  { tag: 'Deprecated', category: 'Lifecycle', description: 'API is still visible but should be replaced by a newer version.', owner: 'API Governance', rules: ['Show migration guidance and planned retirement date.'], color: 'hsl(143 64% 28%)', background: 'hsl(143 64% 90%)' },
  { tag: 'Production', category: 'Environment', description: 'API is available in the production catalog.', owner: 'API Governance', rules: ['Production tags mark APIs that consumers can request access to.'] , color: 'hsl(var(--muted))', background: 'hsl(var(--muted) / 0.12)' },
]

export const users = [
  { id: 'u1', name: 'Divya M.', email: 'divya.m@coaction.com', team: 'Platform', role: 'Admin', access: 'Full portal', status: 'Active', lastActive: 'Today', expires: 'None', apis: '*' },
  { id: 'u2', name: 'Sara K.', email: 'sara.k@coaction.com', team: 'Underwriting', role: 'API Owner', access: 'Underwriting APIs', status: 'Active', lastActive: '18 min ago', expires: 'None', apis: ['Appetite Check API', 'Risk Score API', 'Quote API', 'Bind API'] },
  { id: 'u3', name: 'Michael C.', email: 'michael.c@coaction.com', team: 'Submissions', role: 'Developer', access: 'QA Try It', status: 'Active', lastActive: '1 hr ago', expires: 'None', apis: ['Create Submission API', 'Submission Status API', 'Submission Documents API'] },
  { id: 'u4', name: 'Priya R.', email: 'priya.r@coaction.com', team: 'Data Services', role: 'Viewer', access: 'Docs only', status: 'Active', lastActive: '3 hr ago', expires: 'None', apis: ['Reference Data API', 'Loss Run API'] },
  { id: 'u5', name: 'James O.', email: 'james.o@coaction.com', team: 'Policy', role: 'Developer', access: 'Policy QA', status: 'Pending', lastActive: 'Invited', expires: '2026-10-15', apis: ['Policy Lookup API', 'Exposure API'] },
  { id: 'u6', name: 'Emily T.', email: 'emily.t@coaction.com', team: 'Claims', role: 'API Owner', access: 'Claims APIs', status: 'Active', lastActive: 'Yesterday', expires: 'None', apis: ['FNOL API', 'Claim Status API', 'Claim Reserve API', 'Claim Payment API'] },
  { id: 'u7', name: 'Raj P.', email: 'raj.p@coaction.com', team: 'Partner Ops', role: 'Partner', access: 'Approved partner APIs', status: 'Suspended', lastActive: '4 days ago', expires: '2026-09-30', apis: ['Policy Lookup API'] },
]

export const roles = [
  { role: 'Viewer', docs: 'Yes', tryIt: 'No', publish: 'No', approve: 'No', admin: 'No' },
  { role: 'Developer', docs: 'Yes', tryIt: 'QA/Dev', publish: 'No', approve: 'No', admin: 'No' },
  { role: 'API Owner', docs: 'Yes', tryIt: 'Owned APIs', publish: 'Owned APIs', approve: 'Owned APIs', admin: 'No' },
  { role: 'Admin', docs: 'Yes', tryIt: 'Yes', publish: 'Yes', approve: 'Yes', admin: 'Yes' },
  { role: 'Partner', docs: 'Approved APIs', tryIt: 'Approved sandbox only', publish: 'No', approve: 'No', admin: 'No' },
]

export const requests = [
  { id: 'r1', requester: 'Alex T.', team: 'Claims', api: 'Claim Payment API', accessType: 'Try It + Docs', risk: 'High', reason: 'Testing payment integration workflow', requestedAt: '2 hr ago' },
  { id: 'r2', requester: 'Neha P.', team: 'Underwriting', api: 'Policy Lookup API', accessType: 'Docs only', risk: 'Medium', reason: 'Reviewing policy lookup response fields', requestedAt: '5 hr ago' },
  { id: 'r3', requester: 'Marcus W.', team: 'Partner Ops', api: 'Reference Data API', accessType: 'Try It', risk: 'Low', reason: 'Partner integration proof of concept', requestedAt: '1 day ago' },
]

export const auditSeed = [
  { when: 'Today 10:22', actor: 'Divya M.', action: 'Approved access request', target: 'FNOL API - John D.', result: 'Approved' },
  { when: 'Today 10:18', actor: 'Sara K.', action: 'Changed API permission', target: 'Quote API', result: 'Updated' },
  { when: 'Today 09:41', actor: 'System', action: 'SSO login', target: 'michael.c@coaction.com', result: 'Success' },
  { when: 'Yesterday', actor: 'Emily T.', action: 'Reviewed high-risk access', target: 'Claim Payment API', result: 'Pending' },
  { when: 'Yesterday', actor: 'Divya M.', action: 'Suspended user', target: 'Raj P.', result: 'Suspended' },
]
