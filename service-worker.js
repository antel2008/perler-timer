const CACHE_NAME = 'perler-timer-v1.0';
const urlsToCache = [
    './',
    './index.html',
    './timer.html',
    './inventory.html',
    './expense.html',
    './settlement.html',
    './settings.html',
    './revenue-expense.html',
    './styles.css',
    './color-styles.css',
    './bead-data.js',
    './common.js',
    './csv-export.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
    // 强制激活新的 service worker
    self.skipWaiting();
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // 对于 HTML 页面，使用网络优先策略以确保获取最新内容
                if (event.request.mode === 'navigate') {
                    return fetch(event.request)
                        .catch(function() {
                            return caches.match(event.request);
                        });
                }

                // 对于其他资源，使用缓存优先策略
                if (response) {
                    return response;
                }

                // 尝试从网络获取
                return fetch(event.request)
                    .then(function(networkResponse) {
                        // 缓存新的响应
                        return caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, networkResponse.clone());
                                return networkResponse;
                            });
                    })
                    .catch(function() {
                        return response;
                    });
            })
    );
});

self.addEventListener('activate', function(event) {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            // 立即控制所有客户端
            return self.clients.claim();
        })
    );
});