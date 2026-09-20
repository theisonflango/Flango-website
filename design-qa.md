# Flango Cafésystem — typografi, 20-09-2026

final result: passed

## Kilder og omfang

Kun cafésidens produktoverskrift; første viste forslag, »Samlet signatur«.

- Kilde: `/Users/theison/.codex/generated_images/01a0bf7b-f060-7cb1-90df-9c8194660c06/exec-82afbcbb-132b-4a46-acda-26edc0093456.png`.
- Implementering: `http://127.0.0.1:8765/om-cafe/`, øverst, menu lukket.
- Screenshots: `/Users/theison/.codex/visualizations/2026/09/20/01a0bf7b-f060-7cb1-90df-9c8194660c06/cafe-title-desktop.png`, `cafe-title-mobile-375.png` og `cafe-title-mobile-320.png` i samme mappe.
- CSS-viewports og screenshotstørrelser: 1440 × 1000, 375 × 812 og 320 × 750.
- Kilden er et 1942 × 809 præsentationsark. Den og det færdige desktopscreenshot blev
  åbnet sammen i samme billedinput. Sammenligningen gælder signaturens proportioner,
  ikke hele sidens lærred; ingen pixel-diff eller ændring af skærmbilledernes tæthed.
  Overskriften er tydelig nok i desktopbilledet til direkte vurdering af logo og bogstaver.

## De fem visuelle flader

- **Typografi:** indlæst lokal Plus Jakarta Sans 600, 64 px på desktop, 25,5 px ved
  375 og 24 px ved 320. Skitsens genererede tekst er kraftigere end den faktiske font;
  forventet forskel mellem stilskitsen og den annoncerede rigtige font.
- **Layout:** centreret logo og navn på én linje. Desktop: logo 288 px, mellemrum
  16,63 px, navn 351,52 px. Ved 320 ligger hele signaturen mellem x=36,97 og 283,02.
- **Farver:** original orange og #252B33. Sidens eksisterende lyse baggrund bevares;
  præsentationsarkets hvide baggrund var ikke et valg om at redesigne siden.
- **Billeder:** PNG er byte-identisk med brugerens original; tomme margener skjules
  med CSS uden at ændre eller strække billedet. Copyrighttegn bevaret. Original
  vektorgrafik kunne forbedre skarpheden ved stor forstørrelse (P3).
- **Indhold:** én h1 med tilgængeligt navn »Flango Cafésystem«. Logoets alt-tekst
  leverer »Flango«; produktnavnet er almindelig tekst med korrekt é.

## Kontrolhistorik og resultat

Første kontrol fandt, at WebP-logoet er en ældre variant uden copyrighttegn.
Rettet til brugerens originale PNG. Nyt desktopbillede sammenholdt med kilden og
nyt billede ved 320 px viser det korrekte logo og ingen beskæring eller ombrydning.
Ingen resterende P0/P1/P2-fund i den ændrede overskrift.

Mobilmenu åbnet/lukket, aria-expanded true → false. Ingen konsol-warnings eller
errors. Font og logo indlæst. `git diff --check` indgår i afsluttende kildekontrol.
Ingen nye automatiserede tests for denne afgrænsede CSS-/markupændring.

Ændringen er lokal, ikke pushet eller udgivet; den gamle titel blev aflæst i prod.
Øvrige om-sider og produktfunktioner er uden for dette trin.
