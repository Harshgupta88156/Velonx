import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ShapPanel from "../src/components/shap-panel";
import Interventions from "../src/components/interventions";
import PlanningPanel from "../src/components/planning-panel";
import { shapMessages } from "../src/components/shap-panel.messages";
import { interventionMessages } from "../src/components/interventions.messages";
import { planningMessages } from "../src/components/planning-panel.messages";
import { dataStandardsMessages } from "../src/components/data-standards.messages";
import { analyze } from "../src/lib/intelligence";
import { createSeed } from "../src/lib/seed";
import type { Attribution } from "../src/lib/types";

const snapshot = createSeed("2026-10-18");
const intelligence = analyze(snapshot);
const attribution: Attribution = {
  baseline: 60,
  prediction: 45,
  contributions: [
    { feature: "lastDay", label: "", input: 50, shap: 5 },
    { feature: "sameWeekdayLastWeek", label: "", input: 30, shap: -20 },
    { feature: "weekMean", label: "", input: 61, shap: 0 },
  ],
};

for (const [name, catalogue] of Object.entries({
  shapMessages,
  interventionMessages,
  planningMessages,
  dataStandardsMessages,
})) {
  test(`${name} has identical, non-empty keys in en, hi and mr`, () => {
    const keys = Object.keys(catalogue.en).sort();
    for (const locale of ["hi", "mr"] as const) {
      assert.deepEqual(Object.keys(catalogue[locale]).sort(), keys);
      for (const key of keys)
        assert.ok(
          String(catalogue[locale][key as keyof typeof catalogue.en]).trim(),
          `${name}.${locale}.${key}`,
        );
    }
  });
}

test("SHAP panel shows baseline, signed contributions and forecast, and colours by sign", () => {
  const html = renderToStaticMarkup(
    <ShapPanel attribution={attribution} locale="en" />,
  );
  assert.match(html, /Average daily demand \(baseline\)/);
  assert.match(html, /\+5/);
  assert.match(html, /-20/);
  assert.match(html, /45 units/);
  assert.equal((html.match(/shap-bar positive/g) ?? []).length, 2);
  assert.equal((html.match(/shap-bar negative/g) ?? []).length, 1);
  assert.doesNotMatch(html, /undefined|NaN/);
});

test("interventions list only flagged facilities and hide controls from non-administrators", () => {
  const flagged = intelligence.risks.filter((r) => r.level !== "stable");
  const props = {
    facilities: snapshot.facilities,
    risks: intelligence.risks,
    interventions: [],
    busy: false,
    locale: "en" as const,
    onSave: () => undefined,
  };
  const admin = renderToStaticMarkup(<Interventions {...props} isAdmin />);
  assert.equal((admin.match(/<li/g) ?? []).length, flagged.length);
  assert.equal(
    (admin.match(/aria-label="Action note/g) ?? []).length,
    flagged.length,
  );
  const officer = renderToStaticMarkup(
    <Interventions {...props} isAdmin={false} />,
  );
  assert.match(officer, /Only the district administrator/);
  assert.doesNotMatch(officer, /<input/);
});

test("planning panel renders resilience inputs, a bounded what-if slider and the timeline in Hindi", () => {
  const html = renderToStaticMarkup(
    <PlanningPanel
      snapshot={snapshot}
      intelligence={intelligence}
      locale="hi"
    />,
  );
  assert.match(html, /जिला सहनशीलता स्कोर/);
  const first = intelligence.recommendations[0];
  assert.match(html, new RegExp(`max="${first.quantity}"`));
  assert.match(html, /role="region"/);
  assert.doesNotMatch(html, /undefined|NaN/);
});

test("activity log renders transfer details and falls back to raw text for unparseable events", async () => {
  const { default: ActivityLog } =
    await import("../src/components/activity-log");
  const tr = (key: string) => key;
  const html = renderToStaticMarkup(
    <ActivityLog
      audit={[
        {
          id: "1",
          at: "2026-10-18T05:00:00Z",
          actor: "administrator",
          action: "transfer.approved",
          entityId: "t1",
          detail: JSON.stringify({
            donor: "sehore",
            recipient: "rampur",
            medicine: "paracetamol",
            quantity: 340,
          }),
        },
        {
          id: "2",
          at: "2026-10-18T06:00:00Z",
          actor: "officer",
          action: "facility.updated",
          entityId: "rampur",
          detail: "not json",
        },
      ]}
      tr={tr as never}
      date={(value) => value}
      fmt={(n) => String(n)}
      facilityName={(id) => id.toUpperCase()}
      medicineName={(id) => id}
    />,
  );
  assert.match(html, /SEHORE → RAMPUR · paracetamol · 340 units/);
  assert.match(html, /not json/);
  assert.match(html, />approved</);
  assert.match(html, />update</);
});
