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

Alle 15 udgivne sider på websitet henter deres skrifter herfra. Ingen af dem rører
`fonts.googleapis.com`.

De øvrige flader hoster også selv, men med deres **egne** generatorer — rør dem ikke herfra:

| Flade | Hvor | Genereret af |
|---|---|---|
| Café | `apps/cafe/css/fonts.css` | `scripts/fetch-google-fonts.mjs cafe` |
| Skærmtid | `apps/skaermtid/src/fonts.css` | `… skaermtid` |
| Forældreportal | `apps/portal/css/fonts.css` + `planview-fonts.css` | `… portal` |
| Ugeplan | fontsource, bundlet | `apps/ugeplan/next/tools/byg-fonts.mjs` |

Portalen har oveni `font-src 'self'` i sin CSP og sætter
`data-planview-fonts="self-hosted"`, så PlanView-rendereren ikke lægger et Google-link oveni.
Målt i prod 20-09-2026: nul kald til Google fra `/forældre/`.

## Hvorfor websitets filer ikke er genereret af scriptet

`scripts/fetch-google-fonts.mjs` skriver **én CSS pr. flade**. Det passer til café, skærmtid og
portalen, som hver er én app med ét sæt skrifter. Websitet er 15 sider med forskellige familier,
og en side må kun erklære sine egne — se afsnittet ovenfor om hvorfor. Skal filerne her
regenereres, skal scriptet først kunne skrive flere CSS-filer pr. flade (fx et `pages`-felt i
`TARGETS`). Indtil da vedligeholdes de i hånden efter opskriften ovenfor.

## Fælde: forældede kopier i work-repoet

`flango-website/forældre/` (12 filer, 13-06-2026) og `flango-website/ugeplan/` (40 filer) er
**forældede kopier** af de to apps' udgivne output. Begge er udelukket fra website-deployet og
udgives ikke — deres rigtige kilde er `apps/portal/` og `apps/ugeplan/next/`.

De er en fælde: et `grep` efter `fonts.googleapis` i work-repoet finder dem og får det til at se
ud, som om portalen stadig henter hos Google. Det gør den ikke. **Aflæs altid prod med `curl`
eller en browser, ikke work-repoets kopi** (CLAUDE.md § 4).
