import { all, get, now, run } from "../db/database.js";
import { touchContent } from "./cache.js";
import { nextPosition } from "./order.js";

export interface ItemRow {
  id: number;
  slug: string;
  name: string;
  type: string;
  rarity: string;
  sprite: string;
  color: string;
  lore: string;
  description: string;
  origin: string;
  position: number;
  published: number;
  created_at: number;
  updated_at: number;
}

export interface Item extends Omit<ItemRow, "lore"> {
  lore: string[];
  recipe_slug: string | null;
}

const parseLore = (value: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const toItem = (row: ItemRow & { recipe_slug: string | null }): Item => ({ ...row, lore: parseLore(row.lore) });

const SELECT = `SELECT i.*, (SELECT r.slug FROM recipes r WHERE r.item_id = i.id AND r.published = 1 ORDER BY r.position LIMIT 1) AS recipe_slug FROM items i`;

export const listItems = (publishedOnly = false) =>
  all<ItemRow & { recipe_slug: string | null }>(`${SELECT}${publishedOnly ? " WHERE i.published = 1" : ""} ORDER BY i.position, i.id`).map(toItem);

export const getItem = (id: number) => {
  const row = get<ItemRow & { recipe_slug: string | null }>(`${SELECT} WHERE i.id = ?`, id);
  return row ? toItem(row) : undefined;
};

export const getItemBySlug = (slug: string) => get<ItemRow>("SELECT * FROM items WHERE slug = ?", slug);

export interface ItemInput {
  slug: string;
  name: string;
  type: string;
  rarity: string;
  sprite: string;
  color: string;
  lore: string[];
  description: string;
  origin: string;
  published: boolean;
}

export const createItem = (data: ItemInput) => {
  const t = now();
  const { lastId } = run(
    `INSERT INTO items (slug, name, type, rarity, sprite, color, lore, description, origin, position, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.name, data.type, data.rarity, data.sprite, data.color, JSON.stringify(data.lore),
    data.description, data.origin, nextPosition("items"), data.published ? 1 : 0, t, t
  );
  touchContent();
  return lastId;
};

export const updateItem = (id: number, data: ItemInput) => {
  run(
    `UPDATE items SET slug = ?, name = ?, type = ?, rarity = ?, sprite = ?, color = ?, lore = ?, description = ?, origin = ?, published = ?, updated_at = ?
     WHERE id = ?`,
    data.slug, data.name, data.type, data.rarity, data.sprite, data.color, JSON.stringify(data.lore),
    data.description, data.origin, data.published ? 1 : 0, now(), id
  );
  touchContent();
};

export const deleteItem = (id: number) => {
  run("DELETE FROM items WHERE id = ?", id);
  touchContent();
};

export const itemTypes = () => all<{ type: string }>("SELECT DISTINCT type FROM items WHERE type <> '' ORDER BY type").map(r => r.type);

export const countItems = () => Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM items")?.n ?? 0);
