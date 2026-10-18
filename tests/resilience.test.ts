import test from "node:test";
import assert from "node:assert/strict";
import { resilience } from "../src/lib/resilience";
import { analyze } from "../src/lib/intelligence";
import { createSeed } from "../src/lib/seed";

test("resilience is a bounded average of four shares; missing attendance is excluded, not zero", () => {
  const s = createSeed("2026-10-18");
  const r = resilience(s, analyze(s));
  assert.equal(r.components.length, 4);
  assert.ok(r.score !== null && r.score >= 0 && r.score <= 100);
  const staffing = r.components.find((c) => c.key === "staffing")!;
  assert.equal(
    staffing.denominator,
    s.facilities.filter((f) => f.attendanceRecorded).length,
  );
  const empty = { ...s, facilities: [], diagnostics: [] };
  const none = resilience(empty, { ...analyze(s), inventory: [] });
  assert.equal(none.score, null);
});
