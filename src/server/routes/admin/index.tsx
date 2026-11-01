import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { APPLICATION_STATUS, APPLICATION_TYPES, ROLES } from "../../../shared/catalog.js";
import { clientIp, isHttps, type AppEnv, type Ctx } from "../../http.js";
import { renderMarkdown } from "../../lib/markdown.js";
import { dummyPasswordCheck, hashPassword, MIN_PASSWORD_LENGTH, randomToken, safeEqual, verifyPassword, verifyTotp } from "../../lib/security.js";
import { countByStatus, recentApplications } from "../../repo/applications.js";
import { audit, listAudit } from "../../repo/audit.js";
import { countItems } from "../../repo/items.js";
import { listMedia } from "../../repo/media.js";
import { isOrderableTable, moveRow } from "../../repo/order.js";
import { forget, hit, tooMany } from "../../repo/ratelimit.js";
import { createSession, deleteSession } from "../../repo/sessions.js";
import { getSettings } from "../../repo/settings.js";
import { countMembers } from "../../repo/team.js";
import { countUsers, createUser, getUser, getUserByName, touchLogin, USERNAME_PATTERN, type User } from "../../repo/users.js";
import { countArticles, wikiTree } from "../../repo/wiki.js";
import { serverStatus } from "../../services/status.js";
import { clearSetupCode, setupCode } from "../../services/setup.js";
import { ago } from "../../views/format.js";
import { actionLabel } from "../../views/admin/actions.js";
import { Badge, BareLayout, Card, Head, Icon, PageHead } from "../../views/admin/ui.js";
import { actor, can, clearSessionCookie, flash, loadSession, requireArea, requireLogin, setSessionCookie, verifyCsrf } from "./auth.js";
import { safeReturn, view } from "./render.js";
import { formBody, str } from "./form.js";
import { applicationRoutes } from "./applications.js";
import { contentRoutes } from "./content.js";
import { catalogRoutes } from "./catalog.js";
import { mediaRoutes } from "./media.js";
import { profileRoutes } from "./profile.js";
import { settingsRoutes } from "./settings.js";
import { userRoutes } from "./users.js";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", loadSession);
adminRoutes.use("*", verifyCsrf);

// --- Anmeldung -----------------------------------------------------------------------------------------

const TWOFA_COOKIE = "letopia_2fa";
const pending2fa = new Map<string, { userId: number; remember: boolean; back: string; expires: number }>();

const LoginCard = (p: { error?: string; name?: string; back: string; info?: string | null }) => (
  <section class="karte schmal">
    <img class="marke" src="/assets/img/mark.png" alt="" width={56} height={56} />
    <h1>Admin-Panel</h1>
    <p>Melde dich an, um Bewerbungen und Inhalte zu verwalten.</p>
    {p.info ? <div class="meldung ok">{p.info}</div> : null}
    {p.error ? <div class="meldung fehler">{p.error}</div> : null}
    <form method="post" action="/admin/login" class="formular">
      <input type="hidden" name="weiter" value={p.back} />
      <label>Name<input name="name" required autocomplete="username" autofocus value={p.name ?? ""} maxlength={32} /></label>
      <label>Passwort<input name="passwort" type="password" required autocomplete="current-password" maxlength={200} /></label>
      <label class="haken"><input type="checkbox" name="merken" /> Angemeldet bleiben (30 Tage)</label>
      <button class="knopf" type="submit">Anmelden</button>
    </form>
    <a class="zurueck-seite" href="/">← Zur Website</a>
  </section>
);

const SetupCard = (p: { error?: string; name?: string }) => (
  <section class="karte schmal">
    <img class="marke" src="/assets/img/mark.png" alt="" width={56} height={56} />
    <h1>Admin-Panel einrichten</h1>
    <p>Es gibt noch keinen Admin-Account. Lege hier den ersten an. Den Einrichtungscode findest du im Server-Log (<code>letopia logs</code>).</p>
    {p.error ? <div class="meldung fehler">{p.error}</div> : null}
    <form method="post" action="/admin/login" class="formular">
      <input type="hidden" name="einrichtung" value="1" />
      <label>Einrichtungscode<input name="code" required autocomplete="off" maxlength={20} /></label>
      <label>Admin-Name<input name="name" required maxlength={32} pattern="[A-Za-z0-9_.\-]{3,32}" autocomplete="username" value={p.name ?? ""} /></label>
      <label>Passwort<input name="passwort" type="password" required minlength={MIN_PASSWORD_LENGTH} autocomplete="new-password" /></label>
      <label>Passwort wiederholen<input name="passwort2" type="password" required minlength={MIN_PASSWORD_LENGTH} autocomplete="new-password" /></label>
      <button class="knopf" type="submit">Account anlegen</button>
    </form>
  </section>
);

const TwoFactorCard = (p: { error?: string }) => (
  <section class="karte schmal">
    <img class="marke" src="/assets/img/mark.png" alt="" width={56} height={56} />
    <h1>Bestätigung</h1>
    <p>Gib den 6-stelligen Code aus deiner Authenticator-App ein.</p>
    {p.error ? <div class="meldung fehler">{p.error}</div> : null}
    <form method="post" action="/admin/login/2fa" class="formular">
      <label>Code<input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength={7} autofocus /></label>
      <button class="knopf" type="submit">Bestätigen</button>
    </form>
    <a class="zurueck-seite" href="/admin/login">← Abbrechen</a>
  </section>
);

const completeLogin = (c: Ctx, user: User, remember: boolean, back: string) => {
  const token = createSession(user.id, remember, c.req.header("user-agent") ?? "");
  setSessionCookie(c, token, remember);
  touchLogin(user.id);
  forget("login-name", user.username.toLowerCase());
  audit({ id: user.id, username: user.username }, "anmeldung", "", `IP ${clientIp(c)}`);
  return c.redirect(safeReturn(back));
};

adminRoutes.get("/login", c => {
  if (c.get("user")) return c.redirect("/admin");
  if (countUsers() === 0) {
    setupCode();
    return c.html(<BareLayout title="Einrichtung"><SetupCard /></BareLayout>);
  }
  const f = c.get("flash");
  return c.html(<BareLayout title="Anmelden"><LoginCard back={safeReturn(c.req.query("weiter"))} info={f?.text ?? null} /></BareLayout>);
});

adminRoutes.post("/login", async c => {
  const body = await formBody(c);
  const ip = clientIp(c);
  const name = str(body, "name", 32);
  const password = typeof body.passwort === "string" ? body.passwort.slice(0, 200) : "";
  const back = safeReturn(str(body, "weiter", 300));

  // Ersteinrichtung: erster Admin-Account
  if (countUsers() === 0) {
    const fail = (error: string) => c.html(<BareLayout title="Einrichtung"><SetupCard error={error} name={name} /></BareLayout>, 422);
    if (tooMany("setup", ip, 10, 900)) return fail("Zu viele Versuche. Bitte warte 15 Minuten.");
    if (!safeEqual(str(body, "code", 20).toUpperCase(), setupCode())) {
      hit("setup", ip);
      return fail("Der Einrichtungscode stimmt nicht. Du findest ihn im Server-Log.");
    }
    if (!USERNAME_PATTERN.test(name)) return fail("Der Name darf 3–32 Zeichen lang sein: Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich.");
    if (password.length < MIN_PASSWORD_LENGTH) return fail(`Bitte nimm ein Passwort mit mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`);
    if (password !== (typeof body.passwort2 === "string" ? body.passwort2 : "")) return fail("Die Passwörter stimmen nicht überein.");
    const id = createUser({ username: name, passwordHash: await hashPassword(password), role: "admin" });
    clearSetupCode();
    const user = getUser(id);
    if (!user) return fail("Der Account konnte nicht angelegt werden.");
    audit({ id, username: name }, "benutzer.angelegt", name, "Ersteinrichtung");
    flash(c, `Willkommen, ${name}! Dein Admin-Account ist eingerichtet.`);
    return completeLogin(c, user, false, "/admin");
  }

  const fail = (error: string, status: 401 | 429 = 401) =>
    c.html(<BareLayout title="Anmelden"><LoginCard error={error} name={name} back={back} /></BareLayout>, status);

  if (tooMany("login-ip", ip, 10, 900) || (name && tooMany("login-name", name.toLowerCase(), 5, 900))) {
    return fail("Zu viele Fehlversuche. Bitte warte 15 Minuten.", 429);
  }

  const user = name ? getUserByName(name) : undefined;
  const ok = user ? await verifyPassword(password, user.password_hash) : await dummyPasswordCheck(password);
  if (!user || !ok) {
    hit("login-ip", ip);
    if (name) hit("login-name", name.toLowerCase());
    return fail("Name oder Passwort stimmt nicht.");
  }
  if (!user.active) return fail("Dieser Account ist deaktiviert.");

  const remember = body.merken === "on";
  if (user.totp_secret) {
    const token = randomToken(24);
    pending2fa.set(token, { userId: user.id, remember, back, expires: Date.now() + 5 * 60_000 });
    for (const [key, entry] of pending2fa) if (entry.expires < Date.now()) pending2fa.delete(key);
    setCookie(c, TWOFA_COOKIE, token, { path: "/admin/login", httpOnly: true, sameSite: "Lax", secure: isHttps(c), maxAge: 300 });
    return c.html(<BareLayout title="Bestätigung"><TwoFactorCard /></BareLayout>);
  }
  return completeLogin(c, user, remember, back);
});

adminRoutes.post("/login/2fa", async c => {
  const token = getCookie(c, TWOFA_COOKIE) ?? "";
  const entry = pending2fa.get(token);
  if (!entry || entry.expires < Date.now()) {
    pending2fa.delete(token);
    flash(c, "Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.", "fehler");
    return c.redirect("/admin/login");
  }
  const user = getUser(entry.userId);
  const body = await formBody(c);
  if (!user?.totp_secret || !user.active) return c.redirect("/admin/login");
  if (tooMany("2fa", String(user.id), 5, 900)) {
    pending2fa.delete(token);
    return c.html(<BareLayout title="Bestätigung"><TwoFactorCard error="Zu viele Fehlversuche. Bitte warte 15 Minuten." /></BareLayout>, 429);
  }
  if (!verifyTotp(user.totp_secret, str(body, "code", 10))) {
    hit("2fa", String(user.id));
    return c.html(<BareLayout title="Bestätigung"><TwoFactorCard error="Der Code stimmt nicht. Achte darauf, dass die Uhrzeit deines Handys stimmt." /></BareLayout>, 401);
  }
  pending2fa.delete(token);
  deleteCookie(c, TWOFA_COOKIE, { path: "/admin/login" });
  forget("2fa", String(user.id));
  return completeLogin(c, user, entry.remember, entry.back);
});

adminRoutes.post("/logout", c => {
  const session = c.get("session");
  if (session) {
    deleteSession(session.id);
    audit(actor(c), "abmeldung");
  }
  clearSessionCookie(c);
  flash(c, "Du wurdest abgemeldet.");
  return c.redirect("/admin/login");
});

// --- Ab hier nur mit Anmeldung ------------------------------------------------------------------------------

adminRoutes.use("*", requireLogin);

adminRoutes.route("/bewerbungen", applicationRoutes);
adminRoutes.route("/", contentRoutes);
adminRoutes.route("/", catalogRoutes);
adminRoutes.route("/medien", mediaRoutes);
adminRoutes.route("/einstellungen", settingsRoutes);
adminRoutes.route("/", userRoutes);
adminRoutes.route("/profil", profileRoutes);

// --- Übersicht ---------------------------------------------------------------------------------------------

adminRoutes.get("/", async c => {
  const user = c.get("user") as User;
  const counts = countByStatus();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const g = getSettings("general");
  const status = g.statusSource === "off" ? null : await Promise.race([serverStatus(), new Promise<null>(r => setTimeout(() => r(null), 2500))]);
  const apps = can(user, "applications") ? recentApplications(6) : [];
  const log = can(user, "system") ? listAudit(8) : [];
  const appSettings = getSettings("applications");
  const hour = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" }).format(new Date()));
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";

  return view(
    c,
    "Übersicht",
    "dashboard",
    <>
      <PageHead title={`${greeting}, ${user.username}!`} sub={`Angemeldet als ${ROLES[user.role]?.label ?? user.role}.`}>
        <a class="knopf leise" href="/" target="_blank" rel="noopener"><Icon name="external" />Website öffnen</a>
      </PageHead>

      <div class="kacheln">
        {can(user, "applications") ? (
          <a class="kachel" href="/admin/bewerbungen?status=neu">
            <span class="kachel-ico blau"><Icon name="send" /></span>
            <strong>{counts.neu ?? 0}</strong>
            <span>Neue Bewerbungen</span>
            <small>{total} insgesamt · {counts.pruefung ?? 0} in Prüfung</small>
          </a>
        ) : null}
        <div class="kachel">
          <span class={`kachel-ico ${status?.online ? "gruen" : "rot"}`}><Icon name="wifi" /></span>
          <strong>{status ? (status.online ? `${status.players.online}/${status.players.max}` : "Offline") : "–"}</strong>
          <span>Minecraft-Server</span>
          <small>{g.serverAddress}{status?.version ? ` · ${status.version}` : ""}</small>
        </div>
        {can(user, "content") ? (
          <>
            <a class="kachel" href="/admin/wiki">
              <span class="kachel-ico gelb"><Icon name="book" /></span>
              <strong>{countArticles()}</strong>
              <span>Wiki-Artikel</span>
              <small>{wikiTree().categories.length} Kategorien</small>
            </a>
            <a class="kachel" href="/admin/team">
              <span class="kachel-ico lila"><Icon name="users" /></span>
              <strong>{countMembers()}</strong>
              <span>Teammitglieder</span>
              <small>{countItems()} Custom Items</small>
            </a>
          </>
        ) : null}
      </div>

      <div class="raster-2">
        {can(user, "applications") ? (
          <Card title="Neueste Bewerbungen" actions={<a class="knopf leise" href="/admin/bewerbungen">Alle ansehen</a>}>
            {apps.length ? (
              <div class="liste kompakt">
                {apps.map(a => {
                  const st = APPLICATION_STATUS[a.status as keyof typeof APPLICATION_STATUS] ?? APPLICATION_STATUS.neu;
                  return (
                    <a class={`zeile${a.status === "neu" ? " ungelesen" : ""}`} href={`/admin/bewerbungen/${a.id}`}>
                      <Head name={a.player_name} />
                      <span class="wer"><strong>{a.player_name}</strong><small>{APPLICATION_TYPES[a.type as keyof typeof APPLICATION_TYPES] ?? a.type}{a.summary ? ` · ${a.summary}` : ""}</small></span>
                      <span class="wann">{ago(a.created_at)}</span>
                      <Badge color={st.color}>{st.label}</Badge>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p class="klein">Noch keine Bewerbungen eingegangen.</p>
            )}
            <p class="klein">
              Team-Bewerbungen: <b>{appSettings.teamOpen ? "offen" : "geschlossen"}</b> · Creator-Bewerbungen: <b>{appSettings.creatorOpen ? "offen" : "geschlossen"}</b>
              {can(user, "system") ? <> · <a href="/admin/einstellungen#bewerbungen">ändern</a></> : null}
            </p>
          </Card>
        ) : null}

        {can(user, "system") ? (
          <Card title="Letzte Aktivität" actions={<a class="knopf leise" href="/admin/protokoll">Protokoll</a>}>
            {log.length ? (
              <ul class="aktivitaet">
                {log.map(e => (
                  <li>
                    <b>{e.username}</b> {actionLabel(e.action)}{e.target ? <> · <span>{e.target}</span></> : null}
                    <small>{ago(e.created_at)}</small>
                  </li>
                ))}
              </ul>
            ) : <p class="klein">Noch keine Einträge.</p>}
          </Card>
        ) : null}

        {can(user, "content") ? (
          <Card title="Schnellzugriff">
            <div class="schnell">
              <a href="/admin/wiki/neu"><Icon name="plus" />Wiki-Artikel schreiben</a>
              <a href="/admin/seiten"><Icon name="scroll" />Regeln bearbeiten</a>
              <a href="/admin/team"><Icon name="users" />Team pflegen</a>
              <a href="/admin/items/neu"><Icon name="gem" />Item anlegen</a>
              <a href="/admin/medien"><Icon name="upload" />Bild hochladen</a>
              {can(user, "system") ? <a href="/admin/einstellungen"><Icon name="settings" />Einstellungen</a> : null}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
});

// --- Reihenfolge ändern (Hoch/Runter-Buttons) ------------------------------------------------------------

adminRoutes.post("/sortieren", requireArea("content"), async c => {
  const body = await formBody(c);
  const table = str(body, "tabelle", 40);
  const id = Number(str(body, "id", 12));
  const back = safeReturn(str(body, "zurueck", 300));
  if (isOrderableTable(table) && Number.isInteger(id)) moveRow(table, id, str(body, "richtung", 10) === "hoch" ? -1 : 1);
  return c.redirect(back);
});

// --- Hilfs-Endpunkte für den Editor ---------------------------------------------------------------------

adminRoutes.post("/api/vorschau", requireArea("content"), async c => {
  const data = (await c.req.json().catch(() => ({}))) as { markdown?: unknown };
  const source = typeof data.markdown === "string" ? data.markdown.slice(0, 200_000) : "";
  const tree = wikiTree();
  const { html } = renderMarkdown(source, { title: key => tree.bySlug.get(key)?.title, link: slug => `/wiki/${slug}` });
  return c.json({ html });
});

adminRoutes.get("/api/medien", requireArea("content"), c =>
  c.json(listMedia().map(m => ({ url: `/uploads/${m.filename}`, name: m.original_name, width: m.width, height: m.height })))
);

adminRoutes.all("*", c =>
  view(
    c,
    "Nicht gefunden",
    "",
    <Card class="leer"><h2>Seite nicht gefunden</h2><p>Diese Seite gibt es im Admin-Panel nicht.</p><a class="knopf" href="/admin">Zur Übersicht</a></Card>,
    404
  )
);

