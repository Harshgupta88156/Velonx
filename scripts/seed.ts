import { getDb, loadSnapshot } from "../src/lib/db";
const snapshot = loadSnapshot(getDb());
console.log(
  `Synthetic district ready: ${snapshot.facilities.length} facilities, ${snapshot.inventory.length} medicine records, as of ${snapshot.asOf}. Existing data preserved.`,
);
