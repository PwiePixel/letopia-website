import { log } from "../log.js";
import { purgeDecided } from "../repo/applications.js";
import { purgeAudit } from "../repo/audit.js";
import { purgeRateLimits } from "../repo/ratelimit.js";
import { purgeSessions } from "../repo/sessions.js";
import { getSettings } from "../repo/settings.js";

/** Stündliche Aufräumarbeiten: abgelaufene Sitzungen, alte Sperren, Aufbewahrungsfrist für Bewerbungen. */
export const runMaintenance = () => {
  try {
    const sessions = purgeSessions();
    const limits = purgeRateLimits();
    const applications = purgeDecided(getSettings("applications").retentionDays);
    const audit = purgeAudit();
    if (applications) log.info(`${applications} entschiedene Bewerbung(en) nach Ablauf der Aufbewahrungsfrist gelöscht.`);
    log.debug(`Wartung: ${sessions} Sitzungen, ${limits} Sperren, ${audit} Protokolleinträge entfernt.`);
  } catch (error) {
    log.error("Wartung fehlgeschlagen", error);
  }
};

let timer: NodeJS.Timeout | null = null;

export const startMaintenance = () => {
  runMaintenance();
  timer = setInterval(runMaintenance, 3600_000);
  timer.unref();
};

export const stopMaintenance = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
