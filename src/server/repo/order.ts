import { all, get, run, transaction } from "../db/database.js";

/** Tabellen mit manueller Reihenfolge (Spalte position) und optionaler Gruppierungsspalte. */
const ORDERABLE = {
  wiki_categories: null,
  wiki_articles: "category_id",
  team_groups: null,
  team_members: "group_id",
  items: null,
  ingredients: null,
  recipes: null,
  vote_sites: null,
  pages: null
} as const;

export type OrderableTable = keyof typeof ORDERABLE;

export const isOrderableTable = (value: string): value is OrderableTable => Object.hasOwn(ORDERABLE, value);

const scopeClause = (table: OrderableTable, scopeValue: number | null) => {
  const column = ORDERABLE[table];
  if (!column) return { sql: "", params: [] as (number | null)[] };
  return scopeValue === null
    ? { sql: ` WHERE ${column} IS NULL`, params: [] }
    : { sql: ` WHERE ${column} = ?`, params: [scopeValue] };
};

/** Nächste freie Position am Ende der Liste. */
export const nextPosition = (table: OrderableTable, scopeValue: number | null = null): number => {
  const scope = scopeClause(table, scopeValue);
  const row = get<{ n: number | null }>(`SELECT MAX(position) AS n FROM ${table}${scope.sql}`, ...scope.params);
  return Number(row?.n ?? 0) + 1;
};

/** Verschiebt einen Eintrag um eine Stelle nach oben (-1) oder unten (+1). */
export const moveRow = (table: OrderableTable, id: number, direction: -1 | 1): boolean =>
  transaction(() => {
    const column = ORDERABLE[table];
    const row = get<Record<string, number | null>>(`SELECT id${column ? `, ${column} AS scope` : ""} FROM ${table} WHERE id = ?`, id);
    if (!row) return false;
    const scope = scopeClause(table, column ? (row.scope ?? null) : null);
    const ids = all<{ id: number }>(`SELECT id FROM ${table}${scope.sql} ORDER BY position, id`, ...scope.params).map(r => r.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ids.length) return false;
    [ids[index], ids[target]] = [ids[target] as number, ids[index] as number];
    ids.forEach((rowId, k) => run(`UPDATE ${table} SET position = ? WHERE id = ?`, k + 1, rowId));
    return true;
  });
