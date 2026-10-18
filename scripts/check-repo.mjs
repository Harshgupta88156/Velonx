import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const files = git("ls-files", "-z").split("\0").filter(Boolean);
const forbidden = files.filter(
  (p) =>
    /(^|\/)(node_modules|\.next|data|dist)\//.test(p) ||
    /\.db(-wal|-shm)?$/.test(p) ||
    (/(^|\/)\.env/.test(p) && p !== ".env.example"),
);
if (forbidden.length)
  throw new Error(`Forbidden tracked files: ${forbidden.join(", ")}`);
const bytes = files.reduce((n, p) => n + statSync(p).size, 0);
const archive = execFileSync("git", ["archive", "--format=tar", "HEAD"]);
const branches = git(
  "for-each-ref",
  "--format=%(refname:short)",
  "refs/heads",
).split("\n");
if (branches.length !== 1 || branches[0] !== "main")
  throw new Error(`Expected main only; found ${branches}`);
if (bytes >= 10_000_000 || archive.byteLength >= 10_000_000)
  throw new Error("Repository exceeds 10 MB submission budget");
console.log(
  JSON.stringify(
    {
      trackedFiles: files.length,
      trackedBytes: bytes,
      sourceArchiveBytes: archive.byteLength,
      localBranches: branches,
    },
    null,
    2,
  ),
);
console.log(
  "Remote visibility, branch count, and remote HEAD must be verified separately.",
);
