/** Animierte Pixel-Stadt in den Seitenköpfen (Canvas). Jede Szene wird aus einem Seed deterministisch erzeugt. */
import { $$, accent, calm, scrollHooks } from "./core";

interface Palette {
  sky: string[];
  stars?: boolean;
  moon?: string;
  sun?: string;
  high?: boolean;
  clouds?: boolean;
  far: string;
  farLit?: string;
  back: string[];
  walls: string[];
  beam?: string;
  roofs: string[];
  trim: string;
  lit: string[];
  dark: string;
  litChance: number;
  ground: string;
  grass: string;
  tuft: string;
  path: string[];
  leaves: string[];
  trunk: string;
  lamp: string;
  glow?: boolean;
  flies?: boolean;
}

interface Star { x: number; y: number; a: number; p: number; big: boolean }
interface Fly { x: number; y: number; vx: number; vy: number; p: number }
interface Win { x: number; y: number; c: string; on: boolean }
interface Scene { W: number; H: number; ctx: CanvasRenderingContext2D; stars: Star[]; flies: Fly[]; windows: Win[] }

const palettes: Record<string, Palette> = {
  night: {
    sky: ["#070e18", "#0a1321", "#0d182a", "#111e33", "#15253b", "#1a2c43", "#20344a", "#273c50"],
    stars: true,
    moon: "#f3eedc",
    far: "#111c28",
    farLit: "#4d4634",
    back: ["#172230", "#1a2634", "#151f2b"],
    walls: ["#202b36", "#25303a", "#1d2731", "#2a333b"],
    roofs: ["#3a2622", "#2f2a33", "#422c24"],
    trim: "#0e151c",
    lit: ["#ffd173", "#ffbd55", "#ffe19b", "#f6a94b"],
    dark: "#0d141b",
    litChance: .45,
    ground: "#0b130f",
    grass: "#16301f",
    tuft: "#1d3c28",
    path: ["#1a2025", "#21272c"],
    leaves: ["#12291b", "#183423", "#0d2014"],
    trunk: "#1c1511",
    lamp: "#ffd27a",
    glow: true,
    flies: true
  },
  dusk: {
    sky: ["#1f1b3b", "#2e2146", "#45294e", "#65304f", "#8a3a4c", "#b04c46", "#d66d43", "#f09347"],
    sun: "#ffd98c",
    far: "#3a2340",
    farLit: "#8a5250",
    back: ["#302337", "#35263c", "#2b2033"],
    walls: ["#3c2c3e", "#453244", "#372a3b", "#4d3847"],
    roofs: ["#65312f", "#512c38", "#70392f"],
    trim: "#231927",
    lit: ["#ffc86a", "#ffb04f", "#ffd996"],
    dark: "#22182a",
    litChance: .32,
    ground: "#1b151e",
    grass: "#2e3526",
    tuft: "#3a432e",
    path: ["#2c2530", "#342c38"],
    leaves: ["#26341f", "#2e3f25", "#1f2a1a"],
    trunk: "#2a1d19",
    lamp: "#ffd27a",
    glow: true
  },
  day: {
    sky: ["#4d9ee0", "#58a7e4", "#64b0e8", "#71b9eb", "#80c2ef", "#91cbf1", "#a4d5f3", "#bbe0f5"],
    sun: "#fff4c4",
    high: true,
    clouds: true,
    far: "#94b7cb",
    back: ["#b4bfc6", "#a6b3bb", "#bec6c3"],
    walls: ["#dccfb1", "#cbb896", "#e5ddc9", "#b9a584", "#d2c4a3"],
    beam: "#7a5436",
    roofs: ["#8d4a33", "#6f3e2c", "#586476", "#9b5a3a"],
    trim: "#8e826c",
    lit: ["#8fb8cf", "#a9cde0"],
    dark: "#4b6477",
    litChance: .35,
    ground: "#4a7f30",
    grass: "#66a843",
    tuft: "#78bb4f",
    path: ["#9c978d", "#aea89d"],
    leaves: ["#3d7f2b", "#4c9435", "#326c23"],
    trunk: "#6b4a2f",
    lamp: "#e8d8a8"
  },
  dawn: {
    sky: ["#282d55", "#363868", "#4c4478", "#695383", "#8c6389", "#b37389", "#d68a8a", "#efaa92"],
    sun: "#ffe2bc",
    far: "#493d62",
    farLit: "#8a6a78",
    back: ["#483e5e", "#4f4468", "#433957"],
    walls: ["#6a5a74", "#75637c", "#5e5069", "#81707f"],
    beam: "#46364c",
    roofs: ["#7b4453", "#5e4668", "#8b5058"],
    trim: "#3a2f45",
    lit: ["#ffd08a", "#ffc070"],
    dark: "#3a3048",
    litChance: .22,
    ground: "#2e2a3a",
    grass: "#3f5140",
    tuft: "#4b5f49",
    path: ["#4a4455", "#544d5f"],
    leaves: ["#34503a", "#3d5c42", "#2d4632"],
    trunk: "#3b2c2b",
    lamp: "#ffd27a",
    glow: true
  }
};

const rand = (seed: string) => {
  let a = 7;
  for (const ch of seed) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 1) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickFrom = <T>(list: readonly T[], r: () => number): T => list[Math.floor(r() * list.length)] as T;

const paint = (canvas: HTMLCanvasElement, width: number, height: number, pal: Palette, seed: string, size: number, tall = 1): Scene => {
  const W = Math.max(60, Math.ceil(width / size));
  const H = Math.max(40, Math.ceil(height / size));
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const r = rand(seed);
  const pick = <T>(list: readonly T[]) => pickFrom(list, r);
  const int = (n: number) => Math.floor(r() * n);

  const box = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const disc = (cx: number, cy: number, rad: number, c: string) => {
    ctx.fillStyle = c;
    for (let y = -rad; y <= rad; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, rad * rad - y * y)));
      ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
  };

  const ground = Math.round(H * 0.84);
  const band = Math.ceil(ground / pal.sky.length);

  pal.sky.forEach((c, i) => box(0, i * band, W, band + 1, c));
  pal.sky.forEach((c, i) => {
    if (!i) return;
    ctx.fillStyle = c;
    for (let x = 0; x < W; x++) {
      if ((x + i) % 2 === 0) ctx.fillRect(x, i * band - 1, 1, 1);
      if ((x + i) % 4 === 0) ctx.fillRect(x, i * band - 2, 1, 1);
    }
  });

  if (pal.moon) {
    const rad = Math.max(5, Math.round(H * 0.05));
    const mx = Math.round(W * 0.8);
    const my = Math.round(H * 0.2);
    ctx.globalAlpha = 0.05;
    disc(mx, my, rad * 3, pal.moon);
    ctx.globalAlpha = 0.09;
    disc(mx, my, Math.round(rad * 1.8), pal.moon);
    ctx.globalAlpha = 1;
    disc(mx, my, rad, pal.moon);
    box(mx - rad * 0.4, my - rad * 0.3, Math.max(1, rad * 0.35), Math.max(1, rad * 0.3), "#d8d1bb");
    box(mx + rad * 0.2, my + rad * 0.25, Math.max(1, rad * 0.3), Math.max(1, rad * 0.3), "#d8d1bb");
  }

  if (pal.sun) {
    const rad = Math.max(5, Math.round(H * (pal.high ? 0.06 : 0.1)));
    const sx = Math.round(W * (pal.high ? 0.8 : 0.25 + r() * 0.5));
    const sy = pal.high ? Math.round(H * 0.2) : ground - Math.round(H * 0.2);
    ctx.globalAlpha = 0.08;
    disc(sx, sy, rad * 3, pal.sun);
    ctx.globalAlpha = 0.14;
    disc(sx, sy, Math.round(rad * 1.7), pal.sun);
    ctx.globalAlpha = 1;
    disc(sx, sy, rad, pal.sun);
  }

  if (pal.clouds) {
    for (let k = 0; k < Math.max(3, Math.round(W / 45)); k++) {
      const cw = 14 + int(22);
      const cx = int(W) - 6;
      const cy = Math.floor(ground * (0.08 + r() * 0.32));
      box(cx, cy, cw, 3, "#f4f9fc");
      box(cx + 3, cy - 2, cw * 0.45, 2, "#f4f9fc");
      box(cx + cw * 0.5, cy - 3, cw * 0.3, 3, "#f4f9fc");
      box(cx + 1, cy + 3, cw - 2, 1, "#d5e6f1");
    }
  }

  const stars: Star[] = [];
  if (pal.stars) {
    for (let k = 0; k < Math.round((W * ground) / 150); k++) {
      stars.push({ x: int(W), y: int(ground * 0.72), a: 0.25 + r() * 0.75, p: r() * 6.3, big: r() < 0.05 });
    }
  }

  let x = -2;
  while (x < W) {
    const w = 5 + int(12);
    const h = Math.floor(H * (0.26 + r() * 0.3) * tall);
    box(x, ground - h, w, h, pal.far);
    if (r() < 0.22) box(x + Math.floor(w / 2) - 1, ground - h - 6 - int(6), 2, 12, pal.far);
    if (pal.farLit) {
      for (let k = 0; k < (w * h) / 30; k++) {
        if (r() < 0.35) box(x + 1 + int(w - 2), ground - h + 2 + int(h - 3), 1, 1, pal.farLit);
      }
    }
    x += w + int(3) - 1;
  }

  const windows: Win[] = [];

  const house = (hx: number, w: number, h: number, wall: string, lit: number) => {
    const top = ground - h;
    box(hx, top, w, h, wall);
    box(hx + w - 1, top, 1, h, pal.trim);

    if (pal.beam && r() < 0.6) {
      for (let y = top + 5; y < ground - 2; y += 6) box(hx, y, w - 1, 1, pal.beam);
      box(hx, top, 1, h, pal.beam);
    }

    for (let y = top + 3; y < ground - 7; y += 6) {
      for (let wx = hx + 2; wx < hx + w - 3; wx += 4) {
        const c = pick(pal.lit);
        const on = r() < pal.litChance * lit;
        box(wx, y, 2, 3, on ? c : pal.dark);
        windows.push({ x: wx, y, c, on });
      }
    }

    box(hx + 2 + int(Math.max(1, w - 6)), ground - 4, 2, 4, r() < 0.3 ? pick(pal.lit) : pal.trim);

    const roof = pick(pal.roofs);
    const kind = r();

    if (kind < 0.5) {
      const steps = Math.ceil((w + 2) / 2);
      for (let i = 0; i < steps; i++) box(hx - 1 + i, top - 1 - i, w + 2 - i * 2, 1, roof);
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < steps; i++) {
        const rw = w + 2 - i * 2;
        box(hx - 1 + i + Math.ceil(rw / 2), top - 1 - i, Math.floor(rw / 2), 1, "#000");
      }
      ctx.globalAlpha = 1;
    } else if (kind < 0.8) {
      box(hx - 1, top - 2, w + 2, 2, roof);
      if (r() < 0.6) box(hx + 2 + int(Math.max(1, w - 5)), top - 5, 2, 3, pal.trim);
    } else {
      const tw = Math.max(4, Math.floor(w * 0.45));
      const tx = hx + Math.floor((w - tw) / 2);
      const th = 6 + int(9);
      box(hx - 1, top - 2, w + 2, 2, roof);
      box(tx, top - 2 - th, tw, th, wall);
      box(tx + tw - 1, top - 2 - th, 1, th, pal.trim);
      const c = pick(pal.lit);
      const on = r() < 0.6 * lit;
      const wx = tx + Math.floor(tw / 2) - 1;
      box(wx, top - th + 1, 2, 3, on ? c : pal.dark);
      windows.push({ x: wx, y: top - th + 1, c, on });
      for (let i = 0; tw + 2 - i * 2 > 0; i++) box(tx - 1 + i, top - 4 - th - i * 2, tw + 2 - i * 2, 2, roof);
    }
  };

  x = -4;
  while (x < W) {
    const w = 10 + int(12);
    house(x, w, Math.floor(H * (0.2 + r() * 0.22) * tall), pick(pal.back), 0.7);
    x += w + 2 + int(4);
  }

  box(0, ground, W, H - ground, pal.ground);

  x = -5 - int(5);
  while (x < W) {
    const w = 11 + int(10);
    house(x, w, Math.floor(H * (0.11 + r() * 0.13)), pick(pal.walls), 1);
    x += w + 4 + int(9);
  }

  box(0, ground, W, 1, pal.grass);
  for (let gx = 0; gx < W; gx++) if (r() < 0.3) box(gx, ground - 1, 1, 1, pal.tuft);
  for (let row = 0; row < 3; row++) {
    for (let gx = 0; gx < W + 2; gx += 2) box(gx - (row % 2), ground + 3 + row, 2, 1, pal.path[((gx >> 1) + row) % 2] ?? pal.ground);
  }

  for (let k = 0; k < Math.max(3, Math.round(W / 24)); k++) {
    const tx = 3 + int(W - 6);
    const th = 3 + int(3);
    const cw = 5 + int(3) * 2;
    const ch = 4 + int(3);
    const cx = tx - (cw >> 1);
    const cy = ground - th - ch;
    const [leaf0 = "#000", leaf1 = leaf0, leaf2 = leaf0] = pal.leaves;
    box(tx, ground - th, 1, th, pal.trunk);
    box(cx, cy, cw, ch, leaf0);
    box(cx + 1, cy - 1, cw - 2, 1, leaf0);
    box(cx + 1, cy, Math.max(1, cw - 3), 2, leaf1);
    box(cx, cy + ch - 1, cw, 1, leaf2);
    for (let n = 0; n < cw; n++) box(cx + int(cw), cy + int(ch), 1, 1, pick(pal.leaves));
  }

  const lamps: [number, number][] = [];
  for (let lx = 5 + int(12); lx < W - 2; lx += 20 + int(16)) {
    box(lx, ground - 8, 1, 8, pal.trim);
    box(lx - 1, ground - 10, 3, 3, pal.trim);
    box(lx, ground - 9, 1, 1, pal.lamp);
    lamps.push([lx, ground - 9]);
  }

  if (pal.glow) {
    lamps.forEach(([lx, ly]) => {
      ctx.globalAlpha = 0.06;
      disc(lx, ly, 7, pal.lamp);
      ctx.globalAlpha = 0.12;
      disc(lx, ly, 3, pal.lamp);
    });
    ctx.globalAlpha = 1;
  }

  const pixels = ctx.getImageData(0, 0, W, H).data;
  const skyColors = new Set(pal.sky);
  const hex = (i: number) => "#" + [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0].map(v => v.toString(16).padStart(2, "0")).join("");
  const freeStars = stars.filter(s => skyColors.has(hex((s.y * W + s.x) * 4)));

  const flies: Fly[] = pal.flies
    ? Array.from({ length: Math.max(6, Math.round(W / 20)) }, () => ({ x: r() * W, y: ground * (0.3 + r() * 0.66), vx: (r() - 0.5) * 0.16, vy: (r() - 0.5) * 0.1, p: r() * 6.3 }))
    : [];

  return { W, H, ctx, stars: freeStars, flies, windows };
};

const glimmer = (ctx: CanvasRenderingContext2D, scene: Scene, t: number) => {
  ctx.fillStyle = "#fff";
  scene.stars.forEach(s => {
    ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * 1.4 + s.p));
    ctx.fillRect(s.x, s.y, 1, 1);
    if (s.big) {
      ctx.globalAlpha *= 0.45;
      ctx.fillRect(s.x - 1, s.y, 3, 1);
      ctx.fillRect(s.x, s.y - 1, 1, 3);
    }
  });
  scene.flies.forEach(f => {
    const a = Math.max(0, 0.45 + 0.55 * Math.sin(t * 2 + f.p));
    const fx = Math.round(f.x);
    const fy = Math.round(f.y);
    ctx.globalAlpha = a * 0.28;
    ctx.fillStyle = accent;
    ctx.fillRect(fx - 1, fy - 1, 3, 3);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffe6a8";
    ctx.fillRect(fx, fy, 1, 1);
  });
  ctx.globalAlpha = 1;
};

const paletteOf = (name: string | undefined) => palettes[name ?? ""] ?? (palettes.night as Palette);

export const paintSlides = () =>
  $$<HTMLCanvasElement>(".slide canvas").forEach(cv => {
    if (!cv.clientWidth) return;
    const scene = paint(cv, cv.clientWidth, cv.clientHeight, paletteOf(cv.dataset.scene), cv.dataset.seed ?? "letopia", 3);
    glimmer(scene.ctx, scene, 0);
  });

const mountScene = (canvas: HTMLCanvasElement) => {
  const host = canvas.parentElement;
  if (!host) return;
  const pal = paletteOf(canvas.dataset.scene);
  const seed = canvas.dataset.seed || "letopia";
  const tall = parseFloat(canvas.dataset.tall ?? "1") || 1;
  const base = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const lively = !calm && Boolean(pal.stars || pal.flies || pal.glow);
  let scene: Scene | null = null;
  let running = false;
  let inView = true;
  let last = 0;
  let flicker = 0;
  let built = [0, 0];

  const draw = (now: number) => {
    if (!scene) return;
    const t = now / 1000;
    if (running) {
      const s = scene;
      s.flies.forEach(f => {
        f.x += f.vx + Math.sin(t * 0.7 + f.p) * 0.04;
        f.y += f.vy + Math.cos(t * 0.5 + f.p) * 0.03;
        if (f.x < -2) f.x = s.W + 1;
        if (f.x > s.W + 2) f.x = -1;
        if (f.y < s.H * 0.25) f.vy = Math.abs(f.vy);
        if (f.y > s.H * 0.95) f.vy = -Math.abs(f.vy);
      });
    }
    ctx.drawImage(base, 0, 0);
    glimmer(ctx, scene, t);
  };

  const build = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (Math.abs(w - (built[0] ?? 0)) < 2 && Math.abs(h - (built[1] ?? 0)) < 90) return;
    built = [w, h];
    const px = w > 1700 ? 5 : w > 720 ? 4 : 3;
    scene = paint(base, w, h, pal, seed, px, tall);
    canvas.width = scene.W;
    canvas.height = scene.H;
    draw(performance.now());
  };

  const loop = (now: number) => {
    if (!running || !scene) return;
    if (now - last > 66) {
      last = now;
      if (pal.glow && now > flicker && scene.windows.length) {
        const win = scene.windows[Math.floor(Math.random() * scene.windows.length)];
        if (win) {
          win.on = !win.on;
          scene.ctx.fillStyle = win.on ? win.c : pal.dark;
          scene.ctx.fillRect(win.x, win.y, 2, 3);
        }
        flicker = now + 600 + Math.random() * 1800;
      }
      draw(now);
    }
    requestAnimationFrame(loop);
  };

  const update = () => {
    const next = lively && inView && !document.hidden;
    if (next && !running) {
      running = true;
      requestAnimationFrame(loop);
    }
    running = next;
  };

  build();
  new IntersectionObserver(([entry]) => {
    inView = Boolean(entry?.isIntersecting);
    update();
  }).observe(host);
  document.addEventListener("visibilitychange", update);

  let resizeTimer: number | undefined;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 200);
  });

  if (!calm) {
    scrollHooks.push(y => {
      if (y < innerHeight * 1.3) canvas.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
    });
  }
};

$$<HTMLCanvasElement>(".hero-scene").forEach(mountScene);
paintSlides();

let slideTimer: number | undefined;
addEventListener("resize", () => {
  clearTimeout(slideTimer);
  slideTimer = window.setTimeout(paintSlides, 220);
});
