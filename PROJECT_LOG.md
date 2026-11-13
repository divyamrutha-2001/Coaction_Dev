# CoAction Developer Workbench Project Log

Record meaningful project changes here as the work evolves.

## Change Log

### 2026-09-30 — Universal search intent router
- New `src/lib/search/intent.js` `resolveIntent(query, { apis })` turns any query into a ranked list of jump actions so the search never dead-ends. Routes to: Policy Trace (object IDs), Sandbox (endpoint paths or "test/try/run" + API), API Library (name/owner/domain), and all pages (Dashboard, Library, Sandbox, Tags, Usage, Trace, Configuration, Upload, Access) via keyword/synonym matching. Always includes a "Search the Library for …" fallback.
- `src/App.jsx` refactored: single router memo replaces the ad-hoc matchers; unified suggestion dropdown with icon + label + kind badge; keyboard nav + Enter run the highlighted primary.
- Per user choice, exact/unambiguous hits (full object ID, full endpoint path, exact page word) auto-navigate after a 600ms debounce and clear the box; everything else waits for Enter/click.
- The grounded inline answer card stays as the one network-backed enrichment for question-like queries.
- Browser-verified: "who is calling my apis" → Usage primary (no dead-end); "settings" → auto-jumped to Configuration; "test bind" + Enter → Bind API Sandbox.

### 2026-09-30 — Search bar: "Test this endpoint" → Sandbox jump
- The global search now detects an API endpoint path in the query (e.g., "I want to test this endpoint /api/v1/quotes/{id}/bind"), normalizes path params, matches it to a catalog spec, and offers a "Test &lt;API&gt; in the Sandbox" action that opens `/sandbox?api=<id>`. Enter triggers it too.
- Complements the existing ID → Trace jump; the inline answer still renders below so you also get the explanation/curl.
- Browser-verified: the Bind path routed to the Bind API request builder (pre-filled id + body, ready to run).

### 2026-09-29 — Make the global search bar AI-forward
- Inline instant answers: question-like queries (debounced ~350ms) call the grounded assistant engine (`api.ask`) and render a compact answer card at the top of the search dropdown with source chips and a "Continue in assistant" handoff. Catalog refusals are suppressed.
- ID-aware jump: pasting an object ID (`PK…`/`POL-`/`SUB-`/`QTE-`/`CLM-`/`ACC-`) surfaces a "Trace &lt;ID&gt; in Policy Trace" action; Enter or click navigates to `/trace?id=…`.
- `Trace.jsx` now seeds from and reacts to the `?id=` URL param.
- `Assistant.jsx` re-added an `open-assistant` window event that opens the panel and auto-sends an optional `detail.question`.
- Browser-verified end to end: answer card, ID jump into a live trace, and the search→assistant handoff (auto-sent question returns answer + curl + sources + follow-ups).

### 2026-09-22 — Implement all 15 catalog APIs as real endpoints
- Created 8 tables (`workbench_submission_documents`, `workbench_quotes`, `workbench_policies`, `workbench_policy_exposures`, `workbench_claims`, `workbench_claim_reserves`, `workbench_claim_payments`, `workbench_class_codes`), 6 ID sequences, and 8 indexes.
- Added `underwriter` and `priority` columns to `workbench_submissions`.
- Seeded a coherent demo dataset so GET endpoints return data immediately.
- Implemented the remaining 14 endpoints with validation, 404 handling, and parameterized SQL.
- Appetite Check and Risk Score are compute-only and persist nothing.
- Endpoints are connected: Bind converts a quote into a policy, FNOL requires an existing policy, reserves and payments update the claim balance, and loss runs join claims through policies by account.
- Replaced the exact-match `IMPLEMENTED_ENDPOINTS` set with regex patterns so parameterized paths route to real endpoints.
- Aligned Try It default path parameters with real seeded IDs so first-click requests succeed.
- Validated all 15 endpoints plus 404 and 400 paths; browser-verified Try It returns `200 OK` for reads and `201 Created` for writes.

### 2026-09-22 — Drive Dashboard metrics from real data
- Added `GET /api/usage/summary`, `GET /api/usage/timeseries`, and `GET /api/usage/top-consumers` that aggregate from `api_call_logs` and the `apis` catalog.
- Timeseries uses `generate_series` so days with no traffic return zero instead of being missing.
- Replaced the Dashboard's `seededRandom` call chart, `consumers × 450` Top Consumers estimate, and `apis.length × 0.12` Added This Month guess with real query results.
- Added `getUsageSummary`, `getUsageTimeseries`, and `getTopConsumers` to the API client.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Dashboard shows real values: 15 total APIs, 13 active, 2 consumers, and actual per-consumer call counts.

### 2026-09-22 — Implement real POST /api/v1/submissions endpoint
- Created `public.workbench_submissions` table, `workbench_submission_seq` sequence, and two supporting indexes in `PolicyODS`.
- Added `POST /api/v1/submissions` to the backend with field validation, sequence-based `SUB-YYYY-NNNNN` ID generation, and a parameterized insert.
- Added `IMPLEMENTED_ENDPOINTS` routing so Try It calls the real route for implemented endpoints while the other catalog APIs keep using the local mock upstream.
- Verified with direct calls: valid payload returned `201 Created`, invalid payload returned `400` with per-field validation details.
- Browser-verified Preview > Try It on Create Submission API returned `201 Created` and persisted `SUB-2026-10002`.
- Confirmed rows in `workbench_submissions` and the matching `201` entry in `api_call_logs` via read-only SELECT.

### 2026-09-22 — Add real backend proxy path for Try It
- Updated `/api/test-run` so Express builds a trusted upstream URL, calls the target API server-side, captures status, headers, duration, and body, and logs the result.
- Added configurable Try It upstream base URLs with `API_TEST_BASE_URL`, `API_TEST_DEV_BASE_URL`, `API_TEST_QA_BASE_URL`, `API_TEST_PRODUCTION_BASE_URL`, and `API_TEST_TIMEOUT_MS`.
- Added a local `/mock-api/*` dummy upstream so Try It performs an actual server-to-server HTTP call even before real non-prod API gateway URLs are configured.
- Documented the Try It proxy configuration in `.env.example` and `README.md`.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Directly verified `/api/test-run` calls the mock upstream and browser-verified Preview > Try It still returns `200 OK` with response data.

### 2026-09-22 — Hide Try It logged call label
- Removed the visible `Logged call #` text from the API Library Try It response panel while keeping backend call logging intact.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified Try It still returns `200 OK` and no longer displays the logged call label.

### 2026-09-21 — Wire API Library Try It through backend executor
- Added a backend `POST /api/test-run` endpoint that executes API Library Try It requests using documented sample payloads and records each run in `api_call_logs`.
- Added `api_call_logs` schema creation during backend startup for portal test tracking.
- Added `apiClient.runApiTest()` and updated the API Library Try It panel to call the backend, show loading state, display status/duration/body, and show the logged call ID.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified Preview > Try It returns `200 OK`, displays the response body, and records a logged call ID.

### 2026-09-21 — Update Upload API navigation icon
- Replaced the raw up-arrow text in the top navigation Upload API button with a lucide upload cloud icon.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Upload API nav button renders one SVG icon and no raw arrow text.

### 2026-09-16 — Correct deployment package seed data files
- Created a corrected non-prod deployment package that includes `src/data` because the backend imports seed APIs and sample payloads from that path.
- This fixes PM2 startup failures where `backend/server.js` could not resolve `D:\Devworkbench\src\data\apis.js` after deployment.

### 2026-09-16 — Create non-prod deployment package
- Created a timestamped deployment zip for the non-prod server in the user's Downloads folder.
- Included the built frontend bundle, IIS `web.config`, backend server files, PM2 ecosystem config, package manifests, environment template, and project documentation.
- Created a corrected deployment zip that also includes `src/data` because the backend imports seed APIs and sample payloads from that folder at runtime.

### 2026-09-16 — Remove bottom Usage insight cards
- Removed the three bottom Usage and KPIs insight cards for Peak test window, Reliability watchlist, and Gateway ready.
- Cleaned up the unused insight card styles and icon import.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the removed cards are no longer visible while Calls and Errors by API and API KPI Detail remain visible.

### 2026-09-16 — Remove API Mix from Usage and KPIs
- Removed the API Mix protocol distribution pie chart from the Usage and KPIs page.
- Cleaned up the now-unused pie chart imports and type distribution data.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the API Mix section is no longer visible while Calls and Errors by API and API KPI Detail remain visible.

### 2026-09-15 — Set Total APIs stat tile to white
- Changed the API Library Total APIs stat tile background from light gray to white while keeping the black border.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Total APIs tile renders with a white background and black border.

### 2026-09-15 — Add API Library search icon
- Added a lucide search icon inside the API Library search field.
- Added scoped search input spacing so the placeholder and typed text start after the icon.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the search icon renders inside the field and search filtering still works.

### 2026-09-15 — Polish Upload API navigation icon
- Replaced the raw up-arrow text in the top navigation Upload API button with a lucide upload cloud icon.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Upload API nav button renders one SVG icon and no raw arrow text.

### 2026-09-15 — Redesign Upload API page
- Reworked the Upload API page into a responsive stepper-style intake flow.
- Added a current-step summary card and clearer step labels for Basic Info, Documentation, Sample Payloads, Tags, and Version.
- Restyled success/error alerts, documentation upload dropzone, uploaded-file preview, and form footer actions with scoped Upload page CSS.
- Preserved existing required-field gating, JSON validation, file validation, and submit behavior.
- Removed the small Catalog Intake eyebrow from the Upload API page header.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified Upload page rendering, required-field validation, step progression after valid basic fields, and no horizontal overflow on narrow width.

### 2026-09-15 — Improve API schema required UI
- Replaced the Schema tab's tiny Yes/No requirement pills with clearer Required/Optional badges.
- Added responsive schema field cards for narrower screens so schema details do not rely on a horizontally scrolling table.
- Tightened API Library card responsiveness so expanded Schema content does not create page-level horizontal overflow.
- Added a black border to the API Library Total APIs stat box.
- Restyled the API Library tag filters as selectable chips so the active selection no longer looks like a regular filled button.
- Cleaned up API Library card padding with scoped header, metadata, footer, and responsive grid spacing.
- Changed the API Test dropdown to open inline within its API card so it no longer blocks the next card's Test button.
- Fixed Test menu switching so clicking another API's Test button opens that API's menu in one click.
- Reworked the inline Test menu into a compact full-width action panel so opening Test no longer creates a large empty area in the API card header.
- Removed the dropdown chevron from the API Library Test button while keeping the test action panel behavior.
- Replaced the blank Change Log tab with example release history entries showing what changed, impact, developer action, owner, and version/date.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Schema tab at desktop and narrow widths, including Required/Optional badges and no horizontal overflow.

### 2026-09-15 — Redesign Usage and KPIs page
- Replaced the basic Usage page with a responsive KPI console for API calls, errors, latency, and consumers.
- Added range controls for 7d, 30d, and 90d usage views.
- Added usage charts for calls/errors by API and API type mix.
- Added searchable API KPI detail with desktop table and responsive cards on narrower screens.
- Added operational insight cards for peak testing windows, reliability watchlist, and gateway readiness.
- Removed Availability and Trend columns from the API KPI detail table and responsive cards.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified desktop table layout, narrow responsive card layout, and API search filtering.

### 2026-09-15 — Redesign User Access page
- Replaced the Admin Access page with a tabbed access governance console.
- Added summary cards for active users, pending requests, privileged users, and expiring access.
- Added tabs for Users, Requests, Roles, API Permissions, and Audit.
- Added a Manage drawer that shows user details, permissions, API access, recent activity, and suspend/reactivate actions.
- Fixed User Access table spacing and the Manage action glitch by adding scoped table, button, and drawer styles.
- Made the Manage drawer responsive so detail cards stack cleanly on narrow browser widths.
- Replaced the Users table with responsive user cards on narrower screens to remove the horizontal scrollbar and clipped Status/Action columns.
- Removed the Last Active column from the User Access list and aligned the Action header to the left.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Access page renders, all five tabs switch, and the Manage drawer opens.

### 2026-09-15 — Redesign Context Tags page
- Replaced the static Context Tags layout with a governance-focused tag dictionary, selected-tag detail panel, tag health metrics, and API tag matrix.
- Simplified the Context Tags page by removing the selected-tag detail panel and API Tag Matrix after review.
- Fixed the Context Tags search input spacing so the search icon no longer overlaps the placeholder text.
- Added inferred domain, lifecycle, technical type, PII, and financial tags so the page remains useful even when API rows do not include complete tag/domain fields.
- Added search and category filtering for the tag dictionary.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Context Tags page renders 15 scanned APIs and the Tag Dictionary, with no Selected Tag or API Tag Matrix sections visible; search input text starts 16px after the icon.

### 2026-09-14 — Remove Try It authentication field
- Removed the visible Authorization/Bearer Token field from the API Library Try It form.
- Kept Environment, Request Body/Path Parameter, Send Request, and response behavior intact.
- Validated with `npm run build`; build passed with only Vite's large-chunk warning.
- Browser-verified the Try It panel no longer shows Authorization or Bearer Token, and still shows Send Request.
