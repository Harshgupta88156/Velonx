import type { Snapshot } from "./types";

const BASE = "https://districtcare.example/fhir";
type Coding = { system: string; code: string; display: string };
type Meta = { source: string; tag: Coding[] };
export type DirectoryOrganization = {
  resourceType: "Organization";
  id: string;
  meta: Meta;
  active: true;
  type: { coding: Coding[]; text: string }[];
  name: string;
};
export type DirectoryLocation = {
  resourceType: "Location";
  id: string;
  meta: Meta;
  status: "active";
  mode: "instance";
  name: string;
  position: { longitude: number; latitude: number };
  managingOrganization: { reference: string };
};
export type FhirDirectoryBundle = {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  meta: Meta;
  entry: {
    fullUrl: string;
    resource: DirectoryOrganization | DirectoryLocation;
  }[];
};
export class FhirExportError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super("Facility directory contains invalid export data.");
    this.name = "FhirExportError";
  }
}
function meta(): Meta {
  return {
    source: `${BASE}/synthetic-demo`,
    tag: [
      {
        system: `${BASE}/CodeSystem/data-origin`,
        code: "synthetic",
        display: "Synthetic demonstration data",
      },
    ],
  };
}
function instant(value: string): boolean {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  return (
    new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) ===
    value.slice(0, 10)
  );
}

/** Minimal base FHIR R4 directory export, not an ABDM profile or live registry.
 * Field shapes follow https://hl7.org/fhir/R4/organization.html and
 * https://hl7.org/fhir/R4/location.html. Validation here checks this export's
 * input and reference constraints; it is not the official FHIR validator.
 * Source does not establish a building/campus distinction, so optional
 * Location.physicalType is deliberately omitted rather than inventing one.
 */
export function exportFacilityDirectory(
  snapshot: Snapshot,
  generatedAt = new Date().toISOString(),
): FhirDirectoryBundle {
  const issues: { path: string; message: string }[] = [];
  if (snapshot.synthetic !== true)
    issues.push({
      path: "synthetic",
      message: "Only explicitly synthetic demo directories may be exported.",
    });
  if (!instant(generatedAt))
    issues.push({
      path: "generatedAt",
      message: "Expected a valid ISO timestamp including seconds and timezone.",
    });
  const ids = new Set<string>();
  for (const [index, facility] of snapshot.facilities.entries()) {
    const prefix = `facilities[${index}]`;
    if (
      typeof facility.id !== "string" ||
      !/^[A-Za-z0-9.-]{1,64}$/.test(facility.id)
    )
      issues.push({
        path: `${prefix}.id`,
        message:
          "Expected a FHIR-compatible resource ID of 1–64 letters, digits, dots or hyphens.",
      });
    else if (ids.has(facility.id))
      issues.push({
        path: `${prefix}.id`,
        message: "Facility IDs must be unique.",
      });
    ids.add(facility.id);
    if (typeof facility.name !== "string" || facility.name.trim().length === 0)
      issues.push({
        path: `${prefix}.name`,
        message: "A nonempty facility name is required.",
      });
    if (!["PHC", "CHC"].includes(facility.type))
      issues.push({
        path: `${prefix}.type`,
        message: "Expected PHC or CHC local facility type.",
      });
    if (
      typeof facility.lat !== "number" ||
      !Number.isFinite(facility.lat) ||
      facility.lat < -90 ||
      facility.lat > 90
    )
      issues.push({
        path: `${prefix}.lat`,
        message: "Latitude must be finite and between -90 and 90.",
      });
    if (
      typeof facility.lng !== "number" ||
      !Number.isFinite(facility.lng) ||
      facility.lng < -180 ||
      facility.lng > 180
    )
      issues.push({
        path: `${prefix}.lng`,
        message: "Longitude must be finite and between -180 and 180.",
      });
  }
  if (issues.length) throw new FhirExportError(issues);
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: generatedAt,
    meta: meta(),
    entry: snapshot.facilities.flatMap((facility) => {
      const organizationUrl = `${BASE}/Organization/${facility.id}`;
      const display =
        facility.type === "PHC"
          ? "Primary Health Centre"
          : "Community Health Centre";
      const organization: DirectoryOrganization = {
        resourceType: "Organization",
        id: facility.id,
        meta: meta(),
        active: true,
        name: facility.name,
        type: [
          {
            coding: [
              {
                system: `${BASE}/CodeSystem/facility-type`,
                code: facility.type,
                display,
              },
            ],
            text: display,
          },
        ],
      };
      const location: DirectoryLocation = {
        resourceType: "Location",
        id: facility.id,
        meta: meta(),
        status: "active",
        mode: "instance",
        name: facility.name,
        position: { latitude: facility.lat, longitude: facility.lng },
        managingOrganization: { reference: organizationUrl },
      };
      return [
        { fullUrl: organizationUrl, resource: organization },
        { fullUrl: `${BASE}/Location/${facility.id}`, resource: location },
      ];
    }),
  };
}
