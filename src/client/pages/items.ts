/** Custom Items: Suche und Filter nach Seltenheit/Typ (die Karten rendert der Server). */
import { $, $$, calm, reveal } from "../core";
import "../scene";

const list = $("#item-list");
const search = $<HTMLInputElement>("#item-q");
const count = $("#item-count");
const empty = $("#item-empty");
const cards = $$("article.item-card", list ?? document);
const filter: Record<string, string> = { rarity: "alle", type: "alle" };

const apply = () => {
  const q = (search?.value ?? "").trim().toLowerCase();
  let shown = 0;
  cards.forEach(card => {
    const ok =
      (filter.rarity === "alle" || card.dataset.rarity === filter.rarity) &&
      (filter.type === "alle" || card.dataset.type === filter.type) &&
      (!q || (card.dataset.text ?? "").includes(q));
    card.hidden = !ok;
    if (ok) shown++;
  });
  if (count) count.textContent = `${shown} von ${cards.length} Items`;
  if (empty) empty.hidden = shown > 0;
  if (list) reveal(list);
};

document.addEventListener("click", e => {
  const btn = (e.target as Element).closest?.<HTMLElement>(".chip-btn");
  if (!btn?.dataset.group) return;
  filter[btn.dataset.group] = btn.dataset.value ?? "alle";
  $$(`.chip-btn[data-group="${btn.dataset.group}"]`).forEach(b => b.classList.toggle("on", b === btn));
  apply();
});

search?.addEventListener("input", apply);

const focusHash = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  if (el.hidden) {
    filter.rarity = "alle";
    filter.type = "alle";
    if (search) search.value = "";
    $$(".chip-btn").forEach(b => b.classList.toggle("on", b.dataset.value === "alle"));
    apply();
  }
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
};

requestAnimationFrame(focusHash);
addEventListener("hashchange", focusHash);
