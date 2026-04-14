import { supabaseClient, INSTITUTION_ID_KEY } from '../core/config-and-supabase.js?v=3.0.79';
import { getCurrentAdmin, getCurrentClerk, getInstitutionId } from './session-store.js?v=3.0.79';

// Stats-tilstand og Supabase-integration (ingen UI/badge-logik)
const safeNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const aggregateSalesForClerk = (rows, clerkProfile) => {
    const clerkName = clerkProfile?.name || null;
    const clerkId = clerkProfile?.id || null;

    let totalAmount = 0;
    let customers = 0;
    let items = 0;
    const productMap = new Map();
    rows.forEach((event) => {
        if (event.event_type !== 'SALE') return;

        // Use clerk_name directly from events_view (with COALESCE fallback built-in)
        // The view returns clerk_name from clerk_user_id, or falls back to admin_name for old records
        const eventClerkName = event.clerk_name || null;
        const eventClerkId = event.clerk_user_id || event.admin_user_id || null;

        // Match by name (works for both old and new records thanks to COALESCE in view)
        const isMySaleByName = eventClerkName && clerkName && (eventClerkName === clerkName);
        const isMySaleById = eventClerkId && clerkId && (eventClerkId === clerkId);

        const isMySale = isMySaleByName || isMySaleById;

        if (!isMySale) {
            return;
        }

        const details = event.details || {};
        let amount = safeNumber(details.total_amount);

        if (!amount) {
            amount = safeNumber(details.amount);
        }

        // I dine events ligger beløbet typisk i items/price_at_purchase
        if (!amount && Array.isArray(event.items)) {
            amount = event.items.reduce((sum, item) => {
                const qty = safeNumber(item.quantity);
                const price = safeNumber(item.price_at_purchase);
                return sum + qty * price;
            }, 0);
        }

        totalAmount += amount;
        customers += 1;

        const itemsList = Array.isArray(event.items) ? event.items : [];
        itemsList.forEach((item) => {
            const qty = safeNumber(item.quantity);
            items += qty;

            const key =
                item.product_id ||
                item.product_name ||
                item.name ||
                item.title ||
                item.emoji ||
                Math.random().toString(36);

            const existing = productMap.get(key) || {
                productId: item.product_id || null,
                name: item.product_name || item.name || item.title || 'Ukendt vare',
                emoji: item.emoji || '',
                quantity: 0,
                totalAmountForProduct: 0,
            };

            existing.quantity += qty;
            existing.totalAmountForProduct += qty * safeNumber(item.price_at_purchase);
            productMap.set(key, existing);
        });
    });

    return {
        totalAmount,
        customers,
        items,
        products: Array.from(productMap.values()),
    };
};

// Roterende Hr. Flango-beskeder pr. niveau (index 0–4 svarer til levels-arrayet)
export const FLANGO_LEVEL_MESSAGES = [
    [
        'Du er i gang med at lære, hvordan man arbejder i en café.',
        'Alle starter et sted. Du er allerede i gang – godt klaret!',
    ],
    [
        'Du kan klare opgaver selvstændigt.',
        'Du har fundet rytmen. Kunderne er i gode hænder hos dig.',
        'Øvet ekspedient – det er noget at være stolt af!',
    ],
    [
        'Du er rutineret og har overblik.',
        'Expert-niveau! Du ved hvad du laver – og det viser sig.',
        'Du har overblikket. Det er ikke alle forundt.',
    ],
    [
        'Dine evner som Flango-ekspedient sidder nu på rygraden, og du løser opgaverne naturligt og med godt overblik.',
        'Tre stjerner – du fortjener dem alle tre.',
    ],
    [
        'Du har nået det højeste Level i Flango! Det kræver styrke og vedholdenhed – og ikke mindst en lyst til at hjælpe. Det er en fantastisk evne. Måske kunne dit næste mål være at hjælpe nogen med at nå hertil?',
        'Legendarisk. Ikke mange når hertil. Du er en af dem.',
        'Du er et forbillede for andre ekspedienter. Stærkt gået!',
    ],
];

export function calculateCurrentStats({ clerkProfile, sessionStartTime, sessionSalesCount, remoteStats = null }) {
    const profile = clerkProfile || window.__flangoCurrentClerkProfile || {};
    const levels = [
        {
            name: 'Nybegynder Ekspedient',
            hours: 0,
            sales: 0,
            stars: '',
            description: 'Du er i gang med at lære, hvordan man arbejder i en café.'
        },
        {
            name: 'Øvet Ekspedient',
            hours: 6,
            sales: 100,
            stars: '⭐',
            description: 'Du kan klare opgaver selvstændigt.'
        },
        {
            name: 'Expert Ekspedient',
            hours: 12,
            sales: 200,
            stars: '⭐⭐',
            description: 'Du er rutineret og har overblik.'
        },
        {
            name: 'Pro Flango Ekspedient',
            hours: 18,
            sales: 300,
            stars: '⭐⭐⭐',
            description: 'Dine evner som Flango-ekspedient sidder nu på rygraden, og du løser opgaverne naturligt og med godt overblik.'
        },
        {
            name: 'Legendarisk Ekspedient',
            hours: 30,
            sales: 500,
            stars: '👑',
            description: 'Du har nået det højeste Level i Flango! Det kræver styrke og vedholdenhed – og ikke mindst en lyst til at hjælpe.'
                + ' Det er en fantastisk evne. Måske kunne dit næste mål være at hjælpe nogen med at nå hertil?',
            image: 'Icons/webp/Avatar/Ekspedient-dreng-legende1.webp'
        }
    ];

    const startTime = sessionStartTime instanceof Date ? sessionStartTime : new Date();
    const sessionMinutes = Math.max(0, Math.round((new Date() - startTime) / (1000 * 60)));
    const dbTodayMinutes = remoteStats?.today?.minutes_worked || 0;
    const dbTotalMinutes = remoteStats?.total?.minutes_worked || (profile.total_minutes_worked || 0);

    const safeSessionSales = Math.max(0, sessionSalesCount || 0);
    const totalMinutes = dbTotalMinutes + sessionMinutes;
    const totalHours = Math.floor((dbTotalMinutes + sessionMinutes) / 60);
    const totalSales = (profile.total_sales_count || 0) + safeSessionSales;

    let currentLevel = levels[0];
    let nextLevel = levels[1] || levels[0];
    let progressPercent = 100;
    let remainingHours = 0;
    let remainingSales = 0;

    for (let i = 0; i < levels.length; i++) {
        if (totalHours >= levels[i].hours || totalSales >= levels[i].sales) {
            currentLevel = levels[i];
            nextLevel = levels[i + 1] || levels[i];
        }
    }

    if (nextLevel !== currentLevel) {
        const hs = Math.max(1, nextLevel.hours - currentLevel.hours);
        const ss = Math.max(1, nextLevel.sales - currentLevel.sales);
        const hp = (totalHours - currentLevel.hours) / hs;
        const sp = (totalSales - currentLevel.sales) / ss;
        progressPercent = Math.min(100, Math.max(0, Math.round(Math.max(hp, sp) * 100)));
        remainingHours = Math.max(0, nextLevel.hours - totalHours);
        remainingSales = Math.max(0, nextLevel.sales - totalSales);
    }

    return {
        sessionSalesCount: safeSessionSales,
        sessionMinutes,
        todayMinutes: dbTodayMinutes + sessionMinutes,
        totalMinutes,
        totalHours,
        totalSales,
        currentLevel,
        nextLevel,
        remainingHours,
        remainingSales,
        progressPercent
    };
}

export async function loadFlangoAdminStats() {
    try {
        const institutionId = getInstitutionId() || localStorage.getItem(INSTITUTION_ID_KEY);
        if (!institutionId) return null;

        const profile = getCurrentClerk() || getCurrentAdmin();
        if (!profile || !profile.id) return null;

        const todayKey = new Date().toLocaleDateString('en-CA');
        const toDateKey = (value) => {
            if (!value) return null;
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA');
        };
        const extractDayMinutes = (row) => safeNumber(
            row?.today_minutes_worked
            ?? row?.minutes_today
            ?? row?.minutes_worked
            ?? row?.minutes
            ?? row?.work_minutes
            ?? row?.minutes_for_day
        );
        const extractTotalMinutes = (row) => safeNumber(
            row?.total_minutes_worked
            ?? row?.minutes_total
            ?? row?.total_minutes
            ?? row?.total_work_minutes
        );

        let todayMinutesWorked = 0;
        let totalMinutesWorked = safeNumber(profile.total_minutes_worked);
        // Hent rå stats fra Supabase (som opdateres via increment_user_stats)
        const { data: statsRows, error: statsError } = await supabaseClient
            .from('user_daily_stats')
            .select('*')
            .eq('user_id', profile.id)
            .eq('institution_id', institutionId);

        if (statsError) {
            console.error('Kunne ikke hente user_daily_stats:', statsError);
        }

        if (Array.isArray(statsRows) && statsRows.length > 0) {
            const todayRows = statsRows.filter(row => {
                const dateValue = row.stats_date || row.date || row.day || row.created_at || row.inserted_at;
                if (!dateValue) return false;
                const rowKey = toDateKey(dateValue);
                return rowKey === todayKey;
            });
            todayMinutesWorked = todayRows.reduce((sum, row) => sum + extractDayMinutes(row), 0);

            if (totalMinutesWorked <= 0) {
                const totalsFromField = statsRows
                    .map(extractTotalMinutes)
                    .filter(v => v > 0);
                const totalFromDailySum = statsRows.reduce((sum, row) => sum + extractDayMinutes(row), 0);
                totalMinutesWorked = totalsFromField.length > 0 ? Math.max(...totalsFromField) : totalFromDailySum;
            }
        }

        const toIsoRange = (from, to) => {
            const start = from ? new Date(`${from}T00:00:00`) : null;
            const end = to ? new Date(`${to}T23:59:59.999`) : null;
            return {
                startIso: start ? start.toISOString() : null,
                endIso: end ? end.toISOString() : null
            };
        };

        const loadClerkSalesEventsView = async ({ clerkId, from, to }) => {
            if (!clerkId) return [];
            const { startIso, endIso } = toIsoRange(from, to);
            const pageSize = 1000;
            let offset = 0;
            let eventIds = [];

            while (true) {
                const { data: eventRows, error } = await supabaseClient
                    .from('events')
                    .select('id')
                    .eq('institution_id', institutionId)
                    .eq('event_type', 'SALE')
                    .or(`clerk_user_id.eq.${clerkId},admin_user_id.eq.${clerkId}`)
                    .gte('created_at', startIso || '1970-01-01T00:00:00.000Z')
                    .lte('created_at', endIso || '2999-12-31T23:59:59.999Z')
                    .range(offset, offset + pageSize - 1);

                if (error) {
                    break;
                }

                const ids = (eventRows || []).map(row => row.id).filter(Boolean);
                eventIds = eventIds.concat(ids);

                if (!eventRows || eventRows.length < pageSize) break;
                offset += pageSize;
            }

            if (eventIds.length === 0) return [];

            const chunkSize = 200;
            const chunks = [];
            for (let i = 0; i < eventIds.length; i += chunkSize) {
                chunks.push(eventIds.slice(i, i + chunkSize));
            }

            let rows = [];
            for (const chunk of chunks) {
                const { data: viewRows, error: viewError } = await supabaseClient
                    .from('events_view')
                    .select('*')
                    .in('id', chunk);
                if (viewError) {
                    continue;
                }
                rows = rows.concat(viewRows || []);
            }

            return rows;
        };

        // Hent salgs-historik til beløb og produkter (kun for denne ekspedient)
        const todayRows = await loadClerkSalesEventsView({ clerkId: profile.id, from: todayKey, to: todayKey });
        const totalRows = await loadClerkSalesEventsView({ clerkId: profile.id });


        const todayAgg = aggregateSalesForClerk(todayRows || [], profile);
        const totalAgg = aggregateSalesForClerk(totalRows || [], profile);


        return {
            today: {
                minutes_worked: todayMinutesWorked,
                customers: todayAgg.customers,
                items: todayAgg.items,
                amount: todayAgg.totalAmount,
                products: todayAgg.products,
            },
            total: {
                minutes_worked: totalMinutesWorked,
                customers: totalAgg.customers,
                items: totalAgg.items,
                amount: totalAgg.totalAmount,
                products: totalAgg.products,
            },
        };
    } catch (err) {
        console.error("Uventet fejl i loadFlangoAdminStats():", err);
        return null;
    }
}

export async function addWorkMinutesForToday(minutesToAdd) {
    try {
        if (!minutesToAdd || minutesToAdd <= 0) {
            console.warn("addWorkMinutesForToday: minutesToAdd er tom eller <= 0, skipper opdatering.");
            return;
        }

        const institutionId = getInstitutionId() || localStorage.getItem(INSTITUTION_ID_KEY);
        if (!institutionId) {
            console.error("Ingen institution_id fundet i LocalStorage.");
            return;
        }

        const profile = getCurrentClerk() || getCurrentAdmin() || window.__flangoCurrentAdminProfile || window.__flangoCurrentClerkProfile;
        if (!profile || !profile.id) {
            console.error("Ingen aktiv clerk/admin profil fundet – kan ikke gemme arbejdstid for i dag.");
            return;
        }

        const { error } = await supabaseClient.rpc('add_work_minutes', {
            p_user_id: profile.id,
            p_institution_id: institutionId,
            p_minutes_to_add: minutesToAdd
        });

        if (error) {
            console.error("Fejl ved add_work_minutes:", error);
            return;
        }

        console.log(`Tilføjede ${minutesToAdd} minut(ter) til dagens arbejdstid og total_minutes_worked.`);
    } catch (err) {
        console.error("Uventet fejl i addWorkMinutesForToday():", err);
    }
}

export function mergeRemoteStatsWithSession(remoteStats, statsData) {
    if (!remoteStats) return null;
    const clone = {
        today: { ...(remoteStats.today || {}) },
        total: { ...(remoteStats.total || {}) }
    };
    const ensureBranch = (branch) => {
        if (!branch.minutes_worked) branch.minutes_worked = 0;
        if (!branch.customers) branch.customers = 0;
        if (!branch.items) branch.items = 0;
        return branch;
    };
    ensureBranch(clone.today);
    ensureBranch(clone.total);

    const sessionMinutes = Math.max(0, statsData.sessionMinutes || 0);
    const sessionSales = Math.max(0, statsData.sessionSalesCount || 0);

    // clone.today.minutes_worked er allerede den samlede tid fra DB. Vi skal ikke lægge sessionen til igen.
    clone.today.customers += sessionSales;
    clone.total.customers += sessionSales;
    clone.today.items += sessionSales;
    clone.total.items += sessionSales;
    return clone;
}
