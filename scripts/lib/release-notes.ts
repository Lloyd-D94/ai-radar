import { plainTitle } from "./text.ts";
import type { RawEntry } from "./types.ts";
import { versionLabel } from "./version.ts";

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function monthNumber(name: string): number | null {
  return MONTHS[name.toLowerCase()] ?? null;
}

const LINK_BASE = "https://docs.x.ai/developers/release-notes";

/**
 * Pull dated sections from the xAI API release-notes page.
 * The page has no feed; callers store a hash and skip work when it is unchanged.
 */
export function parseReleaseNotes(html: string, now = Date.now(), maxAgeDays = 200): RawEntry[] {
  const updated = /Last updated:\s*[A-Za-z]+\s+\d{1,2},\s*(20\d{2})/i.exec(html);
  let cursorYear = updated ? Number(updated[1]) : new Date(now).getUTCFullYear();
  const headings: { index: number; year: number }[] = [];
  const h2re = /<h2\b[^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let prevMonth = 13;
  let heading: RegExpExecArray | null;
  while ((heading = h2re.exec(html))) {
    const text = plainTitle(heading[1] ?? "");
    const explicitYear = text.match(/\b(20\d{2})\b/);
    const month = monthNumber(text.split(/\s+/)[0] ?? "");
    if (!month) continue;
    if (explicitYear) cursorYear = Number(explicitYear[1]);
    else if (month > prevMonth) cursorYear -= 1;
    prevMonth = month;
    headings.push({ index: heading.index, year: cursorYear });
  }

  const entries: RawEntry[] = [];
  const entryRe = /<div class="relative">\s*([A-Za-z]+)\s+(\d{1,2})\s*<span/gi;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(html))) {
    const month = monthNumber(match[1] ?? "");
    const day = Number(match[2]);
    if (!month || day < 1 || day > 31) continue;
    const year = [...headings].reverse().find((item) => item.index < match!.index)?.year ?? cursorYear;
    const publishedMs = Date.UTC(year, month - 1, day);
    const ageDays = (now - publishedMs) / 86_400_000;
    if (ageDays > maxAgeDays || ageDays < -2) continue;
    const rest = html.slice(match.index);
    const h3 = /<h3\b[^>]*id="([^"]+)"[^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(rest);
    if (!h3?.[1] || !h3[2]) continue;
    const after = rest.slice((h3.index ?? 0) + h3[0].length);
    const endRel = after.search(/<div class="relative">\s*[A-Za-z]+\s+\d{1,2}\s*<span|<h2\b/i);
    const bodyHtml = endRel === -1 ? after.slice(0, 4000) : after.slice(0, endRel);
    const title = plainTitle(h3[2]);
    if (!title) continue;
    entries.push({
      title,
      url: `${LINK_BASE}#${h3[1]}`,
      publishedAt: new Date(publishedMs).toISOString(),
      html: bodyHtml,
      prerelease: false,
      version: versionLabel(title),
      points: null,
    });
  }
  return entries;
}
