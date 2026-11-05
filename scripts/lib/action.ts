import type { Category } from "./types.ts";

/**
 * A Dutch action line only when the source text itself supports it.
 * Returns null instead of guessing. Replace this when an LLM step is added.
 */
export function actionLine(
  title: string,
  excerpt: string,
  category: Category,
  toolLabel: string,
): string | null {
  const text = `${title}. ${excerpt}`.replace(/\s+/g, " ");
  const now = text.match(/\byou can now\s+([^.]{8,160})/i);
  if (now?.[1]) {
    const clause = now[1].replace(/\s+/g, " ").trim();
    return `De bron: “you can now ${clause}.”`;
  }
  if (/\bis now available\b/i.test(text)) {
    return "De bron meldt dat dit nu beschikbaar is.";
  }
  if (category === "beveiliging") {
    return `De bron meldt een beveiligingswijziging voor ${toolLabel}.`;
  }
  if (category === "breaking-change") {
    return `De bron noemt een breaking change of uitfasering bij ${toolLabel}.`;
  }
  if (category === "prijswijziging") {
    return `De bron meldt een prijswijziging voor ${toolLabel}.`;
  }
  return null;
}
