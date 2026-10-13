// Builds the extension into build/: the relay bundled into one file, plus the
// manifest, icon and licence. Task's
// pack task then validates and packs build/ into dist/.

import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

rmSync("build", { recursive: true, force: true });
mkdirSync("build/server", { recursive: true });

await build({
  entryPoints: ["src/index.js"],
  outfile: "build/server/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  minify: true,
  legalComments: "external",
  define: { __VERSION__: JSON.stringify(pkg.version) },
  // Some dependencies use require(); give the ESM bundle one.
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});

// The manifest and package.json carry the same version; task version sets both.
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
if (manifest.version !== pkg.version) {
  console.error(`manifest.json version ${manifest.version} doesn't match package.json version ${pkg.version}; set both with: task version -- <version>`);
  process.exit(1);
}
copyFileSync("manifest.json", "build/manifest.json");

copyFileSync("assets/icon.png", "build/icon.png");
copyFileSync("LICENSE.txt", "build/LICENSE.txt");

console.log(`built knot extension ${pkg.version} in build/`);
