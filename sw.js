// ==================== SERVICE WORKER ====================
// Версия кэша — меняй при каждом обновлении сайта
const CACHE_VERSION = 'printsoft-v1';
const CACHE_NAME = `${CACHE_VERSION}-static`;

// Что кэшируем сразу при установке
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

// Установка — кэшируем статику
self.addEventListener('install', (event) => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Не всё удалось закэшировать:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Firebase — не кэшируем, всегда из сети
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Только GET-запросы кэшируем
  if (event.request.method !== 'GET') return;

  // Стратегия: сначала сеть, потом кэш
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Успешный ответ — сохраняем в кэш
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Нет сети — берём из кэша
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Если запрос — навигация (HTML), отдаём index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Офлайн', { status: 503 });
        });
      })
  );
});

// Push-уведомления
self.addEventListener('push', (event) => {
  let data = { title: 'PRINT SOFT', body: 'Новое уведомление' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PRINT SOFT', options)
  );
});

// Клик по уведомлению — открываем сайт
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
