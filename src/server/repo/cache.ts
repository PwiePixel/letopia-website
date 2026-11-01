/**
 * Kleiner In-Memory-Cache für aufbereitete Inhalte (z. B. gerendertes Markdown).
 * Jede Änderung im Admin-Panel ruft touchContent() auf und macht damit alles ungültig.
 */
let version = 1;
const store = new Map<string, { version: number; value: unknown }>();

export const contentVersion = () => version;

export const touchContent = () => {
  version++;
  if (store.size > 500) store.clear();
};

export const memo = <T>(key: string, compute: () => T): T => {
  const hit = store.get(key);
  if (hit && hit.version === version) return hit.value as T;
  const value = compute();
  store.set(key, { version, value });
  return value;
};
