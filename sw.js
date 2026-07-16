// ============================
// Service Worker - EMS App
// ============================
const CACHE_NAME = 'ems-cache-v1';

// الملفات التي تُحفظ للعمل بدون إنترنت
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
    'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
];

// ============================
// التثبيت: تخزين الملفات
// ============================
self.addEventListener('install', function(event) {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            console.log('[SW] Caching static assets');
            // نحاول نخزن كل ملف بشكل منفصل حتى لو فشل أحدهم
            return Promise.allSettled(
                STATIC_ASSETS.map(function(url) {
                    return cache.add(url).catch(function(err) {
                        console.warn('[SW] Failed to cache:', url, err);
                    });
                })
            );
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// ============================
// التفعيل: تنظيف الكاش القديم
// ============================
self.addEventListener('activate', function(event) {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME;
                }).map(function(key) {
                    console.log('[SW] Deleting old cache:', key);
                    return caches.delete(key);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ============================
// الاعتراض: التعامل مع الطلبات
// ============================
self.addEventListener('fetch', function(event) {
    var url = new URL(event.request.url);

    // Firebase والـ APIs: دائماً من الإنترنت (Network First)
    if (
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('firebase.google.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebaseapp.com') ||
        event.request.method !== 'GET'
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // باقي الملفات: Cache First ثم Network
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            if (cached) {
                // إرجاع النسخة المحفوظة فوراً + تحديث في الخلفية
                var fetchPromise = fetch(event.request).then(function(response) {
                    if (response && response.status === 200 && response.type !== 'opaque') {
                        var responseClone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                }).catch(function() {});
                return cached;
            }

            // ملف جديد: جلبه من الشبكة وتخزينه
            return fetch(event.request).then(function(response) {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(function() {
                // بدون إنترنت وملف مش محفوظ
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// ============================
// رسائل من التطبيق
// ============================
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(function() {
            console.log('[SW] Cache cleared');
        });
    }
});
