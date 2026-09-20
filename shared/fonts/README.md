# shared/fonts

Alle skrifter hostes her. Ingen side henter fra `fonts.googleapis.com`.

## Hvorfor

Den besøgendes IP blev sendt til Google ved hvert sidevisning. Ugeplan-appen havde allerede
skrevet begrundelsen ned i sin egen skal: *"bruger-IP skal ikke til Google"*. Under
IT-screeningen hos Hørsholm er det ikke en detalje. Oveni kostede det to ekstra forbindelser
og et render-blokerende stylesheet pr. side.

## Én CSS-fil pr. side — og hvorfor ikke én fælles

`index.css`, `om-flango.css`, `om-cafe.css`, `om-skaermtid.css`, `om-koesystem.css`,
`om-foraeldre.css`. Hver indeholder **præcis** de familier, siden bruger. Filnavnene er ASCII
(ADR-003: `ø` i en sti gemmes NFD på macOS og NFC på Linux).

En fælles fil med alle familier blev prøvet først, ud fra den udbredte antagelse at browseren
kun henter en skriftfil, når et tegn faktisk tegnes med den. **Det holder ikke.** Målt
20-09-2026: en testside, der erklærede alle ni familier og kun brugte én, hentede alle ni —
og forsiden gik fra 3 til 9 skriftfiler. Derfor må en side ikke erklære andet end sit eget.

## Filerne

De otte familier hentet fra Google er **variable**: én `.woff2` pr. udsnit dækker hele
vægtaksen, så flere `@font-face` peger med vilje på samme fil. `unicode-range` kommer fra
Google og sørger for, at `latin-ext` kun hentes, hvis tegnene faktisk bruges.

`plus-jakarta-sans-latin.woff2` og `instrument-serif*.woff2` lå her i forvejen, men var
**ikke** i git — `om-forældre` var altså afhængig af filer, der kun fandtes på Theis' disk og
i deploy-repoet. De er nu versionsstyret.

## Sådan tilføjer eller opdaterer du en familie

```sh
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
curl -sf -A "$UA" 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap'
```

Tag `@font-face`-blokkene for `latin` og `latin-ext`, hent deres `woff2` fra
`fonts.gstatic.com`, læg filerne her, og ret `src` til `/shared/fonts/<navn>.woff2`.
Læg blokkene i CSS-filen for **de sider, der bruger familien** — ikke i dem alle.

## Dækning

Omlagt: forsiden, `om-flango`, `om-cafe`, `om-skaermtid`, `om-koesystem`, `om-foraeldre`,
`pris`, `kontakt`, `privatlivspolitik`, `download`, `sikkerhed`, `event`. Ingen af dem rører
`fonts.googleapis.com`.

Tilbage: `forældre/` (portalens byggede output — udelukket fra website-deployet; rettes i
`apps/portal/`, ellers overskrives det ved næste portal-deploy) og `om-ugeplan/index.html`
i arbejdstræet (død rest fra maj, udelukket og udgives ikke).
