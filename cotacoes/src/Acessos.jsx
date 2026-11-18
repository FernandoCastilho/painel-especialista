import ChartComparison from './ChartComparison.jsx'
import { useEffect, useRef, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import { SITE_HOST } from './acessos.js'
import { Panel } from './TerminalDesk.jsx'

// Acessos ao app (Umami): selo "online" no topo e quadro em Configurações. Os números vêm de acessos.json, gerado de hora em
// hora pela coleta (link de compartilhamento do Umami); "online" é quem estava com o app aberto na última leitura.
export const UMAMI_SHARE_URL = 'https://cloud.umami.is/share/9glfHXZ6e2nYNmNj'
const hm = (t) => new Date(t).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const n = (v) => (Number.isFinite(v) ? v.toLocaleString('pt-BR') : '—')
const valido = (d) => d && Number.isFinite(d.generatedAt) && Date.now() - d.generatedAt < 6 * 3600e3

// "Online" ao vivo: o navegador lê o Umami a cada 1 min (link de compartilhamento). Se a rede bloquear ou o Umami recusar,
// fica com a leitura de hora em hora do acessos.json. Só no site publicado e com a aba visível.
const SHARE = '9glfHXZ6e2nYNmNj'
let API = null // prefixo da API descoberto pela coleta (acessos.json → api)
let share = null
async function lerAoVivo() {
  if (!API) throw new Error('API do Umami ainda não descoberta')
  share = share ?? await fetch(`${API}/share/${SHARE}`, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
  const r = await fetch(`${API}/websites/${share.websiteId}/active`, { headers: { 'x-umami-share-token': share.token, 'x-umami-share-context': '1' }, signal: AbortSignal.timeout(8000) })
  if (!r.ok) { share = null; throw new Error(r.status) }
  const j = await r.json()
  const v = Array.isArray(j) ? j[0]?.x ?? j[0]?.visitors : j?.visitors ?? j?.x ?? j?.active
  if (!Number.isFinite(Number(v))) throw new Error('sem número')
  return Number(v)
}
let vivo = { online: null, at: 0 }
const ouvintes = new Set()
let timer = null
function iniciarVivo() {
  if (timer || typeof window === 'undefined' || window.location.hostname !== SITE_HOST || navigator.webdriver) return
  const tick = async () => {
    if (document.visibilityState !== 'visible') return
    try { vivo = { online: await lerAoVivo(), at: Date.now() } } catch { vivo = { online: null, at: 0 } }
    ouvintes.forEach((f) => f(vivo))
  }
  tick(); timer = setInterval(tick, 60000)
}
export function useOnline() {
  const { data } = useDataFile('acessos.json')
  const [v, setV] = useState(vivo)
  if (data?.api && /^https:\/\/[a-z.]*umami\.is\//.test(data.api)) API = data.api
  useEffect(() => { ouvintes.add(setV); iniciarVivo(); return () => ouvintes.delete(setV) }, [])
  if (Number.isFinite(v.online) && Date.now() - v.at < 3 * 60000) return { online: v.online, at: v.at, aoVivo: true, data }
  if (valido(data) && Number.isFinite(data.online)) return { online: data.online, at: data.generatedAt, aoVivo: false, data }
  return { online: null, data }
}

// Selo "● N online" ao lado do relógio; ao clicar, abre um balão com online agora, hoje e últimos 7 dias.
export function OnlineBadge() {
  const { online, at, aoVivo, data } = useOnline()
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (!ref.current?.contains(e.target)) setAberto(false) }
    const esc = (e) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('pointerdown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])
  if (!Number.isFinite(online)) return null
  return (
    <span className="online-wrap" ref={ref}>
      <button type="button" className="online-badge" aria-expanded={aberto} aria-controls="online-pop" onClick={() => setAberto((v) => !v)} aria-label={`${online} online agora; ver acessos ao app`} title={`${n(online)} online agora`}>
        <span className="online-dot" aria-hidden="true" />{n(online)}<span className="online-txt"> online</span>
      </button>
      {aberto && (
        <div id="online-pop" className="online-pop" role="dialog" aria-label="Acessos ao app">
          <div><small>Online agora</small><b><span className="online-dot" aria-hidden="true" />{n(online)}</b><small>{aoVivo ? `ao vivo · ${hm(at)}` : `na leitura das ${hm(at)}`}</small></div>
          <div><small>Hoje</small><b>{n(data?.hoje?.visitantes)}</b><small>visitantes · {n(data?.hoje?.views)} visualizações</small></div>
          <div><small>Últimos 7 dias</small><b>{n(data?.semana?.visitantes)}</b><small>visitantes · {n(data?.semana?.views)} visualizações</small></div>
          <p>Contagem anônima, sem cookies. <a href={UMAMI_SHARE_URL} target="_blank" rel="noreferrer">Detalhes no Umami ↗</a></p>
        </div>
      )}
    </span>
  )
}

export function AcessosPanel() {
  const file = useDataFile('acessos.json')
  const d = file.data
  const agora = useOnline()
  const dias = (d?.dias ?? []).slice(-30)
  const max = Math.max(1, ...dias.map((x) => x.visitantes ?? 0))
  return (
    <Panel title="Acessos ao app" note="contagem anônima (Umami); online ao vivo quando a rede permite, senão de hora em hora" className="config-wide acessos" refresh={['acessos.json']}>
      <div id="acessos" />
      {!d && <p className="status">{file.status === 'loading' ? 'Carregando os acessos…' : 'Acessos indisponíveis no momento.'}</p>}
      {d && (
        <>
          <div className="acessos-kpis">
            <div><small>Online agora</small><b><span className="online-dot" aria-hidden="true" />{n(agora.online ?? d.online)}</b><small>{agora.aoVivo ? `ao vivo · ${hm(agora.at)}` : `na leitura das ${hm(d.generatedAt)}`}</small></div>
            <div><small>Hoje</small><b>{n(d.hoje?.visitantes)}</b><small>visitantes · {n(d.hoje?.views)} visualizações</small></div>
            <div><small>Últimos 7 dias</small><b>{n(d.semana?.visitantes)}</b><small>visitantes · {n(d.semana?.views)} visualizações</small></div>
          </div>
          {dias.length > 0 && (
            <ChartComparison html categorical margin={{l:0,r:0,t:0,b:0}} frequency="day" series={[{key:'visitors',name:'Visitantes',points:dias.map(x=>({t:Date.parse(x.d+'T12:00:00Z'),v:x.visitantes}))}]} history={[{key:'visitors',points:(d.dias || []).map(x=>({t:Date.parse(x.d+'T12:00:00Z'),v:x.visitantes}))}]}><div data-comparison-plot className="acessos-dias" role="img" aria-label={`Visitantes por dia nos últimos ${dias.length} dias`}>
              {dias.map((x) => (
                <span key={x.d} className="acessos-dia" title={`${x.d.split('-').reverse().join('/')}: ${n(x.visitantes)} visitantes, ${n(x.views)} visualizações`}>
                  <i style={{ height: `${Math.max(3, ((x.visitantes ?? 0) / max) * 100)}%` }} />
                  <small>{x.d.slice(8)}</small>
                </span>
              ))}
            </div></ChartComparison>
          )}
          {d.stale && <p className="status stale">Última leitura falhou; mostrando os números anteriores.</p>}
          <p className="muted acessos-nota">Contagem anônima, sem cookies e sem dado pessoal. Acessos de redes que bloqueiam o contador não entram. <a href={UMAMI_SHARE_URL} target="_blank" rel="noreferrer">Ver detalhes no Umami ↗</a></p>
        </>
      )}
    </Panel>
  )
}
