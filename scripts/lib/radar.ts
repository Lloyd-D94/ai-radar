export const ACCOUNT_CATEGORIES = [
  "official_product",
  "builder_demo",
  "engineer_explainer",
  "founder_investor",
  "xai_grok",
  "dutch_eu",
] as const;

export const EXAMPLE_KINDS = ["demo", "workflow", "release", "tutorial"] as const;
export const MEDIA_TYPES = ["photo", "video", "gif"] as const;
export const METRIC_KEYS = ["likes", "reposts", "replies", "views"] as const;

export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number];
export type ExampleKind = (typeof EXAMPLE_KINDS)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type MetricKey = (typeof METRIC_KEYS)[number];

export interface RadarUpdate {
  id: string;
  date: string;
  tool: string;
  title_nl: string;
  summary_nl: string;
  can_do_nl: string[];
  example_ids: string[];
  source_urls: string[];
  importance: number;
  seed?: boolean;
}

export interface RadarMedia {
  type: MediaType;
  url: string;
  preview_url: string;
  alt?: string;
}

export interface RadarMetrics {
  likes?: number;
  reposts?: number;
  replies?: number;
  views?: number;
}

export interface RadarExample {
  id: string;
  date: string;
  author_handle: string;
  post_url: string;
  note_nl: string;
  tool: string;
  kind: ExampleKind;
  from_followed: boolean;
  seed?: boolean;
  author_name?: string;
  author_avatar_url?: string;
  text?: string;
  media?: RadarMedia[];
  metrics?: RadarMetrics;
  lang?: string;
}

export interface RadarStartup {
  id: string;
  name: string;
  handle: string;
  url: string;
  one_liner_nl: string;
  why_new_nl: string;
  date_found: string;
  proof_url: string;
  seed?: boolean;
  website_url?: string;
  logo_url?: string;
}

export interface RadarAccount {
  handle: string;
  name: string;
  category: AccountCategory;
  note_nl: string;
  already_followed: boolean;
  followers: number;
  example_url: string;
  avatar_url?: string;
}

export interface RadarFile {
  generatedAt?: string;
  updates: RadarUpdate[];
  examples: RadarExample[];
  startups: RadarStartup[];
}

export interface RadarUpdateFile {
  updates?: unknown;
  examples?: unknown;
  startups?: unknown;
  accounts?: unknown;
}

export const LIMITS = {
  updates: 400,
  examples: 1500,
  title: 140,
  summary: 400,
  note: 220,
  canDo: 180,
  oneLiner: 220,
  whyNew: 320,
  name: 80,
  tool: 40,
  id: 80,
  accountNote: 280,
  text: 500,
  alt: 180,
  mediaUrl: 500,
  lang: 16,
};

const POST_URL = /^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const LANG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const HTML_TAG = /<\/?[a-z][^>\n]*>/i;
const MEDIA_KEYS = ["type", "url", "preview_url", "alt"];

export class RadarValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("\n"));
    this.name = "RadarValidationError";
    this.issues = issues;
  }
}

export function sentenceCount(text: string): number {
  const masked = text
    .replace(/\d+\.\d+(?:\.\d+)?/g, (match) => match.replaceAll(".", ""))
    .replace(/\.md\b/gi, " md");
  const marks = masked.match(/[.!?]+/g);
  if (!marks) return text.trim() ? 1 : 0;
  return marks.length;
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function asRecord(value: unknown, path: string, issues: string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${path}: verwacht een object`);
    return null;
  }
  return value as Record<string, unknown>;
}

function reqString(record: Record<string, unknown>, key: string, path: string, issues: string[], max: number): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path}.${key}: verplicht tekstveld`);
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length > max) issues.push(`${path}.${key}: maximaal ${max} tekens (nu ${trimmed.length})`);
  return trimmed;
}

function reqBool(record: Record<string, unknown>, key: string, path: string, issues: string[]): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    issues.push(`${path}.${key}: verwacht true of false`);
    return false;
  }
  return value;
}

function reqIso(record: Record<string, unknown>, key: string, path: string, issues: string[]): string {
  const value = reqString(record, key, path, issues, 40);
  if (!value) return "";
  if (Number.isNaN(Date.parse(value))) issues.push(`${path}.${key}: geen geldige ISO-datum (${value})`);
  return value;
}

function optionalSeed(record: Record<string, unknown>, path: string, issues: string[]): boolean | undefined {
  if (record.seed === undefined) return undefined;
  if (typeof record.seed !== "boolean") {
    issues.push(`${path}.seed: verwacht true of false`);
    return undefined;
  }
  return record.seed;
}

function optString(record: Record<string, unknown>, key: string, path: string, issues: string[], max: number): string | undefined {
  if (record[key] === undefined) return undefined;
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path}.${key}: verwacht tekst`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) issues.push(`${path}.${key}: maximaal ${max} tekens (nu ${trimmed.length})`);
  return trimmed;
}

function optHttps(record: Record<string, unknown>, key: string, path: string, issues: string[], max: number): string | undefined {
  const value = optString(record, key, path, issues, max);
  if (!value || !isHttpsUrl(value)) {
    if (value) issues.push(`${path}.${key}: moet een https-URL zijn`);
    return undefined;
  }
  return value;
}

function parseMedia(value: unknown, path: string, issues: string[]): RadarMedia[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push(`${path}.media: verwacht een lijst`);
    return undefined;
  }
  if (value.length > 4) issues.push(`${path}.media: hooguit 4 beelden (nu ${value.length})`);
  const media: RadarMedia[] = [];
  for (const [index, entry] of value.slice(0, 4).entries()) {
    const itemPath = `${path}.media[${index}]`;
    const record = asRecord(entry, itemPath, issues);
    if (!record) continue;
    for (const key of Object.keys(record)) {
      if (!MEDIA_KEYS.includes(key)) issues.push(`${itemPath}.${key}: onbekend veld`);
    }
    const type = typeof record.type === "string" ? record.type.trim() : "";
    if (!type) issues.push(`${itemPath}.type: verplicht`);
    else if (!MEDIA_TYPES.includes(type as MediaType)) issues.push(`${itemPath}.type: verwacht photo, video of gif`);
    if (record.url === undefined) issues.push(`${itemPath}.url: verplicht`);
    if (record.preview_url === undefined) issues.push(`${itemPath}.preview_url: verplicht`);
    const url = record.url === undefined ? undefined : optHttps(record, "url", itemPath, issues, LIMITS.mediaUrl);
    const preview = record.preview_url === undefined ? undefined : optHttps(record, "preview_url", itemPath, issues, LIMITS.mediaUrl);
    let alt: string | undefined;
    if (record.alt !== undefined && record.alt !== "") {
      if (typeof record.alt !== "string") issues.push(`${itemPath}.alt: verwacht tekst`);
      else {
        const trimmed = record.alt.trim();
        if (trimmed.length > LIMITS.alt) issues.push(`${itemPath}.alt: maximaal ${LIMITS.alt} tekens (nu ${trimmed.length})`);
        else if (trimmed) alt = trimmed;
      }
    }
    if (url && preview && MEDIA_TYPES.includes(type as MediaType)) {
      const item: RadarMedia = { type: type as MediaType, url, preview_url: preview };
      if (alt) item.alt = alt;
      media.push(item);
    }
  }
  return media.length > 0 ? media : undefined;
}

function parseMetrics(value: unknown, path: string, issues: string[]): RadarMetrics | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, `${path}.metrics`, issues);
  if (!record) return undefined;
  const metrics: RadarMetrics = {};
  for (const key of Object.keys(record)) {
    if (!METRIC_KEYS.includes(key as MetricKey)) {
      issues.push(`${path}.metrics.${key}: onbekend veld`);
      continue;
    }
    const raw = record[key];
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
      issues.push(`${path}.metrics.${key}: geheel getal van 0 of hoger`);
      continue;
    }
    metrics[key as MetricKey] = raw;
  }
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function parseLang(record: Record<string, unknown>, path: string, issues: string[]): string | undefined {
  const value = optString(record, "lang", path, issues, LIMITS.lang);
  if (!value) return undefined;
  if (!LANG.test(value)) {
    issues.push(`${path}.lang: korte taalcode, bijvoorbeeld nl of en`);
    return undefined;
  }
  return value;
}

function httpsList(value: unknown, path: string, issues: string[], min: number, max: number): string[] {
  if (!Array.isArray(value)) {
    issues.push(`${path}: verwacht een lijst URL’s`);
    return [];
  }
  if (value.length < min || value.length > max) {
    issues.push(`${path}: tussen ${min} en ${max} URL’s (nu ${value.length})`);
  }
  const urls: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || !isHttpsUrl(entry)) {
      issues.push(`${path}[${index}]: moet een https-URL zijn`);
      return;
    }
    urls.push(entry);
  });
  return urls;
}

function parseExample(value: unknown, path: string, issues: string[]): RadarExample | null {
  const record = asRecord(value, path, issues);
  if (!record) return null;
  const id = reqString(record, "id", path, issues, LIMITS.id);
  if (id && !ID.test(id)) issues.push(`${path}.id: kleine letters, cijfers en streepjes`);
  const author = reqString(record, "author_handle", path, issues, 15);
  if (author && !HANDLE.test(author)) issues.push(`${path}.author_handle: ongeldige X-handle`);
  const post = reqString(record, "post_url", path, issues, 120);
  const postMatch = POST_URL.exec(post);
  if (post && !postMatch) {
    issues.push(`${path}.post_url: verwacht https://x.com/<handle>/status/<id>`);
  } else if (postMatch && author && postMatch[1]?.toLowerCase() !== author.toLowerCase()) {
    issues.push(`${path}.post_url: handle in de URL (${postMatch[1]}) wijkt af van author_handle (${author})`);
  }
  const note = reqString(record, "note_nl", path, issues, LIMITS.note);
  if (note && sentenceCount(note) !== 1) issues.push(`${path}.note_nl: precies één zin`);
  const kind = reqString(record, "kind", path, issues, 20);
  if (kind && !EXAMPLE_KINDS.includes(kind as ExampleKind)) {
    issues.push(`${path}.kind: verwacht demo, workflow, release of tutorial`);
  }
  const example: RadarExample = {
    id,
    date: reqIso(record, "date", path, issues),
    author_handle: author,
    post_url: post,
    note_nl: note,
    tool: reqString(record, "tool", path, issues, LIMITS.tool),
    kind: (EXAMPLE_KINDS.includes(kind as ExampleKind) ? kind : "demo") as ExampleKind,
    from_followed: reqBool(record, "from_followed", path, issues),
  };
  const seed = optionalSeed(record, path, issues);
  if (seed !== undefined) example.seed = seed;
  const authorName = optString(record, "author_name", path, issues, LIMITS.name);
  if (authorName) example.author_name = authorName;
  const avatar = optHttps(record, "author_avatar_url", path, issues, LIMITS.mediaUrl);
  if (avatar) example.author_avatar_url = avatar;
  const text = optString(record, "text", path, issues, LIMITS.text);
  if (text) {
    if (HTML_TAG.test(text)) issues.push(`${path}.text: platte tekst, geen HTML`);
    example.text = text;
  }
  const media = parseMedia(record.media, path, issues);
  if (media) example.media = media;
  const metrics = parseMetrics(record.metrics, path, issues);
  if (metrics) example.metrics = metrics;
  const lang = parseLang(record, path, issues);
  if (lang) example.lang = lang;
  return id ? example : null;
}

function parseUpdate(value: unknown, path: string, issues: string[]): RadarUpdate | null {
  const record = asRecord(value, path, issues);
  if (!record) return null;
  const id = reqString(record, "id", path, issues, LIMITS.id);
  if (id && !ID.test(id)) issues.push(`${path}.id: kleine letters, cijfers en streepjes`);
  const summary = reqString(record, "summary_nl", path, issues, LIMITS.summary);
  if (summary && (sentenceCount(summary) < 1 || sentenceCount(summary) > 2)) {
    issues.push(`${path}.summary_nl: maximaal twee zinnen`);
  }
  const rawCan = record.can_do_nl;
  const canDo: string[] = [];
  if (!Array.isArray(rawCan)) issues.push(`${path}.can_do_nl: verwacht een lijst`);
  else {
    if (rawCan.length < 2 || rawCan.length > 5) {
      issues.push(`${path}.can_do_nl: 2 tot 5 punten (nu ${rawCan.length})`);
    }
    rawCan.forEach((entry, index) => {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        issues.push(`${path}.can_do_nl[${index}]: lege tekst`);
        return;
      }
      const point = entry.trim();
      if (point.length > LIMITS.canDo) issues.push(`${path}.can_do_nl[${index}]: maximaal ${LIMITS.canDo} tekens`);
      canDo.push(point);
    });
  }
  const rawIds = record.example_ids;
  const exampleIds: string[] = [];
  if (!Array.isArray(rawIds) || rawIds.length === 0) issues.push(`${path}.example_ids: minstens één voorbeeld`);
  else {
    rawIds.forEach((entry, index) => {
      if (typeof entry !== "string" || !ID.test(entry)) issues.push(`${path}.example_ids[${index}]: ongeldig id`);
      else exampleIds.push(entry);
    });
  }
  const importance = record.importance;
  if (typeof importance !== "number" || !Number.isInteger(importance) || importance < 1 || importance > 5) {
    issues.push(`${path}.importance: geheel getal van 1 tot 5`);
  }
  const update: RadarUpdate = {
    id,
    date: reqIso(record, "date", path, issues),
    tool: reqString(record, "tool", path, issues, LIMITS.tool),
    title_nl: reqString(record, "title_nl", path, issues, LIMITS.title),
    summary_nl: summary,
    can_do_nl: canDo,
    example_ids: exampleIds,
    source_urls: httpsList(record.source_urls, `${path}.source_urls`, issues, 1, 8),
    importance: typeof importance === "number" ? importance : 0,
  };
  const seed = optionalSeed(record, path, issues);
  if (seed !== undefined) update.seed = seed;
  return id ? update : null;
}

function parseStartup(value: unknown, path: string, issues: string[]): RadarStartup | null {
  const record = asRecord(value, path, issues);
  if (!record) return null;
  const id = reqString(record, "id", path, issues, LIMITS.id);
  if (id && !ID.test(id)) issues.push(`${path}.id: kleine letters, cijfers en streepjes`);
  const handle = reqString(record, "handle", path, issues, 15);
  if (handle && !HANDLE.test(handle)) issues.push(`${path}.handle: ongeldige X-handle`);
  const url = reqString(record, "url", path, issues, 200);
  if (url && !isHttpsUrl(url)) issues.push(`${path}.url: moet een https-URL zijn`);
  const proof = reqString(record, "proof_url", path, issues, 200);
  if (proof && !isHttpsUrl(proof)) issues.push(`${path}.proof_url: moet een https-URL zijn`);
  const startup: RadarStartup = {
    id,
    name: reqString(record, "name", path, issues, LIMITS.name),
    handle,
    url,
    one_liner_nl: reqString(record, "one_liner_nl", path, issues, LIMITS.oneLiner),
    why_new_nl: reqString(record, "why_new_nl", path, issues, LIMITS.whyNew),
    date_found: reqIso(record, "date_found", path, issues),
    proof_url: proof,
  };
  const seed = optionalSeed(record, path, issues);
  if (seed !== undefined) startup.seed = seed;
  const website = optHttps(record, "website_url", path, issues, LIMITS.mediaUrl);
  if (website) startup.website_url = website;
  const logo = optHttps(record, "logo_url", path, issues, LIMITS.mediaUrl);
  if (logo) startup.logo_url = logo;
  return id ? startup : null;
}

export function parseAccount(value: unknown, path: string, issues: string[]): RadarAccount | null {
  const record = asRecord(value, path, issues);
  if (!record) return null;
  const handle = reqString(record, "handle", path, issues, 15);
  if (handle && !HANDLE.test(handle)) issues.push(`${path}.handle: ongeldige X-handle`);
  const category = reqString(record, "category", path, issues, 40);
  if (category && !ACCOUNT_CATEGORIES.includes(category as AccountCategory)) {
    issues.push(`${path}.category: onbekende categorie`);
  }
  const followers = record.followers;
  if (typeof followers !== "number" || !Number.isInteger(followers) || followers < 0) {
    issues.push(`${path}.followers: geheel getal van 0 of hoger`);
  }
  const example = reqString(record, "example_url", path, issues, 200);
  if (example && !isHttpsUrl(example)) issues.push(`${path}.example_url: moet een https-URL zijn`);
  const account: RadarAccount = {
    handle,
    name: reqString(record, "name", path, issues, LIMITS.name),
    category: (ACCOUNT_CATEGORIES.includes(category as AccountCategory) ? category : "official_product") as AccountCategory,
    note_nl: reqString(record, "note_nl", path, issues, LIMITS.accountNote),
    already_followed: reqBool(record, "already_followed", path, issues),
    followers: typeof followers === "number" ? followers : 0,
    example_url: example,
  };
  const avatar = optHttps(record, "avatar_url", path, issues, LIMITS.mediaUrl);
  if (avatar) account.avatar_url = avatar;
  return account;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    const key = id.toLowerCase();
    if (seen.has(key)) dupes.add(id);
    seen.add(key);
  }
  return [...dupes];
}

export function validateIncoming(payload: unknown, currentExamples: RadarExample[] = []): {
  issues: string[];
  updates: RadarUpdate[];
  examples: RadarExample[];
  startups: RadarStartup[];
  accounts: RadarAccount[];
} {
  const issues: string[] = [];
  const record = asRecord(payload, "bestand", issues);
  if (!record) return { issues, updates: [], examples: [], startups: [], accounts: [] };

  const updates = readList(record.updates ?? [], "updates", issues, parseUpdate);
  const examples = readList(record.examples ?? [], "examples", issues, parseExample);
  const startups = readList(record.startups ?? [], "startups", issues, parseStartup);
  const accounts = record.accounts === undefined ? [] : readList(record.accounts, "accounts", issues, parseAccount);

  for (const id of duplicates(updates.map((item) => item.id))) issues.push(`updates: dubbel id ${id}`);
  for (const id of duplicates(examples.map((item) => item.id))) issues.push(`examples: dubbel id ${id}`);
  for (const url of duplicates(examples.map((item) => item.post_url))) issues.push(`examples: dubbele post_url ${url}`);
  for (const id of duplicates(startups.map((item) => item.id))) issues.push(`startups: dubbel id ${id}`);
  for (const url of duplicates(startups.map((item) => item.proof_url))) issues.push(`startups: dubbele proof_url ${url}`);
  for (const handle of duplicates(accounts.map((item) => item.handle))) issues.push(`accounts: dubbele handle ${handle}`);

  const known = new Set([...currentExamples.map((item) => item.id), ...examples.map((item) => item.id)]);
  updates.forEach((update, index) => {
    update.example_ids.forEach((exampleId) => {
      if (!known.has(exampleId)) issues.push(`updates[${index}].example_ids: onbekend voorbeeld ${exampleId}`);
    });
  });

  return { issues, updates, examples, startups, accounts };
}

function readList<T>(value: unknown, key: string, issues: string[], parse: (entry: unknown, path: string, issues: string[]) => T | null): T[] {
  if (!Array.isArray(value)) {
    issues.push(`${key}: verwacht een lijst`);
    return [];
  }
  const items: T[] = [];
  value.forEach((entry, index) => {
    const parsed = parse(entry, `${key}[${index}]`, issues);
    if (parsed) items.push(parsed);
  });
  return items;
}

function byDateDesc<T extends { date: string; id: string }>(items: T[], max: number): T[] {
  return [...items].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id)).slice(0, max);
}

function indexBy(items: { id: string }[]): Map<string, number> {
  return new Map(items.map((item, index) => [item.id, index]));
}

export function mergeRadar(
  current: RadarFile,
  incoming: {
    updates: RadarUpdate[];
    examples: RadarExample[];
    startups: RadarStartup[];
  },
  now = new Date().toISOString(),
): RadarFile {
  const examples = [...current.examples];
  const exampleAt = indexBy(examples);
  const exampleByUrl = new Map(examples.map((item, index) => [item.post_url.toLowerCase(), index]));
  for (const example of incoming.examples) {
    const byUrl = exampleByUrl.get(example.post_url.toLowerCase());
    const byId = exampleAt.get(example.id);
    const index = byId ?? byUrl;
    if (index === undefined) {
      exampleAt.set(example.id, examples.length);
      exampleByUrl.set(example.post_url.toLowerCase(), examples.length);
      examples.push(example);
      continue;
    }
    const previous = examples[index];
    if (previous && previous.id !== example.id) exampleAt.delete(previous.id);
    examples[index] = example;
    exampleAt.set(example.id, index);
    exampleByUrl.set(example.post_url.toLowerCase(), index);
  }

  const updates = [...current.updates];
  const updateAt = indexBy(updates);
  for (const update of incoming.updates) {
    const index = updateAt.get(update.id);
    if (index === undefined) {
      updateAt.set(update.id, updates.length);
      updates.push(update);
    } else updates[index] = update;
  }

  const startups = [...current.startups];
  const startupAt = indexBy(startups);
  const startupByProof = new Map(startups.map((item, index) => [item.proof_url.toLowerCase(), index]));
  for (const startup of incoming.startups) {
    const index = startupAt.get(startup.id) ?? startupByProof.get(startup.proof_url.toLowerCase());
    if (index === undefined) {
      startupAt.set(startup.id, startups.length);
      startupByProof.set(startup.proof_url.toLowerCase(), startups.length);
      startups.push(startup);
    } else {
      startups[index] = startup;
      startupAt.set(startup.id, index);
      startupByProof.set(startup.proof_url.toLowerCase(), index);
    }
  }

  return {
    generatedAt: now,
    updates: byDateDesc(updates, LIMITS.updates),
    examples: byDateDesc(examples, LIMITS.examples),
    startups: [...startups].sort((a, b) => Date.parse(b.date_found) - Date.parse(a.date_found) || a.id.localeCompare(b.id)),
  };
}

export function mergeAccounts(current: RadarAccount[], incoming: RadarAccount[]): RadarAccount[] {
  const map = new Map(current.map((account) => [account.handle.toLowerCase(), account]));
  for (const account of incoming) map.set(account.handle.toLowerCase(), account);
  return [...map.values()].sort((a, b) => a.handle.toLowerCase().localeCompare(b.handle.toLowerCase()));
}

export function issuesOf(payload: unknown, current: RadarFile = emptyRadar()): string[] {
  return validateIncoming(payload, current.examples).issues;
}

export function emptyRadar(): RadarFile {
  return { updates: [], examples: [], startups: [] };
}
