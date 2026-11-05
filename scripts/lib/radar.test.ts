import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { applyRadarUpdate } from "../apply-radar-update.ts";
import { LIMITS, mergeAccounts, mergeRadar, parseAccount, sentenceCount, validateIncoming, type RadarAccount, type RadarExample, type RadarFile, type RadarStartup } from "./radar.ts";

const example = (patch: Partial<RadarExample> = {}): RadarExample => ({
  id: "ex-demo",
  date: "2026-11-04T18:00:00.000Z",
  author_handle: "someone",
  post_url: "https://x.com/someone/status/2118054007579296069",
  note_nl: "Een demo van een nieuwe mogelijkheid.",
  tool: "Grok Bot",
  kind: "demo",
  from_followed: false,
  ...patch,
});

const startup = (patch: Partial<RadarStartup> = {}): RadarStartup => ({
  id: "startup-demo",
  name: "Demo Lab",
  handle: "demolab",
  url: "https://x.com/demolab",
  one_liner_nl: "Een fictief lab voor de test.",
  why_new_nl: "Het lab staat er omdat de test een startup nodig heeft.",
  date_found: "2026-11-04T18:00:00.000Z",
  proof_url: "https://x.com/demolab/status/2118054007579296069",
  ...patch,
});

const account = (patch: Partial<RadarAccount> = {}): RadarAccount => ({
  handle: "demolab",
  name: "Demo Lab",
  category: "builder_demo",
  note_nl: "Een account voor de test.",
  already_followed: false,
  followers: 12,
  example_url: "https://x.com/demolab",
  ...patch,
});

const update = (exampleId = "ex-demo") => ({
  id: "upd-demo",
  date: "2026-11-04T18:00:00.000Z",
  tool: "Grok Bot",
  title_nl: "Bellen",
  summary_nl: "Grok Bot kan bellen. Mensen laten de bot een afspraak maken.",
  can_do_nl: ["Een afspraak laten maken", "Een airline bellen"],
  example_ids: [exampleId],
  source_urls: ["https://x.com/someone/status/2118054007579296069"],
  importance: 4,
});

describe("radar-validatie", () => {
  it("telt zinnen zonder versienummers te splijten", () => {
    assert.equal(sentenceCount("Release 1.0.77 voegt Shift+Enter toe."), 1);
    assert.equal(sentenceCount("Eerste zin. Tweede zin."), 2);
    assert.equal(sentenceCount("Een. Twee. Drie."), 3);
    assert.equal(sentenceCount("Gebruik AGENTS.md om de agent te sturen."), 1);
  });

  it("weigert een kapotte post-URL, te veel zinnen en te weinig punten", () => {
    const bad = {
      updates: [
        {
          ...update(),
          summary_nl: "Eén. Twee. Drie.",
          can_do_nl: [],
          source_urls: ["http://x.com/someone/status/1"],
          example_ids: ["bestaat-niet"],
        },
      ],
      examples: [{ ...example(), post_url: "https://x.com/other/status/1", author_handle: "someone" }],
      startups: [],
    };
    const issues = validateIncoming(bad).issues;
    assert.ok(issues.some((issue) => issue.includes("summary_nl")));
    assert.ok(issues.some((issue) => issue.includes("can_do_nl")));
    assert.ok(issues.some((issue) => issue.includes("https")));
    assert.ok(issues.some((issue) => issue.includes("onbekend voorbeeld")));
    assert.ok(issues.some((issue) => issue.includes("author_handle")));
  });

  it("accepteert een geldige update die naar een bestaand voorbeeld wijst", () => {
    const current: RadarFile = { updates: [], examples: [example()], startups: [] };
    const issues = validateIncoming({ updates: [update()], examples: [], startups: [] }, current.examples).issues;
    assert.deepEqual(issues, []);
  });

  it("bewaart optionele post-, startup- en accountvelden", () => {
    const rich = example({
      author_name: "Voorbeeld Auteur",
      author_avatar_url: "https://cdn.example.com/avatar.jpg",
      text: "Eerste zin van de post. Tweede zin mag hier wel.",
      media: [
        {
          type: "photo",
          url: "https://cdn.example.com/full.jpg",
          preview_url: "https://cdn.example.com/preview.jpg",
          alt: "Een schets",
        },
      ],
      metrics: { likes: 0, reposts: 2, replies: 1, views: 40 },
      lang: "nl",
    });
    const checked = validateIncoming({
      updates: [],
      examples: [rich],
      startups: [startup({ website_url: "https://example.com/lab", logo_url: "https://cdn.example.com/logo.png" })],
      accounts: [account({ avatar_url: "https://cdn.example.com/avatar.jpg" })],
    });
    assert.deepEqual(checked.issues, []);
    assert.equal(checked.examples[0]?.author_name, "Voorbeeld Auteur");
    assert.equal(checked.examples[0]?.text?.includes("Tweede zin"), true);
    assert.equal(checked.examples[0]?.media?.[0]?.preview_url, "https://cdn.example.com/preview.jpg");
    assert.equal(checked.examples[0]?.metrics?.likes, 0);
    assert.equal(checked.examples[0]?.lang, "nl");
    assert.equal(checked.startups[0]?.website_url, "https://example.com/lab");
    assert.equal(checked.startups[0]?.logo_url, "https://cdn.example.com/logo.png");
    assert.equal(checked.accounts[0]?.avatar_url, "https://cdn.example.com/avatar.jpg");
    const merged = mergeRadar({ updates: [], examples: [], startups: [] }, checked);
    assert.equal(merged.examples[0]?.media?.[0]?.type, "photo");
    const photoOnly = validateIncoming({
      updates: [],
      examples: [example({ media: [{ type: "photo", url: "https://cdn.example.com/only.jpg" }] })],
      startups: [],
    });
    assert.deepEqual(photoOnly.issues, []);
    assert.equal(photoOnly.examples[0]?.media?.[0]?.url, "https://cdn.example.com/only.jpg");
    const videoOnly = validateIncoming({
      updates: [],
      examples: [
        example({
          id: "ex-video",
          post_url: "https://x.com/someone/status/2118054007579296070",
          media: [{ type: "video", preview_url: "https://cdn.example.com/thumb.jpg" }],
        }),
      ],
      startups: [],
    });
    assert.deepEqual(videoOnly.issues, []);
    assert.equal(videoOnly.examples[0]?.media?.[0]?.preview_url, "https://cdn.example.com/thumb.jpg");
    const playable = validateIncoming({
      updates: [],
      examples: [
        example({
          id: "ex-mp4",
          post_url: "https://x.com/someone/status/2118054007579296071",
          media: [
            {
              type: "video",
              preview_url: "https://cdn.example.com/thumb.jpg",
              video_url: "https://video.example.com/clip.mp4?tag=14",
              width: 1920,
              height: 1080,
              duration_ms: 42033,
            },
          ],
        }),
      ],
      startups: [],
    });
    assert.deepEqual(playable.issues, []);
    assert.equal(playable.examples[0]?.media?.[0]?.video_url, "https://video.example.com/clip.mp4?tag=14");
    assert.equal(playable.examples[0]?.media?.[0]?.duration_ms, 42033);
    const badVideo = validateIncoming({
      updates: [],
      examples: [
        example({
          id: "ex-bad-mp4",
          post_url: "https://x.com/someone/status/2118054007579296072",
          media: [{ type: "video", preview_url: "https://cdn.example.com/thumb.jpg", video_url: "https://video.example.com/clip.m3u8" }],
        }),
      ],
      startups: [],
    }).issues;
    assert.ok(badVideo.some((issue) => issue.includes("video_url")));
    assert.equal(merged.startups[0]?.website_url, "https://example.com/lab");
    assert.equal(mergeAccounts([], checked.accounts)[0]?.avatar_url, "https://cdn.example.com/avatar.jpg");
  });

  it("weigert kapotte avatars, media, metrics en HTML in de posttekst", () => {
    const issues = validateIncoming({
      updates: [],
      examples: [
        {
          ...example(),
          author_avatar_url: "http://cdn.example.com/a.jpg",
          text: `<p>${"x".repeat(500)}</p>`,
          lang: "nederlands",
          media: [
            { type: "audio", url: "notaurl", preview_url: "https://cdn.example.com/p.jpg" },
            { type: "photo", url: "https://cdn.example.com/a.jpg", preview_url: "https://cdn.example.com/b.jpg" },
            { type: "photo", url: "https://cdn.example.com/c.jpg", preview_url: "https://cdn.example.com/d.jpg" },
            { type: "gif", url: "https://cdn.example.com/e.jpg", preview_url: "https://cdn.example.com/f.jpg" },
            { type: "video", url: "https://cdn.example.com/g.jpg", preview_url: "https://cdn.example.com/h.jpg" },
          ],
          metrics: { likes: -1, views: 1.5, saves: 3 },
        },
      ],
      startups: [startup({ website_url: "http://example.com", logo_url: "data:image/svg+xml,abc" })],
      accounts: [account({ avatar_url: "data:image/svg+xml,abc" })],
    }).issues;
    assert.ok(issues.some((issue) => issue.includes("author_avatar_url")));
    assert.ok(issues.some((issue) => issue.includes("platte tekst")));
    assert.ok(issues.some((issue) => issue.includes("text") && issue.includes("500")));
    assert.ok(issues.some((issue) => issue.includes("lang")));
    assert.ok(issues.some((issue) => issue.includes("media")));
    assert.ok(issues.some((issue) => issue.includes("type")));
    assert.ok(issues.some((issue) => issue.includes("likes")));
    assert.ok(issues.some((issue) => issue.includes("views")));
    assert.ok(issues.some((issue) => issue.includes("saves")));
    assert.ok(issues.some((issue) => issue.includes("website_url")));
    assert.ok(issues.some((issue) => issue.includes("logo_url")));
    assert.ok(issues.some((issue) => issue.includes("avatar_url")));
  });

  it("weigert dubbele ids in hetzelfde bestand", () => {
    const issues = validateIncoming({
      updates: [],
      examples: [example(), example()],
      startups: [],
    }).issues;
    assert.ok(issues.some((issue) => issue.includes("dubbel")));
  });
});

describe("radar-merge", () => {
  it("vervangt op id en op post-URL en houdt het nieuwste", () => {
    const current: RadarFile = {
      updates: [{ ...update(), title_nl: "Oud" }],
      examples: [example()],
      startups: [],
    };
    const next = mergeRadar(current, {
      updates: [{ ...update(), title_nl: "Nieuw", importance: 5 }],
      examples: [{ ...example(), id: "ex-ander", note_nl: "Nieuwere noot." }],
      startups: [],
    });
    assert.equal(next.updates.length, 1);
    assert.equal(next.updates[0]?.title_nl, "Nieuw");
    assert.equal(next.examples.length, 1);
    assert.equal(next.examples[0]?.id, "ex-ander");
    assert.equal(mergeAccounts([{ handle: "Bot", name: "Oud", category: "xai_grok", note_nl: "a", already_followed: true, followers: 1, example_url: "https://x.com/bot" }], [{ handle: "bot", name: "Nieuw", category: "xai_grok", note_nl: "b", already_followed: false, followers: 2, example_url: "https://x.com/bot" }])[0]?.name, "Nieuw");
  });

  it("gooit de oudste voorbeelden weg boven de limiet", () => {
    const examples: RadarExample[] = Array.from({ length: LIMITS.examples + 5 }, (_, index) =>
      example({
        id: `ex-${index}`,
        post_url: `https://x.com/someone/status/${index + 1}`,
        date: new Date(Date.UTC(2020, 0, 1) + index * 86_400_000).toISOString(),
      }),
    );
    const next = mergeRadar({ updates: [], examples: [], startups: [] }, { updates: [], examples, startups: [] });
    assert.equal(next.examples.length, LIMITS.examples);
    assert.equal(next.examples[0]?.id, `ex-${LIMITS.examples + 4}`);
    assert.equal(next.examples.at(-1)?.id, "ex-5");
  });

  it("schrijft niets weg als de update ongeldig is", () => {
    const root = mkdtempSync(join(tmpdir(), "radar-"));
    const radarPath = join(root, "data");
    mkdirSync(radarPath);
    writeFileSync(join(root, "radar-update.json"), JSON.stringify({ updates: [{ id: "kapot" }], examples: [], startups: [] }));
    writeFileSync(join(radarPath, "radar.json"), `${JSON.stringify({ updates: [], examples: [], startups: [] })}\n`);
    writeFileSync(join(radarPath, "accounts.json"), "[]\n");
    const before = readFileSync(join(radarPath, "radar.json"), "utf8");
    assert.throws(() => applyRadarUpdate(root, join(root, "radar-update.json")));
    assert.equal(readFileSync(join(radarPath, "radar.json"), "utf8"), before);
  });

  it("de fixture is voorbeelddata en blijft buiten data/", () => {
    const fixture = JSON.parse(readFileSync("web/dev/fixtures/radar.fixture.json", "utf8")) as {
      fixture?: boolean;
      notice?: string;
      examples?: Array<{ text?: string; author_name?: string; author_avatar_url?: string }>;
    };
    assert.equal(fixture.fixture, true);
    assert.match(fixture.notice ?? "", /voorbeeld/i);
    assert.ok((fixture.examples?.length ?? 0) >= 8 && (fixture.examples?.length ?? 0) <= 12);
    assert.ok(fixture.examples?.every((item) => /voorbeeld/i.test(item.text ?? "") && String(item.author_avatar_url).startsWith("data:image/")));
    const production = readFileSync("data/radar.json", "utf8");
    assert.equal(production.includes("voorbeeld_a"), false);
  });

  it("de startset in data/ is geldig en komt uit het rapport", () => {
    const radar = JSON.parse(readFileSync("data/radar.json", "utf8")) as RadarFile & { examples: RadarExample[] };
    const accounts = JSON.parse(readFileSync("data/accounts.json", "utf8")) as unknown[];
    const issues = [
      ...validateIncoming(radar).issues,
      ...accounts.flatMap((account, index) => {
        const found: string[] = [];
        parseAccount(account, `accounts[${index}]`, found);
        return found;
      }),
    ];
    assert.deepEqual(issues, []);
    assert.equal(radar.examples.length, 12);
    assert.equal(radar.updates.length, 9);
    assert.equal(radar.startups.length, 10);
    assert.equal(accounts.length, 129);
    assert.ok(radar.examples.every((item) => item.seed === true));
    assert.ok(radar.updates.every((item) => item.seed === true));
    assert.ok(radar.startups.every((item) => item.seed === true));
  });
});
