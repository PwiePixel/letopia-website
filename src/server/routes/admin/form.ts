import type { Context } from "hono";

/** Formulardaten, wie sie Hono mit { all: true } liefert. */
export type Body = Record<string, string | File | (string | File)[]>;

export const formBody = async (c: Context): Promise<Body> => (await c.req.parseBody({ all: true })) as Body;

const first = (value: Body[string] | undefined) => (Array.isArray(value) ? value[0] : value);

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Einzeiliger Text (getrimmt, ohne Steuerzeichen, gekürzt). */
export const str = (body: Body, key: string, max = 300): string => {
  const v = first(body[key]);
  return typeof v === "string" ? v.replace(CONTROL, "").replace(/[\r\n]+/g, " ").trim().slice(0, max) : "";
};

/** Mehrzeiliger Text (z. B. Markdown) – Zeilenumbrüche bleiben erhalten. */
export const text = (body: Body, key: string, max = 100_000): string => {
  const v = first(body[key]);
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(CONTROL, "").slice(0, max) : "";
};

export const num = (body: Body, key: string, fallback: number, min = -Infinity, max = Infinity): number => {
  const raw = str(body, key, 40).replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export const int = (body: Body, key: string, fallback: number, min = -Infinity, max = Infinity) =>
  Math.round(num(body, key, fallback, min, max));

/** Checkbox angehakt? */
export const bool = (body: Body, key: string): boolean => {
  const v = first(body[key]);
  return v === "on" || v === "1" || v === "true" || v === "ja";
};

/** Nicht-leere Zeilen eines Textfelds. */
export const lines = (body: Body, key: string, maxLines = 50, maxLength = 200): string[] =>
  text(body, key, 20_000)
    .split("\n")
    .map(l => l.replace(CONTROL, "").trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxLines);

export const files = (body: Body, key: string): File[] => {
  const v = body[key];
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list.filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && f.size > 0);
};

/** Optionales ISO-Datum (YYYY-MM-DD). */
export const isoDate = (body: Body, key: string): string | null => {
  const v = str(body, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
};

/** Erlaubte Link-Ziele für Buttons/Links im Admin-Panel: http(s), relative Pfade, "#". */
export const safeLink = (value: string): string => {
  const v = value.trim();
  if (!v || v === "#") return "#";
  if (/^https?:\/\/[^\s"'<>]+$/i.test(v)) return v;
  if (/^\/[^\s"'<>]*$/.test(v) && !v.startsWith("//")) return v;
  return "#";
};
