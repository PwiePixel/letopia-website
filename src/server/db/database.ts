import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { config } from "../config.js";
import { migrate } from "./migrations.js";

export type Param = SQLInputValue;

let instance: DatabaseSync | null = null;

/** Öffnet die SQLite-Datenbank (einmal pro Prozess) und spielt fehlende Migrationen ein. */
export const openDatabase = (file: string = config.dbFile): DatabaseSync => {
  if (instance) return instance;
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);
  instance = db;
  return db;
};

export const db = (): DatabaseSync => instance ?? openDatabase();

export const closeDatabase = () => {
  if (!instance) return;
  try {
    instance.exec("PRAGMA optimize");
  } catch {
    // ignorieren
  }
  instance.close();
  instance = null;
};

const statements = new Map<string, ReturnType<DatabaseSync["prepare"]>>();

const prepare = (sql: string) => {
  const cached = statements.get(sql);
  if (cached) return cached;
  const stmt = db().prepare(sql);
  statements.set(sql, stmt);
  return stmt;
};

/** Für Tests: zwischengespeicherte Statements verwerfen (z. B. nach neuer Verbindung). */
export const resetStatementCache = () => statements.clear();

export const all = <T>(sql: string, ...params: Param[]): T[] => prepare(sql).all(...params) as T[];

export const get = <T>(sql: string, ...params: Param[]): T | undefined => prepare(sql).get(...params) as T | undefined;

export const run = (sql: string, ...params: Param[]) => {
  const result = prepare(sql).run(...params);
  return { changes: Number(result.changes), lastId: Number(result.lastInsertRowid) };
};

let depth = 0;

/** Führt fn in einer Transaktion aus (verschachtelte Aufrufe laufen in der äußeren Transaktion mit). */
export const transaction = <T>(fn: () => T): T => {
  if (depth > 0) return fn();
  db().exec("BEGIN IMMEDIATE");
  depth++;
  try {
    const result = fn();
    db().exec("COMMIT");
    return result;
  } catch (error) {
    db().exec("ROLLBACK");
    throw error;
  } finally {
    depth--;
  }
};

export const now = () => Math.floor(Date.now() / 1000);

/** Heutiges Datum (Europe/Berlin) als YYYY-MM-DD. */
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
