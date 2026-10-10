# shared/images

Filerne her udgives på flango.dk. Læg ikke noget her, der ikke må hentes af enhver.

## Hvad er hvad

| Fil | Rolle |
|---|---|
| `flango-skaermtid-wpf-login-uden-mellemtid-1672.webp` · `-836.webp` | Den aktuelle version på forsiden og `/om-skærmtid/`: samme loginfoto, men uden mellemtids-/tilgængelighedsboksen over kontonummeret (Theis 10/10). Redigeret med indbygget Image Gen ud fra det eksisterende foto; barn, rum og resten af loginvisningen er bevaret visuelt. Native master 1672 × 941 og fuld edit-prompt: `apps/koesystem/design/presentation/homepage-tools/skaermtid-wpf-login-uden-mellemtid-2026-10-10.*` i Flango-repoet. WebP q91, `srcset`, lazy-loading på forsiden og høj hentningsprioritet på produktsiden. Hele udsnittet bevares; personer/data er fiktive, skærmen er generativt gengivet. |
| `flango-skaermtid-wpf-login-1672.webp` · `-836.webp` | Tidligere WPF-loginfoto med mellemtidsvisning, erstattet på begge websitesider 10/10; varianterne er bevaret: et barn logger ind ved tastatur og mus i et gamercomputerrum. Genereret med indbygget Image Gen; UI-reference er klientens ægte, netværksfri UiLab-render `apps/pc-client-wpf/artifacts/ui/idle--cyberpunk.png` med mock-data. Barn, miljø og data er fiktive; skærmen er generativt gengivet, ikke pixelidentisk. Native master 1672 × 941 og fuld prompt: `apps/koesystem/design/presentation/homepage-tools/skaermtid-wpf-login-2026-10-10.*` i Flango-repoet. WebP q91, `srcset`; lazy-loading på forsiden, høj hentningsprioritet på produktsiden. Begge sider bevarer hele fotoets udsnit. |
| `flango-skaermtid-computerrum-1672.webp` · `-836.webp` | Første Skærmtid-foto af børn ved spillerummets oversigt, erstattet på forsiden af WPF-loginfotoet 10/10; varianterne er bevaret. Genereret med indbygget Image Gen, med appens mock-screenshot `apps/skaermtid/design-qa/room-map-v2-readability-pc-fixed-1980x1280.png` som UI-reference. Børn, miljø og fornavne er fiktive; skærmen er illustreret, ikke pixelidentisk. Native master 1672 × 941 og fuld prompt: `apps/koesystem/design/presentation/homepage-tools/skaermtid-computerrum-2026-10-10.*` i Flango-repoet. WebP q91. |
| `flango-ugeplan-garderobe-1448.webp` · `-724.webp` | Ugeplansboksen i forsidens «Værktøjerne». Genbruger det eksisterende foto fra Ugeplans infoskærmpræsentation. Fiktive børn og Solsikken-plan; genereret skærm. Ubeskåret master: `apps/ugeplan/next/tools/landing-imagegen/infoskaerm/garderobe-v3-boern-skillevaeg.png` i Flango-repoet. WebP q91, native 1448 × 1086, `srcset`, lazy-loading. Boksen viser et 16:9-udsnit via CSS; originalerne bevarer hele fotoet. |
| `flango-koesystem-vaerksted-1672.webp` · `-836.webp` | Børn ved værkstedsdøren med Flango Køsystem. Hovedillustration på `/om-køsystem/` og bred Køsystem-præsentation på forsiden. Hele udsnittet bevares; responsiv `srcset`, hero med høj hentningsprioritet og forside med lazy-loading. AI-genererede børn; skærmen er illustreret ud fra appen. PNG-master og prompt: `apps/koesystem/design/presentation/koesystem-vaerksted-2026-10-09-v2.*` i Flango-repoet. |
| `flango-koesystem-app-ipad-834.webp` | Faktisk app-skærmbillede, 834 × 1112, ved «Sådan virker det» på `/om-køsystem/`. Netværksfri app-forhåndsvisning med fiktive børn: `/dev/preview.html?rolle=doer&koe=2&frys`. Lazy-loaded; kan åbnes i fuld størrelse. JPG-kilde gemt i Flango-repoets `apps/koesystem/design/presentation/koesystem-app-ipad-2026-10-09.jpg`; WebP er tabsfrit kodet fra denne kilde. |
| `flango-cafe-sfo-v5-1672.webp` · `-836.webp` | Fotoet i Café-boksen på forsiden og “Alle vinder med Flango” på `/om-cafe/#fordele`; `/om-cafe/#cafe-hverdag` peger på samme afsnit. `srcset`, maks. 1092 CSS-px, lazy-loaded. Tabsfri WebP med neutral farvebalance og blond kundeavatar. AI-genererede børn og fiktiv Bøgelund SFO. PNG-master, tidligere versioner og prompt gemmes lokalt i `output/imagegen/flango-cafe-sfo/` i arbejdsrepoet. |
| `hero-mockup-master.webp` | **Master**, 7680 × 4320, tabsfri. Kilden til hero-varianterne. Intet linker til den — slet den ikke. |
| `hero-mockup-1180.webp` · `-2360.webp` | Vises på `/om-cafe/` via `srcset`. 1180 dækker 1× og telefoner op til 3×; 2360 dækker 2× på den fulde bredde (siden viser maks 1180 CSS-px). |
| `born-foraeldre-personale-master.webp` | **Master**, 1536 × 1024, tabsfri. Samme aftale. |
| `born-foraeldre-personale-600.webp` · `-900.webp` | Tidligere cirkelgrafik på `/om-cafe/`, erstattet af caféfotoet. Filerne er bevaret. |
| `og-flango-1200.webp` | Fælles socialt kort, 1200 × 630. Bruges som `og:image` af forsiden og alle om-siderne. |
| `flango-fruit.webp`, `flango-logo.png` | Mærket. Se `shared/logos/`. |

## Tre PNG'er slettet 20-09-2026

`hero-mockup.png` (6,7 MB) og `born-foraeldre-personale.png` (2,0 MB) er erstattet af
`*-master.webp` ovenfor — **pixel-identiske**, målt med `compare -metric AE` = 0 afvigende pixels.
Intet er tabt; de vejede bare tre gange for meget.

`hero-mockup-original.png` (7,3 MB) var Rotato-eksporten **med `rotato.app/free`-vandmærker** på
laptoppen og telefonen. Den lå offentligt tilgængelig på flango.dk. Den er ikke en original af
`hero-mockup.png` — den er den kasserede udgave, som den rene erstattede.

## Når du tilføjer et billede

Lav varianterne i de bredder, det faktisk vises i, og vælg med `srcset`. En 8K-fil, browseren
skalerer ned til 1180 px, koster brugeren alt og giver ingenting: `/om-cafe/` vejede 8,79 MB,
fordi hero'en blev hentet i fuld opløsning — og var `preload`et oven i købet.
Tabsfri WebP er typisk 3× mindre end PNG ved samme pixels.
