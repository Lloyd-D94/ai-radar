import type { RawEntry } from "./types.ts";
import { isPrereleaseTitle, versionLabel } from "./version.ts";

export function parseGithubReleases(json: unknown): RawEntry[] {
  if (!Array.isArray(json)) return [];
  const entries: RawEntry[] = [];
  for (const row of json) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (record.draft === true) continue;
    const tag = typeof record.tag_name === "string" ? record.tag_name.trim() : "";
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : tag;
    const url = typeof record.html_url === "string" ? record.html_url : "";
    const published = typeof record.published_at === "string" ? record.published_at : "";
    const body = typeof record.body === "string" ? record.body : "";
    if (!url || !name || !published || Number.isNaN(Date.parse(published))) continue;
    if (/source archive|checksum/i.test(name) || /source archive|checksum/i.test(tag)) continue;
    const prerelease =
      record.prerelease === true || isPrereleaseTitle(name) || isPrereleaseTitle(tag);
    entries.push({
      title: name,
      url,
      publishedAt: new Date(published).toISOString(),
      html: body,
      prerelease,
      version: versionLabel(tag) ?? versionLabel(name),
      points: null,
    });
  }
  return entries;
}
