import { all, get, now, run, today } from "../db/database.js";
import { touchContent } from "./cache.js";
import { nextPosition } from "./order.js";

export interface Page {
  id: number;
  slug: string;
  title: string;
  heading: string;
  lead: string;
  description: string;
  body: string;
  scene: string;
  seed: string;
  in_footer: number;
  published: number;
  system: number;
  position: number;
  updated_on: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

/** Feste Seiten mit eigener Adresse, die nicht gelöscht oder umbenannt werden können. */
export const SYSTEM_PAGES = ["regeln", "impressum", "datenschutz", "agb"] as const;

/** Adressen, die bereits von der Website belegt sind und nicht als Seiten-Slug genutzt werden dürfen. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "assets", "uploads", "wiki", "items", "rezepte", "team", "voten", "bewerben",
  "regeln", "impressum", "datenschutz", "agb", "sitemap", "robots", "healthz", "index", "seite"
]);

export const listPages = () => all<Page>("SELECT * FROM pages ORDER BY system DESC, position, id");

export const getPage = (id: number) => get<Page>("SELECT * FROM pages WHERE id = ?", id);

export const getPageBySlug = (slug: string) => get<Page>("SELECT * FROM pages WHERE slug = ?", slug);

export const footerPages = () =>
  all<Pick<Page, "slug" | "title">>("SELECT slug, title FROM pages WHERE in_footer = 1 AND published = 1 ORDER BY system DESC, position, id");

export interface PageInput {
  slug: string;
  title: string;
  heading: string;
  lead: string;
  description: string;
  body: string;
  scene: string;
  seed: string;
  in_footer: boolean;
  published: boolean;
  updated_on: string | null;
}

export const createPage = (data: PageInput, by: string, system = false) => {
  const t = now();
  const { lastId } = run(
    `INSERT INTO pages (slug, title, heading, lead, description, body, scene, seed, in_footer, published, system, position, updated_on, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.title, data.heading, data.lead, data.description, data.body, data.scene, data.seed,
    data.in_footer ? 1 : 0, data.published ? 1 : 0, system ? 1 : 0, nextPosition("pages"),
    data.updated_on ?? today(), by, t, t
  );
  touchContent();
  return lastId;
};

export const updatePage = (id: number, data: PageInput, by: string) => {
  run(
    `UPDATE pages SET slug = CASE WHEN system = 1 THEN slug ELSE ? END, title = ?, heading = ?, lead = ?, description = ?, body = ?,
     scene = ?, seed = ?, in_footer = ?, published = CASE WHEN system = 1 THEN 1 ELSE ? END, updated_on = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`,
    data.slug, data.title, data.heading, data.lead, data.description, data.body, data.scene, data.seed,
    data.in_footer ? 1 : 0, data.published ? 1 : 0, data.updated_on ?? today(), by, now(), id
  );
  touchContent();
};

export const deletePage = (id: number) => {
  run("DELETE FROM pages WHERE id = ? AND system = 0", id);
  touchContent();
};
