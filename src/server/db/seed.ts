import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { isCategoryIcon, isRarity, slugify } from "../../shared/catalog.js";
import { isHexColor, SPRITE_NAMES } from "../../shared/sprites.js";
import { config } from "../config.js";
import { frontMatter } from "../lib/markdown.js";
import { log } from "../log.js";
import { createItem, getItemBySlug } from "../repo/items.js";
import { createPage, getPageBySlug } from "../repo/pages.js";
import { createIngredient, createRecipe } from "../repo/recipes.js";
import { getInternal, saveSettings, setInternal } from "../repo/settings.js";
import { createGroup, createMember } from "../repo/team.js";
import { createVoteSite } from "../repo/votes.js";
import { createArticle, createCategory } from "../repo/wiki.js";
import { get, transaction } from "./database.js";

const read = (file: string) => readFileSync(path.join(config.contentDir, file), "utf8");
const readJson = <T>(file: string): T => JSON.parse(read(file)) as T;
const has = (file: string) => existsSync(path.join(config.contentDir, file));

const SEED_USER = "Installation";

const sprite = (value: unknown) => (typeof value === "string" && SPRITE_NAMES.includes(value) ? value : "block");
const color = (value: unknown, fallback = "#cccccc") => (isHexColor(value) ? value.toLowerCase() : fallback);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const seedWiki = () => {
  if (!has("wiki/index.json")) return;
  const index = readJson<{ kategorien?: { name: string; icon?: string; artikel?: string[] }[] }>("wiki/index.json");
  for (const cat of index.kategorien ?? []) {
    const categoryId = createCategory({ name: cat.name, icon: isCategoryIcon(cat.icon) ? cat.icon : "book" });
    for (const slug of cat.artikel ?? []) {
      if (!has(`wiki/${slug}.md`)) continue;
      const { meta, body } = frontMatter(read(`wiki/${slug}.md`));
      createArticle(
        {
          slug: slugify(slug),
          title: meta.titel || slug,
          description: meta.beschreibung ?? "",
          body: body.trim() + "\n",
          category_id: categoryId,
          published: true,
          updated_on: /^\d{4}-\d{2}-\d{2}$/.test(meta.aktualisiert ?? "") ? (meta.aktualisiert ?? null) : null
        },
        SEED_USER
      );
    }
  }
};

const seedPages = () => {
  if (has("regeln.md") && !getPageBySlug("regeln")) {
    const { meta, body } = frontMatter(read("regeln.md"));
    createPage(
      {
        slug: "regeln",
        title: "Regeln",
        heading: "Server*regeln*",
        lead: "Damit sich alle wohlfühlen: Was auf Letopia gilt – und was passiert, wenn sich jemand nicht daran hält.",
        description: "Die Serverregeln von Letopia für den Minecraft-Server und den Discord.",
        body: body.trim() + "\n",
        scene: "dawn",
        seed: "regeln-gericht",
        in_footer: false,
        published: true,
        updated_on: meta.aktualisiert ?? null
      },
      SEED_USER,
      true
    );
  }

  const dir = path.join(config.contentDir, "seiten");
  if (!existsSync(dir)) return;
  const preferred = ["impressum.md", "datenschutz.md", "agb.md"];
  const files = readdirSync(dir)
    .filter(f => f.endsWith(".md"))
    .sort((a, b) => {
      const ia = preferred.indexOf(a);
      const ib = preferred.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
  for (const file of files) {
    const slug = slugify(file.replace(/\.md$/, ""));
    if (getPageBySlug(slug)) continue;
    const { meta, body } = frontMatter(read(`seiten/${file}`));
    createPage(
      {
        slug,
        title: meta.titel || slug,
        heading: meta.ueberschrift ?? "",
        lead: meta.lead ?? "",
        description: meta.beschreibung ?? "",
        body: body.trim() + "\n",
        scene: meta.szene ?? "night",
        seed: meta.seed ?? slug,
        in_footer: /^(ja|true|1)$/i.test(meta.footer ?? ""),
        published: true,
        updated_on: null
      },
      SEED_USER,
      ["impressum", "datenschutz", "agb"].includes(slug)
    );
  }
};

const seedTeam = () => {
  if (!has("team.json")) return;
  const data = readJson<{ stand?: string; gruppen?: { rang: string; farbe?: string; mitglieder?: { name: string; rolle?: string; seit?: string; info?: string }[] }[] }>("team.json");
  for (const group of data.gruppen ?? []) {
    const groupId = createGroup({ name: group.rang, color: color(group.farbe, "#f0a830") });
    for (const m of group.mitglieder ?? []) {
      createMember({ group_id: groupId, name: m.name, role: text(m.rolle), since: text(m.seit), info: text(m.info) });
    }
  }
  if (data.stand) saveSettings("team", { stand: data.stand });
};

interface LegacyItem {
  id: string;
  name: string;
  typ?: string;
  seltenheit?: string;
  sprite?: string;
  farbe?: string;
  lore?: string[];
  beschreibung?: string;
  herkunft?: string;
}

const seedItems = () => {
  if (!has("items.json")) return;
  for (const item of readJson<LegacyItem[]>("items.json")) {
    createItem({
      slug: slugify(item.id),
      name: item.name,
      type: text(item.typ),
      rarity: isRarity(item.seltenheit) ? item.seltenheit : "gewoehnlich",
      sprite: sprite(item.sprite),
      color: color(item.farbe),
      lore: (item.lore ?? []).filter(l => typeof l === "string"),
      description: text(item.beschreibung),
      origin: text(item.herkunft),
      published: true
    });
  }
};

interface LegacyRecipes {
  zutaten?: Record<string, { name: string; sprite?: string; farbe?: string; item?: string }>;
  rezepte?: { id: string; ergebnis: string; menge?: number; raster?: string[]; hinweis?: string }[];
}

const seedRecipes = () => {
  if (!has("rezepte.json")) return;
  const data = readJson<LegacyRecipes>("rezepte.json");
  const keys = new Map<string, number>();
  for (const [key, z] of Object.entries(data.zutaten ?? {})) {
    const linked = z.item ? getItemBySlug(slugify(z.item)) : undefined;
    keys.set(key, createIngredient({ name: z.name, sprite: sprite(z.sprite), color: color(z.farbe), item_id: linked?.id ?? null }));
  }
  for (const r of data.rezepte ?? []) {
    const item = getItemBySlug(slugify(r.ergebnis));
    if (!item) continue;
    const grid = (r.raster ?? []).slice(0, 3).flatMap(row => row.padEnd(3).slice(0, 3).split("")).map(k => keys.get(k) ?? null);
    while (grid.length < 9) grid.push(null);
    createRecipe({ slug: slugify(r.id), item_id: item.id, amount: Math.max(1, Math.min(64, r.menge ?? 1)), grid, hint: text(r.hinweis), published: true });
  }
};

const seedVotes = () => {
  for (const site of [
    { name: "minecraft-server.eu", reward: "500 Coins + 1 Vote-Kiste" },
    { name: "minecraft-serverlist.net", reward: "500 Coins + 1 Vote-Kiste" },
    { name: "serverliste.net", reward: "300 Coins" }
  ]) {
    createVoteSite({ name: site.name, url: "#", reward: site.reward, active: true });
  }
};

/** Füllt eine leere Datenbank mit den Inhalten aus content/ (einmalig). */
export const seedIfEmpty = (): boolean => {
  if (getInternal("seeded")) return false;
  const used = get<{ n: number }>(
    "SELECT (SELECT COUNT(*) FROM wiki_articles) + (SELECT COUNT(*) FROM items) + (SELECT COUNT(*) FROM team_members) + (SELECT COUNT(*) FROM pages) AS n"
  );
  if (Number(used?.n ?? 0) > 0) {
    setInternal("seeded", new Date().toISOString());
    return false;
  }
  transaction(() => {
    seedWiki();
    seedPages();
    seedTeam();
    seedItems();
    seedRecipes();
    seedVotes();
    setInternal("seeded", new Date().toISOString());
  });
  log.info("Startinhalte importiert (Wiki, Regeln, Seiten, Team, Items, Rezepte, Vote-Seiten).");
  return true;
};
