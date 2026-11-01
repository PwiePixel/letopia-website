import { promises as dns } from "node:dns";
import net from "node:net";
import { log } from "../log.js";
import { getSettings } from "../repo/settings.js";

export interface ServerStatus {
  online: boolean;
  players: { online: number; max: number };
  version?: string;
  source: "ping" | "mcsrvstat";
}

const TIMEOUT = 4000;

// --- Minecraft Server List Ping (Java Edition, Protokoll seit 1.7) ---------------------------

const varInt = (value: number): Buffer => {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return Buffer.from(bytes);
};

const readVarInt = (buf: Buffer, offset: number): { value: number; size: number } | null => {
  let value = 0;
  let size = 0;
  while (true) {
    if (offset + size >= buf.length) return null;
    const byte = buf[offset + size] ?? 0;
    value |= (byte & 0x7f) << (7 * size);
    size++;
    if (size > 5) throw new Error("VarInt zu lang");
    if ((byte & 0x80) === 0) return { value, size };
  }
};

const packet = (...parts: Buffer[]) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([varInt(body.length), body]);
};

const mcString = (text: string) => {
  const data = Buffer.from(text, "utf8");
  return Buffer.concat([varInt(data.length), data]);
};

/** Löst den SRV-Eintrag _minecraft._tcp auf, wie es der Minecraft-Client auch tut. */
const resolveTarget = async (host: string, port: number): Promise<{ host: string; port: number }> => {
  if (net.isIP(host)) return { host, port };
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    const best = records.sort((a, b) => a.priority - b.priority || b.weight - a.weight)[0];
    if (best) return { host: best.name, port: best.port };
  } catch {
    // Kein SRV-Eintrag – direkte Adresse verwenden.
  }
  return { host, port };
};

export const pingJava = async (address: string, defaultPort = 25565): Promise<ServerStatus> => {
  const [hostPart = "", portPart] = address.split(":");
  const target = await resolveTarget(hostPart.trim(), Number(portPart) || defaultPort);

  return new Promise<ServerStatus>((resolve, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port });
    let buffer = Buffer.alloc(0);
    let done = false;

    const finish = (error: Error | null, result?: ServerStatus) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (error) reject(error);
      else if (result) resolve(result);
    };

    socket.setTimeout(TIMEOUT, () => finish(new Error("Zeitüberschreitung")));
    socket.on("error", error => finish(error));
    socket.on("connect", () => {
      const port = Buffer.alloc(2);
      port.writeUInt16BE(target.port);
      socket.write(packet(varInt(0x00), varInt(-1), mcString(hostPart.trim()), port, varInt(1)));
      socket.write(packet(varInt(0x00)));
    });
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 1024 * 1024) return finish(new Error("Antwort zu groß"));
      try {
        const length = readVarInt(buffer, 0);
        if (!length || buffer.length < length.size + length.value) return;
        let offset = length.size;
        const id = readVarInt(buffer, offset);
        if (!id || id.value !== 0x00) return finish(new Error("Unerwartetes Paket"));
        offset += id.size;
        const jsonLength = readVarInt(buffer, offset);
        if (!jsonLength) return finish(new Error("Ungültige Antwort"));
        offset += jsonLength.size;
        const json = JSON.parse(buffer.subarray(offset, offset + jsonLength.value).toString("utf8")) as {
          players?: { online?: number; max?: number };
          version?: { name?: string };
        };
        finish(null, {
          online: true,
          players: { online: Number(json.players?.online ?? 0), max: Number(json.players?.max ?? 0) },
          version: typeof json.version?.name === "string" ? json.version.name.slice(0, 60) : undefined,
          source: "ping"
        });
      } catch (error) {
        finish(error as Error);
      }
    });
  });
};

// --- Fallback: api.mcsrvstat.us -----------------------------------------------------------------

export const queryMcsrvstat = async (address: string): Promise<ServerStatus> => {
  const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`, {
    headers: { "User-Agent": "Letopia-Website" },
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error(`mcsrvstat: HTTP ${res.status}`);
  const data = (await res.json()) as { online?: boolean; players?: { online?: number; max?: number }; version?: string };
  if (typeof data.online !== "boolean") throw new Error("mcsrvstat: ungültige Antwort");
  return {
    online: data.online,
    players: { online: Number(data.players?.online ?? 0), max: Number(data.players?.max ?? 0) },
    version: typeof data.version === "string" ? data.version.slice(0, 60) : undefined,
    source: "mcsrvstat"
  };
};

// --- Zwischenspeicher ------------------------------------------------------------------------------

let cached: { at: number; key: string; value: ServerStatus | null } | null = null;
let pending: Promise<ServerStatus | null> | null = null;

/** Liefert den Online-Status (60 s zwischengespeichert, bei Fehlern 30 s). null = unbekannt. */
export const serverStatus = async (): Promise<ServerStatus | null> => {
  const s = getSettings("general");
  if (s.statusSource === "off" || !s.serverAddress) return null;
  const key = `${s.statusSource}|${s.serverAddress}|${s.javaPort}`;
  const age = cached && cached.key === key ? Date.now() - cached.at : Infinity;
  if (cached && age < (cached.value ? 60_000 : 30_000)) return cached.value;
  if (pending) return pending;

  pending = (async () => {
    let value: ServerStatus | null = null;
    try {
      value = s.statusSource === "ping" ? await pingJava(s.serverAddress, s.javaPort) : await queryMcsrvstat(s.serverAddress);
    } catch (error) {
      log.debug(`Status-Abfrage (${s.statusSource}) fehlgeschlagen: ${(error as Error).message}`);
      if (s.statusSource === "ping") {
        try {
          value = await queryMcsrvstat(s.serverAddress);
        } catch (fallbackError) {
          log.debug(`mcsrvstat-Fallback fehlgeschlagen: ${(fallbackError as Error).message}`);
          value = null;
        }
      }
    }
    cached = { at: Date.now(), key, value };
    return value;
  })().finally(() => {
    pending = null;
  });
  return pending;
};

export const resetStatusCache = () => {
  cached = null;
};
