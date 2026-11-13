# CoAction Developer Workbench

React + Vite API developer portal for discovering, publishing, documenting, and monitoring CoAction APIs.

## Run It

```powershell
npm install
npm run dev:full
```

Then open the printed Vite URL, usually http://localhost:5173.

You can also run the frontend and backend separately:

```powershell
npm run dev
npm run server
```

The Vite dev server proxies `/api` requests to the Express backend on http://localhost:8787.

## Environment

Copy `.env.example` to `.env` and fill in the PostgreSQL connection values:

```powershell
PORT=8787
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SCHEMA=public
API_TEST_BASE_URL=http://localhost:8787/mock-api
API_TEST_TIMEOUT_MS=10000
```

`API_TEST_BASE_URL` is the default upstream used by the API Library Try It proxy. Set environment-specific values such as `API_TEST_QA_BASE_URL` or `API_TEST_PRODUCTION_BASE_URL` when you want Express to call real non-prod or production API gateways. If no real target is configured, the backend uses its local `/mock-api/*` upstream so Try It still performs an actual server-to-server request.

## Build For Production

```powershell
npm run build
npm run preview
```

## Project Structure

- `src/App.jsx` — top-level providers and `react-router-dom` routes
- `src/components/TopNav.jsx` — top navigation bar
- `src/pages/` — one component per page: Dashboard, ApiLibrary, Upload, Download, Tags, Access, Usage, PolicyTrace, Direction2Demo
- `src/data/apis.js` — 15 seed APIs shared by frontend pages and backend seeding
- `src/data/samplePayloads.js` — sample request/response payloads by API name
- `src/data/explanations.js` — audience-aware explanation content keyed by API operation
- `src/services/apiClient.js` — frontend fetch wrapper for `/api/apis` and `/api/downloads`
- `backend/server.js` — Express API, PostgreSQL connection, schema checks, and seed loading
- `web.config` — IIS URL Rewrite rules for API proxying and SPA fallback
- `ecosystem.config.cjs` — PM2 backend process config

## Main Routes

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | Dashboard | API KPIs, lifecycle status, charts, top consumers |
| `/api-library` | API Library | Browse APIs, sample payloads, generated code, Explain experience |
| `/upload` | Upload API | Multi-step API publishing workflow |
| `/download` | Downloads | Browse/download API artifacts and record downloads |
| `/tags` | Context Tags | Organize APIs by business and technical metadata |
| `/access` | Admin Access | Manage mock users, roles, and access status |
| `/usage` | Usage & KPIs | Usage charts and synthesized KPI metrics |
| `/trace` | Policy Trace | Request/policy trace viewer |

## Backend Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Database health check |
| GET | `/api/apis` | List APIs |
| POST | `/api/apis` | Create a new API |
| GET | `/api/downloads` | List recent downloads |
| POST | `/api/downloads` | Record a download |
| POST | `/api/test-run` | Execute an API Library Try It request through the backend proxy and log the call |
| GET | `/api/usage/summary` | Real call totals, error count, average latency, unique consumers, and catalog counts |
| GET | `/api/usage/timeseries` | Daily call and error counts with zero-filled gaps |
| GET | `/api/usage/top-consumers` | Highest-volume consumers by recorded call count |
| POST | `/api/v1/submissions` | Create a submission record in `workbench_submissions` and return the generated submission ID |
| GET | `/api/v1/submissions/{id}/status` | Current submission status, underwriter, and priority |
| POST | `/api/v1/submissions/{id}/documents` | Register a submission document |
| POST | `/api/v1/underwriting/appetite` | Appetite decision, score, and referral reasons (compute only) |
| POST | `/api/v1/underwriting/risk-score` | Risk score, tier, recommendation, and factors (compute only) |
| POST | `/api/v1/quotes` | Create a quote with calculated premium, taxes, and total |
| POST | `/api/v1/quotes/{id}/bind` | Bind a quote and create the resulting policy |
| GET | `/api/v1/policies/{policyNumber}` | Policy header, term, status, and written premium |
| GET | `/api/v1/policies/{policyNumber}/exposures` | Location-level exposures for a policy |
| POST | `/api/v1/claims/fnol` | Create a claim from First Notice of Loss |
| GET | `/api/v1/claims/{claimNumber}/status` | Claim status, stage, adjuster, and total incurred |
| POST | `/api/v1/claims/{claimNumber}/reserves` | Post a reserve transaction and update the claim balance |
| POST | `/api/v1/claims/{claimNumber}/payments` | Record a payment and move money from reserve to paid |
| GET | `/api/v1/accounts/{accountId}/loss-runs` | Historical claims and loss experience for an account |
| GET | `/api/v1/reference/class-codes` | Governed class codes, filterable by `lineOfBusiness` and `state` |
| ANY | `/mock-api/*` | Local dummy upstream used by Try It when no real target base URL is configured |

## Project Log

See `PROJECT_LOG.md` for the full project record. Add a dated entry there whenever features,
fixes, configuration, or deployment behavior changes.
