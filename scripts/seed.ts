import { loadSnapshot } from "../src/lib/db";
const snapshot = await loadSnapshot();
console.log(
  `Synthetic district ready: ${snapshot.facilities.length} facilities, ${snapshot.inventory.length} medicine records, as of ${snapshot.asOf}. Existing data preserved.`,
);
process.exit(0);
