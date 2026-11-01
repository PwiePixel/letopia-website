import { all, get, run } from "../db/database.js";
import { touchContent } from "./cache.js";
import { nextPosition } from "./order.js";

export interface VoteSite {
  id: number;
  name: string;
  url: string;
  reward: string;
  position: number;
  active: number;
}

export const listVoteSites = (activeOnly = false) =>
  all<VoteSite>(`SELECT * FROM vote_sites${activeOnly ? " WHERE active = 1" : ""} ORDER BY position, id`);

export const getVoteSite = (id: number) => get<VoteSite>("SELECT * FROM vote_sites WHERE id = ?", id);

export interface VoteSiteInput {
  name: string;
  url: string;
  reward: string;
  active: boolean;
}

export const createVoteSite = (data: VoteSiteInput) => {
  const { lastId } = run(
    "INSERT INTO vote_sites (name, url, reward, position, active) VALUES (?, ?, ?, ?, ?)",
    data.name, data.url, data.reward, nextPosition("vote_sites"), data.active ? 1 : 0
  );
  touchContent();
  return lastId;
};

export const updateVoteSite = (id: number, data: VoteSiteInput) => {
  run("UPDATE vote_sites SET name = ?, url = ?, reward = ?, active = ? WHERE id = ?", data.name, data.url, data.reward, data.active ? 1 : 0, id);
  touchContent();
};

export const deleteVoteSite = (id: number) => {
  run("DELETE FROM vote_sites WHERE id = ?", id);
  touchContent();
};
