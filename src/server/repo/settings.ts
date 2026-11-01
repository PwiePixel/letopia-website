import { randomBytes } from "node:crypto";
import { get, run } from "../db/database.js";

/** Alle Einstellungen der Website mit ihren Standardwerten. */
export const DEFAULT_SETTINGS = {
  general: {
    siteName: "Letopia",
    serverAddress: "letopia.net",
    javaPort: 25565,
    bedrockPort: 19132,
    javaVersion: "1.21",
    /** ping = Minecraft-Server direkt abfragen, mcsrvstat = über api.mcsrvstat.us, off = nicht anzeigen */
    statusSource: "ping" as "ping" | "mcsrvstat" | "off"
  },
  links: {
    discord: "#",
    shop: "#",
    tiktok: "#",
    youtube: "#"
  },
  stats: {
    players: 3240,
    uptime: 99.4,
    plots: 1860,
    cities: 42,
    coins: 18400000,
    date: "September 2026"
  },
  announcement: {
    enabled: false,
    text: "",
    link: ""
  },
  applications: {
    teamOpen: true,
    creatorOpen: true,
    teamPositions: ["Supporter", "Moderator", "Builder", "Developer"],
    creatorPlatforms: ["YouTube", "TikTok", "Twitch", "Instagram", "Andere"],
    teamRequirements: [
      "Mindestens 14 Jahre alt",
      "Seit mindestens zwei Wochen aktiv auf Letopia",
      "Discord mit funktionierendem Mikrofon",
      "Kein Bann in den letzten drei Monaten"
    ],
    creatorRequirements: [
      "Mindestens 500 Follower oder Abonnenten",
      "Regelmäßig neue Inhalte, mindestens zwei pro Monat",
      "Letopia im Video oder Stream erwähnen"
    ],
    creatorPerks: [
      "Creator-Rang im Spiel | ✓",
      "Eigener Kanal im Discord | ✓",
      "Frühe Einblicke in Updates | ✓",
      "Eigene Events für deine Community | auf Anfrage"
    ],
    minAge: 14,
    maxPerDay: 3,
    /** Entschiedene Bewerbungen nach so vielen Tagen automatisch löschen (0 = nie). */
    retentionDays: 180,
    discordWebhook: "",
    /** Rolle/Benutzer, der im Discord erwähnt wird, z. B. <@&123> (optional). */
    discordMention: ""
  },
  votes: {
    streaks: [
      "7 Tage am Stück | 2.500 Coins",
      "14 Tage am Stück | Seltene Vote-Kiste",
      "30 Tage am Stück | Titel „Treue Seele“"
    ],
    monthly: "Wer am Monatsende die meisten Votes hat, bekommt eine **Legendäre Vote-Kiste**. Den aktuellen Stand siehst du im Spiel mit `/votetop`."
  },
  team: {
    stand: "2026-09-01"
  }
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingsGroup = keyof Settings;

const cache = new Map<SettingsGroup, unknown>();

const merge = <T extends object>(base: T, stored: unknown): T => {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return structuredClone(base);
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (!(key in out)) continue;
    const def = out[key];
    if (Array.isArray(def)) {
      if (Array.isArray(value)) out[key] = value.filter(v => typeof v === "string");
    } else if (typeof def === typeof value) {
      out[key] = value;
    }
  }
  return out as T;
};

export const getSettings = <G extends SettingsGroup>(group: G): Settings[G] => {
  const cached = cache.get(group);
  if (cached) return cached as Settings[G];
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", `site.${group}`);
  let stored: unknown = null;
  try {
    stored = row ? JSON.parse(row.value) : null;
  } catch {
    stored = null;
  }
  const value = merge(DEFAULT_SETTINGS[group], stored);
  cache.set(group, value);
  return value;
};

export const saveSettings = <G extends SettingsGroup>(group: G, value: Partial<Settings[G]>): Settings[G] => {
  const next = merge(DEFAULT_SETTINGS[group], { ...getSettings(group), ...value });
  run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    `site.${group}`,
    JSON.stringify(next)
  );
  cache.set(group, next);
  return next;
};

export const allSettings = (): Settings => ({
  general: getSettings("general"),
  links: getSettings("links"),
  stats: getSettings("stats"),
  announcement: getSettings("announcement"),
  applications: getSettings("applications"),
  votes: getSettings("votes"),
  team: getSettings("team")
});

export const clearSettingsCache = () => cache.clear();

/** Interne Werte (nicht im Admin-Panel sichtbar). */
export const getInternal = (key: string): string | undefined =>
  get<{ value: string }>("SELECT value FROM settings WHERE key = ?", `internal.${key}`)?.value;

export const setInternal = (key: string, value: string) =>
  run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    `internal.${key}`,
    value
  );

let secretCache: string | null = null;

/** Zufälliges Geheimnis dieser Installation (für IP-Hashes u. Ä.), wird beim ersten Zugriff erzeugt. */
export const instanceSecret = (): string => {
  if (secretCache) return secretCache;
  let value = getInternal("secret");
  if (!value) {
    value = randomBytes(32).toString("hex");
    setInternal("secret", value);
  }
  secretCache = value;
  return value;
};

/** "Label | Wert"-Zeilen in Paare zerlegen. */
export const pairs = (lines: readonly string[]): { label: string; value: string }[] =>
  lines
    .map(line => {
      const k = line.indexOf("|");
      return k === -1
        ? { label: line.trim(), value: "" }
        : { label: line.slice(0, k).trim(), value: line.slice(k + 1).trim() };
    })
    .filter(p => p.label);
