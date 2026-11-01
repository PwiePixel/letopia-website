/** Gemeinsame Testumgebung: eigener, leerer Datenordner pro Testlauf. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "letopia-test-"));
process.env.LOG_LEVEL = "error";
process.env.NODE_ENV = "test";
process.env.SITE_URL = "";
