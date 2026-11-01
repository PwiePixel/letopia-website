import type { ApplicationType } from "../../shared/catalog.js";
import type { Answer } from "../repo/applications.js";
import { getSettings } from "../repo/settings.js";

export interface FieldRule {
  label: string;
  required?: boolean;
  pattern?: RegExp;
  hint?: string;
  max?: number;
  min?: number;
  number?: [number, number];
  choices?: readonly string[];
  url?: boolean;
  long?: boolean;
}

export interface FormDefinition {
  title: string;
  /** Feld, das in der Übersicht als Kurzinfo erscheint (Position / Plattform). */
  summary: string;
  fields: Record<string, FieldRule>;
}

export const PLAYER_NAME = /^\.?[A-Za-z0-9_]{3,16}$/;

/** Formulardefinitionen – Auswahllisten und Mindestalter kommen aus den Einstellungen. */
export const forms = (): Record<ApplicationType, FormDefinition> => {
  const s = getSettings("applications");
  const name: FieldRule = { label: "Minecraft-Name", required: true, pattern: PLAYER_NAME, hint: "3–16 Zeichen: Buchstaben, Zahlen und Unterstrich." };
  const discord: FieldRule = { label: "Discord-Name", required: true, max: 40 };
  const age: FieldRule = { label: "Alter", required: true, number: [Math.max(1, s.minAge), 99] };

  return {
    team: {
      title: "Team",
      summary: "position",
      fields: {
        spielername: name,
        discord,
        alter: age,
        position: { label: "Position", required: true, choices: s.teamPositions },
        spielzeit: { label: "Auf Letopia seit", required: true, choices: ["Weniger als 1 Monat", "1–3 Monate", "3–6 Monate", "Länger als 6 Monate"] },
        stunden: { label: "Stunden pro Woche", required: true, number: [1, 80] },
        erfahrung: { label: "Erfahrung", max: 1500, long: true },
        motivation: { label: "Warum ins Team?", required: true, min: 100, max: 2000, long: true },
        staerken: { label: "Stärken & Schwächen", max: 1000, long: true }
      }
    },
    creator: {
      title: "Creator",
      summary: "plattform",
      fields: {
        spielername: name,
        discord,
        alter: age,
        plattform: { label: "Plattform", required: true, choices: s.creatorPlatforms },
        kanal: { label: "Kanal", required: true, max: 200, url: true },
        follower: { label: "Follower", required: true, number: [0, 100_000_000] },
        aufrufe: { label: "Ø Aufrufe", number: [0, 100_000_000] },
        idee: { label: "Content-Idee", required: true, min: 60, max: 2000, long: true }
      }
    }
  };
};

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const length = (text: string) => [...text].length;

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export interface ValidationResult {
  values: Record<string, string>;
  errors: Record<string, string>;
}

/** Serverseitige Prüfung – identische Regeln und Meldungen wie in der alten PHP-Version. */
export const validate = (fields: Record<string, FieldRule>, input: Record<string, unknown>): ValidationResult => {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const [name, rule] of Object.entries(fields)) {
    const raw = input[name];
    const value = (typeof raw === "string" || typeof raw === "number" ? String(raw) : "").replace(CONTROL, "").trim();

    if (value === "") {
      if (rule.required) errors[name] = "Bitte ausfüllen.";
      values[name] = "";
      continue;
    }

    if (rule.number) {
      const [from, to] = rule.number;
      if (!/^\d+$/.test(value) || Number(value) < from || Number(value) > to) errors[name] = `Bitte eine Zahl zwischen ${from} und ${to} angeben.`;
    } else if (rule.choices && !rule.choices.includes(value)) {
      errors[name] = "Bitte eine der Möglichkeiten auswählen.";
    } else if (rule.pattern && !rule.pattern.test(value)) {
      errors[name] = rule.hint ?? "Das Format passt nicht.";
    } else if (rule.url && (!isHttpUrl(value) || !/^https?:\/\//i.test(value))) {
      errors[name] = "Bitte einen vollständigen Link mit https:// angeben.";
    } else if (rule.min !== undefined && length(value) < rule.min) {
      errors[name] = `Bitte schreib mindestens ${rule.min} Zeichen.`;
    } else if (rule.max !== undefined && length(value) > rule.max) {
      errors[name] = `Bitte höchstens ${rule.max} Zeichen.`;
    }

    values[name] = value;
  }

  return { values, errors };
};

export const toAnswers = (fields: Record<string, FieldRule>, values: Record<string, string>): Answer[] =>
  Object.entries(fields)
    .filter(([name]) => (values[name] ?? "") !== "")
    .map(([name, rule]) => ({ field: name, label: rule.label, value: values[name] ?? "", long: Boolean(rule.long) }));

export const isApplicationType = (value: unknown): value is ApplicationType => value === "team" || value === "creator";
