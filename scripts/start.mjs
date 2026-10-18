import { resolve } from "node:path";
// The generated standalone server changes cwd. Resolve storage before loading it.
process.env.DATABASE_PATH = resolve(
  process.env.DATABASE_PATH || "./data/districtcare.db",
);
process.env.HOSTNAME = process.env.BIND_HOST || "0.0.0.0";
await import("../.next/standalone/server.js");
