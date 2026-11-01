import { Hono } from "hono";
import { raw } from "hono/html";
import { renderSVG } from "uqr";
import { ROLES } from "../../../shared/catalog.js";
import type { AppEnv } from "../../http.js";
import { generateTotpSecret, hashPassword, MIN_PASSWORD_LENGTH, totpUri, verifyPassword, verifyTotp } from "../../lib/security.js";
import { audit } from "../../repo/audit.js";
import { deleteSessionsOfUser, listSessionsOfUser } from "../../repo/sessions.js";
import { getSettings } from "../../repo/settings.js";
import { headName, setMinecraftName, setPassword, setTotpSecret, type User } from "../../repo/users.js";
import { HEAD_NAME } from "../../services/heads.js";
import { ago, dateTime } from "../../views/format.js";
import { Card, Csrf, Field, Head, Icon, PageHead } from "../../views/admin/ui.js";
import { actor, csrfToken, flash } from "./auth.js";
import { formBody, str } from "./form.js";
import { view } from "./render.js";

export const profileRoutes = new Hono<AppEnv>();

/** Noch nicht bestätigte 2FA-Geheimnisse (pro Sitzung, 15 Minuten gültig). */
const pendingTotp = new Map<string, { secret: string; expires: number }>();

const pendingFor = (sessionId: string | undefined) => {
  if (!sessionId) return null;
  const entry = pendingTotp.get(sessionId);
  if (!entry || entry.expires < Date.now()) {
    pendingTotp.delete(sessionId);
    return null;
  }
  return entry.secret;
};

const browserName = (ua: string) => {
  if (!ua) return "Unbekannter Browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} auf ${os}` : browser;
};

profileRoutes.get("/", c => {
  const user = c.get("user") as User;
  const session = c.get("session");
  const csrf = csrfToken(c);
  const sessions = listSessionsOfUser(user.id);
  const pending = pendingFor(session?.id);
  const issuer = `${getSettings("general").siteName} Admin`;
  const forced = c.req.query("pflicht") === "1" || Boolean(user.must_change_password);

  return view(
    c,
    "Profil & Sicherheit",
    "",
    <>
      <PageHead title={<><Head name={headName(user)} size={36} /> {user.username}</>} sub={`${ROLES[user.role]?.label ?? user.role} · Profil & Sicherheit`} />
      {forced && user.must_change_password ? <div class="meldung fehler">Bitte vergib zuerst ein eigenes Passwort – danach kannst du das Admin-Panel normal benutzen.</div> : null}

      <div class="raster-2">
        <Card title="Passwort ändern" id="passwort">
          <form method="post" action="/admin/profil/passwort" class="formular">
            <Csrf token={csrf} />
            <input type="text" name="username" value={user.username} autocomplete="username" hidden />
            <Field label="Aktuelles Passwort"><input type="password" name="current" required autocomplete="current-password" /></Field>
            <Field label="Neues Passwort" hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen. Ein Satz aus mehreren Wörtern ist sicher und gut zu merken.`}>
              <input type="password" name="new" required minlength={MIN_PASSWORD_LENGTH} autocomplete="new-password" />
            </Field>
            <Field label="Neues Passwort wiederholen"><input type="password" name="new2" required minlength={MIN_PASSWORD_LENGTH} autocomplete="new-password" /></Field>
            <div><button class="knopf" type="submit"><Icon name="key" />Passwort ändern</button></div>
          </form>
        </Card>

        <Card title="Zwei-Faktor-Schutz (2FA)" id="zwei-faktor">
          {user.totp_secret ? (
            <>
              <p class="ok-text"><Icon name="shield" /> Aktiv – beim Login wird zusätzlich ein Code aus deiner Authenticator-App abgefragt.</p>
              <form method="post" action="/admin/profil/2fa/aus" class="formular">
                <Csrf token={csrf} />
                <Field label="Passwort zur Bestätigung"><input type="password" name="password" required autocomplete="current-password" /></Field>
                <div><button class="knopf leise" type="submit">2FA abschalten</button></div>
              </form>
            </>
          ) : pending ? (
            <>
              <p>Scanne den QR-Code mit einer Authenticator-App (z. B. Aegis, Google Authenticator, 1Password) und gib den angezeigten Code ein.</p>
              <div class="qr">{raw(renderSVG(totpUri(issuer, user.username, pending), { border: 2, whiteColor: "#ffffff", blackColor: "#111111" }))}</div>
              <p class="klein">Manuelle Eingabe: <code class="umbruch">{pending.replace(/(.{4})/g, "$1 ").trim()}</code></p>
              <form method="post" action="/admin/profil/2fa/bestaetigen" class="formular">
                <Csrf token={csrf} />
                <Field label="6-stelliger Code"><input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength={7} /></Field>
                <div><button class="knopf" type="submit"><Icon name="check" />Aktivieren</button></div>
              </form>
            </>
          ) : (
            <>
              <p>Schützt deinen Account zusätzlich: Selbst mit deinem Passwort kann sich niemand ohne dein Handy anmelden.</p>
              <form method="post" action="/admin/profil/2fa/start">
                <Csrf token={csrf} />
                <button class="knopf" type="submit"><Icon name="shield" />2FA einrichten</button>
              </form>
            </>
          )}
        </Card>

        <Card title="Minecraft-Kopf">
          <form method="post" action="/admin/profil/minecraft" class="formular">
            <Csrf token={csrf} />
            <Field label="Minecraft-Name" hint="Bestimmt den Kopf neben deinem Namen. Leer = Benutzername.">
              <input name="minecraft_name" value={user.minecraft_name} maxlength={17} />
            </Field>
            <div><button class="knopf" type="submit"><Icon name="check" />Speichern</button></div>
          </form>
        </Card>

        <Card title="Angemeldete Geräte">
          <ul class="sitzungen">
            {sessions.map(s => (
              <li>
                <span><b>{browserName(s.user_agent)}</b>{s.id === session?.id ? <em> · dieses Gerät</em> : null}</span>
                <small>seit {dateTime(s.created_at)} · aktiv {ago(s.last_seen_at)}{s.remember ? " · angemeldet bleiben" : ""}</small>
              </li>
            ))}
          </ul>
          {sessions.length > 1 ? (
            <form method="post" action="/admin/profil/sitzungen">
              <Csrf token={csrf} />
              <button class="knopf leise" type="submit"><Icon name="logout" />Alle anderen Geräte abmelden</button>
            </form>
          ) : null}
        </Card>
      </div>
    </>
  );
});

profileRoutes.post("/passwort", async c => {
  const user = c.get("user") as User;
  const body = await formBody(c);
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.new === "string" ? body.new : "";
  const next2 = typeof body.new2 === "string" ? body.new2 : "";
  const fail = (text: string) => {
    flash(c, text, "fehler");
    return c.redirect("/admin/profil#passwort");
  };
  if (!(await verifyPassword(current, user.password_hash))) return fail("Das aktuelle Passwort stimmt nicht.");
  if (next.length < MIN_PASSWORD_LENGTH) return fail(`Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
  if (next.length > 200) return fail("Das neue Passwort ist zu lang.");
  if (next !== next2) return fail("Die neuen Passwörter stimmen nicht überein.");
  if (next === current) return fail("Das neue Passwort muss sich vom alten unterscheiden.");
  setPassword(user.id, await hashPassword(next), false);
  deleteSessionsOfUser(user.id, c.get("session")?.id);
  audit(actor(c), "profil.passwort");
  flash(c, "Passwort geändert. Andere Geräte wurden abgemeldet.");
  return c.redirect("/admin");
});

profileRoutes.post("/minecraft", async c => {
  const user = c.get("user") as User;
  const name = str(await formBody(c), "minecraft_name", 17);
  if (name && !HEAD_NAME.test(name)) {
    flash(c, "Der Minecraft-Name ist ungültig.", "fehler");
  } else {
    setMinecraftName(user.id, name);
    flash(c, "Gespeichert.");
  }
  return c.redirect("/admin/profil");
});

profileRoutes.post("/2fa/start", c => {
  const session = c.get("session");
  if (session) pendingTotp.set(session.id, { secret: generateTotpSecret(), expires: Date.now() + 15 * 60_000 });
  return c.redirect("/admin/profil#zwei-faktor");
});

profileRoutes.post("/2fa/bestaetigen", async c => {
  const user = c.get("user") as User;
  const session = c.get("session");
  const secret = pendingFor(session?.id);
  if (!secret || !session) {
    flash(c, "Die Einrichtung ist abgelaufen. Bitte starte sie neu.", "fehler");
    return c.redirect("/admin/profil#zwei-faktor");
  }
  if (!verifyTotp(secret, str(await formBody(c), "code", 10))) {
    flash(c, "Der Code stimmt nicht. Prüfe, ob die Uhrzeit deines Handys stimmt, und versuch es erneut.", "fehler");
    return c.redirect("/admin/profil#zwei-faktor");
  }
  setTotpSecret(user.id, secret);
  pendingTotp.delete(session.id);
  audit(actor(c), "profil.2fa.aktiviert");
  flash(c, "Zwei-Faktor-Schutz ist jetzt aktiv.");
  return c.redirect("/admin/profil#zwei-faktor");
});

profileRoutes.post("/2fa/aus", async c => {
  const user = c.get("user") as User;
  const body = await formBody(c);
  const password = typeof body.password === "string" ? body.password : "";
  if (!(await verifyPassword(password, user.password_hash))) {
    flash(c, "Das Passwort stimmt nicht.", "fehler");
    return c.redirect("/admin/profil#zwei-faktor");
  }
  setTotpSecret(user.id, null);
  audit(actor(c), "profil.2fa.deaktiviert");
  flash(c, "Zwei-Faktor-Schutz wurde abgeschaltet.");
  return c.redirect("/admin/profil#zwei-faktor");
});

profileRoutes.post("/sitzungen", c => {
  const user = c.get("user") as User;
  deleteSessionsOfUser(user.id, c.get("session")?.id);
  audit(actor(c), "profil.abgemeldet");
  flash(c, "Alle anderen Geräte wurden abgemeldet.");
  return c.redirect("/admin/profil");
});
