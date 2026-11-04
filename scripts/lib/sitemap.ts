import { decodeEntities } from "./text.ts";

export interface SitemapUrl {
  loc: string;
  lastmod: string | null;
}

export function parseSitemap(xml: string): SitemapUrl[] {
  const blocks = xml.match(/<url\b[^>]*>[\s\S]*?<\/url>/gi) ?? [];
  const urls: SitemapUrl[] = [];
  for (const block of blocks) {
    const loc = /<loc>([\s\S]*?)<\/loc>/i.exec(block)?.[1];
    if (!loc) continue;
    const lastmodRaw = /<lastmod>([\s\S]*?)<\/lastmod>/i.exec(block)?.[1]?.trim() ?? null;
    let lastmod: string | null = null;
    if (lastmodRaw) {
      const ms = Date.parse(decodeEntities(lastmodRaw));
      lastmod = Number.isNaN(ms) ? null : new Date(ms).toISOString();
    }
    urls.push({ loc: decodeEntities(loc).trim(), lastmod });
  }
  return urls;
}
