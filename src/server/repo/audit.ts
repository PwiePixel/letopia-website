import { all, get, now, run } from "../db/database.js";

export interface AuditEntry {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  target: string;
  details: string;
  created_at: number;
}

export interface Actor {
  id: number | null;
  username: string;
}

/** Hält fest, wer im Admin-Panel was geändert hat. */
export const audit = (actor: Actor, action: string, target = "", details = "") =>
  run(
    "INSERT INTO audit_log (user_id, username, action, target, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    actor.id, actor.username, action, target.slice(0, 200), details.slice(0, 1000), now()
  );

export const listAudit = (limit = 50, offset = 0, q = "") => {
  if (!q) return all<AuditEntry>("SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?", limit, offset);
  const pattern = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  return all<AuditEntry>(
    `SELECT * FROM audit_log WHERE username LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR target LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\'
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    pattern, pattern, pattern, pattern, limit, offset
  );
};

export const countAudit = (q = "") => {
  if (!q) return Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM audit_log")?.n ?? 0);
  const pattern = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  return Number(
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM audit_log WHERE username LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR target LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\'",
      pattern, pattern, pattern, pattern
    )?.n ?? 0
  );
};

/** Protokoll-Einträge älter als ein Jahr entfernen. */
export const purgeAudit = (days = 365) => run("DELETE FROM audit_log WHERE created_at < ?", now() - days * 86400).changes;
