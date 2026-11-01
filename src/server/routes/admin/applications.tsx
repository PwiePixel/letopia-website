import { Hono } from "hono";
import { APPLICATION_STATUS, APPLICATION_TYPES, isApplicationStatus } from "../../../shared/catalog.js";
import { toInt, type AppEnv } from "../../http.js";
import {
  castVote,
  countApplications,
  countByStatus,
  deleteApplication,
  getApplication,
  listApplications,
  listVotes,
  removeVote,
  setNote,
  setStatus
} from "../../repo/applications.js";
import { audit } from "../../repo/audit.js";
import { headName, type User } from "../../repo/users.js";
import { ago, dateTime } from "../../views/format.js";
import { Badge, Card, Csrf, Empty, Head, Icon, PageHead, Pager } from "../../views/admin/ui.js";
import { actor, csrfToken, flash, requireArea } from "./auth.js";
import { formBody, str, text } from "./form.js";
import { view } from "./render.js";

export const applicationRoutes = new Hono<AppEnv>();

applicationRoutes.use("*", requireArea("applications"));

const PER_PAGE = 50;
const typeLabel = (t: string) => APPLICATION_TYPES[t as keyof typeof APPLICATION_TYPES] ?? t;
const statusOf = (s: string) => APPLICATION_STATUS[s as keyof typeof APPLICATION_STATUS] ?? APPLICATION_STATUS.neu;

const readFilter = (q: (key: string) => string | undefined) => {
  const status = q("status") ?? "";
  const type = q("typ") ?? "";
  return {
    status: isApplicationStatus(status) ? status : "",
    type: type === "team" || type === "creator" ? type : "",
    q: (q("q") ?? "").trim().slice(0, 60)
  };
};

const link = (f: { status: string; type: string; q: string }, change: Record<string, string | number> = {}) => {
  const params = new URLSearchParams();
  const merged: Record<string, string | number> = { status: f.status, typ: f.type, q: f.q, ...change };
  for (const [k, v] of Object.entries(merged)) {
    if (v === "" || (k === "seite" && Number(v) <= 1)) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return `/admin/bewerbungen${qs ? `?${qs}` : ""}`;
};

applicationRoutes.get("/", c => {
  const f = readFilter(k => c.req.query(k));
  const page = Math.max(1, toInt(c.req.query("seite"), 1));
  const total = countApplications({ status: f.status, type: f.type, q: f.q });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const list = listApplications({ status: f.status, type: f.type, q: f.q, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const counts = countByStatus();
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const exportQuery = new URLSearchParams({ ...(f.status ? { status: f.status } : {}), ...(f.type ? { typ: f.type } : {}), ...(f.q ? { q: f.q } : {}) }).toString();

  return view(
    c,
    "Bewerbungen",
    "bewerbungen",
    <>
      <PageHead title="Bewerbungen" sub={<>{all} insgesamt{counts.neu ? <> · <b class="blau-text">{counts.neu} neu</b></> : null}</>}>
        <form class="suche" method="get" action="/admin/bewerbungen">
          {f.status ? <input type="hidden" name="status" value={f.status} /> : null}
          <select name="typ" data-auto aria-label="Art">
            <option value="">Alle Arten</option>
            {Object.entries(APPLICATION_TYPES).map(([k, v]) => <option value={k} selected={f.type === k}>{v}</option>)}
          </select>
          <input type="search" name="q" value={f.q} placeholder="Name, Discord, Position" aria-label="Suchen" />
          <button class="knopf" type="submit"><Icon name="search" />Suchen</button>
        </form>
      </PageHead>

      <nav class="reiter">
        <a href={link({ ...f, status: "" })} class={f.status === "" ? "aktiv" : undefined}>Alle <span>{all}</span></a>
        {Object.entries(APPLICATION_STATUS).map(([key, s]) => (
          <a href={link({ ...f, status: key })} class={f.status === key ? "aktiv" : undefined}><i class={`punkt ${s.color}`}></i>{s.label} <span>{counts[key] ?? 0}</span></a>
        ))}
        <a class="reiter-rechts" href={`/admin/bewerbungen/export.csv${exportQuery ? `?${exportQuery}` : ""}`}><Icon name="download" />CSV-Export</a>
      </nav>

      {list.length ? (
        <div class="liste">
          {list.map(a => {
            const st = statusOf(a.status);
            return (
              <a class={`zeile bewerbung${a.status === "neu" ? " ungelesen" : ""}`} href={`/admin/bewerbungen/${a.id}`}>
                <Head name={a.player_name} />
                <span class="wer"><strong>{a.player_name}</strong><small>{a.discord}</small></span>
                <span class={`typ ${a.type}`}>{typeLabel(a.type)}</span>
                <span class="kurz">{a.summary}</span>
                <span class="stimmen" title="Team-Abstimmung">
                  {a.votes_yes || a.votes_no ? <><b class="gruen-text">+{a.votes_yes}</b> <b class="rot-text">−{a.votes_no}</b></> : <span class="dunkel">–</span>}
                </span>
                <span class="wann" title={dateTime(a.created_at)}>{ago(a.created_at)}</span>
                <Badge color={st.color}>{st.label}</Badge>
              </a>
            );
          })}
        </div>
      ) : (
        <Card class="leer">
          <h2>{all ? "Nichts gefunden" : "Noch keine Bewerbungen"}</h2>
          <p>{all ? "Für diese Filter gibt es keine Bewerbungen." : "Sobald jemand das Formular auf der Website abschickt, taucht die Bewerbung hier auf."}</p>
        </Card>
      )}
      <Pager page={page} pages={pages} href={p => link(f, { seite: p })} />
    </>
  );
});

const csvCell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, "\"\"")}"`;
};

applicationRoutes.get("/export.csv", c => {
  const f = readFilter(k => c.req.query(k));
  const list = listApplications({ status: f.status, type: f.type, q: f.q, limit: 100_000 });
  const rows = [["ID", "Art", "Minecraft-Name", "Discord", "Position/Plattform", "Status", "Eingegangen", "Dafür", "Dagegen", "Antworten", "Notiz"]];
  for (const entry of list) {
    const full = getApplication(entry.id);
    rows.push([
      String(entry.id),
      typeLabel(entry.type),
      entry.player_name,
      entry.discord,
      entry.summary,
      statusOf(entry.status).label,
      dateTime(entry.created_at),
      String(entry.votes_yes),
      String(entry.votes_no),
      (full?.answers ?? []).map(a => `${a.label}: ${a.value}`).join("\n"),
      full?.note ?? ""
    ]);
  }
  audit(actor(c), "bewerbungen.export", "", `${list.length} Bewerbungen`);
  const csv = "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="bewerbungen-${date}.csv"`
  });
});

applicationRoutes.get("/:id{[0-9]+}", c => {
  const id = Number(c.req.param("id"));
  const app = getApplication(id);
  if (!app) {
    flash(c, "Diese Bewerbung gibt es nicht mehr.", "fehler");
    return c.redirect("/admin/bewerbungen");
  }
  const user = c.get("user") as User;
  const csrf = csrfToken(c);
  const st = statusOf(app.status);
  const short = app.answers.filter(a => !a.long);
  const long = app.answers.filter(a => a.long);
  const votes = listVotes(id);
  const mine = votes.find(v => v.user_id === user.id);
  const yes = votes.filter(v => v.vote === 1).length;
  const no = votes.filter(v => v.vote === -1).length;
  const abstain = votes.filter(v => v.vote === 0).length;

  return view(
    c,
    app.player_name,
    "bewerbungen",
    <>
      <a class="zurueck" href="/admin/bewerbungen">← Alle Bewerbungen</a>
      <div class="detail">
        <section class="karte">
          <header class="person">
            <Head name={app.player_name} size={64} />
            <div>
              <h1>{app.player_name}</h1>
              <p>{typeLabel(app.type)}-Bewerbung{app.summary ? ` · ${app.summary}` : ""} · eingegangen am {dateTime(app.created_at)} Uhr</p>
            </div>
            <Badge color={st.color}>{st.label}</Badge>
          </header>

          <dl class="felder">
            {short.map(a => (
              <div>
                <dt>{a.label}</dt>
                <dd>
                  {a.field === "kanal" && /^https?:\/\//i.test(a.value) ? <a href={a.value} target="_blank" rel="noopener noreferrer">{a.value}</a> : a.value}
                  {a.field === "discord" ? <button class="mini" type="button" data-copy={a.value}>kopieren</button> : null}
                </dd>
              </div>
            ))}
          </dl>

          {long.map(a => (
            <div class="lang">
              <h2>{a.label}</h2>
              <p>{a.value}</p>
            </div>
          ))}
        </section>

        <aside class="seite">
          <Card title="Status">
            <form method="post" action={`/admin/bewerbungen/${id}/status`} class="status-wahl">
              <Csrf token={csrf} />
              {Object.entries(APPLICATION_STATUS).map(([key, s]) => (
                <button type="submit" name="status" value={key} class={`wahl ${s.color}${app.status === key ? " aktiv" : ""}`} disabled={app.status === key}>{s.label}</button>
              ))}
            </form>
            {app.handled_by ? <p class="klein">Zuletzt bearbeitet von <b>{app.handled_by}</b>, {ago(app.updated_at)}</p> : null}
          </Card>

          <Card title="Team-Abstimmung">
            <div class="abstimmung-stand">
              <span class="gruen-text"><Icon name="thumb-up" />{yes}</span>
              <span class="dunkel"><Icon name="minus" />{abstain}</span>
              <span class="rot-text"><Icon name="thumb-down" />{no}</span>
            </div>
            <form method="post" action={`/admin/bewerbungen/${id}/stimme`} class="formular">
              <Csrf token={csrf} />
              <input name="kommentar" maxlength={300} placeholder="Kurze Begründung (optional)" value={mine?.comment ?? ""} />
              <div class="stimm-knoepfe">
                <button class={`wahl gruen${mine?.vote === 1 ? " aktiv" : ""}`} name="stimme" value="1" type="submit"><Icon name="thumb-up" />Dafür</button>
                <button class={`wahl${mine?.vote === 0 ? " aktiv" : ""}`} name="stimme" value="0" type="submit">Enthaltung</button>
                <button class={`wahl rot${mine?.vote === -1 ? " aktiv" : ""}`} name="stimme" value="-1" type="submit"><Icon name="thumb-down" />Dagegen</button>
              </div>
            </form>
            {votes.length ? (
              <ul class="stimmen-liste">
                {votes.map(v => (
                  <li>
                    <Head name={headName(v)} size={24} />
                    <span><b>{v.username}</b> {v.vote === 1 ? "ist dafür" : v.vote === -1 ? "ist dagegen" : "enthält sich"}{v.comment ? <em>„{v.comment}“</em> : null}</span>
                  </li>
                ))}
              </ul>
            ) : <p class="klein">Noch keine Stimmen.</p>}
            {mine ? (
              <form method="post" action={`/admin/bewerbungen/${id}/stimme/zurueckziehen`}>
                <Csrf token={csrf} />
                <button class="link-knopf" type="submit">Meine Stimme zurückziehen</button>
              </form>
            ) : null}
          </Card>

          <Card title="Interne Notiz">
            <form method="post" action={`/admin/bewerbungen/${id}/notiz`} class="formular">
              <Csrf token={csrf} />
              <textarea name="notiz" rows={6} maxlength={4000} placeholder="Nur für das Team sichtbar">{app.note}</textarea>
              <button class="knopf" type="submit">Notiz speichern</button>
            </form>
          </Card>

          <Card title="Löschen" class="gefahr">
            <p class="klein">Die Bewerbung wird endgültig entfernt. Das lässt sich nicht rückgängig machen.</p>
            <form method="post" action={`/admin/bewerbungen/${id}/loeschen`} data-confirm={`Bewerbung von ${app.player_name} wirklich endgültig löschen?`}>
              <Csrf token={csrf} />
              <button class="knopf rot breit" type="submit"><Icon name="trash" />Endgültig löschen</button>
            </form>
          </Card>
        </aside>
      </div>
    </>
  );
});

applicationRoutes.post("/:id{[0-9]+}/status", async c => {
  const id = Number(c.req.param("id"));
  const body = await formBody(c);
  const status = str(body, "status", 20);
  const app = getApplication(id);
  if (app && isApplicationStatus(status)) {
    const user = c.get("user") as User;
    setStatus(id, status, user.username);
    audit(actor(c), "bewerbung.status", `#${id} ${app.player_name}`, APPLICATION_STATUS[status].label);
    flash(c, `Status geändert: ${APPLICATION_STATUS[status].label}`);
  }
  return c.redirect(`/admin/bewerbungen/${id}`);
});

applicationRoutes.post("/:id{[0-9]+}/notiz", async c => {
  const id = Number(c.req.param("id"));
  const body = await formBody(c);
  const app = getApplication(id);
  if (app) {
    const user = c.get("user") as User;
    setNote(id, text(body, "notiz", 4000).trim(), user.username);
    audit(actor(c), "bewerbung.notiz", `#${id} ${app.player_name}`);
    flash(c, "Notiz gespeichert.");
  }
  return c.redirect(`/admin/bewerbungen/${id}`);
});

applicationRoutes.post("/:id{[0-9]+}/stimme", async c => {
  const id = Number(c.req.param("id"));
  const body = await formBody(c);
  const vote = Number(str(body, "stimme", 3));
  const app = getApplication(id);
  if (app && (vote === 1 || vote === 0 || vote === -1)) {
    const user = c.get("user") as User;
    castVote(id, user.id, vote, str(body, "kommentar", 300));
    audit(actor(c), "bewerbung.stimme", `#${id} ${app.player_name}`, vote === 1 ? "dafür" : vote === -1 ? "dagegen" : "Enthaltung");
    flash(c, "Deine Stimme wurde gespeichert.");
  }
  return c.redirect(`/admin/bewerbungen/${id}`);
});

applicationRoutes.post("/:id{[0-9]+}/stimme/zurueckziehen", c => {
  const id = Number(c.req.param("id"));
  const user = c.get("user") as User;
  removeVote(id, user.id);
  flash(c, "Deine Stimme wurde zurückgezogen.");
  return c.redirect(`/admin/bewerbungen/${id}`);
});

applicationRoutes.post("/:id{[0-9]+}/loeschen", c => {
  const id = Number(c.req.param("id"));
  const app = getApplication(id);
  if (app) {
    deleteApplication(id);
    audit(actor(c), "bewerbung.geloescht", `#${id} ${app.player_name}`);
    flash(c, "Bewerbung gelöscht.");
  }
  return c.redirect("/admin/bewerbungen");
});
