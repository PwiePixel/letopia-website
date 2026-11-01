import { Hono } from "hono";
import { raw } from "hono/html";
import { isRarity, RARITIES, rarityOf, SLUG_PATTERN, slugify } from "../../../shared/catalog.js";
import { isHexColor, SPRITE_NAMES, spriteSvg } from "../../../shared/sprites.js";
import type { AppEnv, Ctx } from "../../http.js";
import { audit } from "../../repo/audit.js";
import { createItem, deleteItem, getItem, getItemBySlug, itemTypes, listItems, updateItem, type ItemInput } from "../../repo/items.js";
import {
  createIngredient,
  createRecipe,
  deleteIngredient,
  deleteRecipe,
  getIngredient,
  getRecipe,
  getRecipeBySlug,
  ingredientUsage,
  listIngredients,
  listRecipes,
  updateIngredient,
  updateRecipe,
  type IngredientInput,
  type RecipeInput
} from "../../repo/recipes.js";
import { Card, Csrf, DeleteButton, Empty, Field, Icon, MoveButtons, PageHead, SpritePicker, Toggle } from "../../views/admin/ui.js";
import { actor, csrfToken, flash, requireArea } from "./auth.js";
import { bool, formBody, int, lines, str, text, type Body } from "./form.js";
import { view } from "./render.js";

export const catalogRoutes = new Hono<AppEnv>();

for (const prefix of ["/items", "/rezepte"]) {
  catalogRoutes.use(prefix, requireArea("content"));
  catalogRoutes.use(`${prefix}/*`, requireArea("content"));
}

const Px = (p: { sprite: string; color: string }) => <span class="px-icon">{raw(spriteSvg(p.sprite, p.color))}</span>;

const sprite = (value: string) => (SPRITE_NAMES.includes(value) ? value : "block");
const color = (value: string) => (isHexColor(value) ? value.toLowerCase() : "#cccccc");

// --- Items ---------------------------------------------------------------------------------------------------

catalogRoutes.get("/items", c => {
  const csrf = csrfToken(c);
  const items = listItems();
  return view(
    c,
    "Custom Items",
    "items",
    <>
      <PageHead title="Custom Items" sub={`${items.length} Items`}>
        <a class="knopf leise" href="/items" target="_blank" rel="noopener"><Icon name="external" />Items-Seite ansehen</a>
        <a class="knopf" href="/admin/items/neu"><Icon name="plus" />Neues Item</a>
      </PageHead>
      {items.length ? (
        <Card>
          <div class="tabelle">
            {items.map(i => {
              const r = rarityOf(i.rarity);
              return (
                <div class="tabelle-zeile">
                  <Px sprite={i.sprite} color={i.color} />
                  <div class="haupt">
                    <a href={`/admin/items/${i.id}`}><strong>{i.name}</strong></a>
                    <small><span style={`color:${r.color}`}>{r.name}</span> · {i.type || "ohne Typ"} · {i.origin || "keine Herkunft"}{i.recipe_slug ? " · hat Rezept" : ""}</small>
                  </div>
                  {i.published ? null : <span class="status grau">Versteckt</span>}
                  <div class="werkzeuge">
                    <MoveButtons table="items" id={i.id} csrf={csrf} back="/admin/items" />
                    <a class="mini-knopf" href={`/admin/items/${i.id}`} title="Bearbeiten"><Icon name="pencil" /></a>
                    <DeleteButton action={`/admin/items/${i.id}/loeschen`} csrf={csrf} confirm={`Item „${i.name}“ löschen? Rezepte für dieses Item werden ebenfalls gelöscht.`} small />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : <Empty title="Noch keine Items" text="Leg das erste Custom Item an." />}
    </>
  );
});

interface ItemState extends ItemInput {
  id?: number;
}

const ItemEditor = (p: { c: Ctx; state: ItemState; error?: string }) => {
  const s = p.state;
  const types = itemTypes();
  return (
    <>
      <PageHead title={s.id ? s.name : "Neues Item"} back={{ href: "/admin/items", label: "Custom Items" }}>
        {s.id && s.published ? <a class="knopf leise" href={`/items#${s.slug}`} target="_blank" rel="noopener"><Icon name="eye" />Ansehen</a> : null}
      </PageHead>
      {p.error ? <div class="meldung fehler">{p.error}</div> : null}
      <form method="post" action={s.id ? `/admin/items/${s.id}` : "/admin/items"} class="bearbeiten" data-unsaved>
        <Csrf token={csrfToken(p.c)} />
        <div class="raster-seite">
          <Card>
            <div class="formular-raster">
              <Field label="Name" full>
                <input name="name" value={s.name} required maxlength={80} data-slug-source={s.id ? undefined : ""} />
              </Field>
              <Field label="Kennung" hint="Für Links wie /items#kennung.">
                <input name="slug" value={s.slug} maxlength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" data-slug-target={s.id ? undefined : "auto"} />
              </Field>
              <Field label="Typ" hint="z. B. Werkzeug, Waffe, Möbel">
                <input name="type" value={s.type} maxlength={40} list="item-typen" />
                <datalist id="item-typen">{types.map(t => <option value={t}></option>)}</datalist>
              </Field>
              <Field label="Seltenheit">
                <select name="rarity">
                  {Object.entries(RARITIES).map(([k, r]) => <option value={k} selected={s.rarity === k}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Herkunft" hint="Wie man das Item bekommt.">
                <input name="origin" value={s.origin} maxlength={120} />
              </Field>
              <Field label="Lore" hint="Eine Zeile pro Eintrag (z. B. Verzauberungen)." full>
                <textarea name="lore" rows={3}>{s.lore.join("\n")}</textarea>
              </Field>
              <Field label="Beschreibung" full>
                <textarea name="description" rows={4} maxlength={600}>{s.description}</textarea>
              </Field>
              <div class="feld voll">
                <Toggle name="published" checked={s.published} label="Auf der Website anzeigen" />
              </div>
            </div>
          </Card>
          <aside>
            <Card title="Aussehen">
              <SpritePicker sprites={SPRITE_NAMES} sprite={s.sprite} color={s.color} />
              <p class="klein">Das Icon wird aus 16×16 Pixeln in der gewählten Farbe erzeugt.</p>
            </Card>
          </aside>
        </div>
        <div class="speicherleiste">
          <button class="knopf" type="submit"><Icon name="check" />Speichern</button>
          <span class="klein" data-unsaved-hint hidden>Ungespeicherte Änderungen</span>
        </div>
      </form>
      {s.id ? (
        <div class="unter-formular">
          <DeleteButton action={`/admin/items/${s.id}/loeschen`} csrf={csrfToken(p.c)} confirm={`Item „${s.name}“ löschen?`} label="Item löschen" />
        </div>
      ) : null}
    </>
  );
};

const readItem = (body: Body, id?: number): { state: ItemState; error?: string } => {
  const name = str(body, "name", 80);
  const slug = slugify(str(body, "slug", 80) || name).slice(0, 80);
  const rarity = str(body, "rarity", 20);
  const state: ItemState = {
    id,
    name,
    slug,
    type: str(body, "type", 40),
    rarity: isRarity(rarity) ? rarity : "gewoehnlich",
    sprite: sprite(str(body, "sprite", 20)),
    color: color(str(body, "color", 7)),
    lore: lines(body, "lore", 8, 80),
    description: text(body, "description", 600).replace(/\s+/g, " ").trim(),
    origin: str(body, "origin", 120),
    published: bool(body, "published")
  };
  if (!name) return { state, error: "Bitte gib einen Namen an." };
  if (!SLUG_PATTERN.test(slug)) return { state, error: "Die Kennung darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten." };
  const other = getItemBySlug(slug);
  if (other && other.id !== id) return { state, error: `Die Kennung „${slug}“ ist schon vergeben („${other.name}“).` };
  return { state };
};

catalogRoutes.get("/items/neu", c =>
  view(c, "Neues Item", "items", <ItemEditor c={c} state={{ name: "", slug: "", type: "", rarity: "selten", sprite: "sword", color: "#f0a830", lore: [], description: "", origin: "Crafting", published: true }} />)
);

catalogRoutes.post("/items", async c => {
  const { state, error } = readItem(await formBody(c));
  if (error) return view(c, "Neues Item", "items", <ItemEditor c={c} state={state} error={error} />, 422);
  const id = createItem(state);
  audit(actor(c), "item.angelegt", state.name);
  flash(c, `Item „${state.name}“ angelegt.`);
  return c.redirect(`/admin/items/${id}`);
});

catalogRoutes.get("/items/:id{[0-9]+}", c => {
  const item = getItem(Number(c.req.param("id")));
  if (!item) return c.redirect("/admin/items");
  return view(c, item.name, "items", <ItemEditor c={c} state={{ ...item, published: Boolean(item.published) }} />);
});

catalogRoutes.post("/items/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  if (!getItem(id)) return c.redirect("/admin/items");
  const { state, error } = readItem(await formBody(c), id);
  if (error) return view(c, state.name || "Item", "items", <ItemEditor c={c} state={state} error={error} />, 422);
  updateItem(id, state);
  audit(actor(c), "item.geaendert", state.name);
  flash(c, "Item gespeichert.");
  return c.redirect(`/admin/items/${id}`);
});

catalogRoutes.post("/items/:id{[0-9]+}/loeschen", c => {
  const item = getItem(Number(c.req.param("id")));
  if (item) {
    deleteItem(item.id);
    audit(actor(c), "item.geloescht", item.name);
    flash(c, `Item „${item.name}“ gelöscht.`);
  }
  return c.redirect("/admin/items");
});

// --- Rezepte -------------------------------------------------------------------------------------------------

catalogRoutes.get("/rezepte", c => {
  const csrf = csrfToken(c);
  const recipes = listRecipes();
  const ingredients = new Map(listIngredients().map(g => [g.id, g]));
  return view(
    c,
    "Rezepte",
    "rezepte",
    <>
      <PageHead title="Crafting-Rezepte" sub={`${recipes.length} Rezepte · ${ingredients.size} Zutaten`}>
        <a class="knopf leise" href="/admin/rezepte/zutaten"><Icon name="grid" />Zutaten verwalten</a>
        <a class="knopf" href="/admin/rezepte/neu"><Icon name="plus" />Neues Rezept</a>
      </PageHead>
      {recipes.length ? (
        <Card>
          <div class="tabelle">
            {recipes.map(r => (
              <div class="tabelle-zeile">
                <div class="mini-raster">
                  {r.grid.map(id => {
                    const g = id ? ingredients.get(id) : undefined;
                    return <span title={g?.name}>{g ? raw(spriteSvg(g.sprite, g.color)) : null}</span>;
                  })}
                </div>
                <Icon name="right" />
                <Px sprite={r.item_sprite} color={r.item_color} />
                <div class="haupt">
                  <a href={`/admin/rezepte/${r.id}`}><strong>{r.item_name}</strong>{r.amount > 1 ? ` ×${r.amount}` : ""}</a>
                  <small>#{r.slug}{r.hint ? ` · ${r.hint}` : ""}</small>
                </div>
                {r.published ? null : <span class="status grau">Versteckt</span>}
                <div class="werkzeuge">
                  <MoveButtons table="recipes" id={r.id} csrf={csrf} back="/admin/rezepte" />
                  <a class="mini-knopf" href={`/admin/rezepte/${r.id}`} title="Bearbeiten"><Icon name="pencil" /></a>
                  <DeleteButton action={`/admin/rezepte/${r.id}/loeschen`} csrf={csrf} confirm={`Rezept für „${r.item_name}“ löschen?`} small />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : <Empty title="Noch keine Rezepte" text="Ein Rezept verweist auf ein Custom Item und belegt das 3×3-Werkbankraster mit Zutaten." />}
    </>
  );
});

interface RecipeState extends RecipeInput {
  id?: number;
}

const RecipeEditor = (p: { c: Ctx; state: RecipeState; error?: string }) => {
  const s = p.state;
  const items = listItems();
  const ingredients = listIngredients();
  const data = ingredients.map(g => ({ id: g.id, name: g.name, sprite: g.sprite, color: g.color }));
  const itemData = items.map(i => ({ id: i.id, name: i.name, sprite: i.sprite, color: i.color }));
  return (
    <>
      <PageHead title={s.id ? "Rezept bearbeiten" : "Neues Rezept"} back={{ href: "/admin/rezepte", label: "Rezepte" }}>
        {s.id && s.published ? <a class="knopf leise" href={`/rezepte#${s.slug}`} target="_blank" rel="noopener"><Icon name="eye" />Ansehen</a> : null}
      </PageHead>
      {p.error ? <div class="meldung fehler">{p.error}</div> : null}
      {!items.length ? <div class="meldung fehler">Lege zuerst ein Custom Item an – ein Rezept stellt immer ein Item her.</div> : null}
      <form method="post" action={s.id ? `/admin/rezepte/${s.id}` : "/admin/rezepte"} class="bearbeiten" data-unsaved data-recipe-editor>
        <Csrf token={csrfToken(p.c)} />
        <script type="application/json" data-recipe-data>{raw(JSON.stringify({ ingredients: data, items: itemData }).replace(/</g, "\\u003c"))}</script>
        <div class="raster-seite">
          <Card title="Werkbank">
            <div class="werkbank">
              <div class="werkbank-raster">
                {s.grid.map((value, k) => (
                  <select name={`slot${k}`} aria-label={`Feld ${k + 1}`} data-slot>
                    <option value="">–</option>
                    {ingredients.map(g => <option value={String(g.id)} selected={value === g.id}>{g.name}</option>)}
                  </select>
                ))}
              </div>
              <div class="werkbank-vorschau" aria-hidden="true">
                <div class="vorschau-raster" data-grid-preview></div>
                <Icon name="right" />
                <div class="vorschau-ergebnis" data-result-preview></div>
              </div>
            </div>
            <p class="klein">Jedes Feld entspricht einem Slot der Werkbank. Fehlt eine Zutat? <a href="/admin/rezepte/zutaten">Zutaten verwalten</a></p>
          </Card>
          <aside>
            <Card title="Ergebnis">
              <div class="formular">
                <Field label="Item">
                  <select name="item_id" required data-result>
                    {items.map(i => <option value={String(i.id)} selected={s.item_id === i.id}>{i.name}</option>)}
                  </select>
                </Field>
                <Field label="Menge">
                  <input type="number" name="amount" value={String(s.amount)} min={1} max={64} />
                </Field>
                <Field label="Kennung" hint="Für Links wie /rezepte#kennung. Leer = wie das Item.">
                  <input name="slug" value={s.slug} maxlength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
                </Field>
                <Field label="Hinweis" hint="Optional, z. B. Voraussetzungen.">
                  <input name="hint" value={s.hint} maxlength={200} />
                </Field>
                <Toggle name="published" checked={s.published} label="Auf der Website anzeigen" />
              </div>
            </Card>
          </aside>
        </div>
        <div class="speicherleiste">
          <button class="knopf" type="submit" disabled={!items.length}><Icon name="check" />Speichern</button>
          <span class="klein" data-unsaved-hint hidden>Ungespeicherte Änderungen</span>
        </div>
      </form>
    </>
  );
};

const readRecipe = (body: Body, id?: number): { state: RecipeState; error?: string } => {
  const itemId = Number(str(body, "item_id", 12));
  const item = getItem(itemId);
  const slug = slugify(str(body, "slug", 80) || item?.slug || "").slice(0, 80);
  const known = new Set(listIngredients().map(g => g.id));
  const grid = Array.from({ length: 9 }, (_, k) => {
    const v = Number(str(body, `slot${k}`, 12));
    return known.has(v) ? v : null;
  });
  const state: RecipeState = { id, slug, item_id: itemId, amount: int(body, "amount", 1, 1, 64), grid, hint: str(body, "hint", 200), published: bool(body, "published") };
  if (!item) return { state, error: "Bitte wähle das Item, das hergestellt wird." };
  if (!SLUG_PATTERN.test(slug)) return { state, error: "Die Kennung darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten." };
  const other = getRecipeBySlug(slug);
  if (other && other.id !== id) return { state, error: `Die Kennung „${slug}“ ist schon vergeben.` };
  if (!grid.some(Boolean)) return { state, error: "Belege mindestens ein Feld der Werkbank." };
  return { state };
};

catalogRoutes.get("/rezepte/neu", c =>
  view(c, "Neues Rezept", "rezepte", <RecipeEditor c={c} state={{ slug: "", item_id: listItems()[0]?.id ?? 0, amount: 1, grid: Array(9).fill(null), hint: "", published: true }} />)
);

catalogRoutes.post("/rezepte", async c => {
  const { state, error } = readRecipe(await formBody(c));
  if (error) return view(c, "Neues Rezept", "rezepte", <RecipeEditor c={c} state={state} error={error} />, 422);
  const id = createRecipe(state);
  audit(actor(c), "rezept.angelegt", state.slug);
  flash(c, "Rezept angelegt.");
  return c.redirect(`/admin/rezepte/${id}`);
});

catalogRoutes.get("/rezepte/:id{[0-9]+}", c => {
  const r = getRecipe(Number(c.req.param("id")));
  if (!r) return c.redirect("/admin/rezepte");
  return view(c, `Rezept ${r.item_name}`, "rezepte", <RecipeEditor c={c} state={{ id: r.id, slug: r.slug, item_id: r.item_id, amount: r.amount, grid: r.grid, hint: r.hint, published: Boolean(r.published) }} />);
});

catalogRoutes.post("/rezepte/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  if (!getRecipe(id)) return c.redirect("/admin/rezepte");
  const { state, error } = readRecipe(await formBody(c), id);
  if (error) return view(c, "Rezept", "rezepte", <RecipeEditor c={c} state={state} error={error} />, 422);
  updateRecipe(id, state);
  audit(actor(c), "rezept.geaendert", state.slug);
  flash(c, "Rezept gespeichert.");
  return c.redirect(`/admin/rezepte/${id}`);
});

catalogRoutes.post("/rezepte/:id{[0-9]+}/loeschen", c => {
  const r = getRecipe(Number(c.req.param("id")));
  if (r) {
    deleteRecipe(r.id);
    audit(actor(c), "rezept.geloescht", r.slug);
    flash(c, `Rezept für „${r.item_name}“ gelöscht.`);
  }
  return c.redirect("/admin/rezepte");
});

// --- Zutaten -------------------------------------------------------------------------------------------------

const readIngredient = (body: Body): IngredientInput => {
  const itemId = Number(str(body, "item_id", 12));
  return {
    name: str(body, "name", 60),
    sprite: sprite(str(body, "sprite", 20)),
    color: color(str(body, "color", 7)),
    item_id: itemId && getItem(itemId) ? itemId : null
  };
};

catalogRoutes.get("/rezepte/zutaten", c => {
  const csrf = csrfToken(c);
  const ingredients = listIngredients();
  const items = listItems();
  const usage = ingredientUsage();

  const Row = (p: { action: string; g?: IngredientInput; submit: unknown }) => (
    <form method="post" action={p.action} class="zutat-formular" data-sprite-picker>
      <Csrf token={csrf} />
      <span class="slot-vorschau klein-slot" data-sprite-preview></span>
      <input name="name" value={p.g?.name ?? ""} required maxlength={60} placeholder="Name" aria-label="Name" />
      <select name="sprite" aria-label="Pixel-Icon" data-sprite-select>
        {SPRITE_NAMES.map(s => <option value={s} selected={(p.g?.sprite ?? "block") === s}>{s}</option>)}
      </select>
      <input type="color" name="color" value={p.g?.color ?? "#cccccc"} aria-label="Farbe" data-sprite-color />
      <select name="item_id" aria-label="Verknüpftes Item">
        <option value="">kein Item (Vanilla-Zutat)</option>
        {items.map(i => <option value={String(i.id)} selected={p.g?.item_id === i.id}>{i.name}</option>)}
      </select>
      {p.submit}
    </form>
  );

  return view(
    c,
    "Zutaten",
    "rezepte",
    <>
      <PageHead title="Zutaten" sub="Zutaten können in beliebig vielen Rezepten verwendet werden." back={{ href: "/admin/rezepte", label: "Rezepte" }} />
      <Card>
        <div class="tabelle">
          {ingredients.map(g => (
            <div class="tabelle-zeile mit-formular">
              <Row action={`/admin/rezepte/zutaten/${g.id}`} g={g} submit={<button class="mini-knopf" type="submit" title="Speichern"><Icon name="check" /></button>} />
              <small class="nutzung">{usage.get(g.id) ?? 0}× genutzt</small>
              <div class="werkzeuge">
                <MoveButtons table="ingredients" id={g.id} csrf={csrf} back="/admin/rezepte/zutaten" />
                <DeleteButton action={`/admin/rezepte/zutaten/${g.id}/loeschen`} csrf={csrf} confirm={`Zutat „${g.name}“ löschen? Sie verschwindet aus allen Rezepten.`} small />
              </div>
            </div>
          ))}
        </div>
        <h3 class="unterueberschrift">Neue Zutat</h3>
        <Row action="/admin/rezepte/zutaten" submit={<button class="knopf" type="submit"><Icon name="plus" />Hinzufügen</button>} />
        <p class="klein">Ist eine Zutat mit einem Custom Item verknüpft, führt ein Klick im Rezept zu diesem Item.</p>
      </Card>
    </>
  );
});

catalogRoutes.post("/rezepte/zutaten", async c => {
  const data = readIngredient(await formBody(c));
  if (data.name) {
    createIngredient(data);
    audit(actor(c), "zutat.angelegt", data.name);
    flash(c, `Zutat „${data.name}“ hinzugefügt.`);
  }
  return c.redirect("/admin/rezepte/zutaten");
});

catalogRoutes.post("/rezepte/zutaten/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  const data = readIngredient(await formBody(c));
  if (getIngredient(id) && data.name) {
    updateIngredient(id, data);
    audit(actor(c), "zutat.geaendert", data.name);
    flash(c, "Zutat gespeichert.");
  }
  return c.redirect("/admin/rezepte/zutaten");
});

catalogRoutes.post("/rezepte/zutaten/:id{[0-9]+}/loeschen", c => {
  const g = getIngredient(Number(c.req.param("id")));
  if (g) {
    deleteIngredient(g.id);
    audit(actor(c), "zutat.geloescht", g.name);
    flash(c, `Zutat „${g.name}“ gelöscht.`);
  }
  return c.redirect("/admin/rezepte/zutaten");
});
