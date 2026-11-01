import { Hono } from "hono";
import { isHexColor } from "../../../shared/sprites.js";
import type { AppEnv, Ctx } from "../../http.js";
import { audit } from "../../repo/audit.js";
import { monthYear } from "../../views/format.js";
import { getSettings } from "../../repo/settings.js";
import {
  createGroup,
  createMember,
  deleteGroup,
  deleteMember,
  getGroup,
  getMember,
  listGroups,
  teamWithMembers,
  updateGroup,
  updateMember,
  type MemberInput
} from "../../repo/team.js";
import { HEAD_NAME } from "../../services/heads.js";
import { Card, Csrf, DeleteButton, Empty, Field, Head, Icon, MoveButtons, PageHead } from "../../views/admin/ui.js";
import { actor, csrfToken, flash } from "./auth.js";
import { formBody, str, text, type Body } from "./form.js";
import { view } from "./render.js";

export const teamRoutes = new Hono<AppEnv>();

const readGroup = (body: Body) => {
  const color = str(body, "color", 7);
  return { name: str(body, "name", 60), color: isHexColor(color) ? color.toLowerCase() : "#f0a830" };
};

teamRoutes.get("/", c => {
  const csrf = csrfToken(c);
  const groups = teamWithMembers();
  const total = groups.reduce((n, g) => n + g.members.length, 0);
  return view(
    c,
    "Team",
    "team",
    <>
      <PageHead title="Team" sub={`${total} Mitglieder in ${groups.length} Bereichen · Stand auf der Website: ${monthYear(getSettings("team").stand) || "–"}`}>
        <a class="knopf leise" href="/team" target="_blank" rel="noopener"><Icon name="external" />Team-Seite ansehen</a>
      </PageHead>

      {groups.length ? groups.map(g => (
        <Card class="team-gruppe">
          <header class="gruppen-kopf">
            <form method="post" action={`/admin/team/gruppen/${g.id}`} class="zeilen-formular">
              <Csrf token={csrf} />
              <input type="color" name="color" value={g.color} aria-label="Farbe" />
              <input name="name" value={g.name} required maxlength={60} aria-label="Name des Bereichs" class="gross" />
              <button class="mini-knopf" type="submit" title="Speichern"><Icon name="check" /></button>
            </form>
            <div class="werkzeuge">
              <MoveButtons table="team_groups" id={g.id} csrf={csrf} back="/admin/team" />
              <a class="knopf leise" href={`/admin/team/mitglied/neu?gruppe=${g.id}`}><Icon name="plus" />Mitglied</a>
              <DeleteButton action={`/admin/team/gruppen/${g.id}/loeschen`} csrf={csrf} confirm={`Bereich „${g.name}“ samt ${g.members.length} Mitglied(ern) löschen?`} small />
            </div>
          </header>
          {g.members.length ? (
            <div class="tabelle">
              {g.members.map(m => (
                <div class="tabelle-zeile">
                  <Head name={m.name} size={36} />
                  <div class="haupt">
                    <a href={`/admin/team/mitglied/${m.id}`}><strong>{m.name}</strong></a>
                    <small>{m.role}{m.since ? ` · seit ${m.since}` : ""}{m.info ? ` · ${m.info}` : ""}</small>
                  </div>
                  <div class="werkzeuge">
                    <MoveButtons table="team_members" id={m.id} csrf={csrf} back="/admin/team" />
                    <a class="mini-knopf" href={`/admin/team/mitglied/${m.id}`} title="Bearbeiten"><Icon name="pencil" /></a>
                    <DeleteButton action={`/admin/team/mitglied/${m.id}/loeschen`} csrf={csrf} confirm={`${m.name} aus dem Team entfernen?`} small />
                  </div>
                </div>
              ))}
            </div>
          ) : <p class="klein">Noch niemand in diesem Bereich. Bereiche ohne Mitglieder erscheinen nicht auf der Website.</p>}
        </Card>
      )) : <Empty title="Noch kein Team eingetragen" text="Lege unten den ersten Bereich an, z. B. „Administration“." />}

      <Card title="Neuer Bereich">
        <form method="post" action="/admin/team/gruppen" class="zeilen-formular">
          <Csrf token={csrf} />
          <input type="color" name="color" value="#f0a830" aria-label="Farbe" />
          <input name="name" required maxlength={60} placeholder="z. B. Moderation" aria-label="Name" />
          <button class="knopf" type="submit"><Icon name="plus" />Anlegen</button>
        </form>
      </Card>
    </>
  );
});

teamRoutes.post("/gruppen", async c => {
  const data = readGroup(await formBody(c));
  if (data.name) {
    createGroup(data);
    audit(actor(c), "team.bereich.angelegt", data.name);
    flash(c, `Bereich „${data.name}“ angelegt.`);
  }
  return c.redirect("/admin/team");
});

teamRoutes.post("/gruppen/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  const data = readGroup(await formBody(c));
  if (getGroup(id) && data.name) {
    updateGroup(id, data);
    audit(actor(c), "team.bereich.geaendert", data.name);
    flash(c, "Bereich gespeichert.");
  }
  return c.redirect("/admin/team");
});

teamRoutes.post("/gruppen/:id{[0-9]+}/loeschen", c => {
  const g = getGroup(Number(c.req.param("id")));
  if (g) {
    deleteGroup(g.id);
    audit(actor(c), "team.bereich.geloescht", g.name);
    flash(c, `Bereich „${g.name}“ gelöscht.`);
  }
  return c.redirect("/admin/team");
});

// --- Mitglieder --------------------------------------------------------------------------------------------

const MemberEditor = (p: { c: Ctx; id?: number; state: MemberInput; error?: string }) => {
  const groups = listGroups();
  return (
    <>
      <PageHead title={p.id ? p.state.name : "Neues Teammitglied"} back={{ href: "/admin/team", label: "Team" }} />
      {p.error ? <div class="meldung fehler">{p.error}</div> : null}
      <form method="post" action={p.id ? `/admin/team/mitglied/${p.id}` : "/admin/team/mitglied"} class="bearbeiten schmal-formular">
        <Csrf token={csrfToken(p.c)} />
        <Card>
          <div class="mitglied-kopf">
            <Head name={p.state.name || "Steve"} size={64} />
            <p class="klein">Der Kopf wird automatisch über den Minecraft-Namen geladen.</p>
          </div>
          <div class="formular-raster">
            <Field label="Minecraft-Name" hint="Genau wie im Spiel. Bedrock-Spieler mit Punkt davor (.Name).">
              <input name="name" value={p.state.name} required maxlength={17} pattern="\.?[A-Za-z0-9_]{1,16}" />
            </Field>
            <Field label="Bereich">
              <select name="group_id" required>
                {groups.map(g => <option value={String(g.id)} selected={p.state.group_id === g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Rolle" hint="z. B. Admin, Moderatorin, Head-Builder">
              <input name="role" value={p.state.role} maxlength={40} />
            </Field>
            <Field label="Im Team seit" hint="z. B. 2025 oder März 2026">
              <input name="since" value={p.state.since} maxlength={30} />
            </Field>
            <Field label="Kurzinfo" full>
              <textarea name="info" rows={3} maxlength={240}>{p.state.info}</textarea>
            </Field>
          </div>
        </Card>
        <div class="speicherleiste">
          <button class="knopf" type="submit"><Icon name="check" />Speichern</button>
        </div>
      </form>
    </>
  );
};

const readMember = (body: Body): { state: MemberInput; error?: string } => {
  const state: MemberInput = {
    group_id: Number(str(body, "group_id", 12)),
    name: str(body, "name", 17),
    role: str(body, "role", 40),
    since: str(body, "since", 30),
    info: text(body, "info", 240).replace(/\s+/g, " ").trim()
  };
  if (!getGroup(state.group_id)) return { state, error: "Bitte wähle einen Bereich." };
  if (!HEAD_NAME.test(state.name)) return { state, error: "Der Minecraft-Name darf nur Buchstaben, Zahlen und Unterstriche enthalten (max. 16 Zeichen)." };
  return { state };
};

teamRoutes.get("/mitglied/neu", c => {
  const groups = listGroups();
  if (!groups.length) {
    flash(c, "Lege zuerst einen Bereich an.", "fehler");
    return c.redirect("/admin/team");
  }
  const wanted = Number(c.req.query("gruppe") ?? "");
  const group = groups.find(g => g.id === wanted) ?? groups[0];
  return view(c, "Neues Teammitglied", "team", <MemberEditor c={c} state={{ group_id: group?.id ?? 0, name: "", role: "", since: String(new Date().getFullYear()), info: "" }} />);
});

teamRoutes.post("/mitglied", async c => {
  const { state, error } = readMember(await formBody(c));
  if (error) return view(c, "Neues Teammitglied", "team", <MemberEditor c={c} state={state} error={error} />, 422);
  createMember(state);
  audit(actor(c), "team.mitglied.angelegt", state.name);
  flash(c, `${state.name} wurde zum Team hinzugefügt.`);
  return c.redirect("/admin/team");
});

teamRoutes.get("/mitglied/:id{[0-9]+}", c => {
  const m = getMember(Number(c.req.param("id")));
  if (!m) return c.redirect("/admin/team");
  return view(c, m.name, "team", <MemberEditor c={c} id={m.id} state={m} />);
});

teamRoutes.post("/mitglied/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  if (!getMember(id)) return c.redirect("/admin/team");
  const { state, error } = readMember(await formBody(c));
  if (error) return view(c, state.name || "Teammitglied", "team", <MemberEditor c={c} id={id} state={state} error={error} />, 422);
  updateMember(id, state);
  audit(actor(c), "team.mitglied.geaendert", state.name);
  flash(c, "Teammitglied gespeichert.");
  return c.redirect("/admin/team");
});

teamRoutes.post("/mitglied/:id{[0-9]+}/loeschen", c => {
  const m = getMember(Number(c.req.param("id")));
  if (m) {
    deleteMember(m.id);
    audit(actor(c), "team.mitglied.entfernt", m.name);
    flash(c, `${m.name} wurde aus dem Team entfernt.`);
  }
  return c.redirect("/admin/team");
});
