import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  RadarValidationError,
  emptyRadar,
  mergeAccounts,
  mergeRadar,
  validateIncoming,
  type RadarAccount,
  type RadarFile,
} from "./lib/radar.ts";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function loadRadar(path: string): RadarFile {
  if (!existsSync(path)) return emptyRadar();
  const parsed = readJson(path) as Partial<RadarFile>;
  return {
    generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
    updates: Array.isArray(parsed.updates) ? parsed.updates : [],
    examples: Array.isArray(parsed.examples) ? parsed.examples : [],
    startups: Array.isArray(parsed.startups) ? parsed.startups : [],
  };
}

export function loadAccounts(path: string): RadarAccount[] {
  if (!existsSync(path)) return [];
  const parsed = readJson(path);
  return Array.isArray(parsed) ? (parsed as RadarAccount[]) : [];
}

export function applyRadarUpdate(root: string, updatePath: string): { updates: number; examples: number; startups: number; accounts: number } {
  if (!existsSync(updatePath)) {
    throw new RadarValidationError([`Bestand ontbreekt: ${updatePath}`]);
  }
  let payload: unknown;
  try {
    payload = readJson(updatePath);
  } catch {
    throw new RadarValidationError([`${updatePath}: geen geldige JSON`]);
  }
  const radarPath = join(root, "data", "radar.json");
  const accountsPath = join(root, "data", "accounts.json");
  const current = loadRadar(radarPath);
  const checked = validateIncoming(payload, current.examples);
  if (checked.issues.length > 0) throw new RadarValidationError(checked.issues);
  const next = mergeRadar(current, checked);
  const accounts = mergeAccounts(loadAccounts(accountsPath), checked.accounts);
  writeFileSync(radarPath, `${JSON.stringify(next, null, 2)}\n`);
  writeFileSync(accountsPath, `${JSON.stringify(accounts, null, 2)}\n`);
  return {
    updates: next.updates.length,
    examples: next.examples.length,
    startups: next.startups.length,
    accounts: accounts.length,
  };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  const file = process.argv[2] ?? "radar-update.json";
  try {
    const result = applyRadarUpdate(process.cwd(), file);
    console.log(
      `Radar bijgewerkt: ${result.updates} updates, ${result.examples} voorbeelden, ${result.startups} startups, ${result.accounts} accounts.`,
    );
  } catch (error) {
    if (error instanceof RadarValidationError) {
      console.error("Radar-update geweigerd:");
      for (const issue of error.issues) console.error(`- ${issue}`);
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  }
}
