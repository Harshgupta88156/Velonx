# Production conversion plan

DistrictCare is an operations layer over synthetic data. It is not an EHR/EMR, a laboratory results system, or an HAI surveillance tool. These are the gates before any real deployment.

1. **Identity and authorization** – replace demo role selection with real authentication, tenant/facility-scoped authorization and session management.
2. **Database** – move SQLite to PostgreSQL with versioned migrations; keep the transactional invariants (version-guarded approval, reserve-then-dispatch, single credit on receipt).
3. **Stock ledger** – batch-level, FEFO-aware movements instead of per-record quantities.
4. **Ingestion** – source provenance, idempotent loads, and terminology mappings. The data-quality report (`src/lib/data-quality.ts`) reports gaps, staleness and duplicates; it never imputes or silently cleans.
5. **Standards** – the FHIR R4 export (`/api/exports/facilities`) is a facility directory Bundle (Organization and Location) with synthetic identifiers. It is not an ABDM-certified connector or a FHIR server. Clinical exchange needs approved access, consent handling and profile validation.
6. **HAI/IPC** – requires defined cases, clinical review and patient-day/device-day denominators. None exist here, so no rate is shown.
7. **Operations** – access audit, consent, backups/restore tests, monitoring, retention policy, and clinical/operator validation of the risk and forecast policies.
