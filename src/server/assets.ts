import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";

/**
 * Versionskennung der CSS-/JS-Dateien. Sie hängt als ?v=… an jeder Asset-URL,
 * damit Browser nach einem Update sofort die neuen Dateien laden.
 */
const computeVersion = (): string => {
  const hash = createHash("sha1");
  for (const sub of ["css", "js"]) {
    const dir = path.join(config.publicDir, "assets", sub);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!/\.(css|js)$/.test(file)) continue;
      hash.update(file);
      hash.update(readFileSync(path.join(dir, file)));
    }
  }
  return hash.digest("hex").slice(0, 10);
};

let version: string | null = null;

export const assetVersion = () => (version ??= computeVersion());

export const asset = (file: string) => `/assets/${file}?v=${assetVersion()}`;

/** Prüft, ob die Browser-Skripte gebaut wurden (npm run build). */
export const clientBuilt = () => existsSync(path.join(config.publicDir, "assets", "js", "main.js"));
