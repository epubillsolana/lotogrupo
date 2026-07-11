const LOTERIA_API_KEY = 'lat_f73acac9_11dfb5ae5f7d5125ed6a3a94e68186b46a37fb7212e94ad1587b57974ee8881b';

const GAME_SLUGS = {
  euromillones: 'euromillones',
  primitiva: 'primitiva',
  bonoloto: 'bonoloto',
  gordo: 'gordo',
  loteria_nacional: 'nacional',
};

const MAIN_COUNT = {
  euromillones: 5,
  primitiva: 6,
  bonoloto: 6,
  gordo: 5,
  loteria_nacional: 5,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Cache-Control, Pragma',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') {
      return new Response(JSON.stringify({ ok: true, time: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    const matchDraw = path.match(/^\/draw\/(\w+)$/);
    if (matchDraw) {
      const lotKey = matchDraw[1];
      const slug = GAME_SLUGS[lotKey];
      if (!slug) {
        return new Response(JSON.stringify({ error: 'Unknown lottery: ' + lotKey }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS }
        });
      }

      try {
        const apiUrl = 'https://api.loteriasapi.com/api/v1/results/' + slug + '/latest';
        const resp = await fetch(apiUrl, {
          cf: { cacheEverything: false, cacheTtl: 0 },
          headers: {
            'X-API-Key': LOTERIA_API_KEY,
            'Accept': 'application/json',
          }
        });

        if (!resp.ok) throw new Error('API error: ' + resp.status);

        const json = await resp.json();
        const d = json.data;

        const mainCount = MAIN_COUNT[lotKey] || 5;
        const allNums = d.combination || [];
        const numeros = allNums.slice(0, mainCount).sort((a, b) => a - b);

        let estrellas = [];
        if (d.resultData && d.resultData.estrellas && d.resultData.estrellas.length > 0) {
          estrellas = d.resultData.estrellas.sort((a, b) => a - b);
        } else if (d.resultData && d.resultData.complementario) {
          estrellas = [d.resultData.complementario];
        } else if (allNums.length > mainCount) {
          estrellas = allNums.slice(mainCount).sort((a, b) => a - b);
        }

        return new Response(JSON.stringify({
          loteria: lotKey,
          fecha: d.drawDate,
          numeros: numeros,
          estrellas: estrellas,
          bote: d.jackpotFormatted || '—',
          ts: Date.now(),
        }), {
          headers: { 'Content-Type': 'application/json', ...CORS }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, ts: Date.now() }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found', path: path }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
};
