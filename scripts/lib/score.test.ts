import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { retainItems } from "./retain.ts";
import { scoreItem } from "./score.ts";
import type { ItemInput } from "./types.ts";

function score(patch: Partial<ItemInput> & Pick<ItemInput, "title">): ReturnType<typeof scoreItem> {
  return scoreItem({
    url: `https://example.com/${encodeURIComponent(patch.title)}`,
    sourceId: "fixture",
    tool: "cursor",
    publishedAt: "2026-11-04T00:00:00.000Z",
    excerpt: "",
    priority: "secundair",
    ...patch,
  });
}

describe("scoring", () => {
  it("legt beveiliging, prijs en breaking change op minimaal 5", () => {
    const security = score({
      title: "v2.1.318",
      tool: "claude-code",
      excerpt: "Fixed a security fix for a sandbox escape.",
    });
    assert.equal(security.category, "beveiliging");
    assert.equal(security.score, 5);
    assert.equal(security.belangrijk, true);
    assert.equal(security.isPatch, true);
    assert.equal(security.bundleKey, null);
    assert.match(security.actionLine ?? "", /beveiligingswijziging/);
    assert.ok(security.scoreReasons.length > 0);

    const pricing = score({
      title: "Copilot pricing change",
      tool: "copilot",
      excerpt: "The free tier stays, the paid pricing changed.",
    });
    assert.equal(pricing.category, "prijswijziging");
    assert.equal(pricing.score, 5);
    assert.match(pricing.actionLine ?? "", /prijswijziging/);

    const breaking = score({
      title: "grok-voice-transcribe-1.0 end of life",
      tool: "xai-api",
      excerpt: "This model is no longer supported.",
    });
    assert.equal(breaking.category, "breaking-change");
    assert.equal(breaking.score, 5);
  });

  it("haalt een gewone patch onder de standaarddrempel en verzint geen actie", () => {
    const patch = score({
      title: "Grok Build 1.0.70",
      tool: "grok-build",
      priority: "primair",
      excerpt: "Answered questions now have a blank line between them.",
      url: "https://x.ai/changelog/build#v1.0.70-2026-10-23",
    });
    assert.equal(patch.category, "overig");
    assert.equal(patch.isPatch, true);
    assert.equal(patch.score, 3);
    assert.equal(patch.actionLine, null);
    assert.equal(patch.bundleKey, "grok-build:2026-11-04");
    assert.match(patch.scoreReasons.join(" "), /Patchrelease/);
  });

  it("geeft een nieuwe functie een actieregel alleen als de bron die zin bevat", () => {
    const feature = score({
      title: "GitHub Copilot is now available in Xcode",
      tool: "copilot",
      excerpt: "You can now work with GitHub Copilot directly in Xcode.",
    });
    assert.equal(feature.category, "nieuwe-functie");
    assert.equal(feature.score, 4);
    assert.match(feature.actionLine ?? "", /you can now work with GitHub Copilot directly in Xcode/);

    const vague = score({
      title: "Agent SDK",
      tool: "cursor",
      excerpt: "Define an agent as a folder of code.",
    });
    assert.equal(vague.actionLine, null);
    assert.equal(vague.score, 3);

    const release = score({
      title: "Release v0.67.0",
      tool: "gemini-cli",
      excerpt: "Changelog for an earlier nightly.",
    });
    assert.equal(release.score, 4);
    assert.equal(release.category, "overig");

    const newsletter = score({
      title: "October sponsors-only newsletter",
      tool: "simon-willison",
      priority: "community",
      excerpt: "This month: The vulnerability apocalypse gets hot. Twice the price for a faster model.",
    });
    assert.equal(newsletter.category, "overig");
    assert.equal(newsletter.belangrijk, false);
    assert.ok(newsletter.score <= 4);
  });

  it("begrenst community en bewaart oude belangrijke items", () => {
    const community = score({
      title: "How to use Cursor for vibe coding",
      tool: "hacker-news",
      priority: "community",
      points: 260,
      excerpt: "A long thread.",
    });
    assert.equal(community.category, "tutorial");
    assert.ok(community.score <= 4);
    assert.ok(community.score >= 1);

    const oldImportant = score({
      title: "Old pricing change",
      publishedAt: "2024-01-01T00:00:00.000Z",
      excerpt: "A pricing change for the free tier.",
    });
    const oldNoise = score({
      title: "Old patch 1.2.3",
      tool: "codex",
      publishedAt: "2024-01-01T00:00:00.000Z",
      excerpt: "Minor fixes.",
    });
    const kept = retainItems([oldImportant, oldNoise], Date.parse("2026-11-04T00:00:00.000Z"));
    assert.equal(kept.some((item) => item.title === "Old pricing change"), true);
    assert.equal(kept.some((item) => item.title === "Old patch 1.2.3"), false);
  });
});
