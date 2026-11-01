import { all, get, now, run } from "../db/database.js";

export interface Media {
  id: number;
  filename: string;
  original_name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  uploaded_by: string;
  created_at: number;
}

export const listMedia = () => all<Media>("SELECT * FROM media ORDER BY id DESC");

export const getMedia = (id: number) => get<Media>("SELECT * FROM media WHERE id = ?", id);

export const getMediaByFilename = (filename: string) => get<Media>("SELECT * FROM media WHERE filename = ?", filename);

export const addMedia = (data: Omit<Media, "id" | "created_at">) =>
  run(
    "INSERT INTO media (filename, original_name, mime, size, width, height, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    data.filename, data.original_name, data.mime, data.size, data.width, data.height, data.uploaded_by, now()
  ).lastId;

export const deleteMedia = (id: number) => run("DELETE FROM media WHERE id = ?", id);
