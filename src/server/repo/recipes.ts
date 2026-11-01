import { all, get, now, run } from "../db/database.js";
import { touchContent } from "./cache.js";
import { nextPosition } from "./order.js";

export interface Ingredient {
  id: number;
  name: string;
  sprite: string;
  color: string;
  item_id: number | null;
  position: number;
}

export interface IngredientWithItem extends Ingredient {
  item_slug: string | null;
  item_name: string | null;
}

export interface RecipeRow {
  id: number;
  slug: string;
  item_id: number;
  amount: number;
  grid: string;
  hint: string;
  position: number;
  published: number;
  created_at: number;
  updated_at: number;
}

export interface Recipe extends Omit<RecipeRow, "grid"> {
  grid: (number | null)[];
  item_slug: string;
  item_name: string;
  item_sprite: string;
  item_color: string;
  item_rarity: string;
}

export const parseGrid = (value: string): (number | null)[] => {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = [];
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return Array.from({ length: 9 }, (_, k) => {
    const v = list[k];
    return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
  });
};

export const listIngredients = () =>
  all<IngredientWithItem>(
    `SELECT g.*, i.slug AS item_slug, i.name AS item_name FROM ingredients g
     LEFT JOIN items i ON i.id = g.item_id ORDER BY g.position, g.id`
  );

export const getIngredient = (id: number) => get<Ingredient>("SELECT * FROM ingredients WHERE id = ?", id);

export interface IngredientInput {
  name: string;
  sprite: string;
  color: string;
  item_id: number | null;
}

export const createIngredient = (data: IngredientInput) => {
  const { lastId } = run(
    "INSERT INTO ingredients (name, sprite, color, item_id, position) VALUES (?, ?, ?, ?, ?)",
    data.name, data.sprite, data.color, data.item_id, nextPosition("ingredients")
  );
  touchContent();
  return lastId;
};

export const updateIngredient = (id: number, data: IngredientInput) => {
  run("UPDATE ingredients SET name = ?, sprite = ?, color = ?, item_id = ? WHERE id = ?", data.name, data.sprite, data.color, data.item_id, id);
  touchContent();
};

export const deleteIngredient = (id: number) => {
  run("DELETE FROM ingredients WHERE id = ?", id);
  touchContent();
};

/** Wie oft eine Zutat in Rezepten vorkommt. */
export const ingredientUsage = (): Map<number, number> => {
  const usage = new Map<number, number>();
  for (const r of all<{ grid: string }>("SELECT grid FROM recipes")) {
    for (const id of parseGrid(r.grid)) if (id) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
};

const SELECT = `SELECT r.*, i.slug AS item_slug, i.name AS item_name, i.sprite AS item_sprite, i.color AS item_color, i.rarity AS item_rarity
  FROM recipes r JOIN items i ON i.id = r.item_id`;

type RecipeJoined = RecipeRow & Pick<Recipe, "item_slug" | "item_name" | "item_sprite" | "item_color" | "item_rarity">;

const toRecipe = (row: RecipeJoined): Recipe => ({ ...row, grid: parseGrid(row.grid) });

export const listRecipes = (publishedOnly = false) =>
  all<RecipeJoined>(`${SELECT}${publishedOnly ? " WHERE r.published = 1" : ""} ORDER BY r.position, r.id`).map(toRecipe);

export const getRecipe = (id: number) => {
  const row = get<RecipeJoined>(`${SELECT} WHERE r.id = ?`, id);
  return row ? toRecipe(row) : undefined;
};

export const getRecipeBySlug = (slug: string) => get<RecipeRow>("SELECT * FROM recipes WHERE slug = ?", slug);

export interface RecipeInput {
  slug: string;
  item_id: number;
  amount: number;
  grid: (number | null)[];
  hint: string;
  published: boolean;
}

export const createRecipe = (data: RecipeInput) => {
  const t = now();
  const { lastId } = run(
    `INSERT INTO recipes (slug, item_id, amount, grid, hint, position, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.item_id, data.amount, JSON.stringify(data.grid), data.hint, nextPosition("recipes"), data.published ? 1 : 0, t, t
  );
  touchContent();
  return lastId;
};

export const updateRecipe = (id: number, data: RecipeInput) => {
  run(
    "UPDATE recipes SET slug = ?, item_id = ?, amount = ?, grid = ?, hint = ?, published = ?, updated_at = ? WHERE id = ?",
    data.slug, data.item_id, data.amount, JSON.stringify(data.grid), data.hint, data.published ? 1 : 0, now(), id
  );
  touchContent();
};

export const deleteRecipe = (id: number) => {
  run("DELETE FROM recipes WHERE id = ?", id);
  touchContent();
};
