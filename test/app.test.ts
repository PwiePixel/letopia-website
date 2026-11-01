import "./setup.js";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../src/server/app.js";
import { closeDatabase, openDatabase, run } from "../src/server/db/database.js";
import { seedIfEmpty } from "../src/server/db/seed.js";
import { countApplications } from "../src/server/repo/applications.js";
import { saveSettings } from "../src/server/repo/settings.js";
import { setupCode } from "../src/server/services/setup.js";

const app = createApp();
const ORIGIN = "http://localhost";
const BASE_HEADERS = { Host: "localhost", Origin: ORIGIN };

const request = (path: string, init: RequestInit = {}) => app.request(`${ORIGIN}${path}`, init);

const validApplication = {
  typ: "team",
  spielername: "Testspieler",
  discord: "test.user",
  alter: "16",
  position: "Supporter",
  spielzeit: "1–3 Monate",
  stunden: "10",
  motivation: "Ich bin jeden Tag online, helfe gern neuen Spielern beim Start und möchte das Team im Support tatkräftig unterstützen.",
  datenschutz: true
};

const apply = (body: Record<string, unknown>, headers: Record<string, string> = BASE_HEADERS) =>
  request("/api/bewerbungen", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

before(() => {
  openDatabase();
  seedIfEmpty();
});

after(() => closeDatabase());

describe("Öffentliche Seiten", () => {
  for (const path of ["/", "/wiki", "/wiki/grundstuecke", "/items", "/rezepte", "/team", "/regeln", "/voten", "/bewerben", "/impressum", "/datenschutz", "/agb"]) {
    it(`liefert ${path}`, async () => {
      const res = await request(path);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /^<!DOCTYPE html>/);
      assert.match(html, /<title>[^<]*Letopia\.net[^<]*<\/title>/);
    });
  }

  it("setzt Sicherheits-Header", async () => {
    const res = await request("/");
    assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  });

  it("zeigt 404 für Unbekanntes und fehlende Wiki-Artikel", async () => {
    assert.equal((await request("/gibt-es-nicht")).status, 404);
    assert.equal((await request("/wiki/gibt-es-nicht")).status, 404);
  });

  it("leitet alte .html-Adressen dauerhaft um", async () => {
    const res = await request("/wiki.html");
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "/wiki");
    assert.equal((await request("/admin/index.php")).headers.get("location"), "/admin");
  });

  it("liefert Wiki-Artikel auch als Teil-Antwort für die schnelle Navigation", async () => {
    const res = await request("/wiki/jobs", { headers: { "X-Wiki-Partial": "1" } });
    const data = (await res.json()) as { slug: string; title: string; main: string };
    assert.equal(data.slug, "jobs");
    assert.match(data.title, /^Jobs/);
    assert.match(data.main, /class="wiki-article"/);
  });

  it("bietet Sitemap, robots.txt und Suchindex", async () => {
    assert.match(await (await request("/sitemap.xml")).text(), /<loc>http:\/\/localhost\/wiki\/grundstuecke<\/loc>/);
    assert.match(await (await request("/robots.txt")).text(), /Disallow: \/admin/);
    const index = (await (await request("/api/wiki/suche")).json()) as unknown[];
    assert.equal(index.length, 15);
  });
});

describe("Bewerbungen (API)", () => {
  beforeEach(() => {
    run("DELETE FROM rate_limits");
    saveSettings("applications", { teamOpen: true, maxPerDay: 3 });
  });

  it("speichert eine gültige Bewerbung", async () => {
    const before = countApplications();
    const res = await apply(validApplication);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(countApplications(), before + 1);
  });

  it("meldet Fehler pro Feld", async () => {
    const res = await apply({ ...validApplication, spielername: "x!", alter: "9", motivation: "zu kurz" });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { fehler: Record<string, string> };
    assert.deepEqual(Object.keys(data.fehler).sort(), ["alter", "motivation", "spielername"]);
  });

  it("verlangt die Datenschutz-Zustimmung", async () => {
    const res = await apply({ ...validApplication, datenschutz: false });
    assert.equal(res.status, 422);
  });

  it("lässt Bots über das Honeypot-Feld ins Leere laufen", async () => {
    const before = countApplications();
    const res = await apply({ ...validApplication, website: "https://spam.example" });
    assert.equal(res.status, 200);
    assert.equal(countApplications(), before);
  });

  it("lehnt Bewerbungen bei geschlossener Phase ab", async () => {
    saveSettings("applications", { teamOpen: false });
    const res = await apply(validApplication);
    assert.equal(res.status, 422);
    assert.match(((await res.json()) as { nachricht: string }).nachricht, /geschlossen/);
  });

  it("begrenzt die Anzahl pro Tag", async () => {
    for (let i = 0; i < 3; i++) assert.equal((await apply(validApplication)).status, 201);
    assert.equal((await apply(validApplication)).status, 429);
  });

  it("lehnt Anfragen von fremden Seiten ab", async () => {
    const res = await apply(validApplication, { Host: "localhost", Origin: "https://evil.example" });
    assert.equal(res.status, 403);
  });
});

describe("Admin-Panel", () => {
  let cookie = "";
  let csrf = "";

  const login = async () => {
    const body = new URLSearchParams({ einrichtung: "1", code: setupCode(), name: "TestAdmin", passwort: "Ein-langes-Passwort", passwort2: "Ein-langes-Passwort" });
    const res = await request("/admin/login", { method: "POST", headers: { ...BASE_HEADERS, "Content-Type": "application/x-www-form-urlencoded" }, body });
    assert.equal(res.status, 302);
    const set = res.headers.get("set-cookie") ?? "";
    const match = set.match(/letopia_session=([^;]+)/);
    assert.ok(match, "Sitzungs-Cookie fehlt");
    cookie = `letopia_session=${match[1]}`;
    const page = await (await request("/admin", { headers: { Cookie: cookie } })).text();
    csrf = page.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1] ?? "";
    assert.ok(csrf, "CSRF-Token fehlt");
  };

  it("leitet ohne Anmeldung zum Login um", async () => {
    const res = await request("/admin/bewerbungen");
    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") ?? "", /^\/admin\/login\?weiter=/);
  });

  it("zeigt bei leerer Datenbank die Ersteinrichtung", async () => {
    const html = await (await request("/admin/login")).text();
    assert.match(html, /Admin-Panel einrichten/);
  });

  it("lehnt einen falschen Einrichtungscode ab", async () => {
    const body = new URLSearchParams({ einrichtung: "1", code: "FALSCH", name: "Boese", passwort: "Ein-langes-Passwort", passwort2: "Ein-langes-Passwort" });
    const res = await request("/admin/login", { method: "POST", headers: { ...BASE_HEADERS, "Content-Type": "application/x-www-form-urlencoded" }, body });
    assert.equal(res.status, 422);
  });

  it("richtet den ersten Admin ein und meldet ihn an", async () => {
    await login();
    const res = await request("/admin", { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /TestAdmin/);
  });

  it("schützt Formulare mit CSRF-Token", async () => {
    const form = { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie, ...BASE_HEADERS };
    const without = await request("/admin/einstellungen/links", { method: "POST", headers: form, body: new URLSearchParams({ discord: "https://discord.gg/x" }) });
    assert.equal(without.status, 403);
    const withToken = await request("/admin/einstellungen/links", { method: "POST", headers: form, body: new URLSearchParams({ _csrf: csrf, discord: "https://discord.gg/x" }) });
    assert.equal(withToken.status, 302);
    assert.match(await (await request("/")).text(), /href="https:\/\/discord\.gg\/x"/);
  });

  it("rendert die Markdown-Vorschau", async () => {
    const res = await request("/admin/api/vorschau", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, "X-CSRF-Token": csrf, ...BASE_HEADERS },
      body: JSON.stringify({ markdown: "## Hallo\n\n[[jobs]]" })
    });
    const data = (await res.json()) as { html: string };
    assert.match(data.html, /<h2 id="hallo">/);
    assert.match(data.html, /<a href="\/wiki\/jobs" class="wl">Jobs<\/a>/);
  });

  it("öffnet alle Bereiche des Admin-Panels", async () => {
    for (const path of ["/admin/bewerbungen", "/admin/wiki", "/admin/wiki/neu", "/admin/seiten", "/admin/seiten/1", "/admin/team", "/admin/items", "/admin/items/neu", "/admin/rezepte", "/admin/rezepte/neu", "/admin/rezepte/zutaten", "/admin/voten", "/admin/medien", "/admin/einstellungen", "/admin/benutzer", "/admin/protokoll", "/admin/profil"]) {
      const res = await request(path, { headers: { Cookie: cookie } });
      assert.equal(res.status, 200, path);
    }
  });

  it("meldet ab", async () => {
    const res = await request("/admin/logout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie, ...BASE_HEADERS }, body: new URLSearchParams({ _csrf: csrf }) });
    assert.equal(res.status, 302);
    assert.equal((await request("/admin", { headers: { Cookie: cookie } })).status, 302);
  });
});
