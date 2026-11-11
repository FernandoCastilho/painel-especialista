import assert from 'node:assert/strict'
import test from 'node:test'
import { sacaEmReais, galaoParaLitro, CONCEITOS, CONEXAO, LIGACOES, TOPICOS, conexoesDe, breakFunding, buscarConceitos, cupomCambial, indiceSubordinacao, inflacaoAcumulada, jurosNoPrazo, juroReal, perdaNasCotas, porTopico, taxaCdiMaisSpread, custoMedio, diferencialDeJuros, dolarDeEquilibrio, jurosAnuais, jurosDeUmDia, premioCds, valorAMercado, valorNaCurva, cetParcelaUnica } from '../src/educacao.js'
import { DESK_TABS, parseCommand } from '../src/terminal.js'

const byId = (id) => CONCEITOS.find((c) => c.id === id)
const text = (c) => JSON.stringify(c)

test('CET: exemplo anual usa o líquido recebido e mantém separada a taxa contratual', () => {
  const cet = cetParcelaUnica({ liquido: 9700, pagamento: 11000, dias: 365 })
  assert.ok(Math.abs(cet - 0.134020618556701) < 1e-12)
  assert.ok(Math.abs(cetParcelaUnica({ liquido: 10000, pagamento: 11000, dias: 365 }) - 0.1) < 1e-12)
  assert.equal(cetParcelaUnica({ liquido: 10000, pagamento: 10000, dias: 365 }), 0)
  assert.ok(cet > 0.1)
  assert.match(text(byId('cet').exemplo), /9\.700/)
  assert.match(text(byId('cet').exemplo), /13,40%/)
  assert.match(text(byId('cet').exemplo), /10,00%/)
  assert.match(text(byId('cet').exemplo), /valores fictícios, não alíquotas/)
})

test('CET: material explica método, encargos, âmbito e exceções com fonte primária', () => {
  const c = byId('cet'), body = text(c)
  assert.equal(c.topico, 'Operações de crédito')
  assert.equal(c.revisadoEm, '2026-11-06')
  assert.ok(c.fontes.some(f => f.url === 'https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf'))
  assert.match(body, /dias corridos e base fixa de 365 dias/)
  assert.match(c.preciso.formula, /dj − d0.*365/)
  assert.match(c.preciso.texto, /taxas flutuantes e índices de preços não entram no CET regulatório/)
  assert.match(c.preciso.texto, /informados separadamente/)
  assert.match(body, /inclusive serviços de terceiros/)
  assert.match(body, /Não desconte o mesmo IOF/)
  assert.match(c.ajuda.join(' '), /pessoas físicas.*empresários individuais.*ME e EPP/)
  assert.match(c.ajuda.join(' '), /repasses de recursos externos e crédito rural/)
  assert.match(c.ajuda.join(' '), /30 dias e limite pactuado/)
  assert.ok(buscarConceitos('CET').some(x => x.id === 'cet'))
  assert.ok(buscarConceitos('custo efetivo total').some(x => x.id === 'cet'))
  assert.doesNotMatch(body, /20,01|20,16|TFB/)
})

test('dividendos: fonte oficial usa o PDF existente conferido em 06/11/2026', () => {
  assert.ok(byId('dividendos').fontes.some(f => f.url === 'https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirf/manual_padrao_rfb_per_tributacao_cotin_v-19-12-2025.pdf'))
})

test('escala 6x1: medidas para MEI e pequenas empresas preservam os prazos gerais', () => {
  assert.match(text(byId('escala-6x1')), /Lei complementar poderá criar medidas transitórias para MEI/)
  assert.match(text(byId('escala-6x1')), /condicionadas à manutenção do emprego/)
  assert.match(text(byId('escala-6x1')), /não suspende os prazos da emenda/)
})

test('novos temas têm fontes oficiais, data de revisão e exemplos que não se passam por alíquotas gerais', () => {
  for (const id of ['escala-6x1', 'reforma-tributaria', 'split-payment', 'dividendos']) {
    const c = byId(id)
    assert.equal(c.topico, 'Tributos e trabalho')
    assert.equal(c.revisadoEm, ['escala-6x1', 'dividendos'].includes(id) ? '2026-11-06' : '2026-11-05')
    assert.ok(c.fontes.length >= 2, id)
    assert.ok(c.fontes.every(f => /\.(gov|leg)\.br$/.test(new URL(f.url).hostname)), id)
    assert.ok(buscarConceitos(c.nome).some(result => result.id === id), id)
  }
  assert.match(text(byId('escala-6x1')), /EC 141/)
  assert.match(text(byId('escala-6x1')), /primeira etapa ainda não começou/)
  assert.match(text(byId('escala-6x1')), /Dois meses após/)
  assert.match(text(byId('escala-6x1')), /contratos públicos/)
  assert.match(text(byId('reforma-tributaria')), /0,9%.*0,1%/)
  assert.match(text(byId('reforma-tributaria')), /dispensa de recolhimento/)
  assert.match(text(byId('reforma-tributaria').exemplo), /não representam uma alíquota oficial/)
  assert.match(text(byId('split-payment')), /testes de integração/)
  assert.match(text(byId('split-payment')), /sem processamento definitivo de operações reais/)
  assert.match(text(byId('split-payment').exemplo), /não uma alíquota oficial/)
  assert.match(text(byId('dividendos')), /sobre o total, não só sobre o excesso/)
  assert.match(text(byId('dividendos').exemplo), /R\$ 6\.000/)
  assert.match(text(byId('dividendos').exemplo), /R\$ 54\.000/)
  assert.match(text(byId('dividendos')), /não garante isenção anual/)
})

test('os conceitos pedidos existem, com ids únicos', () => {
  assert.deepEqual(CONCEITOS.map((c) => c.id), ['juros-forcados', 'marcacao-a-mercado', 'diferencial-de-juros', 'cupom-cambial', 'sofr', 'euribor', 'custo-de-funding', 'fee-de-estruturacao', 'cet', 'fgi-peac', 'liquidacao-antecipada', 'cds', 'debenture', 'nota-comercial', 'fidc', 'cri', 'cra', 'facil', 'drawback', 'lei-de-maquila', 'imposto-seletivo', 'inflacao', 'focus', 'commodities-e-cambio', 'ic-br', 'combustiveis', 'escala-6x1', 'substituicao-tributaria', 'reforma-tributaria', 'split-payment', 'dividendos'])
  assert.equal(new Set(CONCEITOS.map((c) => c.id)).size, CONCEITOS.length)
})

test('cada conceito traz frase, explicação simples, lacunas, versão precisa, exemplo e teste', () => {
  for (const c of CONCEITOS) {
    assert.ok(c.frase.length > 30, c.id)
    assert.ok(c.crianca.length >= 2 && c.crianca.every((p) => p.length > 40), c.id)
    assert.ok(c.analogia.length > 20, c.id)
    assert.ok(c.lacunas.length >= 2, c.id)
    assert.ok(c.preciso.texto.length > 40 && c.preciso.formula.length > 5, c.id)
    assert.ok(c.exemplo.passos.length >= 2 && c.exemplo.resultado.length > 10, c.id)
    assert.ok(c.noApp.texto.length > 10 && ['juros', 'cenarios', 'calculadora', 'aprender'].includes(c.noApp.tab), c.id)
    if (c.noApp.tab === 'calculadora') assert.ok(['cbs-caixa', 'finame-materiais'].includes(c.noApp.view), c.id)
    assert.ok(c.teste.pergunta.endsWith('?') && c.teste.resposta.length > 20, c.id)
  }
  assert.equal(CONEXAO.itens.length, CONCEITOS.length)
})

test('liquidação antecipada: na curva, a mercado e break funding', () => {
  const e = { principal: 1_000_000, taxa: 0.15, anosTotal: 2, anosDecorridos: 1, anosRestantes: 1, taxaMercado: 0.12 }
  assert.ok(Math.abs(valorNaCurva(e) - 1_150_000) < 1e-6)
  assert.ok(Math.abs(valorAMercado(e) - 1_180_803.5714) < 1e-3)
  assert.ok(valorAMercado(e) > valorNaCurva(e), 'mercado abaixo do contrato: paga mais que na curva')
  assert.ok(valorAMercado({ ...e, taxaMercado: 0.18 }) < valorNaCurva(e), 'mercado acima do contrato: paga menos')
  assert.equal(valorAMercado({ ...e, taxaMercado: e.taxa, anosRestantes: 1 }), valorNaCurva(e))
  const q = { captado: 1_000_000, taxaFunding: 0.13, anosDecorridos: 1, taxaReaplicacao: 0.12, anosRestantes: 1 }
  assert.ok(Math.abs(breakFunding(q) - 10_089.2857) < 1e-3)
  assert.equal(breakFunding({ ...q, taxaReaplicacao: 0.14 }), 0, 'reaplicar acima do funding não gera cobrança')
})

test('contas dos exemplos', () => {
  assert.ok(Math.abs(cupomCambial({ spot: 5, futuro: 5.5, di: 0.14 }) - 0.0363636) < 1e-6)
  assert.ok(Math.abs(cupomCambial({ spot: 5, futuro: 5.25, di: 0.14 }) - 0.0857143) < 1e-6)
  assert.ok(Math.abs(jurosDeUmDia(1_000_000, 0.043) - 119.4444) < 1e-3)
  assert.equal(jurosAnuais(200_000, 0.03, 0.01), 8000)
  assert.ok(Math.abs(custoMedio([{ valor: 60, custo: 0.14 }, { valor: 30, custo: 0.13 }, { valor: 10, custo: 0 }]) - 0.123) < 1e-12)
  assert.equal(premioCds(10_000_000, 200), 200_000)
  assert.ok(Math.abs(diferencialDeJuros(0.14, 0.04) - 0.0961538) < 1e-6)
  assert.ok(Math.abs(dolarDeEquilibrio({ spot: 5, brl: 0.14, usd: 0.04 }) - 5.480769) < 1e-6)
  assert.equal(diferencialDeJuros(0.05, 0.05), 0)
  assert.ok(Number.isNaN(custoMedio([])))
})

test('o texto exibido traz os mesmos números das contas', () => {
  assert.match(text(byId('diferencial-de-juros').exemplo), /9,62%/)
  assert.match(text(byId('diferencial-de-juros').exemplo), /5,48/)
  assert.match(text(byId('cupom-cambial').exemplo), /3,64%/)
  assert.match(text(byId('cupom-cambial').exemplo), /8,57%/)
  assert.match(text(byId('sofr').exemplo), /119,44/)
  const eur = text(byId('euribor').exemplo)
  assert.match(eur, /€ 8\.000/)
  assert.match(eur, /€ 10\.000/)
  assert.match(eur, /€ 2\.000/)
  const fund = text(byId('custo-de-funding').exemplo)
  assert.match(fund, /12,3%/)
  assert.match(fund, /5,7 p\.p\./)
  const cds = text(byId('cds').exemplo)
  assert.match(cds, /US\$ 200\.000/)
  assert.match(cds, /2,00%/)
})

test('cupom cambial: dólar futuro maior com o mesmo DI reduz o cupom (resposta do teste)', () => {
  const base = cupomCambial({ spot: 5, futuro: 5.5, di: 0.14 })
  assert.ok(cupomCambial({ spot: 5, futuro: 5.8, di: 0.14 }) < base)
  assert.match(byId('cupom-cambial').teste.resposta, /^Cai\./)
})

test('o app não afirma ter dados que não tem (Euribor e CDS)', () => {
  assert.match(byId('euribor').noApp.texto, /não exibe a Euribor/)
  assert.match(byId('cds').noApp.texto, /não exibe CDS/)
})

test('aba Aprender: comandos levam ao conceito certo e há 11 abas no terminal', () => {
  assert.deepEqual(DESK_TABS.map((t) => t.id), ['resumo', 'juros', 'cenarios', 'noticias', 'bndes', 'setores', 'bancos', 'calculadora', 'feriados', 'aprender', 'apresentar', 'config'])
  assert.deepEqual(parseCommand('cds'), { kind: 'tab', id: 'aprender', sub: 'cds' })
  assert.deepEqual(parseCommand('Cupom Cambial'), { kind: 'tab', id: 'aprender', sub: 'cupom-cambial' })
  assert.deepEqual(parseCommand('euribor'), { kind: 'tab', id: 'aprender', sub: 'euribor' })
  assert.deepEqual(parseCommand('funding'), { kind: 'tab', id: 'aprender', sub: 'custo-de-funding' })
  assert.deepEqual(parseCommand('educação'), { kind: 'tab', id: 'aprender', sub: '' })
  assert.deepEqual(parseCommand('sofr'), { kind: 'tab', id: 'juros', sub: '' })
})

test('crédito: CDI + spread compõe e os juros do prazo são compostos', () => {
  assert.ok(Math.abs(taxaCdiMaisSpread(0.14, 0.02) - 0.1628) < 1e-12)
  assert.ok(Math.abs(jurosNoPrazo({ principal: 1_000_000, taxaAnual: 0.1628, fracaoAno: 1 }) - 162_800) < 1e-6)
  const nc = jurosNoPrazo({ principal: 5_000_000, taxaAnual: taxaCdiMaisSpread(0.14, 0.03), fracaoAno: 126 / 252 })
  assert.ok(Math.abs(nc - 418_026) < 5, `nota comercial ${nc}`)
  assert.equal(jurosNoPrazo({ principal: 100, taxaAnual: 0.2, fracaoAno: 0 }), 0)
})
test('FIDC: a subordinada absorve a perda primeiro; a sênior só perde o excedente', () => {
  const f = { senior: 7_000_000, subordinada: 3_000_000 }
  assert.ok(Math.abs(indiceSubordinacao(f) - 0.3) < 1e-12)
  assert.deepEqual(perdaNasCotas({ ...f, perda: 2_000_000 }), { subordinada: 2_000_000, senior: 0 })
  assert.deepEqual(perdaNasCotas({ ...f, perda: 4_000_000 }), { subordinada: 3_000_000, senior: 1_000_000 })
  assert.deepEqual(perdaNasCotas({ ...f, perda: 99_000_000 }), { subordinada: 3_000_000, senior: 7_000_000 }, 'a sênior nunca perde mais que o que tem')
  assert.deepEqual(perdaNasCotas({ senior: 75, subordinada: 25, perda: 30 }), { subordinada: 25, senior: 5 })
})
test('inflação: acumulado é composto e juro real desconta a inflação', () => {
  assert.ok(Math.abs(inflacaoAcumulada(Array(12).fill(0.004)) - 0.04907) < 1e-5)
  assert.equal(inflacaoAcumulada([]), 0)
  assert.ok(Math.abs(juroReal(0.145, 0.0491) - 0.0914) < 1e-3)
  assert.equal(juroReal(0.1, 0.1), 0)
})
test('cada conceito pertence a um tópico existente e os tópicos agrupam sem perder conceito', () => {
  assert.ok(CONCEITOS.every((c) => TOPICOS.includes(c.topico)), 'tópico válido')
  const g = porTopico(CONCEITOS)
  assert.deepEqual(g.map((x) => x.topico), TOPICOS)
  assert.equal(g.reduce((n, x) => n + x.itens.length, 0), CONCEITOS.length)
  assert.deepEqual(g.find((x) => x.topico === 'Operações de crédito').itens.map((c) => c.id), ['fee-de-estruturacao', 'cet', 'fgi-peac', 'liquidacao-antecipada', 'debenture', 'nota-comercial', 'fidc', 'cri', 'cra', 'facil'])
  assert.deepEqual(porTopico([CONCEITOS[0]]).map((x) => x.topico), ['Juros e câmbio'], 'tópico vazio não aparece')
})
test('busca: todas as palavras, sem acento nem maiúscula, no conteúdo inteiro', () => {
  const ids = (t) => buscarConceitos(t).map((c) => c.id)
  assert.deepEqual(ids('fidc'), ['fidc', 'cra']) // o CRA cita as séries subordinadas como num FIDC
  assert.ok(ids('DEBENTURE').includes('debenture'), 'sem acento')
  assert.ok(ids('debênture').includes('debenture'), 'com acento')
  assert.ok(ids('break funding').includes('liquidacao-antecipada'))
  assert.ok(ids('recebiveis').includes('fidc'), 'termo do texto, não só do título')
  assert.ok(ids('ipca').includes('inflacao'))
  assert.deepEqual(ids('fidc debenture'), [], 'todas as palavras precisam aparecer')
  assert.equal(ids('  ').length, CONCEITOS.length, 'busca vazia mostra tudo')
  assert.deepEqual(ids('zzzxyz'), [])
})

test('mapa de conexões cobre todos os conceitos: ao criar um conceito, atualize CONEXAO e LIGACOES', () => {
  const ids = CONCEITOS.map((c) => c.id)
  assert.deepEqual(CONEXAO.itens.map((i) => i.id).sort(), [...ids].sort(), 'todo conceito tem seu papel no quadro, sem sobra')
  assert.ok(CONEXAO.itens.every((i) => i.texto.length > 20))
  assert.ok(CONEXAO.cadeia.length > 60)
  const pares = new Set()
  for (const [a, b, porque] of LIGACOES) {
    assert.ok(ids.includes(a) && ids.includes(b), `${a} ↔ ${b}: conceito inexistente`)
    assert.notEqual(a, b, 'ligação consigo mesmo')
    assert.ok(porque.length > 30, `${a} ↔ ${b}: explique a ligação`)
    const k = [a, b].sort().join('|'); assert.ok(!pares.has(k), `${k} repetida`); pares.add(k)
  }
  for (const id of ids) assert.ok(conexoesDe(id).length >= 1, `${id} sem nenhuma ligação`)
})
test('ligações valem nos dois sentidos e cada conceito aponta para si mesmo nunca', () => {
  for (const [a, b, porque] of LIGACOES) {
    assert.ok(conexoesDe(a).some((x) => x.id === b && x.porque === porque), `${a} → ${b}`)
    assert.ok(conexoesDe(b).some((x) => x.id === a && x.porque === porque), `${b} → ${a}`)
  }
  for (const c of CONCEITOS) assert.ok(conexoesDe(c.id).every((x) => x.id !== c.id))
})
test('todos os conceitos formam uma só rede de ligações', () => {
  const vistos = new Set([CONCEITOS[0].id]), fila = [CONCEITOS[0].id]
  while (fila.length) for (const x of conexoesDe(fila.shift())) if (!vistos.has(x.id)) { vistos.add(x.id); fila.push(x.id) }
  assert.equal(vistos.size, CONCEITOS.length, 'todos os conceitos formam uma só rede')
})

test('commodities: soja em R$/saca e galão em litro', () => {
  assert.ok(Math.abs(sacaEmReais(520, 5) - 156) < 1e-9)
  assert.ok(Math.abs(sacaEmReais(520, 5.5) - 171.6) < 1e-9)
  assert.ok(Math.abs(galaoParaLitro(3.78541, 5) - 5) < 1e-9)
  const byId = (id) => CONCEITOS.find((c) => c.id === id)
  assert.match(byId('commodities-e-cambio').exemplo.resultado, /10,0%/)
  assert.match(byId('ic-br').exemplo.resultado, /4,5%/)
  assert.match(byId('combustiveis').exemplo.passos.join(' '), /3,14/)
  assert.ok(['commodities-e-cambio', 'ic-br', 'combustiveis'].every((id) => byId(id).topico === 'Commodities' && byId(id).noApp.view === 'commodities'))
})

import { mensagemErro } from '../src/erro.js'
const U = '; mostrando o último valor conhecido, se houver'
test('erro para o usuário: sem texto técnico (JSON inválido, HTTP, rede)', () => {
  assert.equal(mensagemErro(new Error('Unexpected token \'<\', "<!doctype "... is not valid JSON')), 'Esses dados ainda não foram publicados ou vieram num formato inesperado' + U)
  assert.equal(mensagemErro('HTTP 404'), 'Esses dados ainda não foram publicados' + U)
  assert.equal(mensagemErro('HTTP 503'), 'A fonte das cotações está fora do ar agora' + U)
  assert.equal(mensagemErro(new TypeError('Failed to fetch')), 'Sem conexão com as cotações agora' + U)
  assert.equal(mensagemErro(''), 'Sem resposta agora' + U); assert.equal(mensagemErro(null), 'Sem resposta agora' + U)
  assert.equal(mensagemErro('algo estranho'), 'Não consegui atualizar agora' + U)
  for (const t of ['Unexpected token', 'HTTP 404', 'Failed to fetch', 'x']) assert.doesNotMatch(mensagemErro(t), /Unexpected|doctype|JSON|HTTP|fetch/i)
})

test('CRI e CRA: taxa composta, equivalente tributado e texto com os mesmos números', async () => {
  const { equivalenteTributado } = await import('../src/educacao.js')
  assert.ok(Math.abs(taxaCdiMaisSpread(0.045, 0.07) - 0.11815) < 1e-9)
  assert.ok(Math.abs(equivalenteTributado(0.11815, 0.15) - 0.139) < 1e-4)
  const cri = byId('cri'), cra = byId('cra')
  assert.match(cri.exemplo.resultado, /11,8\d%.*13,90%/)
  assert.match(cra.exemplo.passos.join(' '), /14,57%/)
  assert.match(cra.exemplo.resultado, /122% do CDI/)
  for (const c of [cri, cra]) assert.ok(conexoesDe(c.id).length >= 3, c.id)
  assert.ok(conexoesDe('cri').some((x) => x.id === 'cra'))
})

test('FÁCIL e drawback: contas do exemplo e ligações', () => {
  const facil = byId('facil'), db = byId('drawback')
  assert.match(text(facil.exemplo), /17,42%/); assert.match(text(facil.exemplo), /19,70%/); assert.match(facil.exemplo.resultado, /1\.140\.000/)
  assert.match(text(db.exemplo), /1\.080\.000/); assert.match(db.exemplo.resultado, /270\.000/)
  assert.equal(db.topico, 'Comércio exterior')
  for (const c of [facil, db]) assert.ok(conexoesDe(c.id).length >= 2, c.id)
})

test('fee flat: valor e caixa líquido do exemplo, com busca pelo conteúdo', async () => {
 const {feeEstruturacao}=await import('../src/educacao.js')
 assert.equal(feeEstruturacao(10_000_000,0.01),100_000)
 assert.equal(10_000_000-feeEstruturacao(10_000_000,0.01),9_900_000)
 assert.ok(buscarConceitos('FEE ESTRUTURACAO').some(c=>c.id==='fee-de-estruturacao'))
 assert.ok(buscarConceitos('desistencia').some(c=>c.id==='fee-de-estruturacao'))
 assert.equal(byId('fee-de-estruturacao').fontes.length,2)
})


test('marcação a mercado: descoberta, conexões, fontes e limites didáticos', () => {
  const c = byId('marcacao-a-mercado')
  assert.equal(c.topico, 'Funding e risco')
  assert.equal(c.revisadoEm, '2026-11-11')
  for (const query of ['marcacao a mercado', 'MtM', 'duration']) assert.ok(buscarConceitos(query).includes(c))
  assert.ok(conexoesDe(c.id).some(x => x.id === 'liquidacao-antecipada'))
  assert.equal(c.fontes.length, 3)
  assert.match(text(c), /não é oferta firme/)
  assert.match(text(c), /hipotéticos/)
  assert.match(text(c.exemplo), /982,14/)
  assert.match(text(c.exemplo), /1.018,52/)
  assert.match(text(c.exemplo), /1.100,00/)
  assert.match(text(c.lacunas), /Marcação, ajuste e margem não são sinônimos/)
})
