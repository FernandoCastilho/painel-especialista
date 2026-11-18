import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as ac from '../src/arvoreCredito.js'

const require = createRequire(import.meta.url)
const ids = (lista) => lista.map((o) => o.id)

test('as oito folhas confirmadas por Fernando seguem a ordem combinada em 18/11/2026', () => {
  const ordem = Object.fromEntries(ac.NECESSIDADES.filter((n) => n.confirmada).map((n) => [n.id, n.ordem.slice(0, 3)]))
  assert.deepEqual(ordem, {
    'gap-caixa': ['4131', 'finame-materiais', 'cpr'],
    'maquina-importada': ['4131', 'finimp', 'cpr'],
    'maquina-nacional': ['finame', '4131', 'giro'],
    'materia-prima-importada': ['finimp', '4131', 'giro'],
    exportacao: ['acc-ace', 'exim-pre', 'nce'],
    dividendos: ['4131', 'giro', 'giro-bndes'],
    'compra-empresa': ['4131', 'giro', 'nota-comercial'],
    'estoque-nacional': ['finame-materiais', '4131', 'cpr'],
  })
  for (const n of ac.NECESSIDADES) for (const id of n.ordem) assert.ok(ac.OPERACOES[id], `${n.id}: ${id}`)
})

test('mostra no máximo três e explica o que saiu', () => {
  const f = ac.montarFolha({ necessidade: 'gap-caixa', valor: 2_000_000, prazoMeses: 6, garantias: ['duplicatas'], cnae: '4744001' })
  assert.deepEqual(ids(f.frente), ['4131', 'conta-garantida', 'desconto'])
  assert.deepEqual(ids(f.outras), ['giro-bndes'])
  assert.deepEqual(ids(f.sairam), ['finame-materiais', 'cpr', 'giro'])
  assert.match(f.sairam[0].motivo, /notas de compra/)
  assert.match(f.sairam[1].motivo, /CNAE/)
})

test('gap de caixa: prazo acima de 12 meses tira Conta Garantida e desconto; notas e CNAE trazem Finame e CPR', () => {
  const f = ac.montarFolha({ necessidade: 'gap-caixa', valor: 3_000_000, prazoMeses: 36, receitaAnual: 40_000_000, garantias: ['duplicatas'], cnae: '1011201', notasFiname: true, notasCpr: true })
  assert.deepEqual(ids(f.frente), ['4131', 'finame-materiais', 'cpr'])
  assert.ok(f.sairam.some((o) => o.id === 'conta-garantida' && /12 meses/.test(o.motivo)))
  assert.ok(f.sairam.some((o) => o.id === 'desconto'))
})

test('CPR: microempresa sai da folha com motivo neutro, sem expor política interna', () => {
  const f = ac.montarFolha({ necessidade: 'estoque-nacional', receitaAnual: 300_000, cnae: '0115600', notasCpr: true })
  const cpr = f.sairam.find((o) => o.id === 'cpr')
  assert.match(cpr.motivo, /confirme se a instituição opera CPR/)
  assert.doesNotMatch(JSON.stringify(f), /regra do banco|prática do banco|banco trabalha com 11/)
  assert.equal(cpr.fontes.find((x) => /CNAE/.test(x.nome)).marca, 'nc')
  assert.equal(ac.porteBndes(360_000), 'micro')
  assert.equal(ac.porteBndes(360_001), 'pequena')
  assert.equal(ac.porteBndes(300_000_001), 'grande')
  assert.equal(ac.cnaeCpr('20.13-4-01'), true)
  assert.equal(ac.cnaeCpr('4744-0/01'), false)
})

test('regime tributário: aviso do NDF no Presumido e no Simples, não no Real', () => {
  const aviso = (regime) => ac.montarFolha({ necessidade: 'compra-empresa', regime, prazoMeses: 48 }).frente[0].avisosPerfil.join(' ')
  assert.match(aviso('presumido'), /Lucro Presumido, o ganho no NDF é tributado/)
  assert.match(aviso('simples'), /Simples Nacional, o ganho no NDF/)
  assert.doesNotMatch(aviso('real'), /ganho no NDF é tributado/)
  assert.match(aviso('real'), /prazo médio/)
  const curto = ac.montarFolha({ necessidade: 'materia-prima-importada', prazoMeses: 6 }).frente.find((o) => o.id === '4131')
  assert.match(curto.avisosPerfil.join(' '), /3,5% de IOF de câmbio/)
})

test('exportação: sem marcar, a necessidade já indica que exporta; debênture só para S.A.', () => {
  const exp = ac.montarFolha({ necessidade: 'exportacao' })
  assert.deepEqual(ids(exp.frente), ['acc-ace', 'exim-pre', 'nce'])
  const ltda = ac.montarFolha({ necessidade: 'compra-empresa', tipo: 'ltda' })
  assert.ok(ltda.sairam.some((o) => o.id === 'debenture' && /S\.A\./.test(o.motivo)))
  const sa = ac.montarFolha({ necessidade: 'compra-empresa', tipo: 'sa', receitaAnual: 100_000_000 })
  assert.match(sa.outras.find((o) => o.id === 'debenture').avisosPerfil.join(' '), /FÁCIL/)
})

test('dividendos: giro do BNDES entra com o aviso de finalidade combinado', () => {
  const f = ac.montarFolha({ necessidade: 'dividendos', receitaAnual: 50_000_000, valor: 5_000_000 })
  const giroBndes = f.frente.find((o) => o.id === 'giro-bndes')
  assert.match(giroBndes.avisosPerfil.join(' '), /banco repassador pode pedir informações/)
  const grande = ac.montarFolha({ necessidade: 'dividendos', receitaAnual: 400_000_000 })
  assert.ok(grande.sairam.some((o) => o.id === 'giro-bndes'))
})

test('observações do perfil: fundo regional, MG por município e cliente que exporta e importa', () => {
  assert.match(ac.montarFolha({ necessidade: 'gap-caixa', uf: 'ce' }).observacoes.join(' '), /FNE/)
  assert.match(ac.montarFolha({ necessidade: 'gap-caixa', uf: 'MG' }).observacoes.join(' '), /por município/)
  assert.match(ac.montarFolha({ necessidade: 'maquina-importada', exporta: true }).observacoes.join(' '), /exporta e importa/)
  assert.equal(ac.montarFolha({ necessidade: 'inexistente' }), null)
})

test('nenhum texto da folha traz dado do banco (custo de captação, retorno, rating)', () => {
  const texto = JSON.stringify(ac.OPERACOES, (k, v) => (typeof v === 'function' ? v.toString() : v))
  assert.doesNotMatch(texto, /capta[cç][aã]o do banco|rentabilidade|spread do banco|rating interno/i)
})

const TABELA = `Faturamento e endividamento
Competência\tFaturamento (R$ mil)\tEndividamento (R$ mil)
Dez/25\t3.900\t5.200
Jan/26\t1.800\t5.400
Fev/26\t1.500\t5.600
Mar/26\t1.700\t5.500
Abr/26\t2.400\t5.300
Mai/26\t2.600\t5.100
Jun/26\t2.500\t5.000
Jul/26\t2.700\t4.900
Ago/26\t2.900\t5.000
Set/26\t3.100\t5.100
Out/26\t3.600\t5.300
Nov/26\t3.800\t5.400`

test('tabela de faturamento: totais, meses fracos e fortes, dívida e pedido em meses', () => {
  const r = ac.analisarFaturamento(TABELA, { valorPedido: 2_600_000, dividaCurta: 2_700_000 })
  assert.equal(r.ok, true)
  assert.equal(r.fator, 1000)
  assert.equal(r.total12, 32_500_000)
  assert.ok(Math.abs(r.media - 32_500_000 / 12) < 1e-6)
  assert.deepEqual(r.fracos, ['jan/26', 'fev/26', 'mar/26'])
  assert.deepEqual(r.fortes, ['dez/25', 'out/26', 'nov/26'])
  assert.equal(r.sazonal, true)
  assert.equal(r.divida, 5_400_000)
  assert.ok(Math.abs(r.dividaEmMeses - 5_400_000 / (32_500_000 / 12)) < 1e-9)
  assert.ok(Math.abs(r.pedidoEmMeses - 2_600_000 / (32_500_000 / 12)) < 1e-9)
  assert.equal(r.curtoPrazoPct, 0.5)
  assert.equal(r.receitaAnualizada, 32_500_000)
  const semUnidade = ac.analisarFaturamento('Jan/26 100 200')
  assert.equal(semUnidade.ok, false)
  assert.equal(semUnidade.precisaUnidade, true)
  assert.equal(ac.analisarFaturamento('Jan/26 100 200', { unidade: 'R$' }).total12, 100)
})

test('CNPJ: dígitos verificadores, formato e leitura da resposta pública', () => {
  assert.equal(ac.cnpjValido('00.000.000/0001-91'), true)
  assert.equal(ac.cnpjValido('00.000.000/0001-92'), false)
  assert.equal(ac.cnpjValido('11111111111111'), false)
  assert.equal(ac.formatarCnpj('00000000000191'), '00.000.000/0001-91')
  // Resposta fictícia no formato documentado da BrasilAPI (não houve consulta real nesta sessão).
  const d = ac.lerDadosCnpj({ razao_social: 'EMPRESA EXEMPLO S.A.', municipio: 'SOROCABA', uf: 'sp', cnae_fiscal: 2813500, cnae_fiscal_descricao: 'Fabricação de válvulas', codigo_natureza_juridica: 2054, natureza_juridica: 'Sociedade Anônima Fechada', opcao_pelo_simples: false, regime_tributario: [{ ano: 2023, forma_de_tributacao: 'LUCRO PRESUMIDO' }, { ano: 2025, forma_de_tributacao: 'LUCRO REAL' }] })
  assert.equal(d.tipo, 'sa')
  assert.equal(d.regime, 'real')
  assert.equal(d.anoRegime, 2025)
  assert.equal(d.uf, 'SP')
  assert.equal(d.cnae, '2813500')
  assert.equal(ac.tipoPorNatureza(2062), 'ltda')
  assert.equal(ac.regimePorDados({ opcao_pelo_simples: true }), 'simples')
  assert.equal(ac.regimePorDados({}), '')
})

test('consulta de CNPJ: só envia CNPJ válido, só ao serviço público, e trata falhas', async () => {
  const chamadas = []
  const ok = await ac.consultarCnpj('00000000000191', { fetchFn: async (url) => { chamadas.push(url); return { ok: true, status: 200, json: async () => ({ razao_social: 'X', uf: 'DF' }) } } })
  assert.equal(ok.ok, true)
  assert.deepEqual(chamadas, ['https://brasilapi.com.br/api/cnpj/v1/00000000000191'])
  const invalido = await ac.consultarCnpj('123', { fetchFn: () => { throw new Error('não devia chamar') } })
  assert.match(invalido.erro, /inválido/)
  assert.match((await ac.consultarCnpj('00000000000191', { fetchFn: async () => ({ ok: false, status: 404 }) })).erro, /não encontrado/)
  assert.match((await ac.consultarCnpj('00000000000191', { fetchFn: async () => ({ ok: false, status: 429 }) })).erro, /código 429/)
  assert.match((await ac.consultarCnpj('00000000000191', { fetchFn: async () => { throw new Error('rede') } })).erro, /à mão/)
})

async function carregarTela() {
  const raw = (await readFile(new URL('../src/ArvoreCredito.jsx', import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
  const { code } = await transform(raw, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const mod = { exports: {} }
  const req = (n) => (n === './arvoreCredito.js' ? ac : n === './CalculatorHelp.jsx' ? { __esModule: true, default: ({ children }) => createElement('aside', null, children) } : n === './ExpandablePanel.jsx' ? { __esModule: true, default: ({ title, children }) => createElement('div', { 'data-title': title }, children) } : n === './MoneyInput.jsx' ? { __esModule: true, default: (p) => createElement('input', { id: p.id, value: p.value, readOnly: true }) } : n === './moneyInput.js' ? { parseMoneyInput: (t) => ({ ok: true, value: Number(String(t).replace(/\D/g, '')) || 0 }) } : require(n))
  runInNewContext(code, { module: mod, exports: mod.exports, require: req })
  return mod.exports
}

test('a tela abre com os três passos, o aviso de envio do CNPJ e o padrão das calculadoras', async () => {
  const tela = await carregarTela()
  const html = renderToStaticMarkup(createElement(tela.default, { onBack: () => {} }))
  assert.match(html, /1\. Quem é o cliente/)
  assert.match(html, /2\. O que ele precisa/)
  assert.match(html, /3\. Faturamento e endividamento/)
  assert.match(html, /o CNPJ é enviado à BrasilAPI, serviço público e gratuito fora do banco/)
  assert.match(html, /Folhas confirmadas/)
  assert.match(html, /Propostas, a revisar/)
  const fonte = await readFile(new URL('../src/ArvoreCredito.jsx', import.meta.url), 'utf8')
  assert.match(fonte, /import '\.\/CalculatorStandard.css'/)
  assert.match(fonte, /className="cx bw calc-standard/)
  assert.doesNotMatch(fonte, /localStorage|sessionStorage/)
  const calc = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  // Fora do menu e da busca (decisão de Fernando, 18/11/2026): só o endereço e o atalho do terminal abrem a tela.
  assert.doesNotMatch(calc, /id: 'arvore-credito'/)
  const busca = await readFile(new URL('../src/searchCatalog.js', import.meta.url), 'utf8')
  assert.doesNotMatch(busca, /arvore-credito/)
  const indice = await readFile(new URL('../scripts/build-search-index.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(indice, /ArvoreCredito/)
  const terminal = await readFile(new URL('../src/terminal.js', import.meta.url), 'utf8')
  assert.match(terminal, /ARVORE: \['calculadora', 'arvore-credito'\]/)
  assert.match(calc, /view === 'arvore-credito'\) return <ArvoreCredito onBack=\{\(\) => onView\(''\)\} onView=\{onView\} \/>/)
})
