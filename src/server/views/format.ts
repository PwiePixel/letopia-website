/** Datums- und Zahlenformatierung (deutsch, Zeitzone Europe/Berlin). */

const TZ = "Europe/Berlin";

const fromIso = (iso: string) => new Date(`${iso}T12:00:00Z`);

export const isIsoDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** 2026-09-14 → 14. September 2026 */
export const longDate = (iso: string | null | undefined) =>
  isIsoDate(iso) ? fromIso(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "";

/** 2026-09-14 → 14.09.2026 */
export const shortDate = (iso: string | null | undefined) =>
  isIsoDate(iso) ? fromIso(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }) : "";

/** 2026-09-14 → September 2026 */
export const monthYear = (iso: string | null | undefined) =>
  isIsoDate(iso) ? fromIso(iso).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: TZ }) : "";

/** Unix-Zeit → 14.09.2026, 18:30 */
export const dateTime = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "–";

/** Unix-Zeit → "vor 5 Min." usw. */
export const ago = (unix: number | null | undefined) => {
  if (!unix) return "–";
  const d = Math.floor(Date.now() / 1000) - unix;
  if (d < 60) return "gerade eben";
  if (d < 3600) return `vor ${Math.floor(d / 60)} Min.`;
  if (d < 86400) return `vor ${Math.floor(d / 3600)} Std.`;
  if (d < 86400 * 7) {
    const days = Math.floor(d / 86400);
    return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  }
  return new Date(unix * 1000).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
};

export const number = (n: number, decimals = 0) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${number(bytes / 1024, 0)} KB` : `${number(bytes / 1024 / 1024, 1)} MB`;

/** JSON sicher in ein <script type="application/json"> einbetten. */
export const scriptJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
