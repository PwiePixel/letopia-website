/** Admin-Panel: Bestätigungen, Kopieren, Markdown-Editor mit Live-Vorschau, Pixel-Icon-Vorschau, Uploads. */
import { slugify } from "../../shared/catalog";
import { spriteSvg } from "../../shared/sprites";

const $ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => el.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => [...el.querySelectorAll<T>(sel)];

const csrf = $<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";

// --- Allgemeines --------------------------------------------------------------------------------------------

$$<HTMLFormElement>("form[data-confirm]").forEach(form =>
  form.addEventListener("submit", e => {
    if (!confirm(form.dataset.confirm ?? "Wirklich?")) e.preventDefault();
  })
);

$$<HTMLSelectElement>("select[data-auto]").forEach(select => select.addEventListener("change", () => select.form?.submit()));

document.addEventListener("click", async e => {
  const btn = (e.target as Element).closest?.<HTMLElement>("[data-copy]");
  if (!btn) return;
  const value = btn.dataset.copy ?? "";
  try {
    await navigator.clipboard.writeText(value);
    const old = btn.textContent;
    btn.textContent = "Kopiert";
    setTimeout(() => (btn.textContent = old), 1500);
  } catch {
    prompt("Zum Kopieren markieren:", value);
  }
});

const note = $(".meldung.ok");
if (note) setTimeout(() => note.classList.add("weg"), 3500);

$$<HTMLImageElement>("img[data-fallback]").forEach(img => {
  const swap = () => {
    if (img.dataset.fallback && !img.src.endsWith(img.dataset.fallback)) img.src = img.dataset.fallback;
  };
  if (img.complete && img.naturalWidth === 0) swap();
  else img.addEventListener("error", swap, { once: true });
});

const menuButton = $("[data-menue]");
menuButton?.addEventListener("click", () => {
  const open = document.body.classList.toggle("menue-offen");
  menuButton.setAttribute("aria-expanded", String(open));
});

// --- Adresse (Slug) automatisch aus dem Titel ------------------------------------------------------------

const slugSource = $<HTMLInputElement>("[data-slug-source]");
const slugTarget = $<HTMLInputElement>('[data-slug-target="auto"]');
if (slugSource && slugTarget) {
  let touched = slugTarget.value !== "" && slugTarget.value !== slugify(slugSource.value);
  slugTarget.addEventListener("input", () => (touched = slugTarget.value !== ""));
  slugSource.addEventListener("input", () => {
    if (!touched) slugTarget.value = slugify(slugSource.value);
  });
}

// --- Warnung bei ungespeicherten Änderungen ------------------------------------------------------------

$$<HTMLFormElement>("form[data-unsaved]").forEach(form => {
  let dirty = false;
  const hint = $("[data-unsaved-hint]", form);
  const mark = () => {
    dirty = true;
    if (hint) hint.hidden = false;
  };
  form.addEventListener("input", mark);
  form.addEventListener("change", mark);
  form.addEventListener("submit", () => (dirty = false));
  addEventListener("beforeunload", e => {
    if (!dirty) return;
    e.preventDefault();
  });
});

// --- Markdown-Editor ----------------------------------------------------------------------------------------

const wrapSelection = (area: HTMLTextAreaElement, before: string, after = before, placeholder = "Text") => {
  const { selectionStart: s, selectionEnd: e, value } = area;
  const selected = value.slice(s, e) || placeholder;
  area.setRangeText(before + selected + after, s, e, "end");
  area.setSelectionRange(s + before.length, s + before.length + selected.length);
};

const linePrefix = (area: HTMLTextAreaElement, prefix: string | ((i: number) => string)) => {
  const { selectionStart: s, selectionEnd: e, value } = area;
  const start = value.lastIndexOf("\n", s - 1) + 1;
  const end = value.indexOf("\n", e) === -1 ? value.length : value.indexOf("\n", e);
  const block = value.slice(start, end).split("\n").map((l, i) => (typeof prefix === "function" ? prefix(i) : prefix) + l).join("\n");
  area.setRangeText(block, start, end, "end");
};

const insertBlock = (area: HTMLTextAreaElement, block: string) => {
  const { selectionStart: s, value } = area;
  const before = value.slice(0, s);
  const pad = before.length && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  area.setRangeText(`${pad}${block}\n`, s, area.selectionEnd, "end");
};

interface MediaEntry {
  url: string;
  name: string;
}

const imageDialog = async (area: HTMLTextAreaElement) => {
  const dialog = document.createElement("dialog");
  dialog.className = "medien-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="dialog-kopf"><h2>Bild einfügen</h2><button class="mini-knopf" value="x" aria-label="Schließen">✕</button></form>
    <div class="dialog-upload"><label class="knopf leise">Neues Bild hochladen<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden></label><span class="klein"></span></div>
    <div class="dialog-raster"><p class="klein">Lade Bilder …</p></div>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  const grid = $(".dialog-raster", dialog);
  const status = $(".dialog-upload .klein", dialog);

  const insert = (m: MediaEntry) => {
    const alt = m.name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]]/g, "");
    insertBlock(area, `![${alt}](${m.url})`);
    area.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.close();
  };

  const render = (list: MediaEntry[]) => {
    if (!grid) return;
    grid.innerHTML = list.length ? "" : `<p class="klein">Noch keine Bilder hochgeladen.</p>`;
    for (const m of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dialog-bild";
      const img = document.createElement("img");
      img.src = m.url;
      img.alt = "";
      img.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = m.name;
      btn.append(img, label);
      btn.addEventListener("click", () => insert(m));
      grid.append(btn);
    }
  };

  const load = async () => {
    try {
      const res = await fetch("/admin/api/medien", { headers: { Accept: "application/json" } });
      render((await res.json()) as MediaEntry[]);
    } catch {
      if (grid) grid.innerHTML = `<p class="klein">Bilder konnten nicht geladen werden.</p>`;
    }
  };

  $<HTMLInputElement>("input[type=file]", dialog)?.addEventListener("change", async e => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (status) status.textContent = "Wird hochgeladen …";
    const data = new FormData();
    data.append("dateien", file);
    try {
      const res = await fetch("/admin/medien", { method: "POST", body: data, headers: { Accept: "application/json", "X-CSRF-Token": csrf } });
      const out = (await res.json()) as { ok: boolean; dateien: MediaEntry[]; fehler: string[] };
      if (out.ok && out.dateien[0]) insert(out.dateien[0]);
      else if (status) status.textContent = out.fehler.join(", ") || "Upload fehlgeschlagen.";
    } catch {
      if (status) status.textContent = "Upload fehlgeschlagen.";
    }
  });

  dialog.showModal();
  await load();
};

const COMMANDS: Record<string, (area: HTMLTextAreaElement) => void | Promise<void>> = {
  h2: a => linePrefix(a, "## "),
  h3: a => linePrefix(a, "### "),
  bold: a => wrapSelection(a, "**"),
  italic: a => wrapSelection(a, "*"),
  mark: a => wrapSelection(a, "=="),
  code: a => wrapSelection(a, "`", "`", "/befehl"),
  link: a => {
    const url = prompt("Link-Adresse (https://… oder /wiki/artikel):", "https://");
    if (url) wrapSelection(a, "[", `](${url})`, "Linktext");
  },
  wiki: a => {
    const slug = prompt("Adresse des Wiki-Artikels (z. B. grundstuecke):");
    if (slug) wrapSelection(a, `[[${slugify(slug)}|`, "]]", "Linktext");
  },
  ul: a => linePrefix(a, "- "),
  ol: a => linePrefix(a, i => `${i + 1}. `),
  table: a => insertBlock(a, "| Spalte 1 | Spalte 2 |\n| --- | --- |\n| Inhalt | Inhalt |"),
  tipp: a => insertBlock(a, "> [!TIPP]\n> Text"),
  info: a => insertBlock(a, "> [!INFO]\n> Text"),
  achtung: a => insertBlock(a, "> [!ACHTUNG]\n> Text"),
  image: a => imageDialog(a)
};

$$("[data-editor]").forEach(editor => {
  const area = $<HTMLTextAreaElement>("textarea[data-markdown]", editor);
  const preview = $("[data-preview]", editor);
  const surface = $(".editor-flaeche", editor);
  if (!area || !preview || !surface) return;

  let timer: number | undefined;
  let lastSent = "";
  const refresh = async () => {
    if (surface.dataset.mode === "edit" || area.value === lastSent) return;
    lastSent = area.value;
    try {
      const res = await fetch("/admin/api/vorschau", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ markdown: area.value })
      });
      const data = (await res.json()) as { html?: string };
      preview.innerHTML = data.html ?? "";
    } catch {
      preview.innerHTML = `<p class="klein">Vorschau nicht verfügbar.</p>`;
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(refresh, 350);
  };

  area.addEventListener("input", schedule);
  $$<HTMLButtonElement>("[data-cmd]", editor).forEach(btn =>
    btn.addEventListener("click", async () => {
      area.focus();
      await COMMANDS[btn.dataset.cmd ?? ""]?.(area);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    })
  );
  $$<HTMLButtonElement>("[data-view]", editor).forEach(btn =>
    btn.addEventListener("click", () => {
      surface.dataset.mode = btn.dataset.view ?? "split";
      $$("[data-view]", editor).forEach(b => b.classList.toggle("an", b === btn));
      lastSent = "";
      void refresh();
    })
  );

  area.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      area.form?.requestSubmit();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrapSelection(area, "**");
      schedule();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrapSelection(area, "*");
      schedule();
    }
  });

  void refresh();
});

// --- Pixel-Icon-Vorschau ---------------------------------------------------------------------------------------

$$("[data-sprite-picker]").forEach(picker => {
  const select = $<HTMLSelectElement>("[data-sprite-select]", picker);
  const color = $<HTMLInputElement>("[data-sprite-color]", picker);
  const out = $("[data-sprite-preview]", picker);
  if (!select || !color || !out) return;
  const draw = () => (out.innerHTML = spriteSvg(select.value, color.value));
  select.addEventListener("change", draw);
  color.addEventListener("input", draw);
  draw();
});

// --- Rezept-Editor: Werkbank-Vorschau --------------------------------------------------------------------------

const recipeForm = $<HTMLFormElement>("[data-recipe-editor]");
if (recipeForm) {
  interface Part {
    id: number;
    name: string;
    sprite: string;
    color: string;
  }
  let data: { ingredients: Part[]; items: Part[] } = { ingredients: [], items: [] };
  try {
    data = JSON.parse($("[data-recipe-data]", recipeForm)?.textContent ?? "{}") as typeof data;
  } catch {
    // ohne Daten keine Vorschau
  }
  const byId = new Map(data.ingredients.map(i => [i.id, i]));
  const items = new Map(data.items.map(i => [i.id, i]));
  const grid = $("[data-grid-preview]", recipeForm);
  const result = $("[data-result-preview]", recipeForm);
  const slots = $$<HTMLSelectElement>("select[data-slot]", recipeForm);
  const resultSelect = $<HTMLSelectElement>("select[data-result]", recipeForm);
  const amount = $<HTMLInputElement>('input[name="amount"]', recipeForm);

  const draw = () => {
    if (grid) {
      grid.innerHTML = slots
        .map(s => {
          const part = byId.get(Number(s.value));
          return `<span class="vorschau-slot"${part ? ` title="${part.name.replace(/"/g, "&quot;")}"` : ""}>${part ? spriteSvg(part.sprite, part.color) : ""}</span>`;
        })
        .join("");
    }
    if (result) {
      const item = items.get(Number(resultSelect?.value));
      const n = Number(amount?.value ?? 1);
      result.innerHTML = item ? `${spriteSvg(item.sprite, item.color)}${n > 1 ? `<b>${n}</b>` : ""}` : "";
    }
  };
  recipeForm.addEventListener("change", draw);
  recipeForm.addEventListener("input", draw);
  draw();
}

// --- Upload per Drag & Drop --------------------------------------------------------------------------------------

$$<HTMLFormElement>("form[data-upload]").forEach(form => {
  const zone = $(".upload-feld", form);
  const input = $<HTMLInputElement>('input[type="file"]', form);
  const label = $(".upload-feld span", form);
  if (!zone || !input || !label) return;
  const show = () => {
    const names = [...(input.files ?? [])].map(f => f.name);
    label.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = names.length ? `${names.length} Datei(en) ausgewählt` : "Dateien auswählen";
    label.append(b, document.createTextNode(names.length ? `: ${names.join(", ")}` : " oder hierher ziehen"));
  };
  input.addEventListener("change", show);
  ["dragenter", "dragover"].forEach(type =>
    zone.addEventListener(type, e => {
      e.preventDefault();
      zone.classList.add("ziehen");
    })
  );
  ["dragleave", "drop"].forEach(type => zone.addEventListener(type, () => zone.classList.remove("ziehen")));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    const dropped = (e as DragEvent).dataTransfer?.files;
    if (dropped?.length) {
      input.files = dropped;
      show();
    }
  });
});
