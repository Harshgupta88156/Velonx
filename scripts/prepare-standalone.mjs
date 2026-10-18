import { cpSync } from "node:fs";
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });
console.log("Standalone assets prepared. Runtime data is excluded.");
