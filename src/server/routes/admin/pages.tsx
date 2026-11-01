import { Hono } from "hono";
import { isScene, SCENES, SLUG_PATTERN, slugify } from "../../../shared/catalog.js";
import { today } from "../../db/database.js";
import type { AppEnv, Ctx } from "../../http.js";
import { audit } from "../../repo/audit.js";
import { createPage, deletePage, getPage, getPageBySlug, listPages, RESERVED_SLUGS, updatePage, type PageInput } from "../../repo/pages.js";
import { shortDate } from "../../views/format.js";
import { Card, Csrf, DeleteButton, Field, Icon, MarkdownEditor, MoveButtons, PageHead, Toggle } from "../../views/admin/ui.js";
import { actor, csrfToken, flash } from "./auth.js";
import { bool, formBody, isoDate, str, text, type Body } from "./form.js";
import { view } from "./render.js";

export const pageRoutes = new Hono<AppEnv>();

const pageUrl = (slug: string) => `/${slug}`;

pageRoutes.get("/", c => {
  const csrf = csrfToken(c);
  const pages = listPages();
  return view(
    c,
    "Regeln & Seiten",
    "seiten",
    <>
      <PageHead title="Regeln & Seiten" sub="Serverregeln, Impressum, Datenschutz, AGB und eigene Seiten.">
        <a class="knopf" href="/admin/seiten/neu"><Icon name="plus" />Neue Seite</a>
      </PageHead>
      <Card>
        <div class="tabelle">
          {pages.map(p => (
            <div class="tabelle-zeile">
              <div class="haupt">
                <a href={`/admin/seiten/${p.id}`}><strong>{p.title}</strong></a>
                <small>{pageUrl(p.slug)}{p.updated_on ? ` · Stand ${shortDate(p.updated_on)}` : ""}{p.updated_by ? ` · ${p.updated_by}` : ""}</small>
              </div>
              {p.system ? <span class="status blau">Fest</span> : null}
              {p.in_footer ? <span class="status grau">Footer</span> : null}
              {p.published ? null : <span class="status gelb">Entwurf</span>}
              <div class="werkzeuge">
                {p.system ? null : <MoveButtons table="pages" id={p.id} csrf={csrf} back="/admin/seiten" />}
                {p.published ? <a class="mini-knopf" href={pageUrl(p.slug)} target="_blank" rel="noopener" title="Ansehen"><Icon name="eye" /></a> : null}
                <a class="mini-knopf" href={`/admin/seiten/${p.id}`} title="Bearbeiten"><Icon name="pencil" /></a>
                {p.system ? null : <DeleteButton action={`/admin/seiten/${p.id}/loeschen`} csrf={csrf} confirm={`Seite „${p.title}“ wirklich löschen?`} small />}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <p class="klein">Feste Seiten (Regeln, Impressum, Datenschutz, AGB) können bearbeitet, aber nicht gelöscht werden. Gelb umrandete <code>{"{{Platzhalter}}"}</code> in den Rechtstexten vor dem Livegang ausfüllen.</p>
    </>
  );
});

interface EditorState extends PageInput {
  id?: number;
  system: boolean;
  bumpDate: boolean;
}

const Editor = (p: { c: Ctx; state: EditorState; error?: string }) => {
  const { state } = p;
  const csrf = csrfToken(p.c);
  const isRules = state.slug === "regeln" && state.system;
  return (
    <>
      <PageHead title={state.id ? state.title || "Seite bearbeiten" : "Neue Seite"} back={{ href: "/admin/seiten", label: "Regeln & Seiten" }}>
        {state.id && state.published ? <a class="knopf leise" href={pageUrl(state.slug)} target="_blank" rel="noopener"><Icon name="eye" />Ansehen</a> : null}
      </PageHead>
      {p.error ? <div class="meldung fehler">{p.error}</div> : null}
      <form method="post" action={state.id ? `/admin/seiten/${state.id}` : "/admin/seiten"} class="bearbeiten" data-unsaved>
        <Csrf token={csrf} />
        <Card>
          <div class="formular-raster">
            <Field label="Titel" hint="Für Browser-Tab, Footer und Brotkrumen.">
              <input name="title" value={state.title} required maxlength={80} data-slug-source={state.system ? undefined : ""} />
            </Field>
            <Field label="Adresse" hint={state.system ? "Feste Seite – Adresse kann nicht geändert werden." : "Nur Kleinbuchstaben, Zahlen und Bindestriche."}>
              <div class="praefix"><span>/</span><input name="slug" value={state.slug} maxlength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={state.system} data-slug-target={state.id ? undefined : "auto"} /></div>
            </Field>
            <Field label="Überschrift" hint="Große Überschrift im Seitenkopf. *Wort* wird orange hervorgehoben." full>
              <input name="heading" value={state.heading} maxlength={120} placeholder={state.title} />
            </Field>
            <Field label="Einleitung" hint="Kurzer Text unter der Überschrift (optional)." full>
              <input name="lead" value={state.lead} maxlength={300} />
            </Field>
            <Field label="Beschreibung für Suchmaschinen" full>
              <input name="description" value={state.description} maxlength={300} />
            </Field>
            <Field label="Hintergrund-Szene">
              <select name="scene">
                {Object.entries(SCENES).map(([k, v]) => <option value={k} selected={state.scene === k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Szenen-Seed" hint="Beliebiges Wort – jedes ergibt eine andere Pixelstadt.">
              <input name="seed" value={state.seed} maxlength={40} />
            </Field>
            <Field label={isRules ? "Zuletzt geändert am" : "Stand"}>
              <input type="date" name="updated_on" value={state.updated_on ?? ""} />
            </Field>
            <div class="feld schalter-feld">
              <Toggle name="bump" checked={state.bumpDate} label="Datum beim Speichern auf heute setzen" />
              {isRules ? null : <Toggle name="in_footer" checked={state.in_footer} label="Im Footer unter „Rechtliches“ verlinken" />}
              {state.system ? null : <Toggle name="published" checked={state.published} label="Veröffentlicht" />}
            </div>
          </div>
        </Card>
        <MarkdownEditor name="body" value={state.body} />
        <div class="speicherleiste">
          <button class="knopf" type="submit"><Icon name="check" />Speichern</button>
          <span class="klein" data-unsaved-hint hidden>Ungespeicherte Änderungen</span>
        </div>
      </form>
      {state.id && !state.system ? (
        <div class="unter-formular">
          <DeleteButton action={`/admin/seiten/${state.id}/loeschen`} csrf={csrf} confirm={`Seite „${state.title}“ wirklich löschen?`} label="Seite löschen" />
        </div>
      ) : null}
    </>
  );
};

const readPage = (body: Body, existing?: { id: number; slug: string; system: number }): { state: EditorState; error?: string } => {
  const system = Boolean(existing?.system);
  const title = str(body, "title", 80);
  const slug = system && existing ? existing.slug : slugify(str(body, "slug", 60) || title).slice(0, 60);
  const scene = str(body, "scene", 10);
  const bumpDate = bool(body, "bump");
  const state: EditorState = {
    id: existing?.id,
    system,
    slug,
    title,
    heading: str(body, "heading", 120),
    lead: str(body, "lead", 300),
    description: str(body, "description", 300),
    body: text(body, "body", 200_000),
    scene: isScene(scene) ? scene : "night",
    seed: str(body, "seed", 40) || slug,
    in_footer: bool(body, "in_footer"),
    published: system ? true : bool(body, "published"),
    updated_on: bumpDate ? today() : isoDate(body, "updated_on"),
    bumpDate
  };
  if (!title) return { state, error: "Bitte gib einen Titel an." };
  if (!system) {
    if (!SLUG_PATTERN.test(slug)) return { state, error: "Die Adresse darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten." };
    if (RESERVED_SLUGS.has(slug)) return { state, error: `Die Adresse /${slug} ist von der Website belegt. Bitte wähle eine andere.` };
    const other = getPageBySlug(slug);
    if (other && other.id !== existing?.id) return { state, error: `Die Adresse /${slug} ist schon vergeben („${other.title}“).` };
  }
  return { state };
};

pageRoutes.get("/neu", c => {
  const state: EditorState = {
    system: false,
    slug: "",
    title: "",
    heading: "",
    lead: "",
    description: "",
    body: "## Überschrift\n\nText der Seite …\n",
    scene: "night",
    seed: "",
    in_footer: false,
    published: true,
    updated_on: today(),
    bumpDate: true
  };
  return view(c, "Neue Seite", "seiten", <Editor c={c} state={state} />);
});

pageRoutes.post("/", async c => {
  const { state, error } = readPage(await formBody(c));
  if (error) return view(c, "Neue Seite", "seiten", <Editor c={c} state={state} error={error} />, 422);
  const id = createPage(state, actor(c).username);
  audit(actor(c), "seite.angelegt", state.title);
  flash(c, `Seite „${state.title}“ angelegt.`);
  return c.redirect(`/admin/seiten/${id}`);
});

pageRoutes.get("/:id{[0-9]+}", c => {
  const p = getPage(Number(c.req.param("id")));
  if (!p) return c.redirect("/admin/seiten");
  const state: EditorState = {
    id: p.id,
    system: Boolean(p.system),
    slug: p.slug,
    title: p.title,
    heading: p.heading,
    lead: p.lead,
    description: p.description,
    body: p.body,
    scene: p.scene,
    seed: p.seed,
    in_footer: Boolean(p.in_footer),
    published: Boolean(p.published),
    updated_on: p.updated_on,
    bumpDate: true
  };
  return view(c, p.title, "seiten", <Editor c={c} state={state} />);
});

pageRoutes.post("/:id{[0-9]+}", async c => {
  const existing = getPage(Number(c.req.param("id")));
  if (!existing) return c.redirect("/admin/seiten");
  const { state, error } = readPage(await formBody(c), existing);
  if (error) return view(c, state.title || "Seite", "seiten", <Editor c={c} state={state} error={error} />, 422);
  updatePage(existing.id, state, actor(c).username);
  audit(actor(c), "seite.geaendert", state.title);
  flash(c, "Seite gespeichert.");
  return c.redirect(`/admin/seiten/${existing.id}`);
});

pageRoutes.post("/:id{[0-9]+}/loeschen", c => {
  const p = getPage(Number(c.req.param("id")));
  if (p && !p.system) {
    deletePage(p.id);
    audit(actor(c), "seite.geloescht", p.title);
    flash(c, `Seite „${p.title}“ gelöscht.`);
  }
  return c.redirect("/admin/seiten");
});
