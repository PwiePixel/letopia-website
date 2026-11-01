import { all, get, now, run, today, transaction } from "../db/database.js";
import { plainText } from "../lib/markdown.js";
import { memo, touchContent } from "./cache.js";
import { nextPosition } from "./order.js";

export interface WikiCategory {
  id: number;
  name: string;
  icon: string;
  position: number;
}

export interface WikiArticle {
  id: number;
  slug: string;
  category_id: number | null;
  title: string;
  description: string;
  body: string;
  position: number;
  published: number;
  updated_on: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface WikiEntry {
  slug: string;
  title: string;
  description: string;
  updated: string;
  category: string;
  body: string;
  text: string;
}

export interface WikiTree {
  categories: { name: string; icon: string; items: WikiEntry[] }[];
  list: WikiEntry[];
  bySlug: Map<string, WikiEntry>;
}

export const listCategories = () => all<WikiCategory>("SELECT * FROM wiki_categories ORDER BY position, id");

export const getCategory = (id: number) => get<WikiCategory>("SELECT * FROM wiki_categories WHERE id = ?", id);

export const createCategory = (data: { name: string; icon: string }) => {
  const { lastId } = run(
    "INSERT INTO wiki_categories (name, icon, position) VALUES (?, ?, ?)",
    data.name, data.icon, nextPosition("wiki_categories")
  );
  touchContent();
  return lastId;
};

export const updateCategory = (id: number, data: { name: string; icon: string }) => {
  run("UPDATE wiki_categories SET name = ?, icon = ? WHERE id = ?", data.name, data.icon, id);
  touchContent();
};

export const deleteCategory = (id: number) => {
  run("DELETE FROM wiki_categories WHERE id = ?", id);
  touchContent();
};

export const listArticles = () =>
  all<WikiArticle & { category_name: string | null }>(
    `SELECT a.*, c.name AS category_name FROM wiki_articles a
     LEFT JOIN wiki_categories c ON c.id = a.category_id
     ORDER BY c.position IS NULL, c.position, a.position, a.id`
  );

export const getArticle = (id: number) => get<WikiArticle>("SELECT * FROM wiki_articles WHERE id = ?", id);

export const getArticleBySlug = (slug: string) => get<WikiArticle>("SELECT * FROM wiki_articles WHERE slug = ?", slug);

export interface ArticleInput {
  slug: string;
  title: string;
  description: string;
  body: string;
  category_id: number | null;
  published: boolean;
  updated_on: string | null;
}

export const createArticle = (data: ArticleInput, by: string) => {
  const t = now();
  const { lastId } = run(
    `INSERT INTO wiki_articles (slug, category_id, title, description, body, position, published, updated_on, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.category_id, data.title, data.description, data.body,
    nextPosition("wiki_articles", data.category_id), data.published ? 1 : 0,
    data.updated_on ?? today(), by, t, t
  );
  touchContent();
  return lastId;
};

export const updateArticle = (id: number, data: ArticleInput, by: string) =>
  transaction(() => {
    const before = getArticle(id);
    if (!before) return;
    const moved = before.category_id !== data.category_id;
    run(
      `UPDATE wiki_articles SET slug = ?, category_id = ?, title = ?, description = ?, body = ?, published = ?,
       updated_on = ?, updated_by = ?, updated_at = ?${moved ? ", position = ?" : ""} WHERE id = ?`,
      data.slug, data.category_id, data.title, data.description, data.body, data.published ? 1 : 0,
      data.updated_on ?? today(), by, now(),
      ...(moved ? [nextPosition("wiki_articles", data.category_id)] : []),
      id
    );
    touchContent();
  });

export const deleteArticle = (id: number) => {
  run("DELETE FROM wiki_articles WHERE id = ?", id);
  touchContent();
};

/** Veröffentlichte Artikel nach Kategorien – Grundlage für Navigation, Übersicht und Suche. */
export const wikiTree = (): WikiTree =>
  memo("wiki-tree", () => {
    const categories = listCategories();
    const articles = all<WikiArticle>("SELECT * FROM wiki_articles WHERE published = 1 ORDER BY position, id");
    const toEntry = (a: WikiArticle, category: string): WikiEntry => ({
      slug: a.slug,
      title: a.title,
      description: a.description,
      updated: a.updated_on ?? "",
      category,
      body: a.body,
      text: plainText(a.body)
    });

    const groups = categories
      .map(c => ({
        name: c.name,
        icon: c.icon,
        items: articles.filter(a => a.category_id === c.id).map(a => toEntry(a, c.name))
      }))
      .filter(g => g.items.length);

    const known = new Set(categories.map(c => c.id));
    const loose = articles.filter(a => a.category_id === null || !known.has(a.category_id));
    if (loose.length) groups.push({ name: "Weitere Artikel", icon: "book", items: loose.map(a => toEntry(a, "Weitere Artikel")) });

    const list = groups.flatMap(g => g.items);
    return { categories: groups, list, bySlug: new Map(list.map(e => [e.slug, e])) };
  });

export const countArticles = () => Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM wiki_articles")?.n ?? 0);
