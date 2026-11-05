import { actionLine } from "./action.ts";
import { classify } from "./classify.ts";
import { toolLabel } from "./tools.ts";
import type { Item, ItemInput, Priority } from "./types.ts";
import { canonicalUrl, itemId } from "./urls.ts";

const BASE: Record<Priority, number> = { primair: 4, secundair: 3, community: 2 };

export function scoreItem(input: ItemInput): Item {
  const classified = classify(input.title, input.excerpt);
  const reasons: string[] = [];
  let score = BASE[input.priority];
  reasons.push(
    input.priority === "primair"
      ? "Prioriteitsbron (start op 4)"
      : input.priority === "secundair"
        ? "Secundaire bron (start op 3)"
        : "Communitybron (start op 2)",
  );
  if (classified.belangrijk) {
    score += 2;
    reasons.push("Beveiliging, prijs of breaking change (+2, minimaal 5)");
    score = Math.max(score, 5);
  }
  if (classified.category === "model") {
    score += 1;
    reasons.push("Model in de titel (+1)");
  }
  if (classified.category === "nieuwe-functie") {
    score += 1;
    reasons.push("Nieuwe functie volgens de brontekst (+1)");
  }
  if (classified.category === "tutorial") {
    score -= 1;
    reasons.push("Tutorial of gids (−1)");
  }
  if (classified.isPatch && !classified.belangrijk) {
    score -= 1;
    reasons.push("Patchrelease (−1)");
  } else if (classified.version && input.priority !== "community") {
    score += 1;
    reasons.push("Stabiele release, geen patch (+1)");
  }
  if (input.priority === "community" && (input.points ?? 0) >= 200) {
    score += 1;
    reasons.push("Hoge community-score, 200+ punten (+1)");
  }
  if (input.priority === "community" && !classified.belangrijk) {
    score = Math.min(score, 4);
    reasons.push("Community blijft maximaal 4, tenzij beveiliging, prijs of breaking change");
  }
  score = Math.max(1, Math.min(5, score));
  const version = input.version ?? classified.version;
  const bundleKey =
    classified.isPatch && !classified.belangrijk ? `${input.tool}:${input.publishedAt.slice(0, 10)}` : null;
  return {
    id: itemId(input.url),
    title: input.title,
    url: canonicalUrl(input.url),
    sourceId: input.sourceId,
    tool: input.tool,
    publishedAt: input.publishedAt,
    excerpt: input.excerpt,
    version,
    category: classified.category,
    score,
    scoreReasons: reasons,
    actionLine: actionLine(input.title, input.excerpt, classified.category, toolLabel(input.tool)),
    priority: input.priority,
    isPatch: classified.isPatch,
    belangrijk: classified.belangrijk,
    bundleKey,
    points: input.points ?? null,
    alsoSeenAt: [],
  };
}
