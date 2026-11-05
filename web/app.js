const NAV = [
  ["vandaag", "Vandaag", "home"],
  ["voorbeelden", "Voorbeelden", "posts"],
  ["startups", "Startups", "spark"],
  ["ontdek", "Ontdek", "compass"],
  ["meer", "Meer", "more"],
];

const VIEWS = ["vandaag", "voorbeelden", "startups", "ontdek", "meer", "zoeken", "bronnen", "bewaard"];
const MORE = new Set(["meer", "zoeken", "bronnen", "bewaard"]);

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
  zoek: params.get("q") || "",
  bronnenMore: 8,
  expanded: new Set(),
  bronOpen: new Set(),
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
  const kept = [];
  for (const point of update.can_do_nl || []) {
    const text = normalize(point);
    if (similar(text, title)) continue;
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

function buildFeed() {
  const items = [
    ...weekUpdates().map((update) => ({ type: "update", date: update.date, update })),
    ...feedStartups().map((startup) => ({ type: "startup", date: startup.date_found, startup })),
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
      return `<figure class="media" data-media>
        <img src="${esc(item.src)}" alt="${esc(alt)}" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('[data-media]')?.classList.add('is-missing');this.remove()" />
        ${badge}
        <span class="missing">Beeld niet geladen</span>
      </figure>`;
    })
    .join("");
  return `<div class="media-grid" data-count="${ready.length}">${figures}</div>`;
}

function postInner(example, { save }) {
  const name = example.author_name || example.author_handle;
  const text = String(example.text || "").trim();
  const body = text || example.note_nl || "";
  const showTakeaway = Boolean(text) && example.note_nl && normalize(text) !== normalize(example.note_nl);
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
    ${body ? `<p class="post-text">${esc(body)}</p>` : ""}
    ${mediaHtml(example.media)}
    ${showTakeaway ? `<p class="takeaway"><span>Wat is hier gaaf aan</span>${esc(example.note_nl)}</p>` : ""}
    ${metricsLine(example.metrics)}
    <div class="post-actions">
      ${href ? `<a class="xlink" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open op X</a>` : ""}
      ${save ? `<button type="button" class="textbtn" id="${domId("save", `example-${example.id}`)}" data-save="example:${esc(example.id)}" aria-pressed="${saved}">${saved ? "Bewaard" : "Bewaar"}</button>` : ""}
    </div>`;
}

function updateCard(update) {
  const key = `update:${update.id}`;
  const unread = !memory.read.has(key);
  const examples = (update.example_ids || []).map(exampleById).filter(Boolean);
  const open = state.expanded.has(update.id);
  const shown = open ? examples : examples.slice(0, 2);
  const extra = examples.length - shown.length;
  const uses = useCases(update);
  return `<article class="card update ${unread ? "is-unread" : "is-read"}">
    <div class="card-kicker">
      ${toolChip(update.tool)}
      ${Number(update.importance) >= 5 ? '<span class="flag">Groot nieuws</span>' : ""}
      <time datetime="${esc(update.date)}">${esc(formatDate(update.date))}</time>
    </div>
    <h3>${esc(update.title_nl)}</h3>
    <p class="summary">${esc(update.summary_nl)}</p>
    ${uses.length ? `<div class="uses"><p>Dit kun je ermee</p><ul>${uses.map((point) => `<li>${esc(point)}</li>`).join("")}</ul></div>` : ""}
    ${shown.length ? `<div class="posts">${shown.map((example) => `<div class="post">${postInner(example, { save: true })}</div>`).join("")}</div>` : ""}
    ${extra > 0 ? `<button type="button" class="textbtn wide" data-expand="${esc(update.id)}">Toon nog ${extra} ${extra === 1 ? "voorbeeld" : "voorbeelden"}</button>` : ""}
    ${actionRow(key)}
  </article>`;
}

function startupCard(startup) {
  const key = `startup:${startup.id}`;
  const unread = !memory.read.has(key);
  const website = safeHttps(startup.website_url);
  const proof = safeHttps(startup.proof_url);
  const account = safeHttps(startup.url);
  return `<article class="card startup ${unread ? "is-unread" : "is-read"}">
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
      return heading + updateCard(item.update);
    })
    .join("");
  const unread = feedUnread();
  return `<section>
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
  const list = filtered.length
    ? `<div class="stack">${filtered.map(exampleCard).join("")}</div>`
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
  const accounts = state.accounts.filter((item) => `${item.name} ${item.handle} ${item.note_nl}`.toLowerCase().includes(query));
  const releases = state.items.filter((item) => `${item.title} ${item.excerpt || ""} ${toolLabel(item.tool)}`.toLowerCase().includes(query));
  const total = updates.length + examples.length + startups.length + accounts.length + releases.length;
  const blocks = [
    capped(updates, (item) => hit("Update", item.title_nl, item.tool, item.summary_nl), "Updates"),
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
  if (!updates.length && !examples.length && !startups.length) {
    return `<section><p class="back"><a href="#meer" data-tab="meer">Meer</a></p><h2>Bewaard</h2><div class="empty"><p>Nog niets bewaard. Gebruik Bewaren bij een update, een post of een startup. Dat blijft in deze browser.</p><a class="textbtn" href="#vandaag" data-tab="vandaag">Naar de feed</a></div></section>`;
  }
  return `<section>
    <p class="back"><a href="#meer" data-tab="meer">Meer</a></p>
    <h2>Bewaard</h2>
    ${updates.length ? `<h3>Updates</h3><div class="stack">${updates.map(updateCard).join("")}</div>` : ""}
    ${examples.length ? `<h3>Posts</h3><div class="stack">${examples.map(exampleCard).join("")}</div>` : ""}
    ${startups.length ? `<h3>Startups</h3><div class="stack">${startups.map(startupCard).join("")}</div>` : ""}
  </section>`;
}

function viewMore() {
  const saved = memory.saved.size;
  return `<section>
    <h2>Meer</h2>
    <nav class="more-list" aria-label="Extra onderdelen">
      <a href="#zoeken" data-tab="zoeken">Zoeken<span>Tools, posts, accounts en bronnen</span></a>
      <a href="#bronnen" data-tab="bronnen">Bronnen<span>Changelogs, secundair</span></a>
      <a href="#bewaard" data-tab="bewaard">Bewaard<span>${saved} ${saved === 1 ? "item" : "items"} in deze browser</span></a>
    </nav>
    <button type="button" class="more" data-mark-all>Alles gelezen</button>
  </section>`;
}

function panel() {
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
  <nav class="tabbar" aria-label="Onderdelen">${nav}</nav>`;
  app.removeAttribute("aria-busy");
  if (scrollMode === "top") document.getElementById("inhoud")?.focus();
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
  scrollMode = "top";
  history.replaceState(null, "", `#${state.tab}`);
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
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
