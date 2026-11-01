import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frontMatter, modernizeUrl, plainText, renderInline, renderMarkdown } from "../src/server/lib/markdown.js";

describe("Markdown", () => {
  it("erzeugt Überschriften mit Ankern und Inhaltsverzeichnis", () => {
    const { html, toc } = renderMarkdown("## Grundstücke & Städte\n\n### Übersicht\n\n## Grundstücke & Städte");
    assert.match(html, /<h2 id="grundstuecke-staedte">/);
    assert.match(html, /<h2 id="grundstuecke-staedte-2">/);
    assert.deepEqual(toc.map(t => t.id), ["grundstuecke-staedte", "uebersicht", "grundstuecke-staedte-2"]);
  });

  it("formatiert Text und macht Befehle kopierbar", () => {
    const { html } = renderMarkdown("Mit **fett**, *kursiv*, ==markiert== und `/p auto` sowie `code`.");
    assert.match(html, /<strong>fett<\/strong>/);
    assert.match(html, /<em>kursiv<\/em>/);
    assert.match(html, /<mark>markiert<\/mark>/);
    assert.match(html, /<code class="cmd" data-copy="\/p auto"/);
    assert.match(html, /<code>code<\/code>/);
  });

  it("escaped HTML überall", () => {
    const { html } = renderMarkdown("<script>alert(1)</script>\n\n## <img src=x onerror=alert(1)>\n\n`<b>`");
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img src=x"));
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /<code>&lt;b&gt;<\/code>/);
  });

  it("entschärft gefährliche Link-Ziele", () => {
    const { html } = renderMarkdown("[a](javascript:alert(1)) [b](data:text/html,x) ![c](javascript:x) [d](https://example.com) [e](/wiki/faq) [f](mailto:a@b.de)");
    assert.ok(!/href="javascript:/i.test(html));
    assert.ok(!/href="data:/i.test(html));
    assert.ok(!/src="javascript:/i.test(html));
    assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noopener">d<\/a>/);
    assert.match(html, /<a href="\/wiki\/faq">e<\/a>/);
    assert.match(html, /href="mailto:a@b\.de"/);
  });

  it("löst Wiki-Links auf und benutzt Titel", () => {
    const opts = { title: (slug: string) => (slug === "jobs" ? "Jobs & Berufe" : undefined), link: (slug: string) => `/wiki/${slug}` };
    const { html } = renderMarkdown("[[jobs]] und [[faq|Fragen]] und [[unbekannt]]", opts);
    assert.match(html, /<a href="\/wiki\/jobs" class="wl">Jobs &amp; Berufe<\/a>/);
    assert.match(html, /<a href="\/wiki\/faq" class="wl">Fragen<\/a>/);
    assert.match(html, /<a href="\/wiki\/unbekannt" class="wl">unbekannt<\/a>/);
  });

  it("rendert Hinweis-Boxen, Tabellen, Listen und Code-Blöcke", () => {
    const md = "> [!TIPP]\n> Gut zu wissen\n\n| A | B |\n| :-: | --: |\n| 1 | 2 |\n\n- eins\n- zwei\n\n1. erstens\n\n```js\nconst x = '<b>';\n```";
    const { html } = renderMarkdown(md);
    assert.match(html, /<div class="callout callout-tipp"><strong class="callout-title">Tipp<\/strong><p>Gut zu wissen<\/p><\/div>/);
    assert.match(html, /<th style="text-align:center">A<\/th>/);
    assert.match(html, /<td style="text-align:right">2<\/td>/);
    assert.match(html, /<ul><li>eins<\/li><li>zwei<\/li><\/ul>/);
    assert.match(html, /<ol><li>erstens<\/li><\/ol>/);
    assert.match(html, /<code data-lang="js">const x = '&lt;b&gt;';<\/code>/);
  });

  it("unterstützt Platzhalter und harte Zeilenumbrüche", () => {
    const { html } = renderMarkdown("{{Vorname Nachname}}  \n{{PLZ Ort}}\\\nDeutschland");
    assert.equal(html, '<p><span class="fill">Vorname Nachname</span><br><span class="fill">PLZ Ort</span><br>Deutschland</p>');
  });

  it("biegt alte .html-Links auf die neuen Adressen um", () => {
    assert.equal(modernizeUrl("regeln.html"), "/regeln");
    assert.equal(modernizeUrl("bewerben.html#team"), "/bewerben#team");
    assert.equal(modernizeUrl("wiki.html#/grundstuecke"), "/wiki/grundstuecke");
    assert.equal(modernizeUrl("wiki.html#/grundstuecke/freunde"), "/wiki/grundstuecke#freunde");
    assert.equal(modernizeUrl("https://example.com/a.html"), "https://example.com/a.html");
  });

  it("liest den Datei-Kopf und erzeugt reinen Text", () => {
    const { meta, body } = frontMatter("---\ntitel: Test: Titel\naktualisiert: 2026-09-01\n---\n\nText");
    assert.equal(meta.titel, "Test: Titel");
    assert.equal(meta.aktualisiert, "2026-09-01");
    assert.equal(body.trim(), "Text");
    assert.equal(plainText("## Titel\n\n**fett** [[jobs|Jobs]] [Link](https://x.de) {{Platz}}"), "Titel fett Jobs Link Platz");
  });

  it("hebt in Überschriften *Wörter* hervor", () => {
    assert.equal(renderInline("Server*regeln*"), "Server<em>regeln</em>");
    assert.equal(renderInline("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;");
  });
});
