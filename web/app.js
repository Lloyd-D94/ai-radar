const NAV = [
  ["vandaag", "Vandaag", "home"],
  ["gemaakt", "Gemaakt", "grid"],
  ["startups", "Startups", "spark"],
  ["ontdek", "Ontdek", "compass"],
  ["meer", "Meer", "more"],
];

const VIEWS = ["vandaag", "gemaakt", "voorbeelden", "startups", "ontdek", "meer", "zoeken", "bronnen", "bewaard"];
const MORE = new Set(["meer", "voorbeelden", "zoeken", "bronnen", "bewaard"]);

const CREATION_CATS = {
  apps_games_websites: "Apps en games",
  design_3d: "3D en design",
  film_video: "Film en video",
  agents_automation: "Agents",
  hardware_robots: "Hardware",
};

const ACCOUNT_CATS = {
  official_product: "Officieel product",
  builder_demo: "Builders en demo’s",
  engineer_explainer: "Uitleg",
  founder_investor: "Oprichters en investeerders",
  xai_grok: "xAI en Grok",
  dutch_eu: "Nederland en Europa",
};

const KINDS = {
  demo: "Demo",
  workflow: "Workflow",
  release: "Release",
  tutorial: "Tutorial",
};

const RELEASE_CATS = {
  "nieuwe-functie": "Nieuwe functie",
  prijswijziging: "Prijswijziging",
  model: "Model",
  beveiliging: "Beveiliging",
  "breaking-change": "Breaking change",
  tutorial: "Tutorial",
  overig: "Overig",
};

const READ_KEY = "ai-radar-read-v1";
const SAVE_KEY = "ai-radar-saved-v1";
const RECENT_KEY = "ai-radar-recent-searches-v1";

const STOP = new Set(
  "de het een van en in je met op voor dat die te om is zijn of aan ook niet nog bij als tot uit door over na naar wel kan laat laten dit kun jouw dan maar want dus per via the and for with you your this that from are was nieuwe nieuw about into just have has its been what when waar hoe alle meer geen welkom".split(
    /\s+/,
  ),
);

const AVATAR_COLORS = ["#d7e4f5", "#f3e6cf", "#d9efe6", "#f8e4d8", "#e4e0f7", "#f8e0ea", "#e7eee4", "#efe6da"];

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  nbsp: " ",
  eacute: "é",
  egrave: "è",
  euml: "ë",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  iuml: "ï",
};

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const useFixture = params.get("fixture") === "1";

const state = {
  tab: "vandaag",
  radar: { updates: [], examples: [], startups: [] },
  accounts: [],
  items: [],
  sources: [],
  tools: [],
  generatedAt: null,
  notice: "",
  error: "",
  examples: { tool: "", kind: "", onlyNew: true },
  ontdek: { q: "", category: "" },
  gemaakt: { category: "" },
  zoek: params.get("q") || "",
  bronnenMore: 8,
  expanded: new Set(),
  bronOpen: new Set(),
  postOpen: new Set(),
  galleries: new Map(),
  viewer: null,
  focusViewer: false,
};

const memory = {
  read: new Set(readStore(READ_KEY)),
  saved: new Set(readStore(SAVE_KEY)),
  recent: readStore(RECENT_KEY).slice(0, 6),
};

let scrollMode = "restore";

const dateFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", day: "numeric", month: "short" });
const dayHeadingFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const followersFmt = new Intl.NumberFormat("nl-NL");

function readStore(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStore(key, values) {
  try {
    localStorage.setItem(key, JSON.stringify(values.slice(0, 500)));
  } catch {
    /* opslag kan geblokkeerd zijn */
  }
}

function persistRead() {
  writeStore(READ_KEY, [...memory.read]);
}

function persistSaved() {
  writeStore(SAVE_KEY, [...memory.saved]);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function safeHttps(url) {
  if (typeof url !== "string") return "";
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function safeUrl(url) {
  const https = safeHttps(url);
  if (https) return https;
  if (typeof url === "string" && /^data:image\/(?:png|webp|gif|svg\+xml)[;,]/i.test(url.trim())) return url.trim();
  return "";
}

function dayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dayKeyFmt.format(date);
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "datum onbekend";
  return dateFmt.format(date);
}

function dayLabel(iso) {
  const key = dayKey(iso);
  if (!key) return "Datum onbekend";
  if (key === dayKey(new Date())) return "Vandaag";
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return "Gisteren";
  return dayHeadingFmt.format(new Date(iso));
}

function inLastDays(iso, days) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return false;
  const delta = Date.now() - time;
  return delta <= days * 86_400_000 && delta >= -3_600_000;
}

function compact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (number < 1000) return String(number);
  if (number < 10_000) return `${(number / 1000).toFixed(1).replace(".", ",")}k`;
  if (number < 1_000_000) return `${Math.round(number / 1000)}k`;
  return `${(number / 1_000_000).toFixed(1).replace(".", ",")} mln`;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    if (longer > 0 && shorter / longer > 0.62) return true;
  }
  const left = [...new Set(a.split(" ").filter((word) => word.length > 3))];
  const right = [...new Set(b.split(" ").filter((word) => word.length > 3))];
  if (left.length < 2 || right.length < 2) return false;
  const rightSet = new Set(right);
  const overlap = left.filter((word) => rightSet.has(word)).length;
  return overlap / Math.min(left.length, right.length) >= 0.72;
}

function useCases(update) {
  const title = normalize(update.title_nl);
  const summary = normalize(update.summary_nl);
  const kept = [];
  for (const point of update.can_do_nl || []) {
    const text = normalize(point);
    if (similar(text, title) || similar(text, summary)) continue;
    if (kept.some((item) => similar(normalize(item), text))) continue;
    kept.push(point);
    if (kept.length === 3) break;
  }
  return kept;
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, code) => safeChar(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeChar(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : match;
    });
}

function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  if (code < 32 && code !== 9 && code !== 10) return "";
  return String.fromCodePoint(code);
}

function cleanExcerpt(raw) {
  const text = decodeEntities(raw).replace(/\u00a0/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\s+\n/g, "\n").trim();
  if (/[•·]/.test(text)) {
    const bullets = text
      .split(/\s*[•·]\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (bullets.length >= 2) return { bullets };
  }
  return { prose: text };
}

function toolKey(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("grok") && value.includes("build")) return "grok-build";
  if (value.includes("grok")) return "grok-bot";
  if (value.includes("claude")) return "claude";
  if (value.includes("cursor")) return "cursor";
  if (value.includes("codex")) return "codex";
  if (value.includes("openai") || value.includes("chatgpt")) return "openai";
  if (value.includes("gemini")) return "gemini";
  if (value.includes("copilot")) return "copilot";
  if (value.includes("lovable")) return "lovable";
  if (value.includes("replit")) return "replit";
  if (value.includes("xai") || value === "x.ai") return "xai";
  return "other";
}

function glyph(key) {
  const paths = {
    "grok-bot": '<circle cx="8" cy="6.6" r="2.1"/><path d="M8 4.2V2.5M5.1 13.2c.4-1.9 1.5-2.9 2.9-2.9s2.5 1 2.9 2.9"/>',
    "grok-build": '<path d="M6.2 4.4 2.8 8l3.4 3.6M9.8 4.4 13.2 8 9.8 11.6"/>',
    claude: '<path d="M8 2.2 9.15 6.85 13.8 8 9.15 9.15 8 13.8 6.85 9.15 2.2 8 6.85 6.85Z"/>',
    cursor: '<path d="M4.8 2.8 4.8 12.6 7.8 9.7 11.2 13 12.6 11.6 9.2 8.4 12.4 8Z"/>',
    openai: '<circle cx="8" cy="8" r="4.3"/>',
    codex: '<path d="M3 4.6h10v6.8H3zM4.6 7.4h2.4M8.2 7.4h1.8"/>',
    gemini: '<path d="M8 2.4 13.1 8 8 13.6 2.9 8Z"/>',
    copilot: '<rect x="2.4" y="3" width="6.4" height="6.4" rx="1.3"/><rect x="7.2" y="6.6" width="6.4" height="6.4" rx="1.3"/>',
    lovable: '<path d="M8 12.8S3.8 10.2 3.8 7.6a2.35 2.35 0 0 1 4.2-1.45A2.35 2.35 0 0 1 12.2 7.6C12.2 10.2 8 12.8 8 12.8z"/>',
    replit: '<path d="M8 2.3 13.2 5.2v5.6L8 13.7 2.8 10.8V5.2Z"/>',
    xai: '<path d="M3.8 3.8 12.2 12.2M12.2 3.8 3.8 12.2"/>',
    other: '<circle cx="8" cy="8" r="2.5"/>',
  };
  return `<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[key] || paths.other}</svg>`;
}

function toolChip(name) {
  const key = toolKey(name);
  return `<span class="toolchip" data-tool-key="${esc(key)}">${glyph(key)}<span>${esc(name || "Overig")}</span></span>`;
}

function navIcon(name) {
  const paths = {
    home: '<path d="M4 11.2 12 4.4l8 6.8V20a1 1 0 0 1-1 1h-5.1v-6.1H10.1V21H5a1 1 0 0 1-1-1z"/>',
    posts: '<rect x="4" y="4" width="16" height="11" rx="2"/><path d="M8 19.5h8M7 8.2h10M7 11.4h7"/>',
    spark: '<path d="M12 3.2c2.6 2.4 4 5.4 4 8.2 0 1.3-.7 3.2-1.5 4.4L12 19.6l-2.5-3.8C8.7 14.6 8 12.7 8 11.4c0-2.8 1.4-5.8 4-8.2z"/><path d="M12 10.2v.2M7.2 16.6 5.2 19.4M16.8 16.6 18.8 19.4"/>',
    compass: '<circle cx="12" cy="12" r="8"/><path d="m15.2 8.8-1.4 4.6-4.6 1.4 1.4-4.6z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>',
    more: '<circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

const MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 16 L16 5.2 A10.8 10.8 0 0 1 25.4 20.4 Z" fill="#c9842a"/><circle cx="16" cy="16" r="1.8" fill="currentColor"/></svg>`;

const BOOKMARK = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.4L6 20V5.5a1 1 0 0 1 1-1z"/></svg>`;

function initials(value) {
  const text = String(value || "?").trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = Array.from(parts[0])[0] || "";
    const last = Array.from(parts[parts.length - 1])[0] || "";
    return `${first}${last}`.toLocaleUpperCase("nl-NL");
  }
  const chars = Array.from(text.replace(/[^\p{L}\p{N}]/gu, ""));
  return (chars.slice(0, 2).join("") || "?").toLocaleUpperCase("nl-NL");
}

function avatarColor(seed) {
  let hash = 0;
  for (const char of String(seed || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function avatarHtml(name, seed, url, logo = false) {
  const letters = initials(name || seed);
  const src = safeUrl(url);
  const image = src
    ? `<img src="${esc(src)}" alt="" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />`
    : "";
  return `<span class="avatar${logo ? " logo" : ""}" style="--avatar:${esc(avatarColor(seed || name))}" aria-hidden="true"><span class="letters">${esc(letters)}</span>${image}</span>`;
}

function exampleById(id) {
  return state.radar.examples.find((item) => item.id === id);
}

function accountByHandle(handle) {
  const key = String(handle || "").toLowerCase();
  return state.accounts.find((account) => account.handle.toLowerCase() === key);
}

function toolLabel(id) {
  return state.tools.find((tool) => tool.id === id)?.label ?? id;
}

function weekUpdates() {
  return state.radar.updates
    .filter((update) => inLastDays(update.date, 7))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function feedStartups() {
  return state.radar.startups
    .filter((startup) => inLastDays(startup.date_found, 14))
    .sort((a, b) => Date.parse(b.date_found) - Date.parse(a.date_found))
    .slice(0, 3);
}

function feedDiscoveries() {
  const seen = new Set();
  const found = [];
  for (const update of weekUpdates()) {
    for (const id of update.example_ids || []) {
      const example = exampleById(id);
      if (!example || example.from_followed) continue;
      const key = example.author_handle.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const account = accountByHandle(key);
      if (account && !account.already_followed) found.push(account);
      if (found.length === 2) return found;
    }
  }
  return found;
}

function allCreations() {
  return [...(state.radar.creations || [])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function feedCreations() {
  return allCreations().filter((item) => !item.update_id && inLastDays(item.date, 7));
}

function buildFeed() {
  const items = [
    ...weekUpdates().map((update) => ({ type: "update", date: update.date, update })),
    ...feedStartups().map((startup) => ({ type: "startup", date: startup.date_found, startup })),
    ...feedCreations().map((creation) => ({ type: "creation", date: creation.date, creation })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const accounts = feedDiscoveries();
  if (accounts.length) items.splice(Math.min(1, items.length), 0, { type: "discover", accounts, skipDay: true });
  return items;
}

function toggleSet(set, key, persist) {
  if (set.has(key)) set.delete(key);
  else set.add(key);
  persist();
}

function markFeedRead() {
  for (const update of weekUpdates()) {
    memory.read.add(`update:${update.id}`);
    for (const id of update.example_ids || []) memory.read.add(`example:${id}`);
  }
  for (const startup of feedStartups()) memory.read.add(`startup:${startup.id}`);
  persistRead();
}

function feedUnread() {
  return buildFeed().some((item) => {
    if (item.type === "update") return !memory.read.has(`update:${item.update.id}`);
    if (item.type === "startup") return !memory.read.has(`startup:${item.startup.id}`);
    return false;
  });
}

function actionRow(key) {
  const saved = memory.saved.has(key);
  const read = memory.read.has(key);
  return `<div class="card-actions">
    <button type="button" id="${domId("save", key)}" data-save="${esc(key)}" aria-pressed="${saved}">${saved ? "Bewaard" : "Bewaren"}</button>
    <button type="button" id="${domId("read", key)}" data-read="${esc(key)}" aria-pressed="${read}">${read ? "Gelezen" : "Markeer gelezen"}</button>
  </div><span class="sr">${read ? "Gelezen" : "Ongelezen"}</span>`;
}

function metricsLine(metrics) {
  if (!metrics || typeof metrics !== "object") return "";
  const labels = [
    ["likes", "likes"],
    ["reposts", "reposts"],
    ["replies", "reacties"],
    ["views", "weergaven"],
  ];
  const bits = [];
  for (const [key, label] of labels) {
    if (typeof metrics[key] === "number" && Number.isFinite(metrics[key])) bits.push(`${compact(metrics[key])} ${label}`);
  }
  return bits.length ? `<p class="metrics">${esc(bits.join(" · "))}</p>` : "";
}

function readableName(name, handle) {
  const text = String(name || "").trim();
  return /[\p{L}\p{N}]/u.test(text) ? text : handle;
}

function displayPostText(raw) {
  let text = String(raw || "");
  text = text.replace(/https?:\/\/t\.co\/\w+/gi, "");
  text = text.replace(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\S+/gi, "");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  if (text.length >= 450 && !/[.!?…)"']$/.test(text)) {
    const cut = text.replace(/\s+\S*$/, "").trim();
    text = `${cut || text}…`;
  }
  return text;
}

function linkify(text) {
  const pattern = /https?:\/\/[^\s<>)]+/gi;
  let html = "";
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    html += esc(text.slice(last, start));
    const raw = match[0].replace(/[.,]+$/, "");
    const href = safeLink(raw);
    const label = raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
    const short = label.length > 42 ? `${label.slice(0, 40)}…` : label;
    html += href
      ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(short)}</a>`
      : esc(match[0]);
    html += esc(match[0].slice(raw.length));
    last = start + match[0].length;
  }
  return html + esc(text.slice(last));
}

function safeLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function safeMp4(url) {
  const https = safeHttps(url);
  if (!https) return "";
  try {
    return new URL(https).pathname.toLowerCase().endsWith(".mp4") ? https : "";
  } catch {
    return "";
  }
}

function clock(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function bindGallery(items) {
  const id = `g${state.galleries.size + 1}`;
  state.galleries.set(id, items);
  return id;
}

function slideFrom(example, media) {
  const name = readableName(example.author_name, example.author_handle);
  return {
    src: media ? safeUrl(media.preview_url || media.url) : "",
    type: media?.type || "text",
    video: media ? safeMp4(media.video_url) : "",
    width: Number.isInteger(media?.width) ? media.width : 0,
    height: Number.isInteger(media?.height) ? media.height : 0,
    duration: clock(media?.duration_ms),
    alt: media?.alt || (media?.type === "video" ? `Video van ${name}` : `Afbeelding van ${name}`),
    name,
    handle: example.author_handle,
    post: safeHttps(example.post_url),
    exampleId: example.id,
    text: displayPostText(example.text || "") || example.note_nl || "",
    note: example.note_nl || "",
  };
}

function slidesFor(examples, limit = 4) {
  const slides = [];
  for (const example of examples) {
    const media = Array.isArray(example.media) ? example.media : [];
    for (const item of media) {
      const slide = slideFrom(example, item);
      if (!slide.src) continue;
      slides.push(slide);
      if (slides.length >= limit) return slides;
    }
  }
  return slides;
}

function openViewer(items, index) {
  if (!items?.length) return;
  state.viewer = { items, index: Math.max(0, Math.min(index, items.length - 1)), playing: false };
  state.focusViewer = true;
  render();
}

function stepViewer(delta) {
  if (!state.viewer) return;
  const count = state.viewer.items.length;
  state.viewer.index = (state.viewer.index + delta + count) % count;
  state.viewer.playing = false;
  state.focusViewer = false;
  render();
}

function closeViewer() {
  state.viewer = null;
  render();
}

const PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.2v9.6l8.2-4.8z" fill="currentColor"/></svg>`;

function playBadge(slide) {
  if (slide.type !== "video" && slide.type !== "gif") return "";
  const label = slide.type === "gif" ? "GIF" : slide.duration || "Video";
  return `<span class="play">${PLAY}<span>${esc(label)}</span></span>`;
}

function heroHtml(examples) {
  const slides = slidesFor(examples, 4);
  if (!slides.length) {
    const seen = new Set();
    const people = [];
    for (const example of examples) {
      const key = String(example.author_handle || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      people.push(example);
      if (people.length === 3) break;
    }
    if (!people.length) return "";
    return `<div class="collage" data-count="${people.length}">${people
      .map((example) => avatarHtml(readableName(example.author_name, example.author_handle), example.author_handle, example.author_avatar_url))
      .join("")}</div>`;
  }
  const id = bindGallery(slides);
  const tiles = slides
    .map(
      (slide, index) => `<button type="button" class="tile" data-gallery="${id}" data-gallery-index="${index}" aria-label="${esc(slide.alt)}">
        <img src="${esc(slide.src)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.tile')?.classList.add('is-missing');this.remove()" />
        ${playBadge(slide)}
        <span class="missing">Beeld niet geladen</span>
      </button>`,
    )
    .join("");
  return `<div class="hero" data-count="${slides.length}">${tiles}</div>`;
}

function compactPosts(examples) {
  return examples
    .map((example) => {
      const name = readableName(example.author_name, example.author_handle);
      const media = Array.isArray(example.media) ? example.media.filter((item) => safeUrl(item.preview_url || item.url)) : [];
      const gallery = media.length ? bindGallery(media.map((item) => slideFrom(example, item))) : bindGallery([slideFrom(example, null)]);
      const line = example.note_nl || displayPostText(example.text || "");
      return `<button type="button" class="post-compact" data-gallery="${gallery}" data-gallery-index="0">
        ${avatarHtml(name, example.author_handle, example.author_avatar_url)}
        <span><strong>${esc(name)}</strong><span class="who">@${esc(example.author_handle)}</span><span class="line">${esc(line)}</span></span>
      </button>`;
    })
    .join("");
}

function viewerHtml() {
  if (!state.viewer) return "";
  const { items, index } = state.viewer;
  const slide = items[index];
  if (!slide) return "";
  const many = items.length > 1;
  const frame = slide.youtubeId
    ? state.viewer.playing
      ? `<iframe class="yt-frame" title="${esc(slide.alt || slide.name)}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(slide.youtubeId)}?playsinline=1&autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : `<button type="button" class="yt-play" data-yt-play aria-label="Afspelen op YouTube"><img src="${esc(slide.src)}" alt="" referrerpolicy="strict-origin-when-cross-origin" onerror="this.closest('.yt-play')?.classList.add('is-missing');this.remove()" /><span class="play">${PLAY}<span>Afspelen</span></span><span class="missing">Beeld niet geladen</span></button>`
    : slide.video
    ? `<video src="${esc(slide.video)}" poster="${esc(slide.src)}" muted controls playsinline preload="metadata" ${slide.width ? `width="${slide.width}"` : ""} ${slide.height ? `height="${slide.height}"` : ""} referrerpolicy="no-referrer" onerror="this.classList.add('is-broken')"></video>${slide.src ? `<img class="viewer-fallback" src="${esc(slide.src)}" alt="${esc(slide.alt || "")}" referrerpolicy="no-referrer" />` : ""}`
    : slide.src
      ? `<img src="${esc(slide.src)}" alt="${esc(slide.alt || "")}" referrerpolicy="no-referrer" />`
      : `<div class="viewer-text"><p>${linkify(slide.text)}</p>${slide.note && normalize(slide.note) !== normalize(slide.text) ? `<p class="takeaway"><span>Wat is hier gaaf aan</span>${esc(slide.note)}</p>` : ""}</div>`;
  const xLabel = slide.youtubeId ? "Bekijk op YouTube" : slide.type === "video" && !slide.video ? "Bekijk op X" : "Open op X";
  return `<div class="viewer" role="dialog" aria-modal="true" aria-label="Beeld">
    <div class="viewer-bar">
      <p>${many ? `${index + 1} van ${items.length}` : "Beeld"}</p>
      <button type="button" class="viewer-close" data-viewer-close>Sluiten</button>
    </div>
    <div class="viewer-stage">
      ${many ? `<button type="button" class="viewer-arrow prev" data-viewer-prev aria-label="Vorig beeld">‹</button>` : ""}
      ${frame}
      ${many ? `<button type="button" class="viewer-arrow next" data-viewer-next aria-label="Volgend beeld">›</button>` : ""}
    </div>
    <div class="viewer-foot">
      <p><strong>${esc(slide.name)}</strong><span>@${esc(slide.handle)}</span></p>
      ${slide.post ? `<a class="xlink" href="${esc(slide.post)}" target="_blank" rel="noopener noreferrer">${xLabel}</a>` : ""}
    </div>
  </div>`;
}

function mediaHtml(media) {
  const ready = (Array.isArray(media) ? media : [])
    .slice(0, 4)
    .map((item) => ({ ...item, src: safeUrl(item?.preview_url || item?.url) }))
    .filter((item) => item.src);
  if (!ready.length) return "";
  const figures = ready
    .map((item) => {
      const alt = item.alt || (item.type === "video" ? "Videobeeld bij de post" : item.type === "gif" ? "GIF bij de post" : "Afbeelding bij de post");
      const badge = item.type === "video" ? '<span class="badge">Video</span>' : item.type === "gif" ? '<span class="badge">GIF</span>' : "";
      return `<figure class="media" data-media data-kind="${esc(item.type || "photo")}">
        <img src="${esc(item.src)}" alt="${esc(alt)}" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('[data-media]')?.classList.add('is-missing');this.remove()" />
        ${badge}
        <span class="missing">Beeld niet geladen</span>
      </figure>`;
    })
    .join("");
  return `<div class="media-grid" data-count="${ready.length}">${figures}</div>`;
}

function postInner(example, { save }) {
  const name = readableName(example.author_name, example.author_handle);
  const text = displayPostText(example.text || "");
  const body = text || example.note_nl || "";
  const showTakeaway = Boolean(text) && example.note_nl && normalize(text) !== normalize(example.note_nl);
  const open = state.postOpen.has(example.id);
  const long = body.length > 180 || (body.match(/\n/g) || []).length >= 3;
  const href = safeHttps(example.post_url);
  const saved = memory.saved.has(`example:${example.id}`);
  const followed = example.from_followed ? " · volg je" : "";
  return `<div class="post-head">
      ${avatarHtml(name, example.author_handle, example.author_avatar_url)}
      <div>
        <p class="name">${esc(name)}</p>
        <p class="who">@${esc(example.author_handle)} · ${esc(formatDate(example.date))}${esc(followed)}</p>
      </div>
    </div>
    ${body ? `<p class="post-text${long && !open ? " clamp" : ""}">${text ? linkify(body) : esc(body)}</p>` : ""}
    ${mediaHtml(example.media)}
    ${long ? `<button type="button" class="textbtn" data-post-more="${esc(example.id)}">${open ? "Minder" : "Meer lezen"}</button>` : ""}
    ${showTakeaway ? `<p class="takeaway"><span>Wat is hier gaaf aan</span>${esc(example.note_nl)}</p>` : ""}
    ${metricsLine(example.metrics)}
    <div class="post-actions">
      ${href ? `<a class="xlink" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open op X</a>` : ""}
      ${save ? `<button type="button" class="textbtn" id="${domId("save", `example-${example.id}`)}" data-save="example:${esc(example.id)}" aria-pressed="${saved}">${saved ? "Bewaard" : "Bewaar"}</button>` : ""}
    </div>`;
}

function creationSlides(creation) {
  const name = readableName(creation.author_name, creation.author_handle);
  const post = safeHttps(creation.url);
  const slides = [];
  if (creation.platform === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(creation.youtube_id || "")) {
    slides.push({
      src: `https://i.ytimg.com/vi/${creation.youtube_id}/hqdefault.jpg`,
      type: "youtube",
      youtubeId: creation.youtube_id,
      video: "",
      width: 0,
      height: 0,
      duration: clock((creation.duration_s || 0) * 1000),
      alt: creation.title_nl,
      name,
      handle: creation.author_handle,
      post,
      exampleId: creation.id,
      text: creation.what_nl,
      note: creation.what_nl,
    });
  }
  for (const media of creation.media || []) {
    const src = safeUrl(media.preview_url || media.url);
    if (!src) continue;
    slides.push({
      src,
      type: media.type || "photo",
      youtubeId: "",
      video: safeMp4(media.video_url),
      width: Number.isInteger(media.width) ? media.width : 0,
      height: Number.isInteger(media.height) ? media.height : 0,
      duration: clock(media.duration_ms),
      alt: media.alt || creation.title_nl,
      name,
      handle: creation.author_handle,
      post,
      exampleId: creation.id,
      text: creation.text || creation.what_nl,
      note: creation.what_nl,
    });
    if (slides.length >= 4) break;
  }
  return slides;
}

function creationVisual(creation) {
  const slides = creationSlides(creation);
  if (!slides.length) {
    return `<div class="collage" data-count="1">${avatarHtml(creation.author_name, creation.author_handle, creation.author_avatar_url)}</div>`;
  }
  const id = bindGallery(slides);
  if (slides.length === 1) {
    return `<button type="button" class="tile creation-hero" data-gallery="${id}" data-gallery-index="0" aria-label="${esc(slides[0].alt)}">
      <img src="${esc(slides[0].src)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.tile')?.classList.add('is-missing');this.remove()" />
      ${playBadge(slides[0].youtubeId ? { ...slides[0], type: "video" } : slides[0])}
      <span class="missing">Beeld niet geladen</span>
    </button>`;
  }
  return `<div class="hero" data-count="${slides.length}">${slides
    .map(
      (slide, index) => `<button type="button" class="tile" data-gallery="${id}" data-gallery-index="${index}" aria-label="${esc(slide.alt)}">
        <img src="${esc(slide.src)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.tile')?.classList.add('is-missing');this.remove()" />
        ${playBadge(slide.youtubeId ? { ...slide, type: "video" } : slide)}
        <span class="missing">Beeld niet geladen</span>
      </button>`,
    )
    .join("")}</div>`;
}

function creationCard(creation) {
  const key = `creation:${creation.id}`;
  const unread = !memory.read.has(key);
  return `<article class="card creation ${unread ? "is-unread" : "is-read"}${creation.lloyd_pick ? " is-pick" : ""}">
    <div class="hero-wrap has-media">${creationVisual(creation)}</div>
    <div class="card-body">
      <p class="kicker">Gemaakt met AI</p>
      <div class="meta"><span class="pill">${esc(CREATION_CATS[creation.category] || creation.category)}</span>${creation.lloyd_pick ? `<span class="pick">Jouw favoriet</span>` : ""}<time datetime="${esc(creation.date)}">${esc(formatDate(creation.date))}</time></div>
      <h3>${esc(creation.title_nl)}</h3>
      <p class="summary">${esc(creation.what_nl)}</p>
      <div class="tool-row">${(creation.tools || []).map((tool) => toolChip(tool)).join("")}</div>
      <div class="post-compact static">
        ${avatarHtml(creation.author_name, creation.author_handle, creation.author_avatar_url)}
        <span><strong>${esc(readableName(creation.author_name, creation.author_handle))}</strong><span class="who">${creation.platform === "youtube" ? "YouTube" : "X"} · @${esc(creation.author_handle)}</span></span>
      </div>
      ${actionRow(key)}
    </div>
  </article>`;
}

function creationStrip() {
  const items = allCreations().slice(0, 5);
  if (!items.length) return "";
  return `<section class="made-strip">
    <div class="made-head"><h2>Gemaakt met AI</h2><a href="#gemaakt" data-tab="gemaakt">Alles</a></div>
    <div class="scroller made-scroll">${items
      .map((creation) => {
        const slides = creationSlides(creation);
        const id = slides.length ? bindGallery(slides) : "";
        const src = slides[0]?.src || "";
        const visual = src
          ? `<img src="${esc(src)}" alt="" width="320" height="180" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />`
          : avatarHtml(creation.author_name, creation.author_handle, creation.author_avatar_url);
        return `<button type="button" class="made-tile" data-gallery="${slides.length ? id : ""}" data-gallery-index="0">
          <span class="made-thumb${creation.lloyd_pick ? " is-pick" : ""}">${visual}${creation.lloyd_pick ? `<span class="pick pick-on-media">Jouw favoriet</span>` : ""}${slides[0] && (slides[0].youtubeId || slides[0].type === "video") ? `<span class="play">${PLAY}</span>` : ""}</span>
          <span class="made-title">${esc(creation.title_nl)}</span>
          <span class="who">${esc(CREATION_CATS[creation.category] || "")}</span>
        </button>`;
      })
      .join("")}</div>
  </section>`;
}

function gemaaktFor(updateId) {
  const items = allCreations().filter((item) => item.update_id === updateId);
  if (!items.length) return "";
  return `<div class="made-under"><p>Hiermee gemaakt</p><div class="made-under-row">${items
    .map((creation) => {
      const slides = creationSlides(creation);
      const id = slides.length ? bindGallery(slides) : "";
      const src = slides[0]?.src;
      return `<button type="button" class="made-mini${creation.lloyd_pick ? " is-pick" : ""}" ${id ? `data-gallery="${id}" data-gallery-index="0"` : ""}>
        ${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />` : avatarHtml(creation.author_name, creation.author_handle, creation.author_avatar_url)}
        <span>${esc(creation.title_nl)}</span>
      </button>`;
    })
    .join("")}</div></div>`;
}

function updateCard(update) {
  const key = `update:${update.id}`;
  const unread = !memory.read.has(key);
  const examples = (update.example_ids || []).map(exampleById).filter(Boolean);
  const uses = useCases(update);
  const visual = heroHtml(examples);
  const isHero = visual.includes('class="hero"');
  const overlay = `<div class="hero-overlay">
        ${toolChip(update.tool)}
        ${Number(update.importance) >= 5 ? '<span class="flag">Groot nieuws</span>' : ""}
        <time datetime="${esc(update.date)}">${esc(formatDate(update.date))}</time>
      </div>`;
  return `<article class="card update ${unread ? "is-unread" : "is-read"}">
    <div class="hero-wrap ${isHero ? "has-media" : "has-collage"}">
      ${isHero ? "" : overlay}
      ${visual}
      ${isHero ? overlay : ""}
    </div>
    <div class="card-body">
      <h3>${esc(update.title_nl)}</h3>
      <p class="summary">${esc(update.summary_nl)}</p>
      ${uses.length ? `<div class="uses"><p>Dit kun je ermee</p><ul>${uses.map((point) => `<li>${esc(point)}</li>`).join("")}</ul></div>` : ""}
      ${gemaaktFor(update.id)}
      ${examples.length ? `<div class="post-list">${compactPosts(examples)}</div>` : ""}
      ${actionRow(key)}
    </div>
  </article>`;
}

function startupCard(startup) {
  const key = `startup:${startup.id}`;
  const unread = !memory.read.has(key);
  const website = safeHttps(startup.website_url);
  const proof = safeHttps(startup.proof_url);
  const account = safeHttps(startup.url);
  const proofExample = state.radar.examples.find((item) => String(item.post_url || "").toLowerCase() === String(startup.proof_url || "").toLowerCase());
  const proofSlides = proofExample ? slidesFor([proofExample], 1) : [];
  const proofId = proofSlides.length ? bindGallery(proofSlides) : "";
  const proofTile = proofId
    ? `<button type="button" class="proof-tile" data-gallery="${proofId}" data-gallery-index="0" aria-label="${esc(proofSlides[0].alt)}">
        <img src="${esc(proofSlides[0].src)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.proof-tile')?.classList.add('is-missing');this.remove()" />
        ${playBadge(proofSlides[0])}
      </button>`
    : "";
  return `<article class="card startup ${unread ? "is-unread" : "is-read"}">
    ${proofTile}
    <div class="startup-head">
      ${avatarHtml(startup.name, startup.handle, startup.logo_url, true)}
      <div>
        <p class="kicker">Startup</p>
        <h3>${esc(startup.name)}</h3>
        <p class="who">@${esc(startup.handle)} · gezien ${esc(formatDate(startup.date_found))}</p>
      </div>
    </div>
    <p class="summary">${esc(startup.one_liner_nl)}</p>
    <p class="why"><span>Waarom nieuw</span>${esc(startup.why_new_nl)}</p>
    <div class="linkrow">
      ${website ? `<a class="xlink" href="${esc(website)}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
      ${proof ? `<a class="xlink" href="${esc(proof)}" target="_blank" rel="noopener noreferrer">Bewijs</a>` : ""}
      ${account ? `<a class="xlink" href="${esc(account)}" target="_blank" rel="noopener noreferrer">@${esc(startup.handle)}</a>` : ""}
    </div>
    ${actionRow(key)}
  </article>`;
}

function exampleCard(example) {
  const key = `example:${example.id}`;
  const unread = !memory.read.has(key);
  return `<article class="card post-card ${unread ? "is-unread" : "is-read"}">
    <div class="card-kicker">${toolChip(example.tool)}<span class="pill">${esc(KINDS[example.kind] || example.kind || "")}</span></div>
    <div class="post post-top">${postInner(example, { save: false })}</div>
    ${actionRow(key)}
  </article>`;
}

function personRow(account, followLabel) {
  const href = safeHttps(account.example_url) || `https://x.com/${encodeURIComponent(account.handle)}`;
  return `<li class="person">
    ${avatarHtml(account.name, account.handle, account.avatar_url)}
    <div>
      <p class="name">${esc(account.name)}</p>
      <p class="who">@${esc(account.handle)} · ${esc(followersFmt.format(account.followers || 0))} volgers</p>
      <p class="note">${esc(account.note_nl)}</p>
    </div>
    <a class="follow" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(followLabel)}</a>
  </li>`;
}

function discoverCard(accounts) {
  return `<aside class="card discover">
    <h3>Nieuw om te volgen</h3>
    <ul class="people">${accounts.map((account) => personRow(account, "Volg")).join("")}</ul>
    <a class="textbtn" href="#ontdek" data-tab="ontdek">Alle accounts</a>
  </aside>`;
}

function domId(prefix, value) {
  return `${prefix}-${String(value || "all")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function choice(label, attr, value, pressed) {
  return `<button type="button" class="choice" id="${domId(attr, value)}" ${attr}="${esc(value)}" aria-pressed="${pressed}">${esc(label)}</button>`;
}

function viewToday() {
  const items = buildFeed();
  if (!items.length) {
    return `<section>
      <h2>Vandaag</h2>
      <div class="empty"><p>Geen updates in de laatste 7 dagen.</p><p><a href="#voorbeelden" data-tab="voorbeelden">Bekijk voorbeelden</a> of <a href="#startups" data-tab="startups">startups</a>.</p></div>
    </section>`;
  }
  let lastDay = "";
  const body = items
    .map((item) => {
      let heading = "";
      if (!item.skipDay) {
        const key = dayKey(item.date);
        if (key !== lastDay) {
          heading = `<h2 class="day">${esc(dayLabel(item.date))}</h2>`;
          lastDay = key;
        }
      }
      if (item.type === "startup") return heading + startupCard(item.startup);
      if (item.type === "discover") return heading + discoverCard(item.accounts);
      if (item.type === "creation") return heading + creationCard(item.creation);
      return heading + updateCard(item.update);
    })
    .join("");
  const unread = feedUnread();
  return `<section>
    ${creationStrip()}
    <div class="feed-tools">
      <p>${items.length} in de feed</p>
      <button type="button" class="textbtn" data-mark-all ${unread ? "" : "disabled"}>Alles gelezen</button>
    </div>
    ${body}
    <p class="quiet"><a href="#startups" data-tab="startups">Alle startups</a></p>
  </section>`;
}

function viewExamples() {
  const tools = [...new Set(state.radar.examples.map((item) => item.tool).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl"));
  const filtered = state.radar.examples
    .filter((item) => (state.examples.onlyNew ? item.from_followed === false : true))
    .filter((item) => (state.examples.tool ? item.tool === state.examples.tool : true))
    .filter((item) => (state.examples.kind ? item.kind === state.examples.kind : true))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const tiles = filtered.map((example) => {
    const slides = slidesFor([example], 4);
    const name = readableName(example.author_name, example.author_handle);
    if (!slides.length) {
      const id = bindGallery([slideFrom(example, null)]);
      const line = displayPostText(example.text || "") || example.note_nl || "";
      return `<button type="button" class="mosaic-text" data-gallery="${id}" data-gallery-index="0">
        ${avatarHtml(name, example.author_handle, example.author_avatar_url)}
        <strong>${esc(name)}</strong>
        <p>${esc(line)}</p>
      </button>`;
    }
    const id = bindGallery(slides);
    const slide = slides[0];
    return `<button type="button" class="mosaic-tile" data-gallery="${id}" data-gallery-index="0" aria-label="${esc(slide.alt)}">
      <img src="${esc(slide.src)}" alt="" width="400" height="400" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.mosaic-tile')?.classList.add('is-missing');this.remove()" />
      ${playBadge(slide)}
      <span class="mosaic-name">${esc(name)}</span>
      <span class="missing">Beeld niet geladen</span>
    </button>`;
  });
  const list = tiles.length
    ? `<div class="mosaic">${tiles.join("")}</div>`
    : `<div class="empty"><p>Geen posts voor deze filters.</p>${state.examples.onlyNew ? "<p>Zet “Nog niet gevolgd” uit om ook accounts te zien die je al volgt.</p>" : ""}</div>`;
  return `<section>
    <h2>Voorbeelden</h2>
    <div class="scroller" role="group" aria-label="Filter op tool">
      ${choice("Alles", "data-filter-tool", "", state.examples.tool === "")}
      ${tools.map((tool) => choice(tool, "data-filter-tool", tool, state.examples.tool === tool)).join("")}
    </div>
    <div class="scroller" role="group" aria-label="Filter op soort">
      ${choice("Alles", "data-filter-kind", "", state.examples.kind === "")}
      ${Object.entries(KINDS).map(([id, label]) => choice(label, "data-filter-kind", id, state.examples.kind === id)).join("")}
    </div>
    <button type="button" id="only-new" class="toggle" data-only-new aria-pressed="${state.examples.onlyNew}" aria-label="Toon alleen posts van accounts die je nog niet volgt">
      <span class="knob" aria-hidden="true"></span>Nog niet gevolgd
    </button>
    <p class="count">${filtered.length} posts</p>
    ${list}
  </section>`;
}

function viewMade() {
  const category = state.gemaakt.category;
  const items = allCreations().filter((item) => (category ? item.category === category : true));
  const tiles = items
    .map((creation) => {
      const slides = creationSlides(creation);
      const id = slides.length ? bindGallery(slides) : "";
      const src = slides[0]?.src;
      return `<button type="button" class="mosaic-tile made-grid${creation.lloyd_pick ? " is-pick" : ""}" ${id ? `data-gallery="${id}" data-gallery-index="0"` : ""} aria-label="${esc(creation.title_nl)}">
        ${src ? `<img src="${esc(src)}" alt="" width="400" height="400" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />` : avatarHtml(creation.author_name, creation.author_handle, creation.author_avatar_url)}
        ${creation.lloyd_pick ? `<span class="pick pick-on-media">Jouw favoriet</span>` : ""}
        ${slides[0] && (slides[0].youtubeId || slides[0].type === "video") ? `<span class="play">${PLAY}</span>` : ""}
        <span class="mosaic-name">${esc(creation.title_nl)}</span>
      </button>`;
    })
    .join("");
  return `<section>
    <h2>Gemaakt met AI</h2>
    <div class="scroller" role="group" aria-label="Filter op soort resultaat">
      ${choice("Alles", "data-filter-made", "", category === "")}
      ${Object.entries(CREATION_CATS).map(([id, label]) => choice(label, "data-filter-made", id, category === id)).join("")}
    </div>
    <p class="count">${items.length} resultaten</p>
    ${tiles ? `<div class="mosaic">${tiles}</div>` : `<div class="empty"><p>Nog geen creaties.</p></div>`}
  </section>`;
}

function viewStartups() {
  const cards = [...state.radar.startups]
    .sort((a, b) => Date.parse(b.date_found) - Date.parse(a.date_found))
    .map(startupCard)
    .join("");
  return `<section><h2>Startups</h2>${cards ? `<div class="stack">${cards}</div>` : `<div class="empty"><p>Nog geen startups.</p></div>`}</section>`;
}

function viewDiscover() {
  const query = state.ontdek.q.trim().toLowerCase();
  const match = (account) => {
    if (state.ontdek.category && account.category !== state.ontdek.category) return false;
    if (!query) return true;
    return `${account.name} ${account.handle} ${account.note_nl}`.toLowerCase().includes(query);
  };
  const fresh = state.accounts.filter((account) => !account.already_followed && match(account));
  const known = state.accounts.filter((account) => account.already_followed && match(account));
  const groups = Object.keys(ACCOUNT_CATS)
    .map((category) => {
      const rows = fresh.filter((account) => account.category === category);
      if (!rows.length) return "";
      return `<section class="group"><h3>${esc(ACCOUNT_CATS[category])}</h3><ul class="people">${rows.map((account) => personRow(account, "Volg")).join("")}</ul></section>`;
    })
    .join("");
  return `<section>
    <h2>Ontdek</h2>
    <form>
      <label class="field">Zoek een account
        <input id="ontdek-q" type="search" placeholder="Naam of @handle" value="${esc(state.ontdek.q)}" autocomplete="off" enterkeyhint="search" />
      </label>
    </form>
    <div class="scroller" role="group" aria-label="Filter op categorie">
      ${choice("Alles", "data-filter-cat", "", state.ontdek.category === "")}
      ${Object.entries(ACCOUNT_CATS).map(([id, label]) => choice(label, "data-filter-cat", id, state.ontdek.category === id)).join("")}
    </div>
    <p class="count">${fresh.length} accounts die je nog niet volgt</p>
    ${groups || `<div class="empty"><p>Geen accounts voor deze zoekopdracht.</p></div>`}
    <details class="fold"><summary>Je volgt al (${known.length})</summary><ul class="people">${known.map((account) => personRow(account, "Open")).join("")}</ul></details>
  </section>`;
}

function suggestionButtons(values) {
  return `<div class="chips">${values
    .map((value) => `<button type="button" class="choice" id="${domId("suggest", value)}" data-suggest="${esc(value)}">${esc(value)}</button>`)
    .join("")}</div>`;
}

function searchSuggestions() {
  const counts = new Map();
  const blob = [
    ...state.radar.updates.flatMap((item) => [item.title_nl, item.summary_nl, ...(item.can_do_nl || [])]),
    ...state.radar.examples.flatMap((item) => [item.note_nl, item.text, item.tool]),
    ...state.radar.startups.flatMap((item) => [item.name, item.one_liner_nl, item.why_new_nl]),
  ].join(" ");
  for (const token of blob.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []) {
    if (STOP.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const toolNames = [
    ...new Set([
      ...state.radar.updates.map((item) => item.tool),
      ...state.radar.examples.map((item) => item.tool),
      ...state.tools.map((item) => item.label),
    ].filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "nl"));
  const toolKeys = new Set(toolNames.map((name) => name.toLowerCase()));
  const words = [...counts.entries()]
    .filter(([word, count]) => count >= 2 && !toolKeys.has(word))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"))
    .slice(0, 8)
    .map(([word]) => word);
  const recent = memory.recent.length
    ? `<h3>Recent</h3>${suggestionButtons(memory.recent)}<button type="button" class="textbtn" data-clear-recent>Wis recente zoekopdrachten</button>`
    : "";
  return `<div class="suggest">
    <h3>Tools</h3>
    ${suggestionButtons(toolNames.slice(0, 12))}
    ${words.length ? `<h3>Woorden uit de radar</h3>${suggestionButtons(words)}` : ""}
    ${recent}
  </div>`;
}

function hit(kind, title, meta, text, href) {
  const safe = safeHttps(href);
  const heading = safe
    ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`
    : esc(title);
  return `<article class="card slim"><p class="kind">${esc(kind)}</p><h3>${heading}</h3>${meta ? `<p class="who">${esc(meta)}</p>` : ""}<p class="excerpt">${esc(text)}</p></article>`;
}

function capped(items, render, label) {
  if (!items.length) return "";
  const shown = items.slice(0, 8);
  const more = items.length > shown.length ? `<p class="quiet">Eerste ${shown.length} van ${items.length} ${label}.</p>` : "";
  return `<h3>${esc(label)}</h3><div class="stack">${shown.map(render).join("")}</div>${more}`;
}

function viewSearch() {
  const query = state.zoek.trim().toLowerCase();
  const field = `<form role="search"><label class="field">Zoek in updates, posts, startups, accounts en bronnen
      <input id="zoek" type="search" placeholder="Bijvoorbeeld Grok, workflow, Copilot" value="${esc(state.zoek)}" autocomplete="off" enterkeyhint="search" />
    </label></form>`;
  if (!query) {
    return `<section><p class="back"><a href="#meer" data-tab="meer">Meer</a></p><h2>Zoeken</h2>${field}${searchSuggestions()}</section>`;
  }
  const updates = state.radar.updates.filter((item) =>
    `${item.title_nl} ${item.summary_nl} ${item.tool} ${(item.can_do_nl || []).join(" ")}`.toLowerCase().includes(query),
  );
  const examples = state.radar.examples.filter((item) =>
    `${item.note_nl} ${item.text || ""} ${item.author_handle} ${item.author_name || ""} ${item.tool}`.toLowerCase().includes(query),
  );
  const startups = state.radar.startups.filter((item) =>
    `${item.name} ${item.handle} ${item.one_liner_nl} ${item.why_new_nl}`.toLowerCase().includes(query),
  );
  const creations = allCreations().filter((item) =>
    `${item.title_nl} ${item.what_nl} ${(item.tools || []).join(" ")} ${item.author_name}`.toLowerCase().includes(query),
  );
  const accounts = state.accounts.filter((item) => `${item.name} ${item.handle} ${item.note_nl}`.toLowerCase().includes(query));
  const releases = state.items.filter((item) => `${item.title} ${item.excerpt || ""} ${toolLabel(item.tool)}`.toLowerCase().includes(query));
  const total = updates.length + examples.length + startups.length + creations.length + accounts.length + releases.length;
  const blocks = [
    capped(updates, (item) => hit("Update", item.title_nl, item.tool, item.summary_nl), "Updates"),
    capped(creations, (item) => hit("Gemaakt", item.title_nl, (item.tools || []).join(", "), item.what_nl, item.url), "Gemaakt"),
    capped(examples, (item) => hit("Post", item.author_name || `@${item.author_handle}`, item.tool, item.text || item.note_nl, item.post_url), "Posts"),
    capped(startups, (item) => hit("Startup", item.name, `@${item.handle}`, item.one_liner_nl, item.proof_url), "Startups"),
    capped(accounts, (item) => hit("Account", item.name, `@${item.handle}`, item.note_nl, item.example_url), "Accounts"),
    capped(releases, (item) => hit("Bron", decodeEntities(item.title), toolLabel(item.tool), decodeEntities(item.excerpt || ""), item.url), "Bronnen"),
  ].join("");
  const empty = total
    ? ""
    : `<div class="empty"><p>Niets gevonden voor “${esc(state.zoek.trim())}”.</p></div>${searchSuggestions()}`;
  return `<section><p class="back"><a href="#meer" data-tab="meer">Meer</a></p><h2>Zoeken</h2>${field}<p class="count">${total} treffers</p>${blocks}${empty}</section>`;
}

function sourceCard(item) {
  const cleaned = cleanExcerpt(item.excerpt || "");
  const open = state.bronOpen.has(item.id);
  let body = "";
  let canToggle = false;
  if (cleaned.bullets) {
    canToggle = cleaned.bullets.length > 3;
    const bullets = open || !canToggle ? cleaned.bullets : cleaned.bullets.slice(0, 3);
    body = `<ul class="bullets">${bullets.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>`;
  } else if (cleaned.prose) {
    canToggle = cleaned.prose.length > 240;
    const prose = !canToggle || open ? cleaned.prose : cleaned.prose.slice(0, 240).replace(/\s+\S*$/, "").trim();
    body = `<p class="prose">${esc(prose)}</p>`;
  }
  const href = safeHttps(item.url);
  const title = decodeEntities(item.title);
  return `<article class="card demoted">
    <div class="meta">${toolChip(toolLabel(item.tool))}<span class="pill">${esc(RELEASE_CATS[item.category] || item.category || "")}</span>${Number(item.score) >= 5 ? '<span class="flag">Groot nieuws</span>' : ""}<time datetime="${esc(item.publishedAt)}">${esc(formatDate(item.publishedAt))}</time></div>
    <h3>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>` : esc(title)}</h3>
    ${body}
    ${canToggle ? `<button type="button" class="textbtn" data-bron-open="${esc(item.id)}">${open ? "Minder" : "Meer lezen"}</button>` : ""}
  </article>`;
}

function viewSources() {
  const visible = state.items
    .filter((item) => item.score >= 4 || item.belangrijk)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const slice = visible.slice(0, state.bronnenMore);
  const health = state.sources
    .map(
      (source) =>
        `<p><span class="dot ${esc(source.health)}"></span><span>${esc(source.name)} · ${source.health === "ok" ? "gezond" : "storing"}${source.note ? ` · ${esc(source.note)}` : ""}</span></p>`,
    )
    .join("");
  return `<section>
    <p class="back"><a href="#meer" data-tab="meer">Meer</a></p>
    <h2>Bronnen</h2>
    <p class="quiet">Secundair: automatische changelogs. De vertaalslag staat in Vandaag.</p>
    ${slice.length ? `<div class="stack">${slice.map(sourceCard).join("")}</div>` : `<div class="empty"><p>Geen releases boven de drempel.</p></div>`}
    ${visible.length > slice.length ? `<button class="more" type="button" data-bron-more>Toon meer (${visible.length - slice.length})</button>` : ""}
    <details class="fold"><summary>Gezondheid van de feeds</summary><div class="health">${health || `<p class="quiet">Nog geen ingest.</p>`}</div></details>
  </section>`;
}

function viewSaved() {
  const updates = state.radar.updates.filter((item) => memory.saved.has(`update:${item.id}`));
  const examples = state.radar.examples.filter((item) => memory.saved.has(`example:${item.id}`));
  const startups = state.radar.startups.filter((item) => memory.saved.has(`startup:${item.id}`));
  const creations = allCreations().filter((item) => memory.saved.has(`creation:${item.id}`));
  if (!updates.length && !examples.length && !startups.length) {
    return `<section><p class="back"><a href="#meer" data-tab="meer">Meer</a></p><h2>Bewaard</h2><div class="empty"><p>Nog niets bewaard. Gebruik Bewaren bij een update, een post of een startup. Dat blijft in deze browser.</p><a class="textbtn" href="#vandaag" data-tab="vandaag">Naar de feed</a></div></section>`;
  }
  return `<section>
    <p class="back"><a href="#meer" data-tab="meer">Meer</a></p>
    <h2>Bewaard</h2>
    ${updates.length ? `<h3>Updates</h3><div class="stack">${updates.map(updateCard).join("")}</div>` : ""}
    ${examples.length ? `<h3>Posts</h3><div class="stack">${examples.map(exampleCard).join("")}</div>` : ""}
    ${creations.length ? `<h3>Gemaakt</h3><div class="stack">${creations.map(creationCard).join("")}</div>` : ""}
    ${startups.length ? `<h3>Startups</h3><div class="stack">${startups.map(startupCard).join("")}</div>` : ""}
  </section>`;
}

function viewMore() {
  const saved = memory.saved.size;
  return `<section>
    <h2>Meer</h2>
    <nav class="more-list" aria-label="Extra onderdelen">
      <a href="#voorbeelden" data-tab="voorbeelden">Voorbeelden<span>Posts als raster</span></a>
      <a href="#zoeken" data-tab="zoeken">Zoeken<span>Tools, posts, accounts en bronnen</span></a>
      <a href="#bronnen" data-tab="bronnen">Bronnen<span>Changelogs, secundair</span></a>
      <a href="#bewaard" data-tab="bewaard">Bewaard<span>${saved} ${saved === 1 ? "item" : "items"} in deze browser</span></a>
    </nav>
    <button type="button" class="more" data-mark-all>Alles gelezen</button>
  </section>`;
}

function panel() {
  if (state.tab === "gemaakt") return viewMade();
  if (state.tab === "voorbeelden") return viewExamples();
  if (state.tab === "startups") return viewStartups();
  if (state.tab === "ontdek") return viewDiscover();
  if (state.tab === "zoeken") return viewSearch();
  if (state.tab === "bronnen") return viewSources();
  if (state.tab === "bewaard") return viewSaved();
  if (state.tab === "meer") return viewMore();
  return viewToday();
}

function render() {
  state.galleries = new Map();
  const active = document.activeElement;
  const activeId = active?.id;
  const selectionStart = active instanceof HTMLInputElement ? active.selectionStart : null;
  const selectionEnd = active instanceof HTMLInputElement ? active.selectionEnd : null;
  const scrollY = scrollMode === "top" ? 0 : window.scrollY;
  const savedCount = memory.saved.size;
  const nav = NAV.map(([id, label, icon]) => {
    const current = id === "meer" ? MORE.has(state.tab) : state.tab === id;
    const name = id === "meer" && savedCount ? `${label}, ${savedCount} bewaard` : label;
    return `<button type="button" data-tab="${id}" aria-current="${current ? "page" : "false"}" aria-label="${esc(name)}">${navIcon(icon)}<span>${esc(label)}</span></button>`;
  }).join("");
  const updated = state.generatedAt ? `Bijgewerkt ${formatDate(state.generatedAt)}` : "";
  const banner = state.notice ? `<p class="fixture" role="status">${esc(state.notice)}</p>` : "";
  const main = state.error
    ? `<div class="empty"><p>${esc(state.error)}</p><button class="textbtn" type="button" data-retry>Opnieuw proberen</button></div>`
    : panel();
  app.innerHTML = `<div class="wrap">
    <header class="topbar">
      <div class="brand-row">
        <a class="brand" href="#vandaag" data-tab="vandaag">${MARK}<h1>AI Radar</h1></a>
        <a class="iconbtn" href="#bewaard" data-tab="bewaard" aria-label="Bewaard${savedCount ? `, ${savedCount} items` : ""}">${BOOKMARK}${savedCount ? `<span class="saved-count">${savedCount > 99 ? "99+" : savedCount}</span>` : ""}</a>
      </div>
      ${updated ? `<p class="sub">${esc(updated)}</p>` : ""}
    </header>
    <main id="inhoud" tabindex="-1">${banner}${main}</main>
  </div>
  <nav class="tabbar" aria-label="Onderdelen">${nav}</nav>${viewerHtml()}`;
  app.removeAttribute("aria-busy");
  document.documentElement.classList.toggle("is-viewer", Boolean(state.viewer));
  document.querySelectorAll(".viewer video").forEach((video) => {
    video.addEventListener("error", () => {
      video.classList.add("is-broken");
      const link = video.closest(".viewer")?.querySelector(".xlink");
      if (link) link.textContent = "Bekijk op X";
    });
    video.load();
  });
  if (state.focusViewer) {
    document.querySelector("[data-viewer-close]")?.focus();
    state.focusViewer = false;
  } else if (scrollMode === "top") document.getElementById("inhoud")?.focus();
  else if (activeId) {
    const next = document.getElementById(activeId);
    if (next) {
      next.focus();
      if (typeof selectionStart === "number" && next.setSelectionRange) next.setSelectionRange(selectionStart, selectionEnd);
    }
  }
  window.scrollTo(0, scrollY);
  scrollMode = "restore";
}

function commitSearch(value) {
  const trimmed = value.trim();
  state.zoek = value;
  if (trimmed.length < 2) return;
  memory.recent = [trimmed, ...memory.recent.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
  writeStore(RECENT_KEY, memory.recent);
}

async function loadJson(path) {
  const response = await fetch(new URL(path, document.baseURI));
  if (!response.ok) throw new Error(path);
  return response.json();
}

async function load() {
  state.error = "";
  app.setAttribute("aria-busy", "true");
  try {
    const [radar, accounts, items, sources, tools] = await Promise.all([
      loadJson(useFixture ? "dev/fixtures/radar.fixture.json" : "data/radar.json"),
      loadJson("data/accounts.json"),
      loadJson("data/items.json").catch(() => ({ items: [] })),
      loadJson("data/sources.json").catch(() => ({ sources: [] })),
      loadJson("data/tools.json").catch(() => ({ tools: [] })),
    ]);
    state.radar = {
      updates: Array.isArray(radar.updates) ? radar.updates : [],
      examples: Array.isArray(radar.examples) ? radar.examples : [],
      startups: Array.isArray(radar.startups) ? radar.startups : [],
      creations: Array.isArray(radar.creations) ? radar.creations : [],
    };
    state.accounts = Array.isArray(accounts) ? accounts : [];
    state.items = Array.isArray(items.items) ? items.items : [];
    state.sources = Array.isArray(sources.sources) ? sources.sources : [];
    state.tools = Array.isArray(tools.tools) ? tools.tools : [];
    state.generatedAt = radar.generatedAt ?? null;
    state.notice = useFixture ? radar.notice || "Voorbeelddata. Dit is niet de echte radar." : "";
  } catch {
    state.error = useFixture
      ? "De voorbeelddata kon niet geladen worden."
      : "De radar-gegevens konden niet geladen worden.";
  }
  render();
}

function go(tab) {
  if (!VIEWS.includes(tab)) return;
  state.tab = tab;
  state.viewer = null;
  scrollMode = "top";
  history.replaceState(null, "", `#${state.tab}`);
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest("[data-viewer-close]") || target.classList.contains("viewer")) {
    closeViewer();
    return;
  }
  if (target.closest("[data-viewer-prev]")) {
    stepViewer(-1);
    return;
  }
  if (target.closest("[data-viewer-next]")) {
    stepViewer(1);
    return;
  }
  if (target.closest("[data-yt-play]")) {
    const slide = state.viewer?.items[state.viewer.index];
    const button = target.closest("[data-yt-play]");
    if (state.viewer && slide?.youtubeId && button) {
      const frame = document.createElement("iframe");
      frame.className = "yt-frame";
      frame.title = slide.alt || slide.name || "YouTube";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(slide.youtubeId)}?playsinline=1&autoplay=1`;
      button.replaceWith(frame);
      state.viewer.playing = true;
    }
    return;
  }
  const gallery = target.closest("[data-gallery]");
  if (gallery instanceof HTMLElement && gallery.dataset.gallery) {
    const items = state.galleries.get(gallery.dataset.gallery);
    openViewer(items, Number(gallery.dataset.galleryIndex || 0));
    return;
  }
  const tab = target.closest("[data-tab]");
  if (tab instanceof HTMLElement && tab.dataset.tab) {
    event.preventDefault();
    go(tab.dataset.tab);
    return;
  }
  const save = target.closest("[data-save]");
  if (save instanceof HTMLElement && save.dataset.save) {
    toggleSet(memory.saved, save.dataset.save, persistSaved);
    render();
    return;
  }
  const read = target.closest("[data-read]");
  if (read instanceof HTMLElement && read.dataset.read) {
    toggleSet(memory.read, read.dataset.read, persistRead);
    render();
    return;
  }
  const postMore = target.closest("[data-post-more]");
  if (postMore instanceof HTMLElement && postMore.dataset.postMore) {
    const id = postMore.dataset.postMore;
    if (state.postOpen.has(id)) state.postOpen.delete(id);
    else state.postOpen.add(id);
    render();
    return;
  }
  const expand = target.closest("[data-expand]");
  if (expand instanceof HTMLElement && expand.dataset.expand) {
    state.expanded.add(expand.dataset.expand);
    render();
    return;
  }
  if (target.closest("[data-mark-all]")) {
    markFeedRead();
    render();
    return;
  }
  if (target.closest("[data-only-new]")) {
    state.examples.onlyNew = !state.examples.onlyNew;
    render();
    return;
  }
  const tool = target.closest("[data-filter-tool]");
  if (tool instanceof HTMLElement && tool.hasAttribute("data-filter-tool")) {
    state.examples.tool = tool.dataset.filterTool || "";
    render();
    return;
  }
  const kind = target.closest("[data-filter-kind]");
  if (kind instanceof HTMLElement && kind.hasAttribute("data-filter-kind")) {
    state.examples.kind = kind.dataset.filterKind || "";
    render();
    return;
  }
  const made = target.closest("[data-filter-made]");
  if (made instanceof HTMLElement && made.hasAttribute("data-filter-made")) {
    state.gemaakt.category = made.dataset.filterMade || "";
    render();
    return;
  }
  const category = target.closest("[data-filter-cat]");
  if (category instanceof HTMLElement && category.hasAttribute("data-filter-cat")) {
    state.ontdek.category = category.dataset.filterCat || "";
    render();
    return;
  }
  const suggest = target.closest("[data-suggest]");
  if (suggest instanceof HTMLElement && suggest.dataset.suggest) {
    state.zoek = suggest.dataset.suggest;
    commitSearch(state.zoek);
    state.tab = "zoeken";
    scrollMode = "restore";
    history.replaceState(null, "", "#zoeken");
    render();
    return;
  }
  if (target.closest("[data-clear-recent]")) {
    memory.recent = [];
    writeStore(RECENT_KEY, []);
    render();
    return;
  }
  const bron = target.closest("[data-bron-open]");
  if (bron instanceof HTMLElement && bron.dataset.bronOpen) {
    const id = bron.dataset.bronOpen;
    if (state.bronOpen.has(id)) state.bronOpen.delete(id);
    else state.bronOpen.add(id);
    render();
    return;
  }
  if (target.closest("[data-bron-more]")) {
    state.bronnenMore += 8;
    render();
    return;
  }
  if (target.closest("[data-retry]")) load();
});

let touchStartX = null;
app.addEventListener(
  "touchstart",
  (event) => {
    if (!event.target.closest?.(".viewer-stage")) return;
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  },
  { passive: true },
);
app.addEventListener(
  "touchend",
  (event) => {
    if (touchStartX == null || !state.viewer) return;
    const dx = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 48) return;
    stepViewer(dx < 0 ? 1 : -1);
  },
  { passive: true },
);
window.addEventListener("keydown", (event) => {
  if (!state.viewer) return;
  if (event.key === "Escape") closeViewer();
  if (event.key === "ArrowRight") stepViewer(1);
  if (event.key === "ArrowLeft") stepViewer(-1);
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === "ontdek-q") state.ontdek.q = target.value;
  if (target.id === "zoek") state.zoek = target.value;
  render();
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const input = form.querySelector("#zoek");
  if (input instanceof HTMLInputElement) commitSearch(input.value);
  render();
});

window.addEventListener("hashchange", () => {
  const next = location.hash.replace("#", "");
  if (VIEWS.includes(next) && next !== state.tab) go(next);
});

window.addEventListener(
  "scroll",
  () => {
    document.documentElement.classList.toggle("is-scrolled", window.scrollY > 8);
  },
  { passive: true },
);

const initial = location.hash.replace("#", "");
if (VIEWS.includes(initial)) state.tab = initial;
else if (params.get("q")) state.tab = "zoeken";

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
}

load();
