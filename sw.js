// Service Worker — LotoGrupo
const CACHE = 'lotogrupo-v5';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('message', e => {
  if(!e.data) return;
  if(e.data.type === 'SAVE_CONFIG') setStore('notif_config', e.data.config);
  if(e.data.type === 'SEND_TEST'){
    self.registration.showNotification(e.data.title, {
      body: e.data.body, tag: 'em-test', renotify: true,
    });
  }
});

self.addEventListener('periodicsync', e => {
  if(e.tag === 'euromillones-weekly') e.waitUntil(checkAndNotify());
});

// IMPORTANT: Never intercept or cache API calls
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Skip API calls - let them go to network always
  if(url.includes('api.lotogrupo.es')) return;
  if(url.includes('supabase.co')) return;
  if(url.includes('loteriasapi.com')) return;
  // Only check notifications on page navigation
  if(e.request.mode === 'navigate') checkAndNotify();
});

async function checkAndNotify(){
  const config = await getStore('notif_config');
  if(!config) return;

  const paused = await getStore('notif_paused_week');
  const now = new Date();
  const week = `${now.getFullYear()}-W${Math.ceil(now.getDate()/7)}`;
  if(paused === week) return;

  const targetDay = config.notif_day !== undefined ? config.notif_day : 1;
  const targetHour = config.notif_hour !== undefined ? config.notif_hour : 10;

  if(now.getDay() !== targetDay) return;
  if(now.getHours() < targetHour || now.getHours() >= targetHour + 2) return;

  const lastSent = await getStore('last_notif_sent');
  const todayStr = now.toDateString();
  if(lastSent === todayStr) return;

  const { myIdx, payerIdx, payerName, others } = config;
  let title, body;
  if(myIdx === payerIdx){
    title = '🎰 Et toca jugar!';
    body = `Recorda comprar el bitllet. El grup et farà el Bizum (${(others||[]).join(', ')}).`;
  } else {
    title = `💸 Bizum a ${payerName}`;
    body = `Aquesta setmana juga ${payerName}. Recorda fer-li el Bizum.`;
  }

  await self.registration.showNotification(title, {
    body, tag: 'lotogrupo-weekly', renotify: false, requireInteraction: false,
  });
  await setStore('last_notif_sent', todayStr);
}

function openDB(){
  return new Promise((res, rej) => {
    const req = indexedDB.open('lotogrupo-sw', 1);
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
