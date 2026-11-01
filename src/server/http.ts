import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { config } from "./config.js";
import type { Session } from "./repo/sessions.js";
import type { User } from "./repo/users.js";

export interface AppEnv {
  Variables: {
    user: User | null;
    session: Session | null;
    /** Neues Sitzungs-Cookie, das gesetzt werden soll (nach Login). */
    flash: { text: string; type: "ok" | "fehler" } | null;
  };
}

export type Ctx = Context<AppEnv>;

/** Ist die Verbindung (ggf. hinter Nginx) per HTTPS? */
export const isHttps = (c: Context): boolean => {
  if (config.trustProxy) {
    const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    if (proto) return proto === "https";
  }
  return new URL(c.req.url).protocol === "https:";
};

/** Öffentliche Basis-URL ohne abschließenden Slash. */
export const originOf = (c: Context): string => {
  if (config.siteUrl) return config.siteUrl;
  const host = (config.trustProxy ? c.req.header("x-forwarded-host") : undefined) ?? c.req.header("host") ?? new URL(c.req.url).host;
  return `${isHttps(c) ? "https" : "http"}://${host.split(",")[0]?.trim()}`;
};

/** IP-Adresse des Besuchers (hinter Nginx aus X-Real-IP / X-Forwarded-For). */
export const clientIp = (c: Context): string => {
  if (config.trustProxy) {
    const real = c.req.header("x-real-ip")?.trim();
    if (real) return real;
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? "unbekannt";
  } catch {
    return "unbekannt";
  }
};

/** Prüft bei Formular-Posts, ob die Anfrage von der eigenen Seite kommt (Schutz gegen CSRF). */
export const sameOrigin = (c: Context): boolean => {
  const origin = c.req.header("origin");
  const host = (config.trustProxy ? c.req.header("x-forwarded-host") : undefined) ?? c.req.header("host");
  if (!origin) {
    const referer = c.req.header("referer");
    if (!referer) return true;
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  if (origin === "null") return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export const toInt = (value: string | undefined | null, fallback = 0): number => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};
