import type { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Role } from "../../../shared/catalog.js";
import { isHttps, sameOrigin, type AppEnv, type Ctx } from "../../http.js";
import { safeEqual } from "../../lib/security.js";
import { findSession, touchSession } from "../../repo/sessions.js";
import { getUser, type User } from "../../repo/users.js";

export const SESSION_COOKIE = "letopia_session";
const FLASH_COOKIE = "letopia_flash";

export type Area = "applications" | "content" | "system";

const AREA_ROLES: Record<Area, readonly Role[]> = {
  applications: ["admin", "moderator"],
  content: ["admin", "editor"],
  system: ["admin"]
};

export const can = (user: Pick<User, "role"> | null | undefined, area: Area) => Boolean(user && AREA_ROLES[area].includes(user.role));

export const setSessionCookie = (c: Ctx, token: string, remember: boolean) =>
  setCookie(c, SESSION_COOKIE, token, {
    path: "/admin",
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttps(c),
    ...(remember ? { maxAge: 30 * 86400 } : {})
  });

export const clearSessionCookie = (c: Ctx) => deleteCookie(c, SESSION_COOKIE, { path: "/admin" });

/** Kurze Meldung für die nächste Seite ("Gespeichert" usw.). */
export const flash = (c: Ctx, text: string, type: "ok" | "fehler" = "ok") =>
  setCookie(c, FLASH_COOKIE, encodeURIComponent(JSON.stringify({ text, type })), {
    path: "/admin",
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttps(c),
    maxAge: 60
  });

/** Lädt Benutzer, Sitzung und Flash-Meldung für jede Admin-Anfrage. */
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  c.set("session", null);
  c.set("flash", null);

  const raw = getCookie(c, FLASH_COOKIE);
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as { text?: unknown; type?: unknown };
      if (typeof parsed.text === "string") c.set("flash", { text: parsed.text, type: parsed.type === "fehler" ? "fehler" : "ok" });
    } catch {
      // kaputte Meldung ignorieren
    }
    deleteCookie(c, FLASH_COOKIE, { path: "/admin" });
  }

  const token = getCookie(c, SESSION_COOKIE);
  if (token && token.length < 200) {
    const session = findSession(token);
    const user = session ? getUser(session.user_id) : undefined;
    if (session && user?.active) {
      touchSession(session);
      c.set("user", user);
      c.set("session", session);
    } else {
      clearSessionCookie(c);
    }
  }

  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header("Cache-Control", "no-store");
  await next();
};

/** Alle Admin-Seiten (außer Login) setzen eine Anmeldung voraus. */
export const requireLogin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    if (c.req.method === "GET" && !c.req.header("x-requested-with")) {
      const back = c.req.path === "/admin" ? "" : `?weiter=${encodeURIComponent(c.req.path + (new URL(c.req.url).search || ""))}`;
      return c.redirect(`/admin/login${back}`);
    }
    return c.json({ ok: false, fehler: "Nicht angemeldet" }, 401);
  }
  if (user.must_change_password && !/^\/admin\/(profil|logout)/.test(c.req.path)) {
    return c.redirect("/admin/profil?pflicht=1");
  }
  await next();
};

/**
 * Schutz gegen CSRF: Jedes Formular sendet das Sitzungs-Token mit (_csrf bzw. Header X-CSRF-Token),
 * zusätzlich muss die Anfrage von der eigenen Seite kommen.
 */
export const verifyCsrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD") return next();
  if (!sameOrigin(c)) return c.text("Ungültige Herkunft der Anfrage.", 403);
  const session = c.get("session");
  if (!session) return next();
  let token = c.req.header("x-csrf-token") ?? "";
  if (!token) {
    const type = c.req.header("content-type") ?? "";
    if (type.includes("form")) {
      const body = await c.req.parseBody({ all: true });
      const value = body._csrf;
      token = typeof value === "string" ? value : "";
    }
  }
  if (!token || !safeEqual(token, session.csrf_token)) {
    return c.text("Die Sitzung ist abgelaufen oder das Formular ist veraltet. Bitte lade die Seite neu.", 403);
  }
  await next();
};

/** Bereich nur für bestimmte Rollen. */
export const requireArea = (area: Area): MiddlewareHandler<AppEnv> => async (c, next) => {
  if (!can(c.get("user"), area)) {
    flash(c, "Dafür fehlen dir die Rechte.", "fehler");
    return c.redirect("/admin");
  }
  await next();
};

export const currentUser = (c: Ctx): User => {
  const user = c.get("user");
  if (!user) throw new Error("Kein Benutzer angemeldet");
  return user;
};

export const actor = (c: Ctx) => {
  const user = c.get("user");
  return { id: user?.id ?? null, username: user?.username ?? "System" };
};

export const csrfToken = (c: Ctx) => c.get("session")?.csrf_token ?? "";
