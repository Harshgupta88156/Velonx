export type Locale = "en" | "hi" | "mr";
export type Role = "administrator" | "officer" | "inventory";
export type HistoryPoint = { date: string; value: number };
export type Facility = {
  id: string;
  name: string;
  type: "PHC" | "CHC";
  block: string;
  lat: number;
  lng: number;
  beds: number;
  occupied: number;
  scheduledDoctors: number;
  presentDoctors: number;
  attendanceRecorded: boolean;
  dailyCapacity: number;
  patientsToday: number;
  updatedAt: string;
};
export type Medicine = { id: string; name: string; unit: string };
export type Inventory = {
  id: string;
  facilityId: string;
  medicineId: string;
  quantity: number;
  reserved: number;
  minimum: number;
  expiry: string;
  version: number;
  history: HistoryPoint[];
};
export type Diagnostic = {
  id: string;
  facilityId: string;
  name: string;
  equipment: "operational" | "down" | "unknown";
  reagents: boolean;
  updatedAt: string;
  downtimeHours: number;
};
export type Transfer = {
  id: string;
  donorId: string;
  recipientId: string;
  medicineId: string;
  quantity: number;
  status: "approved" | "dispatched" | "received" | "cancelled";
  createdAt: string;
  updatedAt: string;
  approvedBy: string;
  reason: string;
};
export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entityId: string;
  detail: string;
};
export type Snapshot = {
  facilities: Facility[];
  medicines: Medicine[];
  inventory: Inventory[];
  diagnostics: Diagnostic[];
  footfall: Record<string, HistoryPoint[]>;
  transfers: Transfer[];
  audit: AuditEvent[];
  asOf: string;
  synthetic: true;
  revision: number;
};
export type Forecast = {
  method:
    | "seasonal-naive"
    | "moving-average"
    | "exponential-smoothing"
    | "insufficient-data";
  points: {
    date: string;
    value: number;
    lower: number | null;
    upper: number | null;
  }[];
  mae: number | null;
  validationPoints: number;
  trainingPoints: number;
  intervalLabel: string;
};
export type InventoryInsight = {
  inventoryId: string;
  facilityId: string;
  medicineId: string;
  available: number;
  dailyDemand: number;
  daysRemaining: number | null;
  shortageDate: string | null;
  risk: "critical" | "warning" | "healthy" | "unknown";
  forecast: Forecast;
  replenishment: number;
  expired: boolean;
};
export type Recommendation = {
  id: string;
  donorId: string;
  recipientId: string;
  medicineId: string;
  quantity: number;
  distanceKm: number;
  donorDaysAfter: number | null;
  recipientDaysBefore: number | null;
  recipientDaysAfter: number | null;
  donorSafetyStock: number;
  urgency: "critical" | "warning";
  explanation: string;
  donorInventoryVersion: number;
  recipientInventoryVersion: number;
};
export type FacilityRisk = {
  facilityId: string;
  score: number;
  level: "critical" | "watch" | "stable";
  reasons: { code: string; value?: number }[];
  completeness: number;
};
export type Intelligence = {
  inventory: InventoryInsight[];
  recommendations: Recommendation[];
  risks: FacilityRisk[];
  footfall: Record<string, Forecast>;
};
