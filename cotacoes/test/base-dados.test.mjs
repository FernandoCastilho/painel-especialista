import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { BASE_DADOS, ARQUIVOS_COBERTOS, ATRIBUICOES } from '../src/baseDados.js'
import { FONTES } from '../src/governanca.js'

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')

test('base de dados: toda referência traz quem publica, endereço, série, arquivo e coleta', () => {
  assert.ok(BASE_DADOS.length >= 6)
  const nomes = new Set()
  for (const g of BASE_DADOS) {
    assert.ok(g.grupo && g.itens.length, g.grupo)
    for (const i of g.itens) {
      for (const k of ['nome', 'orgao', 'api', 'pagina', 'arquivo', 'serie', 'freq']) assert.ok(typeof i[k] === 'string' && i[k].length >= 2, `${i.nome}: ${k}`)
      assert.match(i.pagina, /^https:\/\//, `${i.nome}: página pública`)
      assert.ok(!nomes.has(i.nome), `nome repetido: ${i.nome}`); nomes.add(i.nome)
    }
  }
})
test('base de dados: todo arquivo de dados publicado ou lido pelo app tem referência', () => {
  const publicados = new Set()
  for (const f of ['pages.yml', 'quotes.yml']) for (const m of readFileSync(new URL(`../../.github/workflows/${f}`, import.meta.url), 'utf8').matchAll(/([a-z-]+\.json)/g)) publicados.add(m[1])
  for (const f of readdirSync(new URL('../scripts/', import.meta.url)).filter((x) => /^fetch-.*\.mjs$/.test(x))) for (const m of readFileSync(new URL(`../scripts/${f}`, import.meta.url), 'utf8').matchAll(/public\/([a-z-]+\.json)/g)) publicados.add(m[1])
  for (const f of readdirSync(new URL('../src/', import.meta.url)).filter((x) => /\.(js|jsx)$/.test(x))) for (const m of src(f).matchAll(/(?:useDataFile|loadDataFile)\('([a-z-]+\.json)'/g)) publicados.add(m[1])
  const faltam = [...publicados].filter((a) => !ARQUIVOS_COBERTOS.includes(a) && !['package.json', 'package-lock.json', 'manifest.json', 'tsconfig.json', 'stale.json', 'validation.json', 'weekly-data-snapshot.json'].includes(a))
  assert.deepEqual(faltam, [], `arquivos sem linha na Base de dados: ${faltam.join(', ')}`)
})
test('base de dados: todas as fontes da governança aparecem na Base de dados', () => {
  const arquivos = new Set(ARQUIVOS_COBERTOS)
  for (const f of FONTES) assert.ok(f.chaves.length && f.origem, f.id)
  assert.ok(['macro.json', 'curves.json', 'oil.json', 'fuels.json', 'commodities-brl.json', 'estr.json', 'euro-curve.json'].every((a) => arquivos.has(a)))
  assert.ok(ATRIBUICOES.some((a) => /BLS/.test(a.fonte)) && ATRIBUICOES.every((a) => a.texto.length > 30))
})
test('fontes detalhadas ficam na Base de dados, com exceções contextuais de Atividade e conteúdo setorial', () => {
  // Preserva a conferência contextual C04 e as atribuições editoriais setoriais,
  // inclusive o estudo com fontes e períodos junto aos gráficos.
  const permitidos = new Set(['Config.jsx', 'BaseDados.jsx', 'Novidades.jsx', 'SectorProfile.jsx', 'SectorStudy.jsx', 'ResearchedSectorStudy.jsx', 'SectorNews.jsx', 'GoogleTrends.jsx'])
  for (const f of readdirSync(new URL('../src/', import.meta.url)).filter((x) => x.endsWith('.jsx') && !permitidos.has(x))) {
    const raw = src(f)
    // C04 exige fonte e data da conferência perto do indicador. Mantém a regra
    // anterior no restante da tela e evita transformar todo painel em referências.
    let t = f === 'MarketContext.jsx' ? raw.replace(/<details><summary>Fontes e conferência dos indicadores<\/summary>[\s\S]*?<\/details>/, '') : raw
    // São acessos de produto solicitados, não uma repetição do catálogo de fontes.
    if (f === 'Bndes.jsx') t = t.replace(/<nav className="bn-official-links"[\s\S]*?<\/nav>/, '')
    // As duas conferências de crédito mantêm somente as normas do próprio cálculo
    // no bloco recolhido de limites; não liberam links avulsos no resto do painel.
    if (['BndesCreditoTfb.jsx', 'BndesTlpExigivel.jsx'].includes(f)) t = t.replace(/<details className="bndes-limits">[\s\S]*?<\/details>/, '')
    // Política do processador de sugestões precisa estar junto do ato de envio.
    if (f === 'FeedbackMascot.jsx') t = t.replace(/<p className="feedback-provider">[\s\S]*?<\/p>/, '')
    // A apresentação para cliente preserva as referências do cálculo apenas
    // no slide obrigatório de premissas, sem liberar catálogo no restante da UI.
    if (f === 'BndesPresentation.jsx') t = t.replace(/<section className="bnp-references">[\s\S]*?<\/section>/, '')
    // O PDF autônomo solicitado precisa levar consigo as referências do cálculo.
    if (f === 'BndesPrint.jsx') t = t.replace(/<p className="bnprint-sources">[\s\S]*?<\/p>/, '')
    assert.doesNotMatch(t, /Fontes?: /, `${f}: texto "Fonte:" em painel`)
    assert.doesNotMatch(t, /href="https?:\/\/(?!wa\.me)/, `${f}: link externo fixo em painel`)
    assert.doesNotMatch(t, /\{[^}]*sourceName[^}]*\}\s*[·<]/, `${f}: nome da fonte exibido`)
  }
})
test('o botão de atualizar mostra a data e a hora da última atualização do painel', () => {
  const t = src('RefreshButton.jsx')
  assert.ok(t.includes('useCollectedAt') && t.includes('Atualizado em'))
  assert.ok(src('Config.jsx').includes('<BaseDados />'))
})
