/**
 * Entwicklungsmodus: baut die Browser-Skripte bei jeder Änderung neu und startet
 * den Server mit automatischem Neustart (tsx watch).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

const run = (args: string[]) =>
  spawn(tsx, args, { cwd: root, stdio: "inherit", env: { ...process.env, NODE_OPTIONS: "--disable-warning=ExperimentalWarning" } });

const children = [
  run(["scripts/build-client.ts", "--watch"]),
  run(["watch", "--clear-screen=false", "--ignore", "public/**", "src/server/index.ts"])
];

const stop = () => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
