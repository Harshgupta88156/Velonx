# Demo script (about 4 minutes)

All data is synthetic. Start as the district administrator.

1. **Overview (30 s).** Point out the synthetic-data label, the analysis date and the critical stock alerts. Rampur PHC paracetamol is critical.
2. **Evidence (45 s).** Open Rampur's paracetamol under Pharmacy & stores, "Forecast & validation". Show the demand history, the competing models' validation error, the selected method, and the shortage date. For a series where the ridge model won (for example Sehore paracetamol), show the SHAP panel: baseline plus each factor equals the forecast.
3. **Recommendation (45 s).** Review the proposed 340-unit transfer from Sehore to Rampur. Show the donor safety stock, distance, and before/after cover. In Planning, use the what-if slider to try a smaller quantity and see the donor safety-stock check.
4. **Approve, dispatch, receive (60 s).** Approve (stock is reserved, not moved). In Stock transfers, dispatch as the donor, then receive as the recipient. Show Rampur's stock and critical alert change, and the audit log.
5. **Coordination (30 s).** In Planning, acknowledge a flagged facility with a note, then move it to in progress. Show the resilience score inputs and the 14-day shortage timeline.
6. **Data quality and standards (30 s).** Open Data quality: forecast-eligible series, stale records, and Ichhawar's missing duty record (a gap, not absence). Show the FHIR facility directory download and the boundary statement.
7. **Language (10 s).** Switch to Hindi with a drawer open; context is retained.

Close by stating the limits: synthetic data, an operations layer (not an EHR), demo roles are not authentication, model accuracy is not validated on real data.
