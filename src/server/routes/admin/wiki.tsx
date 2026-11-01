import { Hono } from "hono";
import { CATEGORY_ICONS, isCategoryIcon, SLUG_PATTERN, slugify } from "../../../shared/catalog.js";
import { today } from "../../db/database.js";
import type { AppEnv, Ctx } from "../../http.js";
import { audit } from "../../repo/audit.js";
import {
  createArticle,
  createCategory,
  deleteArticle,
  deleteCategory,
  getArticle,
  getArticleBySlug,
  getCategory,
  listArticles,
  listCategories,
  updateArticle,
  updateCategory,
  type ArticleInput
} from "../../repo/wiki.js";
import { shortDate } from "../../views/format.js";
import { Card, Csrf, DeleteButton, Empty, Field, Icon, MarkdownEditor, MoveButtons, PageHead, Toggle } from "../../views/admin/ui.js";
import { actor, csrfToken, flash } from "./auth.js";
import { bool, formBody, isoDate, str, text, type Body } from "./form.js";
import { view } from "./render.js";

export const wikiRoutes = new Hono<AppEnv>();

// --- Übersicht -------------------------------------------------------------------------------------------

wikiRoutes.get("/", c => {
  const csrf = csrfToken(c);
  const categories = listCategories();
  const articles = listArticles();
  const groups = [
    ...categories.map(cat => ({ cat, items: articles.filter(a => a.category_id === cat.id) })),
    { cat: null, items: articles.filter(a => a.category_id === null || !categories.some(cat => cat.id === a.category_id)) }
  ].filter(g => g.cat || g.items.length);

  return view(
    c,
    "Wiki",
    "wiki",
    <>
      <PageHead title="Wiki" sub={`${articles.length} Artikel in ${categories.length} Kategorien`}>
        <a class="knopf leise" href="/wiki" target="_blank" rel="noopener"><Icon name="external" />Wiki ansehen</a>
        <a class="knopf" href="/admin/wiki/neu"><Icon name="plus" />Neuer Artikel</a>
      </PageHead>

      <div class="raster-seite">
        <div>
          {groups.length ? groups.map(g => (
            <Card
              title={<>{g.cat ? <Icon name={g.cat.icon} /> : null}{g.cat?.name ?? "Ohne Kategorie"}</>}
              actions={g.cat ? <a class="knopf leise" href={`/admin/wiki/neu?kategorie=${g.cat.id}`}><Icon name="plus" />Artikel</a> : null}
            >
              {g.items.length ? (
                <div class="tabelle">
                  {g.items.map(a => (
                    <div class="tabelle-zeile">
                      <div class="haupt">
                        <a href={`/admin/wiki/${a.id}`}><strong>{a.title}</strong></a>
                        <small>/wiki/{a.slug}{a.updated_on ? ` · aktualisiert ${shortDate(a.updated_on)}` : ""}{a.updated_by ? ` von ${a.updated_by}` : ""}</small>
                      </div>
                      {a.published ? null : <span class="status grau">Entwurf</span>}
                      <div class="werkzeuge">
                        {g.cat ? <MoveButtons table="wiki_articles" id={a.id} csrf={csrf} back="/admin/wiki" /> : null}
                        {a.published ? <a class="mini-knopf" href={`/wiki/${a.slug}`} target="_blank" rel="noopener" title="Ansehen"><Icon name="eye" /></a> : null}
                        <a class="mini-knopf" href={`/admin/wiki/${a.id}`} title="Bearbeiten"><Icon name="pencil" /></a>
                        <DeleteButton action={`/admin/wiki/${a.id}/loeschen`} csrf={csrf} confirm={`Artikel „${a.title}“ wirklich löschen?`} small />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p class="klein">Noch keine Artikel in dieser Kategorie.</p>}
            </Card>
          )) : <Empty title="Noch keine Artikel" text="Lege zuerst eine Kategorie an und schreib dann den ersten Artikel." />}
        </div>

        <aside>
          <Card title="Kategorien">
            <div class="kategorien">
              {categories.map(cat => (
                <div class="kategorie">
                  <form method="post" action={`/admin/wiki/kategorien/${cat.id}`} class="zeilen-formular">
                    <Csrf token={csrf} />
                    <select name="icon" aria-label="Icon" class="icon-wahl">
                      {CATEGORY_ICONS.map(i => <option value={i} selected={cat.icon === i}>{i}</option>)}
                    </select>
                    <input name="name" value={cat.name} required maxlength={60} aria-label="Name" />
                    <button class="mini-knopf" type="submit" title="Speichern"><Icon name="check" /></button>
                  </form>
                  <MoveButtons table="wiki_categories" id={cat.id} csrf={csrf} back="/admin/wiki" />
                  <DeleteButton action={`/admin/wiki/kategorien/${cat.id}/loeschen`} csrf={csrf} confirm={`Kategorie „${cat.name}“ löschen? Die Artikel bleiben erhalten und landen unter „Ohne Kategorie“.`} small />
                </div>
              ))}
            </div>
            <form method="post" action="/admin/wiki/kategorien" class="zeilen-formular neu">
              <Csrf token={csrf} />
              <select name="icon" aria-label="Icon" class="icon-wahl">
                {CATEGORY_ICONS.map(i => <option value={i}>{i}</option>)}
              </select>
              <input name="name" required maxlength={60} placeholder="Neue Kategorie" aria-label="Name der neuen Kategorie" />
              <button class="mini-knopf" type="submit" title="Anlegen"><Icon name="plus" /></button>
            </form>
            <p class="klein">Das Icon erscheint in der Wiki-Navigation. Reihenfolge per Pfeil ändern.</p>
          </Card>
        </aside>
      </div>
    </>
  );
});

// --- Kategorien ------------------------------------------------------------------------------------------

const readCategory = (body: Body) => ({ name: str(body, "name", 60), icon: isCategoryIcon(str(body, "icon", 30)) ? str(body, "icon", 30) : "book" });

wikiRoutes.post("/kategorien", async c => {
  const data = readCategory(await formBody(c));
  if (!data.name) flash(c, "Bitte gib einen Namen für die Kategorie an.", "fehler");
  else {
    createCategory(data);
    audit(actor(c), "wiki.kategorie.angelegt", data.name);
    flash(c, `Kategorie „${data.name}“ angelegt.`);
  }
  return c.redirect("/admin/wiki");
});

wikiRoutes.post("/kategorien/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  const data = readCategory(await formBody(c));
  if (getCategory(id) && data.name) {
    updateCategory(id, data);
    audit(actor(c), "wiki.kategorie.geaendert", data.name);
    flash(c, "Kategorie gespeichert.");
  }
  return c.redirect("/admin/wiki");
});

wikiRoutes.post("/kategorien/:id{[0-9]+}/loeschen", c => {
  const id = Number(c.req.param("id"));
  const cat = getCategory(id);
  if (cat) {
    deleteCategory(id);
    audit(actor(c), "wiki.kategorie.geloescht", cat.name);
    flash(c, `Kategorie „${cat.name}“ gelöscht.`);
  }
  return c.redirect("/admin/wiki");
});

// --- Artikel-Editor ------------------------------------------------------------------------------------------

interface EditorState extends ArticleInput {
  id?: number;
  bumpDate: boolean;
}

const Editor = (p: { c: Ctx; state: EditorState; error?: string }) => {
  const { state } = p;
  const categories = listCategories();
  const csrf = csrfToken(p.c);
  const action = state.id ? `/admin/wiki/${state.id}` : "/admin/wiki";
  return (
    <>
      <PageHead title={state.id ? state.title || "Artikel bearbeiten" : "Neuer Artikel"} back={{ href: "/admin/wiki", label: "Wiki" }}>
        {state.id && state.published ? <a class="knopf leise" href={`/wiki/${state.slug}`} target="_blank" rel="noopener"><Icon name="eye" />Ansehen</a> : null}
      </PageHead>
      {p.error ? <div class="meldung fehler">{p.error}</div> : null}
      <form method="post" action={action} class="bearbeiten" data-unsaved>
        <Csrf token={csrf} />
        <Card>
          <div class="formular-raster">
            <Field label="Titel" full>
              <input name="title" value={state.title} required maxlength={120} data-slug-source autofocus={!state.id} />
            </Field>
            <Field label="Adresse" hint="Nur Kleinbuchstaben, Zahlen und Bindestriche.">
              <div class="praefix"><span>/wiki/</span><input name="slug" value={state.slug} maxlength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" data-slug-target={state.id ? undefined : "auto"} /></div>
            </Field>
            <Field label="Kategorie">
              <select name="category_id">
                <option value="">Ohne Kategorie</option>
                {categories.map(cat => <option value={String(cat.id)} selected={state.category_id === cat.id}>{cat.name}</option>)}
              </select>
            </Field>
            <Field label="Kurzbeschreibung" hint="Erscheint unter dem Titel, in der Suche und in Suchmaschinen." full>
              <input name="description" value={state.description} maxlength={300} />
            </Field>
            <Field label="Aktualisiert am">
              <input type="date" name="updated_on" value={state.updated_on ?? ""} />
            </Field>
            <div class="feld schalter-feld">
              <Toggle name="bump" checked={state.bumpDate} label="Datum beim Speichern auf heute setzen" />
              <Toggle name="published" checked={state.published} label="Veröffentlicht" hint="Entwürfe sind auf der Website unsichtbar." />
            </div>
          </div>
        </Card>
        <MarkdownEditor name="body" value={state.body} />
        <div class="speicherleiste">
          <button class="knopf" type="submit"><Icon name="check" />Speichern</button>
          <span class="klein" data-unsaved-hint hidden>Ungespeicherte Änderungen</span>
        </div>
      </form>
      {state.id ? (
        <div class="unter-formular">
          <DeleteButton action={`/admin/wiki/${state.id}/loeschen`} csrf={csrf} confirm={`Artikel „${state.title}“ wirklich löschen?`} label="Artikel löschen" />
        </div>
      ) : null}
    </>
  );
};

const readArticle = (body: Body, id?: number): { state: EditorState; error?: string } => {
  const title = str(body, "title", 120);
  const slug = slugify(str(body, "slug", 80) || title).slice(0, 80);
  const categoryRaw = str(body, "category_id", 12);
  const categoryId = categoryRaw && getCategory(Number(categoryRaw)) ? Number(categoryRaw) : null;
  const bumpDate = bool(body, "bump");
  const state: EditorState = {
    id,
    title,
    slug,
    category_id: categoryId,
    description: str(body, "description", 300),
    body: text(body, "body", 200_000),
    published: bool(body, "published"),
    updated_on: bumpDate ? today() : isoDate(body, "updated_on"),
    bumpDate
  };
  if (!title) return { state, error: "Bitte gib einen Titel an." };
  if (!SLUG_PATTERN.test(slug)) return { state, error: "Die Adresse darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten." };
  const existing = getArticleBySlug(slug);
  if (existing && existing.id !== id) return { state, error: `Die Adresse /wiki/${slug} ist schon vergeben („${existing.title}“).` };
  return { state };
};

wikiRoutes.get("/neu", c => {
  const cat = Number(c.req.query("kategorie") ?? "");
  const state: EditorState = {
    title: "",
    slug: "",
    category_id: getCategory(cat) ? cat : (listCategories()[0]?.id ?? null),
    description: "",
    body: "## Erster Abschnitt\n\nHier beginnt dein Artikel.\n",
    published: true,
    updated_on: today(),
    bumpDate: true
  };
  return view(c, "Neuer Artikel", "wiki", <Editor c={c} state={state} />);
});

wikiRoutes.post("/", async c => {
  const { state, error } = readArticle(await formBody(c));
  if (error) return view(c, "Neuer Artikel", "wiki", <Editor c={c} state={state} error={error} />, 422);
  const id = createArticle(state, actor(c).username);
  audit(actor(c), "wiki.artikel.angelegt", state.title);
  flash(c, `Artikel „${state.title}“ angelegt.`);
  return c.redirect(`/admin/wiki/${id}`);
});

wikiRoutes.get("/:id{[0-9]+}", c => {
  const a = getArticle(Number(c.req.param("id")));
  if (!a) {
    flash(c, "Diesen Artikel gibt es nicht mehr.", "fehler");
    return c.redirect("/admin/wiki");
  }
  const state: EditorState = {
    id: a.id,
    title: a.title,
    slug: a.slug,
    category_id: a.category_id,
    description: a.description,
    body: a.body,
    published: Boolean(a.published),
    updated_on: a.updated_on,
    bumpDate: true
  };
  return view(c, a.title, "wiki", <Editor c={c} state={state} />);
});

wikiRoutes.post("/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  if (!getArticle(id)) return c.redirect("/admin/wiki");
  const { state, error } = readArticle(await formBody(c), id);
  if (error) return view(c, state.title || "Artikel", "wiki", <Editor c={c} state={state} error={error} />, 422);
  updateArticle(id, state, actor(c).username);
  audit(actor(c), "wiki.artikel.geaendert", state.title);
  flash(c, "Artikel gespeichert.");
  return c.redirect(`/admin/wiki/${id}`);
});

wikiRoutes.post("/:id{[0-9]+}/loeschen", c => {
  const id = Number(c.req.param("id"));
  const a = getArticle(id);
  if (a) {
    deleteArticle(id);
    audit(actor(c), "wiki.artikel.geloescht", a.title);
    flash(c, `Artikel „${a.title}“ gelöscht.`);
  }
  return c.redirect("/admin/wiki");
});
