import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { config } from "../../config.js";
import type { AppEnv } from "../../http.js";
import { detectImage } from "../../lib/images.js";
import { log } from "../../log.js";
import { audit } from "../../repo/audit.js";
import { addMedia, deleteMedia, getMedia, listMedia } from "../../repo/media.js";
import { dateTime, fileSize } from "../../views/format.js";
import { Card, Csrf, DeleteButton, Empty, Icon, PageHead } from "../../views/admin/ui.js";
import { actor, csrfToken, flash, requireArea } from "./auth.js";
import { files, formBody } from "./form.js";
import { view } from "./render.js";

export const mediaRoutes = new Hono<AppEnv>();

mediaRoutes.use("*", requireArea("content"));

const MAX_MB = Math.round(config.maxUploadBytes / 1024 / 1024);

mediaRoutes.get("/", c => {
  const csrf = csrfToken(c);
  const media = listMedia();
  return view(
    c,
    "Medien",
    "medien",
    <>
      <PageHead title="Medien" sub={`${media.length} Bilder · PNG, JPG, GIF oder WebP bis ${MAX_MB} MB`} />
      <Card title="Bilder hochladen">
        <form method="post" action="/admin/medien" enctype="multipart/form-data" class="upload-formular" data-upload>
          <Csrf token={csrf} />
          <label class="upload-feld">
            <Icon name="upload" />
            <span><b>Dateien auswählen</b> oder hierher ziehen</span>
            <input type="file" name="dateien" accept="image/png,image/jpeg,image/gif,image/webp" multiple required />
          </label>
          <button class="knopf" type="submit"><Icon name="upload" />Hochladen</button>
        </form>
      </Card>
      {media.length ? (
        <div class="medien-raster">
          {media.map(m => {
            const url = `/uploads/${m.filename}`;
            return (
              <figure class="medium">
                <a href={url} target="_blank" rel="noopener"><img src={url} alt={m.original_name} loading="lazy" /></a>
                <figcaption>
                  <strong title={m.original_name}>{m.original_name}</strong>
                  <small>{m.width && m.height ? `${m.width}×${m.height} · ` : ""}{fileSize(m.size)} · {dateTime(m.created_at)}{m.uploaded_by ? ` · ${m.uploaded_by}` : ""}</small>
                  <div class="werkzeuge">
                    <button class="mini" type="button" data-copy={url}>URL</button>
                    <button class="mini" type="button" data-copy={`![${m.original_name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]]/g, "")}](${url})`}>Markdown</button>
                    <DeleteButton action={`/admin/medien/${m.id}/loeschen`} csrf={csrf} confirm={`„${m.original_name}“ löschen? Seiten, die das Bild verwenden, zeigen es danach nicht mehr an.`} small />
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : <Empty title="Noch keine Bilder" text="Hochgeladene Bilder kannst du im Wiki und auf Seiten per Markdown einbinden." />}
    </>
  );
});

const cleanName = (name: string) => name.replace(/[\u0000-\u001f\u007f/\\<>:"|?*]/g, "").trim().slice(0, 120) || "bild";

mediaRoutes.post("/", async c => {
  const body = await formBody(c);
  const list = files(body, "dateien");
  const wantsJson = (c.req.header("accept") ?? "").includes("application/json");
  const saved: { url: string; name: string }[] = [];
  const errors: string[] = [];
  await mkdir(config.uploadDir, { recursive: true });

  for (const file of list.slice(0, 20)) {
    const name = cleanName(file.name);
    if (file.size > config.maxUploadBytes) {
      errors.push(`${name}: größer als ${MAX_MB} MB`);
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const info = detectImage(buf);
    if (!info) {
      errors.push(`${name}: kein unterstütztes Bildformat`);
      continue;
    }
    const month = new Date().toISOString().slice(0, 7).replace("-", "");
    const filename = `${month}-${randomBytes(6).toString("hex")}.${info.ext}`;
    try {
      await writeFile(path.join(config.uploadDir, filename), buf, { flag: "wx" });
      addMedia({ filename, original_name: name, mime: info.mime, size: buf.length, width: info.width, height: info.height, uploaded_by: actor(c).username });
      saved.push({ url: `/uploads/${filename}`, name });
    } catch (error) {
      log.error("Upload fehlgeschlagen", error);
      errors.push(`${name}: konnte nicht gespeichert werden`);
    }
  }

  if (saved.length) audit(actor(c), "medien.hochgeladen", saved.map(s => s.name).join(", "));
  if (wantsJson) return c.json({ ok: saved.length > 0, dateien: saved, fehler: errors }, saved.length ? 200 : 422);
  if (saved.length) flash(c, `${saved.length} Bild(er) hochgeladen.${errors.length ? ` Nicht übernommen: ${errors.join("; ")}` : ""}`, errors.length ? "fehler" : "ok");
  else flash(c, errors.length ? `Nicht hochgeladen: ${errors.join("; ")}` : "Bitte wähle mindestens ein Bild aus.", "fehler");
  return c.redirect("/admin/medien");
});

mediaRoutes.post("/:id{[0-9]+}/loeschen", async c => {
  const m = getMedia(Number(c.req.param("id")));
  if (m) {
    await rm(path.join(config.uploadDir, path.basename(m.filename)), { force: true });
    deleteMedia(m.id);
    audit(actor(c), "medien.geloescht", m.original_name);
    flash(c, `„${m.original_name}“ gelöscht.`);
  }
  return c.redirect("/admin/medien");
});
