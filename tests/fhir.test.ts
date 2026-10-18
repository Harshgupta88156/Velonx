import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportFacilityDirectory, FhirExportError } from "../src/lib/fhir";
import { createSeed } from "../src/lib/seed";
import { getDb, loadSnapshot } from "../src/lib/db";
import { GET } from "../src/app/api/exports/facilities/route";

const timestamp = "2026-10-18T12:00:00Z";
test("R4 directory export has unique stable fullUrls and resolving organization references", async () => {
  const data = createSeed("2026-10-18");
  const original = structuredClone(data);
  const bundle = exportFacilityDirectory(data, timestamp);
  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.type, "collection");
  assert.equal(bundle.timestamp, timestamp);
  assert.equal(bundle.entry.length, 16);
  const urls = new Set(bundle.entry.map((entry) => entry.fullUrl));
  assert.equal(urls.size, bundle.entry.length);
  for (const entry of bundle.entry) {
    assert.equal(
      entry.fullUrl,
      `https://districtcare.example/fhir/${entry.resource.resourceType}/${entry.resource.id}`,
    );
    assert.equal(entry.resource.meta.tag[0].code, "synthetic");
    if (entry.resource.resourceType === "Location") {
      assert.equal(entry.resource.status, "active");
      assert.equal(entry.resource.mode, "instance");
      assert.ok(urls.has(entry.resource.managingOrganization.reference));
      const reference = entry.resource.managingOrganization.reference;
      const referenced = bundle.entry.find(
        (other) => other.fullUrl === reference,
      )!;
      assert.equal(referenced.resource.resourceType, "Organization");
      assert.equal(referenced.resource.id, entry.resource.id);
    } else {
      assert.equal(entry.resource.active, true);
      assert.ok(entry.resource.name);
      assert.match(
        entry.resource.type[0].coding[0].system,
        /districtcare\.example/,
      );
    }
  }
  assert.deepEqual(exportFacilityDirectory(data, timestamp), bundle);
  assert.deepEqual(data, original);
});

test("only directory fields are exported with explicit synthetic tags", async () => {
  const bundle = exportFacilityDirectory(createSeed("2026-10-18"), timestamp);
  const serialized = JSON.stringify(bundle);
  for (const forbidden of [
    "Patient",
    "Encounter",
    "Observation",
    "ABHA",
    "HFR",
    "patientsToday",
    "presentDoctors",
    "scheduledDoctors",
    "occupied",
    "history",
    "transfers",
    "identifier",
  ])
    assert.ok(!serialized.includes(`"${forbidden}"`), forbidden);
  assert.equal(
    bundle.meta.tag[0].system,
    "https://districtcare.example/fhir/CodeSystem/data-origin",
  );
  assert.equal(
    bundle.meta.source,
    "https://districtcare.example/fhir/synthetic-demo",
  );
  assert.ok(
    bundle.entry.every(
      (entry) => entry.resource.meta.source === bundle.meta.source,
    ),
  );
});

test("coordinates reject nonfinite, wrong-type, out-of-range values; zero/boundaries remain valid", async () => {
  for (const [key, value] of [
    ["lat", NaN],
    ["lng", Infinity],
    ["lat", 91],
    ["lat", -91],
    ["lng", 181],
    ["lng", -181],
    ["lat", null],
    ["lng", "77"],
  ] as const) {
    const data = createSeed("2026-10-18");
    Object.assign(data.facilities[0], { [key]: value });
    assert.throws(
      () => exportFacilityDirectory(data, timestamp),
      (error: unknown) =>
        error instanceof FhirExportError &&
        error.issues.some((issue) => issue.path === `facilities[0].${key}`),
    );
  }
  for (const [lat, lng] of [
    [0, 0],
    [90, 180],
    [-90, -180],
  ]) {
    const data = createSeed("2026-10-18");
    Object.assign(data.facilities[0], { lat, lng });
    const location = exportFacilityDirectory(data, timestamp).entry[1].resource;
    assert.equal(location.resourceType, "Location");
    if (location.resourceType === "Location")
      assert.deepEqual(location.position, { latitude: lat, longitude: lng });
  }
});

test("invalid IDs, duplicate facilities, missing names, non-synthetic sources and bad instants fail structurally", async () => {
  for (const mutate of [
    (data: ReturnType<typeof createSeed>) => {
      data.facilities[0].id = "invalid/id";
    },
    (data: ReturnType<typeof createSeed>) => {
      data.facilities[0].id = "a".repeat(65);
    },
    (data: ReturnType<typeof createSeed>) => {
      data.facilities.push(data.facilities[0]);
    },
    (data: ReturnType<typeof createSeed>) => {
      data.facilities[0].name = " ";
    },
    (data: ReturnType<typeof createSeed>) => {
      Object.assign(data, { synthetic: false });
    },
  ]) {
    const data = createSeed("2026-10-18");
    mutate(data);
    assert.throws(
      () => exportFacilityDirectory(data, timestamp),
      FhirExportError,
    );
  }
  for (const invalid of [
    "bad",
    "2026-10-18",
    "2026-02-30T00:00:00Z",
    "2026-10-18T24:00:00Z",
  ])
    assert.throws(
      () => exportFacilityDirectory(createSeed("2026-10-18"), invalid),
      FhirExportError,
    );
});

test("download route scopes facilities, rejects bad scope and leaves stored data unchanged", async () => {
  const previousPath = process.env.DATABASE_PATH;
  const directory = mkdtempSync(join(tmpdir(), "districtcare-fhir-"));
  process.env.DATABASE_PATH = join(directory, "test.sqlite");
  try {
    const before = await loadSnapshot();
    const scope = before.facilities[0].id;
    const response = await GET(
      new Request(
        `http://localhost/api/exports/facilities?facilityId=${scope}`,
      ),
    );
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("Content-Type")!,
      /application\/fhir\+json/,
    );
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("Content-Disposition"),
      'attachment; filename="districtcare-facilities.fhir.json"',
    );
    const bundle = await response.json();
    assert.equal(bundle.entry.length, 2);
    assert.ok(
      bundle.entry.every(
        (entry: { resource: { id: string } }) => entry.resource.id === scope,
      ),
    );
    const districtResponse = await GET(
      new Request("http://localhost/api/exports/facilities"),
    );
    assert.equal(
      (await districtResponse.json()).entry.length,
      before.facilities.length * 2,
    );
    for (const query of [
      "?facilityId=",
      "?facilityId=missing",
      "?facilityId=rampur&facilityId=sehore",
      "?unexpected=true",
    ]) {
      const invalid = await GET(
        new Request(`http://localhost/api/exports/facilities${query}`),
      );
      assert.equal(invalid.status, 400);
      assert.equal((await invalid.json()).resourceType, "OperationOutcome");
    }
    assert.deepEqual(await loadSnapshot(), before);
    const facility = before.facilities[0];
    await (
      await getDb()
    )
      .prepare("UPDATE facilities SET body=? WHERE id=?")
      .run(JSON.stringify({ ...facility, lat: 200 }), facility.id);
    const invalidSource = await GET(
      new Request(
        `http://localhost/api/exports/facilities?facilityId=${scope}`,
      ),
    );
    assert.equal(invalidSource.status, 422);
    const outcome = await invalidSource.json();
    assert.equal(outcome.resourceType, "OperationOutcome");
    assert.equal(outcome.issue[0].code, "invalid");
  } finally {
    (await getDb()).close();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
