import type { DatabaseSync } from "node:sqlite";

/**
 * Datenbank-Migrationen. Jede Migration läuft genau einmal (gemerkt über PRAGMA user_version).
 * Neue Änderungen immer unten anhängen – bestehende Einträge nie verändern.
 */
const MIGRATIONS: string[] = [
  /* 1 – Grundschema */ `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    minecraft_name TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    totp_secret TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login_at INTEGER
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    remember INTEGER NOT NULL DEFAULT 0,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE INDEX sessions_expires ON sessions(expires_at);

  CREATE TABLE rate_limits (
    key TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX rate_limits_key ON rate_limits(key, at);

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX audit_log_created ON audit_log(created_at);

  CREATE TABLE applications (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    player_name TEXT NOT NULL,
    discord TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    answers TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'neu',
    note TEXT NOT NULL DEFAULT '',
    handled_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    decided_at INTEGER
  );
  CREATE INDEX applications_status ON applications(status, created_at);
  CREATE INDEX applications_created ON applications(created_at);

  CREATE TABLE application_votes (
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote INTEGER NOT NULL CHECK (vote IN (-1, 0, 1)),
    comment TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (application_id, user_id)
  );

  CREATE TABLE wiki_categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'book',
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE wiki_articles (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    category_id INTEGER REFERENCES wiki_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    updated_on TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX wiki_articles_category ON wiki_articles(category_id, position);

  CREATE TABLE pages (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    heading TEXT NOT NULL DEFAULT '',
    lead TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    scene TEXT NOT NULL DEFAULT 'night',
    seed TEXT NOT NULL DEFAULT '',
    in_footer INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    system INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    updated_on TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE team_groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#f0a830',
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE team_members (
    id INTEGER PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    since TEXT NOT NULL DEFAULT '',
    info TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX team_members_group ON team_members(group_id, position);

  CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    rarity TEXT NOT NULL DEFAULT 'gewoehnlich',
    sprite TEXT NOT NULL DEFAULT 'block',
    color TEXT NOT NULL DEFAULT '#cccccc',
    lore TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    origin TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE ingredients (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    sprite TEXT NOT NULL DEFAULT 'block',
    color TEXT NOT NULL DEFAULT '#cccccc',
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE recipes (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 1,
    grid TEXT NOT NULL DEFAULT '[]',
    hint TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE vote_sites (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '#',
    reward TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE media (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    uploaded_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  `
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export const migrate = (db: DatabaseSync): number => {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  const current = Number(row?.user_version ?? 0);
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version] ?? "");
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${version + 1} fehlgeschlagen: ${(error as Error).message}`);
    }
  }
  return MIGRATIONS.length - current;
};
