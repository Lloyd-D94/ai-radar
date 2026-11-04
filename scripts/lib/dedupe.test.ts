import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clusterItems, sameStory, titleHash } from "./dedupe.ts";
import { scoreItem } from "./score.ts";
import type { ItemInput } from "./types.ts";
import { canonicalUrl } from "./urls.ts";

function item(patch: Partial<ItemInput> & Pick<ItemInput, "title" | "url">): ReturnType<typeof scoreItem> {
  return scoreItem({
    sourceId: "fixture",
    tool: "grok-bot",
    publishedAt: "2026-11-01T00:00:00.000Z",
    excerpt: "Brontekst.",
    priority: "primair",
    ...patch,
  });
}

describe("dedupe", () => {
  it("normaliseert URL’s en houdt een versie-anker", () => {
    assert.equal(
      canonicalUrl("http://www.x.ai/changelog/build/?utm_source=nl#v1.0.70-2026-10-23"),
      "https://x.ai/changelog/build#v1.0.70-2026-10-23",
    );
    assert.equal(titleHash("Grok Build 1.0.70"), titleHash("grok   build 1.0.70!"));
    assert.notEqual(titleHash("Grok Build 1.0.70"), titleHash("Grok Build 1.0.69"));
  });

  it("groepeert hetzelfde verhaal en laat verschillende patches los", () => {
    const official = item({
      title: "Introducing Grok Bot",
      url: "https://x.ai/news/introducing-grok-bot",
      sourceId: "xai-news",
      excerpt: "Grok Bot is your team of always-on agents.",
    });
    const community = item({
      title: "Introducing Grok Bot",
      url: "https://news.ycombinator.com/item?id=1",
      sourceId: "hacker-news",
      tool: "hacker-news",
      priority: "community",
      publishedAt: "2026-11-02T00:00:00.000Z",
      points: 180,
    });
    const patchA = item({
      title: "Grok Build 1.0.70",
      url: "https://x.ai/changelog/build#v1.0.70",
      tool: "grok-build",
      sourceId: "grok-build",
    });
    const patchB = item({
      title: "Grok Build 1.0.69",
      url: "https://x.ai/changelog/build#v1.0.69",
      tool: "grok-build",
      sourceId: "grok-build",
      publishedAt: "2026-10-22T00:00:00.000Z",
    });
    assert.equal(sameStory(official, community), true);
    assert.equal(sameStory(patchA, patchB), false);
    const grouped = clusterItems([community, official, patchA, patchB]);
    const story = grouped.find((entry) => entry.title === "Introducing Grok Bot");
    assert.equal(story?.sourceId, "xai-news");
    assert.equal(story?.alsoSeenAt.length, 1);
    assert.equal(story?.alsoSeenAt[0]?.sourceId, "hacker-news");
    assert.equal(grouped.filter((entry) => entry.tool === "grok-build").length, 2);
  });
});
