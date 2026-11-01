import { all, get, now, run } from "../db/database.js";
import { randomToken, sha256 } from "../lib/security.js";

export interface Session {
  id: string;
  user_id: number;
  csrf_token: string;
  remember: number;
  user_agent: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
}

/** Sitzung ohne "angemeldet bleiben": 12 Stunden ab letzter Aktivität. */
export const SHORT_TTL = 12 * 3600;
/** Mit "angemeldet bleiben": 30 Tage. */
export const LONG_TTL = 30 * 86400;

export const createSession = (userId: number, remember: boolean, userAgent: string) => {
  const token = randomToken(32);
  const t = now();
  run(
    `INSERT INTO sessions (id, user_id, csrf_token, remember, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    sha256(token), userId, randomToken(24), remember ? 1 : 0, userAgent.slice(0, 200), t, t, t + (remember ? LONG_TTL : SHORT_TTL)
  );
  return token;
};

export const findSession = (token: string): Session | undefined => {
  const session = get<Session>("SELECT * FROM sessions WHERE id = ?", sha256(token));
  if (!session) return undefined;
  if (session.expires_at < now()) {
    run("DELETE FROM sessions WHERE id = ?", session.id);
    return undefined;
  }
  return session;
};

/** Verlängert die Sitzung höchstens alle 5 Minuten (spart Schreibzugriffe). */
export const touchSession = (session: Session) => {
  const t = now();
  if (t - session.last_seen_at < 300) return;
  const ttl = session.remember ? LONG_TTL : SHORT_TTL;
  run("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?", t, t + ttl, session.id);
};

export const deleteSession = (id: string) => run("DELETE FROM sessions WHERE id = ?", id);

export const deleteSessionsOfUser = (userId: number, exceptId?: string) =>
  exceptId
    ? run("DELETE FROM sessions WHERE user_id = ? AND id <> ?", userId, exceptId)
    : run("DELETE FROM sessions WHERE user_id = ?", userId);

export const listSessionsOfUser = (userId: number) =>
  all<Session>("SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC", userId, now());

export const purgeSessions = () => run("DELETE FROM sessions WHERE expires_at < ?", now()).changes;
