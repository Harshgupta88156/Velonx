# Verification record

Verified locally on 18 October 2026, macOS, Node v22.23.3, npm10.9.9. These results describe a synthetic prototype and do not establish production readiness or real district accuracy.

| Gate | Observed result |
| --- | --- |
| Calculation, workflow, request, and localization tests | 32/32 pass (`npm test`) |
| Strict TypeScript and generated route types | Pass (`npm run typecheck`) |
| Optimized production build | Pass (`npm run build`); standalone assets prepared |
| Production HTTP integration | 14 checks pass (`npm run test:http`) against owned process and disposable database |
| Concurrent approval | Two simultaneous requests yield201 +409; one reservation/transfer |
| Delivery conservation | Reservation preserves physical stock; dispatch deducts donor; receipt credits once; repeat actions rejected |
| Restart persistence | Production process stopped/restarted against same SQLite file; transfer status, inventory correction and revision retained |
| Browser primary story | Rampur paracetamol review → approval → dispatch → receipt completed |
| Browser result | Rampur usable stock68 →408; forecast coverage2.3 →14 days; scoped critical medicine alerts1 →0; donor reserve retained |
| Hindi context | Switched English →Hindi with review drawer open; same medicine, quantity, recipient and evidence retained |
| Marathi mobile | Patient-flow view rendered at390×844; document width390, navigation drawer worked; facility context retained |
| Browser console | No captured error/warning logs after workflow and locale checks |
| Runtime build exclusions | No SQLite database, .git or environment files found in standalone output search |
| Dependency audit | npm audit reported0 vulnerabilities at verification time |
| Public repository creation | Harshgupta88156/Velonx created public, main branch, via signed-in Chrome account |

Screenshots in `docs/screenshots/` show the local command centre, received inventory and Marathi mobile view. The saved local database retains the browser intervention; it is ignored and never shipped. A fresh clone regenerates the initial shortage scenario.

Release delivery additionally checks source size, tracked exclusions, anonymous access, one remote branch and remote/local commit equality. Results of that release step are reported with the delivered commit. Hosted deployment and hackathon portal submission are separate and are not claimed by these local checks.

Not verified: Docker image build (Docker unavailable on this host), hosted deployment, host restart persistence, real data ingestion, external notifications, production identity, independently measured forecast accuracy, road routes, clinical outcomes, or regulatory compliance. No submission attempt has been consumed by this implementation.
