import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { publicAgencySources } from '../src/sectorSourceVisibility.js'
import { TIC_STUDY } from '../src/ticStudy.js'
const source = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
test('diagrama preserva cadeia, opcionalidade e sequência de caixa aprovada', () => {
  const jsx = source('TechnologyIntegrationDiagram.jsx')
  for (const label of ['Fabricantes e plataformas', 'Distribuidores', 'quando envolvidos', 'Diagnóstico', 'Desenho', 'Aquisição e configuração', 'Implantação', 'quando contratados', 'Clientes', 'Contratação direta', 'Entrega e aceite', 'Faturamento', 'Recebimento', 'variam conforme o contrato']) assert.ok(jsx.includes(label), label)
  assert.match(jsx, /<figure[^>]+aria-labelledby=/)
  assert.match(jsx, /<figcaption/)
  assert.match(jsx, /<ol>/)
  assert.match(source('SectorStudy.jsx'), /section.id === 'negocio' && <TechnologyIntegrationDiagram/)
  assert.match(source('TechnologyIntegrationDiagram.css'), /@container\(max-width:540px\)/)
})
test('referências visíveis apenas de órgãos públicos sem apagar proveniência', () => {
  assert.deepEqual(publicAgencySources(TIC_STUDY.sources).map(s => new URL(s.url).hostname).sort(), ['www.gov.br', 'www.gov.il', 'www.ibge.gov.br'])
  assert.equal(publicAgencySources([{ url: 'https://gov.br.example.com' }, { url: 'not-url' }]).length, 0)
  assert.equal(publicAgencySources().length, 0)
  assert.ok(TIC_STUDY.charts.every(c => c.source.url))
  assert.ok(TIC_STUDY.sources.some(s => s.url.includes('brasscom')))
  for (const chart of TIC_STUDY.charts) assert.doesNotMatch(chart.method, /Brasscom|IDC|Cetic/i)
  const jsx = source('SectorStudy.jsx')
  assert.match(jsx, /publicAgencySources\(section.sources\)/)
  assert.match(source('StudyParts.jsx'), /publicAgencySources\(study.sources\)/)
  assert.match(jsx, /publicAgencySources\(\[chart.source\]\)/)
})

test('animação sem botão de pausa mantém teclado, sequência e movimento reduzido', () => {
  const jsx = source('TechnologyIntegrationDiagram.jsx')
  const css = source('TechnologyIntegrationDiagram.css')
  assert.match(jsx, /data-paused={paused}/)
  assert.match(jsx, /setPaused\(value => !value\)/)
  assert.doesNotMatch(jsx, /<button[^>]*setPaused|Pausar animação do diagrama|Retomar animação do diagrama/)
  assert.match(jsx, /aria-keyshortcuts="P"/)
  assert.match(jsx, /'--flow-step': index \+ 2/)
  assert.match(jsx, /'--flow-step': index \+ 8/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.match(css, /animation-play-state:paused/)
  assert.match(css, /animation:none/)
})

test('modo de apresentação ajusta diagrama e oferece laser opcional', () => {
  const jsx = source('TechnologyIntegrationDiagram.jsx')
  const css = source('TechnologyIntegrationDiagram.css')
  assert.match(jsx, /aria-label="Maximizar diagrama"/)
  assert.match(jsx, /role="dialog" aria-modal="true"/)
  assert.match(source('useDiagramPresentation.js'), /event.key === 'Escape'/)
  assert.match(source('useDiagramPresentation.js'), /ResizeObserver/)
  assert.match(jsx, /createPortal/)
  assert.match(jsx, /data-laser-host="true"/)
  assert.match(jsx, /className="laser-slot tic-flow-laser-slot"/)
  assert.doesNotMatch(jsx, /pointerRef|setLaser|tic-flow-laser-toggle/)
  assert.match(css, /\.tic-flow-fullscreen \.tic-flow-controls{display:none}/)
})
