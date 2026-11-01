import { randomBytes } from "node:crypto";
import { log } from "../log.js";

let code: string | null = null;

/**
 * Einmaliger Einrichtungscode für den ersten Admin-Account (nur solange es keinen Benutzer gibt).
 * Er steht im Server-Log – so kann niemand Fremdes eine frische Installation übernehmen.
 */
export const setupCode = (): string => {
  if (!code) {
    code = randomBytes(5).toString("hex").toUpperCase();
    log.warn(`Einrichtungscode für den ersten Admin-Account: ${code}  (Admin-Panel: /admin)`);
  }
  return code;
};

export const clearSetupCode = () => {
  code = null;
};
