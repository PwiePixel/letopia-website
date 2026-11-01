import { Hono } from "hono";
import type { AppEnv } from "../../http.js";
import { audit } from "../../repo/audit.js";
import { getSettings, saveSettings } from "../../repo/settings.js";
import { createVoteSite, deleteVoteSite, getVoteSite, listVoteSites, updateVoteSite } from "../../repo/votes.js";
import { Card, Csrf, DeleteButton, Empty, Field, Icon, MoveButtons, PageHead } from "../../views/admin/ui.js";
import { actor, csrfToken, flash } from "./auth.js";
import { bool, formBody, lines, safeLink, str, text, type Body } from "./form.js";
import { view } from "./render.js";

export const voteRoutes = new Hono<AppEnv>();

const readSite = (body: Body) => ({
  name: str(body, "name", 60),
  url: safeLink(str(body, "url", 300)),
  reward: str(body, "reward", 120),
  active: bool(body, "active")
});

voteRoutes.get("/", c => {
  const csrf = csrfToken(c);
  const sites = listVoteSites();
  const texts = getSettings("votes");
  return view(
    c,
    "Voten",
    "voten",
    <>
      <PageHead title="Voten" sub="Vote-Seiten und Belohnungen auf der Vote-Seite.">
        <a class="knopf leise" href="/voten" target="_blank" rel="noopener"><Icon name="external" />Vote-Seite ansehen</a>
      </PageHead>

      <Card title="Vote-Seiten">
        {sites.length ? (
          <div class="tabelle">
            {sites.map(s => (
              <div class="tabelle-zeile mit-formular">
                <form method="post" action={`/admin/voten/${s.id}`} class="vote-formular">
                  <Csrf token={csrf} />
                  <input name="name" value={s.name} required maxlength={60} aria-label="Name" placeholder="Name" />
                  <input name="url" value={s.url} maxlength={300} aria-label="Link" placeholder="https://…" />
                  <input name="reward" value={s.reward} maxlength={120} aria-label="Belohnung" placeholder="Belohnung" />
                  <label class="haken klein-haken"><input type="checkbox" name="active" checked={Boolean(s.active)} /> aktiv</label>
                  <button class="mini-knopf" type="submit" title="Speichern"><Icon name="check" /></button>
                </form>
                <div class="werkzeuge">
                  <MoveButtons table="vote_sites" id={s.id} csrf={csrf} back="/admin/voten" />
                  <DeleteButton action={`/admin/voten/${s.id}/loeschen`} csrf={csrf} confirm={`Vote-Seite „${s.name}“ löschen?`} small />
                </div>
              </div>
            ))}
          </div>
        ) : <Empty title="Noch keine Vote-Seiten" />}
        <h3 class="unterueberschrift">Neue Vote-Seite</h3>
        <form method="post" action="/admin/voten" class="vote-formular">
          <Csrf token={csrf} />
          <input name="name" required maxlength={60} placeholder="z. B. minecraft-server.eu" aria-label="Name" />
          <input name="url" maxlength={300} placeholder="https://… (Vote-Link)" aria-label="Link" />
          <input name="reward" maxlength={120} placeholder="z. B. 500 Coins + 1 Vote-Kiste" aria-label="Belohnung" />
          <label class="haken klein-haken"><input type="checkbox" name="active" checked /> aktiv</label>
          <button class="knopf" type="submit"><Icon name="plus" />Hinzufügen</button>
        </form>
      </Card>

      <Card title="Belohnungen & Texte">
        <form method="post" action="/admin/voten/texte" class="formular">
          <Csrf token={csrf} />
          <Field label="Vote-Serien" hint="Eine Zeile pro Belohnung im Format „Bedingung | Belohnung“.">
            <textarea name="streaks" rows={4}>{texts.streaks.join("\n")}</textarea>
          </Field>
          <Field label="Monatsbester" hint="Markdown erlaubt, z. B. **fett** oder `/befehl`. Leer lassen, um den Kasten auszublenden.">
            <textarea name="monthly" rows={3}>{texts.monthly}</textarea>
          </Field>
          <div><button class="knopf" type="submit"><Icon name="check" />Speichern</button></div>
        </form>
      </Card>
    </>
  );
});

voteRoutes.post("/", async c => {
  const data = readSite(await formBody(c));
  if (data.name) {
    createVoteSite(data);
    audit(actor(c), "voten.seite.angelegt", data.name);
    flash(c, `Vote-Seite „${data.name}“ hinzugefügt.`);
  }
  return c.redirect("/admin/voten");
});

voteRoutes.post("/texte", async c => {
  const body = await formBody(c);
  saveSettings("votes", { streaks: lines(body, "streaks", 12, 160), monthly: text(body, "monthly", 1000).trim() });
  audit(actor(c), "voten.texte.geaendert");
  flash(c, "Texte gespeichert.");
  return c.redirect("/admin/voten");
});

voteRoutes.post("/:id{[0-9]+}", async c => {
  const id = Number(c.req.param("id"));
  const data = readSite(await formBody(c));
  if (getVoteSite(id) && data.name) {
    updateVoteSite(id, data);
    audit(actor(c), "voten.seite.geaendert", data.name);
    flash(c, "Vote-Seite gespeichert.");
  }
  return c.redirect("/admin/voten");
});

voteRoutes.post("/:id{[0-9]+}/loeschen", c => {
  const site = getVoteSite(Number(c.req.param("id")));
  if (site) {
    deleteVoteSite(site.id);
    audit(actor(c), "voten.seite.geloescht", site.name);
    flash(c, `Vote-Seite „${site.name}“ gelöscht.`);
  }
  return c.redirect("/admin/voten");
});
