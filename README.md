# AI Radar

Persoonlijk, mobiel overzicht van praktische ontwikkelingen in AI-coding en vibe coding. Weinig ruis: je ziet standaard alleen wat relevant is, met een directe link naar de bron. De site verzint geen samenvattingen. Een item toont de titel, de datum en een fragment uit de bron zelf.

Alles blijft in dit dashboard. Geen e-mail, geen push, geen externe meldingen.

## Eenmalige stap: GitHub Pages aanzetten

De site wordt door GitHub Actions gepubliceerd. Dat werkt pas nadat je Pages één keer op Actions zet:

1. Open deze repository op GitHub.
2. Ga naar **Settings → Pages**.
3. Bij **Build and deployment** kies je **Source: GitHub Actions**.
4. Bewaar. Daarna publiceert de workflow bij elke push naar `main`, en ook na elke geslaagde ingest.

Zonder die keuze faalt de deploy. De foutmelding staat dan bij de workflow; de data in de repository wordt wel bijgewerkt.

Deze README kan niet controleren of de live site al bereikbaar is. Kijk na het aanzetten van Pages bij de groene run van **Site publiceren** voor de URL.

## Hoe het bijwerken werkt

Een geplande workflow (`.github/workflows/ingest.yml`) draait elke drie uur:

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

- **Vandaag** — ongeveer vijf minuten: grote ontwikkelingen, de laatste stand van Grok Build en Grok Bot, en wat er in 24 uur boven de drempel uitkomt.
- **Week** — de afgelopen zeven dagen per tool, met aantallen en de sterkste items. Lege weken bij Grok tonen de laatste echte release, met datum.
- **Kennisbank** — zoeken en filteren op tool, categorie, score en datum. Patches en community staan standaard uit.
- **Bronnen** — elke bron, het moment van de laatste geslaagde ophaling, en of die gezond is.

Standaard: score 4 of hoger. Beveiliging, prijswijzigingen en breaking changes blijven altijd zichtbaar.

## Data

| Bestand | Inhoud |
| --- | --- |
| `data/items.json` | Items die de site toont |
| `data/sources.json` | Bronnen en hun gezondheid |
| `data/tools.json` | Toolnamen voor de interface |
| `data/state.json` | Sitemap-URL’s, paginahashes en al opgehaalde nieuws-URL’s |

`data/state.json` gaat niet mee naar de website. De site is statisch: `web/` plus die drie JSON-bestanden, gebouwd naar `dist/`.

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
