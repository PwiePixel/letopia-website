import { all, get, run, today } from "../db/database.js";
import { touchContent } from "./cache.js";
import { nextPosition } from "./order.js";
import { saveSettings } from "./settings.js";

export interface TeamGroup {
  id: number;
  name: string;
  color: string;
  position: number;
}

export interface TeamMember {
  id: number;
  group_id: number;
  name: string;
  role: string;
  since: string;
  info: string;
  position: number;
}

export type TeamGroupWithMembers = TeamGroup & { members: TeamMember[] };

/** Jede Änderung am Team aktualisiert das "Stand"-Datum auf der Team-Seite. */
const changed = () => {
  saveSettings("team", { stand: today() });
  touchContent();
};

export const listGroups = () => all<TeamGroup>("SELECT * FROM team_groups ORDER BY position, id");

export const getGroup = (id: number) => get<TeamGroup>("SELECT * FROM team_groups WHERE id = ?", id);

export const teamWithMembers = (): TeamGroupWithMembers[] => {
  const members = all<TeamMember>("SELECT * FROM team_members ORDER BY position, id");
  return listGroups().map(g => ({ ...g, members: members.filter(m => m.group_id === g.id) }));
};

export const createGroup = (data: { name: string; color: string }) => {
  const { lastId } = run("INSERT INTO team_groups (name, color, position) VALUES (?, ?, ?)", data.name, data.color, nextPosition("team_groups"));
  changed();
  return lastId;
};

export const updateGroup = (id: number, data: { name: string; color: string }) => {
  run("UPDATE team_groups SET name = ?, color = ? WHERE id = ?", data.name, data.color, id);
  changed();
};

export const deleteGroup = (id: number) => {
  run("DELETE FROM team_groups WHERE id = ?", id);
  changed();
};

export const getMember = (id: number) => get<TeamMember>("SELECT * FROM team_members WHERE id = ?", id);

export interface MemberInput {
  group_id: number;
  name: string;
  role: string;
  since: string;
  info: string;
}

export const createMember = (data: MemberInput) => {
  const { lastId } = run(
    "INSERT INTO team_members (group_id, name, role, since, info, position) VALUES (?, ?, ?, ?, ?, ?)",
    data.group_id, data.name, data.role, data.since, data.info, nextPosition("team_members", data.group_id)
  );
  changed();
  return lastId;
};

export const updateMember = (id: number, data: MemberInput) => {
  const before = getMember(id);
  if (!before) return;
  const moved = before.group_id !== data.group_id;
  run(
    `UPDATE team_members SET group_id = ?, name = ?, role = ?, since = ?, info = ?${moved ? ", position = ?" : ""} WHERE id = ?`,
    data.group_id, data.name, data.role, data.since, data.info,
    ...(moved ? [nextPosition("team_members", data.group_id)] : []),
    id
  );
  changed();
};

export const deleteMember = (id: number) => {
  run("DELETE FROM team_members WHERE id = ?", id);
  changed();
};

export const countMembers = () => Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM team_members")?.n ?? 0);
