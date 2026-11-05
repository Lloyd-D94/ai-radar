import { decodeEntities, plainTitle, truncate } from "./text.ts";

export interface NewsMeta {
  title: string;
  description: string;
  publishedAt: string | null;
}

function meta(html: string, attr: "property" | "name", key: string): string | null {
  const byAttr = new RegExp(
    `<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  const byContent = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["'][^>]*>`,
    "i",
  );
  const match = html.match(byAttr) ?? html.match(byContent);
  return match?.[1] ? decodeEntities(match[1]).trim() : null;
}

function jsonLdDate(html: string): string | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    try {
      const parsed: unknown = JSON.parse(block[1] ?? "");
      const found = findDate(parsed);
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}

function findDate(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findDate(entry);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  const raw = record.datePublished ?? record.dateCreated;
  if (typeof raw === "string" && !Number.isNaN(Date.parse(raw))) {
    return new Date(raw).toISOString();
  }
  if (record["@graph"]) return findDate(record["@graph"]);
  return null;
}

export function parseNewsPage(html: string): NewsMeta | null {
  const rawTitle =
    meta(html, "property", "og:title") ||
    meta(html, "name", "twitter:title") ||
    plainTitle(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const title = rawTitle.replace(/\s+\|\s+(?:SpaceXSI|xAI)$/i, "").trim();
  if (!title) return null;
  const description = truncate(
    meta(html, "property", "og:description") || meta(html, "name", "description") || "",
  );
  return { title, description, publishedAt: jsonLdDate(html) };
}
