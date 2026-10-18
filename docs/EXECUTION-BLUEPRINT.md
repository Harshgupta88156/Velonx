# DistrictCare: seven-hour execution blueprint

## 1. Product strategy

Positioning: a district operations command centre that turns a medicine shortage into an explainable, auditable intervention. Primary audience is the district administrator; medical officers and inventory managers use the same facility context with restricted workflow actions. The hero demonstration follows Rampur paracetamol from detection to confirmed receipt. Differentiators are evidence-linked forecasts, donor-safe redistribution, pending-stock accounting, missing-data honesty, and locale changes that preserve context.

Scope priority: P0 complete persisted shortage workflow and district/facility visibility; P1 all five operations views and English/Hindi; P2 Marathi, richer comparisons and map. Exclude LLM chat, real clinical data, external integrations, deep learning, route optimization, and unrelated patient-management features. No feature count can replace the working primary story.

## 2. Final stack

One Next.js App Router/React/TypeScript application; plain CSS design tokens, Lucide icons, Recharts, next-intl; Zod validation; better-sqlite3 transactions; pure TypeScript statistical forecasting. Node 22 LTS. Lock resolved mutually compatible stable packages in package-lock.json. One Docker-deployable Node process with a durable SQLite volume. No separate forecasting service or paid AI API.

## 3. Roadmap and dependency checkpoints

Times are elapsed from implementation start, not a promised wall-clock completion time.

| Window    | Owner           | Dependencies           | Deliverable and acceptance gate                                                                            |
| --------- | --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Integrator      | Empty workspace, brief | Shared domain types, bounded scope, theme, seed assumptions, one public main branch                        |
| 0:25–1:15 | Foundation + UI | Types                  | Server boots, seeded database survives restart, nav skeleton and consistent API snapshot                   |
| 0:40–2:10 | Intelligence    | Types + fixtures       | Past-only forecast validation, shortage calculations, safe shared allocation budgets, focused tests        |
| 1:15–2:45 | Foundation + UI | Database/API           | Inventory, beds, footfall, attendance, diagnostics read/update paths, audit events                         |
| 2:10–3:40 | Integrator + QA | Engine + database      | Approval/reservation/dispatch/receive transaction workflow, stale/repeat/role/concurrency checks           |
| 2:45–4:20 | UI              | Operational APIs       | Polished command centre, evidence drawer, mobile interactions, complete English/Hindi critical paths       |
| 4:20–5:00 | Integrator      | Integrated interface   | Browser primary demo, language context, empty/error states, optional Marathi if core passes                |
| 5:00–5:30 | All             | Complete primary story | Mandatory feature freeze; only fixes, tests, documentation and release                                     |
| 5:30–6:10 | QA + Integrator | Frozen source          | Clean install/build, production server, persistence/concurrent approval probes, source-size checks         |
| 6:10–6:35 | Integrator      | Release candidate      | Docker deployment if access/storage available; live workflow/restart checks before claiming hosted success |
| 6:35–7:00 | Integrator      | Verified repository    | Final source push, one remote branch, public clone/size checks, demo script; 25-minute recovery buffer     |

Commit/push passing milestones to main, preserve the last runnable state, and record what passed. Do not spend hackathon portal attempts on unverified candidates. Portal submission requires the actual destination/rules and remains separate from source delivery.

## 4. Agent orchestration

Three execution owners fit the environment without separate branches:

- **Integrator/foundation:** package/config, shared `types.ts`, SQLite schema/seed, all route handlers/services, security boundaries, docs, GitHub synchronization. Sole owner of shared contracts and repository operations.
- **Product interface:** page/layout/CSS, `components/`, `messages/`. Reads shared types, calls documented APIs, never mutates database directly. Owns language coverage, responsive states, charts and evidence review.
- **Intelligence + QA:** `intelligence.ts`, consequential tests. Pure `analyze(Snapshot): Intelligence` and `forecast(HistoryPoint[], horizon, asOf): Forecast`. No browser or database dependencies in the engine. After engine completion, own isolated database/API tests.

Freeze types before parallel edits. Communicate contract changes to affected owners before applying. Avoid concurrent writes to package files, shared types or the same module. All edits integrate directly into main; never create extra branches/worktrees with branches. If integration conflicts occur, pause edits to the conflicting file, let the integrator reconcile, then run all checks.

Dependency graph: types → seed/schema + engine + interface skeleton (independent) → APIs and fresh snapshots → approval workflow → integrated UI → browser verification → production build → source push/compliance. Forecast tests and translated copy can proceed while API work runs. Deployment smoke can begin after the foundation is runnable, but durable workflow claims wait for persistence proof.

## 5. Technical blueprint

Canonical models and exact contracts live in `src/lib/types.ts`. Structured SQLite inventory/transfers enforce foreign keys, nonnegative integer stock and legal status values. History/facility audits use typed JSON. All forecasts and dashboard aggregates derive from one snapshot. API structure is documented in README. Mutations are Zod-validated, same-origin checked, role constrained, audited and transactional. Optimistic inventory versions stop stale reviews. Immediate SQLite transactions serialize approval budgets. Persist an initialization analysis date for reproducible synthetic forecasts. Never reseed existing operational data on startup.

Acceptance: predictions respond to underlying history, alerts respond to stock updates, pending transfers cannot overfill needs, donors retain conservative reserve, receipt is exactly once, dashboard and tables reconcile, invalid requests fail before writes, and restart retains changes. Tests cover zero stock, insufficient history, absent donors, missing attendance, zero beds, demand spikes, diagnostic uncertainty and invalid quantities.

## 6. Product design blueprint

Visual identity: DistrictCare wordmark and compact medical-inspired V; navy navigation rail, warm off-white canvas, teal/emerald action color, amber for warnings and red for urgent scarcity. Use restrained borders, clear typographic hierarchy, compact evidence cards and readable tables. Status always has text/icon, never color alone. External fonts/maps are optional; core workflow must function without them.

Screens: command centre, facilities, medicines, footfall, beds, doctors, diagnostics, transfers, activity. Shared facility context and role strip prevent duplicated interfaces. Filters and clickable facility rows connect summary to supporting records. Hero dashboard prioritizes urgent interventions, facilities at risk, patient volume, beds, diagnostic availability and a coordinate-based district schematic. Forecast chart separates observed and projected values and explains empirical bands. Recommendation drawer compares before/after coverage, quantity, distance, reserve and assumptions before approval. Transfer screen shows physical state and next responsible facility. Inventory corrections require a reason. Operational forms validate beds and staffing bounds. Show loading, empty, stale, error and success states.

Accessibility: keyboard-operable controls; labelled forms; focus-visible states; semantic sections/tables; dialog focus management; readable chart summaries; mobile nav; reduced motion. English and Hindi cover navigation, labels, evidence, validation, actions and operational instructions. Language switching must retain selected facility, view and open review. Data identifiers and medicine catalogue names can remain canonical proper technical names, with clear localized surrounding copy.

## 7. Risk and recovery

| Risk                             | Detection                              | Recovery preserving demonstration                                                                                                 |
| -------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| libSQL native module fails       | Foundation cannot load native module   | Use supported Node LTS/prebuilt target; time-box to15 minutes; use @libsql/client with the same SQLite contract only if necessary |
| Forecast library incompatibility | Build/import failure                   | Pure TypeScript statistical baselines already avoid Python/native forecast service                                                |
| Hosted disk unavailable          | Mutation lost on restart               | Retain local durable demo and provide Docker instructions; do not advertise an ephemeral host as persistent                       |
| Missing environment              | Startup/auth fails                     | Local SQLite + explicit synthetic demo default; protected mode denies writes if key missing                                       |
| Concurrent/double approval       | Repeated API creates excess commitment | Immediate transaction + recompute + versions + pending inbound budget; regression test                                            |
| UI integration conflict          | Typecheck/API shape mismatch           | Integrator controls contract; reconcile module, run focused checks, preserve last working main                                    |
| Time overrun                     | P0 workflow not passing by3:40         | Freeze decorative/third-language extras; complete core flow and mandatory English/Hindi                                           |
| Repository push identity differs | Browser owner != CLI identity          | Keep source safe locally; use approved repository-scoped authentication or user-operated upload/push; never silently change owner |
| Unrealistic AI claim             | Unsupported percentage/probability     | Show model, assumptions, validation error and no-data state; state synthetic evaluation limits                                    |

## 8. Execution-ready Antigravity handoff

Use `ANTIGRAVITY-PROMPT.md` at repository root. It binds scope to current code and directs implementation/fixes, verification and one-branch delivery without another planning session.

## 9. Submission gate

See `docs/SUBMISSION-CHECKLIST.md`. Every claimed result needs observed evidence. Deployment is optional evidence only when actually successful. GitHub source delivery does not itself prove hosting or portal submission.
