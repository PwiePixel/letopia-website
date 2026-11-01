import { Hono } from "hono";
import type { AppEnv } from "../../http.js";
import { requireArea } from "./auth.js";
import { pageRoutes } from "./pages.js";
import { teamRoutes } from "./team.js";
import { voteRoutes } from "./votes.js";
import { wikiRoutes } from "./wiki.js";

/** Redaktionelle Inhalte: Wiki, Seiten, Team, Voten (Rollen: Administrator, Redaktion). */
export const contentRoutes = new Hono<AppEnv>();

for (const prefix of ["/wiki", "/seiten", "/team", "/voten"]) {
  contentRoutes.use(prefix, requireArea("content"));
  contentRoutes.use(`${prefix}/*`, requireArea("content"));
}

contentRoutes.route("/wiki", wikiRoutes);
contentRoutes.route("/seiten", pageRoutes);
contentRoutes.route("/team", teamRoutes);
contentRoutes.route("/voten", voteRoutes);
