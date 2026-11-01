import type { Child, FC } from "hono/jsx";
import { raw } from "hono/html";
import { ROLES } from "../../../shared/catalog.js";
import { asset } from "../../assets.js";
import { countByStatus } from "../../repo/applications.js";
import { headName, type User } from "../../repo/users.js";
import { can, type Area } from "../../routes/admin/auth.js";
import { ADMIN_SPRITE } from "../icons.js";

export const Icon: FC<{ name: string; filled?: boolean }> = ({ name, filled }) => (
  <svg class={filled ? "i f" : "i"} aria-hidden="true"><use href={`#i-${name}`} /></svg>
);

export const headSrc = (name: string) => `/api/kopf/${encodeURIComponent(name || "Steve")}`;

export const Head: FC<{ name: string; size?: number }> = ({ name, size = 40 }) => (
  <img class="kopf" src={headSrc(name)} alt="" width={size} height={size} loading="lazy" data-fallback="/assets/img/head.png" />
);

export const Csrf: FC<{ token: string }> = ({ token }) => <input type="hidden" name="_csrf" value={token} />;

interface NavItem {
  href: string;
  key: string;
  icon: string;
  label: string;
  area?: Area;
  badge?: () => number;
}

const NAV: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ href: "/admin", key: "dashboard", icon: "gauge", label: "Übersicht" }] },
  {
    title: "Community",
    items: [{ href: "/admin/bewerbungen", key: "bewerbungen", icon: "send", label: "Bewerbungen", area: "applications", badge: () => countByStatus().neu ?? 0 }]
  },
  {
    title: "Inhalte",
    items: [
      { href: "/admin/wiki", key: "wiki", icon: "book", label: "Wiki", area: "content" },
      { href: "/admin/seiten", key: "seiten", icon: "file", label: "Regeln & Seiten", area: "content" },
      { href: "/admin/team", key: "team", icon: "users", label: "Team", area: "content" },
      { href: "/admin/items", key: "items", icon: "gem", label: "Custom Items", area: "content" },
      { href: "/admin/rezepte", key: "rezepte", icon: "hammer", label: "Rezepte", area: "content" },
      { href: "/admin/voten", key: "voten", icon: "star", label: "Voten", area: "content" },
      { href: "/admin/medien", key: "medien", icon: "image", label: "Medien", area: "content" }
    ]
  },
  {
    title: "System",
    items: [
      { href: "/admin/einstellungen", key: "einstellungen", icon: "settings", label: "Einstellungen", area: "system" },
      { href: "/admin/benutzer", key: "benutzer", icon: "key", label: "Benutzer", area: "system" },
      { href: "/admin/protokoll", key: "protokoll", icon: "history", label: "Protokoll", area: "system" }
    ]
  }
];

export interface AdminLayoutProps {
  title: string;
  user: User;
  active: string;
  csrf: string;
  flash?: { text: string; type: "ok" | "fehler" } | null;
  children?: Child;
}

export const AdminLayout: FC<AdminLayoutProps> = ({ title, user, active, csrf, flash, children }) => (
  <>
    {raw("<!DOCTYPE html>")}
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="csrf-token" content={csrf} />
        <title>{title} | Letopia Admin</title>
        <link rel="icon" type="image/png" href="/assets/img/favicon.png" />
        <link rel="stylesheet" href={asset("css/admin.css")} />
        <script type="module" src={asset("js/admin.js")}></script>
      </head>
      <body class="mit-menue">
        {raw(ADMIN_SPRITE)}
        <header class="top">
          <button class="menue-knopf" type="button" aria-label="Menü" aria-expanded="false" data-menue><Icon name="menu" /></button>
          <a class="logo" href="/admin"><img src="/assets/img/mark.png" alt="" width={30} height={30} /><span>Letopia <b>Admin</b></span></a>
          <div class="wer-bin-ich">
            <a class="leise-link" href="/" target="_blank" rel="noopener"><Icon name="external" /><span>Website</span></a>
            <a class="ich" href="/admin/profil" title="Profil & Sicherheit">
              <Head name={headName(user)} size={28} />
              <span><b>{user.username}</b><small>{ROLES[user.role]?.label ?? user.role}</small></span>
            </a>
            <form method="post" action="/admin/logout">
              <Csrf token={csrf} />
              <button class="knopf leise" type="submit" title="Abmelden"><Icon name="logout" /><span>Abmelden</span></button>
            </form>
          </div>
        </header>
        <div class="rahmen">
          <nav class="seitenleiste" id="seitenleiste" aria-label="Admin-Navigation">
            {NAV.map(group => {
              const items = group.items.filter(i => !i.area || can(user, i.area));
              if (!items.length) return null;
              return (
                <div class="nav-gruppe">
                  {group.title ? <h6>{group.title}</h6> : null}
                  {items.map(i => {
                    const badge = i.badge?.() ?? 0;
                    return (
                      <a href={i.href} class={active === i.key ? "aktiv" : undefined}>
                        <Icon name={i.icon} />
                        <span>{i.label}</span>
                        {badge > 0 ? <em>{badge}</em> : null}
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <main class="inhalt">
            {flash ? <div class={`meldung ${flash.type}`} role="status">{flash.text}</div> : null}
            {children}
          </main>
        </div>
      </body>
    </html>
  </>
);

/** Schlichtes Layout für Login, Einrichtung und 2FA. */
export const BareLayout: FC<{ title: string; children?: Child }> = ({ title, children }) => (
  <>
    {raw("<!DOCTYPE html>")}
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{title} | Letopia Admin</title>
        <link rel="icon" type="image/png" href="/assets/img/favicon.png" />
        <link rel="stylesheet" href={asset("css/admin.css")} />
        <script type="module" src={asset("js/admin.js")}></script>
      </head>
      <body>
        {raw(ADMIN_SPRITE)}
        <main class="mitte">{children}</main>
      </body>
    </html>
  </>
);

export const PageHead: FC<{ title: Child; sub?: Child; children?: Child; back?: { href: string; label: string } }> = ({ title, sub, children, back }) => (
  <div class="kopfzeile">
    <div>
      {back ? <a class="zurueck" href={back.href}>← {back.label}</a> : null}
      <h1>{title}</h1>
      {sub ? <p>{sub}</p> : null}
    </div>
    {children ? <div class="aktionen">{children}</div> : null}
  </div>
);

export const Card: FC<{ title?: Child; class?: string; id?: string; actions?: Child; children?: Child }> = p => (
  <section class={`karte${p.class ? ` ${p.class}` : ""}`} id={p.id}>
    {p.title || p.actions ? (
      <header class="karte-kopf">
        {p.title ? <h2>{p.title}</h2> : null}
        {p.actions ? <div class="aktionen">{p.actions}</div> : null}
      </header>
    ) : null}
    {p.children}
  </section>
);

export const Field: FC<{ label: Child; hint?: Child; full?: boolean; children?: Child; for?: string }> = p => (
  <label class={`feld${p.full ? " voll" : ""}`} for={p.for}>
    <span class="feld-name">{p.label}</span>
    {p.children}
    {p.hint ? <small class="feld-hinweis">{p.hint}</small> : null}
  </label>
);

export const Toggle: FC<{ name: string; checked: boolean; label: Child; hint?: Child }> = p => (
  <label class="schalter">
    <input type="checkbox" name={p.name} checked={p.checked} />
    <span class="schalter-bahn" aria-hidden="true"></span>
    <span class="schalter-text">{p.label}{p.hint ? <small>{p.hint}</small> : null}</span>
  </label>
);

export const Empty: FC<{ title: string; text?: Child; children?: Child }> = p => (
  <div class="leer">
    <h2>{p.title}</h2>
    {p.text ? <p>{p.text}</p> : null}
    {p.children}
  </div>
);

export const Badge: FC<{ color: string; children?: Child }> = p => <span class={`status ${p.color}`}>{p.children}</span>;

/** Kleine Formular-Buttons zum Verschieben in einer Liste. */
export const MoveButtons: FC<{ table: string; id: number; csrf: string; back: string }> = p => (
  <form method="post" action="/admin/sortieren" class="verschieben">
    <Csrf token={p.csrf} />
    <input type="hidden" name="tabelle" value={p.table} />
    <input type="hidden" name="id" value={String(p.id)} />
    <input type="hidden" name="zurueck" value={p.back} />
    <button class="mini-knopf" type="submit" name="richtung" value="hoch" title="Nach oben"><Icon name="up" /></button>
    <button class="mini-knopf runter" type="submit" name="richtung" value="runter" title="Nach unten"><Icon name="up" /></button>
  </form>
);

export const DeleteButton: FC<{ action: string; csrf: string; confirm: string; label?: string; small?: boolean }> = p => (
  <form method="post" action={p.action} data-confirm={p.confirm} class="inline">
    <Csrf token={p.csrf} />
    {p.small ? (
      <button class="mini-knopf gefahr" type="submit" title={p.label ?? "Löschen"}><Icon name="trash" /></button>
    ) : (
      <button class="knopf rot" type="submit"><Icon name="trash" />{p.label ?? "Löschen"}</button>
    )}
  </form>
);

export const Pager: FC<{ page: number; pages: number; href: (page: number) => string }> = ({ page, pages, href }) =>
  pages > 1 ? (
    <nav class="blaettern" aria-label="Seiten">
      {page > 1 ? <a class="knopf leise" href={href(page - 1)}>← Zurück</a> : <span></span>}
      <span>Seite {page} von {pages}</span>
      {page < pages ? <a class="knopf leise" href={href(page + 1)}>Weiter →</a> : <span></span>}
    </nav>
  ) : null;

const TOOLBAR: { cmd: string; label: string; title: string }[] = [
  { cmd: "h2", label: "H2", title: "Überschrift" },
  { cmd: "h3", label: "H3", title: "Unterüberschrift" },
  { cmd: "bold", label: "F", title: "Fett" },
  { cmd: "italic", label: "K", title: "Kursiv" },
  { cmd: "mark", label: "==", title: "Markiert" },
  { cmd: "code", label: "/", title: "Befehl / Code" },
  { cmd: "link", label: "Link", title: "Link" },
  { cmd: "wiki", label: "[[ ]]", title: "Wiki-Link" },
  { cmd: "ul", label: "•", title: "Liste" },
  { cmd: "ol", label: "1.", title: "Nummerierte Liste" },
  { cmd: "table", label: "Tabelle", title: "Tabelle" },
  { cmd: "tipp", label: "Tipp", title: "Tipp-Box" },
  { cmd: "info", label: "Info", title: "Info-Box" },
  { cmd: "achtung", label: "Achtung", title: "Warn-Box" },
  { cmd: "image", label: "Bild", title: "Bild einfügen" }
];

/** Markdown-Editor mit Werkzeugleiste und Live-Vorschau (Vorschau wird serverseitig gerendert). */
export const MarkdownEditor: FC<{ name: string; value: string; rows?: number; label?: string }> = p => (
  <div class="editor" data-editor>
    <div class="editor-leiste">
      <span class="editor-titel">{p.label ?? "Inhalt (Markdown)"}</span>
      <div class="editor-knoepfe">
        {TOOLBAR.map(t => <button type="button" data-cmd={t.cmd} title={t.title}>{t.label}</button>)}
      </div>
      <div class="editor-ansicht" role="tablist">
        <button type="button" data-view="split" class="an">Geteilt</button>
        <button type="button" data-view="edit">Text</button>
        <button type="button" data-view="preview">Vorschau</button>
      </div>
    </div>
    <div class="editor-flaeche" data-mode="split">
      <textarea name={p.name} rows={p.rows ?? 24} spellcheck={true} data-markdown>{p.value}</textarea>
      <div class="editor-vorschau vorschau-prosa" data-preview aria-live="polite"></div>
    </div>
    <details class="editor-hilfe">
      <summary>Formatierungshilfe</summary>
      <div class="hilfe-raster">
        <code>## Überschrift</code><span>Abschnitt (landet im Inhaltsverzeichnis)</span>
        <code>**fett**  *kursiv*  ==markiert==</code><span>Hervorhebungen</span>
        <code>`/befehl`</code><span>Befehl – auf der Website per Klick kopierbar</span>
        <code>[[grundstuecke]]  [[grundstuecke|Text]]</code><span>Link auf einen Wiki-Artikel</span>
        <code>[Text](https://…)</code><span>Normaler Link</span>
        <code>![Beschreibung](/uploads/bild.png)</code><span>Bild (Upload unter „Medien“)</span>
        <code>&gt; [!TIPP] / [!INFO] / [!ACHTUNG]</code><span>Hinweis-Box, Text in den folgenden &gt;-Zeilen</span>
        <code>{"{{Platzhalter}}"}</code><span>Gelb umrandeter Platzhalter (z. B. im Impressum)</span>
        <code>| A | B |</code><span>Tabelle (zweite Zeile: | --- | --- |)</span>
      </div>
    </details>
  </div>
);

export const SpritePicker: FC<{ sprites: readonly string[]; sprite: string; color: string; nameSprite?: string; nameColor?: string }> = p => (
  <div class="sprite-wahl" data-sprite-picker>
    <div class="slot-vorschau" data-sprite-preview></div>
    <label class="feld">
      <span class="feld-name">Pixel-Icon</span>
      <select name={p.nameSprite ?? "sprite"} data-sprite-select>
        {p.sprites.map(s => <option value={s} selected={s === p.sprite}>{s}</option>)}
      </select>
    </label>
    <label class="feld">
      <span class="feld-name">Farbe</span>
      <input type="color" name={p.nameColor ?? "color"} value={p.color} data-sprite-color />
    </label>
  </div>
);
