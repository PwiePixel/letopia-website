/** Gemeinsame Browser-Logik aller Seiten: Navigation, Kopieren, Toasts, Animationen, Online-Status, Tabs. */

export const $ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => el.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => [...el.querySelectorAll<T>(sel)];

export const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#f0a830";

export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c] ?? c);

export interface SiteConfig {
  ip: string;
  bedrockPort: number;
  links: Record<string, string>;
  status: boolean;
}

export const site: SiteConfig = (() => {
  try {
    return JSON.parse($("#site-config")?.textContent ?? "{}") as SiteConfig;
  } catch {
    return { ip: "", bedrockPort: 19132, links: {}, status: false };
  }
})();

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // privater Modus o. Ä.
    }
  }
};

// --- Navigation ------------------------------------------------------------------------------------

const nav = $("#nav");
const menu = $("#menu");
const burger = $(".burger");
const totop = $(".totop");

export const scrollHooks: ((y: number) => void)[] = [];

export const onScroll = () => {
  const y = scrollY;
  nav?.classList.toggle("scrolled", y > 20);
  totop?.classList.toggle("show", y > 700);
  scrollHooks.forEach(fn => fn(y));
};

addEventListener("scroll", onScroll, { passive: true });

const setMenu = (open: boolean) => {
  menu?.classList.toggle("open", open);
  burger?.classList.toggle("open", open);
  burger?.setAttribute("aria-expanded", String(open));
  burger?.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  document.body.classList.toggle("lock", open);
};

burger?.addEventListener("click", () => setMenu(!menu?.classList.contains("open")));

const closeDropdowns = (except?: Element) =>
  $$(".dd.open").forEach(dd => {
    if (dd === except) return;
    dd.classList.remove("open");
    $(".dd-btn", dd)?.setAttribute("aria-expanded", "false");
  });

$$(".dd-btn").forEach(btn =>
  btn.addEventListener("click", () => {
    const dd = btn.parentElement;
    if (!dd) return;
    const open = !dd.classList.contains("open");
    closeDropdowns(dd);
    dd.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  })
);

document.addEventListener("click", e => {
  if (!(e.target as Element).closest?.(".dd")) closeDropdowns();
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  closeDropdowns();
  setMenu(false);
});

$$(".menu a").forEach(a =>
  a.addEventListener("click", () => {
    setMenu(false);
    closeDropdowns();
  })
);

totop?.addEventListener("click", () => scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" }));

// --- Toast & Kopieren -------------------------------------------------------------------------------

const toast = $(".toast");
let toastTimer: number | undefined;

export const showToast = (text: string, type: "ok" | "bad" = "ok") => {
  if (!toast) return;
  const span = $("span", toast);
  if (span) span.textContent = text;
  toast.classList.toggle("bad", type === "bad");
  $("use", toast)?.setAttribute("href", type === "bad" ? "#i-info" : "#i-check");
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
};

export const copy = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;opacity:0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
};

document.addEventListener("click", async e => {
  const el = (e.target as Element).closest?.<HTMLElement>("[data-copy]");
  if (!el) return;
  const key = el.dataset.copy ?? "";
  const value = key === "ip" ? site.ip : key === "port" ? String(site.bedrockPort) : key;
  if (!(await copy(value))) return showToast(`Kopieren hat nicht geklappt: ${value}`, "bad");
  if (key === "ip") showToast(`${value} kopiert – bis gleich auf Letopia!`);
  else if (key === "port") showToast(`Port ${value} kopiert`);
  else showToast(`„${value}“ kopiert`);
});

document.addEventListener("click", async e => {
  const btn = (e.target as Element).closest?.<HTMLButtonElement>(".code-copy");
  if (!btn) return;
  const code = btn.parentElement?.querySelector("code")?.textContent ?? "";
  if (await copy(code)) {
    btn.textContent = "Kopiert";
    setTimeout(() => (btn.textContent = "Kopieren"), 1600);
  }
});

// --- Zahlen & Einblenden ---------------------------------------------------------------------------

export const formatNumber = (n: number, dec = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const countUp = (el: HTMLElement) => {
  const target = parseFloat(el.dataset.count ?? "0");
  const dec = Number(el.dataset.dec ?? 0);
  const suffix = el.dataset.suffix ?? "";
  if (calm) {
    el.textContent = formatNumber(target, dec) + suffix;
    return;
  }
  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min((now - start) / 1800, 1);
    el.textContent = formatNumber(target * (1 - Math.pow(1 - p, 4)), dec) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const observer = new IntersectionObserver(
  entries =>
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target as HTMLElement;
      el.classList.add("in");
      $$("[data-count]", el).forEach(countUp);
      const ring = $<SVGCircleElement>(".ring-fg", el);
      if (ring) ring.style.strokeDashoffset = String(264 * (1 - parseFloat(ring.dataset.value ?? "0") / 100));
      observer.unobserve(el);
    }),
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

export const reveal = (root: ParentNode = document) => $$(".reveal:not(.in)", root).forEach(el => observer.observe(el));

reveal();
onScroll();

$$(".js-year").forEach(el => (el.textContent = String(new Date().getFullYear())));

// Ersatzbild, falls ein Kopf nicht geladen werden kann.
$$<HTMLImageElement>("img[data-fallback]").forEach(img => {
  const swap = () => {
    if (img.dataset.fallback && !img.src.endsWith(img.dataset.fallback)) img.src = img.dataset.fallback;
  };
  if (img.complete && img.naturalWidth === 0) swap();
  else img.addEventListener("error", swap, { once: true });
});

// --- Online-Status -------------------------------------------------------------------------------------

const onlineLabels = $$(".js-online");

if (onlineLabels.length && site.status) {
  void (async () => {
    const setOnline = (text: string) => onlineLabels.forEach(el => (el.textContent = text));
    try {
      const res = await fetch("/api/status", { signal: AbortSignal.timeout(8000) });
      const data = (res.ok ? await res.json() : {}) as { online?: boolean; players?: { online: number; max: number } };
      if (data.online && data.players) {
        setOnline(`Online: ${data.players.online}/${data.players.max}`);
      } else if (data.online === false) {
        setOnline("Gerade offline");
        $$(".pill-ico.live").forEach(el => el.classList.add("off"));
      } else {
        setOnline("Online: –");
      }
    } catch {
      setOnline("Online: –");
    }
  })();
}

// --- Tabs -------------------------------------------------------------------------------------------

export const activateTab = (tabs: HTMLElement, key: string) => {
  const list = $$(".tab", tabs);
  tabs.dataset.active = key;
  tabs.style.setProperty("--i", String(Math.max(0, list.findIndex(t => t.dataset.tab === key))));
  list.forEach(t => {
    const on = t.dataset.tab === key;
    t.classList.toggle("on", on);
    t.setAttribute("aria-selected", String(on));
  });
  const group = tabs.closest("[data-tabgroup]") ?? document;
  $$("[data-panel]", group).forEach(p => p.classList.toggle("on", p.dataset.panel === key));
  tabs.dispatchEvent(new CustomEvent("tabchange", { detail: key }));
};

$$(".tabs").forEach(tabs => $$(".tab", tabs).forEach(tab => tab.addEventListener("click", () => activateTab(tabs, tab.dataset.tab ?? ""))));

// --- Hinweis-Banner -------------------------------------------------------------------------------------

const banner = $(".announce");
if (banner) {
  const key = `letopia-hinweis:${banner.dataset.announce ?? ""}`;
  if (!storage.get(key)) {
    banner.hidden = false;
    requestAnimationFrame(() => banner.classList.add("show"));
  }
  $(".announce-x", banner)?.addEventListener("click", () => {
    storage.set(key, "1");
    banner.classList.remove("show");
    setTimeout(() => (banner.hidden = true), 300);
  });
}
