import { Hono } from "hono";
import { isRole, ROLES, type Role } from "../../../shared/catalog.js";
import { toInt, type AppEnv, type Ctx } from "../../http.js";
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH } from "../../lib/security.js";
import { audit, countAudit, listAudit } from "../../repo/audit.js";
import { deleteSessionsOfUser } from "../../repo/sessions.js";
import {
  countActiveAdmins,
  createUser,
  deleteUser,
  getUser,
  getUserByName,
  headName,
  listUsers,
  setPassword,
  setTotpSecret,
  updateUser,
  USERNAME_PATTERN,
  type User
} from "../../repo/users.js";
import { HEAD_NAME } from "../../services/heads.js";
import { ago, dateTime } from "../../views/format.js";
import { actionLabel } from "../../views/admin/actions.js";
import { Badge, Card, Csrf, DeleteButton, Empty, Field, Head, Icon, PageHead, Pager, Toggle } from "../../views/admin/ui.js";
import { actor, csrfToken, flash, requireArea } from "./auth.js";
import { bool, formBody, str } from "./form.js";
import { view } from "./render.js";

export const userRoutes = new Hono<AppEnv>();

for (const prefix of ["/benutzer", "/protokoll"]) {
  userRoutes.use(prefix, requireArea("system"));
  userRoutes.use(`${prefix}/*`, requireArea("system"));
}

const RoleSelect = (p: { value: Role; disabled?: boolean }) => (
  <select name="role" disabled={p.disabled}>
    {Object.entries(ROLES).map(([k, r]) => <option value={k} selected={p.value === k}>{r.label} – {r.hint}</option>)}
  </select>
);

const PasswordShown = (p: { c: Ctx; name: string; password: string; created: boolean }) => (
  <>
    <PageHead title={p.created ? "Benutzer angelegt" : "Passwort zurückgesetzt"} back={{ href: "/admin/benutzer", label: "Benutzer" }} />
    <Card class="schmal-karte">
      <p>{p.created ? <>Der Account <b>{p.name}</b> wurde angelegt.</> : <>Das Passwort von <b>{p.name}</b> wurde neu gesetzt.</>} Gib die Zugangsdaten sicher weiter (z. B. per Discord-DM) – das Passwort wird hier <b>nur einmal</b> angezeigt.</p>
      <div class="zugang">
        <div><small>Name</small><code>{p.name}</code></div>
        <div><small>Passwort</small><code>{p.password}</code><button class="mini" type="button" data-copy={p.password}>kopieren</button></div>
        <div><small>Login</small><code>/admin</code></div>
      </div>
      <p class="klein">Beim ersten Login muss das Passwort geändert werden.</p>
      <a class="knopf" href="/admin/benutzer">Fertig</a>
    </Card>
  </>
);

userRoutes.get("/benutzer", c => {
  const csrf = csrfToken(c);
  const me = c.get("user") as User;
  const users = listUsers();
  return view(
    c,
    "Benutzer",
    "benutzer",
    <>
      <PageHead title="Benutzer" sub="Wer Zugriff auf das Admin-Panel hat und was er darf." />
      <div class="raster-seite">
        <Card>
          <div class="tabelle">
            {users.map(u => (
              <div class="tabelle-zeile">
                <Head name={headName(u)} size={36} />
                <div class="haupt">
                  <a href={`/admin/benutzer/${u.id}`}><strong>{u.username}</strong>{u.id === me.id ? <span class="du"> (du)</span> : null}</a>
                  <small>{ROLES[u.role]?.label ?? u.role} · zuletzt angemeldet {u.last_login_at ? ago(u.last_login_at) : "noch nie"}</small>
                </div>
                {u.has_totp ? <Badge color="gruen">2FA</Badge> : null}
                {u.active ? null : <Badge color="rot">Deaktiviert</Badge>}
                {u.must_change_password ? <Badge color="gelb">Passwort ändern</Badge> : null}
                <div class="werkzeuge"><a class="mini-knopf" href={`/admin/benutzer/${u.id}`} title="Bearbeiten"><Icon name="pencil" /></a></div>
              </div>
            ))}
          </div>
        </Card>
        <aside>
          <Card title="Neuer Benutzer">
            <form method="post" action="/admin/benutzer" class="formular">
              <Csrf token={csrf} />
              <Field label="Name" hint="3–32 Zeichen, am besten der Minecraft-Name.">
                <input name="username" required maxlength={32} pattern="[A-Za-z0-9_.\-]{3,32}" autocomplete="off" />
              </Field>
              <Field label="Rolle"><RoleSelect value="moderator" /></Field>
              <Field label="Minecraft-Name für den Kopf" hint="Optional, wenn abweichend vom Namen.">
                <input name="minecraft_name" maxlength={17} />
              </Field>
              <Field label="Passwort" hint={`Leer lassen = sicheres Passwort erzeugen. Sonst mind. ${MIN_PASSWORD_LENGTH} Zeichen.`}>
                <input name="password" type="password" minlength={MIN_PASSWORD_LENGTH} autocomplete="new-password" />
              </Field>
              <button class="knopf" type="submit"><Icon name="plus" />Anlegen</button>
            </form>
          </Card>
          <Card title="Rollen">
            <ul class="rollen">
              {Object.values(ROLES).map(r => <li><b>{r.label}</b><span>{r.hint}</span></li>)}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
});

userRoutes.post("/benutzer", async c => {
  const body = await formBody(c);
  const username = str(body, "username", 32);
  const roleRaw = str(body, "role", 20);
  const role: Role = isRole(roleRaw) ? roleRaw : "moderator";
  const mc = str(body, "minecraft_name", 17);
  const given = typeof body.password === "string" ? body.password : "";
  if (!USERNAME_PATTERN.test(username)) {
    flash(c, "Der Name darf 3–32 Zeichen lang sein: Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich.", "fehler");
    return c.redirect("/admin/benutzer");
  }
  if (getUserByName(username)) {
    flash(c, `Den Namen „${username}“ gibt es schon.`, "fehler");
    return c.redirect("/admin/benutzer");
  }
  if (mc && !HEAD_NAME.test(mc)) {
    flash(c, "Der Minecraft-Name ist ungültig.", "fehler");
    return c.redirect("/admin/benutzer");
  }
  if (given && given.length < MIN_PASSWORD_LENGTH) {
    flash(c, `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`, "fehler");
    return c.redirect("/admin/benutzer");
  }
  const password = given || generatePassword();
  createUser({ username, passwordHash: await hashPassword(password), role, minecraftName: mc, mustChange: true });
  audit(actor(c), "benutzer.angelegt", username, ROLES[role].label);
  return view(c, "Benutzer angelegt", "benutzer", <PasswordShown c={c} name={username} password={password} created />);
});

userRoutes.get("/benutzer/:id{[0-9]+}", c => {
  const u = getUser(Number(c.req.param("id")));
  if (!u) return c.redirect("/admin/benutzer");
  const me = c.get("user") as User;
  const self = me.id === u.id;
  const csrf = csrfToken(c);
  return view(
    c,
    u.username,
    "benutzer",
    <>
      <PageHead title={<><Head name={headName(u)} size={36} /> {u.username}</>} back={{ href: "/admin/benutzer", label: "Benutzer" }} sub={`Angelegt am ${dateTime(u.created_at)} · zuletzt angemeldet ${u.last_login_at ? ago(u.last_login_at) : "noch nie"}`} />
      <div class="raster-seite">
        <Card title="Rechte & Profil">
          <form method="post" action={`/admin/benutzer/${u.id}`} class="formular">
            <Csrf token={csrf} />
            <Field label="Rolle" hint={self ? "Deine eigene Rolle kannst du nicht ändern." : undefined}><RoleSelect value={u.role} disabled={self} /></Field>
            <Field label="Minecraft-Name für den Kopf"><input name="minecraft_name" value={u.minecraft_name} maxlength={17} /></Field>
            {self ? null : <Toggle name="active" checked={Boolean(u.active)} label="Account aktiv" hint="Deaktivierte Accounts können sich nicht mehr anmelden." />}
            <div><button class="knopf" type="submit"><Icon name="check" />Speichern</button></div>
          </form>
        </Card>
        <aside>
          <Card title="Sicherheit">
            <form method="post" action={`/admin/benutzer/${u.id}/passwort`} data-confirm={`Neues Passwort für ${u.username} erzeugen? Das alte gilt dann nicht mehr.`}>
              <Csrf token={csrf} />
              <button class="knopf leise breit" type="submit"><Icon name="key" />Neues Passwort erzeugen</button>
            </form>
            <form method="post" action={`/admin/benutzer/${u.id}/sitzungen`}>
              <Csrf token={csrf} />
              <button class="knopf leise breit" type="submit"><Icon name="logout" />Überall abmelden</button>
            </form>
            {u.totp_secret ? (
              <form method="post" action={`/admin/benutzer/${u.id}/2fa-aus`} data-confirm="Zwei-Faktor-Schutz für diesen Account abschalten?">
                <Csrf token={csrf} />
                <button class="knopf leise breit" type="submit"><Icon name="lock" />2FA zurücksetzen</button>
              </form>
            ) : <p class="klein">Zwei-Faktor-Schutz ist nicht aktiviert. Jeder kann ihn selbst unter „Profil“ einschalten.</p>}
          </Card>
          {self ? null : (
            <Card title="Löschen" class="gefahr">
              <p class="klein">Der Account wird entfernt. Einträge im Protokoll bleiben erhalten.</p>
              <DeleteButton action={`/admin/benutzer/${u.id}/loeschen`} csrf={csrf} confirm={`Account ${u.username} wirklich löschen?`} label="Account löschen" />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
});

/** Verhindert, dass der letzte aktive Administrator entfernt oder herabgestuft wird. */
const wouldLoseLastAdmin = (u: User, nextRole: Role, nextActive: boolean) =>
  u.role === "admin" && Boolean(u.active) && (nextRole !== "admin" || !nextActive) && countActiveAdmins() <= 1;

userRoutes.post("/benutzer/:id{[0-9]+}", async c => {
  const u = getUser(Number(c.req.param("id")));
  if (!u) return c.redirect("/admin/benutzer");
  const me = c.get("user") as User;
  const body = await formBody(c);
  const roleRaw = str(body, "role", 20);
  const self = me.id === u.id;
  const role: Role = self ? u.role : isRole(roleRaw) ? roleRaw : u.role;
  const active = self ? true : bool(body, "active");
  const mc = str(body, "minecraft_name", 17);
  if (mc && !HEAD_NAME.test(mc)) {
    flash(c, "Der Minecraft-Name ist ungültig.", "fehler");
    return c.redirect(`/admin/benutzer/${u.id}`);
  }
  if (wouldLoseLastAdmin(u, role, active)) {
    flash(c, "Es muss mindestens ein aktiver Administrator übrig bleiben.", "fehler");
    return c.redirect(`/admin/benutzer/${u.id}`);
  }
  updateUser(u.id, { role, minecraftName: mc, active });
  if (!active) deleteSessionsOfUser(u.id);
  audit(actor(c), "benutzer.geaendert", u.username, `${ROLES[role].label}${active ? "" : ", deaktiviert"}`);
  flash(c, "Benutzer gespeichert.");
  return c.redirect(`/admin/benutzer/${u.id}`);
});

userRoutes.post("/benutzer/:id{[0-9]+}/passwort", async c => {
  const u = getUser(Number(c.req.param("id")));
  if (!u) return c.redirect("/admin/benutzer");
  const password = generatePassword();
  setPassword(u.id, await hashPassword(password), true);
  deleteSessionsOfUser(u.id, c.get("user")?.id === u.id ? c.get("session")?.id : undefined);
  audit(actor(c), "benutzer.passwort.zurueckgesetzt", u.username);
  return view(c, "Passwort zurückgesetzt", "benutzer", <PasswordShown c={c} name={u.username} password={password} created={false} />);
});

userRoutes.post("/benutzer/:id{[0-9]+}/sitzungen", c => {
  const u = getUser(Number(c.req.param("id")));
  if (u) {
    const mine = c.get("user")?.id === u.id;
    deleteSessionsOfUser(u.id, mine ? c.get("session")?.id : undefined);
    audit(actor(c), "benutzer.abgemeldet", u.username);
    flash(c, mine ? "Alle anderen Sitzungen wurden beendet." : `${u.username} wurde überall abgemeldet.`);
  }
  return c.redirect(`/admin/benutzer/${u?.id ?? ""}`);
});

userRoutes.post("/benutzer/:id{[0-9]+}/2fa-aus", c => {
  const u = getUser(Number(c.req.param("id")));
  if (u) {
    setTotpSecret(u.id, null);
    audit(actor(c), "benutzer.2fa.zurueckgesetzt", u.username);
    flash(c, `Zwei-Faktor-Schutz für ${u.username} abgeschaltet.`);
  }
  return c.redirect(`/admin/benutzer/${u?.id ?? ""}`);
});

userRoutes.post("/benutzer/:id{[0-9]+}/loeschen", c => {
  const u = getUser(Number(c.req.param("id")));
  const me = c.get("user") as User;
  if (!u || u.id === me.id) return c.redirect("/admin/benutzer");
  if (wouldLoseLastAdmin(u, "moderator", false)) {
    flash(c, "Der letzte aktive Administrator kann nicht gelöscht werden.", "fehler");
    return c.redirect(`/admin/benutzer/${u.id}`);
  }
  deleteUser(u.id);
  audit(actor(c), "benutzer.geloescht", u.username);
  flash(c, `Account ${u.username} gelöscht.`);
  return c.redirect("/admin/benutzer");
});

// --- Protokoll ----------------------------------------------------------------------------------------------

userRoutes.get("/protokoll", c => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 60);
  const page = Math.max(1, toInt(c.req.query("seite"), 1));
  const per = 50;
  const total = countAudit(q);
  const entries = listAudit(per, (page - 1) * per, q);
  const href = (p: number) => `/admin/protokoll?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { seite: String(p) } : {}) }).toString()}`;
  return view(
    c,
    "Protokoll",
    "protokoll",
    <>
      <PageHead title="Protokoll" sub={`${total} Einträge · wer hat wann was geändert (Einträge älter als ein Jahr werden gelöscht)`}>
        <form class="suche" method="get" action="/admin/protokoll">
          <input type="search" name="q" value={q} placeholder="Name, Aktion, Ziel" aria-label="Suchen" />
          <button class="knopf" type="submit"><Icon name="search" />Suchen</button>
        </form>
      </PageHead>
      {entries.length ? (
        <Card>
          <div class="protokoll">
            {entries.map(e => (
              <div class="protokoll-zeile">
                <span class="wann" title={dateTime(e.created_at)}>{dateTime(e.created_at)}</span>
                <b>{e.username}</b>
                <span title={e.action}>{actionLabel(e.action)}</span>
                <span>{e.target}</span>
                <small>{e.details}</small>
              </div>
            ))}
          </div>
        </Card>
      ) : <Empty title={q ? "Nichts gefunden" : "Noch keine Einträge"} />}
      <Pager page={page} pages={Math.max(1, Math.ceil(total / per))} href={href} />
    </>
  );
});
