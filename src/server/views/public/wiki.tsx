import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { renderMarkdown, type TocEntry } from "../../lib/markdown.js";
import { memo } from "../../repo/cache.js";
import { getSettings } from "../../repo/settings.js";
import type { WikiEntry, WikiTree } from "../../repo/wiki.js";
import { longDate, shortDate } from "../format.js";
import { Icon, Layout, linkProps } from "./layout.js";

export const wikiLink = (slug: string) => `/wiki/${slug}`;

export interface RenderedArticle {
  entry: WikiEntry;
  html: string;
  toc: TocEntry[];
  minutes: number;
}

export const renderArticle = (tree: WikiTree, entry: WikiEntry): RenderedArticle =>
  memo(`wiki-html:${entry.slug}`, () => {
    const { html, toc } = renderMarkdown(entry.body, {
      title: key => tree.bySlug.get(key)?.title,
      link: wikiLink,
      anchor: id => `#${id}`
    });
    return { entry, html, toc, minutes: Math.max(1, Math.round(entry.text.split(" ").length / 200)) };
  });

export const WikiNav: FC<{ tree: WikiTree; active: string | null }> = ({ tree, active }) => (
  <>
    <a href="/wiki" class={`wn-home${active === null ? " on" : ""}`} data-wiki><Icon name="home" />Übersicht</a>
    {tree.categories.map(c => (
      <div class="wn-cat">
        <h4><Icon name={c.icon} />{c.name}</h4>
        {c.items.map(a => (
          <a href={wikiLink(a.slug)} data-slug={a.slug} data-wiki class={a.slug === active ? "on" : undefined}>{a.title}</a>
        ))}
      </div>
    ))}
  </>
);

export const WikiHome: FC<{ tree: WikiTree }> = ({ tree }) => {
  const recent = [...tree.list].filter(a => a.updated).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 5);
  const start = tree.list[0];
  return (
    <div class="wiki-home">
      <div class="wh-intro">
        <h2>Willkommen im Wiki</h2>
        <p>
          Hier findest du Anleitungen, Befehle und Erklärungen zu allen Systemen auf Letopia.{" "}
          {start ? <>Neu auf dem Server? Fang am besten mit <a href={wikiLink(start.slug)} data-wiki>{start.title}</a> an.</> : null}
        </p>
      </div>
      <div class="wh-grid">
        {tree.categories.map(c => (
          <div class="wh-card">
            <div class="wh-head">
              <span class="wh-ico"><Icon name={c.icon} /></span>
              <div><h3>{c.name}</h3><small>{c.items.length} Artikel</small></div>
            </div>
            <ul>{c.items.map(a => <li><a href={wikiLink(a.slug)} data-wiki>{a.title}</a></li>)}</ul>
          </div>
        ))}
      </div>
      {recent.length ? (
        <div class="wh-recent">
          <h3>Zuletzt aktualisiert</h3>
          {recent.map(a => (
            <a href={wikiLink(a.slug)} data-wiki>
              <span>{a.title}</span>
              <small>{a.category} · {shortDate(a.updated)}</small>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const WikiArticle: FC<{ tree: WikiTree; article: RenderedArticle }> = ({ tree, article }) => {
  const { entry } = article;
  const pos = tree.list.findIndex(a => a.slug === entry.slug);
  const prev = pos > 0 ? tree.list[pos - 1] : undefined;
  const next = pos >= 0 ? tree.list[pos + 1] : undefined;
  const discord = getSettings("links").discord;
  return (
    <article class="wiki-article">
      <nav class="crumbs"><a href="/wiki" data-wiki>Wiki</a><span>/</span><span>{entry.category}</span></nav>
      <h1>{entry.title}</h1>
      {entry.description ? <p class="wa-lead">{entry.description}</p> : null}
      <div class="wa-meta">
        {entry.updated ? <span><Icon name="calendar" />Aktualisiert am {longDate(entry.updated)}</span> : null}
        <span><Icon name="clock" />{article.minutes} Min. Lesezeit</span>
      </div>
      <div class="prose">{raw(article.html)}</div>
      <div class="wa-pager">
        {prev ? (
          <a class="wa-prev" href={wikiLink(prev.slug)} data-wiki><small><Icon name="left" />Vorheriger Artikel</small><strong>{prev.title}</strong></a>
        ) : <span></span>}
        {next ? (
          <a class="wa-next" href={wikiLink(next.slug)} data-wiki><small>Nächster Artikel<Icon name="right" /></small><strong>{next.title}</strong></a>
        ) : <span></span>}
      </div>
      <p class="wa-help">Etwas stimmt nicht mehr oder fehlt? Sag uns im <a {...linkProps(discord)}>Discord</a> Bescheid – das Wiki wird vom Team gepflegt.</p>
    </article>
  );
};

export const WikiToc: FC<{ toc: TocEntry[] }> = ({ toc }) =>
  toc.length > 1 ? (
    <div class="toc-box">
      <h5>Auf dieser Seite</h5>
      {toc.map(t => <a href={`#${t.id}`} class={`lvl-${t.level}`} data-id={t.id}>{raw(t.text)}</a>)}
    </div>
  ) : null;

export const WikiMissing: FC<{ slug: string }> = ({ slug }) => (
  <div class="wiki-empty">
    <h2>Artikel nicht gefunden</h2>
    <p>Zu <code>{slug}</code> gibt es (noch) keinen Artikel. Vielleicht hilft dir die Suche weiter.</p>
    <a class="btn btn-primary" href="/wiki" data-wiki>Zur Wiki-Übersicht</a>
  </div>
);

export const WikiEmpty: FC = () => (
  <div class="wiki-empty">
    <h2>Noch keine Artikel</h2>
    <p>Das Wiki ist noch leer. Artikel legst du im Admin-Panel unter „Wiki“ an.</p>
  </div>
);

export const wikiTitle = (article?: RenderedArticle) => (article ? `${article.entry.title} – Wiki | Letopia.net` : "Wiki | Letopia.net");

export const WikiPage: FC<{ origin: string; tree: WikiTree; article?: RenderedArticle; missing?: string }> = ({ origin, tree, article, missing }) => (
  <Layout
    title={missing ? "Artikel nicht gefunden – Wiki | Letopia.net" : wikiTitle(article)}
    description={article?.entry.description || "Das Letopia-Wiki: Anleitungen, Befehle und Erklärungen zu Grundstücken, Städten, Jobs, Farmwelten und mehr."}
    nav="wiki"
    script="wiki"
    origin={origin}
    path={article ? wikiLink(article.entry.slug) : "/wiki"}
    noindex={Boolean(missing)}
  >
    <section class="page-hero">
      <canvas class="hero-scene" data-scene="night" data-seed="wiki-bibliothek" data-tall=".9" aria-hidden="true"></canvas>
      <div class="hero-shade"></div>
      <div class="wrap">
        <nav class="crumbs" aria-label="Brotkrumen"><a href="/">Startseite</a><span>/</span><span>Wiki</span></nav>
        <h1>Letopia <em>Wiki</em></h1>
        <p class="lead">Anleitungen, Befehle und Erklärungen – von deinem ersten Grundstück bis zur eigenen Stadt.</p>
        <label class="search-field wiki-search">
          <Icon name="search" />
          <input type="search" id="wiki-q" placeholder="Wiki durchsuchen …" autocomplete="off" aria-label="Wiki durchsuchen" />
          <kbd>/</kbd>
        </label>
      </div>
    </section>

    <section class="wiki-wrap">
      <div class="wrap wiki">
        <aside class="wiki-side">
          <button class="side-toggle" type="button" aria-expanded="false"><Icon name="list" />Alle Artikel<Icon name="down" class="car" /></button>
          <nav class="wiki-nav" id="wiki-nav" aria-label="Wiki-Artikel">
            <WikiNav tree={tree} active={article?.entry.slug ?? (missing ? "" : null)} />
          </nav>
        </aside>
        <div class="wiki-main" id="wiki-main" aria-live="polite" data-slug={article?.entry.slug ?? ""}>
          {missing !== undefined ? <WikiMissing slug={missing} /> : article ? <WikiArticle tree={tree} article={article} /> : tree.list.length ? <WikiHome tree={tree} /> : <WikiEmpty />}
        </div>
        <aside class="wiki-toc" id="wiki-toc">{article ? <WikiToc toc={article.toc} /> : null}</aside>
      </div>
    </section>
  </Layout>
);
