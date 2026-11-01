import type { Role } from "../../shared/catalog.js";
import { all, get, now, run } from "../db/database.js";

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  minecraft_name: string;
  active: number;
  totp_secret: string | null;
  must_change_password: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export type PublicUser = Omit<User, "password_hash" | "totp_secret"> & { has_totp: number };

export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;

export const listUsers = () =>
  all<PublicUser>(
    `SELECT id, username, role, minecraft_name, active, must_change_password, created_at, updated_at, last_login_at,
       (totp_secret IS NOT NULL) AS has_totp FROM users ORDER BY username COLLATE NOCASE`
  );

export const getUser = (id: number) => get<User>("SELECT * FROM users WHERE id = ?", id);

export const getUserByName = (username: string) => get<User>("SELECT * FROM users WHERE username = ? COLLATE NOCASE", username);

export const countUsers = () => Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM users")?.n ?? 0);

export const countActiveAdmins = () =>
  Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")?.n ?? 0);

export const createUser = (data: { username: string; passwordHash: string; role: Role; minecraftName?: string; mustChange?: boolean }) => {
  const t = now();
  return run(
    `INSERT INTO users (username, password_hash, role, minecraft_name, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    data.username, data.passwordHash, data.role, data.minecraftName ?? "", data.mustChange ? 1 : 0, t, t
  ).lastId;
};

export const updateUser = (id: number, data: { role: Role; minecraftName: string; active: boolean }) =>
  run("UPDATE users SET role = ?, minecraft_name = ?, active = ?, updated_at = ? WHERE id = ?", data.role, data.minecraftName, data.active ? 1 : 0, now(), id);

export const setPassword = (id: number, passwordHash: string, mustChange = false) =>
  run("UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?", passwordHash, mustChange ? 1 : 0, now(), id);

export const setTotpSecret = (id: number, secret: string | null) =>
  run("UPDATE users SET totp_secret = ?, updated_at = ? WHERE id = ?", secret, now(), id);

export const setMinecraftName = (id: number, name: string) =>
  run("UPDATE users SET minecraft_name = ?, updated_at = ? WHERE id = ?", name, now(), id);

export const touchLogin = (id: number) => run("UPDATE users SET last_login_at = ? WHERE id = ?", now(), id);

export const deleteUser = (id: number) => run("DELETE FROM users WHERE id = ?", id);

/** Name für den Minecraft-Kopf eines Benutzers. */
export const headName = (u: { username: string; minecraft_name: string }) => u.minecraft_name || u.username;
