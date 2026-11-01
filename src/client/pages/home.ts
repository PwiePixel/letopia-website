/** Startseite: Bildergalerie mit automatischem Wechsel. */
import { $, $$, calm } from "../core";
import "../scene";

const slides = $$(".slide");
const caption = $(".gal-cap p");
const dotBox = $(".dots");
let current = 0;
let autoplay: number | undefined;

const show = (i: number) => {
  if (!slides.length) return;
  current = (i + slides.length) % slides.length;
  slides.forEach((s, n) => s.classList.toggle("on", n === current));
  if (dotBox) $$("button", dotBox).forEach((d, n) => d.classList.toggle("on", n === current));
  if (caption) caption.textContent = slides[current]?.dataset.cap ?? "";
};

const restart = () => {
  clearInterval(autoplay);
  if (!calm) autoplay = window.setInterval(() => show(current + 1), 6000);
};

slides.forEach((_, i) => {
  const dot = document.createElement("button");
  dot.setAttribute("aria-label", `Bild ${i + 1}`);
  dot.addEventListener("click", () => {
    show(i);
    restart();
  });
  dotBox?.append(dot);
});

$(".gal-arrow.prev")?.addEventListener("click", () => {
  show(current - 1);
  restart();
});
$(".gal-arrow.next")?.addEventListener("click", () => {
  show(current + 1);
  restart();
});
$(".gallery")?.addEventListener("mouseenter", () => clearInterval(autoplay));
$(".gallery")?.addEventListener("mouseleave", restart);
show(0);
restart();
