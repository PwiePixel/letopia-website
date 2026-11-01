import { createHash } from "node:crypto";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { HTTPException } from "hono/http-exception";
import { config } from "./config.js";
import { isHttps, originOf, type AppEnv } from "./http.js";
import { log } from "./log.js";
import { adminRoutes } from "./routes/admin/index.js";
import { apiRoutes } from "./routes/api.js";
import { publicRoutes } from "./routes/public.js";
import { seoRoutes } from "./routes/seo.js";
import { HEAD_SCRIPT } from "./views/public/layout.js";
import { ErrorPage, NotFoundPage } from "./views/public/pages.js";

const scriptHash = `'sha256-${createHash("sha256").update(HEAD_SCRIPT).digest("base64")}'`;

const csp = (admin: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self'${admin ? "" : ` ${scriptHash}`}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");

const PUBLIC_CSP = csp(false);
const ADMIN_CSP = csp(true);

export const createApp = () => {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const started = performance.now();
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("X-Frame-Options", "DENY");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    if (isHttps(c)) c.header("Strict-Transport-Security", "max-age=31536000");
    const type = c.res.headers.get("Content-Type") ?? "";
    if (type.startsWith("text/html")) c.header("Content-Security-Policy", c.req.path.startsWith("/admin") ? ADMIN_CSP : PUBLIC_CSP);
    log.debug(`${c.req.method} ${c.req.path} ${c.res.status} ${(performance.now() - started).toFixed(1)}ms`);
  });

  app.use("*", compress());

  // Statische Dateien (CSS, JS, Schriften, Bilder). Hinter Nginx liefert Nginx /assets direkt aus.
  app.use(
    "/assets/*",
    serveStatic({
      root: config.publicDir,
      onFound: (_path, c) => {
        if (!config.production) c.header("Cache-Control", "no-cache");
        else c.header("Cache-Control", c.req.query("v") ? "public, max-age=31536000, immutable" : "public, max-age=604800");
      }
    })
  );

  // Hochgeladene Bilder aus dem Admin-Panel.
  app.use(
    "/uploads/*",
    serveStatic({
      root: config.dataDir,
      onFound: (_path, c) => {
        c.header("Cache-Control", "public, max-age=2592000");
        c.header("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
      }
    })
  );

  app.get("/healthz", c => c.json({ ok: true }));
  app.get("/favicon.ico", c => c.redirect("/assets/img/favicon.png", 301));

  // Formulare sind klein; nur der Medien-Upload darf größere Dateien schicken.
  const formLimit = bodyLimit({ maxSize: 2 * 1024 * 1024, onError: c => c.text("Die Anfrage ist zu groß.", 413) });
  const uploadLimit = bodyLimit({ maxSize: config.maxUploadBytes * 10 + 1024 * 1024, onError: c => c.text("Die Dateien sind zu groß.", 413) });
  app.use("/admin/*", (c, next) => (c.req.path === "/admin/medien" ? uploadLimit(c, next) : formLimit(c, next)));

  app.get("/admin/", c => c.redirect("/admin", 301));
  app.get("/admin/index.php", c => c.redirect("/admin", 301));
  app.route("/api", apiRoutes);
  app.route("/admin", adminRoutes);
  app.route("/", seoRoutes);
  app.route("/", publicRoutes);

  app.notFound(c => {
    if (c.req.path.startsWith("/api/")) return c.json({ fehler: "Nicht gefunden" }, 404);
    if (c.req.path.startsWith("/assets/") || c.req.path.startsWith("/uploads/")) return c.text("Nicht gefunden", 404);
    return c.html(<NotFoundPage origin={originOf(c)} path={c.req.path} />, 404);
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    log.error(`Fehler bei ${c.req.method} ${c.req.path}`, error);
    if (c.req.path.startsWith("/api/") || c.req.header("accept")?.includes("application/json")) {
      return c.json({ ok: false, fehler: "Interner Fehler" }, 500);
    }
    return c.html(<ErrorPage origin={originOf(c)} />, 500);
  });

  return app;
};
