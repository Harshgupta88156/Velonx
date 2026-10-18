# Final release gates

Check only after obtaining current evidence. Actual results belong in VERIFICATION.md.

- [ ] Primary story completes in browser: detect → explain → approve → dispatch → receive → stock/alert/audit change.
- [ ] All five operational domains reflect underlying records and allow the supported edits.
- [ ] Forecast validation uses only past data; empirical envelope correctly described.
- [ ] No-history, no-donor, expired-stock, zero-bed, missing-attendance and diagnostic-unknown states are honest.
- [ ] Donors retain conservative reserve, concurrent approvals do not overspend, pending inbound does not duplicate need.
- [ ] Invalid/stale/repeated actions reject atomically; role/facility boundaries tested.
- [ ] English/Hindi workflows work and preserve context when switching; additional language checked if advertised.
- [ ] Keyboard, mobile and error/loading/empty states inspected.
- [ ] npm ci, tests, typecheck, build, production startup and HTTP workflow pass in clean clone.
- [ ] Persisted interventions survive server restart.
- [ ] README includes setup, architecture, methodology, synthetic disclosure, limitations and demo script.
- [ ] No dependencies, build artifacts, database, secrets or environment values tracked.
- [ ] Tracked source, source archive and Git history comfortably below10 MB.
- [ ] Public repository anonymously accessible; exactly one local and remote branch: main.
- [ ] Local HEAD equals pushed remote main; working tree clean.
- [ ] Hosting claimed only if live workflow and restart persistence verified; otherwise mark not deployed.
- [ ] Actual hackathon portal destination/rules identified before submission.
- [ ] Submission attempts recorded externally; maximum3, no speculative attempts.
