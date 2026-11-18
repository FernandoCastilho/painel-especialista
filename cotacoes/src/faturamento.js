// Faturamento x Endividamento: lê o texto colado (Mês, Faturamento, Endividamento) e compara
// um período escolhido com os mesmos meses do ano anterior (soma, média e variação %), na unidade
// em que os números vieram (ex.: R$ mil). A única regra financeira é a alavancagem de indicadores12m,
// no critério do DAC; mudar essa regra exige aprovação do Fernando e revisão independente.

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Mês em "out/24", "out/2024", "outubro/24", "Out. 2024", "10/2024" ou "2024-10".
export function parseMes(token) {
  const t = semAcento(String(token).trim()).replace(/\./g, '')
  let m = t.match(/^([a-z]{3})[a-z]*\s*[/\- ]?\s*(\d{2}|\d{4})$/)
  if (m) {
    const i = MESES.indexOf(m[1])
    if (i < 0) return null
    const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
    return { ano, mes: i + 1 }
  }
  m = t.match(/^(\d{1,2})[/-](\d{2}|\d{4})$/)
  if (m) {
    const mes = Number(m[1])
    if (mes < 1 || mes > 12) return null
    return { ano: m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), mes }
  }
  m = t.match(/^(\d{4})-(\d{1,2})$/)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { ano: Number(m[1]), mes: Number(m[2]) }
  return null
}

// Número no padrão brasileiro: "7.123", "7.123,45", "R$ 7.123", "-12,5". Vazio ou "-" = sem dado (null).
// Retorna undefined quando o texto não é número.
export function parseNumero(token) {
  // Traço comum, meia-risca (–), travessão (—) ou sinal de menos (−) sozinhos = sem dado.
  let t = String(token ?? '').replace(/R\$/gi, '').replace(/\s/g, '').replace(/[–−]/g, '-')
  if (t === '' || /^[-—]+$/.test(t)) return null
  const negativo = /^\(.*\)$/.test(t) || t.startsWith('-')
  t = t.replace(/^[(-]|\)$/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined
  const v = Number(t)
  return negativo ? -v : v
}

export const chaveMes = (ano, mes) => ano * 12 + (mes - 1)
export const rotuloMes = (chave) => `${MESES[((chave % 12) + 12) % 12]}/${String(Math.floor(chave / 12)).slice(-2)}`

const INICIO = /^\s*([A-Za-zÀ-ÿ]{3,9}\.?\s*[/-]?\s*\d{2,4}|\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2})(?=\s|;|\t|$)(.*)$/

// Lê o texto colado. Cabeçalho e linhas vazias são ignorados; o resto que não for mês + números vira aviso.
export function parseFaturamento(texto) {
  const linhas = String(texto ?? '').split(/\r?\n/)
  const porChave = new Map()
  const avisos = []
  linhas.forEach((bruta, i) => {
    // Tabela em formato de texto com barras (| Jan/25 | 350 | 2.235 |): barra vira separador
    // e a linha de traços (|---|---:|) é ignorada.
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(bruta) && bruta.includes('-') && bruta.includes('|')) return
    const linha = bruta.replace(/\|/g, ' ').trim()
    if (!linha) return
    const m = linha.match(INICIO)
    const mes = m && parseMes(m[1])
    if (!mes) {
      if (/m[eê]s|faturamento|endividamento/i.test(linha)) return
      avisos.push({ linha: i + 1, texto: linha, motivo: 'Mês não reconhecido (use o formato out/24).' })
      return
    }
    const partes = m[2].split(/[\t; ]+/).filter(Boolean)
    const nums = partes.map(parseNumero)
    if (nums.length === 0 || nums.some((n) => n === undefined)) {
      avisos.push({ linha: i + 1, texto: linha, motivo: 'Valor não reconhecido.' })
      return
    }
    const chave = chaveMes(mes.ano, mes.mes)
    if (porChave.has(chave)) {
      avisos.push({ linha: i + 1, texto: linha, motivo: `Mês repetido (${rotuloMes(chave)}); valeu a primeira linha.` })
      return
    }
    porChave.set(chave, { chave, rotulo: rotuloMes(chave), ano: mes.ano, mes: mes.mes, faturamento: nums[0] ?? null, endividamento: nums.length > 1 ? nums[1] : null })
  })
  const meses = [...porChave.values()].sort((a, b) => a.chave - b.chave)
  const u = String(texto ?? '').match(/\(\s*(R\$\s*(?:mil|milh[õo]es|bilh[õo]es|mi|bi)?)\s*\)/i)
  const unidade = u ? u[1].replace(/\s+/g, ' ').replace(/R\$(?=\S)/i, 'R$ ').trim() : null
  return { meses, avisos, unidade }
}

// Série contínua para o gráfico: mês sem linha colada vira posição vazia, para o período escolhido
// e o do ano anterior ficarem marcados em todos os meses, sem saltos.
export function serieContinua(meses, limite = 240) {
  if (meses.length < 2 || meses.at(-1).chave - meses[0].chave >= limite) return meses
  const porChave = new Map(meses.map((m) => [m.chave, m]))
  const serie = []
  for (let k = meses[0].chave; k <= meses.at(-1).chave; k++) {
    serie.push(porChave.get(k) ?? { chave: k, rotulo: rotuloMes(k), ano: Math.floor(k / 12), mes: (k % 12) + 1, faturamento: null, endividamento: null, vazio: true })
  }
  return serie
}

const soma = (xs) => xs.reduce((s, x) => s + x, 0)
const media = (xs) => (xs.length ? soma(xs) / xs.length : null)
// Saldo de endividamento zerado ou vazio é tratado como "sem informação" (ex.: mês ainda não fechado no SCR).
const temSaldo = (v) => v != null && v > 0
export const variacao = (atual, anterior) => (atual == null || anterior == null || anterior === 0 ? null : atual / anterior - 1)

// Compara os meses de [de, ate] com os mesmos meses do ano anterior. Só entram na variação os meses que
// existem nos dois anos (pares); os totais do período escolhido usam todos os meses dele.
export function compararPeriodo(meses, de, ate) {
  if (de == null || ate == null) return null
  const [ini, fim] = de <= ate ? [de, ate] : [ate, de]
  const porChave = new Map(meses.map((m) => [m.chave, m]))
  const atuais = meses.filter((m) => m.chave >= ini && m.chave <= fim)
  if (!atuais.length) return null
  const pares = atuais.map((m) => [m, porChave.get(m.chave - 12)]).filter(([, p]) => p)

  const fatPar = pares.filter(([a, p]) => a.faturamento != null && p.faturamento != null)
  const fatAtual = soma(fatPar.map(([a]) => a.faturamento))
  const fatAnterior = soma(fatPar.map(([, p]) => p.faturamento))
  const divPar = pares.filter(([a, p]) => temSaldo(a.endividamento) && temSaldo(p.endividamento))
  const divMediaAtual = media(divPar.map(([a]) => a.endividamento))
  const divMediaAnterior = media(divPar.map(([, p]) => p.endividamento))
  const ultimo = divPar.at(-1)

  return {
    de: ini,
    ate: fim,
    rotulo: ini === fim ? rotuloMes(ini) : `${rotuloMes(ini)} a ${rotuloMes(fim)}`,
    rotuloAnterior: ini === fim ? rotuloMes(ini - 12) : `${rotuloMes(ini - 12)} a ${rotuloMes(fim - 12)}`,
    mesesNoPeriodo: atuais.length,
    mesesComparados: fatPar.length,
    faturamento: {
      totalPeriodo: soma(atuais.filter((m) => m.faturamento != null).map((m) => m.faturamento)),
      atual: fatPar.length ? fatAtual : null,
      anterior: fatPar.length ? fatAnterior : null,
      mediaAtual: fatPar.length ? fatAtual / fatPar.length : null,
      mediaAnterior: fatPar.length ? fatAnterior / fatPar.length : null,
      variacao: fatPar.length ? variacao(fatAtual, fatAnterior) : null,
    },
    endividamento: {
      mesesComparados: divPar.length,
      mediaAtual: divMediaAtual,
      mediaAnterior: divMediaAnterior,
      variacaoMedia: variacao(divMediaAtual, divMediaAnterior),
      ultimoRotulo: ultimo ? ultimo[0].rotulo : null,
      ultimoAnteriorRotulo: ultimo ? ultimo[1].rotulo : null,
      ultimoAtual: ultimo ? ultimo[0].endividamento : null,
      ultimoAnterior: ultimo ? ultimo[1].endividamento : null,
      variacaoUltimo: ultimo ? variacao(ultimo[0].endividamento, ultimo[1].endividamento) : null,
    },
  }
}

// Últimos 12 meses e alavancagem, no mesmo critério do DAC:
// - janela de 12 meses terminando no último mês com faturamento informado;
// - média mensal = soma dos meses da janela com faturamento ÷ quantidade desses meses;
// - endividamento = último mês com saldo maior que zero (zero ou vazio = mês sem informação);
// - alavancagem = endividamento ÷ média mensal (em "x faturamento").
// Os 12 meses anteriores são comparados só se a janela anterior tiver os mesmos meses informados.
export function indicadores12m(meses) {
  const comFat = meses.filter((m) => m.faturamento != null)
  if (!comFat.length) return null
  const fim = comFat.at(-1).chave
  const janela = (a, b) => comFat.filter((m) => m.chave >= a && m.chave <= b)
  const atual = janela(fim - 11, fim)
  const anterior = janela(fim - 23, fim - 12)
  const total = soma(atual.map((m) => m.faturamento))
  const media = total / atual.length
  const ultimoSaldo = [...meses].reverse().find((m) => temSaldo(m.endividamento)) ?? null
  const comparavel = atual.length === 12 && anterior.length === 12
  const totalAnterior = anterior.length ? soma(anterior.map((m) => m.faturamento)) : null
  return {
    de: atual[0].rotulo,
    ate: atual.at(-1).rotulo,
    meses: atual.length,
    total,
    media,
    anteriorDe: rotuloMes(fim - 23),
    anteriorAte: rotuloMes(fim - 12),
    mesesAnterior: anterior.length,
    totalAnterior,
    variacao: comparavel ? variacao(total, totalAnterior) : null,
    endividamento: ultimoSaldo ? ultimoSaldo.endividamento : null,
    endividamentoMes: ultimoSaldo ? ultimoSaldo.rotulo : null,
    // Saldo fora da janela de 12 meses: a conta segue a regra, mas a tela avisa que o saldo é defasado.
    endividamentoForaDaJanela: !!ultimoSaldo && (ultimoSaldo.chave < fim - 11 || ultimoSaldo.chave > fim),
    alavancagem: ultimoSaldo && media > 0 ? ultimoSaldo.endividamento / media : null,
  }
}

// Rótulo do gráfico em milhões a partir de R$ mil (5.931 -> "5,9"), como nos slides.
export const emMilhoes = (v) => (v == null ? '—' : (v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))

// Crescimento do faturamento x crescimento do endividamento no período escolhido, contra o mesmo
// período do ano anterior. Usa variações já calculadas em compararPeriodo (faturamento somado e
// endividamento médio) e só diz qual cresceu mais: não é regra nova de cálculo.
export function leituraCrescimento(c) {
  const fat = c?.faturamento?.variacao ?? null
  const div = c?.endividamento?.variacaoMedia ?? null
  if (fat == null || div == null) return { fat, div, diferencaPp: null, relacao: null }
  const diferencaPp = (div - fat) * 100
  // Dívida média sobre faturamento médio muda na razão (1 + div) / (1 + fat).
  const razao = (1 + div) / (1 + fat)
  const relacao = Math.abs(razao - 1) < 0.0005 ? 'estavel' : razao > 1 ? 'piorou' : 'melhorou'
  return { fat, div, diferencaPp, relacao }
}

// Análise automática da série colada: tendência, sazonalidade, estabilidade, meses fora do padrão e
// endividamento. Só estatística descritiva dos números colados; os limites usados para os alertas estão
// nas constantes abaixo e na ajuda da tela. Não é parecer de crédito.
export const LIMITES_ANALISE = {
  sazonalForte: 0.05,      // mês ≥ 5% acima (ou abaixo) do nível normal entra como forte (ou fraco)
  sazonalRelevante: 0.15,  // diferença entre o mês mais forte e o mais fraco para chamar de sazonal
  atipico: 0.25,           // mês 25% fora do esperado (média dos 12 anteriores ajustada pela sazonalidade)
  instavel: 0.25,          // coeficiente de variação acima de 25% em 12 meses
  estavel: 0.10,           // abaixo de 10%
  quedaForte: -0.10,       // queda de 10% ou mais em 12 meses
}
const desvio = (xs) => { const m = media(xs); return Math.sqrt(media(xs.map((x) => (x - m) ** 2))) }
// Inclinação da reta (mínimos quadrados) por passo, sobre pares [x, y].
function inclinacao(pares) {
  if (pares.length < 3) return null
  const mx = media(pares.map(([x]) => x)), my = media(pares.map(([, y]) => y))
  const num = soma(pares.map(([x, y]) => (x - mx) * (y - my)))
  const den = soma(pares.map(([x]) => (x - mx) ** 2))
  return den ? num / den : null
}
const mesDoAno = (k) => ((k % 12) + 12) % 12

export function analisarSerie(meses) {
  const L = LIMITES_ANALISE
  const fat = meses.filter((m) => m.faturamento != null)
  if (fat.length < 6) return { suficiente: false, motivo: 'Cole pelo menos 6 meses de faturamento para a análise.' }
  const val = new Map(fat.map((m) => [m.chave, m.faturamento]))
  const ini = fat[0].chave, fim = fat.at(-1).chave

  // Sazonalidade: cada mês dividido pela média móvel centrada de 12 meses (método clássico de razão à média
  // móvel). Precisa de 6 meses completos antes e depois; a média por mês do ano vira o índice sazonal.
  const razoes = Array.from({ length: 12 }, () => [])
  for (let k = ini + 6; k <= fim - 6; k++) {
    const janela = []
    for (let j = -6; j <= 6; j++) janela.push(val.get(k + j))
    if (janela.some((x) => x == null)) continue
    const mm = (janela[0] / 2 + soma(janela.slice(1, 12)) + janela[12] / 2) / 12
    if (mm > 0) razoes[mesDoAno(k)].push(janela[6] / mm)
  }
  let indices = razoes.map((r, i) => ({ mes: i, rotulo: MESES[i], n: r.length, indice: r.length ? media(r) : null }))
  const cobertos = indices.filter((x) => x.indice != null)
  let sazonalidade = null
  if (cobertos.length === 12) {
    const f = media(cobertos.map((x) => x.indice))
    indices = indices.map((x) => ({ ...x, indice: x.indice / f }))
    const ordem = [...indices].sort((a, b) => b.indice - a.indice)
    const amplitude = ordem[0].indice - ordem.at(-1).indice
    sazonalidade = {
      indices,
      anos: Math.max(...indices.map((x) => x.n)),
      amplitude,
      relevante: amplitude >= L.sazonalRelevante,
      fortes: ordem.filter((x) => x.indice >= 1 + L.sazonalForte).slice(0, 3),
      fracos: [...ordem].reverse().filter((x) => x.indice <= 1 - L.sazonalForte).slice(0, 3),
    }
  }

  // Série dessazonalizada (valor ÷ índice do mês do ano) quando há sazonalidade: tendência, estabilidade,
  // ritmo recente, quedas seguidas e meses fora do padrão olham a série sem o efeito do calendário.
  // Só desconta a sazonalidade se todos os índices forem positivos (mês do ano sempre zerado = série sem ajuste).
  const ajustada = sazonalidade != null && sazonalidade.indices.every((x) => x.indice > 0)
  const aj = (m) => (ajustada ? m.faturamento / sazonalidade.indices[mesDoAno(m.chave)].indice : m.faturamento)
  const valAj = new Map(fat.map((m) => [m.chave, aj(m)]))

  // Últimos 12 meses (ou os que houver): tendência (reta), estabilidade (coeficiente de variação), melhor e pior mês.
  const ult = fat.filter((m) => m.chave > fim - 12)
  const mUlt = media(ult.map(aj))
  const inc = inclinacao(ult.map((m) => [m.chave, aj(m)]))
  const tendenciaAno = inc != null && mUlt > 0 ? Math.max(-1, (inc * 12) / mUlt) : null
  const cv = mUlt > 0 && ult.length >= 6 ? desvio(ult.map(aj)) / mUlt : null
  const melhor = ult.reduce((a, b) => (b.faturamento > a.faturamento ? b : a))
  const pior = ult.reduce((a, b) => (b.faturamento < a.faturamento ? b : a))
  const tres = fat.filter((m) => m.chave > fim - 3)
  const ritmoRecente = mUlt > 0 && tres.length === 3 ? media(tres.map(aj)) / mUlt - 1 : null

  // Sequência atual de quedas ou altas seguidas (só meses vizinhos), na série dessazonalizada.
  let quedas = 0, altas = 0
  for (let k = fim; valAj.has(k) && valAj.has(k - 1); k--) {
    if (valAj.get(k) < valAj.get(k - 1) && altas === 0) quedas++
    else if (valAj.get(k) > valAj.get(k - 1) && quedas === 0) altas++
    else break
  }

  // Meses fora do padrão: o esperado vem da reta dos 12 meses anteriores (mínimo 6) na série dessazonalizada,
  // projetada para o mês; assim o crescimento normal da empresa não vira "anomalia".
  const atipicos = []
  for (const m of fat) {
    const ant = fat.filter((x) => x.chave < m.chave && x.chave >= m.chave - 12)
    if (ant.length < 6) continue
    const pares = ant.map((x) => [x.chave, aj(x)])
    const b = inclinacao(pares) ?? 0
    const mx = media(pares.map(([x]) => x)), my = media(pares.map(([, y]) => y))
    const esperado = my + b * (m.chave - mx)
    if (esperado <= 0) continue
    const desvioPct = aj(m) / esperado - 1
    if (Math.abs(desvioPct) >= L.atipico) atipicos.push({ rotulo: m.rotulo, chave: m.chave, desvio: desvioPct })
  }

  // Endividamento: só meses com saldo (zero ou vazio = sem informação).
  const saldos = meses.filter((m) => temSaldo(m.endividamento))
  let endividamento = null
  if (saldos.length >= 1) {
    const ultS = saldos.at(-1)
    const ano = saldos.find((m) => m.chave === ultS.chave - 12) ?? null
    const maxS = saldos.reduce((a, b) => (b.endividamento > a.endividamento ? b : a))
    // Alavancagem mês a mês: saldo ÷ média do faturamento dos 12 meses até aquele mês (mínimo 6 meses).
    const alav = saldos.map((m) => {
      const jan = fat.filter((x) => x.chave <= m.chave && x.chave > m.chave - 12)
      const mf = jan.length >= 6 ? media(jan.map((x) => x.faturamento)) : null
      return mf > 0 ? { rotulo: m.rotulo, chave: m.chave, valor: m.endividamento / mf } : null
    }).filter(Boolean)
    const alavAno = alav.find((a) => a.chave === ultS.chave - 12) ?? null
    const semSaldoNoFim = meses.filter((m) => m.chave > ultS.chave && m.chave <= fim).length
    endividamento = {
      ultimo: ultS.endividamento, ultimoRotulo: ultS.rotulo, ultimoChave: ultS.chave,
      anoAntes: ano?.endividamento ?? null, anoAntesRotulo: ano?.rotulo ?? null,
      variacao12m: ano ? variacao(ultS.endividamento, ano.endividamento) : null,
      maximo: maxS.endividamento, maximoRotulo: maxS.rotulo,
      alavancagemAtual: alav.at(-1)?.chave === ultS.chave ? alav.at(-1).valor : null,
      alavancagemAnoAntes: alavAno?.valor ?? null,
      alavancagemMax: alav.length ? alav.reduce((a, b) => (b.valor > a.valor ? b : a)) : null,
      semSaldoNoFim,
    }
  }

  // Faturamento 12 meses contra os 12 anteriores (mesmo critério de indicadores12m).
  const i12 = indicadores12m(meses)

  // Pontos de atenção, nos limites de LIMITES_ANALISE.
  const atencao = []
  if (i12?.variacao != null && i12.variacao <= L.quedaForte) atencao.push(`Faturamento dos últimos 12 meses ${Math.round(Math.abs(i12.variacao) * 100)}% menor que nos 12 anteriores.`)
  if (tendenciaAno != null && tendenciaAno <= L.quedaForte) atencao.push(`Tendência de queda do faturamento nos últimos ${ult.length} meses${ajustada ? ', já descontada a sazonalidade' : ''}.`)
  if (cv != null && cv > L.instavel) atencao.push(`Faturamento instável: os meses variam muito em torno da média${ajustada ? ', mesmo descontada a sazonalidade' : ''}.`)
  if (quedas >= 3) atencao.push(`${quedas} quedas seguidas de faturamento até ${fat.at(-1).rotulo}${ajustada ? ', descontada a sazonalidade' : ''}.`)
  const recentesBaixo = atipicos.filter((a) => a.desvio < 0 && a.chave > fim - 6)
  if (recentesBaixo.length) atencao.push(`Mês recente bem abaixo do esperado: ${recentesBaixo.map((a) => a.rotulo).join(', ')}.`)
  // Dívida x faturamento na mesma janela: saldo do último mês com saldo contra 12 meses antes, e faturamento
  // dos 12 meses até esse mês contra os 12 anteriores (só com as duas janelas completas).
  let fatMesmaJanela = null
  if (endividamento?.variacao12m != null) {
    const k = endividamento.ultimoChave
    const j1 = fat.filter((m) => m.chave > k - 12 && m.chave <= k), j0 = fat.filter((m) => m.chave > k - 24 && m.chave <= k - 12)
    if (j1.length === 12 && j0.length === 12) fatMesmaJanela = variacao(soma(j1.map((m) => m.faturamento)), soma(j0.map((m) => m.faturamento)))
    if (endividamento) endividamento.faturamentoMesmaJanela = fatMesmaJanela
  }
  if (fatMesmaJanela != null && endividamento.variacao12m > fatMesmaJanela + 0.05) atencao.push(`Endividamento evoluiu pior que o faturamento em 12 meses até ${endividamento.ultimoRotulo} (dívida ${Math.round(endividamento.variacao12m * 100)}%, faturamento ${Math.round(fatMesmaJanela * 100)}%).`)
  if (endividamento?.alavancagemAtual != null && endividamento.alavancagemAnoAntes != null && endividamento.alavancagemAtual > endividamento.alavancagemAnoAntes * 1.1) atencao.push('Alavancagem subiu mais de 10% em 12 meses.')
  if (endividamento?.semSaldoNoFim) atencao.push(`${endividamento.semSaldoNoFim} ${endividamento.semSaldoNoFim === 1 ? 'mês final sem' : 'meses finais sem'} saldo de endividamento (provável mês ainda não fechado).`)

  return {
    suficiente: true,
    meses: fat.length, de: fat[0].rotulo, ate: fat.at(-1).rotulo,
    tendenciaAno, ritmoRecente, cv, melhor, pior, quedas, altas,
    variacao12m: i12?.variacao ?? null,
    sazonalidade, sazonalidadeCobertura: cobertos.length,
    atipicos: atipicos.slice(-4), atipicosTotal: atipicos.length,
    mesesJanela: ult.length, ajustada,
    endividamento,
    atencao,
  }
}

// Total curto para o quadro do período, como em apresentação: 23.400 (R$ mil) -> "R$ 23,4 MM".
export function totalCurto(v, unidade) {
  if (v == null) return '—'
  const u = semAcento(unidade ?? '').replace(/\s+/g, '')
  const mm = (x) => `R$ ${x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MM`
  if (u === 'r$mil') return Math.abs(v) >= 1000 ? mm(v / 1000) : `R$ ${Math.round(v).toLocaleString('pt-BR')} mil`
  if (u === 'r$milhoes' || u === 'r$mi') return mm(v)
  const n = v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return u.startsWith('r$') ? `R$ ${n}` : n
}

// Resumo por ano, só com os meses colados (como os quadros do DAC).
export function resumoPorAno(meses) {
  const anos = new Map()
  for (const m of meses) {
    if (m.faturamento == null) continue
    const a = anos.get(m.ano) ?? { ano: m.ano, meses: 0, total: 0 }
    a.meses += 1
    a.total += m.faturamento
    anos.set(m.ano, a)
  }
  return [...anos.values()].map((a) => ({ ...a, media: a.total / a.meses }))
}

// Exemplo fictício no modelo do DAC: título, cabeçalho com a unidade e traço para mês sem informação.
export const EXEMPLO = `Faturamento e endividamento
Competência	Faturamento (R$ mil)	Endividamento (R$ mil)
Jan/24	1.331	–
Fev/24	2.090	–
Mar/24	1.394	–
Abr/24	1.764	–
Mai/24	2.146	–
Jun/24	1.649	–
Jul/24	1.794	–
Ago/24	2.680	–
Set/24	2.508	–
Out/24	2.176	–
Nov/24	2.574	–
Dez/24	2.916	–
Jan/25	2.499	3.399
Fev/25	2.598	–
Mar/25	3.108	–
Abr/25	2.892	3.360
Mai/25	3.766	3.568
Jun/25	3.685	3.443
Jul/25	3.750	3.470
Ago/25	4.279	–
Set/25	3.970	3.796
Out/25	3.949	–
Nov/25	3.760	4.153
Dez/25	4.595	3.725
Jan/26	4.475	3.852
Fev/26	4.381	–
Mar/26	4.849	–
Abr/26	4.301	4.288
Mai/26	5.056	4.141
Jun/26	4.956	4.324
Jul/26	4.970	–
Ago/26	5.533	0
Set/26	5.024	0
Out/26	5.675	0`
