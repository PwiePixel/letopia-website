import type { Child, FC } from "hono/jsx";
import { raw } from "hono/html";
import { asset } from "../../assets.js";
import { footerPages } from "../../repo/pages.js";
import { getSettings } from "../../repo/settings.js";
import { scriptJson } from "../format.js";
import { PUBLIC_SPRITE } from "../icons.js";

export type NavKey = "home" | "wiki" | "items" | "rezepte" | "bewerben" | "team" | "regeln" | "voten" | "none";

export const Icon: FC<{ name: string; filled?: boolean; class?: string }> = ({ name, filled, class: extra }) => (
  <svg class={`i${filled ? " f" : ""}${extra ? ` ${extra}` : ""}`}>
    <use href={`#i-${name}`} />
  </svg>
);

/** Externe Links (http/https) in neuem Tab öffnen, "#" bleibt auf der Seite. */
const linkProps = (url: string) => (/^https?:/i.test(url) ? { href: url, target: "_blank", rel: "noopener" } : { href: url || "#" });

const Header: FC<{ nav: NavKey }> = ({ nav }) => {
  const links = getSettings("links");
  const on = (key: NavKey) => (nav === key ? " active" : "");
  const cur = (key: NavKey) => (nav === key ? "active" : undefined);
  const dd = (...keys: NavKey[]) => (keys.includes(nav) ? "dd active" : "dd");
  return (
    <header class="nav" id="nav">
      <div class="nav-in">
        <a href="/" class="brand" aria-label="Letopia Startseite">
          <img src="/assets/img/mark.png" alt="" width={38} height={38} />
          <span>LETOPIA</span>
        </a>

        <nav class="menu" id="menu" aria-label="Hauptmenü">
          <a href="/" class={`nl${on("home")}`}><Icon name="home" />Startseite</a>
          <a href="/wiki" class={`nl${on("wiki")}`}><Icon name="book" />Wiki</a>

          <div class={dd("items", "rezepte")}>
            <button class="nl dd-btn" aria-expanded="false"><Icon name="building" />CityBuild<Icon name="down" class="car" /></button>
            <div class="dd-menu">
              <a href="/wiki/grundstuecke"><Icon name="pin" />Grundstücke &amp; Städte</a>
              <a href="/items" class={cur("items")}><Icon name="gem" />Custom Items</a>
              <a href="/rezepte" class={cur("rezepte")}><Icon name="hammer" />Crafting-Rezepte</a>
            </div>
          </div>

          <div class={dd("bewerben")}>
            <button class="nl dd-btn" aria-expanded="false"><Icon name="send" />Bewerben<Icon name="down" class="car" /></button>
            <div class="dd-menu">
              <a href="/bewerben#team"><Icon name="shield" />Team-Bewerbung</a>
              <a href="/bewerben#creator"><Icon name="video" />Creator-Bewerbung</a>
            </div>
          </div>

          <div class={dd("team", "regeln", "voten")}>
            <button class="nl dd-btn" aria-expanded="false">Sonstiges<Icon name="down" class="car" /></button>
            <div class="dd-menu">
              <a href="/team" class={cur("team")}><Icon name="users" />Team</a>
              <a href="/regeln" class={cur("regeln")}><Icon name="scroll" />Regeln</a>
              <a href="/voten" class={cur("voten")}><Icon name="star" />Voten</a>
            </div>
          </div>

          <a {...linkProps(links.shop)} class="btn btn-primary btn-shop"><Icon name="cart" />Shop</a>

          <div class="nav-soc">
            <a {...linkProps(links.tiktok)} class="soc tt" aria-label="TikTok"><Icon name="tiktok" filled /></a>
            <a {...linkProps(links.discord)} class="soc ds" aria-label="Discord"><Icon name="discord" filled /></a>
          </div>
        </nav>

        <button class="burger" aria-label="Menü öffnen" aria-expanded="false" aria-controls="menu"><span></span><span></span><span></span></button>
      </div>
    </header>
  );
};

const Footer: FC = () => {
  const links = getSettings("links");
  const pages = footerPages();
  const year = new Date().getFullYear();
  return (
    <footer class="foot">
      <img class="foot-deco" src="/assets/img/allay.webp" alt="" width={173} height={166} loading="lazy" />
      <div class="wrap foot-grid">
        <div class="foot-brand">
          <a href="/" aria-label="Zur Startseite"><img src="/assets/img/logo.png" alt="Letopia Network" width={230} height={63} loading="lazy" /></a>
          <p>Deutscher Minecraft CityBuild-Server mit eigenen Plugins, fairen Preisen und einer Community, die zusammen baut.</p>
          <div class="foot-soc">
            <a {...linkProps(links.tiktok)} aria-label="TikTok"><Icon name="tiktok" filled /></a>
            <a {...linkProps(links.discord)} aria-label="Discord"><Icon name="discord" filled /></a>
            <a {...linkProps(links.youtube)} aria-label="YouTube"><Icon name="youtube" filled /></a>
            <a {...linkProps(links.shop)} aria-label="Shop"><Icon name="cart" /></a>
          </div>
        </div>

        <div class="foot-col">
          <h4>Navigation</h4>
          <ul>
            <li><a href="/">Startseite</a></li>
            <li><a href="/wiki">Wiki</a></li>
            <li><a href="/team">Team</a></li>
            <li><a href="/voten">Voten</a></li>
            <li><a {...linkProps(links.shop)}>Shop</a></li>
          </ul>
        </div>

        <div class="foot-col">
          <h4>Community</h4>
          <ul>
            <li><a {...linkProps(links.discord)}>Discord</a></li>
            <li><a href="/regeln">Regeln</a></li>
            <li><a href="/bewerben#team">Team-Bewerbung</a></li>
            <li><a href="/bewerben#creator">Creator-Programm</a></li>
          </ul>
        </div>

        <div class="foot-col">
          <h4>Rechtliches</h4>
          <ul>
            {pages.map(p => <li><a href={`/${p.slug}`}>{p.title}</a></li>)}
          </ul>
        </div>
      </div>

      <div class="wrap foot-bottom">
        <p>© <span class="js-year">{year}</span> Letopia.net · Alle Rechte vorbehalten</p>
        <p class="muted">Letopia ist kein offizielles Minecraft-Produkt und steht in keiner Verbindung zu Mojang AB oder Microsoft.</p>
      </div>
    </footer>
  );
};

const Announcement: FC = () => {
  const a = getSettings("announcement");
  if (!a.enabled || !a.text.trim()) return null;
  const isLink = /^(https?:\/\/|\/)/i.test(a.link);
  return (
    <aside class="announce" role="note" data-announce={a.text.slice(0, 80)} hidden>
      <span class="announce-ico"><Icon name="bell" /></span>
      <p>
        {a.text}
        {isLink ? <> <a {...linkProps(a.link)}>Mehr erfahren</a></> : null}
      </p>
      <button class="announce-x" type="button" aria-label="Hinweis schließen">×</button>
    </aside>
  );
};

export interface LayoutProps {
  title: string;
  description: string;
  nav?: NavKey;
  /** Name des Seiten-Skripts in /assets/js/ (Standard: main). */
  script?: string;
  /** Absolute Basis-URL für OG-Tags und Canonical-Link. */
  origin: string;
  path: string;
  noindex?: boolean;
  children?: Child;
}

/** Inline-Skript im <head>; sein Hash steht in der Content-Security-Policy. */
export const HEAD_SCRIPT = 'document.documentElement.classList.add("js")';

export const Layout: FC<LayoutProps> = props => {
  const general = getSettings("general");
  const links = getSettings("links");
  const clientConfig = {
    ip: general.serverAddress,
    bedrockPort: general.bedrockPort,
    links,
    status: general.statusSource !== "off"
  };
  const url = `${props.origin}${props.path}`;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{props.title}</title>
          <meta name="description" content={props.description} />
          <meta name="theme-color" content="#f0a830" />
          {props.noindex ? <meta name="robots" content="noindex" /> : <link rel="canonical" href={url} />}
          <meta property="og:type" content="website" />
          <meta property="og:locale" content="de_DE" />
          <meta property="og:site_name" content="Letopia Network" />
          <meta property="og:title" content={props.title} />
          <meta property="og:description" content={props.description} />
          <meta property="og:url" content={url} />
          <meta property="og:image" content={`${props.origin}/assets/img/logo.png`} />
          <link rel="icon" type="image/png" href="/assets/img/favicon.png" />
          <link rel="apple-touch-icon" href="/assets/img/mark.png" />
          <link rel="stylesheet" href={asset("css/style.css")} />
          <script>{raw(HEAD_SCRIPT)}</script>
        </head>
        <body>
          {raw(PUBLIC_SPRITE)}
          <Header nav={props.nav ?? "none"} />
          <main>{props.children}</main>
          <Footer />
          <Announcement />
          <button class="totop" aria-label="Nach oben"><Icon name="up" /></button>
          <div class="toast" role="status" aria-live="polite"><Icon name="check" /><span></span></div>
          <script type="application/json" id="site-config">{raw(scriptJson(clientConfig))}</script>
          <script type="module" src={asset(`js/${props.script ?? "main"}.js`)}></script>
        </body>
      </html>
    </>
  );
};

/** Kopfbereich mit animierter Pixel-Stadt, Brotkrumen, Überschrift und Einleitung. */
export const PageHero: FC<{ scene: string; seed: string; tall?: string; crumbs: string[]; heading: Child; lead?: Child; children?: Child }> = p => (
  <section class="page-hero">
    <canvas class="hero-scene" data-scene={p.scene} data-seed={p.seed} data-tall={p.tall ?? ".9"} aria-hidden="true"></canvas>
    <div class="hero-shade"></div>
    <div class="wrap">
      <nav class="crumbs" aria-label="Brotkrumen">
        <a href="/">Startseite</a>
        {p.crumbs.map(c => <><span>/</span><span>{c}</span></>)}
      </nav>
      <h1>{p.heading}</h1>
      {p.lead ? <p class="lead">{p.lead}</p> : null}
      {p.children}
    </div>
  </section>
);

export { linkProps };
