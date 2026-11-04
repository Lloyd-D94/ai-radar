const CATEGORIES = {
  "nieuwe-functie": "Nieuwe functie",
  prijswijziging: "Prijswijziging",
  model: "Model",
  beveiliging: "Beveiliging",
  "breaking-change": "Breaking change",
  tutorial: "Tutorial",
  overig: "Overig",
};

const TABS = [
  ["vandaag", "Vandaag"],
  ["week", "Week"],
  ["kennisbank", "Kennisbank"],
  ["bronnen", "Bronnen"],
];

const app = document.querySelector("#app");
const state = {
  tab: "vandaag",
  items: [],
  sources: [],
  tools: [],
  generatedAt: null,
  error: "",
  shown: 30,
  filters: {
    q: "",
    tool: "",
    category: "",
    minScore: 4,
    from: "",
    patches: false,
    community: false,
  },
};

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function toolLabel(id) {
  return state.tools.find((tool) => tool.id === id)?.label ?? id;
}

function sourceName(id) {
  return state.sources.find((source) => source.id === id)?.name ?? id;
}

function categoryLabel(id) {
  return CATEGORIES[id] ?? id;
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "bron";
  }
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "datum onbekend";
  return dateFmt.format(date);
}

function formatStamp(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "nog niet";
  return timeFmt.format(date);
}

function relative(iso) {
  if (!iso) return "nog niet gelukt";
  const delta = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(delta)) return "onbekend";
  const minutes = Math.round(delta / 60000);
  if (minutes < 2) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.round(hours / 24);
  if (days === 1) return "gisteren";
  if (days < 21) return `${days} dagen geleden`;
  return formatDate(iso);
}

function passesDefault(item) {
  return item.score >= 4 || item.belangrijk;
}

function bySignal(left, right) {
  const rank = { primair: 0, secundair: 1, community: 2 };
  const priority = (rank[left.priority] ?? 9) - (rank[right.priority] ?? 9);
  if (priority !== 0) return priority;
  if (right.score !== left.score) return right.score - left.score;
  return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
}

function highlights() {
  const cutoff = Date.now() - 21 * 86400000;
  return state.items
    .filter((item) => Date.parse(item.publishedAt) >= cutoff)
    .filter((item) => item.score >= 5 || (item.belangrijk && item.score >= 4))
    .filter((item) => !(item.isPatch && !item.belangrijk))
    .sort(bySignal)
    .slice(0, 4);
}

function latestPriority(tool) {
  const list = state.items.filter((item) => item.tool === tool);
  const preferred = list.filter((item) => item.sourceId === "grok-build" || item.sourceId === "releasebot-xai");
  const pool = tool === "grok-build" && preferred.length ? preferred : list;
  return [...pool].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] ?? null;
}

function scoreTicks(score) {
  const bits = [1, 2, 3, 4, 5]
    .map((step) => `<i class="${step <= score ? "" : "off"}"></i>`)
    .join("");
  return `<span class="score" role="img" aria-label="Relevantie ${score} van 5">${bits}</span>`;
}

function card(item) {
  const also = item.alsoSeenAt?.length
    ? `<p class="also">Ook gezien bij ${item.alsoSeenAt.map((seen) => esc(sourceName(seen.sourceId))).join(", ")}</p>`
    : "";
  const reasons = (item.scoreReasons ?? []).map((reason) => `<li>${esc(reason)}</li>`).join("");
  return `<article class="card ${item.priority === "primair" ? "primary" : ""}">
    <div class="meta">
      <span class="tool">${esc(toolLabel(item.tool))}</span>
      <span class="cat">${esc(categoryLabel(item.category))}</span>
      ${item.isPatch ? '<span class="pill">patch</span>' : ""}
      ${item.belangrijk ? '<span class="pill">belangrijk</span>' : ""}
      ${scoreTicks(item.score)}
    </div>
    <h3><a href="${esc(item.url)}">${esc(item.title)}</a></h3>
    <p class="when">${esc(formatDate(item.publishedAt))}${item.points ? ` · ${item.points} punten` : ""}</p>
    ${item.excerpt ? `<p class="excerpt">${esc(item.excerpt)}</p>` : ""}
    ${item.actionLine ? `<p class="action"><span>Nu</span> ${esc(item.actionLine)}</p>` : ""}
    ${also}
    <details class="why"><summary>Waarom deze score</summary><ul>${reasons}</ul></details>
    <a class="source" href="${esc(item.url)}">Bron op ${esc(host(item.url))}</a>
  </article>`;
}

function priorityBlock() {
  const tools = ["grok-build", "grok-bot"];
  const cards = tools
    .map((tool) => {
      const item = latestPriority(tool);
      if (!item) {
        return `<article class="card primary"><h3>${esc(toolLabel(tool))}</h3><p class="quiet">Nog geen item. Kijk bij Bronnen of de feed gezond is.</p></article>`;
      }
      const fresh = Date.now() - Date.parse(item.publishedAt) <= 24 * 3600 * 1000;
      const note = fresh ? "" : `<p class="quiet">Laatste release, ouder dan 24 uur.</p>`;
      return `<div>${card(item)}${note}</div>`;
    })
    .join("");
  return `<section><h2>Grok, bovenaan</h2><div class="pair">${cards}</div></section>`;
}

function highlightBlock() {
  const items = highlights();
  if (!items.length) return "";
  return `<section aria-label="Grote ontwikkelingen"><h2>Grote ontwikkelingen</h2><div class="strip">${items.map(card).join("")}</div></section>`;
}

function viewToday() {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const recent = state.items.filter((item) => Date.parse(item.publishedAt) >= cutoff);
  const featured = new Set(
    ["grok-build", "grok-bot"].map((tool) => latestPriority(tool)?.id).filter(Boolean),
  );
  const shown = recent
    .filter(passesDefault)
    .filter((item) => item.priority !== "community" && !featured.has(item.id));
  const hiddenPatches = recent.filter((item) => item.isPatch && !item.belangrijk && !passesDefault(item)).length;
  const body = shown.length
    ? `<div class="stack">${shown.sort(bySignal).map(card).join("")}</div>`
    : `<div class="empty"><p>Geen items met score 4 of hoger in de afgelopen 24 uur.</p><p>Belangrijke beveiligings-, prijs- en breaking-wijzigingen zouden hier wel staan.</p></div>`;
  const patchNote = hiddenPatches
    ? `<p class="note">${hiddenPatches} patchrelease${hiddenPatches === 1 ? "" : "s"} in dit etmaal weggelaten om ruis te beperken.</p>`
    : "";
  return `${highlightBlock()}${priorityBlock()}<section><h2>Afgelopen 24 uur</h2>${body}${patchNote}</section>`;
}

function viewWeek() {
  const cutoff = Date.now() - 7 * 86400000;
  const recent = state.items.filter((item) => Date.parse(item.publishedAt) >= cutoff && item.priority !== "community");
  const primary = ["grok-build", "grok-bot"];
  const rest = [];
  for (const item of recent) if (!primary.includes(item.tool) && !rest.includes(item.tool)) rest.push(item.tool);
  const order = [...primary, ...rest];
  const blocks = order
    .map((tool) => {
      const all = recent.filter((item) => item.tool === tool);
      const visible = all.filter(passesDefault).sort(bySignal);
      const patches = all.filter((item) => item.isPatch && !item.belangrijk).length;
      const latest = latestPriority(tool);
      const head = `<header><h3>${esc(toolLabel(tool))}</h3><p class="quiet">${visible.length} relevant${patches ? ` · ${patches} patches` : ""}</p></header>`;
      if (!all.length && primary.includes(tool)) {
        const extra = latest ? `<p class="quiet">Geen updates deze week. Laatste: ${esc(latest.title)} (${esc(formatDate(latest.publishedAt))}).</p>` : `<p class="quiet">Geen updates deze week.</p>`;
        return `<section class="tool-block">${head}${extra}</section>`;
      }
      if (!all.length) return "";
      const top = visible.slice(0, 3).map(card).join("");
      const empty = visible.length
        ? `<div class="stack">${top}</div>`
        : `<p class="quiet">Geen items boven de ruisdrempel.${patches ? ` ${patches} patchreleases niet uitgeschreven.` : ""}</p>`;
      return `<section class="tool-block">${head}${empty}</section>`;
    })
    .join("");
  const community = state.items.filter(
    (item) => item.priority === "community" && Date.parse(item.publishedAt) >= cutoff,
  );
  const communityBlock = community.length
    ? `<details class="community"><summary>Community (${community.length}, standaard verborgen)</summary><div class="stack">${community
        .sort(bySignal)
        .slice(0, 8)
        .map(card)
        .join("")}</div></details>`
    : "";
  return `${highlightBlock()}<section><h2>Afgelopen 7 dagen</h2><div class="tools">${blocks}</div>${communityBlock}</section>`;
}

function knowledgeItems() {
  const query = state.filters.q.trim().toLowerCase();
  return state.items.filter((item) => {
    if (!state.filters.community && item.priority === "community") return false;
    if (!state.filters.patches && item.isPatch && !item.belangrijk) return false;
    if (item.score < Number(state.filters.minScore) && !item.belangrijk) return false;
    if (state.filters.tool && item.tool !== state.filters.tool) return false;
    if (state.filters.category && item.category !== state.filters.category) return false;
    if (state.filters.from && item.publishedAt.slice(0, 10) < state.filters.from) return false;
    if (!query) return true;
    const haystack = [item.title, item.excerpt, item.actionLine, toolLabel(item.tool), categoryLabel(item.category), item.url]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function viewKnowledge() {
  const matches = knowledgeItems();
  const slice = matches.slice(0, state.shown);
  const toolOptions = state.tools
    .map((tool) => `<option value="${esc(tool.id)}" ${state.filters.tool === tool.id ? "selected" : ""}>${esc(tool.label)}</option>`)
    .join("");
  const categoryOptions = Object.entries(CATEGORIES)
    .map(([id, label]) => `<option value="${esc(id)}" ${state.filters.category === id ? "selected" : ""}>${esc(label)}</option>`)
    .join("");
  const list = slice.length
    ? `<div class="stack">${slice.map(card).join("")}</div>`
    : `<div class="empty"><p>Geen items voor deze zoekopdracht of filters.</p><p>Zet de minimumscore lager, of vink patches en community aan.</p></div>`;
  const more = matches.length > slice.length ? `<button class="more" type="button" data-more>Toon meer (${matches.length - slice.length})</button>` : "";
  return `<section><h2>Kennisbank</h2>
    <form class="filters" id="zoek" role="search">
      <label class="wide">Zoeken
        <input id="q" type="search" placeholder="Titel, tool, fragment…" autocomplete="off" value="${esc(state.filters.q)}" />
      </label>
      <label>Tool
        <select id="tool"><option value="">Alle tools</option>${toolOptions}</select>
      </label>
      <label>Categorie
        <select id="category"><option value="">Alle categorieën</option>${categoryOptions}</select>
      </label>
      <label>Minimumscore
        <select id="minScore">${[1, 2, 3, 4, 5].map((score) => `<option value="${score}" ${Number(state.filters.minScore) === score ? "selected" : ""}>${score}</option>`).join("")}</select>
      </label>
      <label>Vanaf
        <input id="from" type="date" value="${esc(state.filters.from)}" />
      </label>
      <div class="checks wide">
        <label><input id="patches" type="checkbox" ${state.filters.patches ? "checked" : ""} /> Patches</label>
        <label><input id="community" type="checkbox" ${state.filters.community ? "checked" : ""} /> Community</label>
      </div>
    </form>
    <p class="count">${matches.length} items. Beveiliging, prijs en breaking changes blijven zichtbaar.</p>
    ${list}
    ${more}
  </section>`;
}

function viewSources() {
  if (!state.sources.length) return `<div class="empty"><p>Nog geen bronstatus. De ingest heeft nog niet gedraaid.</p></div>`;
  const rows = state.sources
    .map((source) => {
      const health = source.health === "ok" ? "gezond" : source.health === "fout" ? "storing" : "onbekend";
      return `<article class="source-row">
        <span class="dot ${esc(source.health)}" aria-hidden="true"></span>
        <div>
          <h3>${esc(source.name)} <span class="pill">${esc(health)}</span></h3>
          <p>${esc(source.description)}</p>
          <p>Laatste geslaagde ophaling: ${esc(relative(source.lastSuccessAt))}.</p>
          ${source.note ? `<p>${esc(source.note)}</p>` : ""}
          ${source.lastError ? `<p class="error">${esc(source.lastError)}</p>` : ""}
          <p><a href="${esc(source.url)}">Bron openen</a> · ${source.itemsFetched ?? 0} nieuwe items deze run</p>
        </div>
      </article>`;
    })
    .join("");
  return `<section><h2>Bronnen</h2>${rows}</section>`;
}

function panel() {
  if (state.tab === "week") return viewWeek();
  if (state.tab === "kennisbank") return viewKnowledge();
  if (state.tab === "bronnen") return viewSources();
  return viewToday();
}

function render() {
  const active = document.activeElement;
  const activeId = active?.id;
  const selectionStart = active?.selectionStart;
  const selectionEnd = active?.selectionEnd;
  const scrollY = window.scrollY;
  const failed = state.sources.filter((source) => source.health === "fout").length;
  const tabs = TABS.map(
    ([id, label]) =>
      `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-selected="${state.tab === id}" aria-controls="inhoud" tabindex="${state.tab === id ? "0" : "-1"}">${label}</button>`,
  ).join("");
  app.innerHTML = `<div class="wrap">
    <header class="mast">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M16 16 L16 6 A10 10 0 0 1 24.5 19 Z" fill="currentColor"/><circle cx="16" cy="16" r="1.7" fill="#f4f0e8"/></svg>
      <div>
        <h1>AI Radar</h1>
        <p class="updated">Laatst bijgewerkt ${esc(formatStamp(state.generatedAt))}${failed ? ` · ${failed} bron${failed === 1 ? "" : "nen"} met storing` : ""}</p>
        <p class="lede">Bijblijven met AI-coding, zonder ruis. Alleen wat de bron zelf zegt.</p>
      </div>
    </header>
    <div class="tabs" role="tablist" aria-label="Weergaven">${tabs}</div>
    <main id="inhoud" role="tabpanel" aria-labelledby="tab-${state.tab}" tabindex="-1">${state.error ? `<div class="empty"><p>${esc(state.error)}</p><button class="retry" type="button" data-retry>Opnieuw proberen</button></div>` : panel()}</main>
    <p class="foot">Standaard alleen score 4 of hoger, plus beveiliging, prijswijzigingen en breaking changes. Geen e-mail, geen push.</p>
  </div>`;
  app.removeAttribute("aria-busy");
  if (activeId) {
    const next = document.getElementById(activeId);
    if (next) {
      next.focus();
      if (typeof selectionStart === "number" && next.setSelectionRange) {
        next.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
  window.scrollTo(0, scrollY);
}

async function load() {
  state.error = "";
  app.setAttribute("aria-busy", "true");
  try {
    const [itemsRes, sourcesRes, toolsRes] = await Promise.all([
      fetch(new URL("data/items.json", document.baseURI)),
      fetch(new URL("data/sources.json", document.baseURI)),
      fetch(new URL("data/tools.json", document.baseURI)),
    ]);
    if (!itemsRes.ok || !sourcesRes.ok || !toolsRes.ok) throw new Error("De gegevens konden niet geladen worden.");
    const itemsJson = await itemsRes.json();
    const sourcesJson = await sourcesRes.json();
    const toolsJson = await toolsRes.json();
    state.items = Array.isArray(itemsJson.items) ? itemsJson.items : [];
    state.sources = Array.isArray(sourcesJson.sources) ? sourcesJson.sources : [];
    state.tools = Array.isArray(toolsJson.tools) ? toolsJson.tools : [];
    state.generatedAt = itemsJson.generatedAt ?? sourcesJson.generatedAt ?? null;
  } catch {
    state.error = "De gegevens konden niet geladen worden. Controleer of data/items.json bereikbaar is.";
  }
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const tab = target?.closest("[data-tab]");
  if (tab instanceof HTMLElement && tab.dataset.tab) {
    state.tab = tab.dataset.tab;
    state.shown = 30;
    history.replaceState(null, "", `#${state.tab}`);
    render();
    return;
  }
  if (target?.closest("[data-more]")) {
    state.shown += 30;
    render();
  }
  if (target?.closest("[data-retry]")) load();
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target.id === "q") state.filters.q = target.value;
  if (target.id === "tool") state.filters.tool = target.value;
  if (target.id === "category") state.filters.category = target.value;
  if (target.id === "minScore") state.filters.minScore = Number(target.value);
  if (target.id === "from") state.filters.from = target.value;
  if (target.id === "patches" && target instanceof HTMLInputElement) state.filters.patches = target.checked;
  if (target.id === "community" && target instanceof HTMLInputElement) state.filters.community = target.checked;
  state.shown = 30;
  render();
});

app.addEventListener("submit", (event) => event.preventDefault());

window.addEventListener("hashchange", () => {
  const next = location.hash.replace("#", "");
  if (TABS.some(([id]) => id === next)) {
    state.tab = next;
    render();
  }
});

const initial = location.hash.replace("#", "");
if (TABS.some(([id]) => id === initial)) state.tab = initial;

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
}

load();
