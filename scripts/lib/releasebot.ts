import type { RawEntry } from "./types.ts";
import { versionLabel } from "./version.ts";

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

function utcDate(text: string): string | null {
  const match = text.match(new RegExp(`^(${MONTH})\\s+(\\d{1,2}),\\s+(20\\d{2})$`, "i"));
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return new Date(Date.UTC(Number(match[3]), month - 1, Number(match[2]))).toISOString();
}

/** Optional fallback when the official Grok Build feed cannot be fetched. */
export function parseReleasebot(html: string): RawEntry[] {
  const parts = html.split(/<h2\b/i);
  let offset = parts[0]?.length ?? 0;
  const entries: RawEntry[] = [];
  for (const part of parts.slice(1)) {
    const start = offset;
    offset += part.length + 3;
    const title = part.match(/Grok Build \d+\.\d+\.\d+/i)?.[0];
    if (!title) continue;
    const prose = part.match(/<!-- HTML_TAG_START -->([\s\S]*?)<!-- HTML_TAG_END -->/gi) ?? [];
    const notes = prose.length > 1 ? prose[prose.length - 1] : prose[0];
    const body = notes?.replace(/<!-- HTML_TAG_START -->|<!-- HTML_TAG_END -->/g, "").trim() ?? "";
    if (!body || !/<(p|ul|li|h3)\b/i.test(body)) continue;
    const before = html.slice(Math.max(0, start - 700), start);
    const dates = [...before.matchAll(new RegExp(`\\b(?:${MONTH})\\s+\\d{1,2},\\s+20\\d{2}\\b`, "g"))];
    const publishedAt = utcDate(dates.at(-1)?.[0] ?? "");
    if (!publishedAt) continue;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    entries.push({
      title,
      url: `https://releasebot.io/updates/xai#${slug}`,
      publishedAt,
      html: body,
      prerelease: false,
      version: versionLabel(title),
      points: null,
    });
  }
  return entries;
}
