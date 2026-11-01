/** Voten: merkt sich im Browser, wann zuletzt auf welcher Seite gevotet wurde. */
import { $, $$, storage } from "../core";
import "../scene";

const KEY = "letopia-votes";
const DAY = 24 * 60 * 60 * 1000;
const box = $("#vote-list");

let stamps: Record<string, number> = {};
try {
  stamps = (JSON.parse(storage.get(KEY) ?? "{}") as Record<string, number>) ?? {};
} catch {
  stamps = {};
}

const waitText = (ms: number) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return h ? `${h} Std. ${m} Min.` : `${m} Min.`;
};

const render = () => {
  const cards = $$("article.vote-card", box ?? document);
  const now = Date.now();
  let done = 0;
  cards.forEach(card => {
    const name = card.dataset.site ?? "";
    const left = (stamps[name] ?? 0) + DAY - now;
    const ready = left <= 0;
    if (!ready) done++;
    card.classList.toggle("done", !ready);
    const note = $("small", card);
    if (note) note.textContent = ready ? "Bereit zum Voten" : `Wieder in ${waitText(left)}`;
    const link = $("a[data-site]", card);
    if (link) {
      link.classList.toggle("btn-primary", ready);
      link.classList.toggle("btn-ghost", !ready);
      link.textContent = ready ? "Jetzt voten" : "Erneut öffnen";
    }
  });
  const total = cards.length;
  const doneEl = $("#vote-done");
  const totalEl = $("#vote-total");
  const bar = $(".vote-bar i");
  if (doneEl) doneEl.textContent = String(done);
  if (totalEl) totalEl.textContent = String(total);
  if (bar) bar.style.width = `${total ? (done / total) * 100 : 0}%`;
};

box?.addEventListener("click", e => {
  const link = (e.target as Element).closest?.<HTMLElement>("a[data-site]");
  if (!link?.dataset.site) return;
  stamps[link.dataset.site] = Date.now();
  storage.set(KEY, JSON.stringify(stamps));
  setTimeout(render, 300);
});

render();
setInterval(render, 30000);
