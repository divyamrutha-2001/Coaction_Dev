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
```

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

## Project Log

See `PROJECT_LOG.md` for the full project record. Add a dated entry there whenever features,
fixes, configuration, or deployment behavior changes.
