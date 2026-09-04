// Service Worker بسيط لنظام إدارة المعدات
// الهدف: (1) تفعيل شرط "قابلية التثبيت" في المتصفح، (2) تخزين نسخة احتياطية من الصفحة نفسها عشان تفتح حتى لو النت مقطوع.
// ملحوظة: البيانات الحية (Firebase) ليها آلية أوفلاين خاصة بيها جوه التطبيق، فالـ Service Worker ده متعمّد إنه بسيط
// ومايتدخلش في تخزين استعلامات الـ API عشان مايسببش بيانات قديمة تتعرض غلط.

var CACHE_NAME = 'hacpmv-shell-v1';
var SHELL_URL = './index.html';

self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll([SHELL_URL]).catch(function() {
                // لو فشل التخزين المبدئي (مثلاً أول تحميل من غير نت)، منسيبش التثبيت كله يفشل
            });
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) { return key !== CACHE_NAME; })
                    .map(function(key) { return caches.delete(key); })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function(event) {
    var req = event.request;

    // بس نتعامل مع طلبات فتح الصفحة نفسها (navigation) — أي حاجة تانية (Firebase، خرائط، إلخ) تعدي عادي من غير تدخل
    if (req.mode !== 'navigate') return;

    event.respondWith(
        fetch(req).then(function(response) {
            // نجحنا في الاتصال بالنت: نحدّث النسخة المخزنة بأحدث نسخة من الصفحة
            var responseCopy = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(SHELL_URL, responseCopy); });
            return response;
        }).catch(function() {
            // مفيش نت: نرجّع آخر نسخة مخزنة من الصفحة بدل ما تفضل شاشة بيضا
            return caches.match(SHELL_URL);
        })
    );
});
