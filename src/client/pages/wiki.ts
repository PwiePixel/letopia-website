/** Wiki: schnelle Navigation ohne Neuladen, Volltextsuche und mitlaufendes Inhaltsverzeichnis. */
import { $, $$, calm, escapeHtml, scrollHooks, site } from "../core";
import "../scene";

// Alte Links der statischen Seite (wiki.html#/artikel/abschnitt) auf die neuen Adressen umleiten.
const legacy = location.hash.match(/^#\/([a-z0-9-]*)\/?([a-z0-9-]*)$/i);
if (legacy) location.replace(`/wiki${legacy[1] ? `/${legacy[1]}` : ""}${legacy[2] ? `#${legacy[2]}` : ""}`);

const main = $("#wiki-main");
const nav = $("#wiki-nav");
const toc = $("#wiki-toc");
const side = $(".wiki-side");
const search = $<HTMLInputElement>("#wiki-q");
const wrap = $(".wiki-wrap");

interface Partial {
  slug: string;
  title: string;
  main: string;
  toc: string;
}

interface IndexEntry {
  slug: string;
  title: string;
  desc: string;
  cat: string;
  text: string;
  lower?: string;
}

const wikiTop = () => {
  if (!wrap) return;
  const top = wrap.offsetTop - 84;
  if (scrollY > top) scrollTo({ top, behavior: "auto" });
};

const setActive = (slug: string) => {
  if (!nav) return;
  $$("a[data-slug]", nav).forEach(a => a.classList.toggle("on", a.dataset.slug === slug));
  $(".wn-home", nav)?.classList.toggle("on", slug === "");
};

const goTo = (hash: string) => {
  const el = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (el) el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  else wikiTop();
};

// --- Suche -------------------------------------------------------------------------------------------

let index: IndexEntry[] | null = null;
let saved: { main: string; toc: string } | null = null;

const loadIndex = async () => {
  if (index) return index;
  const res = await fetch("/api/wiki/suche");
  const list = (await res.json()) as IndexEntry[];
  index = list.map(a => ({ ...a, lower: a.text.toLowerCase() }));
  return index;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const snippet = (art: IndexEntry, terms: string[]) => {
  const lower = art.lower ?? art.text.toLowerCase();
  let at = -1;
  terms.some(t => (at = lower.indexOf(t)) > -1);
  const from = Math.max(0, at - 70);
  let text = art.text.slice(from, from + 190);
  if (from > 0) text = `… ${text.slice(text.indexOf(" ") + 1)}`;
  if (from + 190 < art.text.length) text += " …";
  const pattern = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
  return escapeHtml(text).replace(pattern, "<mark>$1</mark>");
};

const findArticles = (list: IndexEntry[], query: string) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = list
    .map(a => {
      let score = 0;
      for (const t of terms) {
        const title = a.title.toLowerCase().includes(t);
        const desc = a.desc.toLowerCase().includes(t);
        const count = (a.lower ?? "").split(t).length - 1;
        if (!title && !desc && !count) return null;
        score += (title ? 12 : 0) + (desc ? 4 : 0) + Math.min(count, 6);
      }
      return { a, score };
    })
    .filter((h): h is { a: IndexEntry; score: number } => h !== null)
    .sort((x, y) => y.score - x.score);
  return { terms, hits };
};

const renderResults = async (query: string) => {
  if (!main) return;
  let list: IndexEntry[];
  try {
    list = await loadIndex();
  } catch {
    return;
  }
  if ((search?.value.trim() ?? "") !== query) return;
  saved ??= { main: main.innerHTML, toc: toc?.innerHTML ?? "" };
  const { terms, hits } = findArticles(list, query);
  if (toc) toc.innerHTML = "";
  setActive("-");
  const discord = site.links.discord ?? "#";
  main.innerHTML = `
    <div class="wiki-results">
      <p class="wr-count">${hits.length ? `${hits.length} Treffer für „${escapeHtml(query)}“` : `Keine Treffer für „${escapeHtml(query)}“`}</p>
      ${hits.length
        ? hits.map(({ a }) => `
          <a class="wr-item" href="/wiki/${escapeHtml(a.slug)}" data-wiki>
            <span class="wr-cat">${escapeHtml(a.cat)}</span>
            <strong>${escapeHtml(a.title)}</strong>
            <p>${snippet(a, terms)}</p>
          </a>`).join("")
        : `<p class="wr-none">Versuch es mit einem anderen Begriff – oder frag direkt im <a href="${escapeHtml(discord)}" target="_blank" rel="noopener">Discord</a>.</p>`}
    </div>`;
};

const endSearch = (restore: boolean) => {
  if (!saved) return;
  if (restore && main) {
    main.innerHTML = saved.main;
    if (toc) toc.innerHTML = saved.toc;
    setActive(main.dataset.slug ?? "");
  }
  saved = null;
};

let searchTimer: number | undefined;

search?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const q = search.value.trim();
    if (q.length >= 2) void renderResults(q);
    else endSearch(true);
  }, 120);
});

search?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const first = $<HTMLAnchorElement>(".wr-item", main ?? document);
    if (first) first.click();
  }
  if (e.key === "Escape") {
    search.value = "";
    endSearch(true);
    search.blur();
  }
});

document.addEventListener("keydown", e => {
  if (e.key !== "/" || /input|textarea|select/i.test(document.activeElement?.tagName ?? "")) return;
  e.preventDefault();
  search?.focus();
});

// --- Navigation ohne Neuladen ----------------------------------------------------------------------------

const load = async (url: URL, push: boolean) => {
  if (!main) return;
  try {
    const res = await fetch(url.pathname, { headers: { "X-Wiki-Partial": "1", Accept: "application/json" } });
    if (!res.ok && res.status !== 404) throw new Error(String(res.status));
    const data = (await res.json()) as Partial;
    if (search?.value) search.value = "";
    saved = null;
    main.innerHTML = data.main;
    main.dataset.slug = data.slug;
    if (toc) toc.innerHTML = data.toc;
    document.title = data.title;
    setActive(data.slug);
    side?.classList.remove("open");
    if (push) history.pushState({ wiki: true }, "", url.pathname + url.hash);
    requestAnimationFrame(() => goTo(url.hash));
    spy();
  } catch {
    location.href = url.href;
  }
};

document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element).closest?.<HTMLAnchorElement>("a[href]");
  if (!link || link.target === "_blank" || !(link.matches("[data-wiki]") || link.closest("#wiki-main .prose"))) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || !/^\/wiki(\/[a-z0-9-]+)?$/.test(url.pathname)) return;
  if (url.pathname === location.pathname && url.hash && !saved) return;
  e.preventDefault();
  void load(url, true);
});

addEventListener("popstate", () => void load(new URL(location.href), false));

$(".side-toggle")?.addEventListener("click", () => {
  const open = side?.classList.toggle("open") ?? false;
  $(".side-toggle")?.setAttribute("aria-expanded", String(open));
});

// --- Mitlaufendes Inhaltsverzeichnis ------------------------------------------------------------------

function spy() {
  if (!main || !toc) return;
  const heads = $$(".prose h2, .prose h3", main);
  const links = $$("a[data-id]", toc);
  if (!links.length) return;
  let active = heads[0]?.id;
  heads.forEach(h => {
    if (h.getBoundingClientRect().top < 150) active = h.id;
  });
  links.forEach(a => a.classList.toggle("on", a.dataset.id === active));
}

scrollHooks.push(spy);
spy();
