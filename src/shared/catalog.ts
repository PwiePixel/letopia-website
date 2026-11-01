/** Feste Auswahllisten, die Website, Admin-Panel und Browser-Skripte gemeinsam nutzen. */

export const RARITIES = {
  gewoehnlich: { name: "Gewöhnlich", color: "#cfcfcf" },
  selten: { name: "Selten", color: "#55c6ff" },
  episch: { name: "Episch", color: "#c77dff" },
  legendaer: { name: "Legendär", color: "#ffb13b" },
  saisonal: { name: "Saisonal", color: "#ff6f91" }
} as const;

export type Rarity = keyof typeof RARITIES;

export const isRarity = (value: unknown): value is Rarity =>
  typeof value === "string" && Object.hasOwn(RARITIES, value);

export const rarityOf = (value: string) => (isRarity(value) ? RARITIES[value] : RARITIES.gewoehnlich);

/** Hintergrund-Szenen der Seitenköpfe (Canvas-Pixelstadt). */
export const SCENES = {
  night: "Nacht",
  dusk: "Abend",
  day: "Tag",
  dawn: "Morgen"
} as const;

export type Scene = keyof typeof SCENES;

export const isScene = (value: unknown): value is Scene =>
  typeof value === "string" && Object.hasOwn(SCENES, value);

/** Symbole aus dem SVG-Sprite, die als Kategorie-Icon im Wiki gewählt werden können. */
export const CATEGORY_ICONS = [
  "flag", "building", "coins", "mountain", "gem", "shield", "book", "home", "users", "star",
  "calendar", "pin", "hammer", "trophy", "gift", "headset", "bell", "plug", "scroll", "gamepad",
  "info", "clock", "search", "file", "mail", "cart", "send", "video", "list"
] as const;

export const isCategoryIcon = (value: unknown): value is (typeof CATEGORY_ICONS)[number] =>
  typeof value === "string" && (CATEGORY_ICONS as readonly string[]).includes(value);

export const APPLICATION_TYPES = {
  team: "Team",
  creator: "Creator"
} as const;

export type ApplicationType = keyof typeof APPLICATION_TYPES;

export const APPLICATION_STATUS = {
  neu: { label: "Neu", color: "blau" },
  pruefung: { label: "In Prüfung", color: "gelb" },
  angenommen: { label: "Angenommen", color: "gruen" },
  abgelehnt: { label: "Abgelehnt", color: "rot" }
} as const;

export type ApplicationStatus = keyof typeof APPLICATION_STATUS;

export const isApplicationStatus = (value: unknown): value is ApplicationStatus =>
  typeof value === "string" && Object.hasOwn(APPLICATION_STATUS, value);

/** Rollen im Admin-Panel. */
export const ROLES = {
  admin: { label: "Administrator", hint: "Voller Zugriff inklusive Benutzer und Einstellungen" },
  editor: { label: "Redaktion", hint: "Wiki, Regeln, Seiten, Team, Items, Rezepte, Voten und Medien" },
  moderator: { label: "Bewerbungen", hint: "Bewerbungen ansehen, bewerten und bearbeiten" }
} as const;

export type Role = keyof typeof ROLES;

export const isRole = (value: unknown): value is Role => typeof value === "string" && Object.hasOwn(ROLES, value);

/** Wandelt Text in einen URL-tauglichen Bezeichner um (ä → ae usw.). */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
