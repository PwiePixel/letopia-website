import { Hono } from "hono";
import type { AppEnv } from "../../http.js";

// Platzhalter – wird durch das vollständige Admin-Panel ersetzt.
export const adminRoutes = new Hono<AppEnv>();
adminRoutes.get("/", c => c.text("Admin-Panel folgt"));
