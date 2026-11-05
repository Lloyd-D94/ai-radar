import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { applyRadarUpdate } from "../apply-radar-update.ts";
import { LIMITS, mergeAccounts, mergeRadar, parseAccount, sentenceCount, validateIncoming, type RadarExample, type RadarFile } from "./radar.ts";

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
          can_do_nl: ["alleen dit"],
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
