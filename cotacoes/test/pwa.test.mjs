// O app instalável depende destes arquivos: se um sumir ou o manifesto quebrar, o deploy para.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const pub = (f) => new URL(`../public/${f}`, import.meta.url)

test('manifesto: campos exigidos para instalar e ícones existentes', () => {
  const m = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8'))
  assert.equal(m.display, 'standalone')
  assert.ok(m.name && m.short_name && m.start_url && m.scope)
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i)
  const sizes = m.icons.map((i) => i.sizes)
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'))
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'))
  for (const i of m.icons) assert.ok(existsSync(pub(i.src)), `ícone ausente: ${i.src}`)
  assert.ok(existsSync(pub('apple-touch-icon.png')))
})

test('index.html liga o manifesto e o ícone do iOS por caminho relativo', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/)
  assert.match(html, /rel="apple-touch-icon" href="\.\/apple-touch-icon\.png"/)
  assert.match(html, /name="theme-color"/)
})

test('service worker: não intercepta outros domínios nem métodos que não sejam GET', () => {
  const sw = readFileSync(pub('sw.js'), 'utf8')
  assert.match(sw, /req\.method !== 'GET'\) return/)
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/)
})

import { readFileSync as rf } from 'node:fs'
import { isWeekendBR } from '../src/market.js'
test('coleta automática só de segunda a sexta (horário de Brasília) e app reconhece o fim de semana', () => {
  for (const f of ['pages.yml', 'quotes.yml']) {
    const crons = [...rf(new URL(`../../.github/workflows/${f}`, import.meta.url), 'utf8').matchAll(/- cron: '([^']+)'/g)].map((m) => m[1])
    assert.ok(crons.length >= 1)
    for (const c of crons) {
      if (f === 'pages.yml' && c === '0 11,18 * * *') continue // RSS de Trends tem agenda diária própria
      assert.notEqual(c.split(' ')[4], '*', `${f}: o agendamento "${c}" roda no fim de semana`)
    }
  }
  // sexta 21h (Brasília) = sábado 00h UTC: ainda sexta; sábado e domingo ao meio-dia: fim de semana
  assert.equal(isWeekendBR(Date.parse('2026-10-10T15:00:00Z')), true) // sábado
  assert.equal(isWeekendBR(Date.parse('2026-10-11T15:00:00Z')), true) // domingo
  assert.equal(isWeekendBR(Date.parse('2026-10-10T01:00:00Z')), false) // sexta 22h em Brasília
  assert.equal(isWeekendBR(Date.parse('2026-10-12T12:00:00Z')), false) // segunda
})

// expande um campo de cron (minuto ou hora): n, a-b, */s, a-b/s
const field = (f, min, max) => {
  const out = []
  for (const part of f.split(',')) {
    const [range, step = '1'] = part.split('/')
    const [a, b] = range === '*' ? [min, max] : range.includes('-') ? range.split('-').map(Number) : [Number(range), step === '1' ? Number(range) : max]
    for (let v = a; v <= b; v += Number(step)) out.push(v)
  }
  return out
}
test('coleta de 5 em 5 minutos só entre 9h05 e 18h de Brasília (12h05 a 21h00 UTC)', () => {
  // No pregão, cada execução fica ligada e coleta a cada 5 min pelo relógio (o agendamento do GitHub não garante a frequência).
  const yml = rf(new URL('../../.github/workflows/quotes.yml', import.meta.url), 'utf8')
  const crons = [...yml.matchAll(/- cron: '([^']+)'/g)].map((m) => m[1])
  const fixed = crons.filter((c) => /^\d+ \d+ /.test(c)) // partidas do pregão: minuto e hora únicos
  const starts = fixed.map((c) => { const [m, h] = c.split(' ').map(Number); return h * 60 + m })
  assert.ok(starts.length >= 2, 'pelo menos duas partidas (uma de reserva)')
  assert.ok(Math.min(...starts) === 12 * 60 + 5, 'primeira partida até a abertura (9h05)')
  assert.ok(Math.max(...starts) < 21 * 60)
  // janela do laço e cadência de 5 min no próprio script
  assert.match(yml, /\[ "\$hm" -ge 1205 \] && \[ "\$hm" -le 2100 \]/)
  assert.match(yml, /sleep \$\(\(300 - \$\(date \+%s\) % 300 \+ 5\)\)/)
  const deadline = Number(yml.match(/deadline=\$\(\(start \+ (\d+) \* 60\)\)/)[1])
  const timeout = Number(yml.match(/timeout-minutes: (\d+)/)[1])
  assert.ok(deadline + 5 < timeout && timeout <= 360, 'o laço termina antes do limite do job')
  assert.match(yml, /cancel-in-progress: false/) // a partida seguinte espera na fila
  // coletas horárias (faixas de horas) ficam fora do pregão
  for (const c of crons.filter((x) => !fixed.includes(x))) {
    const [m, h] = c.split(' ')
    for (const hh of field(h, 0, 23)) for (const mm of field(m, 0, 59)) assert.ok(hh * 60 + mm < 12 * 60 + 5 || hh * 60 + mm > 21 * 60, `coleta horária ${c} dentro da janela`)
  }
})
