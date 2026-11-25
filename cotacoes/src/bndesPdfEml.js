import { base64Utf8, nomeDeArquivo } from './emlOutlook.js'
import { nbr5891 } from './format.js'

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

// PDF em texto, local e pesquisável, com fontes básicas e codificação para acentos PT-BR.
const hex = texto => Array.from(texto.replace(/—|−/g, '-').normalize('NFC'), c => {
  const n = c.charCodeAt(0)
  return (n >= 32 && n <= 255 ? n : 63).toString(16).padStart(2, '0')
}).join('')
const txt = (s, x, y, size = 10, fonte = 'R') => 'BT /' + fonte + ' ' + size + ' Tf 1 0 0 1 ' + x + ' ' + y + ' Tm <' + hex(s) + '> Tj ET'
const pagina = (titulo, nome, detalhes, indice, linhas) => [
  '0.06 0.18 0.38 rg', txt('BNDES Finame | Simulação de financiamento', 42, 796, 17, 'B'),
  txt(nome, 42, 771, 12, 'B'), '0.1 0.15 0.23 rg',
  ...detalhes.map((s, i) => txt(s, i % 2 ? 308 : 42, 736 - 16 * Math.floor(i / 2), 9)),
  ...indice.map((s, i) => txt(s, 42, 607 - i * 11, 8)),
  txt(titulo, 42, 575, 10, 'B'),
  '0.8 0.85 0.91 RG 42 565 m 553 565 l S',
  ...tabelaLinhas(linhas),
  '0.3 0.35 0.43 rg', txt(nota, 42, 46, 9),
].join('\n')

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
function tabelaLinhas(linhas) {
  const numericas = linhas[0].length - 1
  const largura = 418 / numericas
  const max = Math.max(...linhas.flatMap(r => r.slice(1).map(s => s.length)))
  const fonte = Math.min(9, (largura - 6) / (max * .6))
  return linhas.flatMap(([data, ...numeros], i) => {
    const y = 549 - 17 * i
    return [txt(data, 42, y, 9, 'M'), ...numeros.map((s, k) => txt(s, 553 - largura * (numericas - k - 1) - s.length * fonte * .6, y, fonte, 'M'))]
  })
}

export function bndesPdfEml({ itens }) {
  if (!itens?.length) throw new Error('Cotação sem resultado')
  const corpo = ['Olá,', '', 'Segue a simulação BNDES Finame em anexo.', '',
    ...itens.flatMap((item, i) => [nomeOpcao(item, i, itens.length), ...resumo(item).map(linha => '• ' + emLinha(linha)), '']), nota].join('\r\n')
  const paginas = itens.flatMap((item, i) => {
    const corrige = item.parcelas?.some(p => Number.isFinite(p.correcao) && p.correcao !== 0)
    const linhas = cronograma(item, corrige)
    const indice = item.indice ? [
      item.indice.rotulo + ' (cenário da simulação)',
      ...item.indice.trajetoria.reduce((lines, { ano, valor }, j) => {
        const dado = ano + ': ' + (item.custo === 'tfbd' ? brl(valor) : taxa(valor))
        if (j % 5 === 0) lines.push(dado)
        else lines[lines.length - 1] += ' · ' + dado
        return lines
      }, []),
    ] : []
    const detalhes = [...resumo(item), ['Condições', (item.amortizacao || 'SAC') + ' · juros ' + (item.periodicidade || '—')], ['Liberação', item.liberacao || '—'],
      ['Taxa final', taxa(item.taxa)], ['Total estimado', brl(item.total)], ['IOF', brl(item.iof)], ['Garantia FGI (ECG)', brl(item.fgi?.ecg ?? 0)],
      ...(item.indice ? [['CET da parte fixa (sem índice)', taxa(item.cetFixo?.anual)]] : []),
    ].map(emLinha)
    const tamanho = 28
    return Array.from({ length: Math.max(1, Math.ceil(linhas.length / tamanho)) }, (_, p) =>
      pagina('Cronograma de pagamentos | ' + (p + 1) + '/' + Math.max(1, Math.ceil(linhas.length / tamanho)), nomeOpcao(item, i, itens.length),
        p === 0 ? detalhes : [], p === 0 ? indice : [], [['Nº e vencimento', ...(corrige ? ['Correção'] : []), 'Juros', 'Amortização', 'Parcela', 'Saldo'], ...linhas.slice(p * tamanho, (p + 1) * tamanho)]))
  })
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
