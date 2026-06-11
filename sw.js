// Service Worker — Euromillones del grupo
const CACHE = 'euromillones-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// ── Mensajes desde la app ────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if(!e.data) return;

  if(e.data.type === 'SAVE_CONFIG'){
    setStore('notif_config', e.data.config);
  }

  if(e.data.type === 'SEND_TEST'){
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      tag: 'em-test',
      renotify: true,
    });
  }
});

// ── Periodic Sync (Android Chrome) ──────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if(e.tag === 'euromillones-weekly'){
    e.waitUntil(checkAndNotify());
  }
});

// ── Al activarse el SW (cada vez que se abre la app) ─────────────────────────
self.addEventListener('fetch', e => {
  // Solo interceptamos para poder ejecutar el check de notificación
  if(e.request.url.includes('euromillones')){
    checkAndNotify(); // async, no bloqueamos el fetch
  }
});

// ── Lógica de notificación ───────────────────────────────────────────────────
async function checkAndNotify(){
  const config = await getStore('notif_config');
  if(!config) return;

  const now = new Date();
  // Solo lunes (día 1) entre las 9:50 y las 12:00
  if(now.getDay() !== 1) return;
  if(now.getHours() < 9 || now.getHours() >= 12) return;

  // Evitar enviar más de una vez por día
  const lastSent = await getStore('last_notif_sent');
  const todayStr = now.toDateString();
  if(lastSent === todayStr) return;

  const { myIdx, payerIdx, payerName, others } = config;
  let title, body;
  if(myIdx === payerIdx){
    title = '🎰 ¡Te toca jugar al Euromillones!';
    body = `Recuerda comprar el boleto esta semana. El grupo te hará el Bizum de 4€ (${others.join(', ')}).`;
  } else {
    title = `💸 Bizum de 4€ a ${payerName}`;
    body = `Esta semana juega ${payerName}. Recuerda hacerle el Bizum de 4€.`;
  }

  await self.registration.showNotification(title, {
    body,
    tag: 'euromillones-weekly',
    renotify: false,
    requireInteraction: false,
  });

  await setStore('last_notif_sent', todayStr);
}

// ── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB(){
  return new Promise((res, rej) => {
    const req = indexedDB.open('euromillones-sw', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
}
async function getStore(key){
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
}
async function setStore(key, val){
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = res;
    tx.onerror = rej;
  });
}
