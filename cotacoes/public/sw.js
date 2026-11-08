// Service worker: abre o app sem rede (último conteúdo) e mantém os dados no cache.
// Versão do cache: troque ao mudar a estratégia; os arquivos com hash do Vite se renovam sozinhos.
const CACHE = 'cotacoes-v4'
const SHELL = ['./', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cotacoes-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Query parameters on these static JSON files only bypass HTTP caches. Keeping
// one key per file prevents unbounded versions and an arbitrary older fallback.
const cacheKey = (req) => {
  const url = new URL(req.url)
  if (/\.json$/.test(url.pathname)) url.search = ''
  return url.href
}
const match = async (req) => (await caches.open(CACHE)).match(cacheKey(req))
const put = async (req, res) => {
  if (res && res.ok) {
    try { await (await caches.open(CACHE)).put(cacheKey(req), res.clone()) } catch { /* storage failure must not discard a valid network response */ }
  }
  return res
}

// Rede primeiro, com o cache como reserva (páginas e arquivos de dados: sempre o mais novo possível).
// cache: 'no-cache' revalida no servidor: sem isso, o cache HTTP do GitHub Pages (10 min) pode entregar a página antiga logo após um deploy.
const networkFirst = async (req) => {
  try {
    const response = await fetch(req, { cache: 'no-cache' })
    if (!response.ok) return (await match(req)) ?? response
    return await put(req, response)
  } catch { return match(req) }
}

// Cache primeiro (arquivos estáticos com hash no nome).
const cacheFirst = async (req) => (await match(req)) ?? fetch(req).then((res) => put(req, res))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // APIs de cotação e outros domínios: sempre direto da rede, nunca do cache.
  if (url.origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req).then((r) => r ?? caches.match('./')))
  } else if (/\.json$/.test(url.pathname)) {
    event.respondWith(networkFirst(req))
  } else {
    event.respondWith(cacheFirst(req))
  }
})

// Alerta de variação: tocar na notificação abre (ou traz para a frente) o painel.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))))
})
