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

Onderaan het scherm, vijf knoppen:

- **Vandaag** — één feed voor de laatste 7 dagen. Bovenaan “Top 3 van vandaag” (tool, titel, één regel waarom of samenvatting, belang), daarna de rij “Gemaakt met AI”, daarna de kaarten. Elke update staat in dezelfde volgorde: titel, statuschip (Officieel, Getoond of Gerucht; zonder status geen label) plus tool en datum, “Wat is er nieuw”, “Waarom het ertoe doet” als dat veld er is, “Dit kun je nu doen” (meer dan drie punten achter Meer), “Zo ziet het eruit” en “Bronnen”. Startups en een paar accounts die je nog niet volgt staan ertussen. Gelezen en bewaren blijven in deze browser (`localStorage`), zonder account.
- **Voorbeelden** — dezelfde postkaarten. Filter met chips op tool en soort. “Nog niet gevolgd” staat standaard aan; dat is een filter, geen badge op elke post.
- **Startups** — logo of initiaal, naam, één zin, één regel “waarom nieuw”, de website als die bekend is, en de bewijs-post.
- **Ontdek** — accounts per categorie, met avatar of initialen, een korte notitie en een knop om op X te volgen.
- **Meer** — Zoeken, Bronnen en Bewaard.

Zoeken toont suggesties (tools en woorden uit de data) en recente zoekopdrachten in deze browser. Bronnen blijft secundair: opgeschoonde changelogs, ingekort met “Meer lezen”. Bewaard is wat je in deze browser bewaart.

Items met `"seed": true` zijn de startset uit het rapport van 5 nov 2026. Latere items zonder dat veld komen uit `radar-update.json`.

## Data

| Bestand | Inhoud |
| --- | --- |
| `data/radar.json` | `updates`, `examples`, `startups`, optioneel `creations` |
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
  "creations": [],
  "accounts": [],
  "daily_top": { "date": "2026-11-05", "ids": ["upd-voorbeeld"], "headline_nl": "Optioneel, maximaal 90 tekens" }
}
```

`accounts`, `creations` en `daily_top` mogen weg. Elk onderdeel mag een lege lijst zijn. `daily_top` is een object, geen lijst.

```bash
npm run radar:apply
npm run radar:apply -- pad/naar/radar-update.json
```

Het script valideert en stopt met een foutmelding als iets niet klopt. Het schrijft dan niets weg. Geldige items worden samengevoegd op id of URL. Er blijven maximaal 400 updates, 1500 voorbeelden en 600 creaties; de oudste vallen weg. Ontbreekt `creations` in het bestand, dan blijven de bestaande creaties staan.

Regels, kort:

- Datums zijn ISO. Belang is een geheel getal van 1 tot 5. In de top 3 staat dat getal naast vijf stippen. Bij Bronnen krijgt score 5 nog het label “Groot nieuws”.
- `summary_nl` is maximaal twee zinnen. `note_nl` is één zin. `can_do_nl` heeft 1 tot 5 punten.
- Schrijf `can_do_nl` als concrete acties en herhaal de titel niet. De feed toont de eerste drie punten en zet de rest achter Meer.
- `why_nl` is optioneel, Nederlands, maximaal 220 tekens: waarom dit ertoe doet.
- `status` is optioneel: `officieel` (bevestigd op het eigen kanaal van het bedrijf), `getoond` (een builder of gebruiker liet het werken) of `gerucht` (onbevestigd). Zonder veld toont de feed geen statuslabel.
- `sources` is optioneel, hooguit 6 objecten: `label` (maximaal 40 tekens), `url` (`https`) en `kind` (`officieel`, `x_post`, `video` of `artikel`). `source_urls` blijft verplicht. Zonder `sources` maakt de feed bron-chips uit `source_urls`.
- `daily_top` is optioneel, op het hoofdniveau. `date` is `YYYY-MM-DD`. `ids` bevat 1 tot 3 update-ids die bestaan (in dit bestand of al in `data/radar.json`). `headline_nl` mag ontbreken en is maximaal 90 tekens. Staat `daily_top` in de update, dan vervangt die de vorige. Ontbreekt het veld, dan blijft de bestaande top staan. De feed gebruikt hem als de datum vandaag is of hooguit 2 dagen ouder. Is hij er niet, of is de datum ouder, dan kiest de site zelf de top 3: hoogste belang, daarna de nieuwste, uit updates van de laatste 3 dagen. Zijn die er niet, dan komt er geen blok. Minder dan drie kaarten is genoeg.
- Elke URL is `https`. Een voorbeeldpost is precies `https://x.com/<handle>/status/<id>`, en die handle is `author_handle`.
- `example_ids` moeten bestaan, in dit bestand of al in `data/radar.json`. In de feed staan de eerste twee gekoppelde posts direct onder de update.
- `kind` is `demo`, `workflow`, `release` of `tutorial`.
- Accountcategorie is `official_product`, `builder_demo`, `engineer_explainer`, `founder_investor`, `xai_grok` of `dutch_eu`.
- Een voorbeeld met hetzelfde id of dezelfde `post_url` vervangt het vorige volledig. Stuur bij een aanvulling het hele object opnieuw, anders vallen optionele velden die je weglaat weg.

### Optionele velden

Alles hieronder mag ontbreken. Oude updates blijven geldig, en de site valt terug op een initiaal, op `note_nl` als posttekst, en op geen beeld.

Voorbeelden, zodat de feed een echte postkaart kan tekenen (avatar, naam, tekst, beeld) zonder embed-script en zonder API-sleutel:

| Veld | Vorm |
| --- | --- |
| `author_name` | Weergavenaam, tekst |
| `author_avatar_url` | `https`-URL van de avatar |
| `text` | Platte tekst van de post, maximaal 500 tekens, geen HTML. Meerdere zinnen mag. Dit is niet `note_nl`. |
| `media` | Lijst van hooguit 4 objecten. `type` is `photo`, `video` of `gif`. Minstens één van `url` en `preview_url` is een `https`-URL. Een foto mag alleen `url` hebben. Een video mag alleen `preview_url` hebben: dat is het stilstaande beeld in het raster. `alt` is optionele tekst, maximaal 180 tekens. `video_url` is een optionele `https`-mp4; alleen dan speelt de viewer de video inline (gedempt, met bediening). `width` en `height` zijn optioneel de originele afmetingen in pixels, `duration_ms` de lengte in milliseconden. |
| `metrics` | Object met `likes`, `reposts`, `replies` en/of `views`: gehele getallen van 0 of hoger. Elk getal mag ontbreken. |
| `lang` | Korte taalcode, bijvoorbeeld `nl` of `en`. |

`note_nl` blijft de Nederlandse takeaway. Die verschijnt op de kaart als “Wat is hier gaaf aan”, onder de post. Zonder `text` gebruikt de kaart `note_nl` als posttekst en laat die regel weg, zodat de zin niet twee keer staat.

Startups:

| Veld | Vorm |
| --- | --- |
| `website_url` | `https` van de eigen site. Los van `url`, dat het X-account blijft. |
| `logo_url` | `https` van een logo. Zonder logo toont de kaart een initiaal. |

Accounts (`data/accounts.json`, veld `name` bestaat al):

| Veld | Vorm |
| --- | --- |
| `avatar_url` | `https` van de avatar. Zonder avatar toont Ontdek initialen. |

Voorbeeld van een post met de nieuwe velden:

```json
{
  "id": "ex-voorbeeld",
  "date": "2026-11-05T08:00:00.000Z",
  "author_handle": "voorbeeld",
  "author_name": "Voorbeeld",
  "author_avatar_url": "https://pbs.twimg.com/profile_images/voorbeeld.jpg",
  "post_url": "https://x.com/voorbeeld/status/1",
  "text": "Platte tekst van de post, zoals die op X staat.",
  "note_nl": "Dit is de Nederlandse takeaway in één zin.",
  "tool": "Grok Bot",
  "kind": "demo",
  "from_followed": false,
  "lang": "nl",
  "metrics": { "likes": 12, "reposts": 1, "replies": 0, "views": 340 },
  "media": [
    {
      "type": "photo",
      "url": "https://pbs.twimg.com/media/voorbeeld.jpg",
      "preview_url": "https://pbs.twimg.com/media/voorbeeld.jpg",
      "alt": "Korte beschrijving van het beeld"
    }
  ]
}
```

Avatars en media mogen hotlinken (bijvoorbeeld `pbs.twimg.com`). De site laadt ze lui, in een vast kader, met `referrerpolicy="no-referrer"`, en valt terug op een initiaal of een leeg kader als het beeld faalt. Geen betaalde API, geen X-widget. Een sitebrede `no-referrer` zorgt dat een mp4 van `video.twimg.com` niet wordt geweigerd omdat de browser een andere herkomst meestuurt.

### Creaties (`creations`)

Concrete resultaten die iemand met AI maakte: een app, een film, een agent, een robot. Ongeveer vijf per dag. De feed toont ze visueel, bovenaan als rij en als kaart. Een YouTube-filmpje opent in de viewer via `youtube-nocookie.com`, pas na een tik op afspelen.

| Veld | Vorm |
| --- | --- |
| `id`, `date` | `id` mag letters, cijfers, streepjes en underscores, ook een YouTube-id erin. `date` is ISO |
| `platform` | `x` of `youtube` |
| `url` | Bij `x`: precies `https://x.com/<handle>/status/<id>`, en die handle is `author_handle`. Bij `youtube`: precies `https://www.youtube.com/watch?v=<id>` |
| `author_handle`, `author_name`, `author_avatar_url` | Naam en https-avatar. Een YouTube-handle is 1–30 tekens |
| `title_nl` | Korte titel |
| `what_nl` | Eén tot drie Nederlandse zinnen: wat er gemaakt is en waarmee |
| `tools` | 1 tot 6 namen, bijvoorbeeld `Claude Code` |
| `category` | `apps_games_websites`, `design_3d`, `film_video`, `agents_automation` of `hardware_robots` |
| `update_id` | Optioneel. Moet een bestaand update-id zijn. De feed zet het resultaat dan ook onder die update als “Hiermee gemaakt” |
| `text` | Optioneel, de oorspronkelijke tekst, maximaal 800 tekens. Een prompt mag hoekige haken bevatten; de site toont ze als tekst |
| `media` | Zelfde vorm als bij een voorbeeld, inclusief optionele `video_url` |
| `youtube_id` | Verplicht bij YouTube, dezelfde 11 tekens als in de URL |
| `duration_s` | Seconden, geheel getal van 0 of hoger. Verplicht bij YouTube |
| `metrics`, `lang` | Optioneel, zelfde vorm als bij een voorbeeld |
| `lloyd_pick` | Optioneel, `true` of `false`. `true` is een favoriet van de eigenaar; de feed zet er “Jouw favoriet” bij |
| `channel_id` | Optioneel, alleen bij YouTube. Vorm `UC` plus 22 tekens |
| `title_original` | Optioneel, alleen bij YouTube. De titel op YouTube, maximaal 140 tekens |

Clickbait en geldclaims horen niet in dit bestand; die filtert de routine vóór het schrijven. Verzin ook hier geen feiten.

Staat `radar-update.json` op `main`, dan draait `.github/workflows/radar-apply.yml`: valideren, mergen, committen en de site publiceren. Elke andere push die `data/` wijzigt, publiceert ook via **Site publiceren**.

Verzin geen feiten in die JSON. Alleen wat een bron echt laat zien. Voor de vormgeving ligt er losse voorbeelddata in `web/dev/fixtures/radar.fixture.json`. Die hoort niet in `data/` en gaat niet mee naar de live site. Lokaal open je de site met `?fixture=1`. `?fixture=1&quiet=1` zet de klok op de stille voorbeeld-dag (één update), zodat de top één kaart toont.

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

`npm run build` kopieert `web/` naar `dist/` zonder `web/dev/`. De voorbeeldposts (`?fixture=1`) zijn er daardoor alleen als je `web/` zelf serveert en `data/` op `/data` beschikbaar is, niet op de gepubliceerde site.

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
