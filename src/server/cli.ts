/**
 * Kommandozeile für Installation und Wartung.
 *
 *   node dist/server/cli.js <befehl> [optionen]
 *
 * Auf dem Server einfacher über den Befehl `letopia` (siehe deploy/letopia).
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isApplicationStatus, isRole, ROLES, type ApplicationType, type Role } from "../shared/catalog.js";
import { config } from "./config.js";
import { all, closeDatabase, get, openDatabase, transaction } from "./db/database.js";
import { SCHEMA_VERSION } from "./db/migrations.js";
import { seedIfEmpty } from "./db/seed.js";
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH } from "./lib/security.js";
import { createApplication, type Answer } from "./repo/applications.js";
import { audit } from "./repo/audit.js";
import { deleteSessionsOfUser } from "./repo/sessions.js";
import { countUsers, createUser, deleteUser, getUserByName, listUsers, setPassword, setTotpSecret, USERNAME_PATTERN } from "./repo/users.js";
import { createBackup } from "./services/backup.js";

const CLI_ACTOR = { id: null, username: "Kommandozeile" };

class CliError extends Error {}

const args = process.argv.slice(2);
const command = args[0] ?? "hilfe";
const positional = args.slice(1).filter(a => !a.startsWith("--"));

const option = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = args[i + 1];
  return next && !next.startsWith("--") ? next : "";
};
const flag = (name: string) => args.includes(`--${name}`);

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
};

/** Passwort aus --password-stdin, Umgebungsvariable oder --password; sonst null (= erzeugen). */
const passwordInput = async (): Promise<string | null> => {
  if (flag("password-stdin")) return readStdin();
  if (process.env.LETOPIA_PASSWORD) return process.env.LETOPIA_PASSWORD;
  const value = option("password");
  return value ? value : null;
};

const checkPassword = (password: string) => {
  if (password.length < MIN_PASSWORD_LENGTH) throw new CliError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
  if (password.length > 200) throw new CliError("Das Passwort ist zu lang.");
};

const HELP = `Letopia – Verwaltung über die Kommandozeile

Befehle:
  migrate                         Datenbank anlegen bzw. aktualisieren (inkl. Startinhalte)
  info                            Kurzer Überblick über Datenbank und Inhalte
  user:create <name> [optionen]   Admin-Account anlegen
      --role admin|editor|moderator   Rolle (Standard: admin)
      --password-stdin                Passwort von der Standardeingabe lesen
      --minecraft <name>              Minecraft-Name für den Kopf
      --if-missing                    Nichts tun, wenn es schon Benutzer gibt
  user:password <name>            Neues Passwort setzen (ohne Angabe wird eins erzeugt)
      --password-stdin                Passwort von der Standardeingabe lesen
  user:list                       Alle Benutzer anzeigen  (--count: nur Anzahl)
  user:delete <name>              Benutzer löschen
  user:2fa-off <name>             Zwei-Faktor-Schutz eines Benutzers abschalten
  backup [--keep 14]              Backup (Datenbank + Uploads) im Backup-Ordner erstellen
  import-legacy <pfad>            Bewerbungen aus der alten PHP-Version übernehmen
                                  (Datei letopia.sqlite oder der alte Website-Ordner)
`;

const commands: Record<string, () => Promise<void> | void> = {
  hilfe: () => {
    process.stdout.write(HELP);
  },

  migrate: () => {
    openDatabase();
    const seeded = seedIfEmpty();
    console.log(`Datenbank bereit (Schema-Version ${SCHEMA_VERSION})${seeded ? " – Startinhalte importiert" : ""}: ${config.dbFile}`);
  },

  info: () => {
    openDatabase();
    const count = (table: string) => Number(get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0);
    const size = existsSync(config.dbFile) ? statSync(config.dbFile).size : 0;
    console.log(`Datenbank:     ${config.dbFile} (${Math.round(size / 1024)} KB, Schema ${SCHEMA_VERSION})`);
    console.log(`Benutzer:      ${count("users")}`);
    console.log(`Bewerbungen:   ${count("applications")}`);
    console.log(`Wiki-Artikel:  ${count("wiki_articles")}`);
    console.log(`Seiten:        ${count("pages")}`);
    console.log(`Team:          ${count("team_members")}`);
    console.log(`Items/Rezepte: ${count("items")}/${count("recipes")}`);
    console.log(`Medien:        ${count("media")}`);
  },

  "user:create": async () => {
    openDatabase();
    const name = positional[0] ?? "";
    if (flag("if-missing") && countUsers() > 0) {
      console.log("Es gibt bereits Benutzer – nichts zu tun.");
      return;
    }
    if (!USERNAME_PATTERN.test(name)) throw new CliError("Name ungültig: 3–32 Zeichen, nur Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich.");
    if (getUserByName(name)) throw new CliError(`Den Benutzer „${name}“ gibt es schon. Passwort zurücksetzen mit: user:password ${name}`);
    const roleRaw = option("role") || "admin";
    if (!isRole(roleRaw)) throw new CliError(`Unbekannte Rolle „${roleRaw}“. Möglich: ${Object.keys(ROLES).join(", ")}`);
    const role: Role = roleRaw;
    const given = await passwordInput();
    const password = given ?? generatePassword();
    checkPassword(password);
    const minecraft = option("minecraft") ?? "";
    createUser({ username: name, passwordHash: await hashPassword(password), role, minecraftName: minecraft, mustChange: given === null });
    audit(CLI_ACTOR, "cli.benutzer", name, `angelegt (${ROLES[role].label})`);
    console.log(`Benutzer „${name}“ angelegt (${ROLES[role].label}).`);
    if (given === null) console.log(`Passwort: ${password}\n(Beim ersten Login muss es geändert werden.)`);
  },

  "user:password": async () => {
    openDatabase();
    const name = positional[0] ?? "";
    const user = getUserByName(name);
    if (!user) throw new CliError(`Den Benutzer „${name}“ gibt es nicht.`);
    const given = await passwordInput();
    const password = given ?? generatePassword();
    checkPassword(password);
    setPassword(user.id, await hashPassword(password), given === null);
    deleteSessionsOfUser(user.id);
    audit(CLI_ACTOR, "cli.benutzer", user.username, "Passwort zurückgesetzt");
    console.log(`Neues Passwort für „${user.username}“ gesetzt. Alle Sitzungen wurden beendet.`);
    if (given === null) console.log(`Passwort: ${password}\n(Beim nächsten Login muss es geändert werden.)`);
  },

  "user:list": () => {
    openDatabase();
    const users = listUsers();
    if (flag("count")) {
      console.log(users.length);
      return;
    }
    if (!users.length) {
      console.log("Noch keine Benutzer.");
      return;
    }
    for (const u of users) {
      const extras = [u.active ? "" : "deaktiviert", u.has_totp ? "2FA" : "", u.must_change_password ? "muss Passwort ändern" : ""].filter(Boolean);
      console.log(`${u.username.padEnd(24)} ${(ROLES[u.role]?.label ?? u.role).padEnd(14)} ${extras.join(", ")}`);
    }
  },

  "user:delete": () => {
    openDatabase();
    const user = getUserByName(positional[0] ?? "");
    if (!user) throw new CliError(`Den Benutzer „${positional[0] ?? ""}“ gibt es nicht.`);
    const admins = all<{ id: number }>("SELECT id FROM users WHERE role = 'admin' AND active = 1");
    if (user.role === "admin" && admins.length <= 1) throw new CliError("Der letzte aktive Administrator kann nicht gelöscht werden.");
    deleteUser(user.id);
    audit(CLI_ACTOR, "cli.benutzer", user.username, "gelöscht");
    console.log(`Benutzer „${user.username}“ gelöscht.`);
  },

  "user:2fa-off": () => {
    openDatabase();
    const user = getUserByName(positional[0] ?? "");
    if (!user) throw new CliError(`Den Benutzer „${positional[0] ?? ""}“ gibt es nicht.`);
    setTotpSecret(user.id, null);
    audit(CLI_ACTOR, "cli.benutzer", user.username, "2FA abgeschaltet");
    console.log(`Zwei-Faktor-Schutz für „${user.username}“ abgeschaltet.`);
  },

  backup: async () => {
    openDatabase();
    const keep = Math.max(1, Number(option("keep") ?? 14) || 14);
    const file = await createBackup(keep);
    console.log(`Backup erstellt: ${file}`);
  },

  "import-legacy": () => {
    openDatabase();
    let source = positional[0] ?? "";
    if (!source) throw new CliError("Bitte den Pfad zur alten Datenbank (letopia.sqlite) oder zum alten Website-Ordner angeben.");
    source = path.resolve(source);
    if (existsSync(source) && statSync(source).isDirectory()) source = path.join(source, "api", "storage", "letopia.sqlite");
    if (!existsSync(source)) throw new CliError(`Nicht gefunden: ${source}`);

    const legacy = new DatabaseSync(source, { readOnly: true });
    let rows: Record<string, unknown>[];
    try {
      rows = legacy.prepare("SELECT * FROM bewerbungen ORDER BY id").all() as Record<string, unknown>[];
    } catch {
      throw new CliError("In dieser Datei gibt es keine Tabelle „bewerbungen“ – ist das die Datenbank der alten Website?");
    } finally {
      legacy.close();
    }

    let imported = 0;
    let skipped = 0;
    transaction(() => {
      for (const r of rows) {
        const type = r.typ === "creator" ? "creator" : "team";
        const player = String(r.spielername ?? "").slice(0, 40);
        const created = Number(r.erstellt ?? 0) || Math.floor(Date.now() / 1000);
        if (!player || get("SELECT id FROM applications WHERE player_name = ? AND created_at = ?", player, created)) {
          skipped++;
          continue;
        }
        let answers: Answer[] = [];
        try {
          const parsed: unknown = JSON.parse(String(r.antworten ?? "[]"));
          if (Array.isArray(parsed)) {
            answers = parsed.map((a: Record<string, unknown>) => ({
              field: String(a.feld ?? ""),
              label: String(a.label ?? ""),
              value: String(a.wert ?? ""),
              long: Boolean(a.lang)
            }));
          }
        } catch {
          answers = [];
        }
        const status = String(r.status ?? "neu");
        createApplication({
          type: type as ApplicationType,
          player_name: player,
          discord: String(r.discord ?? ""),
          summary: String(r.kurz ?? ""),
          answers,
          created_at: created,
          status: isApplicationStatus(status) ? status : "neu",
          note: String(r.notiz ?? ""),
          handled_by: r.bearbeiter ? String(r.bearbeiter) : null,
          updated_at: r.geaendert ? Number(r.geaendert) : null
        });
        imported++;
      }
    });
    audit(CLI_ACTOR, "import.altdaten", path.basename(source), `${imported} übernommen, ${skipped} übersprungen`);
    console.log(`${imported} Bewerbung(en) übernommen, ${skipped} übersprungen (schon vorhanden oder leer).`);
  }
};

const run = async () => {
  const handler = commands[command] ?? (["help", "-h", "--help"].includes(command) ? commands.hilfe : undefined);
  if (!handler) {
    process.stderr.write(`Unbekannter Befehl „${command}“.\n\n${HELP}`);
    process.exitCode = 1;
    return;
  }
  try {
    await handler();
  } catch (error) {
    process.stderr.write(`Fehler: ${error instanceof CliError ? error.message : (error as Error).stack ?? String(error)}\n`);
    process.exitCode = 1;
  } finally {
    closeDatabase();
  }
};

await run();
