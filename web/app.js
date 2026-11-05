const TABS = [
  ["vandaag", "Vandaag"],
  ["voorbeelden", "Voorbeelden"],
  ["startups", "Startups"],
  ["ontdek", "Ontdek"],
  ["zoeken", "Zoeken"],
  ["bronnen", "Bronnen"],
];

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

const app = document.querySelector("#app");
const state = {
  tab: "vandaag",
  radar: { updates: [], examples: [], startups: [] },
  accounts: [],
  items: [],
  sources: [],
  tools: [],
  generatedAt: null,
  error: "",
  shown: 20,
  examples: { tool: "", kind: "", onlyNew: true },
  ontdek: { q: "", category: "" },
  zoek: "",
  bronnenMore: 20,
};

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  day: "numeric",
  month: "short",
});
const followersFmt = new Intl.NumberFormat("nl-NL");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "datum onbekend";
  return dateFmt.format(date);
}

function inLastDays(iso, days) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return false;
  const delta = Date.now() - time;
  return delta <= days * 86_400_000 && delta >= -3_600_000;
}

function byImportance(a, b) {
  if (b.importance !== a.importance) return b.importance - a.importance;
  return Date.parse(b.date) - Date.parse(a.date);
}

function toolLabel(id) {
  return state.tools.find((tool) => tool.id === id)?.label ?? id;
}

function exampleById(id) {
  return state.radar.examples.find((item) => item.id === id);
}

function dots(score, label) {
  const bits = [1, 2, 3, 4, 5].map((step) => `<i class="${step <= score ? "" : "off"}"></i>`).join("");
  return `<span class="score" role="img" aria-label="${esc(label)} ${score} van 5">${bits}</span>`;
}

function xLink(url, text) {
  return `<a class="x" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
}

function exampleRow(example) {
  if (!example) return "";
  return `<article class="example">
    <div class="meta">
      <span class="tool">${esc(example.tool)}</span>
      <span class="pill">${esc(KINDS[example.kind] ?? example.kind)}</span>
      ${example.from_followed ? '<span class="pill">volg je al</span>' : '<span class="pill new">nog niet gevolgd</span>'}
    </div>
    <p class="who">@${esc(example.author_handle)} · ${esc(formatDate(example.date))}</p>
    <p class="excerpt">${esc(example.note_nl)}</p>
    ${xLink(example.post_url, "Open op X")}
  </article>`;
}

function updateCard(update) {
  const examples = update.example_ids.map(exampleById).filter(Boolean);
  return `<article class="card">
    <div class="meta">
      <span class="tool">${esc(update.tool)}</span>
      ${update.seed ? '<span class="pill">startset</span>' : ""}
      ${dots(update.importance, "Belang")}
    </div>
    <h3>${esc(update.title_nl)}</h3>
    <p class="when">${esc(formatDate(update.date))}</p>
    <p class="excerpt">${esc(update.summary_nl)}</p>
    <div class="cando">
      <p>Dit kun je ermee</p>
      <ul>${update.can_do_nl.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>
    </div>
    ${examples.length ? `<div class="stack">${examples.map(exampleRow).join("")}</div>` : ""}
  </article>`;
}

function weekUpdates() {
  return state.radar.updates.filter((update) => inLastDays(update.date, 7)).sort(byImportance);
}

function viewToday() {
  const updates = weekUpdates();
  const top = updates.slice(0, 3);
  const summary = top.length
    ? `<ol class="five">${top
        .map(
          (update, index) =>
            `<li><span>${index + 1}</span><div><strong>${esc(update.tool)}</strong> ${esc(update.title_nl)}<br /><em>${esc(update.can_do_nl[0] ?? "")}</em></div></li>`,
        )
        .join("")}</ol>`
    : `<p class="quiet">Geen vertaalslag uit de laatste 7 dagen.</p>`;
  const cards = updates.length
    ? `<div class="stack">${updates.map(updateCard).join("")}</div>`
    : `<div class="empty"><p>Nog niets in de laatste 7 dagen.</p><p>Kijk bij Voorbeelden of Startups, of wacht op de volgende radar-update.</p></div>`;
  return `<section>
    <h2>In 5 minuten</h2>
    ${summary}
    <h2>Laatste 7 dagen</h2>
    ${cards}
  </section>`;
}

function viewExamples() {
  const tools = [...new Set(state.radar.examples.map((item) => item.tool))].sort((a, b) => a.localeCompare(b, "nl"));
  const filtered = state.radar.examples
    .filter((item) => (state.examples.onlyNew ? item.from_followed === false : true))
    .filter((item) => (state.examples.tool ? item.tool === state.examples.tool : true))
    .filter((item) => (state.examples.kind ? item.kind === state.examples.kind : true))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const list = filtered.length
    ? `<div class="stack">${filtered.map(exampleRow).join("")}</div>`
    : `<div class="empty"><p>Geen voorbeelden voor deze filters.</p><p>Zet “alleen accounts die ik nog niet volg” uit om ook posts van accounts die je al volgt te zien.</p></div>`;
  return `<section>
    <h2>Voorbeelden</h2>
    <form class="filters">
      <label>Tool
        <select id="ex-tool"><option value="">Alle tools</option>${tools.map((tool) => `<option value="${esc(tool)}" ${state.examples.tool === tool ? "selected" : ""}>${esc(tool)}</option>`).join("")}</select>
      </label>
      <label>Soort
        <select id="ex-kind"><option value="">Alles</option>${Object.entries(KINDS).map(([id, label]) => `<option value="${id}" ${state.examples.kind === id ? "selected" : ""}>${label}</option>`).join("")}</select>
      </label>
      <label class="check wide"><input id="ex-new" type="checkbox" ${state.examples.onlyNew ? "checked" : ""} /> Alleen van accounts die ik nog niet volg</label>
    </form>
    <p class="count">${filtered.length} posts</p>
    ${list}
  </section>`;
}

function viewStartups() {
  const cards = [...state.radar.startups]
    .sort((a, b) => Date.parse(b.date_found) - Date.parse(a.date_found))
    .map(
      (startup) => `<article class="card">
        <div class="meta"><span class="tool">@${esc(startup.handle)}</span>${startup.seed ? '<span class="pill">startset</span>' : ""}</div>
        <h3>${esc(startup.name)}</h3>
        <p class="excerpt">${esc(startup.one_liner_nl)}</p>
        <p class="cando-line"><span>Waarom nieuw</span> ${esc(startup.why_new_nl)}</p>
        <p class="when">Gezien ${esc(formatDate(startup.date_found))}</p>
        <p class="links">${xLink(startup.url, "Account op X")} · ${xLink(startup.proof_url, "Bewijs-post")}</p>
      </article>`,
    )
    .join("");
  return `<section><h2>Startups</h2>${cards || `<div class="empty"><p>Nog geen startups.</p></div>`}</section>`;
}

function accountRow(account) {
  return `<article class="account">
    <div>
      <h3><a href="https://x.com/${esc(account.handle)}" target="_blank" rel="noopener noreferrer">${esc(account.name)}</a></h3>
      <p class="who">@${esc(account.handle)} · ${esc(followersFmt.format(account.followers))} volgers</p>
      <p class="excerpt">${esc(account.note_nl)}</p>
    </div>
  </article>`;
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
      return `<section class="tool-block"><h3>${esc(ACCOUNT_CATS[category])}</h3><div class="stack">${rows.map(accountRow).join("")}</div></section>`;
    })
    .join("");
  return `<section>
    <h2>Ontdek</h2>
    <p class="lede">Accounts die je nog niet volgt.</p>
    <form class="filters">
      <label class="wide">Zoeken
        <input id="ontdek-q" type="search" placeholder="Naam, handle, notitie…" value="${esc(state.ontdek.q)}" autocomplete="off" />
      </label>
      <label class="wide">Categorie
        <select id="ontdek-cat"><option value="">Alle categorieën</option>${Object.entries(ACCOUNT_CATS).map(([id, label]) => `<option value="${id}" ${state.ontdek.category === id ? "selected" : ""}>${label}</option>`).join("")}</select>
      </label>
    </form>
    <p class="count">${fresh.length} nieuwe accounts</p>
    ${groups || `<div class="empty"><p>Geen accounts voor deze zoekopdracht.</p></div>`}
    <details class="followed"><summary>Je volgt al (${known.length})</summary><div class="stack">${known.map(accountRow).join("")}</div></details>
  </section>`;
}

function hit(kind, title, meta, text) {
  return `<article class="card slim"><p class="pill">${esc(kind)}</p><h3>${title}</h3><p class="who">${meta}</p><p class="excerpt">${esc(text)}</p></article>`;
}

function viewSearch() {
  const query = state.zoek.trim().toLowerCase();
  if (!query) {
    return `<section><h2>Zoeken</h2><form class="filters"><label class="wide">Zoek in updates, voorbeelden, startups, accounts en releases
      <input id="zoek" type="search" placeholder="Bijvoorbeeld bellen, startup, Copilot…" value="" autocomplete="off" />
    </label></form><p class="quiet">Eén veld over de hele radar.</p></section>`;
  }
  const updates = state.radar.updates.filter((item) =>
    `${item.title_nl} ${item.summary_nl} ${item.tool} ${item.can_do_nl.join(" ")}`.toLowerCase().includes(query),
  );
  const examples = state.radar.examples.filter((item) =>
    `${item.note_nl} ${item.author_handle} ${item.tool} ${item.kind}`.toLowerCase().includes(query),
  );
  const startups = state.radar.startups.filter((item) =>
    `${item.name} ${item.handle} ${item.one_liner_nl} ${item.why_new_nl}`.toLowerCase().includes(query),
  );
  const accounts = state.accounts.filter((item) => `${item.name} ${item.handle} ${item.note_nl}`.toLowerCase().includes(query));
  const releases = state.items.filter((item) =>
    `${item.title} ${item.excerpt} ${toolLabel(item.tool)}`.toLowerCase().includes(query),
  );
  const blocks = [
    updates.map((item) => hit("Update", esc(item.title_nl), esc(item.tool), item.summary_nl)),
    examples.map((item) => hit("Voorbeeld", `@${esc(item.author_handle)}`, esc(item.tool), item.note_nl)),
    startups.map((item) => hit("Startup", esc(item.name), `@${esc(item.handle)}`, item.one_liner_nl)),
    accounts.map((item) => hit("Account", esc(item.name), `@${esc(item.handle)}`, item.note_nl)),
    releases.slice(0, 12).map((item) => hit("Release", esc(item.title), esc(toolLabel(item.tool)), item.excerpt ?? "")),
  ].flat();
  return `<section>
    <h2>Zoeken</h2>
    <form class="filters"><label class="wide">Zoek in updates, voorbeelden, startups, accounts en releases
      <input id="zoek" type="search" value="${esc(state.zoek)}" autocomplete="off" />
    </label></form>
    <p class="count">${blocks.length} treffers</p>
    ${blocks.length ? `<div class="stack">${blocks.join("")}</div>` : `<div class="empty"><p>Niets gevonden voor “${esc(state.zoek.trim())}”.</p></div>`}
  </section>`;
}

function passesRelease(item) {
  return item.score >= 4 || item.belangrijk;
}

function viewSources() {
  const visible = state.items
    .filter(passesRelease)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const slice = visible.slice(0, state.bronnenMore);
  const cards = slice
    .map(
      (item) => `<article class="card slim">
        <div class="meta"><span class="tool">${esc(toolLabel(item.tool))}</span><span class="pill">${esc(RELEASE_CATS[item.category] ?? item.category)}</span>${dots(item.score, "Relevantie")}</div>
        <h3><a href="${esc(item.url)}">${esc(item.title)}</a></h3>
        <p class="when">${esc(formatDate(item.publishedAt))}</p>
        ${item.excerpt ? `<p class="excerpt">${esc(item.excerpt)}</p>` : ""}
      </article>`,
    )
    .join("");
  const health = state.sources
    .map(
      (source) =>
        `<p class="who"><span class="dot ${esc(source.health)}"></span> ${esc(source.name)} · ${source.health === "ok" ? "gezond" : "storing"}${source.note ? ` · ${esc(source.note)}` : ""}</p>`,
    )
    .join("");
  const more =
    visible.length > slice.length
      ? `<button class="more" type="button" data-more>Toon meer releases (${visible.length - slice.length})</button>`
      : "";
  return `<section>
    <h2>Bronnen</h2>
    <p class="lede">Secundair: automatische releases en changelogs. De vertaalslag staat bij Vandaag.</p>
    ${cards ? `<div class="stack">${cards}</div>` : `<div class="empty"><p>Geen releases boven de drempel.</p></div>`}
    ${more}
    <details class="followed"><summary>Gezondheid van de feeds</summary>${health || `<p class="quiet">Nog geen ingest.</p>`}</details>
  </section>`;
}

function panel() {
  if (state.tab === "voorbeelden") return viewExamples();
  if (state.tab === "startups") return viewStartups();
  if (state.tab === "ontdek") return viewDiscover();
  if (state.tab === "zoeken") return viewSearch();
  if (state.tab === "bronnen") return viewSources();
  return viewToday();
}

function render() {
  const active = document.activeElement;
  const activeId = active?.id;
  const selectionStart = active?.selectionStart;
  const selectionEnd = active?.selectionEnd;
  const scrollY = window.scrollY;
  const tabs = TABS.map(
    ([id, label]) =>
      `<button type="button" data-tab="${id}" aria-current="${state.tab === id ? "page" : "false"}">${label}</button>`,
  ).join("");
  app.innerHTML = `<div class="wrap">
    <header class="mast">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M16 16 L16 6 A10 10 0 0 1 24.5 19 Z" fill="currentColor"/><circle cx="16" cy="16" r="1.7" fill="#f4f0e8"/></svg>
      <div>
        <h1>AI Radar</h1>
        <p class="lede">Wat kun je er nu mee. Geen ruis, geen meldingen buiten de app.</p>
      </div>
    </header>
    <main id="inhoud" tabindex="-1">${state.error ? `<div class="empty"><p>${esc(state.error)}</p><button class="retry" type="button" data-retry>Opnieuw proberen</button></div>` : panel()}</main>
  </div>
  <nav class="tabbar" aria-label="Onderdelen">${tabs}</nav>`;
  app.removeAttribute("aria-busy");
  if (activeId) {
    const next = document.getElementById(activeId);
    if (next) {
      next.focus();
      if (typeof selectionStart === "number" && next.setSelectionRange) next.setSelectionRange(selectionStart, selectionEnd);
    }
  }
  window.scrollTo(0, scrollY);
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
      loadJson("data/radar.json"),
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
  } catch {
    state.error = "De radar-gegevens konden niet geladen worden.";
  }
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const tab = target?.closest("[data-tab]");
  if (tab instanceof HTMLElement && tab.dataset.tab) {
    state.tab = tab.dataset.tab;
    history.replaceState(null, "", `#${state.tab}`);
    render();
    return;
  }
  if (target?.closest("[data-more]")) {
    state.bronnenMore += 20;
    render();
  }
  if (target?.closest("[data-retry]")) load();
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "ex-tool") state.examples.tool = target.value;
  if (target instanceof HTMLSelectElement && target.id === "ex-kind") state.examples.kind = target.value;
  if (target instanceof HTMLInputElement && target.id === "ex-new") state.examples.onlyNew = target.checked;
  if (target instanceof HTMLInputElement && target.id === "ontdek-q") state.ontdek.q = target.value;
  if (target instanceof HTMLSelectElement && target.id === "ontdek-cat") state.ontdek.category = target.value;
  if (target instanceof HTMLInputElement && target.id === "zoek") state.zoek = target.value;
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

const params = new URLSearchParams(location.search);
if (params.get("q")) state.zoek = params.get("q") ?? "";
const initial = location.hash.replace("#", "");
if (TABS.some(([id]) => id === initial)) state.tab = initial;
else if (params.get("q")) state.tab = "zoeken";

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
}

load();
