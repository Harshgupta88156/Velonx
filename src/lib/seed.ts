import type { Snapshot, Facility, HistoryPoint } from "./types";

// Deterministic fictional facilities. Coordinates approximate a synthetic Sehore district.
export function createSeed(
  asOf = new Date().toISOString().slice(0, 10),
): Snapshot {
  let state = 20261018;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const date = (offset: number) =>
    new Date(Date.parse(`${asOf}T00:00:00Z`) + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const raw: [
    string,
    string,
    "PHC" | "CHC",
    string,
    number,
    number,
    number,
    number,
    number,
    number,
    boolean,
    number,
    number,
  ][] = [
    [
      "rampur",
      "Rampur PHC",
      "PHC",
      "Sehore",
      23.22,
      77.04,
      12,
      10,
      3,
      2,
      true,
      100,
      126,
    ],
    [
      "sehore",
      "Sehore CHC",
      "CHC",
      "Sehore",
      23.2,
      77.08,
      60,
      34,
      8,
      7,
      true,
      320,
      242,
    ],
    [
      "ashta",
      "Ashta CHC",
      "CHC",
      "Ashta",
      23.02,
      76.72,
      50,
      45,
      7,
      5,
      true,
      280,
      316,
    ],
    [
      "ichhawar",
      "Ichhawar PHC",
      "PHC",
      "Ichhawar",
      23.03,
      77.01,
      10,
      6,
      3,
      0,
      false,
      90,
      78,
    ],
    [
      "budhni",
      "Budhni CHC",
      "CHC",
      "Budhni",
      22.8,
      77.61,
      40,
      26,
      6,
      5,
      true,
      240,
      207,
    ],
    [
      "nasrullaganj",
      "Nasrullaganj PHC",
      "PHC",
      "Nasrullaganj",
      22.69,
      77.27,
      14,
      11,
      3,
      2,
      true,
      110,
      103,
    ],
    [
      "jawar",
      "Jawar PHC",
      "PHC",
      "Ashta",
      23.0,
      76.5,
      8,
      3,
      2,
      2,
      true,
      70,
      59,
    ],
    [
      "bilkisganj",
      "Bilkisganj PHC",
      "PHC",
      "Sehore",
      23.14,
      77.2,
      10,
      5,
      2,
      2,
      true,
      80,
      68,
    ],
  ];
  const facilities: Facility[] = raw.map(
    ([
      id,
      name,
      type,
      block,
      lat,
      lng,
      beds,
      occupied,
      scheduledDoctors,
      presentDoctors,
      attendanceRecorded,
      dailyCapacity,
      patientsToday,
    ]) => ({
      id,
      name,
      type,
      block,
      lat,
      lng,
      beds,
      occupied,
      scheduledDoctors,
      presentDoctors,
      attendanceRecorded,
      dailyCapacity,
      patientsToday,
      updatedAt: `${asOf}T08:30:00+05:30`,
    }),
  );
  const medicines = [
    { id: "paracetamol", name: "Paracetamol 500 mg", unit: "tablets" },
    { id: "amoxicillin", name: "Amoxicillin 500 mg", unit: "capsules" },
    { id: "ors", name: "Oral rehydration salts", unit: "sachets" },
    { id: "metformin", name: "Metformin 500 mg", unit: "tablets" },
    { id: "iron", name: "Iron & folic acid", unit: "tablets" },
    { id: "saline", name: "Normal saline 500 ml", unit: "bottles" },
  ];
  const history = (base: number, trend = 0): HistoryPoint[] =>
    Array.from({ length: 84 }, (_, i) => {
      const d = date(i - 84);
      const dow = new Date(d).getUTCDay();
      const weekly = [0.66, 1.22, 1.1, 1.06, 1.03, 0.98, 0.85][dow];
      return {
        date: d,
        value: Math.max(
          0,
          Math.round(
            base * weekly * (0.92 + random() * 0.16) * (1 + (trend * i) / 84),
          ),
        ),
      };
    });
  const footfall = Object.fromEntries(
    facilities.map((f) => [
      f.id,
      history(f.dailyCapacity * 0.83, f.id === "rampur" ? 0.32 : 0.05),
    ]),
  );
  const inventory = facilities.flatMap((f, fi) =>
    medicines.map((m, mi) => {
      const base = [26, 12, 17, 19, 15, 6][mi] * (f.type === "CHC" ? 2.3 : 1);
      let quantity = Math.round(base * (16 + random() * 12));
      if (f.id === "rampur" && m.id === "paracetamol") quantity = 68;
      if (f.id === "sehore" && m.id === "paracetamol") quantity = 1850;
      if (f.id === "ashta" && m.id === "ors") quantity = 73;
      if (f.id === "nasrullaganj" && m.id === "saline") quantity = 0;
      return {
        id: `${f.id}-${m.id}`,
        facilityId: f.id,
        medicineId: m.id,
        quantity,
        reserved: 0,
        minimum: Math.ceil(base * 5),
        expiry: date(
          fi === 6 && mi === 1 ? -2 : fi === 2 && mi === 4 ? 10 : 150 + fi * 10,
        ),
        version: 1,
        history: history(base, fi === 0 ? 0.18 : 0.04),
      };
    }),
  );
  const diagnostics = facilities.flatMap((f, fi) =>
    [
      "Complete blood count",
      "Blood glucose",
      "Malaria rapid test",
      "Urinalysis",
    ].map((name, di) => ({
      id: `${f.id}-test-${di}`,
      facilityId: f.id,
      name,
      equipment: ((fi === 0 && di === 0) || (fi === 2 && di === 2)
        ? "down"
        : fi === 3 && di === 3
          ? "unknown"
          : "operational") as "down" | "unknown" | "operational",
      reagents: !((fi === 0 && di === 2) || (fi === 5 && di === 0)),
      updatedAt: `${date(fi === 3 ? -3 : 0)}T08:00:00+05:30`,
      downtimeHours: fi === 0 && di === 0 ? 18 : fi === 2 && di === 2 ? 8 : 0,
    })),
  );
  return {
    facilities,
    medicines,
    inventory,
    diagnostics,
    footfall,
    transfers: [],
    audit: [],
    asOf,
    synthetic: true,
    revision: 1,
  };
}
