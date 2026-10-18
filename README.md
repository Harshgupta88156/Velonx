# DistrictCare

District healthcare operations for PHCs, CHCs, and district administrators: stock, activity, capacity, data quality and transfers in one place.

DistrictCare turns fragmented stock, bed, staffing, footfall, and diagnostic records into a prioritized operations view. Its central workflow is **detect → forecast → explain → approve → dispatch → receive → verify**.

> Hackathon demonstration. Every facility, operational record, and time series is synthetic. Coordinates approximate a fictional district around Sehore. No patient identities, clinical diagnoses, real government feeds, or confidential information are used. This prototype provides operational decision support, not clinical advice or regulatory compliance certification.

## Run locally

Requirements: Node.js 22 LTS, npm, and a writable local filesystem. Native SQLite prebuilt binaries are used where supported; a C++ toolchain may be needed on other platforms.

```sh
git clone https://github.com/Harshgupta88156/Velonx.git
cd Velonx
npm ci
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open http://localhost:3000. The first database access also seeds automatically. Re-running the seed preserves existing records. All quantities are medicine catalogue units (tablets, capsules, sachets, bottles). `DATABASE_PATH` defaults to `./data/districtcare.db`. The seed script uses process environment/defaults; Next.js loads `.env.local` for the server. Export a custom `DATABASE_PATH` when running CLI scripts against a non-default database.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Run `npm run test:http` after building to exercise the real production API against an isolated temporary database, including concurrent approval and restart persistence. See [verification evidence](docs/VERIFICATION.md).

The database, dependency folders, environment files, and build artifacts are ignored. A clean clone regenerates the deterministic dataset relative to its initialization date. Preserve `data/` to retain interventions across restarts. For a fresh demo, stop the server and move the database directory to a backup location, then start again.

## What works

- District command centre with facility filtering, operational risk evidence, and geographic facility comparison.
- Eight fictional facilities, six medicines, 48 inventory rows, 32 diagnostic audits, and 84 daily observations per consumption/footfall series.
- Seven-day demand forecasts selected by time-aware validation among three statistical baselines and a ridge-regression model on lag features. Where the ridge model wins, an exact **SHAP** breakdown shows how yesterday's demand, the same weekday last week and the 7-day mean contributed.
- Facility intervention tracking: administrator acknowledgement, in-progress and resolved states with notes, audited and persisted.
- District resilience score (transparent four-part average), a what-if transfer preview with donor safety check, and a 14-day shortage timeline with act-by dates.
- Data-quality view: forecast eligibility, stale records, missing attendance, duplicate/invalid observations, metric definitions, and a glossary (OPD, EHR, ADT, LIS, HAI and more) that states the app is an operations layer, not an EHR.
- FHIR R4 facility directory export (`/api/exports/facilities`): Organization and Location resources with synthetic identifiers. Not an ABDM-certified connector or a FHIR server.
- Medicine availability, expiry awareness, reservations, predicted shortage dates, and replenishment targets.
- Distance-constrained redistribution suggestions that retain donor safety stock and account for pending inbound transfers.
- Human approval, donor dispatch, recipient receipt, cancellation before dispatch, and auditable inventory adjustment.
- Bed, patient-load, attendance, and diagnostic readiness views with editable operational records.
- English, Hindi, and Marathi interface dictionaries; locale changes retain workflow context.
- Durable SQLite records and server-side validation. Refreshing a page does not reset interventions.

## Four-minute demonstration

1. Start as the demo district administrator. Point out the synthetic-data and analysis-date labels.
2. Open Rampur PHC's paracetamol shortage. Inspect historical consumption, selected forecasting method, validation MAE, projected demand, and days of usable stock.
3. Review a proposed transfer from nearby surplus stock. Compare donor safety reserve, distance, transfer quantity, and recipient coverage before/after. These are planning assumptions, not travel or clinical guarantees.
4. Approve once. Donor available stock decreases through a reservation; physical stock has not moved. The recipient remains at risk until delivery.
5. Open Transfers, dispatch as the donor role/facility, then receive as the recipient. Alternatively use the administrator for the whole demo. Inspect the updated inventory and audit trail. Repeating a state-changing action is rejected.
6. Switch to Hindi with the facility/workflow still selected. Refresh the page and verify the transfer persists. Show missing attendance at Ichhawar as a missing record, not absenteeism.

## Architecture

One TypeScript application: Next.js App Router + React; Recharts; Lucide; next-intl; Zod; better-sqlite3. Pure forecasting and allocation code executes on the server in the same runtime. No LLM key, Python service, external map service, or paid AI endpoint is required. The ML is a small ridge regression implemented in TypeScript.

```text
src/app/              pages, layout, styles, Node.js route handlers
src/components/       interactive operations interface
src/messages/         localized operational copy
src/lib/types.ts      shared domain and API contracts
src/lib/seed.ts       reproducible synthetic district generator
src/lib/db.ts         SQLite schema, lazy initialization, snapshots, audit persistence
src/lib/intelligence.ts  pure forecasting (incl. ridge + SHAP), constrained allocation, risk evidence
src/lib/data-quality.ts  source quality report (no imputation)
src/lib/resilience.ts  district resilience score
src/lib/fhir.ts       FHIR R4 facility directory export
src/lib/service.ts    validated transactional operational workflows
src/lib/http.ts       request controls and structured errors
tests/                consequential calculation and workflow tests
docs/                 execution blueprint, methodology, delivery evidence
```

SQLite tables: `interventions`, `facilities`, `medicines`, `inventory`, `footfall`, `diagnostics`, `transfers`, `audit`, `meta`. Inventory uses integer constraints, foreign keys, nonnegative stock, reservations no greater than physical stock, and optimistic versions. Facility/diagnostic records and history arrays are typed JSON; inventory and transfers use structured columns. `meta` retains the demonstration analysis date and immutable shipment expiry at approval.

| API | Purpose |
| --- | --- |
| `GET /api/snapshot` | Consistent persisted snapshot and derived intelligence; no cache |
| `GET /api/health` | Database readiness |
| `POST /api/transfers` | Recompute evidence and reserve an approved recommendation |
| `POST /api/transfers/:id` | Dispatch, receive, or cancel an approved shipment |
| `POST /api/inventory/:id` | Versioned stock correction with required reason |
| `POST /api/operations` | Update beds, arrivals, recorded staffing, or diagnostic status |
| `POST /api/interventions` | Administrator records acknowledged / in-progress / resolved with a note |
| `GET /api/exports/facilities` | FHIR R4 Bundle of Organization and Location resources (optional `facilityId`) |

## Forecasting methodology

See [methodology](docs/METHODOLOGY.md) for exact formulas and limitations. Candidates are weekly seasonal naive, trailing seven-day mean, exponential smoothing (alpha 0.3), and, from 35 observations, a ridge regression (lambda 1, standardized features: yesterday, same weekday last week, 7-day mean; closed-form fit; multi-day forecasts are recursive). For the ridge model, SHAP values are exact (`w_j * (x_j - mean_j)`, independent-feature form) and sum to forecast minus baseline. They explain the model, not clinical causes. All compete on the same 14 rolling one-step validation targets using only prior observations. Lowest MAE wins; seasonal naive wins ties. At least 21 consecutive observations are required. Missing days, negative/non-finite values, stale histories, and future observations are handled explicitly. No forecast is fabricated for inadequate history.

The chart's error envelope is ± the empirical 90th percentile absolute one-step validation error. It is **not a calibrated confidence interval** and does not establish multi-day statistical coverage. MAE used for model selection is not an independent test-set accuracy claim. Medicine shortage estimates use forecast average demand; actual consumption and timing may differ.

## Resource optimization and workflow

A deterministic urgency-first, nearest-feasible-donor heuristic allocates deficits. It is a constrained heuristic, not a globally optimal min-cost solution. Donors retain the larger of their configured minimum and conservative seven-day projected demand. Expired, inadequately observed, distant (>60 km straight-line), or soon-expiring donor stock is excluded. Suggested allocations share budgets; pending approved/dispatched inbound shipments reduce further requests.

Approval re-derives recommendations under an immediate SQLite transaction, checks donor and recipient versions, reserves stock, and appends audit evidence. Dispatch deducts physical donor stock and its reservation after rechecking donor safety. Receipt credits the recipient exactly once. Cancellation is allowed only before dispatch. Actual delivery confirmation is an explicit action in the synthetic demo.

One active aggregate medicine record is modeled per facility. Receipt uses the earlier valid expiry when mixing batches. An expired destination batch is excluded and isolated into an audit record before receiving valid stock. Full batch-level FEFO management, cold-chain logistics, controlled-drug rules, and real transit reconciliation are future work.

## Trust and access boundaries

`DEMO_MODE=true` (default) intentionally allows visitors to exercise synthetic roles. The role selector demonstrates server-enforced workflow permissions and facility scope; it is not identity verification. The same synthetic dataset is shared among visitors on one instance. Do not load real operational or patient data into this deployment.

With `DEMO_MODE=false`, mutation APIs require the server-only `ADMIN_KEY` via `x-admin-key`; the browser is read-only. A shared API key is not a production identity system. Production needs authenticated sessions, tenant boundaries, facility memberships, detailed permissions, rate limiting, tamper-resistant audit retention, backups, and operator security review. Cross-origin browser mutations are rejected, payloads validated, secrets excluded, and errors do not expose database internals. All reads expose synthetic demonstration records by design.

## Deployment

The supported deployment shape is **one Node.js instance with a persistent SQLite volume**. Serverless ephemeral filesystems and horizontally scaled independent SQLite copies are unsuitable for durable writes.

```sh
docker build -t districtcare .
docker volume create districtcare-data
docker run --rm -p 3000:3000 -v districtcare-data:/app/data districtcare
```

The volume must be writable by UID 1001. For a host such as Render, use the Dockerfile, port 3000, a persistent disk mounted at `/app/data`, and a health check at `/api/health`. Check the host's current plans before provisioning paid storage. Do not claim deployment until a live URL passes the primary workflow and retains records after restart. No live deployment URL is claimed by these setup instructions.

## Submission constraints

Public repository: [Harshgupta88156/Velonx](https://github.com/Harshgupta88156/Velonx). Keep exactly one branch, `main`, and source under 10 MB. `npm run check:repo` validates tracked exclusions, local branch count, tracked bytes, and source archive size. Also verify remote heads, anonymous public access, a clean clone/install/build, and commit synchronization. Submission attempts remain user-controlled; this project does not automatically submit to an unspecified hackathon portal.

## Limitations and next steps

This is a single-district synthetic prototype. The analysis date stays at database initialization to keep the recorded scenario reproducible; API refreshes show operational edits, not ingestion from hospitals. Travel distances are straight-line estimates, and next-day transfer arrival is assumed. Risk weights express operational readiness and scarcity, not staff performance or clinical outcomes. A zero-bed centre or missing record is a data/coverage condition, not automatic poor performance. No external feeds, SMS, clinical recommendations, production authentication, or guaranteed uptime are claimed. Future work includes verified data connectors, batch and expiry tracking, calibrated horizon-specific forecasts, route-aware constraints, authenticated facility users, and independent real-world evaluation.

Official references: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [next-intl](https://next-intl.dev/docs/getting-started/app-router), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Render persistent disks](https://render.com/docs/disks).
