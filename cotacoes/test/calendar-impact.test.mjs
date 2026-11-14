import test from 'node:test'
import assert from 'node:assert/strict'
import { explicarEvento, formatarValorCalendario, traduzirEvento, CATEGORIAS, LIGACAO_PAIS, NIVEL } from '../src/calendarImpact.js'
import { COUNTRIES } from '../src/calendar.js'
import { readFileSync } from 'node:fs'

const ev = (title, country = 'US', impact = 'high') => ({ title, country, impact })
test('classifica títulos em inglês (Forex Factory) e em português (fontes oficiais)', () => {
  const casos = [
    ['CPI m/m', 'Inflação ao consumidor'], ['Core CPI y/y', 'Inflação ao consumidor'], ['CPI: inflação ao consumidor (EUA)', 'Inflação ao consumidor'], ['IPCA (previsto)', 'Inflação ao consumidor'],
    ['PPI: inflação ao produtor (EUA)', 'Preços ao produtor e importação'], ['Non-Farm Employment Change', 'Emprego e salários'], ['Payroll e taxa de desemprego (EUA)', 'Emprego e salários'], ['Unemployment Claims', 'Emprego e salários'],
    ['Main Refinancing Rate', 'Decisão de juros'], ['FOMC: decisão de juros do Fed', 'Decisão de juros'], ['Copom: decisão da Selic', 'Decisão de juros'], ['FOMC Press Conference', 'Decisão de juros'],
    ['FOMC Meeting Minutes', 'Ata ou discurso de autoridade'], ['Fed Chair Powell Speaks', 'Ata ou discurso de autoridade'],
    ['GDP q/q', 'PIB'], ['PIB do trimestre, 1ª estimativa (EUA)', 'PIB'], ['ISM Manufacturing PMI', 'Atividade e confiança (PMI, sondagens)'], ['Caixin Manufacturing PMI', 'Atividade e confiança (PMI, sondagens)'],
    ['Retail Sales m/m', 'Consumo e produção'], ['Trade Balance', 'Comércio exterior'], ['Crude Oil Inventories', 'Petróleo e energia'], ['Building Permits', 'Mercado imobiliário'], ['30-y Bond Auction', 'Leilão de títulos'], ['Boletim Focus', 'Boletim Focus'],
  ]
  for (const [t, nome] of casos) assert.equal(explicarEvento(ev(t)).nome, nome, t)
})
test('feriado vira aviso de liquidez menor, qualquer que seja o título', () => {
  const x = explicarEvento(ev('Bank Holiday', 'US', 'holiday'))
  assert.equal(x.nome, 'Feriado bancário'); assert.match(x.economia, /liquidez/i)
  assert.equal(explicarEvento(ev('Qualquer coisa', 'JP', 'holiday')).nome, 'Feriado bancário')
})
test('evento sem categoria mapeada: impacto baixo, sem explicação inventada', () => {
  const x = explicarEvento(ev('Evento exótico sem categoria', 'AU', 'low'))
  assert.equal(x.mapeado, false); assert.equal(x.nivel, 'low'); assert.equal(x.nome, null); assert.equal(x.oque, null)
  assert.match(x.economia, /Impacto baixo/); assert.match(x.brasil, /Impacto baixo/)
  assert.equal(explicarEvento(ev('Evento exótico', 'CN', 'high')).nivelFonte, 'high', 'guarda a classificação da fonte para avisar da diferença')
})
test('todo evento mapeado traz o que é, efeito na economia e ligação com o Brasil, por país', () => {
  for (const c of CATEGORIAS) { assert.ok(c.nome.length >= 3, c.id); for (const k of ['oque', 'economia', 'brasil']) assert.ok(c[k].length > 25, `${c.id}.${k}`) }
  for (const { id } of COUNTRIES) assert.ok(LIGACAO_PAIS[id].length > 25, `país ${id} sem ligação com o Brasil`)
  const us = explicarEvento(ev('CPI m/m', 'US')), br = explicarEvento(ev('IPCA (previsto)', 'BR')), cn = explicarEvento(ev('Caixin Manufacturing PMI', 'CN', 'medium'))
  assert.match(us.brasil, /EUA/); assert.match(cn.brasil, /China/); assert.match(br.brasil, /DI/); assert.doesNotMatch(br.brasil, /EUA/)
  assert.equal(us.nivel, 'high'); assert.equal(NIVEL.medium, 'Médio')
})
test('a tela do calendário mostra o balão em cada evento', () => {
  const src = readFileSync(new URL('../src/Calendario.jsx', import.meta.url), 'utf8')
  assert.ok(src.includes('<EventHelp e={e} />') && src.includes('explicarEvento'))
})

test('nome em português dos eventos mais comuns, no formato "Nome (sigla original)"', () => {
  const casos = [
    ['GDP m/m', 'PIB, variação mensal (GDP)'], ['Prelim GDP q/q', 'PIB, prévia, variação trimestral (GDP)'], ['Flash GDP q/q', 'PIB, prévia, variação trimestral (GDP)'], ['Advance GDP q/q', 'PIB, 1ª estimativa, variação trimestral (GDP)'],
    ['CPI y/y', 'Inflação ao consumidor, variação anual (CPI)'], ['Core CPI m/m', 'Núcleo da inflação ao consumidor, variação mensal (Core CPI)'], ['CPI Flash Estimate y/y', 'Inflação ao consumidor, prévia, variação anual (CPI)'],
    ['French Final CPI m/m', 'Inflação ao consumidor da França, final, variação mensal (CPI)'], ['PPI m/m', 'Inflação ao produtor, variação mensal (PPI)'], ['Core PPI m/m', 'Núcleo da inflação ao produtor, variação mensal (Core PPI)'],
    ['German WPI m/m', 'Inflação no atacado da Alemanha, variação mensal (WPI)'], ['Unemployment Claims', 'Pedidos de seguro-desemprego'], ['Unemployment Rate', 'Taxa de desemprego'],
    ['Non-Farm Employment Change', 'Criação de empregos fora do setor agrícola, payroll (NFP)'], ['JOLTS Job Openings', 'Vagas de emprego abertas (JOLTS)'],
    ['Retail Sales m/m', 'Vendas no varejo, variação mensal'], ['Industrial Production m/m', 'Produção industrial, variação mensal'], ['ISM Manufacturing PMI', 'PMI industrial do ISM'], ['German Flash Manufacturing PMI', 'PMI industrial da Alemanha, prévia'],
    ['Trade Balance', 'Balança comercial'], ['Italian Trade Balance', 'Balança comercial da Itália'], ['CB Consumer Confidence', 'Confiança do consumidor do Conference Board (CB)'], ['Prelim UoM Consumer Sentiment', 'Confiança do consumidor de Michigan, prévia (UoM)'],
    ['Crude Oil Inventories', 'Estoques de petróleo'], ['Natural Gas Storage', 'Estoques de gás natural'], ['30-y Bond Auction', 'Leilão de títulos de 30 anos'],
    ['Federal Funds Rate', 'Decisão de juros do Fed (Federal Funds Rate)'], ['Main Refinancing Rate', 'Decisão de juros do Banco Central Europeu (ECB)'], ['Official Bank Rate', 'Decisão de juros do Banco da Inglaterra (BoE)'],
    ['FOMC Meeting Minutes', 'Ata da reunião do Fed (FOMC)'], ['ECB President Lagarde Speaks', 'Fala de Lagarde, presidente do Banco Central Europeu (ECB)'], ['FOMC Member Barr Speaks', 'Fala de Barr, dirigente do Fed (FOMC)'],
    ['Fed Chair Powell Speaks', 'Fala de Powell, presidente do Fed'], ['German Buba President Nagel Speaks', 'Fala de Nagel, presidente do Bundesbank'], ['MPC Member Greene Speaks', 'Fala de Greene, dirigente do Banco da Inglaterra (MPC)'],
  ]
  for (const [original, esperado] of casos) assert.equal(traduzirEvento(original), esperado, original)
})
test('evento sem tradução, título já em português ou termo desconhecido continuam como vieram', () => {
  for (const titulo of ['Xyz Gadget Index', 'PPI: inflação ao produtor (EUA)', 'Copom: decisão da Selic', 'IPCA (previsto)', 'Prelim Xyz q/q', 'President Trump Speaks', 'constructor', 'toString m/m', '']) assert.equal(traduzirEvento(titulo), titulo)
  assert.equal(traduzirEvento('  GDP m/m '), 'PIB, variação mensal (GDP)', 'espaços nas pontas não impedem a tradução')
  assert.equal(traduzirEvento(undefined), '')
})
test('a explicação do balão não muda com a tradução: segue o título original', () => {
  for (const titulo of ['GDP m/m', 'Unemployment Claims', 'ECB President Lagarde Speaks', 'Crude Oil Inventories', 'Core PPI m/m']) assert.equal(explicarEvento(ev(titulo)).mapeado, true, titulo)
})
test('previsto e anterior no padrão brasileiro: só vírgula, ponto de milhar e sufixo; o valor não muda', () => {
  const casos = [['0.0%', '0,0%'], ['-0.2%', '-0,2%'], ['4.37%', '4,37%'], ['194K', '194 mil'], ['1.2M', '1,2 mi'], ['3.89M', '3,89 mi'], ['-0.6M', '-0,6 mi'], ['-19.2B', '-19,2 bi'], ['80B', '80 bi'], ['1080B', '1.080 bi'], ['2.1T', '2,1 tri'], ['56.5', '56,5'], ['5.62|2.5', '5,62 | 2,5'], ['+0.10%', '+0,10%']]
  for (const [original, esperado] of casos) assert.equal(formatarValorCalendario(original), esperado, original)
  // nada é arredondado: os mesmos algarismos, na mesma ordem
  for (const [original, esperado] of casos) assert.equal(esperado.replace(/\D/g, ''), original.replace(/\D/g, ''), original)
  // formato desconhecido ou ausente volta como veio
  for (const valor of ['abc', '1,2M', '<0.1%', '1.2.3', '', '5.62|n/d']) assert.equal(formatarValorCalendario(valor), valor)
  assert.equal(formatarValorCalendario(null), null); assert.equal(formatarValorCalendario(undefined), undefined)
})
test('a tela do calendário usa o nome em português e o número no padrão brasileiro', () => {
  const src = readFileSync(new URL('../src/Calendario.jsx', import.meta.url), 'utf8')
  assert.ok(src.includes('traduzirEvento(e.title)') && src.includes('formatarValorCalendario(e.forecast)') && src.includes('formatarValorCalendario(e.previous)'))
})
