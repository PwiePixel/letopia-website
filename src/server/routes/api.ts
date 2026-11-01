import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { APPLICATION_TYPES, rarityOf } from "../../shared/catalog.js";
import { forms, isApplicationType, toAnswers, validate } from "../lib/applications.js";
import { clientIp, originOf, sameOrigin, type AppEnv } from "../http.js";
import { log } from "../log.js";
import { createApplication } from "../repo/applications.js";
import { listItems } from "../repo/items.js";
import { listIngredients, listRecipes } from "../repo/recipes.js";
import { hit, tooMany } from "../repo/ratelimit.js";
import { getSettings, pairs } from "../repo/settings.js";
import { teamWithMembers } from "../repo/team.js";
import { listVoteSites } from "../repo/votes.js";
import { wikiTree } from "../repo/wiki.js";
import { applicationMessage, sendWebhook } from "../services/discord.js";
import { HEAD_NAME, playerHead } from "../services/heads.js";
import { serverStatus } from "../services/status.js";

export const apiRoutes = new Hono<AppEnv>();

apiRoutes.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
});

// --- Online-Status --------------------------------------------------------------------------------

apiRoutes.get("/status", async c => {
  const status = await serverStatus();
  c.header("Cache-Control", "public, max-age=60");
  if (!status) return c.json({ fehler: "Status nicht verfügbar" }, 502);
  return c.json({ online: status.online, players: status.players, version: status.version ?? null });
});

// --- Spielerköpfe (zwischengespeichert, Besucher-IP geht nicht an Dritte) -------------------------

const head = async (c: Context<AppEnv>, name: string) => {
  if (!HEAD_NAME.test(name)) return c.body(null, 400);
  const png = await playerHead(name);
  return c.body(new Uint8Array(png), 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
};

apiRoutes.get("/kopf/:name", c => head(c, c.req.param("name")));
apiRoutes.get("/kopf", c => head(c, c.req.query("name") ?? ""));

// --- Bewerbungen ------------------------------------------------------------------------------------

const answer = (c: Context<AppEnv>, status: 200 | 201 | 403 | 405 | 413 | 422 | 429 | 500, body: Record<string, unknown>) => {
  c.header("Cache-Control", "no-store");
  return c.json(body, status);
};

const submitApplication = async (c: Context<AppEnv>) => {
  if (!sameOrigin(c)) return answer(c, 403, { ok: false, nachricht: "Bewerbungen bitte über das Formular auf der Website senden." });

  let input: Record<string, unknown>;
  try {
    const type = c.req.header("content-type") ?? "";
    input = type.includes("application/json")
      ? ((await c.req.json()) as Record<string, unknown>)
      : ((await c.req.parseBody()) as Record<string, unknown>);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("kein Objekt");
  } catch {
    return answer(c, 422, { ok: false, nachricht: "Die Bewerbung konnte nicht gelesen werden." });
  }

  // Honeypot: Bots füllen das versteckte Feld aus – so tun, als hätte alles geklappt.
  if (typeof input.website === "string" && input.website.trim()) return answer(c, 200, { ok: true });

  const type = input.typ;
  if (!isApplicationType(type)) return answer(c, 422, { ok: false, nachricht: "Unbekannte Bewerbungsart." });

  const settings = getSettings("applications");
  const open = type === "team" ? settings.teamOpen : settings.creatorOpen;
  if (!open) return answer(c, 422, { ok: false, nachricht: `Die ${APPLICATION_TYPES[type]}-Bewerbungsphase ist gerade geschlossen.` });

  const consent = input.datenschutz;
  if (consent !== true && consent !== "on" && consent !== "1" && consent !== "true") {
    return answer(c, 422, { ok: false, nachricht: "Bitte bestätige die Datenschutzhinweise.", fehler: { datenschutz: "Bitte bestätige das." } });
  }

  const form = forms()[type];
  const { values, errors } = validate(form.fields, input);
  if (Object.keys(errors).length) return answer(c, 422, { ok: false, nachricht: "Bitte prüfe die markierten Felder.", fehler: errors });

  const ip = clientIp(c);
  try {
    if (tooMany("bewerbung", ip, Math.max(1, settings.maxPerDay), 86400)) {
      return answer(c, 429, { ok: false, nachricht: "Du hast heute schon mehrere Bewerbungen geschickt. Bitte versuch es morgen noch einmal." });
    }
    const id = createApplication({
      type,
      player_name: values.spielername ?? "",
      discord: values.discord ?? "",
      summary: values[form.summary] ?? "",
      answers: toAnswers(form.fields, values)
    });
    hit("bewerbung", ip);

    if (settings.discordWebhook) {
      void sendWebhook(
        settings.discordWebhook,
        applicationMessage({
          type: form.title,
          player: values.spielername ?? "",
          summary: values[form.summary] ?? "",
          adminUrl: `${originOf(c)}/admin/bewerbungen/${id}`,
          mention: settings.discordMention
        })
      );
    }
  } catch (error) {
    log.error("Bewerbung konnte nicht gespeichert werden", error);
    return answer(c, 500, { ok: false, nachricht: "Beim Speichern ist etwas schiefgelaufen. Bitte versuch es später noch einmal oder melde dich im Discord." });
  }

  return answer(c, 201, { ok: true });
};

const limit = bodyLimit({
  maxSize: 20_000,
  onError: c => c.json({ ok: false, nachricht: "Die Bewerbung ist zu lang." }, 413)
});

apiRoutes.post("/bewerbungen", limit, submitApplication);
apiRoutes.post("/bewerbung.php", limit, submitApplication);
apiRoutes.on(["GET", "PUT", "DELETE"], "/bewerbungen", c => {
  c.header("Allow", "POST");
  return answer(c, 405, { ok: false, nachricht: "Bewerbungen bitte über das Formular auf der Website senden." });
});

// --- Öffentliche Daten (z. B. für Discord-Bots oder Plugins) -------------------------------------

const cached = (c: Context<AppEnv>) => c.header("Cache-Control", "public, max-age=60");

apiRoutes.get("/info", c => {
  cached(c);
  const g = getSettings("general");
  const s = getSettings("applications");
  return c.json({
    name: g.siteName,
    adresse: g.serverAddress,
    javaVersion: g.javaVersion,
    bedrockPort: g.bedrockPort,
    links: getSettings("links"),
    bewerbungen: { team: s.teamOpen, creator: s.creatorOpen }
  });
});

apiRoutes.get("/wiki", c => {
  cached(c);
  const tree = wikiTree();
  return c.json({
    kategorien: tree.categories.map(cat => ({
      name: cat.name,
      icon: cat.icon,
      artikel: cat.items.map(a => ({ slug: a.slug, titel: a.title, beschreibung: a.description, aktualisiert: a.updated || null }))
    }))
  });
});

/** Suchindex für die Wiki-Suche im Browser. */
apiRoutes.get("/wiki/suche", c => {
  cached(c);
  return c.json(wikiTree().list.map(a => ({ slug: a.slug, title: a.title, desc: a.description, cat: a.category, text: a.text })));
});

apiRoutes.get("/wiki/:slug", c => {
  const entry = wikiTree().bySlug.get(c.req.param("slug"));
  if (!entry) return c.json({ fehler: "Artikel nicht gefunden" }, 404);
  cached(c);
  return c.json({ slug: entry.slug, titel: entry.title, beschreibung: entry.description, kategorie: entry.category, aktualisiert: entry.updated || null, markdown: entry.body });
});

apiRoutes.get("/items", c => {
  cached(c);
  return c.json(
    listItems(true).map(i => ({
      id: i.slug, name: i.name, typ: i.type, seltenheit: i.rarity, seltenheitName: rarityOf(i.rarity).name,
      sprite: i.sprite, farbe: i.color, lore: i.lore, beschreibung: i.description, herkunft: i.origin, rezept: i.recipe_slug
    }))
  );
});

apiRoutes.get("/rezepte", c => {
  cached(c);
  const ingredients = new Map(listIngredients().map(g => [g.id, g]));
  return c.json(
    listRecipes(true).map(r => ({
      id: r.slug,
      ergebnis: r.item_slug,
      name: r.item_name,
      menge: r.amount,
      hinweis: r.hint || null,
      raster: r.grid.map(id => (id ? ingredients.get(id)?.name ?? null : null))
    }))
  );
});

apiRoutes.get("/team", c => {
  cached(c);
  return c.json({
    stand: getSettings("team").stand,
    gruppen: teamWithMembers().map(g => ({ rang: g.name, farbe: g.color, mitglieder: g.members.map(m => ({ name: m.name, rolle: m.role, seit: m.since, info: m.info })) }))
  });
});

apiRoutes.get("/voten", c => {
  cached(c);
  return c.json({
    seiten: listVoteSites(true).map(s => ({ name: s.name, url: s.url, belohnung: s.reward })),
    serien: pairs(getSettings("votes").streaks)
  });
});

apiRoutes.all("*", c => c.json({ fehler: "Nicht gefunden" }, 404));
