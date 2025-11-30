// js/ui/help.js

// Konfiguration: alle emner i manualen
const HELP_TOPICS = [
    {
        id: 'about-flango',
        title: 'Om Flango',
        body: `
Flango er et digitalt cafésystem til SFO og klub, som hjælper både børn og voksne med
at holde styr på saldoer, salg, indbetalinger og statistik.

Systemet er designet til at være børnevenligt, overskueligt og pædagogisk –
så børn kan være ekspedienter og tage ansvar, mens de voksne har det fulde overblik.
        `
    },
    {
        id: 'history',
        title: 'Historik',
        body: `
I Historik kan du se alle tidligere salg og indbetalinger i en valgt periode.
Her kan du:
• Filtrere på datoer
• Se hvem der har købt hvad
• Åbne et enkelt salg og rette det (fx hvis noget er blevet slået forkert ind)

Når du retter et salg, bliver både saldo og historik opdateret, så tallene altid passer.
        `
    },
    {
        id: 'deposit',
        title: 'Indbetaling',
        body: `
Under Indbetaling kan du sætte penge ind på et barns konto.

Typisk vælger du først barnet, og derefter:
• Vælger beløb
• Registrerer hvordan der er betalt (fx MobilePay eller kontant)
• Gemmer indbetalingen, så saldoen opdateres med det samme.

Indbetalinger kan ses igen under Historik.
        `
    },
    {
        id: 'edit-user',
        title: 'Rediger Bruger',
        body: `
I Rediger Bruger kan du justere stamdata for en bruger:
• Navn
• Nummer / kontonummer
• PIN-kode
• Evt. start- eller korrektionssaldo

Du kan også lukke brugere, hvis de fx ikke længere går i institutionen.
        `
    },
    {
        id: 'feedback',
        title: 'Feedback',
        body: `
Feedback-menuen er tænkt som et sted, hvor pædagoger kan give besked til Flango-teamet.

Her kan du fx:
• Melde fejl eller ting der driller
• Ønske nye funktioner
• Dele gode idéer fra børn eller kolleger

Målet er at gøre Flango bedre over tid, sammen med jer der bruger det i hverdagen.
        `
    },
    {
        id: 'admin-vs-user',
        title: 'Admin vs Bruger',
        body: `
Der findes to hoved-roller i Flango:

• Admin:
  - Typisk en pædagog
  - Kan åbne og lukke caféen
  - Kan se og rette historik
  - Kan ændre saldoer, brugere, produkter og regler

• Bruger / Ekspedient:
  - Typisk et barn
  - Kan betjene kassen, vælge kunde og gennemføre køb
  - Kan IKKE ændre saldoer, produkter eller systemindstillinger

På den måde kan børn trygt hjælpe til, uden at kunne ødelægge noget vigtigt.
        `
    },
    {
        id: 'parent-portal',
        title: 'Forældreportal',
        body: `
Forældre-portalen gør det muligt for forældre at:
• Se deres barns saldo
• Få overblik over køb i caféen
• Evt. få saldo-advarsler pr. e-mail (hvis institutionen bruger det)

Adgang gives typisk via en kode eller et link, som institutionen deler med forældrene.
        `
    },
    {
        id: 'rules',
        title: 'Institutionens Regler',
        body: `
Under Institutionens Regler kan I beskrive jeres egne rammer for caféen, fx:

• Hvor meget må man maksimalt købe pr. dag?
• Er der særlige regler for sukker?
• Hvornår er caféen åben?
• Hvem må være ekspedient, og hvor mange ad gangen?

Teksten her er tænkt som jeres egen lille huskeseddel og aftale med børnene.
        `
    },
    {
        id: 'logout-vs-lock',
        title: 'Log Ud vs Lås Café',
        body: `
Der er forskel på at:

• Logge ud:
  - Afslutter den nuværende bruger/ekspedient
  - Man skal logge ind igen, før kassen kan bruges

• Låse caféen:
  - Bruger til at "pause" caféen midlertidigt
  - Kan fx bruges hvis der er pause, oprydning eller møde
  - Når caféen låses op igen, kan en ny ekspedient fortsætte

Brug log ud når du er helt færdig – og lås café, når der bare er en kort pause.
        `
    },
    {
        id: 'contact-support',
        title: 'Kontakt & Support',
        body: `
Har I brug for hjælp til Flango, kan I fx:

• Kontakte den lokale Flango-ansvarlige i institutionen
• Sende en besked via Feedback-funktionen
• Eller bruge den kontaktmetode, der er aftalt ved opstart (mail, telefon el.lign.)

Skriv gerne hvad I forsøgte at gøre, og hvad der skete – så er det meget nemmere at hjælpe.
        `
    },
];

let helpOverlay = null;
let helpModal = null;
let searchInput = null;
let topicsContainer = null;

// Opret selve overlay + modal DOM (kun én gang)
function ensureHelpDOM() {
    if (helpOverlay) return;

    helpOverlay = document.createElement('div');
    helpOverlay.id = 'flango-help-overlay';
    helpOverlay.style.position = 'fixed';
    helpOverlay.style.inset = '0';
    helpOverlay.style.background = 'rgba(0,0,0,0.35)';
    helpOverlay.style.display = 'none';
    helpOverlay.style.zIndex = '99990';
    helpOverlay.style.justifyContent = 'center';
    helpOverlay.style.alignItems = 'center';

    helpModal = document.createElement('div');
    helpModal.id = 'flango-help-modal';
    helpModal.style.maxWidth = '900px';
    helpModal.style.width = '90%';
    helpModal.style.maxHeight = '80vh';
    helpModal.style.background = '#fff';
    helpModal.style.borderRadius = '24px';
    helpModal.style.padding = '24px 28px';
    helpModal.style.boxShadow = '0 18px 50px rgba(0,0,0,0.18)';
    helpModal.style.display = 'flex';
    helpModal.style.flexDirection = 'column';
    helpModal.style.gap = '16px';

    helpOverlay.appendChild(helpModal);
    document.body.appendChild(helpOverlay);

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.gap = '16px';

    const title = document.createElement('h2');
    title.textContent = 'Hjælp til Flango';
    title.style.margin = '0';
    title.style.fontSize = '24px';
    title.style.color = '#f1873b'; // Flango-orange

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Luk';
    closeBtn.style.border = 'none';
    closeBtn.style.padding = '6px 14px';
    closeBtn.style.borderRadius = '999px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '14px';

    closeBtn.addEventListener('click', () => {
        hideHelp();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    helpModal.appendChild(header);

    // Intro-tekst
    const intro = document.createElement('p');
    intro.textContent = "Her finder du information om alle Flango's mange funktioner.";
    intro.style.margin = '0 0 8px 0';
    helpModal.appendChild(intro);

    // Søgning
    const searchWrapper = document.createElement('div');
    searchWrapper.style.marginBottom = '8px';

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Søg i manualen...';
    searchInput.style.width = '100%';
    searchInput.style.borderRadius = '999px';
    searchInput.style.border = '1px solid #ddd';
    searchInput.style.padding = '8px 14px';
    searchInput.style.fontSize = '14px';

    searchWrapper.appendChild(searchInput);
    helpModal.appendChild(searchWrapper);

    // Liste med emner
    topicsContainer = document.createElement('div');
    topicsContainer.style.overflowY = 'auto';
    topicsContainer.style.flex = '1 1 auto';
    topicsContainer.style.paddingRight = '4px';

    helpModal.appendChild(topicsContainer);

    // Klik på baggrund lukker også
    helpOverlay.addEventListener('click', (evt) => {
        if (evt.target === helpOverlay) {
            hideHelp();
        }
    });

    // Filtrer når man skriver
    searchInput.addEventListener('input', () => {
        renderTopics(searchInput.value);
    });

    // Første render
    renderTopics('');
}

function createTopicElement(topic) {
    const wrapper = document.createElement('div');
    wrapper.className = 'help-topic';
    wrapper.style.borderRadius = '18px';
    wrapper.style.padding = '10px 14px';
    wrapper.style.marginBottom = '10px';
    wrapper.style.background = '#f9f5ff'; // lys pastel – kan ændres til dine tema-farver
    wrapper.style.cursor = 'pointer';
    wrapper.style.transition = 'background 0.15s ease';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.gap = '12px';

    const titleEl = document.createElement('div');
    titleEl.textContent = topic.title;
    titleEl.style.fontWeight = '600';
    titleEl.style.fontSize = '15px';

    const iconEl = document.createElement('div');
    iconEl.textContent = '▾';
    iconEl.style.fontSize = '12px';

    headerRow.appendChild(titleEl);
    headerRow.appendChild(iconEl);

    const bodyEl = document.createElement('div');
    bodyEl.style.marginTop = '6px';
    bodyEl.style.fontSize = '14px';
    bodyEl.style.lineHeight = '1.4';
    bodyEl.style.display = 'none';
    bodyEl.style.whiteSpace = 'pre-line';
    bodyEl.textContent = topic.body.trim();

    wrapper.appendChild(headerRow);
    wrapper.appendChild(bodyEl);

    let open = false;

    const toggle = () => {
        open = !open;
        bodyEl.style.display = open ? 'block' : 'none';
        iconEl.textContent = open ? '▴' : '▾';
        wrapper.style.background = open ? '#fff7ef' : '#f9f5ff';
    };

    wrapper.addEventListener('click', () => {
        toggle();
    });

    return wrapper;
}

function renderTopics(searchTerm) {
    if (!topicsContainer) return;
    topicsContainer.innerHTML = '';

    const term = (searchTerm || '').toLowerCase();

    const filtered = HELP_TOPICS.filter((topic) => {
        if (!term) return true;
        return (
            topic.title.toLowerCase().includes(term) ||
            topic.body.toLowerCase().includes(term)
        );
    });

    if (filtered.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Ingen emner matcher din søgning.';
        empty.style.fontSize = '14px';
        topicsContainer.appendChild(empty);
        return;
    }

    filtered.forEach((topic) => {
        topicsContainer.appendChild(createTopicElement(topic));
    });
}

function showHelp() {
    ensureHelpDOM();
    helpOverlay.style.display = 'flex';
    if (searchInput) {
        searchInput.value = '';
        renderTopics('');
        setTimeout(() => searchInput.focus(), 0);
    }
}

function hideHelp() {
    if (helpOverlay) {
        helpOverlay.style.display = 'none';
    }
}

/**
 * Initialiser hjælp-modulet.
 * @param {HTMLElement} logoButton - det element der skal åbne hjælpen (Flango-logoet).
 */
export function setupHelpModule(logoButton) {
    if (!logoButton) return;
    logoButton.addEventListener('click', (evt) => {
        evt.preventDefault();
        showHelp();
    });
}

// Hvis du vil kunne åbne fra andre steder i koden:
export function openHelpManually() {
    showHelp();
}