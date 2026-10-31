// Portal: instalación (PWA), modo sin internet y aviso de estado. No recoge ningún dato.
(function () {
  'use strict';
  const estado = document.getElementById('estado');
  const btnInstalar = document.getElementById('instalar');
  // sin textos: solo aparece una marca ✓ junto al liceo cuando los juegos ya funcionan sin internet
  function mostrar(texto, listo) { estado.title = texto; estado.setAttribute('aria-label', texto); estado.hidden = !listo; estado.classList.toggle('listo', !!listo); }

  // Botón "Instalar" (Android Chrome / Edge); en iPhone se usa Compartir > Agregar a inicio
  let aviso = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; btnInstalar.hidden = false; });
  btnInstalar.addEventListener('click', async () => {
    if (!aviso) return;
    aviso.prompt();
    try { await aviso.userChoice; } catch (e) { /* cancelado */ }
    aviso = null; btnInstalar.hidden = true;
  });
  window.addEventListener('appinstalled', () => { btnInstalar.hidden = true; });

  // Service worker: guarda el portal y los tres juegos para jugar sin internet
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const habiaControl = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // llegó una versión nueva del portal: se recarga sola (solo la portada, nunca a mitad de un juego)
    if (habiaControl && !recargando) { recargando = true; location.reload(); }
    else pedirJuegos();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.tipo === 'progreso') mostrar(m.listos >= m.total ? '✓ Listo para jugar sin internet' : 'Guardando juegos para jugar sin internet… ' + m.listos + '/' + m.total, m.listos >= m.total);
    if (m.tipo === 'error') mostrar(navigator.onLine ? 'No se pudieron guardar todos los juegos; se reintentará' : 'Sin internet', false);
  });
  function pedirJuegos() {
    if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ tipo: 'guardar-juegos' });
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      if (navigator.serviceWorker.controller) pedirJuegos();
      reg.update().catch(() => {});
    }).catch(() => {});
  });
  window.addEventListener('online', pedirJuegos);
})();
