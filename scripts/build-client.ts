/**
 * Baut die Browser-Skripte aus src/client/pages/*.ts nach public/assets/js/*.js
 * (gebündelt und minifiziert). Mit --watch für die Entwicklung.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagesDir = path.join(root, "src", "client", "pages");
const watch = process.argv.includes("--watch");

const entryPoints = readdirSync(pagesDir)
  .filter(f => f.endsWith(".ts"))
  .map(f => path.join(pagesDir, f));

const options: esbuild.BuildOptions = {
  entryPoints,
  outdir: path.join(root, "public", "assets", "js"),
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  logLevel: "info"
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Browser-Skripte werden bei Änderungen neu gebaut …");
} else {
  await esbuild.build(options);
}
