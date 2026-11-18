import test from 'node:test'
import assert from 'node:assert/strict'
import { TEMAS, relevanteTema, MERCADO_AMPLO } from '../scripts/temas-lib.mjs'

const t = (id) => TEMAS.find((x) => x.id === id)

// Decisão de 18/11/2026: lista de palavras de mercado mais ampla nos temas de setor e de insumo, sem abrir para o uso comum
// da palavra. Moedas e eleições seguem com a lista própria.
test('temas de setor e insumo: notícia do assunto com palavra de mercado ampla entra', () => {
  for (const [id, titulo] of [
    ['cobre', 'Codelco demite 300 trabalhadores e adia investimento em mina no Chile'],
    ['cobre', 'Cobre: mineradora anuncia férias coletivas em Carajás'],
    ['aluminio', 'Alumínio: CBA registra lucro recorde no trimestre'],
    ['aco', 'Usiminas anuncia férias coletivas em Ipatinga'],
    ['carvao', 'Carvão: usina térmica tem contrato renovado e amplia capacidade'],
    ['cafe', 'Cooperativa de café inaugura nova unidade de torrefação'],
    ['trigo', 'Moinho de trigo anuncia nova fábrica no Paraná'],
    ['cacau', 'Cacau: indústria de chocolate tem prejuízo com alta da amêndoa'],
    ['fertilizantes', 'Fertilizantes: Mosaic fecha fábrica e corta vagas'],
    ['industria', 'Indústria têxtil demite 500 e dá férias coletivas no Sul'],
    ['veiculos-pesados', 'Roubo de carga encarece o frete de caminhões'],
  ]) assert.equal(relevanteTema(t(id), titulo), true, `${id}: ${titulo}`)
})

test('temas de setor e insumo: uso comum da palavra continua fora', () => {
  for (const [id, titulo] of [
    ['cobre', 'Câmera cobre o show do Coldplay em São Paulo'],
    ['cobre', 'Plano de saúde cobre cirurgia bariátrica? Entenda'],
    ['trigo', 'Receita de bolo de trigo fofinho'],
    ['cafe', 'Como fazer o café perfeito em casa'],
    ['cacau', 'Manteiga de cacau: benefícios para a pele'],
    ['veiculos-pesados', 'Acidente com ônibus em rodovia deixa feridos'],
    ['veiculos-pesados', 'Caminhão tomba na BR-116 e interdita a pista'],
    ['aco', 'Nervos de aço: atleta supera lesão e vence final'],
  ]) assert.equal(relevanteTema(t(id), titulo), false, `${id}: ${titulo}`)
})

test('café com acento no fim do título é reconhecido (o \\b não funciona depois do "é")', () => {
  assert.equal(relevanteTema(t('cafe'), 'Preço do café sobe 5% na semana'), true)
  assert.equal(relevanteTema(t('cafe'), 'Exportações de café batem recorde'), true)
  assert.equal(relevanteTema(t('cafe'), 'Cafeteria abre nova loja com preço baixo'), false)
})

test('moedas e eleições não recebem a lista ampla; madeira segue sem filtro de mercado', () => {
  for (const id of ['moeda-usd', 'moeda-eur', 'moeda-jpy', 'moeda-cnh', 'eleicoes-eua']) assert.ok(!t(id).contexto.source.includes(MERCADO_AMPLO[0]), id)
  for (const x of TEMAS.filter((x) => ['setor', 'insumo'].includes(x.grupo) && x.contexto)) assert.ok(x.contexto.source.includes(MERCADO_AMPLO[0]), x.id)
  assert.equal(t('madeira').contexto, undefined)
  assert.equal(t('veiculos-pesados').excluir, undefined)
  assert.equal(relevanteTema(t('moeda-cnh'), 'China anuncia novo plano de saúde'), false)
})
