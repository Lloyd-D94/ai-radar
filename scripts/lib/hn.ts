export interface HnHit {
  title: string;
  url: string;
  points: number;
  createdAt: string;
}

export const HN_TITLE =
  /\b(claude|cursor|codex|gemini|copilot|grok|lovable|replit|vibe[\s-]?coding|coding agent|ai coding)\b/i;

export const HN_QUERIES = [
  "claude code",
  "cursor ai",
  "openai codex",
  "gemini cli",
  "github copilot",
  "vibe coding",
  "grok build",
  "grok bot",
  "lovable",
  "replit agent",
];

export function hnSearchUrl(query: string, sinceUnix: number): string {
  const params = new URLSearchParams({
    tags: "story",
    hitsPerPage: "15",
    query,
  });
  params.set("numericFilters", `points>80,created_at_i>${sinceUnix}`);
  return `https://hn.algolia.com/api/v1/search_by_date?${params.toString()}`;
}

export function parseHnHits(json: unknown): HnHit[] {
  if (!json || typeof json !== "object") return [];
  const hits = (json as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];
  const out: HnHit[] = [];
  for (const hit of hits) {
    if (!hit || typeof hit !== "object") continue;
    const record = hit as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const objectId = typeof record.objectID === "string" ? record.objectID : "";
    const external = typeof record.url === "string" ? record.url.trim() : "";
    const url = external || (objectId ? `https://news.ycombinator.com/item?id=${objectId}` : "");
    const points = typeof record.points === "number" ? record.points : 0;
    const created = typeof record.created_at === "string" ? record.created_at : "";
    if (!title || !url || !created || Number.isNaN(Date.parse(created))) continue;
    if (points < 80 || !HN_TITLE.test(title)) continue;
    out.push({ title, url, points, createdAt: new Date(created).toISOString() });
  }
  return out;
}
