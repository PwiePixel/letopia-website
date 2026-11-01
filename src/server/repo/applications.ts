import type { ApplicationStatus, ApplicationType } from "../../shared/catalog.js";
import { all, get, now, run } from "../db/database.js";

export interface Answer {
  field: string;
  label: string;
  value: string;
  long: boolean;
}

export interface ApplicationRow {
  id: number;
  type: string;
  player_name: string;
  discord: string;
  summary: string;
  answers: string;
  status: string;
  note: string;
  handled_by: string | null;
  created_at: number;
  updated_at: number | null;
  decided_at: number | null;
}

export interface Application extends Omit<ApplicationRow, "answers"> {
  answers: Answer[];
}

export interface ApplicationListEntry {
  id: number;
  type: string;
  player_name: string;
  discord: string;
  summary: string;
  status: string;
  created_at: number;
  votes_yes: number;
  votes_no: number;
}

export interface ApplicationVote {
  user_id: number;
  username: string;
  minecraft_name: string;
  vote: number;
  comment: string;
  created_at: number;
}

const parseAnswers = (value: string): Answer[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
      .map(a => ({
        field: String(a.field ?? a.feld ?? ""),
        label: String(a.label ?? ""),
        value: String(a.value ?? a.wert ?? ""),
        long: Boolean(a.long ?? a.lang)
      }));
  } catch {
    return [];
  }
};

export interface NewApplication {
  type: ApplicationType;
  player_name: string;
  discord: string;
  summary: string;
  answers: Answer[];
  created_at?: number;
  status?: ApplicationStatus;
  note?: string;
  handled_by?: string | null;
  updated_at?: number | null;
}

export const createApplication = (data: NewApplication) => {
  const created = data.created_at ?? now();
  const status = data.status ?? "neu";
  const decided = status === "angenommen" || status === "abgelehnt" ? (data.updated_at ?? created) : null;
  return run(
    `INSERT INTO applications (type, player_name, discord, summary, answers, status, note, handled_by, created_at, updated_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.type, data.player_name, data.discord, data.summary, JSON.stringify(data.answers), status,
    data.note ?? "", data.handled_by ?? null, created, data.updated_at ?? null, decided
  ).lastId;
};

export const getApplication = (id: number): Application | undefined => {
  const row = get<ApplicationRow>("SELECT * FROM applications WHERE id = ?", id);
  return row ? { ...row, answers: parseAnswers(row.answers) } : undefined;
};

export interface ApplicationFilter {
  status?: string;
  type?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

const where = (f: ApplicationFilter) => {
  const parts: string[] = [];
  const params: string[] = [];
  if (f.status) {
    parts.push("a.status = ?");
    params.push(f.status);
  }
  if (f.type) {
    parts.push("a.type = ?");
    params.push(f.type);
  }
  if (f.q) {
    const pattern = `%${f.q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    parts.push("(a.player_name LIKE ? ESCAPE '\\' OR a.discord LIKE ? ESCAPE '\\' OR a.summary LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern, pattern);
  }
  return { sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "", params };
};

export const listApplications = (f: ApplicationFilter = {}): ApplicationListEntry[] => {
  const w = where(f);
  return all<ApplicationListEntry>(
    `SELECT a.id, a.type, a.player_name, a.discord, a.summary, a.status, a.created_at,
       (SELECT COUNT(*) FROM application_votes v WHERE v.application_id = a.id AND v.vote = 1) AS votes_yes,
       (SELECT COUNT(*) FROM application_votes v WHERE v.application_id = a.id AND v.vote = -1) AS votes_no
     FROM applications a${w.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    ...w.params, f.limit ?? 50, f.offset ?? 0
  );
};

export const countApplications = (f: ApplicationFilter = {}) => {
  const w = where(f);
  return Number(get<{ n: number }>(`SELECT COUNT(*) AS n FROM applications a${w.sql}`, ...w.params)?.n ?? 0);
};

export const countByStatus = (): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const row of all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM applications GROUP BY status")) {
    out[row.status] = Number(row.n);
  }
  return out;
};

export const setStatus = (id: number, status: ApplicationStatus, by: string) => {
  const decided = status === "angenommen" || status === "abgelehnt";
  run(
    `UPDATE applications SET status = ?, handled_by = ?, updated_at = ?, decided_at = ${decided ? "COALESCE(decided_at, ?)" : "NULL"} WHERE id = ?`,
    ...(decided ? [status, by, now(), now(), id] : [status, by, now(), id])
  );
};

export const setNote = (id: number, note: string, by: string) =>
  run("UPDATE applications SET note = ?, handled_by = ?, updated_at = ? WHERE id = ?", note, by, now(), id);

export const deleteApplication = (id: number) => run("DELETE FROM applications WHERE id = ?", id);

export const listVotes = (id: number) =>
  all<ApplicationVote>(
    `SELECT v.user_id, u.username, u.minecraft_name, v.vote, v.comment, v.created_at FROM application_votes v
     JOIN users u ON u.id = v.user_id WHERE v.application_id = ? ORDER BY v.created_at`,
    id
  );

export const castVote = (applicationId: number, userId: number, vote: -1 | 0 | 1, comment: string) =>
  run(
    `INSERT INTO application_votes (application_id, user_id, vote, comment, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(application_id, user_id) DO UPDATE SET vote = excluded.vote, comment = excluded.comment, created_at = excluded.created_at`,
    applicationId, userId, vote, comment, now()
  );

export const removeVote = (applicationId: number, userId: number) =>
  run("DELETE FROM application_votes WHERE application_id = ? AND user_id = ?", applicationId, userId);

/** Entschiedene Bewerbungen nach Ablauf der Aufbewahrungsfrist löschen. */
export const purgeDecided = (days: number) => {
  if (days <= 0) return 0;
  return run("DELETE FROM applications WHERE decided_at IS NOT NULL AND decided_at < ?", now() - days * 86400).changes;
};

export const recentApplications = (limit = 5) => listApplications({ limit });
