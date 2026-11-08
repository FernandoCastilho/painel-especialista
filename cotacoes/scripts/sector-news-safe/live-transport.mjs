import { SECTOR_NEWS_SOURCES } from '../../src/sectorNews.js'
import { MAX_RESPONSE_BYTES } from '../sector-news-lib.mjs'

const transports = new WeakSet()
const candidates = new Set(['mapa', 'antt', 'mdic', 'anp', 'anm', 'ana', 'cvm', 'ans', 'ipen'])
export const LIVE_RESPONSE_BYTES = Math.min(MAX_RESPONSE_BYTES, 2_000_000)
const TIMEOUT_MS = 15_000
const USER_AGENT = 'PainelEspecialistaSectorNews/1.0 (+https://github.com/FernandoCastilho/painel-especialista)'

function allowedUrl(raw, sources) {
  if (typeof raw !== 'string' || !raw.startsWith('https://www.gov.br/') || /[%@\\\s?#]/u.test(raw)) return false
  let url
  try { url = new URL(raw) } catch { return false }
  if (url.href !== raw || url.origin !== 'https://www.gov.br' || url.username || url.password || url.port || url.search || url.hash) return false
  if (/\/(?:RSS|@@|search|login)(?:\/|$)/i.test(url.pathname)) return false
  if (raw === 'https://www.gov.br/robots.txt') return true
  return sources.some(source => raw === source.url || (raw.startsWith(source.articlePrefix) && raw.length > source.articlePrefix.length))
}

// No injected callbacks, proxy, alternate hosts, automatic redirect or retry.
// Eligibility and durable pre-request authorization remain the runner's duty.
export function createLiveTransport(options) {
  if (!options || Object.keys(options).some(key => key !== 'sourceIds')) throw new Error('explicit_live_sources_required')
  const { sourceIds } = options
  if (!Array.isArray(sourceIds) || !sourceIds.length || new Set(sourceIds).size !== sourceIds.length || sourceIds.some(id => !candidates.has(id))) throw new Error('explicit_live_sources_required')
  const sources = sourceIds.map(id => SECTOR_NEWS_SOURCES.find(source => source.id === id))
  if (sources.some(source => !source?.enabled || !source.automaticCollection || source.adapter !== 'gov-html' || source.robotsUrl !== 'https://www.gov.br/robots.txt')) throw new Error('source_not_eligible')
  const nativeFetch = globalThis.fetch
  if (typeof nativeFetch !== 'function') throw new Error('fetch_unavailable')
  const transport = Object.freeze({
    async request(url) {
      if (!allowedUrl(url, sources)) throw new Error('url_outside_approved_source')
      const controller = new AbortController()
      let reader, timer
      const timedOut = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          void reader?.cancel().catch(() => {})
          reject(new Error('request_timeout'))
        }, TIMEOUT_MS)
      })
      const read = async () => {
        const response = await nativeFetch(url, { redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: controller.signal,
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain;q=0.8' } })
        if (response.redirected || (response.url && response.url !== url)) throw new Error('redirect_requires_review')
        if (!Number.isInteger(response.status)) throw new Error('invalid_http_response')
        // Return denial/redirect unchanged so the runner durably suspends access.
        if (response.status < 200 || response.status >= 300) {
          await response.body?.cancel?.()
          return { status: response.status, body: '' }
        }
        const length = response.headers?.get?.('content-length')
        if (length !== null && length !== undefined && (!/^\d+$/.test(length) || Number(length) > LIVE_RESPONSE_BYTES)) {
          await response.body?.cancel?.()
          throw new Error('response_too_large')
        }
        if (!response.body?.getReader) throw new Error('streaming_body_required')
        reader = response.body.getReader()
        const chunks = []
        let bytes = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (!(value instanceof Uint8Array)) throw new Error('invalid_response_chunk')
          bytes += value.byteLength
          if (bytes > LIVE_RESPONSE_BYTES) { await reader.cancel(); throw new Error('response_too_large') }
          chunks.push(value)
        }
        const body = Buffer.concat(chunks, bytes).toString('utf8')
        if (Buffer.byteLength(body) > LIVE_RESPONSE_BYTES) throw new Error('response_too_large')
        return { status: response.status, body }
      }
      try { return await Promise.race([read(), timedOut]) }
      finally { clearTimeout(timer); controller.abort(); if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock() } }
    },
  })
  transports.add(transport)
  return transport
}
export const isLiveTransport = value => transports.has(value)
