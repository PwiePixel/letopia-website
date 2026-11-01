/** Regeln: Inhaltsverzeichnis hebt den aktuellen Abschnitt hervor. */
import { $, $$, onScroll, scrollHooks } from "../core";
import "../scene";

const rules = $("#rules");
const toc = $("#rules-toc");

if (rules && toc) {
  const heads = $$("h2", rules);
  scrollHooks.push(() => {
    let active = heads[0]?.id;
    heads.forEach(h => {
      if (h.getBoundingClientRect().top < 160) active = h.id;
    });
    $$("a[data-id]", toc).forEach(a => a.classList.toggle("on", a.dataset.id === active));
  });
  onScroll();
}
