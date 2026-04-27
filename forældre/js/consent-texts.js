/**
 * Flango Forældreportal — Samtykketekster
 *
 * Sektion 4 (runde 2, 2026-04-27): Hardcodede samtykketekster der vises i
 * forældreportalen ved AI-avatar-toggle. Lag 1 = kort tekst direkte ved
 * toggle. Lag 2 = fuld informeret samtykke i modal når forælder klikker
 * "Læs mere om databehandlingen".
 *
 * Versionsstrenge gemmes i parent_consents.consent_version sammen med hvert
 * samtykke, så vi senere kan dokumentere hvilken tekstversion forælderen
 * har set.
 *
 * Bumpe-regel: hvis Lag 1 ELLER Lag 2 ændres meningsfuldt, bump versionen
 * (fx v1.0 → v1.1) og lad eksisterende samtykker stå med deres oprindelige
 * version.
 *
 * Eksponeres som window.PortalConsentTexts.
 */
(function () {
  'use strict';

  const VERSION_PARENT_AI_AVATAR = 'v1.0-ai-avatar-parent-2026-04-27';

  // ─────────────────────────────────────────────────────────────────────────
  // Forælder — AI-avatar (OpenAI)
  // ─────────────────────────────────────────────────────────────────────────

  const PARENT_AI_AVATAR_LAYER1 = `Hvis du aktiverer dette samtykke, må institutionen oprette en stiliseret tegneserie-avatar af dit barn. Avataren bruges som profilbillede i café-systemet og hjælper personalet med at genkende dit barn ved køb.

For at lave avataren sender vi et reference-foto af dit barn til OpenAI's billed-AI. AI'en returnerer en stiliseret version, som vi gemmer som dit barns profilbillede. OpenAI gemmer reference-fotoet i op til 30 dage og bruger det ikke til at træne deres AI-modeller.

Du kan trække dit samtykke tilbage når som helst — så slettes avataren straks fra Flango.`;

  // Lag 2: HTML-format så vi kan rendere overskrifter, lister osv. i modalen.
  const PARENT_AI_AVATAR_LAYER2_HTML = `
    <h3 style="margin-top:0">Sådan fungerer AI-avatar — i detaljer</h3>

    <h4>Hvilke data sender vi?</h4>
    <p>Når institutionen opretter en AI-avatar af dit barn, sendes følgende til OpenAI's billed-genererings-API:</p>
    <ul>
      <li>Et reference-foto af dit barn. Det kan være: et foto institutionen tager specifikt til formålet med deres iPad/kamera, eller et eksisterende profilbillede dit barn allerede har i Flango (fx et foto importeret fra Aula eller uploadet af institutionen).</li>
      <li>En tekst-prompt der beder AI'en om at lave en stiliseret tegneserie-version af personen på fotoet. Prompten indeholder ikke dit barns navn eller andre identifikatorer — kun en kreativ instruktion.</li>
    </ul>

    <h4>Hvor sendes det hen?</h4>
    <p>Vores aftale er med OpenAI Ireland Ltd. (et irsk selskab, EU). OpenAI's tekniske infrastruktur er dog primært placeret i USA, og dataene behandles derfor delvist på amerikanske servere.</p>
    <p>Overførslen til USA er beskyttet af EU's standardkontraktbestemmelser (SCC) og EU-US Data Privacy Framework (DPF).</p>

    <h4>Hvad bruger OpenAI dataene til?</h4>
    <p>OpenAI's databehandleraftale med Flango fastsætter at:</p>
    <ul>
      <li>Dine data bruges <strong>IKKE</strong> til at træne OpenAI's AI-modeller. Dette er kontraktligt garanteret.</li>
      <li>Reference-fotoet og den genererede avatar opbevares i op til 30 dage hos OpenAI som led i deres "abuse monitoring".</li>
      <li>Efter 30 dage slettes data automatisk fra OpenAI's systemer.</li>
      <li>OpenAI kan i ekstreme tilfælde af mistanke om misbrug lade en sikkerhedsmedarbejder gennemse data.</li>
    </ul>

    <h4>Hvad sker der med fotoet i Flango?</h4>
    <ul>
      <li>Hvis fotoet er taget specifikt til AI-avataren (kamera eller upload), persisteres det aldrig på Flangos servere — det streames direkte gennem Flangos backend til AI-tjenesten.</li>
      <li>Hvis et eksisterende profilbillede bruges som reference, bevares det eksisterende foto.</li>
    </ul>
    <p>Den genererede avatar gemmes som dit barns profilbillede i Flangos database (Supabase, AWS Irland — EU).</p>

    <h4>Hvad hvis du fortryder?</h4>
    <p>Hvis du trækker dit samtykke tilbage:</p>
    <ul>
      <li>Avataren slettes øjeblikkeligt fra Flango.</li>
      <li>Hos OpenAI slettes data automatisk inden for 30 dage.</li>
      <li>Dit barn vises i stedet uden profilbillede, eller med et almindeligt foto hvis du har samtykket til det separat.</li>
    </ul>
  `;

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  window.PortalConsentTexts = {
    /** Aktuel version-streng for forælder-AI-avatar-samtykket. */
    PARENT_AI_AVATAR_VERSION: VERSION_PARENT_AI_AVATAR,

    /** Lag 1 — kort tekst (plain text). */
    parentAiAvatarLayer1: PARENT_AI_AVATAR_LAYER1,

    /** Lag 2 — fuld informeret samtykke (HTML). */
    parentAiAvatarLayer2Html: PARENT_AI_AVATAR_LAYER2_HTML,

    /** Korte tekster for de øvrige billede-typer der bruges i confirmation-popups. */
    confirmTexts: {
      ai_off: {
        title: 'Trække AI-avatar-samtykke tilbage?',
        body: `Hvis du fortryder dit samtykke:
- Dit barns AI-avatar slettes med det samme fra Flango
- Hvis avataren er det aktuelle profilbillede, fjernes det
- Personalet kan ikke længere oprette nye AI-avatarer af dit barn

Hos OpenAI slettes data automatisk inden for 30 dage som beskrevet i privatlivspolitikken.`,
        confirm: 'Trække samtykke tilbage',
        cancel: 'Annullér',
      },
      aula_off: {
        title: 'Trække samtykke tilbage?',
        body: `Eksisterende Aula-fotos af dit barn slettes fra Flango. Personalet kan ikke længere hente nye fotos fra Aula.

Andre billed-typer du har samtykket til, påvirkes ikke.`,
        confirm: 'Trække samtykke tilbage',
        cancel: 'Annullér',
      },
      camera_off: {
        title: 'Trække samtykke tilbage?',
        body: `Eksisterende kamera-fotos af dit barn slettes fra Flango. Personalet kan ikke længere tage nye fotos.

Andre billed-typer du har samtykket til, påvirkes ikke.`,
        confirm: 'Trække samtykke tilbage',
        cancel: 'Annullér',
      },
      master_off: {
        title: 'Slå alle profilbilleder fra?',
        body: `Hvis du slår dette fra:
- Alle eksisterende profilbilleder af dit barn slettes fra Flango (Aula-fotos, kamera-fotos, AI-avatarer)
- Personalet kan ikke længere oprette nye profilbilleder af dit barn
- Dit barn vises i caféen kun ved navn og nummer

Du kan altid slå det til igen senere — men eksisterende billeder er slettet og kan ikke gendannes.`,
        confirm: 'Slå fra',
        cancel: 'Annullér',
      },
    },
  };
})();
