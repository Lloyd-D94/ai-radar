export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  etag: string | null;
  lastModified: string | null;
  via: "direct" | "jina";
  error?: string;
}

const USER_AGENT = "AI-Radar/0.1 (personal dashboard; static GitHub Pages)";

let jinaQueue: Promise<void> = Promise.resolve();
const jinaStamps: number[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jinaSlot(): Promise<void> {
  const run = jinaQueue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (jinaStamps.length > 0 && now - (jinaStamps[0] ?? now) >= 60_000) jinaStamps.shift();
      if (jinaStamps.length < 15) break;
      const oldest = jinaStamps[0] ?? now;
      await sleep(60_000 - (Date.now() - oldest) + 250);
    }
    jinaStamps.push(Date.now());
  });
  jinaQueue = run.catch(() => undefined);
  await run;
}

export function shouldFallback(url: string, status: number, body: string): boolean {
  if (url.includes("api.github.com") || url.includes("hn.algolia.com") || url.includes("r.jina.ai")) {
    return false;
  }
  if (status === 403 || status === 401) return true;
  return /Attention Required! \| Cloudflare|you have been blocked|cf-error-details|Just a moment\.\.\./i.test(
    body.slice(0, 2500),
  );
}

function looksLikeDocument(body: string): boolean {
  const start = body.trim().slice(0, 400).toLowerCase();
  return (
    start.startsWith("<") ||
    start.includes("<rss") ||
    start.includes("<feed") ||
    start.includes("<?xml") ||
    start.includes("<urlset") ||
    start.includes("<!doctype") ||
    start.includes("<html")
  );
}

async function fetchViaJina(url: string, timeoutMs: number): Promise<FetchResult> {
  await jinaSlot();
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": USER_AGENT,
        "X-Return-Format": "html",
        "X-Timeout": String(Math.ceil(timeoutMs / 1000)),
        Accept: "text/html, application/xml, text/xml, */*",
      },
    });
    const body = await response.text();
    if (!response.ok || !looksLikeDocument(body)) {
      return {
        ok: false,
        status: response.status,
        url,
        body,
        etag: null,
        lastModified: null,
        via: "jina",
        error: response.ok ? "Leesproxy gaf geen document terug" : `Leesproxy HTTP ${response.status}`,
      };
    }
    return { ok: true, status: response.status, url, body, etag: null, lastModified: null, via: "jina" };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      body: "",
      etag: null,
      lastModified: null,
      via: "jina",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchText(
  url: string,
  options: { retries?: number; timeoutMs?: number; headers?: Record<string, string>; allowJina?: boolean } = {},
): Promise<FetchResult> {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const allowJina = options.allowJina ?? true;
  let lastError = "onbekende fout";
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/json, */*",
          "Accept-Language": "en,nl;q=0.8",
          ...options.headers,
        },
      });
      const body = await response.text();
      if (response.status === 429 || response.status >= 500) {
        lastError = `HTTP ${response.status}`;
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      if (allowJina && shouldFallback(url, response.status, body)) {
        const fallback = await fetchViaJina(url, timeoutMs);
        if (fallback.ok) return fallback;
        return {
          ok: false,
          status: response.status,
          url,
          body,
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          via: "direct",
          error: `Geblokkeerd (HTTP ${response.status}); ${fallback.error ?? "leesproxy faalde"}`,
        };
      }
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          url,
          body,
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          via: "direct",
          error: `HTTP ${response.status}`,
        };
      }
      return {
        ok: true,
        status: response.status,
        url,
        body,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        via: "direct",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(400 * 2 ** (attempt - 1));
    }
  }
  if (allowJina && shouldFallback(url, 0, "")) {
    const fallback = await fetchViaJina(url, timeoutMs);
    if (fallback.ok) return fallback;
  }
  return { ok: false, status: 0, url, body: "", etag: null, lastModified: null, via: "direct", error: lastError };
}

export async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}> {
  const result = await fetchText(url, { headers, allowJina: false, retries: 3, timeoutMs: 25_000 });
  if (!result.ok) return { ok: false, status: result.status, data: null, error: result.error };
  try {
    return { ok: true, status: result.status, data: JSON.parse(result.body) as unknown };
  } catch {
    return { ok: false, status: result.status, data: null, error: "JSON onleesbaar" };
  }
}
