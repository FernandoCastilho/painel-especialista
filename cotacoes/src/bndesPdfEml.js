import { base64Utf8, nomeDeArquivo } from './emlOutlook.js'
import { nbr5891 } from './format.js'
import { marcasRedondas } from './chartEixo.js'
import { AVISOS_CDC } from './cdcEmail.js'

const brl = v => Number.isFinite(v) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v).replace(/\s/g, ' ') : '—'
const taxa = v => Number.isFinite(v) ? nbr5891(v, 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '% a.a.' : '—'
const meses = n => n + (n === 1 ? ' mês' : ' meses')
const dmy = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : (iso || '—')
const rotulos = { tfb: 'TFB', tfc: 'TFC', tlp: 'TLP (parte fixa J)', lcd: 'Sobretaxa LCD', tfbd: 'TFBD (taxa fixa)' }
const nomeOpcao = (item, i, total) => total > 1 ? 'Opção ' + String.fromCharCode(65 + i) + ' · ' + rotulos[item.custo] : rotulos[item.custo]
const nota = 'Simulação indicativa, sujeita à análise e aprovação. O CET estimado não substitui o CET contratual.'
const resumo = item => [
  ['Valor financiado', brl(item.valor)], ['Prazo', meses(item.prazo)], ['Carência', meses(item.carencia)],
  [rotulos[item.custo], taxa(item.custoFinanceiro)], ['Taxa do BNDES', taxa(item.taxaBndes)], ['Spread do agente financeiro', taxa(item.taxaAgente)],
  ['TAC', brl(item.tac)], [item.indice ? 'CET estimado com índice' : 'CET estimado', taxa(item.cet)],
]
const emLinha = ([rotulo, valor]) => rotulo + ': ' + valor
const NOTA_HISTORICO = 'DI: taxa DI de cada dia útil (CDI, % a.a., base 252). Indexador: referência pública publicada pelo BNDES em cada data. Cada linha usa as datas da própria fonte, no mesmo eixo de tempo. Histórico, não projeção: a simulação usa a taxa de referência em vigor.'

// PDF em texto, local e pesquisável, com fontes básicas e codificação para acentos PT-BR.
// Fora do Latin-1, só os sinais que existem na codificação WinAnsi das fontes básicas (marcador e aspas).
const WIN_ANSI = { '•': 0x95, '–': 0x96, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94 }
const hex = texto => Array.from(texto.replace(/—|−/g, '-').normalize('NFC'), c => {
  const n = WIN_ANSI[c] ?? c.charCodeAt(0)
  return (n >= 32 && n <= 255 ? n : 63).toString(16).padStart(2, '0')
}).join('')
const txt = (s, x, y, size = 10, fonte = 'R') => 'BT /' + fonte + ' ' + size + ' Tf 1 0 0 1 ' + x + ' ' + y + ' Tm <' + hex(s) + '> Tj ET'
const cabecalho = nome => ['0.06 0.18 0.38 rg', txt('BNDES Finame | Simulação de financiamento', 42, 796, 17, 'B'),
  ...(nome ? [txt(nome, 42, 771, 12, 'B')] : []), '0.1 0.15 0.23 rg']
const rodape = ['0.3 0.35 0.43 rg', txt(nota, 42, 46, 9)]
const secao = (titulo, y) => ['0.06 0.18 0.38 rg', txt(titulo, 42, y, 10, 'B'), '0.8 0.85 0.91 RG 42 ' + (y - 5) + ' m 553 ' + (y - 5) + ' l S', '0.1 0.15 0.23 rg']

// Quebra um texto em linhas de até `largura` caracteres, sem cortar palavras.
export function quebrar(texto, largura = 104) {
  return texto.split(' ').reduce((linhas, palavra) => {
    const atual = linhas[linhas.length - 1]
    if (atual && (atual + ' ' + palavra).length <= largura) linhas[linhas.length - 1] = atual + ' ' + palavra
    else linhas.push(palavra)
    return linhas
  }, [])
}

function pdfDasPaginas(paginas) {
  const ids = paginas.map((_, i) => (6 + 2 * i) + ' 0 R')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [' + ids.join(' ') + '] /Count ' + paginas.length + ' >>',
    ...['Helvetica', 'Helvetica-Bold', 'Courier'].map(font => '<< /Type /Font /Subtype /Type1 /BaseFont /' + font + ' /Encoding /WinAnsiEncoding >>'),
    ...paginas.flatMap((stream, i) => [
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /R 3 0 R /B 4 0 R /M 5 0 R >> >> /Contents ' + (7 + 2 * i) + ' 0 R >>',
      '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
    ]),
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objs.map((obj, i) => {
    const offset = pdf.length
    pdf += (i + 1) + ' 0 obj\n' + obj + '\nendobj\n'
    return offset
  })
  return pdf + 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offsets.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')
    + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + pdf.length + '\n%%EOF\n'
}

const cronograma = (item, corrige) => (item.parcelas || []).map((p, i) => [(p.mes ?? i + 1) + '  ' + dmy(p.vencimento),
  ...(corrige ? [brl(p.correcao)] : []), brl(p.juros), brl(p.amortizacao), brl(p.parcela), brl(p.saldo),
])
const ALTURA_LINHA = 17
const LIMITE_TABELA = 70
function tabelaLinhas(linhas, topo) {
  const numericas = linhas[0].length - 1
  const largura = 418 / numericas
  const max = Math.max(...linhas.flatMap(r => r.slice(1).map(s => s.length)))
  const fonte = Math.min(9, (largura - 6) / (max * .6))
  return linhas.flatMap(([data, ...numeros], i) => {
    const y = topo - ALTURA_LINHA * i
    return [txt(data, 42, y, 9, 'M'), ...numeros.map((s, k) => txt(s, 553 - largura * (numericas - k - 1) - s.length * fonte * .6, y, fonte, 'M'))]
  })
}

// Dados da operação em três grupos, duas colunas por grupo. Devolve as instruções e a altura usada.
function blocosResumo(item, y) {
  const grupos = [
    ['Operação', [['Valor financiado', brl(item.valor)], ['Prazo', meses(item.prazo)], ['Carência', meses(item.carencia)], ['Liberação', item.liberacao || '—'],
      ['Amortização', String(item.amortizacao || 'SAC').toUpperCase()], ['Juros na carência', item.periodicidade || '—']]],
    ['Taxas', [[rotulos[item.custo], taxa(item.custoFinanceiro)], ['Taxa do BNDES', taxa(item.taxaBndes)], ['Spread do agente financeiro', taxa(item.taxaAgente)], ['Taxa final', taxa(item.taxa)]]],
    ['Custo para o cliente', [[item.indice ? 'CET estimado com índice' : 'CET estimado', taxa(item.cet)], ['Total estimado', brl(item.total)],
      ...(item.indice ? [['CET da parte fixa (sem índice)', taxa(item.cetFixo?.anual)]] : []),
      ['TAC', brl(item.tac)], ['IOF', brl(item.iof)], ['Garantia FGI (ECG)', brl(item.fgi?.ecg ?? 0)]]],
  ]
  const ops = []
  for (const [titulo, linhas] of grupos) {
    ops.push(...secao(titulo, y))
    y -= 20
    linhas.forEach((linha, i) => ops.push(txt(emLinha(linha), i % 2 ? 308 : 42, y - 15 * Math.floor(i / 2), 9)))
    y -= 15 * Math.ceil(linhas.length / 2) + 12
  }
  return { ops, y }
}

const CORES = ['0.06 0.18 0.38', '0.93 0.42 0.05', '0.05 0.55 0.5', '0.55 0.2 0.6']
const dataCurta = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4)
const nfPct = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

// Gráfico de linhas do histórico (mesmo período e mesma unidade da tela). Cada série mantém as próprias datas;
// o eixo horizontal é o tempo, então séries com frequências diferentes ficam alinhadas pela data.
export function graficoHistorico(historico, topo) {
  const series = (historico?.series || []).map(s => ({ ...s, pontos: (s.pontos || []).filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v)) })).filter(s => s.pontos.length > 1)
  if (!series.length) return null
  const tempo = d => Date.parse(d + 'T12:00:00Z')
  const todos = series.flatMap(s => s.pontos)
  const t0 = Math.min(...todos.map(([d]) => tempo(d))), t1 = Math.max(...todos.map(([d]) => tempo(d)))
  const { ticks, lo, hi, casas } = marcasRedondas(Math.min(...todos.map(([, v]) => v)), Math.max(...todos.map(([, v]) => v)))
  const esq = 78, dir = 553, base = topo - 230, alto = topo - 18 - 13 * series.length
  const x = t => esq + (t1 > t0 ? (t - t0) / (t1 - t0) : .5) * (dir - esq)
  const yy = v => base + (v - lo) / (hi - lo || 1) * (alto - base)
  const f = n => n.toFixed(1)
  const ops = []
  // Legenda: cor, nome, último valor e média do período.
  series.forEach((s, i) => {
    const ly = topo - 10 - 13 * i
    const media = s.pontos.reduce((soma, [, v]) => soma + v, 0) / s.pontos.length
    const ultimo = s.pontos[s.pontos.length - 1]
    ops.push(CORES[i % CORES.length] + ' rg ' + esq + ' ' + (ly - 1) + ' 14 6 re f', '0.1 0.15 0.23 rg',
      txt(s.nome + ' | último ' + nfPct(ultimo[1]) + '% em ' + dmy(ultimo[0]) + ' | média ' + nfPct(media) + '%', esq + 20, ly, 8))
  })
  ticks.forEach(v => ops.push('0.88 0.9 0.94 RG 0.5 w ' + esq + ' ' + f(yy(v)) + ' m ' + dir + ' ' + f(yy(v)) + ' l S', '0.3 0.35 0.43 rg',
    txt(nfPct(v, casas) + '%', 42, yy(v) - 3, 7)))
  // Marcas de data: início, fim e quatro intermediárias.
  for (let k = 0; k <= 5; k++) {
    const t = t0 + (t1 - t0) * k / 5
    const rotulo = dataCurta(new Date(t).toISOString().slice(0, 10))
    ops.push('0.3 0.35 0.43 rg', txt(rotulo, Math.min(dir - 30, Math.max(esq, x(t) - 15)), base - 14, 7))
  }
  ops.push('0.55 0.6 0.68 RG 0.8 w ' + esq + ' ' + base + ' m ' + dir + ' ' + base + ' l S')
  series.forEach((s, i) => {
    const traco = s.pontos.map(([d, v], k) => f(x(tempo(d))) + ' ' + f(yy(v)) + (k ? ' l' : ' m')).join(' ')
    ops.push(CORES[i % CORES.length] + ' RG 1.4 w 1 j ' + traco + ' S')
  })
  ops.push('1 w', '0.1 0.15 0.23 rg')
  return { ops, y: base - 30 }
}

export function bndesPdfEml({ itens, historico = null }) {
  if (!itens?.length) throw new Error('Cotação sem resultado')
  const corpo = ['Olá,', '', 'Segue a simulação BNDES Finame em anexo.', '',
    ...itens.flatMap((item, i) => [nomeOpcao(item, i, itens.length), ...resumo(item).map(linha => '• ' + emLinha(linha)), '']), nota].join('\r\n')
  const paginas = itens.flatMap((item, i) => {
    const corrige = item.parcelas?.some(p => Number.isFinite(p.correcao) && p.correcao !== 0)
    const cabecalhoTabela = ['Nº e vencimento', ...(corrige ? ['Correção'] : []), 'Juros', 'Amortização', 'Parcela', 'Saldo']
    const nome = nomeOpcao(item, i, itens.length)
    let { ops, y } = blocosResumo(item, 745)
    if (item.indice) {
      const indice = [item.indice.rotulo + ' (cenário da simulação)', ...item.indice.trajetoria.reduce((lines, { ano, valor }, j) => {
        const dado = ano + ': ' + (item.custo === 'tfbd' ? brl(valor) : taxa(valor))
        if (j % 5 === 0) lines.push(dado)
        else lines[lines.length - 1] += ' · ' + dado
        return lines
      }, [])]
      indice.forEach((linha, k) => ops.push(txt(linha, 42, y - k * 11, 8)))
      y -= indice.length * 11 + 10
    }
    // Cronograma: no primeiro quadro, as linhas que cabem abaixo do resumo; depois, páginas cheias.
    const partes = []
    let resto = cronograma(item, corrige)
    let topo = y
    do {
      const cabe = Math.max(1, Math.floor((topo - 26 - LIMITE_TABELA) / ALTURA_LINHA))
      partes.push({ ops, topo, linhas: resto.slice(0, cabe) })
      resto = resto.slice(cabe)
      ops = []
      topo = 745
    } while (resto.length)
    return partes.map((parte, p) => [...cabecalho(nome), ...parte.ops,
      ...secao('Cronograma de pagamentos | ' + (p + 1) + '/' + partes.length, parte.topo),
      ...tabelaLinhas([cabecalhoTabela, ...parte.linhas], parte.topo - 26), ...rodape].join('\n'))
  })
  // Por último: histórico do indexador ao lado do DI e os avisos (os mesmos do CDC).
  const final = cabecalho()
  let y = 765
  const grafico = graficoHistorico(historico, y - 20)
  if (grafico) {
    final.push(...secao('Histórico do DI e do indexador (% a.a.) | ' + (historico.inicio && historico.fim ? dmy(historico.inicio) + ' a ' + dmy(historico.fim) : 'últimos 12 meses'), y), ...grafico.ops)
    y = grafico.y
    for (const linha of quebrar(NOTA_HISTORICO, 150)) { final.push('0.3 0.35 0.43 rg', txt(linha, 42, y, 7.5)); y -= 10 }
    y -= 16
  }
  final.push(...secao('Avisos importantes', y))
  y -= 20
  for (const aviso of AVISOS_CDC) {
    quebrar(aviso, 112).forEach((linha, k) => { final.push('0.1 0.15 0.23 rg', txt((k ? '   ' : '• ') + linha, 42, y, 9)); y -= 13 })
    y -= 3
  }
  paginas.push([...final, ...rodape].join('\n'))
  const fronteira = 'painel-pdf-' + Math.random().toString(36).slice(2)
  const assunto = 'BNDES Finame | Simulação de ' + brl(itens[0].valor) + ' | ' + meses(itens[0].prazo)
  const nome = nomeDeArquivo('BNDES Finame - Simulacao com PDF')
  const encodedSubject = base64Utf8(assunto).replace(/\r\n/g, '')
  return { nome, conteudo: [
    'MIME-Version: 1.0', 'X-Unsent: 1', 'Subject: =?UTF-8?B?' + encodedSubject + '?=',
    'Content-Type: multipart/mixed; boundary="' + fronteira + '"', '', '--' + fronteira,
    'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', base64Utf8(corpo),
    '--' + fronteira, 'Content-Type: application/pdf; name="BNDES-Finame-Simulacao.pdf"', 'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="BNDES-Finame-Simulacao.pdf"', '', base64Utf8(pdfDasPaginas(paginas)),
    '--' + fronteira + '--', '',
  ].join('\r\n') }
}
