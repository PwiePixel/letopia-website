import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { RARITIES, rarityOf } from "../../../shared/catalog.js";
import { spriteSvg } from "../../../shared/sprites.js";
import type { Item } from "../../repo/items.js";
import type { IngredientWithItem, Recipe } from "../../repo/recipes.js";
import { Icon, Layout, PageHero } from "./layout.js";

const Sprite: FC<{ sprite: string; color: string }> = ({ sprite, color }) => raw(spriteSvg(sprite, color));

const ItemCard: FC<{ item: Item }> = ({ item }) => {
  const r = rarityOf(item.rarity);
  const search = `${item.name} ${item.description} ${item.lore.join(" ")} ${item.type}`.toLowerCase();
  return (
    <article class="item-card reveal" id={item.slug} style={`--r:${r.color}`} data-rarity={item.rarity} data-type={item.type} data-text={search}>
      <div class="item-top">
        <div class="slot slot-lg"><Sprite sprite={item.sprite} color={item.color} /></div>
        <div class="mc-tip">
          <h3>{item.name}</h3>
          {item.lore.map(l => <span>{l}</span>)}
          <em>{r.name} · {item.type}</em>
        </div>
      </div>
      <p class="item-desc">{item.description}</p>
      <div class="item-foot">
        <span><Icon name="pin" />{item.origin}</span>
        {item.recipe_slug ? <a href={`/rezepte#${item.recipe_slug}`}>Rezept<Icon name="right" /></a> : null}
      </div>
    </article>
  );
};

export const ItemsPage: FC<{ origin: string; items: Item[] }> = ({ origin, items }) => {
  const types = [...new Set(items.map(i => i.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  return (
    <Layout
      title="Custom Items | Letopia.net"
      description="Alle Custom Items auf Letopia: Werkzeuge, Waffen, Möbel und Sammelstücke mit Seltenheit und Herkunft."
      nav="items"
      script="items"
      origin={origin}
      path="/items"
    >
      <PageHero
        scene="night"
        seed="schatzkammer"
        crumbs={["CityBuild", "Custom Items"]}
        heading={<>Custom <em>Items</em></>}
        lead="Werkzeuge, Möbel und Sammelstücke, die es nur auf Letopia gibt. Nichts davon kannst du im Shop kaufen."
      />
      <section class="page-body">
        <div class="wrap">
          <div class="toolbar reveal">
            <div class="toolbar-row">
              <label class="search-field">
                <Icon name="search" />
                <input type="search" id="item-q" placeholder="Item suchen …" autocomplete="off" aria-label="Items durchsuchen" />
              </label>
              <span class="result-count" id="item-count">{items.length} von {items.length} Items</span>
            </div>
            <div class="chip-row" id="rarity-filter">
              <button class="chip-btn on" data-group="rarity" data-value="alle">Alle Seltenheiten</button>
              {Object.entries(RARITIES).map(([key, r]) => (
                <button class="chip-btn" data-group="rarity" data-value={key} style={`--c:${r.color}`}><i></i>{r.name}</button>
              ))}
            </div>
            <div class="chip-row" id="type-filter">
              <button class="chip-btn on" data-group="type" data-value="alle">Alle Typen</button>
              {types.map(t => <button class="chip-btn" data-group="type" data-value={t}>{t}</button>)}
            </div>
          </div>

          <div class="item-grid" id="item-list">
            {items.map(item => <ItemCard item={item} />)}
            <p class="empty" id="item-empty" hidden={items.length > 0}>
              {items.length ? "Keine Items gefunden. Probier einen anderen Filter." : "Hier sind noch keine Items eingetragen."}
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

const ARROW = `<svg class="craft-arrow" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 6h8V3h1v1h1v1h1v1h1v1h1v2h-1v1h-1v1h-1v1h-1v1H9v-3H1z"/></svg>`;

const RecipeCard: FC<{ recipe: Recipe; ingredients: Map<number, IngredientWithItem> }> = ({ recipe, ingredients }) => {
  const r = rarityOf(recipe.item_rarity);
  const need = new Map<number, number>();
  for (const id of recipe.grid) if (id && ingredients.has(id)) need.set(id, (need.get(id) ?? 0) + 1);
  const search = `${recipe.item_name} ${recipe.grid.map(id => (id ? ingredients.get(id)?.name ?? "" : "")).join(" ")}`.toLowerCase();

  return (
    <article class="recipe reveal" id={recipe.slug} style={`--r:${r.color}`} data-text={search}>
      <header>
        <h3>{recipe.item_name}</h3>
        <span class="rarity-tag">{r.name}</span>
      </header>
      <div class="craft">
        <div class="craft-grid">
          {recipe.grid.map(id => {
            const part = id ? ingredients.get(id) : undefined;
            if (!part) return <span class="slot"></span>;
            return part.item_slug ? (
              <a class="slot" href={`/items#${part.item_slug}`} data-tip={part.name}><Sprite sprite={part.sprite} color={part.color} /></a>
            ) : (
              <span class="slot" tabindex={0} data-tip={part.name}><Sprite sprite={part.sprite} color={part.color} /></span>
            );
          })}
        </div>
        {raw(ARROW)}
        <a class="slot slot-out" href={`/items#${recipe.item_slug}`} data-tip={recipe.item_name}>
          <Sprite sprite={recipe.item_sprite} color={recipe.item_color} />
          {recipe.amount > 1 ? <b>{recipe.amount}</b> : null}
        </a>
      </div>
      <ul class="needs">
        {[...need.entries()].map(([id, n]) => <li><span>{n}×</span>{ingredients.get(id)?.name}</li>)}
      </ul>
      {recipe.hint ? <p class="recipe-note"><Icon name="info" />{recipe.hint}</p> : null}
    </article>
  );
};

export const RecipesPage: FC<{ origin: string; recipes: Recipe[]; ingredients: IngredientWithItem[] }> = ({ origin, recipes, ingredients }) => {
  const byId = new Map(ingredients.map(i => [i.id, i]));
  return (
    <Layout
      title="Crafting-Rezepte | Letopia.net"
      description="So craftest du die Custom Items von Letopia – alle Rezepte mit Zutaten."
      nav="rezepte"
      script="recipes"
      origin={origin}
      path="/rezepte"
    >
      <PageHero
        scene="dusk"
        seed="werkstatt"
        crumbs={["CityBuild", "Crafting-Rezepte"]}
        heading={<>Crafting-<em>Rezepte</em></>}
        lead="So stellst du Custom Items an der normalen Werkbank her. Fahr mit der Maus über eine Zutat, um ihren Namen zu sehen."
      />
      <section class="page-body">
        <div class="wrap">
          <div class="toolbar reveal">
            <div class="toolbar-row">
              <label class="search-field">
                <Icon name="search" />
                <input type="search" id="recipe-q" placeholder="Rezept oder Zutat suchen …" autocomplete="off" aria-label="Rezepte durchsuchen" />
              </label>
              <a class="feat-more" href="/items">Alle Custom Items<Icon name="right" /></a>
            </div>
          </div>
          <div class="recipe-grid" id="recipe-list">
            {recipes.map(r => <RecipeCard recipe={r} ingredients={byId} />)}
            <p class="empty" id="recipe-empty" hidden={recipes.length > 0}>
              {recipes.length ? "Kein Rezept gefunden." : "Hier sind noch keine Rezepte eingetragen."}
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};
