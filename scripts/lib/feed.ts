import { decodeEntities } from "./text.ts";
import { isPrereleaseTitle, versionLabel } from "./version.ts";
import type { RawEntry } from "./types.ts";

function tag(block: string, name: string): string | null {
  const match = block.match(
    new RegExp(`<(?:[a-z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${name}>`, "i"),
  );
  return match?.[1]?.trim() ?? null;
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const text = decodeEntities(value).trim();
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function extractLink(block: string): string | null {
  const tags = [...block.matchAll(/<(?:[a-z0-9]+:)?link\b([^>]*)\/?>/gi)];
  let fallback: string | null = null;
  for (const match of tags) {
    const attrs = match[1] ?? "";
    const href = /href=["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!href) continue;
    const rel = /rel=["']([^"']+)["']/i.exec(attrs)?.[1] ?? "alternate";
    const decoded = decodeEntities(href).trim();
    if (rel.split(/\s+/).includes("alternate") || rel === "alternate") return decoded;
    fallback ??= decoded;
  }
  const text = tag(block, "link");
  if (text && !text.includes("<")) {
    const decoded = decodeEntities(text).trim();
    if (decoded) return decoded;
  }
  return fallback;
}

function extractUrl(block: string): string | null {
  const link = extractLink(block);
  if (link && /^https?:\/\//i.test(link)) return link;
  for (const name of ["guid", "id"]) {
    const value = tag(block, name);
    if (!value) continue;
    const decoded = decodeEntities(value).trim();
    if (/^https?:\/\//i.test(decoded)) return decoded;
  }
  return null;
}

function htmlOf(block: string): string {
  const raw =
    tag(block, "encoded") ??
    tag(block, "content") ??
    tag(block, "description") ??
    tag(block, "summary") ??
    "";
  return decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}

function blockToEntry(block: string): RawEntry | null {
  const titleRaw = tag(block, "title");
  const url = extractUrl(block);
  const publishedAt = parseDate(
    tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "date"),
  );
  if (!titleRaw || !url || !publishedAt) return null;
  const title = decodeEntities(titleRaw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;
  const version = versionLabel(title);
  return {
    title,
    url,
    publishedAt,
    html: htmlOf(block),
    prerelease: isPrereleaseTitle(title) || (version !== null && isPrereleaseTitle(version)),
    version,
    points: null,
  };
}

export function parseFeed(xml: string): RawEntry[] {
  const cleaned = xml.replace(/^\uFEFF/, "");
  const blocks =
    cleaned.match(/<(?:[a-z0-9]+:)?(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:[a-z0-9]+:)?(?:item|entry)>/gi) ??
    [];
  const entries: RawEntry[] = [];
  for (const block of blocks) {
    const entry = blockToEntry(block);
    if (entry) entries.push(entry);
  }
  return entries;
}
