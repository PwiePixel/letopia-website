/** Bewerbungsformulare: Prüfung im Browser, Zeichenzähler und Versand an /api/bewerbungen. */
import { $, $$, activateTab, calm } from "../core";
import "../scene";

const applyTabs = $(".apply-tabs");

const fromHash = () => {
  const key = location.hash.slice(1);
  if (applyTabs && (key === "team" || key === "creator")) activateTab(applyTabs, key);
};

applyTabs?.addEventListener("tabchange", e => history.replaceState(null, "", `#${(e as CustomEvent<string>).detail}`));
addEventListener("hashchange", fromHash);
fromHash();

$$<HTMLTextAreaElement>("textarea[maxlength]").forEach(area => {
  const counter = document.createElement("small");
  counter.className = "counter";
  area.after(counter);
  const update = () => {
    const min = Number(area.getAttribute("minlength") ?? 0);
    const len = area.value.length;
    counter.textContent = min && len < min ? `noch ${min - len} Zeichen` : `${len} / ${area.maxLength}`;
    counter.classList.toggle("low", Boolean(min && len < min));
  };
  area.addEventListener("input", update);
  update();
});

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const fieldError = (form: HTMLFormElement, name: string, text: string) => {
  const field = form.elements.namedItem(name);
  const el = field instanceof RadioNodeList ? field[0] : field;
  const wrap = el instanceof Element ? el.closest(".field") : null;
  if (!wrap) return;
  wrap.classList.add("invalid");
  let msg = $(".field-msg", wrap);
  if (!msg) {
    msg = document.createElement("small");
    msg.className = "field-msg";
    wrap.append(msg);
  }
  msg.textContent = text;
};

const clearErrors = (form: HTMLFormElement) => {
  $$(".field.invalid", form).forEach(f => f.classList.remove("invalid"));
  $$(".field-msg", form).forEach(m => m.remove());
  const msg = $(".form-msg", form);
  if (msg) msg.textContent = "";
};

const localCheck = (form: HTMLFormElement) => {
  let first: Field | null = null;
  $$<Field>("input, select, textarea", form).forEach(el => {
    if (el.name === "website" || el.checkValidity()) return;
    let text = el.validationMessage;
    const v = el.validity;
    if (v.valueMissing) text = el instanceof HTMLInputElement && el.type === "checkbox" ? "Bitte bestätige das." : "Bitte ausfüllen.";
    else if (v.tooShort && "minLength" in el) text = `Bitte schreib mindestens ${el.minLength} Zeichen.`;
    else if (v.patternMismatch) text = el.dataset.hint ?? "Das Format passt nicht.";
    else if (v.rangeUnderflow && el instanceof HTMLInputElement) text = `Mindestens ${el.min}.`;
    else if (v.rangeOverflow && el instanceof HTMLInputElement) text = `Höchstens ${el.max}.`;
    else if (v.typeMismatch) text = "Bitte gib eine gültige Adresse ein.";
    fieldError(form, el.name, text);
    first ??= el;
  });
  (first as Field | null)?.focus();
  return !first;
};

$$<HTMLFormElement>(".apply-form").forEach(form => {
  form.noValidate = true;

  form.addEventListener("input", e => {
    const wrap = (e.target as Element).closest(".field.invalid");
    if (!wrap) return;
    wrap.classList.remove("invalid");
    $(".field-msg", wrap)?.remove();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    clearErrors(form);
    if (!localCheck(form)) return;

    const data: Record<string, unknown> = Object.fromEntries(new FormData(form));
    const consent = form.elements.namedItem("datenschutz");
    data.datenschutz = consent instanceof HTMLInputElement && consent.checked;
    const btn = $<HTMLButtonElement>("button[type=submit]", form);
    const msg = $(".form-msg", form);
    if (btn) {
      btn.disabled = true;
      btn.classList.add("busy");
    }

    try {
      const res = await fetch("/api/bewerbungen", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; nachricht?: string; fehler?: Record<string, string> };
      if (!res.ok || !out.ok) {
        Object.entries(out.fehler ?? {}).forEach(([name, text]) => fieldError(form, name, text));
        if (msg) msg.textContent = out.nachricht ?? "Die Bewerbung konnte gerade nicht gesendet werden. Versuch es gleich noch einmal.";
        return;
      }
      const done = $(".apply-done", form.closest(".apply-panel") ?? document);
      if (done) {
        const name = $(".apply-done-name", done);
        if (name) name.textContent = String(data.spielername ?? "");
        form.hidden = true;
        done.hidden = false;
        done.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
      }
    } catch {
      if (msg) msg.textContent = "Keine Verbindung zum Server. Prüf deine Internetverbindung und versuch es noch einmal.";
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("busy");
      }
    }
  });
});
