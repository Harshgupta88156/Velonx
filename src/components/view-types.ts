import type {
  Diagnostic,
  Facility,
  Intelligence,
  Inventory,
  Snapshot,
} from "@/lib/types";
import type { QualityReport } from "@/lib/data-quality";
import type { Intervention } from "@/lib/db";

export type View =
  | "command"
  | "facilities"
  | "inventory"
  | "flow"
  | "beds"
  | "doctors"
  | "diagnostics"
  | "transfers"
  | "activity"
  | "planning"
  | "quality";
export type Data = {
  snapshot: Snapshot;
  intelligence: Intelligence;
  quality: QualityReport;
  interventions: Intervention[];
  demoMode: boolean;
};
export type Editor =
  | { kind: "inventory"; record: Inventory }
  | { kind: "beds" | "doctors" | "flow"; facility: Facility }
  | { kind: "diagnostics"; record: Diagnostic };
