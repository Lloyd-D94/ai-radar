import { createHash } from "node:crypto";

import type { Item, Priority } from "./types.ts";

const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "for",
  "and",
  "to",
  "in",
  "on",
  "with",
  "now",
  "is",
  "release",
  "from",
  "your",
  "this",
  "that",
  "its",
  "you",
  "are",
  "van",
  "het",
  "een",
]);

const RANK: Record<Priority, number> = { primair: 0, secundair: 1, community: 2 };

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function titleHash(title: string): string {
  return createHash("sha256").update(normalizeTitle(title)).digest("hex").slice(0, 16);
}

function tokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((token) => token.length > 2 && !STOP.has(token) && !/^\d+$/.test(token)),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function versionsConflict(left: Item, right: Item): boolean {
  if (!left.version || !right.version) return false;
  return left.version !== right.version;
}

export function sameStory(left: Item, right: Item): boolean {
  if (left.url === right.url) return true;
  if (titleHash(left.title) === titleHash(right.title)) return true;
  if (versionsConflict(left, right)) return false;
  const leftTokens = tokens(left.title);
  const rightTokens = tokens(right.title);
  if (leftTokens.size < 2 || rightTokens.size < 2) return false;
  const days = Math.abs(Date.parse(left.publishedAt) - Date.parse(right.publishedAt)) / 86_400_000;
  if (Number.isNaN(days) || days > 5) return false;
  const sameTool = left.tool === right.tool;
  const communityBridge = left.priority === "community" || right.priority === "community";
  if (!sameTool && !communityBridge) return false;
  return jaccard(leftTokens, rightTokens) >= 0.72;
}

function leaderSort(left: Item, right: Item): number {
  const rank = RANK[left.priority] - RANK[right.priority];
  if (rank !== 0) return rank;
  if (right.score !== left.score) return right.score - left.score;
  if (right.excerpt.length !== left.excerpt.length) return right.excerpt.length - left.excerpt.length;
  return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
}

export function clusterItems(items: Item[]): Item[] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor] ?? cursor;
    let compress = index;
    while (parent[compress] !== cursor) {
      const next = parent[compress] ?? cursor;
      parent[compress] = cursor;
      compress = next;
    }
    return cursor;
  };
  const union = (left: number, right: number): void => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left && right && sameStory(left, right)) union(i, j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let index = 0; index < items.length; index += 1) {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(index);
    groups.set(root, list);
  }
  const clustered: Item[] = [];
  for (const indexes of groups.values()) {
    const ordered = indexes
      .map((index) => items[index])
      .filter((item): item is Item => Boolean(item))
      .sort(leaderSort);
    const leader = ordered[0];
    if (!leader) continue;
    clustered.push({
      ...leader,
      alsoSeenAt: ordered.slice(1, 7).map((item) => ({
        sourceId: item.sourceId,
        url: item.url,
        title: item.title,
      })),
    });
  }
  return clustered.sort(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || left.id.localeCompare(right.id),
  );
}
