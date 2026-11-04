import type { Item } from "./types.ts";

export function retainItems(items: Item[], now = Date.now()): Item[] {
  const byTool = new Map<string, Item[]>();
  for (const item of items) {
    const list = byTool.get(item.tool) ?? [];
    list.push(item);
    byTool.set(item.tool, list);
  }
  const kept: Item[] = [];
  for (const list of byTool.values()) {
    const sorted = [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    const pinned = new Set(sorted.filter((item) => item.score >= 4 || item.belangrijk));
    const patches = sorted.filter((item) => item.isPatch && !pinned.has(item)).slice(0, 30);
    const others = sorted.filter((item) => !item.isPatch && !pinned.has(item)).slice(0, 20);
    const seen = new Set<string>();
    for (const item of [...pinned, ...patches, ...others]) {
      if (seen.has(item.id)) continue;
      const ageDays = (now - Date.parse(item.publishedAt)) / 86_400_000;
      if (!item.belangrijk && item.score < 4 && ageDays > 540) continue;
      seen.add(item.id);
      kept.push(item);
    }
  }
  return kept.sort(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || left.id.localeCompare(right.id),
  );
}
