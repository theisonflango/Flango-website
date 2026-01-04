// js/core/db-instrumentation.js
// Letvægts-instrumentering af Supabase-kald
// Slå fra ved at sætte ENABLED = false

const ENABLED = true;

// Hvis true: print én linje pr kald. Hvis false: kun statistik via window.__flangoDbStats
const PRINT_EACH_CALL = true;

// Hvis true: forsøger at udlede callsite (hvilken fil/funktion udløste DB-kaldet)
const INCLUDE_CALLSITE = true;

// Stack-linjer der typisk er interne wrappers og derfor skal ignoreres
const CALLSITE_EXCLUDES = [
    'db-instrumentation',
    'config-and-supabase',
];

function getCallsite() {
    if (!INCLUDE_CALLSITE) return 'disabled';

    const stack = (new Error().stack || '')
        .split('\n')
        .map(s => s.trim());

    for (const line of stack) {
        // Skip interne wrappers og støj
        if (
            line.includes('db-instrumentation') ||
            line.includes('config-and-supabase') ||
            line.includes('node_modules') ||
            line.includes('<anonymous>')
        ) {
            continue;
        }

        // Chrome / Edge
        if (line.startsWith('at ')) {
            return line.replace(/^at\s+/, '');
        }

        // Safari / Firefox format
        if (line.includes('@')) {
            return line;
        }
    }

    return 'unknown';
}

// Global statistik
if (typeof window !== 'undefined') {
    window.__flangoDbStats = {
        totalCalls: 0,
        byType: { from: 0, rpc: 0, functions: 0, auth: 0 },
        byTable: {},
        byRpc: {},
        byFunction: {},
        log: [],
        reset() {
            this.totalCalls = 0;
            this.byType = { from: 0, rpc: 0, functions: 0, auth: 0 };
            this.byTable = {};
            this.byRpc = {};
            this.byFunction = {};
            this.log = [];
        },
        summary() {
            console.table({
                'Total kald': this.totalCalls,
                'from()': this.byType.from,
                'rpc()': this.byType.rpc,
                'functions': this.byType.functions,
                'auth': this.byType.auth,
            });
            console.log('Tabeller:', this.byTable);
            console.log('RPC:', this.byRpc);
            console.log('Functions:', this.byFunction);
        }
    };
    if (ENABLED) console.log('[Flango DB] Instrumentering AKTIV');
}

function logCall(type, name) {
    if (!ENABLED) return;

    // Guard: instrumentering er kun til browser (window)
    if (typeof window === 'undefined' || !window.__flangoDbStats) return;

    const stats = window.__flangoDbStats;
    const timestamp = new Date().toISOString().slice(11, 23);
    const callsite = getCallsite();

    stats.totalCalls++;
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    if (type === 'from') {
        stats.byTable[name] = (stats.byTable[name] || 0) + 1;
    } else if (type === 'rpc') {
        stats.byRpc[name] = (stats.byRpc[name] || 0) + 1;
    } else if (type === 'functions') {
        stats.byFunction[name] = (stats.byFunction[name] || 0) + 1;
    }

    stats.log.push({ timestamp, type, name, callsite });

    if (PRINT_EACH_CALL) {
        // Med callsite sidst (så man kan se hvor kaldet kom fra)
        console.debug(`[DB #${stats.totalCalls}] ${timestamp} ${type}(${name}) :: ${callsite}`);
    }
}

/**
 * Wrap en Supabase client med instrumentering
 * @param {Object} client - Original supabase client
 * @returns {Object} - Instrumenteret client (samme API)
 */
export function instrumentSupabase(client) {
    if (!ENABLED) return client;

    return new Proxy(client, {
        get(target, prop) {
            const original = target[prop];

            // .from(tableName)
            if (prop === 'from') {
                return function(tableName) {
                    logCall('from', tableName);
                    return original.call(target, tableName);
                };
            }

            // .rpc(fnName, params)
            if (prop === 'rpc') {
                return function(fnName, ...args) {
                    logCall('rpc', fnName);
                    return original.call(target, fnName, ...args);
                };
            }

            // .functions.invoke(fnName, options)
            if (prop === 'functions') {
                return new Proxy(original, {
                    get(fnTarget, fnProp) {
                        if (fnProp === 'invoke') {
                            return function(fnName, ...args) {
                                logCall('functions', fnName);
                                return fnTarget.invoke.call(fnTarget, fnName, ...args);
                            };
                        }
                        return fnTarget[fnProp];
                    }
                });
            }

            // .auth.xxx()
            if (prop === 'auth') {
                return new Proxy(original, {
                    get(authTarget, authProp) {
                        const authMethod = authTarget[authProp];
                        if (typeof authMethod === 'function') {
                            return function(...args) {
                                logCall('auth', authProp);
                                return authMethod.call(authTarget, ...args);
                            };
                        }
                        return authMethod;
                    }
                });
            }

            return original;
        }
    });
}
