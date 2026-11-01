# Letopia Website

Website, Wiki und Admin-Panel des deutschen Minecraft-CityBuild-Servers **Letopia** – komplett in **Node.js und TypeScript**, mit eigener Datenbank, Admin-Panel und einem Installer, der einen frischen KVM-Server in wenigen Minuten einrichtet.

- **Website:** Startseite, Wiki (mit Suche und schneller Navigation), Custom Items, Crafting-Rezepte, Team, Regeln, Voten, Bewerbungen, Impressum/Datenschutz/AGB und beliebig viele eigene Seiten – alle Inhalte kommen aus der Datenbank und werden serverseitig gerendert.
- **Admin-Panel** unter `/admin`: Bewerbungen bearbeiten und im Team abstimmen, Wiki und Seiten mit Markdown-Editor und Live-Vorschau, Team, Items, Rezepte, Vote-Seiten, Bilder, Einstellungen, Benutzer mit Rollen, Zwei-Faktor-Schutz und ein Protokoll aller Änderungen.
- **Installer** für Debian/Ubuntu: Node.js, Build, Datenbank, Admin-Account, systemd-Dienst, Nginx, HTTPS und tägliche Backups in einem Durchlauf.

---

## Inhalt

1. [Installation auf einer KVM](#installation-auf-einer-kvm)
2. [Nach der Installation](#nach-der-installation)
3. [Der Befehl `letopia`](#der-befehl-letopia)
4. [Admin-Panel](#admin-panel)
5. [Inhalte schreiben (Markdown)](#inhalte-schreiben-markdown)
6. [Updates, Backups und Umzug](#updates-backups-und-umzug)
7. [Entwicklung](#entwicklung)
8. [Aufbau des Projekts](#aufbau-des-projekts)
9. [Konfiguration](#konfiguration)
10. [Schnittstellen (API)](#schnittstellen-api)
11. [Sicherheit](#sicherheit)
12. [Fehlersuche](#fehlersuche)

---

## Installation auf einer KVM

**Voraussetzungen**

- Server mit **Debian 11/12/13** oder **Ubuntu 20.04/22.04/24.04** (x86-64 oder ARM64), mind. 1 GB RAM
- Root-Zugang per SSH
- Optional eine **Domain**, deren A-Record (und ggf. `www`) auf die IP des Servers zeigt – dann gibt es automatisch HTTPS

**Installieren**

```bash
git clone https://github.com/PwiePixel/letopia-website.git
```

```bash
cd letopia-website && sudo bash install.sh
```

Der Installer fragt nach Domain, E-Mail (für das Zertifikat) und dem Namen des ersten Admin-Accounts. Lässt du das Passwort leer, wird ein sicheres erzeugt und am Ende angezeigt (zusätzlich in `/root/letopia-zugang.txt`).

Ohne Rückfragen, z. B. für Skripte:

```bash
sudo bash install.sh --domain letopia.net --email admin@letopia.net --admin PixelCST -y
```

Ist das Repository öffentlich, geht es auch in einer Zeile:

```bash
curl -fsSL https://raw.githubusercontent.com/PwiePixel/letopia-website/main/install.sh | sudo bash
```

**Was der Installer macht**

| Schritt | Ergebnis |
| --- | --- |
| Pakete | `git`, `curl`, `nginx`, bei Domain `certbot` |
| Node.js | offizielle LTS-Version (Standard: 24) nach `/opt/letopia/node`, Prüfsumme wird kontrolliert – das System-Node bleibt unberührt |
| Benutzer | Systembenutzer `letopia` ohne Login |
| Code & Build | Code nach `/opt/letopia/app`, `npm ci`, TypeScript-Build, danach werden die Build-Werkzeuge wieder entfernt |
| Daten | SQLite-Datenbank, Uploads und Backups in `/var/lib/letopia` – beim ersten Start werden alle bisherigen Inhalte (Wiki, Regeln, Team, Items, Rezepte, Rechtstexte) übernommen |
| Konfiguration | `/etc/letopia/letopia.env` |
| Dienst | systemd-Dienst `letopia` mit Sandbox-Härtung, startet automatisch und nach Abstürzen neu |
| Webserver | Nginx als Reverse-Proxy mit gzip und Browser-Caching, statische Dateien direkt von der Platte |
| HTTPS | Let's-Encrypt-Zertifikat mit automatischer Verlängerung und Weiterleitung auf https |
| Firewall | ist `ufw` aktiv, werden Port 80 und 443 freigegeben |
| Backups | täglich um 03:30 Uhr, die letzten 14 bleiben erhalten |

Eine Neuinstallation dauert je nach Server etwa 1–2 Minuten. Den Installer erneut auszuführen ist gefahrlos: Er erkennt die bestehende Installation und macht ein Update – Konfiguration, Daten und Accounts bleiben erhalten.

> Hat der Anbieter eine eigene Firewall im Kundenpanel (z. B. Hetzner, Netcup, Contabo), dort Port 80 und 443 freigeben.

## Nach der Installation

1. `https://deine-domain/admin` öffnen und mit den angezeigten Zugangsdaten anmelden. Bei einem erzeugten Passwort musst du direkt ein eigenes vergeben.
2. Unter **Profil** die Zwei-Faktor-Anmeldung einschalten (empfohlen).
3. Unter **Einstellungen** Server-Adresse, Discord-/Shop-/TikTok-/YouTube-Links und die Zahlen der Startseite eintragen, optional den Discord-Webhook für neue Bewerbungen.
4. Unter **Regeln & Seiten** Impressum, Datenschutz und AGB ausfüllen – alle gelb umrandeten `{{Platzhalter}}` ersetzen.
5. Weitere Teammitglieder unter **Benutzer** anlegen.
6. `/root/letopia-zugang.txt` löschen.

## Der Befehl `letopia`

| Befehl | Wofür |
| --- | --- |
| `letopia status` | Zustand von App, Nginx und nächstem Backup |
| `letopia logs` / `letopia logs -f` | Server-Log ansehen / live mitlesen |
| `letopia restart` | App neu starten (`start`, `stop` gibt es auch) |
| `letopia update` | Neueste Version von GitHub holen, bauen, Datenbank anpassen, neu starten |
| `letopia config` | Konfiguration bearbeiten, danach automatischer Neustart |
| `letopia admin liste` | Alle Admin-Accounts anzeigen |
| `letopia admin neu <name> [rolle]` | Account anlegen (`admin`, `editor`, `moderator`) |
| `letopia admin passwort <name>` | Neues Passwort erzeugen – falls jemand seins vergessen hat |
| `letopia admin 2fa-aus <name>` | Zwei-Faktor-Schutz abschalten – falls das Handy weg ist |
| `letopia backup` / `letopia backups` | Backup jetzt erstellen / vorhandene anzeigen |
| `letopia restore <datei>` | Backup zurückspielen (der aktuelle Stand wird vorher gesichert) |
| `letopia import <pfad>` | Bewerbungen der alten PHP-Website übernehmen |
| `letopia ssl [domain] [email]` | HTTPS-Zertifikat (neu) anfordern, z. B. wenn die Domain später dazukommt |
| `letopia uninstall` | Website vom Server entfernen (Daten auf Wunsch behalten) |

## Admin-Panel

| Bereich | Möglichkeiten |
| --- | --- |
| **Übersicht** | neue Bewerbungen, Online-Status des Minecraft-Servers, letzte Aktivität, Schnellzugriff |
| **Bewerbungen** | Filter nach Status/Art, Suche, Status setzen, interne Notizen, **Team-Abstimmung** (dafür/dagegen mit Begründung), CSV-Export, automatisches Löschen nach Ablauf der Aufbewahrungsfrist |
| **Wiki** | Kategorien mit Icons, Artikel mit Markdown-Editor, Live-Vorschau, Bild-Einfügen, Entwürfe, Reihenfolge per Pfeil |
| **Regeln & Seiten** | Regeln, Impressum, Datenschutz, AGB und eigene Seiten (`/deine-seite`), Hintergrund-Szene wählbar |
| **Team** | Bereiche mit Farbe, Mitglieder mit Minecraft-Kopf, Rolle, „im Team seit“ |
| **Custom Items** | Seltenheit, Typ, Lore, Herkunft, Pixel-Icon mit Live-Vorschau |
| **Rezepte** | 3×3-Werkbank mit Live-Vorschau, Zutaten verwalten und mit Items verknüpfen |
| **Voten** | Vote-Seiten mit Link und Belohnung, Vote-Serien, Text für den Monatsbesten |
| **Medien** | Bilder hochladen (PNG, JPG, GIF, WebP) und per Markdown einbinden |
| **Einstellungen** | Server-Adresse und Ports, Online-Anzeige, Links, Zahlen der Startseite, Hinweis-Banner, Bewerbungsphasen öffnen/schließen, Positionen und Voraussetzungen, Discord-Webhook, Backups |
| **Benutzer** | Accounts anlegen, Rollen vergeben, deaktivieren, Passwort zurücksetzen, überall abmelden |
| **Protokoll** | Wer hat wann was geändert |
| **Profil** | Passwort ändern, Zwei-Faktor-Schutz per QR-Code, angemeldete Geräte |

**Rollen**

- **Administrator** – alles, inklusive Benutzer und Einstellungen
- **Redaktion** – Wiki, Regeln & Seiten, Team, Items, Rezepte, Voten, Medien
- **Bewerbungen** – nur Bewerbungen ansehen, bewerten und bearbeiten

## Inhalte schreiben (Markdown)

Wiki-Artikel, Regeln und Seiten werden in Markdown geschrieben. Der Editor hat Buttons für alles Wichtige und zeigt rechts die Vorschau.

| Eingabe | Ergebnis |
| --- | --- |
| `## Überschrift` / `### Unterüberschrift` | Abschnitte, landen im Inhaltsverzeichnis |
| `**fett**`, `*kursiv*`, `==markiert==` | Hervorhebungen |
| `` `/p auto` `` | Befehl, auf der Website per Klick kopierbar |
| `[[grundstuecke]]` / `[[grundstuecke\|eigener Text]]` | Link auf einen Wiki-Artikel |
| `[Text](https://…)` | normaler Link |
| `![Beschreibung](/uploads/bild.png)` | Bild (hochladen unter „Medien“) |
| `> [!TIPP]`, `> [!INFO]`, `> [!ACHTUNG]` | Hinweis-Box, Text in den folgenden `>`-Zeilen |
| `{{Platzhalter}}` | gelb umrandeter Platzhalter, z. B. im Impressum |
| Tabellen, Listen, Code-Blöcke | wie gewohnt |

## Updates, Backups und Umzug

**Update**

```bash
letopia update
```

Holt den neuesten Stand von GitHub (`main`), installiert Abhängigkeiten, baut neu, passt die Datenbank an und startet die App neu. Die Website ist dabei nur wenige Sekunden weg.

**Backups** liegen in `/var/lib/letopia/backups` (Datenbank + hochgeladene Bilder als `.tar.gz`). Zusätzlich kannst du im Admin-Panel unter *Einstellungen → System & Backups* ein Backup anlegen und herunterladen. Für echte Sicherheit die Backups regelmäßig auch auf einen anderen Rechner kopieren.

```bash
letopia restore letopia-20261101-033000.tar.gz
```

**Umzug von der alten PHP-Website:** Wiki, Regeln, Team, Items, Rezepte und Rechtstexte der alten Seite sind bereits enthalten und landen bei der Installation automatisch in der Datenbank. Bewerbungen aus der alten Datenbank holst du so herüber (Datei `api/storage/letopia.sqlite` der alten Seite auf den Server kopieren):

```bash
letopia import /root/letopia.sqlite
```

Alte Adressen wie `/wiki.html#/grundstuecke`, `/regeln.html` oder `/admin/index.php` werden automatisch auf die neuen umgeleitet – Links in Discord & Co. funktionieren also weiter.

## Entwicklung

Voraussetzung: **Node.js 22.13 oder neuer** (empfohlen 24 LTS).

```bash
npm install
```

```bash
npm run dev
```

Startet den Server auf <http://localhost:3000> und baut Server und Browser-Skripte bei jeder Änderung neu. Beim ersten Start wird die Datenbank in `./data` angelegt. Den ersten Admin-Account legst du unter `/admin` an – den Einrichtungscode zeigt das Terminal – oder direkt:

```bash
npm run cli -- user:create DeinName
```

| Befehl | Wofür |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit automatischem Neustart |
| `npm run build` | Produktions-Build nach `dist/` und `public/assets/js/` |
| `npm start` | gebaute Version starten |
| `npm test` | alle Tests (Markdown, Sicherheit, Validierung, API, Admin-Login, CSRF …) |
| `npm run typecheck` | TypeScript-Prüfung von Server und Browser-Code |
| `npm run cli -- hilfe` | Kommandozeile (Benutzer, Backups, Import) |

## Aufbau des Projekts

```
├── install.sh               Installer für Debian/Ubuntu
├── deploy/letopia           Verwaltungsbefehl (wird nach /usr/local/bin kopiert)
├── content/                 Startinhalte (werden beim ersten Start importiert)
├── public/assets/           CSS, Schriften, Bilder (Browser-Skripte werden hierhin gebaut)
├── src/
│   ├── server/
│   │   ├── index.ts         Start, Wartungsaufgaben, sauberes Beenden
│   │   ├── app.tsx          Hono-App: Sicherheits-Header, statische Dateien, Routen
│   │   ├── cli.ts           Kommandozeile
│   │   ├── db/              SQLite (node:sqlite), Migrationen, Import der Startinhalte
│   │   ├── repo/            Datenzugriff (Wiki, Seiten, Team, Items, Bewerbungen, Benutzer …)
│   │   ├── lib/             Markdown, Sicherheit (scrypt, TOTP), Validierung, Bilderkennung
│   │   ├── services/        Minecraft-Status, Spielerköpfe, Discord, Backups
│   │   ├── routes/          öffentliche Seiten, API, Admin-Panel
│   │   └── views/           TSX-Vorlagen für Website und Admin-Panel
│   ├── client/              Browser-Skripte (TypeScript, gebündelt mit esbuild)
│   └── shared/              gemeinsam genutzt: Pixel-Icons, Auswahllisten
└── test/                    automatische Tests (node:test)
```

**Technik:** [Hono](https://hono.dev) als Web-Framework mit serverseitigem JSX, SQLite über das in Node eingebaute `node:sqlite` (keine nativen Module → schnelle, robuste Installation), Passwort-Hashing mit scrypt, esbuild für die Browser-Skripte. Zur Laufzeit gibt es nur drei Abhängigkeiten: `hono`, `@hono/node-server` und `uqr` (QR-Codes für die 2FA).

## Konfiguration

Auf dem Server in `/etc/letopia/letopia.env`, lokal in `.env` (Vorlage: `.env.example`).

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Adresse, auf der die App lauscht |
| `PORT` | `3000` | Port der App |
| `SITE_URL` | – | öffentliche Adresse, z. B. `https://letopia.net` (für Links in Discord-Nachrichten, Sitemap, Vorschaubilder) |
| `DATA_DIR` | `./data` | Datenbank, Uploads, Cache, Backups |
| `TRUST_PROXY` | `false` | `true` hinter Nginx (echte Besucher-IP und HTTPS-Erkennung) |
| `NODE_ENV` | `development` | `production` auf dem Server |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `MAX_UPLOAD_MB` | `8` | maximale Größe pro Bild |

Alles andere (Server-Adresse, Links, Zahlen, Bewerbungen, Webhook …) wird im Admin-Panel eingestellt.

## Schnittstellen (API)

Alle Antworten im JSON-Format, z. B. für einen Discord-Bot oder ein Plugin.

| Methode | Adresse | Inhalt |
| --- | --- | --- |
| GET | `/api/status` | Online-Status und Spielerzahl (60 s zwischengespeichert) |
| GET | `/api/info` | Server-Adresse, Ports, Links, offene Bewerbungsphasen |
| GET | `/api/wiki` · `/api/wiki/<artikel>` | Wiki-Übersicht bzw. ein Artikel als Markdown |
| GET | `/api/items` · `/api/rezepte` · `/api/team` · `/api/voten` | Inhalte der jeweiligen Seite |
| GET | `/api/kopf/<name>` | Minecraft-Kopf (PNG, 24 h zwischengespeichert) |
| POST | `/api/bewerbungen` | neue Bewerbung (wird vom Formular genutzt) |

## Sicherheit

- Passwörter mit **scrypt** gehasht, Login-Sperre nach mehreren Fehlversuchen (pro IP und pro Name)
- Optionale **Zwei-Faktor-Anmeldung** (TOTP, kompatibel mit allen gängigen Authenticator-Apps)
- Sitzungen serverseitig in der Datenbank, Cookies `HttpOnly`/`SameSite`/`Secure` (bei HTTPS)
- **CSRF-Schutz** für alle Formulare im Admin-Panel, Prüfung der Herkunft bei allen POST-Anfragen
- Strenge **Content-Security-Policy**, `X-Frame-Options`, HSTS (bei HTTPS)
- Markdown wird vollständig escaped, gefährliche Links (`javascript:` usw.) werden entschärft
- Uploads werden am Dateiinhalt erkannt (kein SVG), ausgeliefert mit eigener Sandbox-CSP
- IP-Adressen für die Bewerbungs-Begrenzung werden nur als Hash gespeichert
- Die App läuft als eigener Benutzer in einer systemd-Sandbox und darf nur in `/var/lib/letopia` schreiben
- Ersteinrichtung des Admin-Panels nur mit Einrichtungscode aus dem Server-Log

## Fehlersuche

| Problem | Lösung |
| --- | --- |
| Website nicht erreichbar | `letopia status`, dann `letopia logs`. Firewall beim Anbieter prüfen (Port 80/443). |
| HTTPS fehlgeschlagen | Zeigt der A-Record der Domain auf den Server? Dann `letopia ssl deine-domain.de` |
| Passwort vergessen | `letopia admin passwort <name>` |
| Authenticator-Handy verloren | `letopia admin 2fa-aus <name>` |
| Online-Anzeige zeigt „–“ | Server-Adresse und Java-Port unter *Einstellungen* prüfen, dort „Status jetzt prüfen“ |
| Discord bekommt keine Nachrichten | Webhook unter *Einstellungen → Bewerbungen* eintragen und „Test-Nachricht senden“ |
| Installer bricht ab | Meldung lesen, Ursache beheben und `sudo bash install.sh` einfach erneut starten |

---

Letopia ist kein offizielles Minecraft-Produkt und steht in keiner Verbindung zu Mojang AB oder Microsoft.
