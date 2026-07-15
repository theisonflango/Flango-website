#!/bin/zsh
# Dev server for forældre-portalen
# Kører en lokal HTTP server med auto-reload support

cd "$(dirname "$0")"
PORT="${1:-3001}"

echo "🚀 Starter dev server for forældre-portalen..."
echo "   URL: http://127.0.0.1:$PORT"
echo "   Tryk Ctrl+C for at stoppe"
echo ""

# Prøv Deno først (hvis tilgængelig)
if command -v deno >/dev/null 2>&1; then
    echo "✅ Brug Deno server"
    TMP="$(mktemp -t foraeldre-server.XXXXXX.ts)"
    trap 'rm -f "$TMP"' EXIT
    cat <<'DENO_SCRIPT' > "$TMP"
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.224.0/http/file_server.ts";

const PORT = parseInt(Deno.env.get("PORT") || "3001");
const HOST = "127.0.0.1";

async function handler(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const filePath = pathname === "/" ? "./index.html" : "." + pathname;
  try {
    return await serveFile(req, filePath);
  } catch (_) {
    return new Response(`File not found: ${pathname}`, { status: 404 });
  }
}

console.log(`Server kører på http://${HOST}:${PORT}\n`);
await Deno.serve({ hostname: HOST, port: PORT }, handler);
DENO_SCRIPT
    PORT="$PORT" deno run --allow-net --allow-read --allow-env=PORT --watch "$TMP"
    exit 0
fi

# Fallback til Python
if command -v python3 >/dev/null 2>&1; then
    echo "⚠️  Deno ikke fundet - bruger Python HTTP server"
    echo "   (Auto-reload ikke tilgængelig med Python server)"
    python3 -m http.server "$PORT" --bind 127.0.0.1
else
    echo "❌ Hverken Deno eller Python fundet!"
    echo "   Installer Deno: https://deno.land"
    echo "   Eller brug: python3 -m http.server $PORT"
    exit 1
fi
