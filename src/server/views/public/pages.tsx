import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { isScene } from "../../../shared/catalog.js";
import { renderInline, renderMarkdown } from "../../lib/markdown.js";
import { memo } from "../../repo/cache.js";
import type { Page } from "../../repo/pages.js";
import { getSettings, pairs } from "../../repo/settings.js";
import type { TeamGroupWithMembers } from "../../repo/team.js";
import type { VoteSite } from "../../repo/votes.js";
import { longDate, monthYear } from "../format.js";
import { Icon, Layout, linkProps, PageHero } from "./layout.js";

const headUrl = (name: string) => `/api/kopf/${encodeURIComponent(name)}`;

const renderPage = (page: Page) =>
  memo(`page-html:${page.slug}:${page.updated_at}`, () => renderMarkdown(page.body, { link: slug => `/wiki/${slug}` }));

export const pageHeading = (page: Page) => raw(renderInline(page.heading || page.title));

// --- Team ---------------------------------------------------------------------------------------

export const TeamPage: FC<{ origin: string; groups: TeamGroupWithMembers[] }> = ({ origin, groups }) => {
  const total = groups.reduce((n, g) => n + g.members.length, 0);
  const visible = groups.filter(g => g.members.length);
  const stand = monthYear(getSettings("team").stand);
  return (
    <Layout
      title="Team | Letopia.net"
      description="Das Team hinter Letopia – Administration, Entwicklung, Moderation, Support und Bauteam."
      nav="team"
      script="main"
      origin={origin}
      path="/team"
    >
      <PageHero
        scene="dusk"
        seed="team-rathaus"
        crumbs={["Team"]}
        heading={<>Das <em>Team</em></>}
        lead="Die Leute, die Letopia am Laufen halten – vom Server bis zur letzten Laterne am Spawn."
      />
      <section class="page-body">
        <div class="wrap">
          <div class="team-top reveal">
            <p>Fragen, Probleme oder Ideen? Schreib uns am besten über ein Ticket im Discord – dann landet deine Nachricht direkt bei der richtigen Person.</p>
            <div class="team-stat">
              <div><strong id="team-count">{total}</strong><small>Teammitglieder</small></div>
              <div><strong id="team-groups">{visible.length}</strong><small>Bereiche</small></div>
            </div>
          </div>

          <div id="team-list">
            {visible.map(g => (
              <section class="team-group">
                <header class="tg-head reveal">
                  <span class="tg-dot" style={`--c:${g.color}`}></span>
                  <h2>{g.name}</h2>
                  <small>{g.members.length}</small>
                </header>
                <div class="team-grid">
                  {g.members.map((m, i) => (
                    <article class="member reveal" style={`--c:${g.color};--d:${(i * 0.06).toFixed(2)}s`}>
                      <div class="member-head"><img src={headUrl(m.name)} alt="" width={72} height={72} loading="lazy" data-fallback="/assets/img/head.png" /></div>
                      <h3>{m.name}</h3>
                      <span class="member-role">{m.role}</span>
                      <p>{m.info}</p>
                      {m.since ? <small class="member-since"><Icon name="clock" />Im Team seit {m.since}</small> : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div class="cta-card reveal">
            <div>
              <h2>Lust, mitzumachen?</h2>
              <p>Wir suchen regelmäßig Supporter, Builder und Entwickler. Wenn du Letopia mitgestalten willst, bewirb dich einfach.</p>
            </div>
            <a class="btn btn-primary" href="/bewerben#team"><Icon name="send" />Jetzt bewerben</a>
          </div>

          {stand ? <p class="stand">Stand: <span id="team-stand">{stand}</span></p> : null}
        </div>
      </section>
    </Layout>
  );
};

// --- Regeln -------------------------------------------------------------------------------------

export const RulesPage: FC<{ origin: string; page: Page }> = ({ origin, page }) => {
  const { html, toc } = renderPage(page);
  const discord = getSettings("links").discord;
  return (
    <Layout title={`${page.title} | Letopia.net`} description={page.description || "Die Serverregeln von Letopia."} nav="regeln" script="rules" origin={origin} path="/regeln">
      <PageHero scene={isScene(page.scene) ? page.scene : "dawn"} seed={page.seed || "regeln-gericht"} crumbs={[page.title]} heading={pageHeading(page)} lead={page.lead || undefined} />
      <section class="page-body">
        <div class="wrap rules-layout">
          <article class="rules-card reveal">
            <div class="rules-meta">
              <span><Icon name="calendar" />Zuletzt geändert am <b id="rules-date">{longDate(page.updated_on) || "–"}</b></span>
              <span><Icon name="info" />Gilt im Spiel und im Discord</span>
            </div>
            <div class="prose" id="rules">{raw(html)}</div>
          </article>
          <aside class="rules-toc" id="rules-toc">
            <h5>Inhalt</h5>
            {toc.filter(t => t.level === 2).map(t => <a href={`#${t.id}`} data-id={t.id}>{raw(t.text)}</a>)}
            <a class="btn btn-ghost" {...linkProps(discord)}>Frage zu einer Regel?</a>
          </aside>
        </div>
      </section>
    </Layout>
  );
};

// --- Freie Seiten (Impressum, Datenschutz, AGB, eigene Seiten) --------------------------------------

export const ContentPage: FC<{ origin: string; page: Page }> = ({ origin, page }) => {
  const { html } = renderPage(page);
  return (
    <Layout title={`${page.title} | Letopia.net`} description={page.description || page.title} origin={origin} path={`/${page.slug}`}>
      <PageHero scene={isScene(page.scene) ? page.scene : "night"} seed={page.seed || page.slug} tall=".85" crumbs={[page.title]} heading={pageHeading(page)} lead={page.lead || undefined} />
      <section class="page-body">
        <div class="wrap">
          <article class="legal-card prose reveal">{raw(html)}</article>
        </div>
      </section>
    </Layout>
  );
};

// --- Voten --------------------------------------------------------------------------------------

export const VotePage: FC<{ origin: string; sites: VoteSite[] }> = ({ origin, sites }) => {
  const votes = getSettings("votes");
  const streaks = pairs(votes.streaks);
  return (
    <Layout title="Voten | Letopia.net" description="Vote täglich für Letopia und hol dir Coins und Vote-Kisten." nav="voten" script="vote" origin={origin} path="/voten">
      <PageHero
        scene="day"
        seed="marktplatz-mittag"
        crumbs={["Voten"]}
        heading={<>Für Letopia <em>voten</em></>}
        lead="Jeder Vote hilft uns, neue Spieler zu finden – und bringt dir Coins und Vote-Kisten. Einmal am Tag auf jeder Seite."
      />
      <section class="page-body">
        <div class="wrap vote-layout">
          <div>
            <div class="vote-progress reveal">
              <strong><span id="vote-done">0</span> / <span id="vote-total">{sites.length}</span> heute</strong>
              <div class="vote-bar"><i></i></div>
            </div>
            <div class="vote-list reveal" id="vote-list">
              {sites.map((site, i) => (
                <article class="vote-card" data-site={site.name}>
                  <span class="vote-num">{i + 1}</span>
                  <div class="vote-info">
                    <h3>{site.name}</h3>
                    <p><Icon name="gift" />{site.reward}</p>
                  </div>
                  <div class="vote-act">
                    <small>Bereit zum Voten</small>
                    <a class="btn btn-primary" {...linkProps(site.url)} data-site={site.name}>Jetzt voten</a>
                  </div>
                </article>
              ))}
              {sites.length ? null : <p class="empty">Gerade sind keine Vote-Seiten eingetragen.</p>}
            </div>
          </div>

          <aside>
            <div class="side-card reveal">
              <h3><Icon name="info" />So funktioniert's</h3>
              <ol class="num-list">
                <li><b>Seite öffnen</b>Klick bei einer Vote-Seite auf „Jetzt voten“.</li>
                <li><b>Namen eintragen</b>Gib dort deinen Minecraft-Namen ein – genau so, wie er im Spiel steht.</li>
                <li><b>Belohnung abholen</b>Die Belohnung kommt automatisch. Warst du offline, bekommst du sie beim nächsten Login.</li>
              </ol>
            </div>

            {streaks.length ? (
              <div class="side-card reveal">
                <h3><Icon name="trophy" />Vote-Serien</h3>
                <ul class="reward-list">{streaks.map(s => <li>{s.label}<b>{s.value}</b></li>)}</ul>
              </div>
            ) : null}

            {votes.monthly.trim() ? (
              <div class="side-card reveal">
                <h3><Icon name="gift" />Monatsbester</h3>
                <div class="prose-inline">{raw(renderMarkdown(votes.monthly).html)}</div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </Layout>
  );
};

// --- 404 ---------------------------------------------------------------------------------------

export const NotFoundPage: FC<{ origin: string; path: string }> = ({ origin, path }) => (
  <Layout title="Seite nicht gefunden | Letopia.net" description="Diese Seite gibt es nicht." origin={origin} path={path} noindex>
    <section class="hero notfound">
      <canvas class="hero-scene" data-scene="night" data-seed="verlaufen" data-tall=".7" aria-hidden="true"></canvas>
      <div class="hero-shade"></div>
      <div class="hero-in">
        <div class="big">404</div>
        <h1 class="sr-title">Hier ist nichts gebaut</h1>
        <p class="lead-404">Diese Seite gibt es nicht – oder jemand hat sie abgerissen. Vielleicht findest du über die Startseite oder das Wiki, was du gesucht hast.</p>
        <div class="hero-btns">
          <a class="btn btn-primary btn-lg" href="/"><Icon name="home" />Zur Startseite</a>
          <a class="btn btn-ghost btn-lg" href="/wiki"><Icon name="book" />Zum Wiki</a>
        </div>
      </div>
    </section>
  </Layout>
);

export const ErrorPage: FC<{ origin: string }> = ({ origin }) => (
  <Layout title="Fehler | Letopia.net" description="Ein Fehler ist aufgetreten." origin={origin} path="/" noindex>
    <section class="hero notfound">
      <canvas class="hero-scene" data-scene="night" data-seed="einsturz" data-tall=".7" aria-hidden="true"></canvas>
      <div class="hero-shade"></div>
      <div class="hero-in">
        <div class="big">500</div>
        <h1 class="sr-title">Da ist etwas eingestürzt</h1>
        <p class="lead-404">Beim Laden der Seite ist ein Fehler aufgetreten. Bitte versuch es gleich noch einmal – wenn es nicht besser wird, sag uns im Discord Bescheid.</p>
        <div class="hero-btns">
          <a class="btn btn-primary btn-lg" href="/"><Icon name="home" />Zur Startseite</a>
        </div>
      </div>
    </section>
  </Layout>
);
