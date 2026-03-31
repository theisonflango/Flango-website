# Flango Forældreportal

Web-portal for forældre til at se og styre deres barns cafe-saldo, forbrugsbegrænsninger, allergener, skærmtid og arrangementer.

## Tech

- Vanilla HTML/CSS/JS (alt i én `index.html`, ~341 KB, ingen build-step)
- Supabase Auth (email/password) + Edge Functions
- Deploy: rå fil til GitHub Pages (`flango.dk/forældre`)

## Views/Sider

| View | Formål |
|------|--------|
| `login-view` | Login, opret konto, glemt password, nulstil password |
| `results-view` | Hovedvisning med barnets data i sammenklappelige sektioner |

### Sektioner i results-view (feature flag-styret)

| Sektion | Ikon | Formål | Feature flag |
|---------|------|--------|--------------|
| Optank saldo | 💳 | Stripe beløbs-knapper (50/100/150 kr + andet), MobilePay QR | Payment-config |
| Kommende arrangementer | 📅 | Tilmeld/afmeld/betal events fra saldo eller Stripe | Altid (hvis events) |
| Købsprofil | 📊 | Forbrugsoversigt med Alt/30d/7d + Antal/Beløb toggle + bar chart | Altid |
| Historik | 📜 | Transaktioner: køb, optankning, saldo-justeringer (30 dage) | Altid |
| E-mail, når saldoen er lav | 📧 | Lav-saldo email-alarmer | `parent_portal_email_notifications` |
| Dagens Sortiment | 📋 | Aktive produkter med emoji/ikon og pris | Altid |
| Daglig beløbsgrænse | 💰 | Max forbrug per dag (preset chips: 20/30/40/50 kr + custom) | `parent_portal_spending_limit` |
| Købsgrænser pr. produkt | 🛒 | Per-produkt begrænsninger med stepper (−/+) | `parent_portal_product_limit` |
| Sukkerpolitik | 🍬 | Max usunde/dag, max per produkt, bloker alle usunde | `parent_portal_sugar_policy` |
| Kostpræferencer | 🥗 | Kun vegetarisk, ingen svinekød | `_vegetarian_only` / `_no_pork` |
| Skærmtid | 🕹️ | Gaming-grænser, samtykke, spilgodkendelse (se nedenfor) | `skaermtid_enabled` |
| Allergier & madbegrænsninger | 🥜 | 9 allergener: allow/warn/block per allergen | `parent_portal_allergens` |
| Skift kode til forældre-login | 🔑 | Skift password/PIN (min 4 tegn) | Altid |
| **Privatliv & Rettigheder** | 🛡️ | GDPR-tab med 8 sektioner (se nedenfor) | Altid |

### Privatliv & Rettigheder (ny tab)

| Sektion | Formål | Backend |
|---------|--------|---------|
| 1. Privatlivspolitik | Forældrevenlig tekst + link til fuld version | Statisk (dynamisk institutionsnavn) |
| 2. Barnets navn | Vis + rediger visningsnavn | RPC `update_child_name_by_parent` |
| 3. Profilbillede & samtykke | Vis aktuelt billede + consent-toggles (flyttet fra Profil) | RPC `save_profile_picture_consent` |
| 4. Dataindsigt & eksport | Vis alle data + JSON download | RPC `get_child_data_export` |
| 5. Tilknyttede forældrekonti | Hvem har adgang (maskeret e-mail) | RPC `get_linked_parents_for_child` |
| 6. Slet barnets data | Anmodning med navne-bekræftelse + statusvisning | RPC `request_parent_deletion` / `get_parent_deletion_status` |
| 7. Slet forældrekonto | E-mail-bekræftelse → slet konto + log ud | Edge Function `delete-parent-account` |
| 8. Kontakt | Dataansvarlig + databehandler | Statisk (dynamisk institutionsnavn) |

### Skærmtid-sektionen (detaljer)

- **Resterende spilletid** + **Brugt i dag** (feature flag: `skaermtid_show_remaining` / `skaermtid_show_usage`)
- **Institutions-regler**: Daglig grænse og max per session (`skaermtid_show_rules`)
- **Personlige grænser**: Daglig grænse (min) + maks per session. "Grænsen kan aldrig overstige institutionens regler" (`skaermtid_allow_personal_limits`)
- **Samtykke til forlænget spilletid**: Toggle med forklaring — giver personalet lov til undtagelsesvis at forlænge (`skaermtid_allow_extra_time_requests`)
- **Godkend spil fra kataloget**: Per-spil toggles med platform-label (PC/Konsol/PC+Konsol). Institutionsblokerede spil markeret med rød tekst (`skaermtid_allow_game_approval`)
- **Spilletidsoversigt**: Stationer/Spil toggle, periode (Alt/30d/7d), samlet spilletid i minutter, bar chart

## Vigtige Flows

### Auth & Tilknytning
1. Opret konto: vælg institution → indtast 8-cifret PIN + email + password
2. PIN verificeres via `verify_parent_code_and_link_child` RPC → konto oprettes i Supabase Auth
3. **Vilkårsaccept:** Forælder skal acceptere vilkår (databehandling, visning på caféskærm) FØR barn tilknyttes. Versioneret (`terms_version`). Retrospektiv accept ved login for eksisterende forældre.
4. Tilknyt ekstra barn: `link-sibling-by-code` Edge Function (preview + vilkårsaccept + bekræft)
5. Børneskifter-dropdown med saldo + statusindikator (grøn/gul/rød prik)
6. "Husk mig på denne enhed": Checkbox ved login. Hvis fravalgt, ryddes session ved browser-lukning.

### Betaling (saldo-optankning)
- Stripe Connect: `create-topup` → Stripe checkout → `confirm-topup`
- MobilePay QR: vis QR-kode, venter på godkendelse i cafe-app

### Arrangementer
- `get-parent-events` → vis events med status
- Tilmeld: `parent-event-register` (betal fra saldo eller Stripe)
- Afmeld: `parent-event-cancel` (automatisk refund)

### Forældregrænser
- Beløbsgrænse: `save-daily-limit` → `users.daily_spend_limit`
- Produktgrænser: `save-parent-limits` → `parent_limits`
- Sukkerpolitik: `save-parent-sugar-policy` → `parent_sugar_policy`
- Allergener: `save-allergy-settings` → `child_allergen_settings`
- Kostpræferencer: `save-parent-sugar-policy` (vegetar/svinekød flags)

### Skærmtid
- Personlige grænser + samtykke + spilgodkendelse
- `save-skaermtid-parent-settings` Edge Function

## Supabase RPCs

| Funktion | Formål |
|----------|--------|
| `get_public_institutions` | Hent institutioner til signup/valg |
| `get_children_for_parent` | Hent tilknyttede børn (inkl. `terms_accepted_at`, `terms_version`) |
| `verify_parent_code_and_link_child` | Verificer PIN og tilknyt barn |
| `accept_parent_terms` | Acceptér vilkår for et barn (sæt `terms_accepted_at`) |
| `get_child_data_export` | Komplet dataudtræk for et barn (GDPR indsigt) |
| `get_parent_deletion_status` | Hent seneste sletningsanmodning |
| `request_parent_deletion` | Opret sletningsanmodning |
| `get_linked_parents_for_child` | Vis tilknyttede forældre (maskeret e-mail) |
| `update_child_name_by_parent` | Rediger barnets visningsnavn |

## Edge Functions

`get-parent-view`, `get-products-for-parent`, `save-parent-limits`, `save-daily-limit`, `save-parent-sugar-policy`, `save-parent-notification`, `get-allergy-settings`, `save-allergy-settings`, `get-parent-events`, `parent-event-register`, `parent-event-cancel`, `create-event-payment`, `confirm-event-payment`, `create-topup`, `confirm-topup`, `link-sibling-by-code`, `get-purchase-profile`, `save-skaermtid-parent-settings`, `update-parent-pin`, `get-parent-data-export`, `delete-parent-account`

## Supabase-tabeller (via Edge Functions)

`users`, `institutions`, `products`, `parent_account_children`, `parent_limits`, `parent_sugar_policy`, `child_allergen_settings`, `parent_notifications`, `parent_daily_special_limit`, `parent_deletion_requests`, `club_events`, `event_registrations`, `event_payments`, `stripe_topup_payments`, `admin_audit_log`, `gaming.users`, `gaming.parent_overrides`, `gaming.portal_settings`, `gaming.game_catalog`
