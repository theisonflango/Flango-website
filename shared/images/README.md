# shared/images

Filerne her udgives på flango.dk. Læg ikke noget her, der ikke må hentes af enhver.

## Hvad er hvad

| Fil | Rolle |
|---|---|
| `flango-cafe-sfo-v5-1672.webp` · `-836.webp` | Fotoet i “Alle vinder med Flango” på `/om-cafe/#fordele`; `/om-cafe/#cafe-hverdag` peger på samme afsnit. `srcset`, maks. 1092 CSS-px, lazy-loaded. Tabsfri WebP med neutral farvebalance og blond kundeavatar. AI-genererede børn og fiktiv Bøgelund SFO. PNG-master, tidligere versioner og prompt gemmes lokalt i `output/imagegen/flango-cafe-sfo/` i arbejdsrepoet. |
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
