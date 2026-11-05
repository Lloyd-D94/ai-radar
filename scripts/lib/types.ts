export type Priority = "primair" | "secundair" | "community";

export type Category =
  | "nieuwe-functie"
  | "prijswijziging"
  | "model"
  | "beveiliging"
  | "breaking-change"
  | "tutorial"
  | "overig";

export type Health = "ok" | "fout" | "onbekend";

export type Via = "direct" | "jina" | "gemengd";

export interface ItemInput {
  title: string;
  url: string;
  sourceId: string;
  tool: string;
  publishedAt: string;
  excerpt: string;
  priority: Priority;
  points?: number | null;
  version?: string | null;
}

export interface AlsoSeen {
  sourceId: string;
  url: string;
  title: string;
}

export interface Item {
  id: string;
  title: string;
  url: string;
  sourceId: string;
  tool: string;
  publishedAt: string;
  excerpt: string;
  version: string | null;
  category: Category;
  score: number;
  scoreReasons: string[];
  actionLine: string | null;
  priority: Priority;
  isPatch: boolean;
  belangrijk: boolean;
  bundleKey: string | null;
  points: number | null;
  alsoSeenAt: AlsoSeen[];
}

export interface RawEntry {
  title: string;
  url: string;
  publishedAt: string;
  html: string;
  prerelease: boolean;
  version: string | null;
  points: number | null;
}

export interface ToolInfo {
  id: string;
  label: string;
  priority: Priority;
}

export interface SourceConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  kind: "feed" | "github-releases" | "sitemap-news" | "release-notes" | "hn" | "releasebot";
  tool: string;
  priority: Priority;
  optional: boolean;
  broad: boolean;
  maxAgeDays?: number;
  limit?: number;
  githubRepo?: string;
  relevance?: RegExp;
}

export interface SourceStatus {
  id: string;
  name: string;
  description: string;
  url: string;
  kind: SourceConfig["kind"];
  tool: string;
  priority: Priority;
  optional: boolean;
  health: Health;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  note: string | null;
  via: Via | null;
  itemsFetched: number;
}

export interface RadarState {
  version: 1;
  sitemaps: Record<string, { etag: string | null; urls: { loc: string; lastmod: string | null }[] }>;
  pages: Record<string, { hash: string; etag: string | null }>;
  news: Record<string, { lastmod: string | null; fetchedAt: string }>;
}

export function emptyState(): RadarState {
  return { version: 1, sitemaps: {}, pages: {}, news: {} };
}
