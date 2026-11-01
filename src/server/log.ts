import { config } from "./config.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const threshold = LEVELS[(config.logLevel as Level)] ?? LEVELS.info;

const write = (level: Level, message: string, extra?: unknown) => {
  if (LEVELS[level] < threshold) return;
  const time = new Date().toISOString();
  let line = `${time} ${level.toUpperCase().padEnd(5)} ${message}`;
  if (extra instanceof Error) line += ` – ${extra.stack ?? extra.message}`;
  else if (extra !== undefined) line += ` ${JSON.stringify(extra)}`;
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(line + "\n");
};

export const log = {
  debug: (message: string, extra?: unknown) => write("debug", message, extra),
  info: (message: string, extra?: unknown) => write("info", message, extra),
  warn: (message: string, extra?: unknown) => write("warn", message, extra),
  error: (message: string, extra?: unknown) => write("error", message, extra)
};
