import { createReadStream, readFileSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { Hono } from "hono";
import { config, ROOT_DIR } from "../../config.js";
import type { AppEnv } from "../../http.js";
import { log } from "../../log.js";
import { audit } from "../../repo/audit.js";
import { getSettings, saveSettings } from "../../repo/settings.js";
import { createBackup, listBackups, snapshotDatabase } from "../../services/backup.js";
import { isDiscordWebhook, sendWebhook } from "../../services/discord.js";
import { resetStatusCache, serverStatus } from "../../services/status.js";
import { dateTime, fileSize } from "../../views/format.js";
import { Card, Csrf, Field, Icon, PageHead, Toggle } from "../../views/admin/ui.js";
import { actor, csrfToken, flash, requireArea } from "./auth.js";
import { bool, formBody, int, lines, num, safeLink, str } from "./form.js";
import { view } from "./render.js";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.use("*", requireArea("system"));

const VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")) as { version?: string }).version ?? "?";
  } catch {
    return "?";
  }
})();

const started = Date.now();

const uptime = () => {
  const s = Math.floor((Date.now() - started) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} T. ${h} Std.` : h ? `${h} Std. ${m} Min.` : `${m} Min.`;
};

const dbSize = () => {
  let total = 0;
  for (const file of [config.dbFile, `${config.dbFile}-wal`]) {
    try {
      total += statSync(file).size;
    } catch {
      // Datei existiert (noch) nicht
    }
  }
  return total ? fileSize(total) : "–";
};

settingsRoutes.get("/", async c => {
  const csrf = csrfToken(c);
  const g = getSettings("general");
  const links = getSettings("links");
  const stats = getSettings("stats");
  const ann = getSettings("announcement");
  const a = getSettings("applications");
  const backups = await listBackups();

  return view(
    c,
    "Einstellungen",
    "einstellungen",
    <>
      <PageHead title="Einstellungen" sub="Server-Adresse, Links, Startseite, Bewerbungen und Backups." />
      <nav class="sprungmarken">
        <a href="#allgemein">Server</a><a href="#links">Links</a><a href="#zahlen">Startseite</a><a href="#hinweis">Hinweis-Banner</a><a href="#bewerbungen">Bewerbungen</a><a href="#system">System & Backups</a>
      </nav>

      <Card title="Minecraft-Server" id="allgemein">
        <form method="post" action="/admin/einstellungen/allgemein" class="formular-raster">
          <Csrf token={csrf} />
          <Field label="Server-Adresse" hint="Wird überall auf der Website angezeigt und kopiert.">
            <input name="serverAddress" value={g.serverAddress} required maxlength={100} />
          </Field>
          <Field label="Java-Port" hint="Für die Online-Abfrage (Standard 25565, SRV-Einträge werden erkannt).">
            <input type="number" name="javaPort" value={String(g.javaPort)} min={1} max={65535} />
          </Field>
          <Field label="Bedrock-Port">
            <input type="number" name="bedrockPort" value={String(g.bedrockPort)} min={1} max={65535} />
          </Field>
          <Field label="Empfohlene Java-Version" hint="Anzeige „Empfohlen: Java ab …“ auf der Startseite.">
            <input name="javaVersion" value={g.javaVersion} maxlength={20} />
          </Field>
          <Field label="Online-Anzeige" full>
            <select name="statusSource">
              <option value="ping" selected={g.statusSource === "ping"}>Minecraft-Server direkt abfragen (empfohlen, mit Ersatz über mcsrvstat.us)</option>
              <option value="mcsrvstat" selected={g.statusSource === "mcsrvstat"}>Nur über mcsrvstat.us</option>
              <option value="off" selected={g.statusSource === "off"}>Ausblenden</option>
            </select>
          </Field>
          <div class="formular-fuss voll">
            <button class="knopf" type="submit"><Icon name="check" />Speichern</button>
            <button class="knopf leise" type="submit" formaction="/admin/einstellungen/status-pruefen" formnovalidate><Icon name="wifi" />Status jetzt prüfen</button>
          </div>
        </form>
      </Card>

      <Card title="Links" id="links">
        <form method="post" action="/admin/einstellungen/links" class="formular-raster">
          <Csrf token={csrf} />
          {(["discord", "shop", "tiktok", "youtube"] as const).map(key => (
            <Field label={{ discord: "Discord-Einladung", shop: "Shop", tiktok: "TikTok", youtube: "YouTube" }[key]}>
              <input name={key} value={links[key]} maxlength={300} placeholder="https://…" />
            </Field>
          ))}
          <p class="klein voll">Leer lassen oder „#“ eintragen, solange es noch keinen Link gibt.</p>
          <div class="formular-fuss voll"><button class="knopf" type="submit"><Icon name="check" />Speichern</button></div>
        </form>
      </Card>

      <Card title="Startseite: Letopia in Zahlen" id="zahlen">
        <form method="post" action="/admin/einstellungen/zahlen" class="formular-raster">
          <Csrf token={csrf} />
          <Field label="Registrierte Spieler"><input type="number" name="players" value={String(stats.players)} min={0} /></Field>
          <Field label="Server-Uptime in %"><input type="number" name="uptime" value={String(stats.uptime)} min={0} max={100} step="0.1" /></Field>
          <Field label="Vergebene Grundstücke"><input type="number" name="plots" value={String(stats.plots)} min={0} /></Field>
          <Field label="Gegründete Städte"><input type="number" name="cities" value={String(stats.cities)} min={0} /></Field>
          <Field label="Coins im Umlauf"><input type="number" name="coins" value={String(stats.coins)} min={0} /></Field>
          <Field label="Stand" hint="z. B. „September 2026“"><input name="date" value={stats.date} maxlength={40} /></Field>
          <div class="formular-fuss voll"><button class="knopf" type="submit"><Icon name="check" />Speichern</button></div>
        </form>
      </Card>

      <Card title="Hinweis-Banner" id="hinweis">
        <form method="post" action="/admin/einstellungen/hinweis" class="formular-raster">
          <Csrf token={csrf} />
          <div class="feld voll"><Toggle name="enabled" checked={ann.enabled} label="Banner auf allen Seiten anzeigen" hint="Besucher können es wegklicken – bei neuem Text erscheint es wieder." /></div>
          <Field label="Text" full><input name="text" value={ann.text} maxlength={200} placeholder="z. B. Am Samstag ab 20 Uhr: großes Stadtfest am Spawn!" /></Field>
          <Field label="Link (optional)" full><input name="link" value={ann.link} maxlength={300} placeholder="https://… oder /wiki/events" /></Field>
          <div class="formular-fuss voll"><button class="knopf" type="submit"><Icon name="check" />Speichern</button></div>
        </form>
      </Card>

      <Card title="Bewerbungen" id="bewerbungen">
        <form method="post" action="/admin/einstellungen/bewerbungen" class="formular-raster">
          <Csrf token={csrf} />
          <div class="feld"><Toggle name="teamOpen" checked={a.teamOpen} label="Team-Bewerbungen offen" /></div>
          <div class="feld"><Toggle name="creatorOpen" checked={a.creatorOpen} label="Creator-Bewerbungen offen" /></div>
          <Field label="Positionen (Team)" hint="Eine pro Zeile."><textarea name="teamPositions" rows={5}>{a.teamPositions.join("\n")}</textarea></Field>
          <Field label="Plattformen (Creator)" hint="Eine pro Zeile."><textarea name="creatorPlatforms" rows={5}>{a.creatorPlatforms.join("\n")}</textarea></Field>
          <Field label="Voraussetzungen (Team)" hint="Eine pro Zeile."><textarea name="teamRequirements" rows={5}>{a.teamRequirements.join("\n")}</textarea></Field>
          <Field label="Voraussetzungen (Creator)" hint="Eine pro Zeile."><textarea name="creatorRequirements" rows={5}>{a.creatorRequirements.join("\n")}</textarea></Field>
          <Field label="Was Creator bekommen" hint="„Vorteil | Wert“, eine pro Zeile." full><textarea name="creatorPerks" rows={4}>{a.creatorPerks.join("\n")}</textarea></Field>
          <Field label="Mindestalter"><input type="number" name="minAge" value={String(a.minAge)} min={1} max={99} /></Field>
          <Field label="Max. Bewerbungen pro Tag und IP"><input type="number" name="maxPerDay" value={String(a.maxPerDay)} min={1} max={50} /></Field>
          <Field label="Entschiedene Bewerbungen löschen nach (Tagen)" hint="0 = nie. Passend zur Datenschutzerklärung (Standard: 180 Tage).">
            <input type="number" name="retentionDays" value={String(a.retentionDays)} min={0} max={3650} />
          </Field>
          <Field label="Discord-Webhook" hint="Bei jeder neuen Bewerbung kommt eine kurze Nachricht in den Team-Kanal (nur Name und Position)." full>
            <input name="discordWebhook" value={a.discordWebhook} maxlength={300} placeholder="https://discord.com/api/webhooks/…" />
          </Field>
          <Field label="Erwähnung (optional)" hint="z. B. <@&ROLLEN-ID> für eine Rolle oder <@USER-ID>.">
            <input name="discordMention" value={a.discordMention} maxlength={40} />
          </Field>
          <div class="formular-fuss voll">
            <button class="knopf" type="submit"><Icon name="check" />Speichern</button>
            <button class="knopf leise" type="submit" formaction="/admin/einstellungen/webhook-test" formnovalidate><Icon name="send" />Test-Nachricht senden</button>
          </div>
        </form>
      </Card>

      <Card title="System & Backups" id="system">
        <dl class="info-liste">
          <div><dt>Version</dt><dd>Letopia {VERSION}</dd></div>
          <div><dt>Node.js</dt><dd>{process.version}</dd></div>
          <div><dt>Laufzeit</dt><dd>{uptime()}</dd></div>
          <div><dt>Datenbank</dt><dd>{dbSize()}</dd></div>
          <div><dt>Datenordner</dt><dd><code>{config.dataDir}</code></dd></div>
          <div><dt>Server</dt><dd>{os.hostname()} · {os.platform()} {os.arch()}</dd></div>
        </dl>
        <div class="formular-fuss">
          <form method="post" action="/admin/einstellungen/backup" class="inline">
            <Csrf token={csrf} />
            <button class="knopf" type="submit"><Icon name="database" />Backup jetzt erstellen</button>
          </form>
          <a class="knopf leise" href="/admin/einstellungen/datenbank"><Icon name="download" />Datenbank herunterladen</a>
        </div>
        {backups.length ? (
          <div class="tabelle backup-liste">
            {backups.map(b => (
              <div class="tabelle-zeile">
                <div class="haupt"><strong>{b.name}</strong><small>{fileSize(b.size)} · {dateTime(Math.floor(b.time / 1000))}</small></div>
                <div class="werkzeuge"><a class="mini-knopf" href={`/admin/einstellungen/backup/${encodeURIComponent(b.name)}`} title="Herunterladen"><Icon name="download" /></a></div>
              </div>
            ))}
          </div>
        ) : <p class="klein">Noch keine Backups vorhanden. Der Installer richtet ein tägliches Backup ein (Befehl: <code>letopia backup</code>).</p>}
      </Card>
    </>
  );
});

settingsRoutes.post("/allgemein", async c => {
  const body = await formBody(c);
  const source = str(body, "statusSource", 12);
  const g = getSettings("general");
  saveSettings("general", {
    serverAddress: str(body, "serverAddress", 100).replace(/\s+/g, "") || g.serverAddress,
    javaPort: int(body, "javaPort", 25565, 1, 65535),
    bedrockPort: int(body, "bedrockPort", 19132, 1, 65535),
    javaVersion: str(body, "javaVersion", 20),
    statusSource: source === "mcsrvstat" || source === "off" ? source : "ping"
  });
  resetStatusCache();
  audit(actor(c), "einstellungen.server");
  flash(c, "Server-Einstellungen gespeichert.");
  return c.redirect("/admin/einstellungen#allgemein");
});

settingsRoutes.post("/status-pruefen", async c => {
  resetStatusCache();
  const status = await serverStatus();
  if (!status) flash(c, "Der Status konnte nicht ermittelt werden (Server nicht erreichbar oder Anzeige ausgeschaltet).", "fehler");
  else flash(c, status.online ? `Server ist online: ${status.players.online}/${status.players.max} Spieler (Quelle: ${status.source}).` : "Der Server meldet sich als offline.", status.online ? "ok" : "fehler");
  return c.redirect("/admin/einstellungen#allgemein");
});

settingsRoutes.post("/links", async c => {
  const body = await formBody(c);
  saveSettings("links", {
    discord: safeLink(str(body, "discord", 300)),
    shop: safeLink(str(body, "shop", 300)),
    tiktok: safeLink(str(body, "tiktok", 300)),
    youtube: safeLink(str(body, "youtube", 300))
  });
  audit(actor(c), "einstellungen.links");
  flash(c, "Links gespeichert.");
  return c.redirect("/admin/einstellungen#links");
});

settingsRoutes.post("/zahlen", async c => {
  const body = await formBody(c);
  const s = getSettings("stats");
  saveSettings("stats", {
    players: int(body, "players", s.players, 0, 1e12),
    uptime: Math.round(num(body, "uptime", s.uptime, 0, 100) * 10) / 10,
    plots: int(body, "plots", s.plots, 0, 1e12),
    cities: int(body, "cities", s.cities, 0, 1e12),
    coins: int(body, "coins", s.coins, 0, 1e15),
    date: str(body, "date", 40)
  });
  audit(actor(c), "einstellungen.zahlen");
  flash(c, "Zahlen gespeichert.");
  return c.redirect("/admin/einstellungen#zahlen");
});

settingsRoutes.post("/hinweis", async c => {
  const body = await formBody(c);
  const link = str(body, "link", 300);
  saveSettings("announcement", { enabled: bool(body, "enabled"), text: str(body, "text", 200), link: link ? safeLink(link) : "" });
  audit(actor(c), "einstellungen.hinweis");
  flash(c, "Hinweis-Banner gespeichert.");
  return c.redirect("/admin/einstellungen#hinweis");
});

settingsRoutes.post("/bewerbungen", async c => {
  const body = await formBody(c);
  const webhook = str(body, "discordWebhook", 300);
  if (webhook && !isDiscordWebhook(webhook)) {
    flash(c, "Der Discord-Webhook sieht nicht richtig aus. Er beginnt mit https://discord.com/api/webhooks/", "fehler");
    return c.redirect("/admin/einstellungen#bewerbungen");
  }
  const mention = str(body, "discordMention", 40);
  const positions = lines(body, "teamPositions", 20, 60);
  const platforms = lines(body, "creatorPlatforms", 20, 60);
  saveSettings("applications", {
    teamOpen: bool(body, "teamOpen"),
    creatorOpen: bool(body, "creatorOpen"),
    teamPositions: positions.length ? positions : getSettings("applications").teamPositions,
    creatorPlatforms: platforms.length ? platforms : getSettings("applications").creatorPlatforms,
    teamRequirements: lines(body, "teamRequirements", 12, 160),
    creatorRequirements: lines(body, "creatorRequirements", 12, 160),
    creatorPerks: lines(body, "creatorPerks", 12, 160),
    minAge: int(body, "minAge", 14, 1, 99),
    maxPerDay: int(body, "maxPerDay", 3, 1, 50),
    retentionDays: int(body, "retentionDays", 180, 0, 3650),
    discordWebhook: webhook,
    discordMention: /^<@[&!]?\d+>$/.test(mention) ? mention : ""
  });
  audit(actor(c), "einstellungen.bewerbungen");
  flash(c, "Bewerbungs-Einstellungen gespeichert.");
  return c.redirect("/admin/einstellungen#bewerbungen");
});

settingsRoutes.post("/webhook-test", async c => {
  const body = await formBody(c);
  const webhook = str(body, "discordWebhook", 300) || getSettings("applications").discordWebhook;
  if (!isDiscordWebhook(webhook)) {
    flash(c, "Bitte zuerst eine gültige Webhook-URL eintragen und speichern.", "fehler");
    return c.redirect("/admin/einstellungen#bewerbungen");
  }
  const ok = await sendWebhook(webhook, { title: "Test vom Letopia Admin-Panel", description: `Ausgelöst von **${actor(c).username.replace(/[*_`~|@<>]/g, "")}** – der Webhook funktioniert.` });
  flash(c, ok ? "Test-Nachricht wurde an Discord gesendet." : "Discord hat die Nachricht nicht angenommen. Stimmt die Webhook-URL?", ok ? "ok" : "fehler");
  return c.redirect("/admin/einstellungen#bewerbungen");
});

// --- Backups -----------------------------------------------------------------------------------------------

settingsRoutes.post("/backup", async c => {
  try {
    const file = await createBackup();
    audit(actor(c), "backup.erstellt", path.basename(file));
    flash(c, `Backup erstellt: ${path.basename(file)}`);
  } catch (error) {
    log.error("Backup fehlgeschlagen", error);
    flash(c, "Das Backup konnte nicht erstellt werden. Details stehen im Server-Log.", "fehler");
  }
  return c.redirect("/admin/einstellungen#system");
});

const download = (file: string, name: string, type: string, cleanup?: () => Promise<void>) => {
  const stream = createReadStream(file);
  if (cleanup) stream.on("close", () => void cleanup());
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(statSync(file).size),
      "Cache-Control": "no-store"
    }
  });
};

settingsRoutes.get("/backup/:name", async c => {
  const name = c.req.param("name");
  const backups = await listBackups();
  const found = backups.find(b => b.name === name);
  if (!found) {
    flash(c, "Dieses Backup gibt es nicht.", "fehler");
    return c.redirect("/admin/einstellungen#system");
  }
  audit(actor(c), "backup.heruntergeladen", name);
  return download(path.join(config.backupDir, found.name), found.name, name.endsWith(".db") ? "application/vnd.sqlite3" : "application/gzip");
});

settingsRoutes.get("/datenbank", async c => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const tmp = path.join(config.dataDir, `.download-${Date.now()}.db`);
  await snapshotDatabase(tmp);
  audit(actor(c), "datenbank.heruntergeladen");
  return download(tmp, `letopia-${stamp}.db`, "application/vnd.sqlite3", () => rm(tmp, { force: true }));
});

