import { Hono } from "hono";
import { originOf, type AppEnv } from "../http.js";
import { listPages } from "../repo/pages.js";
import { wikiTree } from "../repo/wiki.js";

export const seoRoutes = new Hono<AppEnv>();

seoRoutes.get("/robots.txt", c => {
  c.header("Cache-Control", "public, max-age=3600");
  return c.text(`User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${originOf(c)}/sitemap.xml\n`);
});

seoRoutes.get("/sitemap.xml", c => {
  const origin = originOf(c);
  const urls = ["/", "/wiki", "/items", "/rezepte", "/team", "/regeln", "/voten", "/bewerben"];
  for (const a of wikiTree().list) urls.push(`/wiki/${a.slug}`);
  for (const p of listPages()) if (p.published && p.slug !== "regeln") urls.push(`/${p.slug}`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(u => `  <url><loc>${origin}${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
});
