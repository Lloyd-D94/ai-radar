import type { Category } from "./types.ts";
import { isPatchRelease, versionLabel } from "./version.ts";

/**
 * Release titles are often just a version, so the notes carry the signal.
 * Essays and newsletters only count when the title itself says so — one
 * keyword halfway down a roundup should not mark the whole piece.
 */
function hardSignal(title: string, excerpt: string): string {
  const releaseTitle = isPatchRelease(title) || /\b(release|v?\d+\.\d+\.\d+)\b/i.test(title);
  return releaseTitle ? `${title}\n${excerpt}` : title;
}

export interface Classification {
  category: Category;
  isPatch: boolean;
  version: string | null;
  belangrijk: boolean;
}

const BREAKING =
  /\b(breaking change|breaking changes|backward[-\s]?incompatible|backwards[-\s]?incompatible|action required|migration required|end of life|no longer supported)\b/i;
const SECURITY =
  /\b(cve-\d{4}-\d+|vulnerability|security fix|security patch|authentication bypass|auth bypass|privilege escalation|sandbox escape)\b/i;
const PRICING = /\b(pricing|price increase|price change|raises the price|billing change|free tier)\b/i;
const MODEL = /\b(grok[-\s]?\d+(?:\.\d+)?|gpt-\d|gemini[-\s]?\d|claude[-\s]?(?:opus|sonnet|haiku|\d)|new model)\b/i;
const TUTORIAL = /\b(tutorial|walkthrough|how to)\b/i;
const FEATURE = /\b(introducing|introduced|now available|generally available|you can now|new feature)\b/i;

/**
 * Deterministic stand-in for a later LLM classifier.
 * Replace this function; keep the Classification shape stable.
 */
export function classify(title: string, excerpt: string): Classification {
  const isPatch = isPatchRelease(title);
  const version = versionLabel(title);
  const hard = hardSignal(title, excerpt);
  const blob = `${title}\n${excerpt}`;
  let category: Category = "overig";
  if (BREAKING.test(hard)) category = "breaking-change";
  else if (SECURITY.test(hard)) category = "beveiliging";
  else if (PRICING.test(hard)) category = "prijswijziging";
  else if (MODEL.test(title)) category = "model";
  else if (TUTORIAL.test(title)) category = "tutorial";
  else if (!isPatch && FEATURE.test(blob)) category = "nieuwe-functie";
  const belangrijk =
    category === "breaking-change" || category === "beveiliging" || category === "prijswijziging";
  return { category, isPatch, version, belangrijk };
}
