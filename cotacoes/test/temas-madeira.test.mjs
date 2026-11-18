import test from 'node:test'
import assert from 'node:assert/strict'
import { TEMAS, relevanteTema, temasFile } from '../scripts/temas-lib.mjs'

// Tema de notícias pedido para visitas a indústrias de madeira. Uso educativo (decisão de 18/11/2026): entra toda matéria
// que cite o setor, sem descarte por palavra; só sai o que não é madeira (a ilha, o rio, o documento fiscal, homônimos).
test('tema Madeira e base florestal: entra toda matéria do setor, inclusive queda, acidente e fiscalização', () => {
  const t = TEMAS.find((x) => x.id === 'madeira')
  assert.equal(t.grupo, 'setor')
  assert.equal(t.label, 'Madeira e base florestal')
  assert.equal(t.contexto, undefined, 'sem exigência de palavra de contexto econômico')
  for (const titulo of [
    'Exportações de madeira desabam 40% após tarifaço',
    'Preço da madeira tomba 20% com estoques altos',
    'Exportações de madeira acumulam queda de 3% no ano',
    'Setor madeireiro vive apreensão com tarifa de 50% dos EUA',
    'Setor madeireiro pede benefícios fiscais para enfrentar tarifaço',
    'Exportação de madeira para Portugal cresce 30% no ano',
    'Lei antidesmatamento da UE preocupa exportadores de madeira do Brasil',
    'Madeireiras demitem 2 mil trabalhadores no Paraná',
    'Polícia apreende carga de madeira ilegal no Pará',
    'Ibama aplica multas a serrarias por desmatamento',
    'Caminhão com madeira tomba na BR-364',
    'Incêndio em madeireira destrói estoque e fábrica',
    'Madeira nobre: artesão ensina técnica antiga',
    'Brinquedos de madeira ganham mercado no Natal',
    'A indústria madeireira do Vietnã enfrenta novas exigências do EUDR',
    'MDF é alternativa sustentável na indústria moveleira',
    'Eucatex anuncia nova linha de MDF em Salto',
    'Klabin compra florestas plantadas da Arauco por R$ 5,8 bi',
    'Produção de móveis recua 4% no ano, aponta Abimóvel',
    'Ministro defende madeira brasileira em negociação de tarifa com os EUA', // cargo seguido de "defende", não do sobrenome
    'Lenha: preço da madeira para churrasco sobe no inverno',
    'Piso de madeira ou porcelanato: preço e durabilidade',
  ]) assert.equal(relevanteTema(t, titulo), true, titulo)
  for (const titulo of [
    'Ilha da Madeira bate recorde de turistas', // a ilha
    'Governo da Madeira aprova orçamento com alta de 5%',
    'Nível do Rio Madeira sobe e alivia transporte de cargas', // o rio
    'Hidrelétricas do Madeira reduzem produção de energia com a seca',
    'Sefaz muda regras do MDF-e e setor de transporte reclama de custo', // documento fiscal
    'Deputado Madeira critica alta de impostos', // sobrenome
    'Jogador Madeira renova contrato e mercado da bola reage',
    'Benfica vence o Nacional da Madeira e sobe na tabela', // clube da ilha
    'Vinho Madeira ganha mercado no Brasil',
    'Clima na Madeira: alta pressão traz sol para o fim de semana',
    'Prefeitura de Serraria anuncia investimento em saúde', // município
    'Dólar fecha em alta com exterior', // não cita o setor
  ]) assert.equal(relevanteTema(t, titulo), false, titulo)
  assert.ok(temasFile({}, 1).temas.madeira, 'entra no temas.json')
  assert.ok(t.queries.length >= 3 && t.queries.every((q) => /madeir|florest|MDF/i.test(q)))
})
