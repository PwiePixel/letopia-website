/** Crafting-Rezepte: Suche nach Rezept oder Zutat. */
import { $, $$, calm, reveal } from "../core";
import "../scene";

const list = $("#recipe-list");
const search = $<HTMLInputElement>("#recipe-q");
const empty = $("#recipe-empty");
const cards = $$("article.recipe", list ?? document);

search?.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  let shown = 0;
  cards.forEach(card => {
    const ok = !q || (card.dataset.text ?? "").includes(q);
    card.hidden = !ok;
    if (ok) shown++;
  });
  if (empty) empty.hidden = shown > 0;
  if (list) reveal(list);
});

const focusHash = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  el.hidden = false;
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
};

requestAnimationFrame(focusHash);
addEventListener("hashchange", focusHash);
