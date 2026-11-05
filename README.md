# AI Radar

Persoonlijk, mobiel overzicht van wat je nú kunt doen met nieuwe AI-coding-mogelijkheden. Geen saaie changelog: per update een korte Nederlandse samenvatting, concrete “dit kun je ermee”-punten, en de X-posts die het laten zien. Daarnaast nieuwe vibe-coding-startups en accounts die je nog niet volgt.

Alles blijft in dit dashboard. Geen e-mail, geen push, geen meldingen buiten de app. Geen betaalde API.

## Eenmalige stap: GitHub Pages aanzetten

De site wordt door GitHub Actions gepubliceerd. Dat werkt pas nadat je Pages één keer op Actions zet:

1. Open deze repository op GitHub.
2. Ga naar **Settings → Pages**.
3. Bij **Build and deployment** kies je **Source: GitHub Actions**.
4. Bewaar. Daarna publiceert de workflow bij elke push naar `main`, en ook na elke geslaagde ingest.

Zonder die keuze faalt de deploy. De foutmelding staat dan bij de workflow; de data in de repository wordt wel bijgewerkt.

Deze README kan niet controleren of de live site al bereikbaar is. Kijk na het aanzetten van Pages bij de groene run van **Site publiceren** voor de URL.

## Hoe het bijwerken werkt

De hoofdinhoud (Vandaag, Voorbeelden, Startups, Ontdek) komt uit `data/radar.json` en `data/accounts.json`. Die werk je bij met `radar-update.json`, zie hieronder. Elke wijziging in `data/` publiceert de site opnieuw.

Daarnaast draait een geplande workflow (`.github/workflows/ingest.yml`) elke drie uur voor het secundaire tabblad Bronnen:

- hij haalt de bronnen op, met time-out en retries;
- een bron die faalt stopt de rest niet;
- nieuwe items komen in `data/` als JSON;
- de workflow commit die wijziging en publiceert de site opnieuw.

Dat kost niets. Er is geen betaalde API en geen LLM-sleutel. Classificatie, relevantie (1–5) en de Nederlandse regel “wat kun je hier nu mee” komen uit vaste regels in `scripts/lib/classify.ts` en `scripts/lib/action.ts`. Die regel verschijnt alleen als de brontekst haar dekt, anders ontbreekt ze.

x.ai blokkeert soms datacenter-IP’s (Cloudflare). Lukt een directe fetch niet, dan probeert de ingest dezelfde URL via de gratis leesproxy `r.jina.ai`, zonder sleutel. Lukt dat ook niet, dan blijft de oude data staan en staat de bron op **storing** in het tabblad Bronnen. Er wordt geen voorbeelddata verzonnen.

Nieuwsartikelen van x.ai hebben geen feed. Elke run leest een beperkte reeks nieuwe pagina’s (meer als de site direct bereikbaar is, anders via de leesproxy). Oudere stukken volgen vanzelf; Bronnen vermeldt hoeveel er nog openstaan.

### Planning die niet vanzelf uitgaat

GitHub zet geplande workflows in een publieke repository uit na 60 dagen zonder activiteit. Een commit telt als activiteit. De ingest commit de data (ook de tijdstempels van een geslaagde of mislukte run), en dat houdt de planning wakker zolang de workflow blijft draaien.

Blijft een run om een andere reden 30 dagen zonder commit, dan schrijft dezelfde workflow `data/heartbeat.json`. Dat is een vangnet, geen vervanging: een workflow die GitHub al heeft uitgezet, start ook die heartbeat niet meer. Zet hem dan met de hand weer aan via het tabblad Actions.

## Schermen

Onderaan het scherm:

- **Vandaag** — laatste 7 dagen. Bovenaan een 5-minuten-samenvatting (top 3), daaronder kaarten met “Dit kun je ermee” en de gekoppelde posts.
- **Voorbeelden** — X-posts. Filter op tool en soort. “Alleen van accounts die ik nog niet volg” staat standaard aan.
- **Startups** — naam, één zin, waarom het nieuw is, link naar het account en de bewijs-post.
- **Ontdek** — accounts die je nog niet volgt, per categorie, met notitie en volgers. Onderaan een kleinere lijst “Je volgt al”.
- **Zoeken** — één veld over updates, voorbeelden, startups, accounts en de automatische releases.
- **Bronnen** — secundair. De automatische RSS/sitemap/HN-feed (changelogs). Standaard alleen score 4 of hoger, plus beveiliging, prijs en breaking changes.

Items met `"seed": true` zijn de startset uit het rapport van 5 nov 2026. Latere items zonder dat veld komen uit `radar-update.json`.

## Data

| Bestand | Inhoud |
| --- | --- |
| `data/radar.json` | `updates`, `examples`, `startups` |
| `data/accounts.json` | 129 X-accounts; `already_followed` zegt of je het account al volgt |
| `data/items.json` | Automatische release-items (tab Bronnen) |
| `data/sources.json` | Gezondheid van die feeds |
| `data/tools.json` | Toolnamen voor de release-feed |
| `data/state.json` | Sitemap-URL’s en paginahashes; gaat niet mee naar de site |

## Dagelijkse radar-update

Een externe routine levert `radar-update.json` in de root, met dezelfde vorm:

```json
{
  "updates": [],
  "examples": [],
  "startups": [],
  "accounts": []
}
```

`accounts` mag weg. Elk onderdeel mag een lege lijst zijn.

```bash
npm run radar:apply
npm run radar:apply -- pad/naar/radar-update.json
```

Het script valideert en stopt met een foutmelding als iets niet klopt. Het schrijft dan niets weg. Geldige items worden samengevoegd op id of URL. Er blijven maximaal 400 updates en 1500 voorbeelden; de oudste vallen weg.

Regels, kort:

- Datums zijn ISO. Belang is een geheel getal van 1 tot 5.
- `summary_nl` is maximaal twee zinnen. `note_nl` is één zin. `can_do_nl` heeft 2 tot 5 punten.
- Elke URL is `https`. Een voorbeeldpost is precies `https://x.com/<handle>/status/<id>`, en die handle is `author_handle`.
- `example_ids` moeten bestaan, in dit bestand of al in `data/radar.json`.
- `kind` is `demo`, `workflow`, `release` of `tutorial`.
- Accountcategorie is `official_product`, `builder_demo`, `engineer_explainer`, `founder_investor`, `xai_grok` of `dutch_eu`.

Staat `radar-update.json` op `main`, dan draait `.github/workflows/radar-apply.yml`: valideren, mergen, committen en de site publiceren. Elke andere push die `data/` wijzigt, publiceert ook via **Site publiceren**.

Verzin geen feiten in die JSON. Alleen wat een bron echt laat zien.

## Een bron toevoegen

1. Voeg een object toe aan `SOURCES` in `scripts/sources.ts`. Kies `kind`: `feed`, `github-releases`, `sitemap-news`, `release-notes`, `hn` of `releasebot`.
2. Gebruik je een nieuwe tool, voeg die dan toe aan `TOOLS` in `scripts/lib/tools.ts`. Prioriteit is `primair`, `secundair` of `community`.
3. Een brede feed (bedrijfsnieuws, een blog) zet je op `broad: true` met een `relevance`-regex en `maxAgeDays`, anders komt alle ruis mee.
4. Draai `npm test`. Parser, dedupe en score hebben fixtures in `scripts/fixtures/`.
5. Draai `npm run ingest` en controleer het tabblad Bronnen.

De volgende geplande run pakt de nieuwe bron mee zodra dit op `main` staat.

## Lokaal

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run ingest
npm run build
python3 -m http.server 4173 --directory dist
```

Open daarna `http://127.0.0.1:4173`. De interface is Nederlands (`nl-NL`). Titels en technische termen blijven Engels als de bron Engels is.

## Relevantie, in het kort

- Grok Build en Grok Bot starten op 4, andere officiële bronnen op 3, community op 2.
- Beveiliging, prijs en breaking change: +2, minimaal 5, altijd zichtbaar.
- Een nieuwe functie of een model in de titel: +1.
- Een patchrelease waarvan de titel bijna alleen een versienummer is: −1, en gebundeld per dag. Prereleases, nightlies en previews vallen weg als de titel of de GitHub-release dat aangeeft.
- Community blijft maximaal 4, behalve bij beveiliging, prijs of breaking change.
- Hacker News komt alleen mee vanaf 80 punten én een AI-coding-trefwoord in de titel. Reddit, LMArena en smol.ai AINews zitten er niet in.

De redenen staan per item achter “Waarom deze score”.

## Wat deze versie niet doet

Geen betaalde API, geen model dat tekst verzint, geen account, geen notificaties buiten het dashboard. Een latere versie kan `classify` en `actionLine` vervangen door een lokaal of gratis model; de vorm van een item hoeft daarvoor niet te veranderen.
