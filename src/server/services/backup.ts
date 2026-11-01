import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import { db } from "../db/database.js";

const exec = promisify(execFile);

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** Konsistente Kopie der Datenbank (funktioniert auch im laufenden Betrieb). */
export const snapshotDatabase = async (target: string) => {
  await mkdir(path.dirname(target), { recursive: true });
  await rm(target, { force: true });
  db().prepare("VACUUM INTO ?").run(target);
  return target;
};

/**
 * Erstellt ein Backup (Datenbank + Uploads) als .tar.gz im Backup-Ordner
 * und löscht ältere Backups, sodass höchstens `keep` übrig bleiben.
 */
export const createBackup = async (keep = 14): Promise<string> => {
  await mkdir(config.backupDir, { recursive: true });
  const name = `letopia-${stamp()}`;
  const work = await mkdtemp(path.join(config.backupDir, ".tmp-"));
  try {
    await snapshotDatabase(path.join(work, "letopia.db"));
    const archive = path.join(config.backupDir, `${name}.tar.gz`);
    const args = ["-czf", archive, "-C", work, "letopia.db"];
    if (existsSync(config.uploadDir)) args.push("-C", config.dataDir, "uploads");
    try {
      await exec("tar", args);
      await pruneBackups(keep);
      return archive;
    } catch {
      // Ohne tar: nur die Datenbank sichern.
      const plain = path.join(config.backupDir, `${name}.db`);
      await snapshotDatabase(plain);
      await pruneBackups(keep);
      return plain;
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};

export const listBackups = async () => {
  if (!existsSync(config.backupDir)) return [];
  const files = (await readdir(config.backupDir)).filter(f => /^letopia-\d{8}-\d{6}\.(tar\.gz|db)$/.test(f));
  const out = await Promise.all(
    files.map(async f => {
      const info = await stat(path.join(config.backupDir, f));
      return { name: f, size: info.size, time: info.mtimeMs };
    })
  );
  return out.sort((a, b) => b.name.localeCompare(a.name));
};

export const pruneBackups = async (keep: number) => {
  const list = await listBackups();
  for (const old of list.slice(Math.max(1, keep))) await rm(path.join(config.backupDir, old.name), { force: true });
};
