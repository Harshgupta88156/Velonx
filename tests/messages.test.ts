import test from "node:test";
import assert from "node:assert/strict";
import { messages, type MessageKey } from "../src/messages";

const englishKeys = Object.keys(messages.en).sort() as MessageKey[];
const actions: MessageKey[] = [
  "approve",
  "dispatch",
  "receive",
  "cancelTransfer",
  "updateStock",
  "save",
  "cancel",
  "refresh",
  "review",
  "update",
  "diagnosticUpdate",
  "selectFacility",
];
for (const locale of ["en", "hi", "mr"] as const) {
  test(`${locale} dictionary has exact key parity and nonempty values`, () => {
    assert.deepEqual(Object.keys(messages[locale]).sort(), englishKeys);
    for (const key of englishKeys) {
      const value = messages[locale][key];
      assert.equal(typeof value, "string", `${locale}.${key}`);
      assert.ok(value.trim().length > 0, `${locale}.${key} is empty`);
      assert.ok(
        !/^(TODO|TBD|TRANSLATE)$/i.test(value.trim()),
        `${locale}.${key} is a placeholder`,
      );
    }
  });
}
for (const locale of ["hi", "mr"] as const) {
  test(`${locale} operational actions and safety explanations are translated`, () => {
    const critical: MessageKey[] = [
      ...actions,
      "approvalNote",
      "receiptAssumption",
      "stockHelp",
      "empiricalNote",
      "errorSafety",
      "errorPermission",
      "demoRoleNote",
      "protectedMode",
      "noHistory",
    ];
    for (const key of critical) {
      assert.notEqual(
        messages[locale][key],
        messages.en[key],
        `${locale}.${key} falls back to English`,
      );
      assert.match(
        messages[locale][key],
        /[\u0900-\u097f]/,
        `${locale}.${key} lacks native script`,
      );
    }
  });
  test(`${locale} entire dictionary has native-script coverage without English fallback`, () => {
    // Both requested languages use Devanagari. Technical identifiers and proper
    // nouns may remain Latin inside text; every current UI message is localized.
    for (const key of englishKeys) {
      assert.notEqual(
        messages[locale][key],
        messages.en[key],
        `${locale}.${key} is an English fallback`,
      );
      assert.match(
        messages[locale][key],
        /[\u0900-\u097f]/,
        `${locale}.${key} lacks native script`,
      );
    }
  });
}
