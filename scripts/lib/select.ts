import { excerptFromHtml, titleFromFeed } from "./text.ts";
import { priorityOfTool } from "./tools.ts";
import type { ItemInput, RawEntry, SourceConfig } from "./types.ts";
import { canonicalUrl } from "./urls.ts";
import { isPrereleaseTitle } from "./version.ts";

export function resolveTool(source: SourceConfig, title: string, url: string): string {
  if (source.tool === "xai" || source.tool === "xai-api" || source.id === "releasebot-xai") {
    const blob = `${title} ${url}`.toLowerCase();
    if (/grok[-\s]?build|changelog\/build/.test(blob)) return "grok-build";
    if (/grok[-\s]?bot/.test(blob)) return "grok-bot";
  }
  return source.tool;
}

export function selectEntries(source: SourceConfig, entries: RawEntry[], now = Date.now()): ItemInput[] {
  const inputs: ItemInput[] = [];
  for (const entry of entries) {
    if (
      entry.prerelease ||
      isPrereleaseTitle(entry.title) ||
      (entry.version !== null && isPrereleaseTitle(entry.version))
    ) {
      continue;
    }
    if (/source archive|checksums?/i.test(entry.title)) continue;
    const published = Date.parse(entry.publishedAt);
    if (Number.isNaN(published)) continue;
    const ageDays = (now - published) / 86_400_000;
    if (ageDays < -2) continue;
    if (source.broad && ageDays > (source.maxAgeDays ?? 60)) continue;
    let url = entry.url;
    try {
      url = canonicalUrl(entry.url);
    } catch {
      continue;
    }
    const title = titleFromFeed(entry.title, entry.html);
    const excerpt = excerptFromHtml(entry.html);
    if (source.broad && source.relevance && !source.relevance.test(`${title} ${excerpt}`)) continue;
    const tool = resolveTool(source, title, url);
    inputs.push({
      title,
      url,
      sourceId: source.id,
      tool,
      publishedAt: new Date(published).toISOString(),
      excerpt,
      priority: priorityOfTool(tool, source.priority),
      points: entry.points,
      version: entry.version,
    });
  }
  inputs.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.title.localeCompare(b.title));
  return inputs.slice(0, source.limit ?? 40);
}
