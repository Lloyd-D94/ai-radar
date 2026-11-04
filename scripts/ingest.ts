import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { clusterItems } from "./lib/dedupe.ts";
import { parseFeed } from "./lib/feed.ts";
import { parseGithubReleases } from "./lib/github.ts";
import { HN_QUERIES, hnSearchUrl, parseHnHits } from "./lib/hn.ts";
import type { HnHit } from "./lib/hn.ts";
import { fetchJson, fetchText } from "./lib/http.ts";
import { parseNewsPage } from "./lib/news-page.ts";
import { parseReleasebot } from "./lib/releasebot.ts";
import { parseReleaseNotes } from "./lib/release-notes.ts";
import { retainItems } from "./lib/retain.ts";
import { scoreItem } from "./lib/score.ts";
import { selectEntries } from "./lib/select.ts";
import { parseSitemap } from "./lib/sitemap.ts";
import { TOOLS } from "./lib/tools.ts";
import type { Item, ItemInput, RadarState, RawEntry, SourceConfig, SourceStatus, Via } from "./lib/types.ts";
import { emptyState } from "./lib/types.ts";
import { canonicalUrl, sha256 } from "./lib/urls.ts";
import { isPrereleaseTitle } from "./lib/version.ts";
import { versionLabel } from "./lib/version.ts";
import { SOURCES } from "./sources.ts";

interface LoadResult {
  inputs: ItemInput[];
  via: Via | null;
  note: string | null;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readState(path: string): RadarState {
  if (!existsSync(path)) return emptyState();
  const parsed = readJson(path) as Partial<RadarState>;
  return {
    version: 1,
    sitemaps: parsed.sitemaps ?? {},
    pages: parsed.pages ?? {},
    news: parsed.news ?? {},
  };
}

function isInput(value: unknown): value is ItemInput {
  if (!value || typeof value !== "object") return false;
  const item = value as ItemInput;
  return (
    typeof item.title === "string" &&
    typeof item.url === "string" &&
    typeof item.sourceId === "string" &&
    typeof item.tool === "string" &&
    typeof item.publishedAt === "string" &&
    typeof item.excerpt === "string" &&
    (item.priority === "primair" || item.priority === "secundair" || item.priority === "community")
  );
}

function readExisting(path: string): ItemInput[] {
  if (!existsSync(path)) return [];
  const parsed = readJson(path) as { items?: unknown };
  if (!Array.isArray(parsed.items)) return [];
  return parsed.items.filter(isInput).filter((item) => !isPrereleaseTitle(item.title));
}

function previousStatuses(path: string): Map<string, SourceStatus> {
  const map = new Map<string, SourceStatus>();
  if (!existsSync(path)) return map;
  const parsed = readJson(path) as { sources?: unknown };
  if (!Array.isArray(parsed.sources)) return map;
  for (const source of parsed.sources) {
    if (source && typeof source === "object" && typeof (source as SourceStatus).id === "string") {
      map.set((source as SourceStatus).id, source as SourceStatus);
    }
  }
  return map;
}

function combineVia(current: Via | null, next: Via | null): Via | null {
  if (!current) return next;
  if (!next || current === next) return current;
  return "gemengd";
}

function mergeRaw(lists: RawEntry[][]): RawEntry[] {
  const map = new Map<string, RawEntry>();
  for (const list of lists) {
    for (const entry of list) {
      let key: string;
      try {
        key = canonicalUrl(entry.url);
      } catch {
        continue;
      }
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...entry, url: key });
        continue;
      }
      map.set(key, {
        ...prev,
        prerelease: prev.prerelease || entry.prerelease,
        html: prev.html.length >= entry.html.length ? prev.html : entry.html,
        title: prev.title.length >= entry.title.length ? prev.title : entry.title,
        points: prev.points ?? entry.points,
        version: prev.version ?? entry.version,
      });
    }
  }
  return [...map.values()];
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function loadFeed(source: SourceConfig): Promise<LoadResult> {
  const result = await fetchText(source.url);
  if (!result.ok) throw new Error(result.error ?? "feed mislukt");
  return { inputs: selectEntries(source, parseFeed(result.body)), via: result.via, note: null };
}

async function loadGithub(source: SourceConfig): Promise<LoadResult> {
  const atom = await fetchText(source.url, { allowJina: false });
  const api = source.githubRepo
    ? await fetchJson(`https://api.github.com/repos/${source.githubRepo}/releases?per_page=20`, githubHeaders())
    : { ok: false, status: 0, data: null, error: "geen repo" };
  if (!atom.ok && !api.ok) throw new Error(atom.error ?? api.error ?? "GitHub-releases mislukt");
  const merged = mergeRaw([api.ok ? parseGithubReleases(api.data) : [], atom.ok ? parseFeed(atom.body) : []]);
  const inputs = selectEntries(source, merged);
  const notes: string[] = [];
  if (!atom.ok) notes.push(`Atom-feed faalde (${atom.error ?? "onbekend"}).`);
  if (!api.ok) notes.push(`GitHub API faalde (${api.error ?? "onbekend"}).`);
  if (inputs.length === 0 && merged.some((entry) => entry.prerelease)) {
    notes.push("Alleen prereleases of nightlies gezien.");
  }
  return { inputs, via: atom.ok ? atom.via : "direct", note: notes.join(" ") || null };
}

async function loadNews(source: SourceConfig, state: RadarState): Promise<LoadResult> {
  const sitemap = await fetchText(source.url);
  if (!sitemap.ok) throw new Error(sitemap.error ?? "sitemap mislukt");
  const urls = parseSitemap(sitemap.body).filter((item) => {
    try {
      return /\/news\/[^/]+$/.test(new URL(item.loc).pathname);
    } catch {
      return false;
    }
  });
  state.sitemaps[source.id] = { etag: sitemap.etag, urls };
  const pending = urls
    .filter((item) => state.news[item.loc]?.lastmod !== (item.lastmod ?? null))
    .sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""));
  const batch = pending.slice(0, sitemap.via === "jina" ? 12 : 30);
  const entries: RawEntry[] = [];
  let failed = 0;
  let via: Via | null = sitemap.via;
  for (const item of batch) {
    const page = await fetchText(item.loc);
    via = combineVia(via, page.via);
    if (!page.ok) {
      failed += 1;
      continue;
    }
    const meta = parseNewsPage(page.body);
    const published = meta?.publishedAt ?? item.lastmod;
    if (!meta || !published) {
      failed += 1;
      continue;
    }
    entries.push({
      title: meta.title,
      url: item.loc,
      publishedAt: published,
      html: meta.description,
      prerelease: false,
      version: versionLabel(meta.title),
      points: null,
    });
    state.news[item.loc] = { lastmod: item.lastmod, fetchedAt: new Date().toISOString() };
  }
  if (entries.length === 0 && batch.length > 0) {
    throw new Error(failed > 0 ? `${failed} nieuwspagina's niet gelezen` : "geen nieuwspagina's gelezen");
  }
  const leftover = pending.length - batch.length;
  const notes = [
    leftover > 0 ? `${leftover} oudere nieuwspagina's volgen in een latere run.` : "",
    failed > 0 ? `${failed} pagina's niet gelezen.` : "",
    pending.length === 0 ? "Geen nieuwe nieuws-URL’s." : "",
  ].filter(Boolean);
  return { inputs: selectEntries(source, entries), via, note: notes.join(" ") || null };
}

async function loadReleaseNotes(source: SourceConfig, state: RadarState): Promise<LoadResult> {
  const page = await fetchText(source.url);
  if (!page.ok) throw new Error(page.error ?? "release notes mislukt");
  const hash = sha256(page.body.replace(/\s+/g, " "));
  const previous = state.pages[source.url];
  state.pages[source.url] = { hash, etag: page.etag };
  if (previous?.hash === hash) {
    return { inputs: [], via: page.via, note: "Pagina ongewijzigd sinds de vorige run." };
  }
  return { inputs: selectEntries(source, parseReleaseNotes(page.body)), via: page.via, note: null };
}

async function loadReleasebot(source: SourceConfig, grokOk: boolean): Promise<LoadResult> {
  const page = await fetchText(source.url);
  if (!page.ok) throw new Error(page.error ?? "Releasebot mislukt");
  if (grokOk) {
    return {
      inputs: [],
      via: page.via,
      note: "Officiële Grok Build-feed lukte; fallback niet geïmporteerd.",
    };
  }
  const inputs = selectEntries(source, parseReleasebot(page.body));
  return {
    inputs,
    via: page.via,
    note: inputs.length
      ? "Gebruikt als fallback omdat de officiële feed faalde."
      : "Fallback leverde geen Grok Build-notities.",
  };
}

async function loadHn(source: SourceConfig): Promise<LoadResult> {
  const since = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60;
  const hits: HnHit[] = [];
  const errors: string[] = [];
  for (const query of HN_QUERIES) {
    const result = await fetchJson(hnSearchUrl(query, since));
    if (!result.ok) {
      errors.push(query);
      continue;
    }
    hits.push(...parseHnHits(result.data));
  }
  if (hits.length === 0 && errors.length === HN_QUERIES.length) throw new Error("Hacker News niet bereikbaar");
  const entries: RawEntry[] = hits.map((hit) => ({
    title: hit.title,
    url: hit.url,
    publishedAt: hit.createdAt,
    html: "",
    prerelease: false,
    version: versionLabel(hit.title),
    points: hit.points,
  }));
  return {
    inputs: selectEntries(source, mergeRaw([entries])),
    via: "direct",
    note: errors.length > 0 ? `Zoekopdrachten mislukt: ${errors.join(", ")}.` : null,
  };
}

async function loadSource(source: SourceConfig, state: RadarState, grokOk: boolean): Promise<LoadResult> {
  switch (source.kind) {
    case "feed":
      return loadFeed(source);
    case "github-releases":
      return loadGithub(source);
    case "sitemap-news":
      return loadNews(source, state);
    case "release-notes":
      return loadReleaseNotes(source, state);
    case "releasebot":
      return loadReleasebot(source, grokOk);
    case "hn":
      return loadHn(source);
    default:
      throw new Error(`Onbekend brontype`);
  }
}

function shortError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, " ").slice(0, 300);
}

export async function ingest(root: string): Promise<{ items: number; failed: string[] }> {
  const dataDir = join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  const itemsPath = join(dataDir, "items.json");
  const sourcesPath = join(dataDir, "sources.json");
  const statePath = join(dataDir, "state.json");
  const toolsPath = join(dataDir, "tools.json");
  const state = readState(statePath);
  const previous = previousStatuses(sourcesPath);
  const fresh: ItemInput[] = [];
  const statuses: SourceStatus[] = [];
  let grokOk = false;
  const now = new Date().toISOString();

  for (const source of SOURCES) {
    try {
      const result = await loadSource(source, state, grokOk);
      if (source.id === "grok-build") grokOk = true;
      fresh.push(...result.inputs);
      const proxyNote =
        result.via === "jina" || result.via === "gemengd"
          ? "Opgehaald via de gratis leesproxy (r.jina.ai), zonder API-sleutel."
          : "";
      const note = [result.note, proxyNote].filter(Boolean).join(" ") || null;
      statuses.push({
        id: source.id,
        name: source.name,
        description: source.description,
        url: source.url,
        kind: source.kind,
        tool: source.tool,
        priority: source.priority,
        optional: source.optional,
        health: "ok",
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastError: null,
        note,
        via: result.via,
        itemsFetched: result.inputs.length,
      });
      console.log(`ok   ${source.id}  ${result.inputs.length}  ${result.via ?? "-"}`);
    } catch (error) {
      const message = shortError(error);
      const prior = previous.get(source.id);
      statuses.push({
        id: source.id,
        name: source.name,
        description: source.description,
        url: source.url,
        kind: source.kind,
        tool: source.tool,
        priority: source.priority,
        optional: source.optional,
        health: "fout",
        lastAttemptAt: now,
        lastSuccessAt: prior?.lastSuccessAt ?? null,
        lastError: message,
        note: null,
        via: null,
        itemsFetched: 0,
      });
      console.log(`fout ${source.id}  ${message}`);
    }
  }

  const merged = new Map<string, ItemInput>();
  for (const input of readExisting(itemsPath)) {
    try {
      merged.set(canonicalUrl(input.url), input);
    } catch {
      continue;
    }
  }
  for (const input of fresh) {
    try {
      merged.set(canonicalUrl(input.url), input);
    } catch {
      continue;
    }
  }
  const scored: Item[] = [];
  for (const input of merged.values()) {
    try {
      scored.push(scoreItem(input));
    } catch {
      continue;
    }
  }
  const items = retainItems(clusterItems(scored));
  writeJson(itemsPath, { generatedAt: now, items });
  writeJson(sourcesPath, { generatedAt: now, sources: statuses });
  writeJson(toolsPath, { generatedAt: now, tools: TOOLS });
  writeJson(statePath, state);
  const failed = statuses.filter((source) => source.health === "fout").map((source) => source.id);
  console.log(`items ${items.length}; bronnen met fout: ${failed.length ? failed.join(", ") : "geen"}`);
  return { items: items.length, failed };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  ingest(process.cwd())
    .then((result) => {
      if (result.failed.length === SOURCES.length) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      console.error(shortError(error));
      process.exitCode = 1;
    });
}
