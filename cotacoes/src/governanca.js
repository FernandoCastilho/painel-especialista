import { AUTO_REFRESH_MS, REFRESH_COOLDOWN_S, REFRESH_DAILY_MAX } from './useQuotes.js'
import { DATA_POLL_MS } from './visiblePolling.js'

// Governança dos dados: quando cada fonte é coletada e em que ponto o app a considera atrasada.
// REGRA: ao criar ou mudar um coletor, um agendamento ou um prazo de alerta, atualize este arquivo. O teste test/governanca.test.mjs
// confere os horários contra os workflows em .github/workflows e as fontes contra a tela de Configurações.

// Horários dos agendamentos (UTC, como nos workflows) e o que significam em Brasília.
export const CRONS = {
  pages: ['17 3-23 * * 1-5', '17 0-2 * * 2-6', '30 11 * * 1,2', '0 11,18 * * *'],
  focus: ['0,30 12-15 * * 1,2', '0 16 * * 1,2'],
  'quotes-watch': ['*/15 12-21 * * 1-5'],
  quotes: ['20 12 * * 1-5', '20 15 * * 1-5', '50 17 * * 1-5', '7 3-12 * * 1-5', '7 21-23 * * 1-5', '7 0-2 * * 2-6'],
}

// Idade máxima, em horas, antes de o app marcar a fonte como "Atrasado" (a pausa semanal não apaga atrasos anteriores).
export const ATRASO_H = { trends: 25, macro: 6, curves: 6, news: 6, 'reforma-tributaria': 6, temas: 6, 'insumos-precos': 24, indices: 24, policy: 36, estr: 6, 'euro-curve': 6, indexadores: 6, bndes: 6, moedas: 6, oil: 72, commodities: 72, 'commodities-brl': 72, fuels: 72, freight: 72, 'freight-jp': 72, ipca: 72, 'ipca-groups': 72, divida: 72, calendar: 12, 'heavy-vehicles': 1080 }

const HORA = 'De hora em hora nos dias úteis (0h17 às 23h17)'

// Uma linha por fonte (`chaves` = linhas de "Estado dos dados" que ela cobre): nome, origem, como é coletada, quando o dado de fato muda e quando é marcado como atrasado.
export const FONTES = [
  { id: 'trends', chaves: ['trends'], nome: 'Google Trends: Em alta no Brasil', origem: 'Google Trends (RSS oficial)', coleta: 'Diariamente às 08h e 15h de Brasília; sujeito à fila do GitHub Actions', muda: 'Buscas com aumento recente. Não atualiza os snapshots históricos dos termos selecionados', atraso: `${ATRASO_H.trends} h` },
  {id:'heavy-vehicles',chaves:['heavy-vehicles'],nome:'Veículos pesados: caminhões e ônibus',origem:'ANFAVEA; Renavam/Senatran',coleta:'Conferência diária em dias úteis, com retenção em falha ou mudança de formato',muda:'Publicação mensal da Carta da ANFAVEA; valores sujeitos a revisão',atraso:`${ATRASO_H['heavy-vehicles']} h`},
  { id: 'cambio', chaves: ['quotes'], nome: 'Câmbio (USD, EUR, JPY, CNH e EUR/USD)', origem: 'AwesomeAPI e BCB', coleta: 'A cada 5 min no pregão (9h30 às 18h, seg–sex), com vigia que redispara a coleta se ela passar de 15 min parada; 1 vez por hora de 0h07 às 9h07 e de 18h07 às 23h07, seg–sex; sem coleta no fim de semana', muda: 'Continuamente no pregão', atraso: 'Acima do esperado para o horário (cerca de 1 h fora do pregão)' },
  { id: 'macro', chaves: ['macro'], nome: 'CDI, Selic, PTAX, SOFR e Focus', origem: 'Banco Central, NY Fed', coleta: HORA, muda: 'CDI, PTAX e SOFR a cada dia útil; Selic a cada reunião do Copom (cerca de 6 semanas); Focus toda segunda às 8h30; se ainda não saiu, nova tentativa de 30 em 30 min até 13h (10 tentativas); o mesmo na terça, para quando segunda é feriado', atraso: `${ATRASO_H.macro} h` },
  { id: 'curves', chaves: ['curves'], nome: 'Curvas DI x pré, cupom cambial e Treasuries', origem: 'B3, Tesouro dos EUA', coleta: HORA, muda: 'Uma vez por dia útil, com o ajuste do dia', atraso: `${ATRASO_H.curves} h` },
  { id: 'news', chaves: ['news'], nome: 'Notícias', origem: 'Fontes públicas de notícias', coleta: HORA, muda: 'Ao longo do dia', atraso: `${ATRASO_H.news} h` },
  { id: 'reforma', chaves: ['reforma-tributaria'], nome: 'Reforma tributária (matérias dos últimos cinco dias)', origem: 'Google Notícias', coleta: HORA, muda: 'Ao longo do dia; o arquivo retém as últimas 120 horas de publicação', atraso: `${ATRASO_H['reforma-tributaria']} h` },
  { id: 'temas', chaves: ['temas'], nome: 'Setores, insumos, moedas e eleições nos EUA (matérias dos últimos cinco dias)', origem: 'Google Notícias', coleta: HORA, muda: 'Ao longo do dia; o arquivo retém as últimas 120 horas de publicação', atraso: `${ATRASO_H.temas} h` },
  { id: 'insumos-precos', chaves: ['insumos-precos'], nome: 'Cobre: preço diário aproximado (COMEX)', origem: 'Yahoo Finance', coleta: HORA, muda: 'A cada dia útil, com o fechamento do contrato (atrasado e não oficial)', atraso: `${ATRASO_H['insumos-precos']} h` },
  { id: 'indices', chaves: ['indices'], nome: 'Ibovespa (fechamento diário)', origem: 'Yahoo Finance', coleta: HORA, muda: 'A cada dia útil, com o fechamento da B3 (atrasado e não oficial)', atraso: `${ATRASO_H.indices} h` },
  { id: 'policy', chaves: ['policy'], nome: 'Juros de política monetária (Fed, BCE, BoJ)', origem: 'Bancos centrais e BIS', coleta: HORA, muda: 'A cada decisão do banco central', atraso: `${ATRASO_H.policy} h` },
  { id: 'estr', chaves: ['estr'], nome: '€STR (taxa overnight do BCE)', origem: 'Banco Central Europeu', coleta: HORA, muda: 'A cada dia útil europeu, publicada de manhã (horário de Frankfurt) para o dia anterior', atraso: `${ATRASO_H.estr} h` },
  { id: 'euro-curve', chaves: ['euro-curve'], nome: 'Curva de juros do euro (3 meses a 30 anos)', origem: 'Banco Central Europeu', coleta: HORA, muda: 'A cada dia útil europeu, com a curva do dia anterior', atraso: `${ATRASO_H['euro-curve']} h` },
  { id: 'indexadores', chaves: ['indexadores'], nome: 'TR, TBF e TLP', origem: 'Banco Central, BNDES', coleta: HORA, muda: 'TR e TBF diárias; TLP mensal', atraso: `${ATRASO_H.indexadores} h` },
  { id: 'bndes', chaves: ['bndes', 'moedas'], nome: 'TFB, TFC e moedas contratuais do BNDES', origem: 'BNDES', coleta: HORA, muda: 'Dias úteis, conforme a divulgação do BNDES', atraso: `${ATRASO_H.bndes} h` },
  { id: 'oil', chaves: ['oil', 'commodities'], nome: 'Petróleo, gás, diesel, gasolina e demais commodities', origem: 'EIA, Banco Mundial', coleta: HORA, muda: 'Brent, WTI, gás natural, diesel e gasolina de Nova York a cada dia útil; as do Banco Mundial (metais, grãos, açúcar, café, fertilizantes), uma vez por mês', atraso: `${ATRASO_H.oil} h` },
  { id: 'commodities-brl', chaves: ['commodities-brl'], nome: 'IC-Br e soja em R$/saca', origem: 'Banco Central (SGS), Banco Mundial', coleta: HORA, muda: 'Uma vez por mês (IC-Br e soja em dólar são mensais)', atraso: `${ATRASO_H['commodities-brl']} h` },
  { id: 'fuels', chaves: ['fuels'], nome: 'Combustíveis ao consumidor (gasolina, etanol, diesel e gás de cozinha)', origem: 'ANP', coleta: HORA, muda: 'Uma vez por semana, no resumo do Levantamento de Preços', atraso: `${ATRASO_H.fuels} h` },
  { id: 'ipca', chaves: ['ipca', 'ipca-groups'], nome: 'IPCA e IPCA por grupos', origem: 'IBGE (SIDRA)', coleta: 'No máximo 1 consulta a cada 6 h', muda: 'Uma vez por mês, na divulgação do IBGE', atraso: `${ATRASO_H.ipca} h` },
  { id: 'divida', chaves: ['divida'], nome: 'Dívida bruta do governo geral', origem: 'Banco Central (SGS)', coleta: 'No máximo 1 consulta a cada 6 h', muda: 'Uma vez por mês, na divulgação do Banco Central', atraso: `${ATRASO_H.divida} h` },
  { id: 'freight', chaves: ['freight', 'freight-jp'], nome: 'Transporte marítimo (EUA e Japão)', origem: 'BLS, Banco do Japão', coleta: 'No máximo 1 consulta por dia', muda: 'Uma vez por mês', atraso: `${ATRASO_H.freight} h` },
  { id: 'calendar', chaves: ['calendar'], nome: 'Calendário econômico', origem: 'Forex Factory, BLS, BEA, Fed', coleta: HORA, muda: 'Conforme os órgãos publicam as agendas', atraso: `${ATRASO_H.calendar} h` },
]

// Resumo no topo do painel: a resposta curta para "tudo é atualizado de 5 em 5 minutos?".
export const RESUMO = [
  'Só o câmbio é coletado de 5 em 5 minutos, e apenas no pregão (9h30 às 18h, segunda a sexta, horário de Brasília). Fora do pregão, 1 vez por hora em dias úteis; no fim de semana, nada.',
  'Juros, €STR, curvas, BNDES, petróleo, commodities, combustíveis, notícias e calendário são coletados de hora em hora nos dias úteis. IPCA e dívida bruta, no máximo a cada 6 horas; frete marítimo, 1 vez por dia.',
  'Coletar não é o mesmo que o número mudar: o dado só muda quando o órgão publica. O CDI e a curva DI mudam 1 vez por dia útil, a Selic a cada reunião do Copom (cerca de 6 semanas), e o IPCA e a dívida bruta 1 vez por mês. O CDI pode ser coletado 20 vezes no dia e mostrar o mesmo valor em todas.',
]

const min = (ms) => Math.round(ms / 60000)
// Como o navegador lê e atualiza (valores vêm das constantes do código, não de texto digitado).
export const NAVEGADOR = [
  `Relê os arquivos publicados a cada ${min(DATA_POLL_MS)} min, só enquanto a aba está visível; ao voltar para a aba, atualiza na hora.`,
  `Atualização automática das cotações a cada ${min(AUTO_REFRESH_MS)} min.`,
  `Botão Atualizar: consulta direta à fonte, no máximo 1 a cada ${REFRESH_COOLDOWN_S} s e ${REFRESH_DAILY_MAX} por dia neste navegador.`,
  'Alertas de câmbio: mais de ±0,30% em relação ao fechamento anterior da fonte, usando o mesmo Δ dia da tabela. Sem fechamento no dia anterior, vale o último fechamento disponível na fonte. Alertas a partir das 9h de Brasília. A faixa no painel não exige permissão; a notificação do sistema exige autorização deste navegador. Não há monitoramento contínuo em segundo plano nem com o app fechado, mesmo instalado como aplicativo. Uma consulta já iniciada pode terminar e gerar um aviso após ocultar a aba.',
]

export const REGRAS = [
  'Origem, API e frequência de cada referência ficam na Base de dados, nesta tela. Os horários separam a conferência no painel da geração do arquivo e da referência do dado, além de ressalvas curtas que mudam a leitura do número.',
  'Se uma fonte falha, o app mantém o último dado válido e informa retenção ou atualização parcial. Uma nova leitura ou geração de arquivo não muda a data original do dado.',
  'Uma validação automática confere a coerência dos dados a cada publicação e abre um alerta quando encontra problema.',
  'No fim de semana, a pausa das coletas de dias úteis não apaga atrasos e falhas anteriores. A idade da cotação continua visível; os horários não afirmam se o mercado está aberto ou fechado.',
  'O agendamento do GitHub é feito no melhor esforço: horários podem atrasar ou ser pulados. Por isso o pregão usa uma coleta contínua de 5 em 5 minutos, em vez de uma execução por horário.',
  'O site publicado conta acessos de forma anônima (Umami, sem cookies e sem dado pessoal), só para saber quantas pessoas usam o app por dia e quantas estão online.',
  'Aplicativo educacional: informação ilustrativa, que não representa compromisso nem informações atualizadas on-line.',
]
