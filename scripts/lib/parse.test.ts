import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { parseFeed } from "./feed.ts";
import { parseGithubReleases } from "./github.ts";
import { parseHnHits } from "./hn.ts";
import { parseNewsPage } from "./news-page.ts";
import { parseReleasebot } from "./releasebot.ts";
import { parseReleaseNotes } from "./release-notes.ts";
import { selectEntries } from "./select.ts";
import { parseSitemap } from "./sitemap.ts";
import { excerptFromHtml } from "./text.ts";
import type { SourceConfig } from "./types.ts";

const fixture = (name: string): string =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../fixtures", name), "utf8");

const feedSource = (patch: Partial<SourceConfig>): SourceConfig => ({
  id: "fixture",
  name: "Fixture",
  description: "",
  url: "https://example.com/feed",
  kind: "feed",
  tool: "cursor",
  priority: "secundair",
  optional: false,
  broad: false,
  ...patch,
});

describe("feeds en pagina's", () => {
  it("leest RSS, inclusief een datumtitel en HTML-entities", () => {
    const entries = parseFeed(fixture("sample-rss.xml"));
    assert.equal(entries.length, 3);
    assert.equal(entries[0]?.title, "Grok Build 1.0.70");
    assert.equal(entries[0]?.url, "https://x.ai/changelog/build#v1.0.70-2026-10-23");
    assert.match(entries[0]?.html ?? "", /blank line/);
    const selected = selectEntries(feedSource({ tool: "lovable", id: "lovable" }), entries);
    const dreaming = selected.find((item) => item.title === "Dreaming: memory");
    assert.ok(dreaming);
    assert.equal(dreaming.url, "https://docs.lovable.dev/changelog#nov-4-2026");
    const copilot = selected.find((item) => item.title.includes("Xcode"));
    assert.match(copilot?.title ?? "", /Xcode’s coding assistant/);
    assert.doesNotMatch(copilot?.excerpt ?? "", /appeared first on The GitHub Blog/);
    assert.match(copilot?.excerpt ?? "", /You can now work with GitHub Copilot/);
  });

  it("leest Atom en laat nightlies en source archives vallen", () => {
    const entries = parseFeed(fixture("sample-atom.xml"));
    assert.equal(entries.length, 3);
    assert.equal(entries[0]?.prerelease, false);
    assert.equal(entries[1]?.prerelease, true);
    const kept = selectEntries(
      feedSource({ id: "claude-code", tool: "claude-code", kind: "github-releases" }),
      entries,
    );
    assert.deepEqual(
      kept.map((item) => item.title),
      ["v2.1.318"],
    );
  });

  it("leest een sitemap en een xAI-nieuwspagina", () => {
    const urls = parseSitemap(fixture("sample-sitemap.xml"));
    assert.equal(urls.length, 3);
    assert.equal(urls[1]?.loc, "https://x.ai/news/introducing-grok-bot");
    assert.equal(urls[1]?.lastmod, "2026-08-11T00:00:00.000Z");
    const news = parseNewsPage(fixture("sample-news.html"));
    assert.equal(news?.title, "Introducing Grok Bot");
    assert.equal(news?.description, "Grok Bot is your team of always-on agents.");
    assert.equal(news?.publishedAt, "2026-08-11T00:00:00.000Z");
  });

  it("haalt release notes uit de pagina en slaat oude jaren over", () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    const entries = parseReleaseNotes(fixture("sample-release-notes.html"), now, 200);
    assert.deepEqual(
      entries.map((entry) => entry.title),
      ["Custom moderation controls", "Grok 4.7"],
    );
    assert.equal(entries[0]?.url, "https://docs.x.ai/developers/release-notes#custom-moderation-controls");
    assert.equal(entries[0]?.publishedAt, "2026-11-02T00:00:00.000Z");
    assert.equal(entries[1]?.publishedAt, "2026-10-27T00:00:00.000Z");
    assert.match(entries[0]?.html ?? "", /content guidelines/);
  });

  it("pakt bij Releasebot de bronnotities, niet de herschreven samenvatting", () => {
    const entries = parseReleasebot(fixture("sample-releasebot.html"));
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.title, "Grok Build 1.0.70");
    assert.match(entries[0]?.html ?? "", /blank line/);
    assert.doesNotMatch(entries[0]?.html ?? "", /Rewritten summary/);
    assert.equal(entries[0]?.publishedAt, "2026-10-23T00:00:00.000Z");
  });

  it("filtert Hacker News en GitHub-prereleases", () => {
    const hits = parseHnHits({
      hits: [
        {
          title: "Show HN: Claude Code tips",
          url: "https://example.com/claude",
          points: 120,
          created_at: "2026-11-03T00:00:00.000Z",
          objectID: "1",
        },
        {
          title: "A story about cooking",
          url: "https://example.com/food",
          points: 400,
          created_at: "2026-11-03T00:00:00.000Z",
          objectID: "2",
        },
        {
          title: "Cursor AI discussion",
          points: 40,
          created_at: "2026-11-03T00:00:00.000Z",
          objectID: "3",
        },
      ],
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.title, "Show HN: Claude Code tips");
    const releases = parseGithubReleases([
      {
        tag_name: "0.168.0-alpha.2",
        name: "0.168.0-alpha.2",
        html_url: "https://github.com/openai/codex/releases/tag/rust-v0.168.0-alpha.2",
        published_at: "2026-11-04T19:23:31Z",
        body: "alpha",
        prerelease: true,
        draft: false,
      },
      {
        tag_name: "rust-v0.166.0",
        name: "0.166.0",
        html_url: "https://github.com/openai/codex/releases/tag/rust-v0.166.0",
        published_at: "2026-10-29T19:47:53Z",
        body: "Stable notes",
        prerelease: false,
        draft: false,
      },
      {
        tag_name: "draft",
        name: "hidden",
        html_url: "https://github.com/openai/codex/releases/tag/draft",
        published_at: "2026-11-01T00:00:00Z",
        body: "",
        draft: true,
        prerelease: false,
      },
    ]);
    assert.equal(releases.length, 2);
    assert.equal(releases[0]?.prerelease, true);
    assert.equal(releases[1]?.prerelease, false);
    assert.equal(excerptFromHtml("Stable notes"), "Stable notes");
  });
});
