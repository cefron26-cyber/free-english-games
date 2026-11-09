// Service worker del portal (lo completa construir.js). Guarda el portal y los juegos para jugar sin internet.
// Cada archivo se guarda con su huella: al subir cambios solo se vuelve a bajar lo que cambió.
const ARCHIVOS = {
 "avatar.png": "b39dc88299",
 "corner-shop/index.html": "84b28e1d61",
 "estilos.css": "9f25c1958d",
 "face-maker/index.html": "3570214b0e",
 "fuentes/fredoka-latin-600-normal.woff2": "b9fca786c0",
 "fuentes/LICENSE-fredoka.txt": "2a60a248a9",
 "fuentes/LICENSE-lilita-one.txt": "1a40e6e298",
 "fuentes/LICENSE-press-start-2p.txt": "f74697671a",
 "fuentes/lilita-one-latin-400-normal.woff2": "3b71f6c24c",
 "fuentes/press-start-2p-latin-400-normal.woff2": "87ab8daaa6",
 "icono.svg": "12f6340967",
 "iconos/apple-touch-icon.png": "3c8980412d",
 "iconos/favicon-48.png": "c1ef72df1e",
 "iconos/icono-192.png": "442e7dc1fa",
 "iconos/icono-512.png": "0cf5e40257",
 "iconos/icono-maskable-512.png": "0cf5e40257",
 "index.html": "70a9492d81",
 "manifest.webmanifest": "64dbdd3dd1",
 "miniaturas/corner-shop.jpg": "4624560079",
 "miniaturas/face-maker.jpg": "1b4048e4f7",
 "miniaturas/sketch-detective.jpg": "0409dc5739",
 "miniaturas/verb-climber.jpg": "3a778fe964",
 "portal.js": "a0552d4712",
 "sketch-detective/index.html": "118fed070f",
 "verb-climber/index.html": "ac2cfb88f2",
 "visitas.html": "cc7e060129"
};
const JUEGOS = ["corner-shop/index.html","face-maker/index.html","verb-climber/index.html","sketch-detective/index.html"];
const CACHE = 'portal-juegos';
const BASE = new URL('./', self.location).href;
const clave = (f) => BASE + f + '?v=' + ARCHIVOS[f];

// URL pedida -> archivo del portal (o null si no es nuestro)
function ruta(url) {
  if (!url.startsWith(BASE)) return null;
  let r = decodeURIComponent(url.slice(BASE.length).split('#')[0].split('?')[0]);
  if (r === '' || r.endsWith('/')) r += 'index.html';
  return r in ARCHIVOS ? r : null;
}
// Borra las versiones anteriores de un archivo (solo después de tener la nueva)
async function limpiarViejas(f, c) {
  for (const req of await c.keys()) if (req.url.split('?')[0] === BASE + f && req.url !== clave(f)) await c.delete(req);
}
async function guardar(f, c) {
  if (await c.match(clave(f))) return;
  const res = await fetch(clave(f), { cache: 'no-cache' });
  if (!res.ok) throw new Error('No se pudo bajar ' + f);
  await c.put(clave(f), res);
  await limpiarViejas(f, c);
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // el portal se guarda ya; los juegos (más pesados) se guardan después, avisando el avance
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(Object.keys(ARCHIVOS).filter((f) => !JUEGOS.includes(f)).map((f) => guardar(f, c)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const req of await c.keys()) {
      const f = req.url.split('?')[0].slice(BASE.length);
      if (!(f in ARCHIVOS)) await c.delete(req);                         // archivo que ya no existe
      else if (!JUEGOS.includes(f) && req.url !== clave(f)) await c.delete(req); // versión vieja del portal
    }
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function avisar(m) { for (const cl of await self.clients.matchAll()) cl.postMessage(m); }
let enCurso = null;
function guardarJuegos() {
  if (!enCurso) enCurso = (async () => {
    const c = await caches.open(CACHE);
    let listos = 0;
    for (const f of JUEGOS) if (await c.match(clave(f))) listos++;
    await avisar({ tipo: 'progreso', listos, total: JUEGOS.length });
    for (const f of JUEGOS) {
      if (await c.match(clave(f))) continue;
      await guardar(f, c);
      await avisar({ tipo: 'progreso', listos: ++listos, total: JUEGOS.length });
    }
  })().catch(() => avisar({ tipo: 'error' })).finally(() => { enCurso = null; });
  return enCurso;
}
self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'guardar-juegos') e.waitUntil(guardarJuegos());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const f = ruta(e.request.url);
  if (!f) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const guardado = await c.match(clave(f));
    if (guardado) return guardado;
    try {
      const res = await fetch(clave(f), { cache: 'no-cache' });
      if (res.ok) { await c.put(clave(f), res.clone()); await limpiarViejas(f, c); }
      return res;
    } catch (err) {
      // sin internet y sin la versión nueva: se usa la versión anterior si la hay
      const viejo = await c.match(BASE + f, { ignoreSearch: true });
      if (viejo) return viejo;
      throw err;
    }
  })());
});
