import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { log } from "../log.js";

/** Minecraft-Namen (Java) bzw. Bedrock-Namen mit Punkt davor (Floodgate). */
export const HEAD_NAME = /^\.?[A-Za-z0-9_]{1,16}$/;

const MAX_AGE = 24 * 3600 * 1000;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const dir = path.join(config.cacheDir, "heads");
const fallbackFile = path.join(config.publicDir, "assets", "img", "head.png");

let fallback: Buffer | null = null;
const inflight = new Map<string, Promise<Buffer>>();

const fallbackHead = async () => (fallback ??= await readFile(fallbackFile));

const download = async (name: string): Promise<Buffer | null> => {
  try {
    const res = await fetch(`https://mc-heads.net/avatar/${encodeURIComponent(name)}/96`, {
      headers: { "User-Agent": "Letopia-Website" },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    return data.subarray(0, 4).equals(PNG) && data.length < 512 * 1024 ? data : null;
  } catch (error) {
    log.debug(`Kopf für ${name} konnte nicht geladen werden: ${(error as Error).message}`);
    return null;
  }
};

/**
 * Liefert den Kopf eines Spielers als PNG. Die Bilder werden 24 Stunden zwischengespeichert,
 * damit Besucher keinen direkten Kontakt zu mc-heads.net haben.
 */
export const playerHead = async (rawName: string): Promise<Buffer> => {
  if (!HEAD_NAME.test(rawName)) return fallbackHead();
  const name = rawName.replace(/^\./, "");
  // Bedrock-Spieler (.Name) haben keinen Java-Skin.
  if (rawName.startsWith(".")) return fallbackHead();
  const key = name.toLowerCase();
  const file = path.join(dir, `${key}.png`);

  const running = inflight.get(key);
  if (running) return running;

  const job = (async () => {
    let cachedImage: Buffer | null = null;
    try {
      const info = await stat(file);
      cachedImage = await readFile(file);
      if (Date.now() - info.mtimeMs < MAX_AGE) return cachedImage;
    } catch {
      cachedImage = null;
    }
    const fresh = await download(name);
    if (fresh) {
      await mkdir(dir, { recursive: true });
      await writeFile(file, fresh).catch(() => undefined);
      return fresh;
    }
    return cachedImage ?? fallbackHead();
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
};
