import { Hono } from "hono";
import { SLUG_PATTERN } from "../../shared/catalog.js";
import { originOf, type AppEnv } from "../http.js";
import { listItems } from "../repo/items.js";
import { getPageBySlug } from "../repo/pages.js";
import { listIngredients, listRecipes } from "../repo/recipes.js";
import { teamWithMembers } from "../repo/team.js";
import { listVoteSites } from "../repo/votes.js";
import { wikiTree } from "../repo/wiki.js";
import { ApplyPage } from "../views/public/apply.js";
import { ItemsPage, RecipesPage } from "../views/public/catalog.js";
import { HomePage } from "../views/public/home.js";
import { ContentPage, NotFoundPage, RulesPage, TeamPage, VotePage } from "../views/public/pages.js";
import { renderArticle, WikiArticle, WikiEmpty, WikiHome, WikiMissing, WikiPage, WikiToc, wikiTitle } from "../views/public/wiki.js";

export const publicRoutes = new Hono<AppEnv>();

const PAGE_CACHE = "public, max-age=0, must-revalidate";

publicRoutes.use("*", async (c, next) => {
  await next();
  if (c.req.method === "GET" && c.res.status === 200 && !c.res.headers.has("Cache-Control")) c.header("Cache-Control", PAGE_CACHE);
});

publicRoutes.get("/", c => c.html(<HomePage origin={originOf(c)} />));

publicRoutes.get("/wiki", async c => {
  const tree = wikiTree();
  c.header("Vary", "X-Wiki-Partial");
  if (c.req.header("x-wiki-partial") === "1") {
    const main = tree.list.length ? <WikiHome tree={tree} /> : <WikiEmpty />;
    return c.json({ slug: "", title: wikiTitle(), main: String(await main.toString()), toc: "" });
  }
  return c.html(<WikiPage origin={originOf(c)} tree={tree} />);
});

publicRoutes.get("/wiki/:slug", async c => {
  const slug = c.req.param("slug").toLowerCase();
  const tree = wikiTree();
  const entry = SLUG_PATTERN.test(slug) ? tree.bySlug.get(slug) : undefined;
  const partial = c.req.header("x-wiki-partial") === "1";

  if (!entry) {
    if (partial) {
      return c.json({ slug, title: "Artikel nicht gefunden – Wiki | Letopia.net", main: String(await (<WikiMissing slug={slug} />).toString()), toc: "" }, 404);
    }
    return c.html(<WikiPage origin={originOf(c)} tree={tree} missing={slug} />, 404);
  }

  const article = renderArticle(tree, entry);
  if (partial) {
    // Teil-Antwort für die Navigation innerhalb des Wikis ohne kompletten Seitenwechsel.
    c.header("Vary", "X-Wiki-Partial");
    return c.json({
      slug,
      title: wikiTitle(article),
      main: String(await (<WikiArticle tree={tree} article={article} />).toString()),
      toc: String(await (<WikiToc toc={article.toc} />)?.toString() ?? "")
    });
  }
  c.header("Vary", "X-Wiki-Partial");
  return c.html(<WikiPage origin={originOf(c)} tree={tree} article={article} />);
});

publicRoutes.get("/items", c => c.html(<ItemsPage origin={originOf(c)} items={listItems(true)} />));

publicRoutes.get("/rezepte", c => c.html(<RecipesPage origin={originOf(c)} recipes={listRecipes(true)} ingredients={listIngredients()} />));

publicRoutes.get("/team", c => c.html(<TeamPage origin={originOf(c)} groups={teamWithMembers()} />));

publicRoutes.get("/voten", c => c.html(<VotePage origin={originOf(c)} sites={listVoteSites(true)} />));

publicRoutes.get("/bewerben", c => c.html(<ApplyPage origin={originOf(c)} />));

publicRoutes.get("/regeln", c => {
  const page = getPageBySlug("regeln");
  if (!page) return c.html(<NotFoundPage origin={originOf(c)} path={c.req.path} />, 404);
  return c.html(<RulesPage origin={originOf(c)} page={page} />);
});

// Alte Adressen der statischen Website dauerhaft umleiten (Links aus Discord, Suchmaschinen …).
const LEGACY: Record<string, string> = {
  "/index.html": "/",
  "/wiki.html": "/wiki",
  "/items.html": "/items",
  "/rezepte.html": "/rezepte",
  "/team.html": "/team",
  "/voten.html": "/voten",
  "/regeln.html": "/regeln",
  "/bewerben.html": "/bewerben",
  "/impressum.html": "/impressum",
  "/datenschutz.html": "/datenschutz",
  "/agb.html": "/agb",
  "/404.html": "/",
  "/admin/index.php": "/admin",
  "/admin/": "/admin"
};

for (const [from, to] of Object.entries(LEGACY)) {
  publicRoutes.get(from, c => c.redirect(to, 301));
}

publicRoutes.get("/:slug{[a-z0-9-]+}", async (c, next) => {
  const page = getPageBySlug(c.req.param("slug"));
  if (!page || !page.published || page.slug === "regeln") return next();
  return c.html(<ContentPage origin={originOf(c)} page={page} />);
});
