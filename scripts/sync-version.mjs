// Copies the version in VERSION into package.json, package-lock.json and
// manifest.json, the one place to change it.

import { readFileSync, writeFileSync } from "node:fs";

const version = readFileSync("VERSION", "utf8").trim();
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`VERSION must hold a version such as 1.2.3, not "${version}"`);
  process.exit(1);
}

function update(file, apply) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  apply(data);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

update("package.json", (pkg) => {
  pkg.version = version;
});
update("package-lock.json", (lock) => {
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
});
update("manifest.json", (manifest) => {
  manifest.version = version;
});

console.log(`version ${version}`);
