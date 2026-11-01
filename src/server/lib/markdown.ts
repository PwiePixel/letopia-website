/**
 * Markdown-Renderer für Wiki, Regeln und Seiten.
 *
 * Unterstützt den gleichen Funktionsumfang wie die alte Website:
 * Überschriften (mit Inhaltsverzeichnis), **fett**, *kursiv*, ==markiert==, `code`,
 * `/befehle` (klick zum Kopieren), [[wiki-links]], Links, Bilder, Listen, Tabellen,
 * Code-Blöcke, Zitate und Hinweis-Boxen (> [!TIPP] / [!INFO] / [!ACHTUNG] / [!WICHTIG]).
 *
 * Zusätzlich: {{Platzhalter}} (gelb umrandet, z. B. im Impressum) und harte
 * Zeilenumbrüche (zwei Leerzeichen oder \ am Zeilenende).
 *
 * Sämtlicher Text wird escaped, Link-Ziele werden auf erlaubte Protokolle geprüft.
 */
import { slugify } from "../../shared/catalog.js";

export interface TocEntry {
  level: number;
  id: string;
  text: string;
}

export interface RenderOptions {
  /** Titel eines Wiki-Artikels für [[slug]]-Links. */
  title?: (slug: string) => string | undefined;
  /** Ziel eines [[slug]]-Links. */
  link?: (slug: string) => string;
  /** Ziel eines Überschriften-Ankers. */
  anchor?: (id: string) => string;
}

export interface RenderResult {
  html: string;
  toc: TocEntry[];
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LABELS: Record<string, string> = { tipp: "Tipp", info: "Info", achtung: "Achtung", wichtig: "Wichtig" };
const CALLOUTS = new Set(["tipp", "info", "achtung", "wichtig"]);
const BREAK = "\u0001";

const LEGACY_PAGES = new Set(["items", "regeln", "voten", "rezepte", "team", "bewerben", "impressum", "datenschutz", "agb", "wiki"]);

/** Alte Links der statischen Seite (regeln.html, wiki.html#/artikel) auf die neuen Adressen umbiegen. */
export const modernizeUrl = (url: string): string => {
  const wiki = url.match(/^(?:\/)?wiki\.html#\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/);
  if (wiki) return `/wiki/${wiki[1]}${wiki[2] ? `#${wiki[2]}` : ""}`;
  if (/^(?:\/)?index\.html(#.*)?$/.test(url)) return `/${url.replace(/^(?:\/)?index\.html/, "")}`;
  const page = url.match(/^(?:\/)?([a-z]+)\.html(#[\w-]*)?$/);
  if (page && LEGACY_PAGES.has(page[1] ?? "")) return `/${page[1]}${page[2] ?? ""}`;
  return url;
};

/**
 * Prüft ein (bereits HTML-escaptes) Link-Ziel. Erlaubt sind relative Pfade, Anker,
 * http(s) und mailto. Alles andere (javascript:, data: …) wird entschärft.
 */
const safeUrl = (escaped: string): string => {
  const raw = escaped.replace(/&amp;/g, "&");
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^(https?|mailto)$/i.test(scheme[1] ?? "")) return "#";
  return esc(modernizeUrl(raw));
};

const isExternal = (url: string) => /^https?:/i.test(url);

const inline = (text: string, opts: RenderOptions): string => {
  const codes: string[] = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });

  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy">`)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) => {
      const key = slugify(target.trim()) || "wiki";
      const known = opts.title?.(key);
      const title = label ?? (known !== undefined ? esc(known) : key);
      const href = opts.link ? esc(opts.link(key)) : `/wiki/${key}`;
      return `<a href="${href}" class="wl">${title}</a>`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
      const href = safeUrl(url);
      return `<a href="${href}"${isExternal(href) ? " target=\"_blank\" rel=\"noopener\"" : ""}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/==([^=]+)==/g, "<mark>$1</mark>")
    .replace(/\{\{([^{}]+)\}\}/g, "<span class=\"fill\">$1</span>")
    .split(BREAK).join("<br>");

  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => {
    const c = codes[Number(i)] ?? "";
    return c.startsWith("/")
      ? `<code class="cmd" data-copy="${c}" title="Klicken zum Kopieren">${c}</code>`
      : `<code>${c}</code>`;
  });
};

const startsBlock = (line: string): boolean =>
  /^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+\.\s)/.test(line) ||
  /^-{3,}\s*$/.test(line) ||
  line.trim().startsWith("|");

/** Trennzeile einer Tabelle, z. B. "| --- | :-: | --: |". */
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const cells = (row: string): string[] => row.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());

/** Zeile für einen Absatz vorbereiten: Harte Umbrüche (2 Leerzeichen / Backslash) markieren. */
const paragraphLine = (line: string): string => {
  const hard = / {2,}$/.test(line) || /\\$/.test(line);
  const text = line.trim().replace(/\\$/, "");
  return hard ? text + BREAK : text;
};

export const renderMarkdown = (source: string, opts: RenderOptions = {}): RenderResult => {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  const toc: TocEntry[] = [];
  const used: Record<string, number> = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    let m: RegExpMatchArray | null;

    if (!line.trim()) {
      i++;
      continue;
    }

    if ((m = line.match(/^```\s*([\w-]*)/))) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) buf.push(lines[i++] ?? "");
      i++;
      const lang = m[1] ? ` data-lang="${esc(m[1])}"` : "";
      out.push(`<div class="code-block"><button class="code-copy" type="button">Kopieren</button><pre><code${lang}>${esc(buf.join("\n"))}</code></pre></div>`);
      continue;
    }

    if ((m = line.match(/^(#{1,4})\s+(.+?)\s*#*$/))) {
      const level = (m[1] ?? "#").length;
      const text = m[2] ?? "";
      const html = inline(text, opts);
      let id = slugify(text) || "abschnitt";
      used[id] = (used[id] ?? 0) + 1;
      if ((used[id] ?? 0) > 1) id += `-${used[id]}`;
      if (level > 1 && level < 4) toc.push({ level, id, text: html.replace(/<[^>]+>/g, "") });
      const href = esc(opts.anchor ? opts.anchor(id) : `#${id}`);
      out.push(level === 1
        ? `<h1 id="${id}">${html}</h1>`
        : `<h${level} id="${id}"><a class="anchor" href="${href}" aria-label="Link zu diesem Abschnitt">#</a>${html}</h${level}>`);
      i++;
      continue;
    }

    if (/^-{3,}\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith(">")) buf.push((lines[i++] ?? "").replace(/^>\s?/, ""));
      const callout = (buf[0] ?? "").match(/^\[!(\w+)\]\s*(.*)$/);
      if (callout) {
        const type = (callout[1] ?? "info").toLowerCase();
        const cls = CALLOUTS.has(type) ? type : "info";
        const title = callout[2] || LABELS[type] || callout[1] || "";
        out.push(`<div class="callout callout-${cls}"><strong class="callout-title">${inline(title, opts)}</strong>${renderMarkdown(buf.slice(1).join("\n"), opts).html}</div>`);
      } else {
        out.push(`<blockquote>${renderMarkdown(buf.join("\n"), opts).html}</blockquote>`);
      }
      continue;
    }

    if (line.trim().startsWith("|") && TABLE_DELIMITER.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      const align = cells(lines[i + 1] ?? "").map(c => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) rows.push(cells(lines[i++] ?? ""));
      const cell = (tag: string, c: string, k: number) =>
        `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ""}>${inline(c, opts)}</${tag}>`;
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, k) => cell("td", c, k)).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i] ?? "")) {
        let text = (lines[i++] ?? "").replace(/^\s*([-*]|\d+\.)\s+/, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i] ?? "") && !/^\s*([-*]|\d+\.)\s/.test(lines[i] ?? "")) {
          text += " " + (lines[i++] ?? "").trim();
        }
        items.push(text);
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map(t => `<li>${inline(t, opts)}</li>`).join("")}</${tag}>`);
      continue;
    }

    const buf = [paragraphLine(line)];
    i++;
    while (i < lines.length && (lines[i] ?? "").trim() && !startsBlock(lines[i] ?? "")) buf.push(paragraphLine(lines[i++] ?? ""));
    const joined = buf.map((part, k) => (k < buf.length - 1 && !part.endsWith(BREAK) ? `${part} ` : part)).join("");
    out.push(`<p>${inline(joined.replace(new RegExp(`${BREAK}$`), ""), opts)}</p>`);
  }

  return { html: out.join("\n"), toc };
};

export interface FrontMatter {
  meta: Record<string, string>;
  body: string;
}

/** Liest einen einfachen YAML-Kopf (key: value) am Anfang einer Markdown-Datei. */
export const frontMatter = (source: string): FrontMatter => {
  const text = source.replace(/\r\n?/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  (m[1] ?? "").split("\n").forEach(line => {
    const k = line.indexOf(":");
    if (k > 0) meta[line.slice(0, k).trim()] = line.slice(k + 1).trim();
  });
  return { meta, body: text.slice(m[0].length) };
};

/** Reiner Text für Suche und Lesezeit. */
export const plainText = (source: string): string =>
  source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^>\s?\[![^\]]+\]/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a: string, b: string) => b || a)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\{\{([^{}]+)\}\}/g, "$1")
    .replace(/[#>*`|=\\]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Inline-Markdown für kurze Texte wie Überschriften (nur *kursiv* → Akzentfarbe, **fett**). */
export const renderInline = (text: string): string =>
  esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
