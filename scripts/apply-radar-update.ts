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
    creations: Array.isArray(parsed.creations) ? parsed.creations : [],
    daily_top: storedDailyTop(parsed.daily_top),
  };
}

function storedDailyTop(value: unknown): RadarFile["daily_top"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.date !== "string" || !Array.isArray(record.ids)) return undefined;
  const ids = record.ids.filter((id): id is string => typeof id === "string");
  if (!ids.length) return undefined;
  const top: NonNullable<RadarFile["daily_top"]> = { date: record.date, ids };
  if (typeof record.headline_nl === "string" && record.headline_nl.trim()) top.headline_nl = record.headline_nl.trim();
  return top;
}

export function loadAccounts(path: string): RadarAccount[] {
  if (!existsSync(path)) return [];
  const parsed = readJson(path);
  return Array.isArray(parsed) ? (parsed as RadarAccount[]) : [];
}

export function applyRadarUpdate(root: string, updatePath: string): { updates: number; examples: number; startups: number; accounts: number; creations: number } {
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
  const checked = validateIncoming(payload, current.examples, current.updates);
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
    creations: next.creations?.length ?? 0,
  };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  const file = process.argv[2] ?? "radar-update.json";
  try {
    const result = applyRadarUpdate(process.cwd(), file);
    console.log(
      `Radar bijgewerkt: ${result.updates} updates, ${result.examples} voorbeelden, ${result.startups} startups, ${result.creations} creaties, ${result.accounts} accounts.`,
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
