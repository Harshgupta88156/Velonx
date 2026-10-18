# Intelligence and operational assumptions

## Data generation

Seed PRNG: a fixed 32-bit linear congruential generator initialized to 20261018. Eight fictional PHCs/CHCs have 84 daily footfall observations and each has 84 observations per medicine. The time axis ends the day before database initialization. Demand combines facility size, weekday factors, bounded random variation, and a modest facility-specific trend. These are designed scenarios, not fitted epidemiological patterns. Explicit anomalies include Rampur's paracetamol shortage, Ashta's ORS shortage, a zero-saline inventory, an expired batch, missing attendance, and diagnostic equipment/reagent gaps. See `src/lib/seed.ts` for the full generator.

## Forecast pipeline

1. Ignore observations with invalid dates or non-finite/negative values. Ignore dates after the supplied analysis date. Duplicate dates use their last valid supplied observation.
2. Sort dates and take the latest consecutive daily suffix. A history gap is not filled with zero.
3. Require 21 consecutive dates and a latest date at the analysis day or preceding day. Otherwise return `insufficient-data` with no predictions or invented accuracy.
4. Evaluate weekly seasonal naive, seven-day trailing mean, and simple exponential smoothing with fixed alpha 0.3. Fit separately at each of the final 14 one-step origins using only its preceding observations.
5. Select the smallest shared-origin mean absolute error (MAE). Ties prefer seasonal naive. Refit the selected method to all available observations and forecast seven displayed days (14 internally for replenishment).

Seasonal naive repeats the last observed week; moving mean projects the average of the last seven dates; smoothing uses `level[t] = .3*y[t] + .7*level[t-1]` and projects the last level. Clamp predictions and lower envelopes to zero. The displayed MAE is model-selection validation, not independently held-out evaluation.

Error radius = the sorted 14 absolute validation errors at index `ceil(.9*14)-1`. Every forecast point shows central ± radius. This is an empirical one-step error envelope. It is not a calibrated 90% confidence interval, a multi-day coverage guarantee, or a stock-out probability. No synthetic confidence percentage is manufactured.

## Stock and redistribution

Usable available units = 0 when expired, otherwise `max(0, physical - reserved)`. Daily demand is the mean of the selected 14-day central forecast. Days remaining = usable available / daily demand when demand is positive and known; otherwise null. Predicted shortage date = analysis date + floor(days remaining). This average-rate date is approximate, not an exact cumulative depletion simulation.

Critical stock = zero available, below minimum, or known coverage under three days. Warning = below conservative seven-day projected demand. Unknown history remains disclosed and cannot finance a donation. No demand of zero is assumed simply because history is missing.

Replenishment target = max(configured minimum, 14-day central total, 7-day upper-envelope total). Pending approved/dispatched inbound quantities reduce outstanding requested replenishment. They do not change current physical availability or days remaining.

Process recipients by critical before warning, then coverage and stable ID. For each recipient, sort same-medicine donors by Haversine distance then stable ID. Feasible donor:

- Same medicine, different facility, history adequate, usable unexpired stock.
- Straight-line distance <=60 km. Real travel time and road feasibility remain unverified.
- Expiry strictly later than analysis day +15 days (next-day arrival +14 days coverage assumption).
- Donation leaves at least `ceil(max(minimum, sum(next 7 upper estimates)))` usable units.

Transfer = floor(min(outstanding recipient target, donor available - safety)). A shared budget prevents suggested transfers spending the same donor units twice; suggested inbound stock cannot fund onward transfers. This is a deterministic constrained greedy heuristic. It does not establish global optimality or optimize clinically appropriate prescribing.

## Persisted interventions

Approval obtains an immediate SQLite transaction, reads a fresh snapshot, recomputes the whole allocation set, checks submitted donor/recipient versions, and reserves the approved quantity. Both inventory versions advance. Dispatch is permitted only for an approved transfer and deducts donor physical/reserved quantities after a fresh safety check. Receipt is permitted only after dispatch, credits destination stock, and moves status to received once. Cancellation releases an approved reservation; dispatch cannot be cancelled through this simplified workflow. All mutations append audit records and increment revision.

The active inventory model aggregates a facility-medicine pair. When incoming valid stock arrives at an expired destination batch, old expired quantity is isolated in an audit event and excluded from the active balance. When valid batches mix, the earlier expiry applies conservatively to the whole aggregate. Full lot accounting and quarantined physical storage management require a future batch ledger.

## Facility readiness evidence

Weights: critical medicine scarcity 35, otherwise warning 20; beds >=85% occupied 15 or saturation 25; patient load above configured daily capacity 20; verified doctor schedule gap 10; current known diagnostic disruption 10. The resulting sum is critical >=50, watch >=20, stable below20. These are prototype policy thresholds, not validated clinical or regulatory standards.

Missing attendance never implies absenteeism. Diagnostic records older than 48 hours, invalid/future records, unknown status, missing history, zero-bed capacity, and absent data reduce reported completeness or add data-quality explanations. They do not alone create a verified performance allegation. A facility can have operational scarcity because it serves high demand; the UI should describe intervention needs, not rank staff competence.

## Evaluation boundary

Unit and transaction tests establish implementation behavior on fixtures. They do not establish real district forecast accuracy, safety of clinical decisions, route feasibility, production security, regulatory compliance, multi-instance persistence, or deployment. Record actual execution results separately in `VERIFICATION.md`.
