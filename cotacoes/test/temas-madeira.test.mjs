import test from 'node:test'
import assert from 'node:assert/strict'
import { TEMAS, relevanteTema, temasFile } from '../scripts/temas-lib.mjs'

// Tema de notícias pedido para visitas a indústrias de madeira: mercado, preço e comércio exterior do setor.
test('tema Madeira e base florestal: aceita o negócio da madeira e recusa o que só tem a palavra', () => {
  const t = TEMAS.find((x) => x.id === 'madeira')
  assert.equal(t.grupo, 'setor')
  assert.equal(t.label, 'Madeira e base florestal')
  for (const titulo of [
    'Exportações de madeira acumulam queda de 3% no ano',
    'O preço da madeira cai para o menor nível em nove meses',
    'Tarifa dos EUA derruba vendas de compensado de pinus do Paraná',
    'MDF é alternativa sustentável na indústria moveleira',
    'Ibá projeta investimento recorde em florestas plantadas',
    'Empresa de painéis de madeira anuncia nova fábrica em Santa Catarina',
    'ABIMCI: produção de madeira processada recua no trimestre',
    'Setor florestal cresce 5% e puxa emprego no Sul',
    'Setor madeireiro vive apreensão com tarifa de 50% dos EUA', // "apreensão" de preocupação, não de carga
    'Lei antidesmatamento da UE preocupa exportadores de madeira do Brasil',
    'Madeireiras demitem 2 mil trabalhadores no Paraná',
    'Incêndios reduzem oferta de madeira e preços do pinus disparam',
    'Dexco tem queda no lucro com vendas menores de painéis',
    'Eucatex anuncia nova linha de MDF em Salto',
    'Klabin compra florestas plantadas da Arauco por R$ 5,8 bi',
    'Produção de móveis recua 4% no ano, aponta Abimóvel',
    'Concessões florestais na Amazônia atraem investimento privado',
    'Compensado brasileiro perde espaço nos EUA para o Vietnã',
  ]) assert.equal(relevanteTema(t, titulo), true, titulo)
  for (const titulo of [
    'Polícia apreende carga de madeira ilegal no Pará', // fiscalização e ocorrência policial
    'Ibama aplica multas a serrarias por desmatamento',
    'Caminhão com madeira tomba na BR-364',
    'Ilha da Madeira bate recorde de turistas e setor hoteleiro cresce', // a ilha, não o produto
    'Nível do Rio Madeira sobe e alivia transporte de cargas', // o rio
    'Casa de madeira é destruída em temporal; prejuízo é alto',
    'Cheques compensados caem 12% no mercado bancário', // "compensado" de banco
    'Madeira nobre: artesão ensina técnica antiga', // cita madeira, sem contexto de mercado
    'Dólar fecha em alta com exterior', // não cita o setor
    'Cristiano Ronaldo investe em novo hotel na Madeira', // a ilha, sem "Ilha da"
    'Governo da Madeira aprova orçamento com alta de 5%',
    'Preços das casas na Madeira sobem 12% num ano',
    'Hidrelétricas do Madeira reduzem produção de energia com a seca', // o rio, sem "Rio"
    'Hidrovia do Madeira: leilão deve atrair R$ 100 milhões em investimento',
    'Sefaz muda regras do MDF-e e setor de transporte reclama de custo', // documento fiscal
    'MadeiraMadeira demite 10% e corta custo após queda nas vendas', // loja on-line
    'Deputado Madeira critica alta de impostos', // sobrenome
    'Prefeitura de Serraria anuncia investimento em saúde', // município
    'Ponte de madeira desaba e prejudica setor rural em MT',
    'Brinquedos de madeira ganham mercado no Natal',
    'Madeira nobre é furtada de fábrica de móveis',
    'Caminhão carregado de madeira pega fogo; prejuízo é alto',
    'Incêndio em madeireira destrói estoque e fábrica', // ocorrência, não mercado
    'Suzano eleva preço da celulose para a China', // celulose é outro setor
  ]) assert.equal(relevanteTema(t, titulo), false, titulo)
  assert.ok(temasFile({}, 1).temas.madeira, 'entra no temas.json')
  assert.ok(t.queries.length >= 3 && t.queries.every((q) => /madeir|florest|MDF/i.test(q)))
})
