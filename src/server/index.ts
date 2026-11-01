import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { clientBuilt } from "./assets.js";
import { config } from "./config.js";
import { closeDatabase, openDatabase } from "./db/database.js";
import { seedIfEmpty } from "./db/seed.js";
import { log } from "./log.js";
import { startMaintenance, stopMaintenance } from "./services/maintenance.js";
import { countUsers } from "./repo/users.js";

openDatabase();
seedIfEmpty();

if (!clientBuilt()) log.warn("Browser-Skripte fehlen – bitte `npm run build` ausführen.");
if (countUsers() === 0) {
  log.warn("Es gibt noch keinen Admin-Benutzer. Anlegen mit: letopia admin neu <name>  (Entwicklung: npm run cli -- user:create <name>)");
}

const app = createApp();

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, info => {
  log.info(`Letopia läuft auf http://${info.address.includes(":") ? `[${info.address}]` : info.address}:${info.port} (${config.production ? "Produktion" : "Entwicklung"})`);
});

startMaintenance();

let stopping = false;
const shutdown = (signal: string) => {
  if (stopping) return;
  stopping = true;
  log.info(`${signal} empfangen – Server wird beendet …`);
  stopMaintenance();
  const force = setTimeout(() => {
    closeDatabase();
    process.exit(0);
  }, 5000);
  force.unref();
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", reason => log.error("Unbehandelter Fehler (Promise)", reason));
