// 라임 스캐너 — 서비스 워커 (홈 화면 앱 + 오프라인)
// 배포할 때마다 VERSION 을 올리면(js/app.js 의 VERSION 과 같게) 새 캐시로 교체된다.
// 사전 JSON 은 DATA_VERSION 이 바뀔 때만 다시 받는다.
const VERSION = 'v1.2.1';
const DATA_VERSION = 'd1';
const APP_CACHE = `rhyme-app-${VERSION}`;
const DATA_CACHE = `rhyme-data-${DATA_VERSION}`;
const PAGE_CACHE = 'rhyme-pages';

const APP_FILES = [
  './', 'index.html', 'css/style.css', 'css/guide.css',
  'js/app.js', 'js/pronounce.js', 'js/rhyme.js', 'js/render.js', 'js/recommend.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];
const DATA_FILES = ['data/ko-words.json', 'data/en-words.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    // 앱 파일은 HTTP 캐시를 건너뛰고 새로 받는다 (버전이 섞이지 않게)
    await app.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })));
    const data = await caches.open(DATA_CACHE);
    for (const u of DATA_FILES) {
      if (!(await data.match(u))) {
        // 첫 접속 때 페이지가 이미 받은 사전은 HTTP 캐시 재검증(304)으로 재사용
        const res = await fetch(new Request(u, { cache: 'no-cache' }));
        if (res.ok) await data.put(u, res);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('rhyme-') && k !== APP_CACHE && k !== DATA_CACHE && k !== PAGE_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
    for (const c of await self.clients.matchAll()) c.postMessage({ type: 'cached', version: VERSION });
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 페이지 이동
  if (req.mode === 'navigate') {
    const scope = new URL(self.registration.scope).pathname;
    const rel = url.pathname.startsWith(scope) ? url.pathname.slice(scope.length) : url.pathname;
    // 분석기 첫 화면: 캐시된 index.html (오프라인에서도 실행)
    if (rel === '' || rel === 'index.html') {
      event.respondWith((async () => {
        const cache = await caches.open(APP_CACHE);
        const hit = await cache.match('index.html') || await cache.match('./');
        if (hit) return hit;
        return fetch(req);
      })());
      return;
    }
    // 가이드·안내 페이지: 네트워크 우선, 오프라인이면 전에 본 사본
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const app = await caches.open(APP_CACHE);
        return (await app.match('index.html')) || new Response('오프라인 상태입니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }
  const isData = url.pathname.includes('/data/');
  event.respondWith((async () => {
    const cache = await caches.open(isData ? DATA_CACHE : APP_CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && (isData || APP_FILES.some(f => url.pathname.endsWith('/' + f) || f === url.pathname))) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('오프라인 상태이며 캐시에 없는 파일입니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
