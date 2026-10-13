// Sets the version in package.json, package-lock.json and manifest.json.
// Usage: node scripts/version.mjs <version>

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error("usage: task version -- <major.minor.patch>");
  process.exit(1);
}

execFileSync("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"], { stdio: "inherit" });

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
