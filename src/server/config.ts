import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Projektordner (enthält package.json, public/, content/). Funktioniert aus src/ (tsx) und dist/ (kompiliert). */
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const envFile = process.env.LETOPIA_ENV_FILE ?? path.join(ROOT_DIR, ".env");
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Eine kaputte .env soll den Start nicht verhindern – Standardwerte greifen.
  }
}

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback;
  return /^(1|true|yes|ja|on)$/i.test(value.trim());
};

const int = (value: string | undefined, fallback: number): number => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const siteUrl = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
const dataDir = path.resolve(ROOT_DIR, process.env.DATA_DIR ?? "data");

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  port: int(process.env.PORT, 3000),
  siteUrl,
  dataDir,
  dbFile: path.join(dataDir, "letopia.db"),
  uploadDir: path.join(dataDir, "uploads"),
  cacheDir: path.join(dataDir, "cache"),
  backupDir: path.join(dataDir, "backups"),
  publicDir: path.join(ROOT_DIR, "public"),
  contentDir: path.join(ROOT_DIR, "content"),
  trustProxy: bool(process.env.TRUST_PROXY, false),
  production: (process.env.NODE_ENV ?? "development") === "production",
  logLevel: (process.env.LOG_LEVEL ?? "info").toLowerCase(),
  /** Maximale Upload-Größe für Bilder in Bytes. */
  maxUploadBytes: int(process.env.MAX_UPLOAD_MB, 8) * 1024 * 1024
} as const;

export type Config = typeof config;
