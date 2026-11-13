# Implementation Status

_Last updated: 2026-11-12 (Phase 2 blocked)_

## Rules
- Preserve existing UI; minimal, targeted changes; reuse existing code.
- No Okta work. One phase at a time; stop and ask when config/credentials are missing.
- Full history lives in `PROJECT_LOG.md`.

## Stack
- Frontend: React + Vite + Tailwind v4 (`src/`), React Query, recharts, lucide-react.
- Backend: Node/Express `backend/server.js` (+ `uiRoutes.js`, `catalog.js`, `auth.js`, `assistant.js`), PostgreSQL (PolicyODS).
- Catalog: git-backed specs in `catalog/`.
- Run: `npm run dev:full` (Vite :5173 + API :8787). Build: `npm run build` → `dist/`.
- Deploy: IIS serves `dist/` + `iis-deploy-bundle/web.config` (proxies `/api` → :8787); PM2 runs `backend/server.js` via `ecosystem.config.cjs`.

## Key files
| Area | Path |
|---|---|
| Routes/shell | `src/App.jsx` |
| API client | `src/api/client.js` |
| Shared UI | `src/components/ui.jsx` (PageHeader, Panel, SegmentedControl, StatusBadge, EmptyState…) |
| Theme tokens | `src/index.css` (light/dark CSS vars, `.kpi-tile`, `.pulse-end-dot`) |
| Pages | `src/pages/` Dashboard, Library, Sandbox, Upload, Tags, Usage, Trace, Access, Settings |
| Backend seed data | `src/data/apis.js`, `src/data/samplePayloads.js` (imported by `backend/server.js`) |

## Phase 1 — Azure DevOps catalog sources (complete, live-tested)
- `backend/azureDevOps.js`: validates org/project/repo/branch/folder via ADO REST 7.1, recursive file listing, OpenAPI/Swagger detection (JSON + YAML), fetches contents; errors: 400 input, 401 auth, 404 not found, 501 auth mode, 502 network/timeout, 503 no PAT. Org URL limited to `dev.azure.com` / `*.visualstudio.com`.
- Table `catalog_sources` (created at startup by `ensureCatalogSourcesSchema`) stores config, status, last_sync, last_error, spec_count, discovered_files (incl. content).
- Routes: `GET/POST /api/catalog-sources`, `PUT/DELETE /api/catalog-sources/:id`, `POST /api/catalog-sources/:id/sync`, `POST /api/catalog-sources/sync`. Save = real connection test.
- `src/pages/Settings.jsx`: same UI; localStorage replaced by the API; badge shows real status (tooltip = last error / last sync).
- Config: `AZURE_DEVOPS_PAT` in backend `.env` (Code Read). Only "Personal access token" auth mode works; others return 501.
- Tests: `node scripts/test-azure-devops.mjs` (offline, 14 checks).
- Live (2026-11-12): table created (approved); PAT valid (67 repos in ProSight IT). Source "BookingAPI" (master, `/`) synced → Connected, 8 JSON/YAML scanned, 0 specs (none committed; ASP.NET generates Swagger at runtime). Only spec file in the project: `Binding Authority Support Tools` `/docs/design-archive/.../swagger.json`.
- Not done: sync-mode scheduling, auth gate on these routes.

## Phase 2 — OpenAPI processing (BLOCKED, no code changes)
- Prerequisite failed: BookingAPI sync (master, `/`) re-run 2026-11-12 22:44 UTC → Connected, 0 OpenAPI/Swagger documents. Content scan of all JSON/YAML confirms no spec is committed; Swagger is generated at runtime (`src/Coaction.BookingApi/Program.cs`).
- Stratosure sample request (`/samples/Stratosure_WC_California_Sample_Request_Draft_V5_Latest.json`) cannot be schema-validated without the spec.
- Unblock options: (a) BookingAPI team commits generated `swagger.json` (e.g. Swashbuckle CLI) to the repo; (b) provide a reachable BookingAPI `/swagger/v1/swagger.json` URL per environment and approve fetching it; (c) supply the exported spec file another approved way.

## Completed
- Dashboard restored to Control Tower layout; Peak calls heartbeat sparkline with hover; dark-mode chips.
- Upload page aligned to app styling (PageHeader, card, step tiles).
- Policy Trace: time range select, filters with counts (incl. Retries), vertical day-grouped timeline.
- Deploy zip must include `backend/`, `catalog/`, `src/data/apis.js`, `src/data/samplePayloads.js`.

## Pending
- Nonprod IIS port 7073 has no HTTPS binding (blocks Okta; infra task, not code).
- Upload "Save draft" button disabled (not implemented).

## Decisions
- Theme via CSS variables + Tailwind `@theme inline`; use `dark:` variants for tinted chips.
- `server/dist/server.mjs` is stale and unused; PM2 runs `backend/server.js`.
