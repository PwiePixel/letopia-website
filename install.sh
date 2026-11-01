#!/usr/bin/env bash
# shellcheck disable=SC1111  # deutsche Anführungszeichen („…“) in Meldungen sind gewollt
# ==============================================================================
#  Letopia Website – Installer für Debian / Ubuntu (KVM, vServer, Root-Server)
#
#  Schnellstart (als root bzw. mit sudo):
#    git clone https://github.com/PwiePixel/letopia-website.git
#    cd letopia-website && sudo bash install.sh
#
#  Ohne Rückfragen:
#    sudo bash install.sh --domain letopia.net --email admin@letopia.net --admin PixelCST -y
#
#  Erneut ausführen = Update (Konfiguration, Daten und Accounts bleiben erhalten).
#  Alle Optionen: sudo bash install.sh --hilfe
# ==============================================================================
set -Eeuo pipefail
umask 022

REPO_URL="${LETOPIA_REPO:-https://github.com/PwiePixel/letopia-website.git}"
BRANCH="${LETOPIA_BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-24}"

INSTALL_DIR="/opt/letopia"
APP_DIR="$INSTALL_DIR/app"
NODE_DIR="$INSTALL_DIR/node"
DATA_DIR="/var/lib/letopia"
CONF_DIR="/etc/letopia"
ENV_FILE="$CONF_DIR/letopia.env"
SERVICE="letopia"
SERVICE_USER="letopia"
CREDENTIALS_FILE="/root/letopia-zugang.txt"

DOMAIN="${LETOPIA_DOMAIN:-}"
EMAIL="${LETOPIA_EMAIL:-}"
ADMIN_USER="${LETOPIA_ADMIN:-}"
ADMIN_PASS="${LETOPIA_ADMIN_PASSWORD:-}"
APP_PORT="${LETOPIA_PORT:-3000}"
WITH_NGINX=1
WITH_SSL=1
ASSUME_YES=0
MODE="install"
PULL=1
REEXEC=0

# --- Ausgabe -----------------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\e[0m'; C_BOLD=$'\e[1m'; C_DIM=$'\e[2m'; C_ORANGE=$'\e[38;5;214m'; C_GREEN=$'\e[32m'; C_RED=$'\e[31m'; C_YELLOW=$'\e[33m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_ORANGE=""; C_GREEN=""; C_RED=""; C_YELLOW=""
fi
STEP=0
STARTED=$(date +%s)
step() { STEP=$((STEP + 1)); printf '\n%s[%s]%s %s%s%s\n' "$C_ORANGE" "$STEP" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    %s✔%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '    %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '\n%s✖ %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }
trap 'die "Abbruch in Zeile $LINENO (Befehl: $BASH_COMMAND). Details stehen oben – der Installer kann gefahrlos erneut gestartet werden."' ERR

usage() {
  cat <<EOF
Letopia Installer

Optionen:
  --domain <name>          Domain der Website (z. B. letopia.net). Ohne Domain läuft die Seite über die IP.
  --email <adresse>        E-Mail für Let's-Encrypt-Benachrichtigungen (optional)
  --admin <name>           Name des ersten Admin-Accounts (Standard: admin)
  --admin-password <pw>    Passwort dafür (Standard: wird sicher erzeugt)
  --port <nummer>          Interner Port der Node-App (Standard: 3000)
  --no-ssl                 Kein HTTPS-Zertifikat anfordern
  --no-nginx               Nginx nicht einrichten (App lauscht dann nur lokal)
  --update                 Nur aktualisieren (Code, Abhängigkeiten, Datenbank, Neustart)
  --no-pull                Beim Update keinen neuen Code holen
  -y, --yes                Keine Rückfragen, Standardwerte verwenden
  -h, --hilfe              Diese Hilfe

Umgebungsvariablen: LETOPIA_REPO, LETOPIA_BRANCH, NODE_MAJOR (Standard 24)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --admin) ADMIN_USER="${2:-}"; shift 2 ;;
    --admin-password) ADMIN_PASS="${2:-}"; shift 2 ;;
    --port) APP_PORT="${2:-}"; shift 2 ;;
    --no-ssl) WITH_SSL=0; shift ;;
    --no-nginx) WITH_NGINX=0; WITH_SSL=0; shift ;;
    --update) MODE="update"; shift ;;
    --no-pull) PULL=0; shift ;;
    --reexec) REEXEC=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help|--hilfe) usage; exit 0 ;;
    *) die "Unbekannte Option: $1 (Hilfe: --hilfe)" ;;
  esac
done

# --- Hilfsfunktionen ---------------------------------------------------------------------------------
TTY_IN=""
if [[ -r /dev/tty ]] && { : < /dev/tty; } 2>/dev/null; then TTY_IN="/dev/tty"; fi

ask() { # ask <variable> <frage> <standard>
  local __var="$1" __question="$2" __default="${3:-}" __answer=""
  if [[ $ASSUME_YES -eq 1 || -z "$TTY_IN" ]]; then printf -v "$__var" '%s' "$__default"; return; fi
  if [[ -n "$__default" ]]; then printf '    %s %s[%s]%s: ' "$__question" "$C_DIM" "$__default" "$C_RESET"; else printf '    %s: ' "$__question"; fi
  IFS= read -r __answer < "$TTY_IN" || true
  printf -v "$__var" '%s' "${__answer:-$__default}"
}

ask_secret() { # ask_secret <variable> <frage>
  local __var="$1" __question="$2" __answer=""
  if [[ $ASSUME_YES -eq 1 || -z "$TTY_IN" ]]; then printf -v "$__var" '%s' ""; return; fi
  printf '    %s: ' "$__question"
  IFS= read -rs __answer < "$TTY_IN" || true
  printf '\n'
  printf -v "$__var" '%s' "$__answer"
}

APP_HOME="$INSTALL_DIR/.home"
as_app() { runuser -u "$SERVICE_USER" -- env HOME="$APP_HOME" npm_config_cache="$APP_HOME/.npm" PATH="$NODE_DIR/bin:/usr/local/bin:/usr/bin:/bin" "$@"; }

cli() { as_app env LETOPIA_ENV_FILE="$ENV_FILE" node --disable-warning=ExperimentalWarning "$APP_DIR/dist/server/cli.js" "$@"; }

have_systemd() { [[ -d /run/systemd/system ]]; }

env_value() { [[ -f "$ENV_FILE" ]] && sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 || true; }

set_env() { # set_env KEY VALUE
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"; fi
}

port_in_use() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }

public_ip() {
  local ip
  ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')
  [[ -n "$ip" ]] || ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  printf '%s' "${ip:-127.0.0.1}"
}

# --- Voraussetzungen -----------------------------------------------------------------------------------
[[ $EUID -eq 0 ]] || die "Bitte als root ausführen: sudo bash install.sh"
[[ -r /etc/os-release ]] || die "Unbekanntes Betriebssystem."
# shellcheck disable=SC1091
. /etc/os-release
if [[ "${ID:-}" != "debian" && "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *debian* ]]; then
  die "Dieser Installer unterstützt Debian (11+) und Ubuntu (20.04+). Gefunden: ${PRETTY_NAME:-unbekannt}"
fi
case "$(uname -m)" in
  x86_64|amd64) NODE_ARCH="x64" ;;
  aarch64|arm64) NODE_ARCH="arm64" ;;
  *) die "Nicht unterstützte Prozessor-Architektur: $(uname -m)" ;;
esac

if [[ "$MODE" == "install" && -f "$ENV_FILE" && -d "$APP_DIR" ]]; then
  MODE="update"
fi

if [[ $REEXEC -eq 0 ]]; then
  printf '\n%s  ██╗     ███████╗████████╗ ██████╗ ██████╗ ██╗ █████╗%s\n' "$C_ORANGE" "$C_RESET"
  printf '%s  ██║     ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██║██╔══██╗%s\n' "$C_ORANGE" "$C_RESET"
  printf '%s  ██║     █████╗     ██║   ██║   ██║██████╔╝██║███████║%s\n' "$C_ORANGE" "$C_RESET"
  printf '%s  ██║     ██╔══╝     ██║   ██║   ██║██╔═══╝ ██║██╔══██║%s\n' "$C_ORANGE" "$C_RESET"
  printf '%s  ███████╗███████╗   ██║   ╚██████╔╝██║     ██║██║  ██║%s\n' "$C_ORANGE" "$C_RESET"
  printf '%s  ╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝%s\n' "$C_ORANGE" "$C_RESET"
  if [[ "$MODE" == "update" ]]; then printf '  %sUpdate der bestehenden Installation%s\n' "$C_DIM" "$C_RESET"; else printf '  %sInstallation auf %s%s\n' "$C_DIM" "${PRETTY_NAME:-Linux}" "$C_RESET"; fi
fi

# --- Fragen (nur Neuinstallation) -------------------------------------------------------------------------
if [[ "$MODE" == "install" ]]; then
  step "Ein paar Fragen vorab (Enter = Vorschlag übernehmen)"
  [[ -n "$DOMAIN" ]] || ask DOMAIN "Domain der Website (leer = nur über IP-Adresse)" ""
  DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"; DOMAIN="${DOMAIN,,}"
  if [[ -n "$DOMAIN" && ! "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
    die "„$DOMAIN“ ist keine gültige Domain."
  fi
  if [[ -n "$DOMAIN" && $WITH_SSL -eq 1 && -z "$EMAIL" ]]; then
    ask EMAIL "E-Mail für das HTTPS-Zertifikat (Let's Encrypt, optional)" ""
  fi
  [[ -n "$ADMIN_USER" ]] || ask ADMIN_USER "Name des Admin-Accounts" "admin"
  [[ "$ADMIN_USER" =~ ^[A-Za-z0-9_.-]{3,32}$ ]] || die "Der Admin-Name darf 3–32 Zeichen lang sein (Buchstaben, Zahlen, . _ -)."
  if [[ -z "$ADMIN_PASS" ]]; then
    ask_secret ADMIN_PASS "Passwort für $ADMIN_USER (leer = sicheres Passwort erzeugen)"
    if [[ -n "$ADMIN_PASS" ]]; then
      ask_secret ADMIN_PASS2 "Passwort wiederholen"
      [[ "$ADMIN_PASS" == "${ADMIN_PASS2:-}" ]] || die "Die Passwörter stimmen nicht überein."
    fi
  fi
  if [[ -n "$ADMIN_PASS" && ${#ADMIN_PASS} -lt 10 ]]; then die "Das Admin-Passwort muss mindestens 10 Zeichen haben."; fi
  [[ "$APP_PORT" =~ ^[0-9]+$ ]] || die "Ungültiger Port: $APP_PORT"
  while port_in_use "$APP_PORT"; do APP_PORT=$((APP_PORT + 1)); done
  ok "Domain: ${DOMAIN:-keine (Zugriff über IP)} · Admin: $ADMIN_USER · interner Port: $APP_PORT"
fi

# --- Pakete & Node.js (parallel) -----------------------------------------------------------------------------
step "Systempakete und Node.js $NODE_MAJOR"
WORK_DIR=$(mktemp -d)
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

need_node=1
if [[ -x "$NODE_DIR/bin/node" ]]; then
  current=$("$NODE_DIR/bin/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  [[ "$current" == "$NODE_MAJOR" ]] && need_node=0
fi

fetch_node() {
  local base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  curl -fsSL --retry 3 "$base/SHASUMS256.txt" -o "$WORK_DIR/SHASUMS256.txt"
  local file
  file=$(grep -oE "node-v[0-9.]+-linux-${NODE_ARCH}\.tar\.xz" "$WORK_DIR/SHASUMS256.txt" | head -n1)
  [[ -n "$file" ]] || return 1
  curl -fsSL --retry 3 "$base/$file" -o "$WORK_DIR/$file"
  (cd "$WORK_DIR" && grep " $file\$" SHASUMS256.txt | sha256sum -c --status) || return 2
  printf '%s' "$file" > "$WORK_DIR/node-file"
}

node_pid=""
if [[ $need_node -eq 1 ]] && command -v curl >/dev/null 2>&1 && command -v xz >/dev/null 2>&1; then
  fetch_node > "$WORK_DIR/node.log" 2>&1 &
  node_pid=$!
fi

export DEBIAN_FRONTEND=noninteractive
packages=(ca-certificates curl git tar xz-utils iproute2)
[[ $WITH_NGINX -eq 1 ]] && packages+=(nginx)
[[ $WITH_NGINX -eq 1 && $WITH_SSL -eq 1 && -n "$DOMAIN$(env_value LETOPIA_DOMAIN)" ]] && packages+=(certbot python3-certbot-nginx)
missing=()
for p in "${packages[@]}"; do dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "install ok installed" || missing+=("$p"); done
if [[ ${#missing[@]} -gt 0 ]]; then
  info "Installiere: ${missing[*]}"
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends "${missing[@]}" > /dev/null
fi
ok "Systempakete sind installiert"

if [[ $need_node -eq 1 ]]; then
  if [[ -n "$node_pid" ]]; then wait "$node_pid" || true; fi
  if [[ ! -s "$WORK_DIR/node-file" ]]; then fetch_node > "$WORK_DIR/node.log" 2>&1 || { cat "$WORK_DIR/node.log" >&2; die "Node.js konnte nicht heruntergeladen oder geprüft werden."; }; fi
  node_file=$(cat "$WORK_DIR/node-file")
  rm -rf "$NODE_DIR.new"
  mkdir -p "$NODE_DIR.new"
  tar -xJf "$WORK_DIR/$node_file" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR"
  mv "$NODE_DIR.new" "$NODE_DIR"
  ok "Node.js $("$NODE_DIR/bin/node" -v) installiert (Prüfsumme bestätigt)"
else
  ok "Node.js $("$NODE_DIR/bin/node" -v) ist aktuell"
fi

# --- Benutzer & Ordner ----------------------------------------------------------------------------------------
step "Systembenutzer und Ordner"
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
  ok "Benutzer „$SERVICE_USER“ angelegt"
else
  ok "Benutzer „$SERVICE_USER“ vorhanden"
fi
install -d -m 755 -o root -g root "$INSTALL_DIR"
install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$DATA_DIR"
install -d -m 750 -o root -g "$SERVICE_USER" "$CONF_DIR"
install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$APP_HOME"
chown -R root:root "$NODE_DIR"
ok "$INSTALL_DIR (Programm) · $DATA_DIR (Daten) · $CONF_DIR (Konfiguration)"

# --- Programmcode ----------------------------------------------------------------------------------------------
step "Programmcode"
SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); fi
from_checkout=0
if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/package.json" ]] && grep -q '"name": "letopia-website"' "$SCRIPT_DIR/package.json" && [[ "$SCRIPT_DIR" != "$APP_DIR" ]]; then
  from_checkout=1
fi

git_app() { runuser -u "$SERVICE_USER" -- env HOME="$APP_HOME" git -c safe.directory="$APP_DIR" -C "$APP_DIR" "$@"; }

if [[ $from_checkout -eq 1 && $PULL -eq 1 ]]; then
  info "Übernehme den Code aus $SCRIPT_DIR"
  mkdir -p "$APP_DIR"
  tar -C "$SCRIPT_DIR" --exclude=./node_modules --exclude=./dist --exclude=./data --exclude=./public/assets/js -cf - . | tar -C "$APP_DIR" -xf -
  chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
  ok "Code kopiert"
elif [[ -d "$APP_DIR/.git" ]]; then
  chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
  if [[ $PULL -eq 1 ]]; then
    before=$(git_app rev-parse --short HEAD 2>/dev/null || echo "?")
    if git_app pull --ff-only --quiet; then
      ok "Code aktualisiert ($before → $(git_app rev-parse --short HEAD))"
    else
      warn "git pull fehlgeschlagen – es wird mit dem vorhandenen Code weitergemacht."
    fi
  else
    ok "Code bleibt auf Stand $(git_app rev-parse --short HEAD 2>/dev/null || echo "?")"
  fi
elif [[ -f "$APP_DIR/package.json" ]]; then
  chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
  ok "Vorhandener Code in $APP_DIR wird verwendet"
else
  info "Lade $REPO_URL ($BRANCH)"
  rm -rf "$APP_DIR"
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR" || die "Download fehlgeschlagen. Ist das Repository privat? Dann zuerst klonen und install.sh aus dem Ordner starten."
  chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
  ok "Code geladen"
fi

# Wurde der Installer selbst aktualisiert? Dann mit der neuen Version weitermachen.
if [[ "$MODE" == "update" && $REEXEC -eq 0 && -f "$APP_DIR/install.sh" && -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]] && ! cmp -s "${BASH_SOURCE[0]}" "$APP_DIR/install.sh"; then
  info "Neue Installer-Version gefunden – starte sie."
  cp "$APP_DIR/install.sh" "$WORK_DIR/install.sh"
  args=(--update --no-pull --reexec)
  [[ $ASSUME_YES -eq 1 ]] && args+=(-y)
  exec bash "$WORK_DIR/install.sh" "${args[@]}"
fi

# --- Abhängigkeiten & Build ------------------------------------------------------------------------------------------
step "Abhängigkeiten installieren und bauen"
cd "$APP_DIR"
as_app npm ci --no-audit --no-fund --loglevel=error > "$WORK_DIR/npm.log" 2>&1 || { tail -n 30 "$WORK_DIR/npm.log" >&2; die "npm ci ist fehlgeschlagen."; }
ok "npm-Pakete installiert"
as_app npm run --silent build > "$WORK_DIR/build.log" 2>&1 || { tail -n 30 "$WORK_DIR/build.log" >&2; die "Der Build ist fehlgeschlagen."; }
ok "TypeScript kompiliert, Browser-Skripte gebaut"
as_app npm prune --omit=dev --no-audit --no-fund --loglevel=error > /dev/null 2>&1 || true
ok "Entwicklungswerkzeuge wieder entfernt"

# --- Konfiguration -------------------------------------------------------------------------------------------------
step "Konfiguration"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -n "$DOMAIN" ]]; then site_url="http://$DOMAIN"; else site_url="http://$(public_ip)"; fi
  cat > "$ENV_FILE" <<EOF
# Letopia – Konfiguration (Änderungen danach mit: letopia restart)
NODE_ENV=production
HOST=127.0.0.1
PORT=$APP_PORT
SITE_URL=$site_url
DATA_DIR=$DATA_DIR
TRUST_PROXY=$([[ $WITH_NGINX -eq 1 ]] && echo true || echo false)
LOG_LEVEL=info
MAX_UPLOAD_MB=8
LETOPIA_DOMAIN=$DOMAIN
EOF
  ok "$ENV_FILE angelegt"
else
  ok "$ENV_FILE bleibt unverändert"
fi
chown root:"$SERVICE_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"
APP_PORT=$(env_value PORT); APP_PORT=${APP_PORT:-3000}
DOMAIN=${DOMAIN:-$(env_value LETOPIA_DOMAIN)}

# --- Datenbank & Admin -----------------------------------------------------------------------------------------------
step "Datenbank"
cli migrate | sed 's/^/    /'
CREATED_PASSWORD=""
if [[ "$(cli user:list --count)" == "0" ]]; then
  ADMIN_USER=${ADMIN_USER:-admin}
  if [[ -n "$ADMIN_PASS" ]]; then
    printf '%s' "$ADMIN_PASS" | cli user:create "$ADMIN_USER" --role admin --password-stdin | sed 's/^/    /'
  else
    out=$(cli user:create "$ADMIN_USER" --role admin)
    CREATED_PASSWORD=$(printf '%s\n' "$out" | sed -n 's/^Passwort: //p')
    printf '%s\n' "$out" | grep -v '^Passwort:' | grep -v '^(Beim' | sed 's/^/    /'
  fi
  ok "Admin-Account „$ADMIN_USER“ angelegt"
else
  ok "Admin-Accounts vorhanden – keine Änderung"
fi

# --- Dienst ------------------------------------------------------------------------------------------------------------
step "Systemdienst"
cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=Letopia Website (Node.js)
Documentation=https://github.com/PwiePixel/letopia-website
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_DIR/bin/node --disable-warning=ExperimentalWarning $APP_DIR/dist/server/index.js
Restart=always
RestartSec=3
TimeoutStopSec=15
UMask=0027
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictSUIDSGID=true
RestrictRealtime=true
RestrictNamespaces=true
LockPersonality=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
SystemCallArchitectures=native
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/$SERVICE-backup.service <<EOF
[Unit]
Description=Letopia Backup (Datenbank + Uploads)

[Service]
Type=oneshot
User=$SERVICE_USER
Group=$SERVICE_USER
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_DIR/bin/node --disable-warning=ExperimentalWarning $APP_DIR/dist/server/cli.js backup --keep 14
EOF

cat > /etc/systemd/system/$SERVICE-backup.timer <<EOF
[Unit]
Description=Tägliches Letopia-Backup

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=20min
Persistent=true

[Install]
WantedBy=timers.target
EOF

install -m 755 "$APP_DIR/deploy/letopia" /usr/local/bin/letopia

if have_systemd; then
  systemctl daemon-reload
  systemctl enable --now "$SERVICE-backup.timer" > /dev/null 2>&1 || warn "Backup-Timer konnte nicht aktiviert werden."
  systemctl enable "$SERVICE" > /dev/null 2>&1
  systemctl restart "$SERVICE"
  healthy=0
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$APP_PORT/healthz" > /dev/null 2>&1; then healthy=1; break; fi
    sleep 0.5
  done
  if [[ $healthy -eq 1 ]]; then ok "Dienst „$SERVICE“ läuft (startet automatisch nach einem Neustart)"; else
    journalctl -u "$SERVICE" -n 30 --no-pager >&2 || true
    die "Die App antwortet nicht. Log ansehen mit: journalctl -u $SERVICE -e"
  fi
  ok "Tägliches Backup um 03:30 Uhr (die letzten 14 bleiben in $DATA_DIR/backups)"
else
  warn "systemd läuft hier nicht (Container?). Start manuell mit:"
  warn "  sudo -u $SERVICE_USER env \$(cat $ENV_FILE | grep -v '^#' | xargs) $NODE_DIR/bin/node $APP_DIR/dist/server/index.js"
fi

# --- Nginx & HTTPS -------------------------------------------------------------------------------------------------------
if [[ $WITH_NGINX -eq 1 && "$MODE" == "install" ]]; then
  step "Webserver (Nginx)"
  names="$DOMAIN"
  if [[ -n "$DOMAIN" && "$DOMAIN" != www.* ]]; then names="$DOMAIN www.$DOMAIN"; fi
  listen6=""
  [[ -f /proc/net/if_inet6 ]] && listen6="listen [::]:80;"
  default_flag=""
  if [[ -z "$DOMAIN" ]]; then
    default_flag=" default_server"
    [[ -n "$listen6" ]] && listen6="listen [::]:80 default_server;"
    rm -f /etc/nginx/sites-enabled/default
  fi
  cat > /etc/nginx/sites-available/letopia.conf <<EOF
# Letopia – erzeugt vom Installer. Eigene Anpassungen bleiben bei Updates erhalten.
map \$arg_v \$letopia_asset_cache {
    ""      "public, max-age=604800";
    default "public, max-age=31536000, immutable";
}

upstream letopia_app {
    server 127.0.0.1:$APP_PORT;
    keepalive 16;
}

server {
    listen 80$default_flag;
    $listen6
    server_name ${names:-_};

    server_tokens off;
    client_max_body_size 100m;

    gzip on;
    gzip_vary on;
    gzip_comp_level 5;
    gzip_min_length 512;
    gzip_types text/css application/javascript application/json image/svg+xml text/plain application/xml;

    # Statische Dateien direkt von der Platte (schnell), fehlende an die App weiterreichen
    location /assets/ {
        root $APP_DIR/public;
        access_log off;
        add_header Cache-Control \$letopia_asset_cache;
        add_header X-Content-Type-Options nosniff;
        try_files \$uri @letopia;
    }

    location / {
        proxy_pass http://letopia_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_read_timeout 60s;
    }

    location @letopia {
        proxy_pass http://letopia_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/letopia.conf /etc/nginx/sites-enabled/letopia.conf
  nginx -t > "$WORK_DIR/nginx.log" 2>&1 || { cat "$WORK_DIR/nginx.log" >&2; die "Die Nginx-Konfiguration ist fehlerhaft."; }
  if have_systemd; then systemctl enable nginx > /dev/null 2>&1 || true; systemctl reload nginx 2>/dev/null || systemctl restart nginx; else nginx -s reload 2>/dev/null || nginx; fi
  ok "Nginx leitet ${DOMAIN:-alle Anfragen an Port 80} an die App weiter"

  if command -v ufw > /dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow 'Nginx Full' > /dev/null 2>&1 || { ufw allow 80/tcp > /dev/null; ufw allow 443/tcp > /dev/null; }
    ok "Firewall (ufw): Ports 80 und 443 freigegeben"
  fi

  if [[ -n "$DOMAIN" && $WITH_SSL -eq 1 ]]; then
    step "HTTPS-Zertifikat (Let's Encrypt)"
    cert_domains=(-d "$DOMAIN")
    if [[ "$DOMAIN" != www.* ]] && getent ahosts "www.$DOMAIN" > /dev/null 2>&1; then cert_domains+=(-d "www.$DOMAIN"); fi
    mail_args=(--register-unsafely-without-email)
    [[ -n "$EMAIL" ]] && mail_args=(-m "$EMAIL")
    if certbot --nginx --non-interactive --agree-tos --redirect "${mail_args[@]}" "${cert_domains[@]}" > "$WORK_DIR/certbot.log" 2>&1; then
      set_env SITE_URL "https://$DOMAIN"
      have_systemd && systemctl restart "$SERVICE"
      ok "HTTPS aktiv – Zertifikat erneuert sich automatisch"
    else
      tail -n 8 "$WORK_DIR/certbot.log" | sed 's/^/      /' >&2
      warn "Zertifikat fehlgeschlagen. Zeigt die Domain (A-Record) schon auf diesen Server?"
      warn "Später erneut versuchen mit: letopia ssl"
    fi
  fi
fi

# --- Fertig ----------------------------------------------------------------------------------------------------------------
site=$(env_value SITE_URL)
duration=$(( $(date +%s) - STARTED ))
if [[ -n "$CREATED_PASSWORD" || -n "$ADMIN_PASS" ]]; then
  if [[ -n "$CREATED_PASSWORD" ]]; then pw_line="$CREATED_PASSWORD (muss beim ersten Login geändert werden)"; else pw_line="(wie bei der Installation eingegeben)"; fi
  printf 'Letopia – Zugangsdaten (Datei nach dem ersten Login löschen!)\nAdmin-Panel: %s/admin\nBenutzer:    %s\nPasswort:    %s\n' "$site" "$ADMIN_USER" "$pw_line" > "$CREDENTIALS_FILE"
  chmod 600 "$CREDENTIALS_FILE"
fi

printf '\n%s══════════════════════════════════════════════════════════════%s\n' "$C_ORANGE" "$C_RESET"
if [[ "$MODE" == "update" ]]; then
  printf '  %s✔ Update abgeschlossen%s (%ss)\n' "$C_GREEN$C_BOLD" "$C_RESET" "$duration"
else
  printf '  %s✔ Letopia ist installiert!%s (%ss)\n' "$C_GREEN$C_BOLD" "$C_RESET" "$duration"
fi
printf '%s══════════════════════════════════════════════════════════════%s\n' "$C_ORANGE" "$C_RESET"
printf '  Website:      %s\n' "${site:-http://$(public_ip)}"
printf '  Admin-Panel:  %s/admin\n' "${site:-http://$(public_ip)}"
if [[ -n "$CREATED_PASSWORD" ]]; then
  printf '  Benutzer:     %s%s%s\n' "$C_BOLD" "$ADMIN_USER" "$C_RESET"
  printf '  Passwort:     %s%s%s  (beim ersten Login ändern)\n' "$C_BOLD" "$CREATED_PASSWORD" "$C_RESET"
  printf '  %sGespeichert in %s – nach dem Login löschen.%s\n' "$C_DIM" "$CREDENTIALS_FILE" "$C_RESET"
elif [[ -n "$ADMIN_PASS" ]]; then
  printf '  Benutzer:     %s%s%s (Passwort wie eingegeben)\n' "$C_BOLD" "$ADMIN_USER" "$C_RESET"
fi
printf '\n  Verwaltung:   %sletopia status%s · %sletopia logs%s · %sletopia update%s · %sletopia backup%s · %sletopia hilfe%s\n\n' \
  "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET"
