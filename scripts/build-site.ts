import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED = ["items.json", "sources.json", "tools.json", "radar.json", "accounts.json"];

export function buildSite(root = process.cwd()): void {
  const dist = join(root, "dist");
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, "data"), { recursive: true });
  cpSync(join(root, "web"), dist, { recursive: true });
  for (const file of REQUIRED) {
    const from = join(root, "data", file);
    if (!existsSync(from)) {
      throw new Error(`Ontbreekt: data/${file}. Draai eerst npm run ingest.`);
    }
    cpSync(from, join(dist, "data", file));
  }
  console.log("Site staat in dist/");
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  try {
    buildSite();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
