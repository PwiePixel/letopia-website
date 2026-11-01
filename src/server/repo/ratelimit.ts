import { get, now, run } from "../db/database.js";
import { hmac } from "../lib/security.js";
import { instanceSecret } from "./settings.js";

/**
 * Einfaches, dauerhaftes Rate-Limit. Schlüssel werden mit dem Geheimnis der Installation
 * gehasht – IP-Adressen landen also nie im Klartext in der Datenbank.
 */
const keyOf = (purpose: string, subject: string) => hmac(instanceSecret(), `${purpose}|${subject}`);

export const tooMany = (purpose: string, subject: string, max: number, windowSeconds: number): boolean => {
  const row = get<{ n: number }>("SELECT COUNT(*) AS n FROM rate_limits WHERE key = ? AND at > ?", keyOf(purpose, subject), now() - windowSeconds);
  return Number(row?.n ?? 0) >= max;
};

export const hit = (purpose: string, subject: string) => run("INSERT INTO rate_limits (key, at) VALUES (?, ?)", keyOf(purpose, subject), now());

export const forget = (purpose: string, subject: string) => run("DELETE FROM rate_limits WHERE key = ?", keyOf(purpose, subject));

export const purgeRateLimits = () => run("DELETE FROM rate_limits WHERE at < ?", now() - 2 * 86400).changes;
