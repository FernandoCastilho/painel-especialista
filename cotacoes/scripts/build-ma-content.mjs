import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { validateMa, maDateLabel } from '../src/ma.js'

export function maNote(row, date) {
  validateMa([row])
  const title = `${row.buyer} → ${row.target}`
  return `---
title: ${JSON.stringify(title)}
data_criacao: ${date}
created: ${date}
updated: ${date}
atualizado_em: ${date}
atualizado_por: codex
type: query
tipo: transacao-ma
tags: [estrategia, setor, monitoramento]
sources: ${JSON.stringify([row.sourceUrl,...(row.locationSource ? [row.locationSource] : [])])}
confidence: medium
---
# ${title}

## Fatos registrados
- Comprador: ${row.buyer}
- Empresa ou ativo adquirido: ${row.target}
- Vendedor: ${row.seller || 'Não informado'}
- Setor: ${row.sector}; segmento: ${row.segment}
- Publicação: ${maDateLabel(row.publicationDate)}
- Anúncio: ${maDateLabel(row.announcementDate)}
- Conclusão: ${maDateLabel(row.completionDate)}
- Situação informada na notícia: ${row.status}
- Valor: ${row.value === null ? 'Não divulgado' : `${row.currency} ${row.value}`}
- Participação: ${row.stake || 'Não informada'}
- UF: ${row.uf || 'Sem UF confirmada'}. ${row.locationNote}

${row.summary}

## Histórico
${row.history.map(event => `- ${event.date}: ${event.text}`).join('\n')}

## Fontes e limites
- [Notícia original](${row.sourceUrl})
${row.locationSource ? `- [Fonte da localização](${row.locationSource})\n` : ''}- Registro histórico; não presume situação atual nem cobertura integral do mercado.
- Data secundária de atualização não constitui uma nova operação.
- Setor é classificação editorial pelo negócio da adquirida; ausências não foram estimadas.

## Relacionados
[[30. Recursos/LLM Wiki/concepts/ma-panorama|Panorama de M&A]] · [[30. Recursos/LLM Wiki/concepts/mapa-setorial|Mapa setorial]]

## Registro estruturado
O registro abaixo acompanha os fatos acima e permite preparar a consulta no painel. Atualizações preservam o histórico.

\`\`\`ma-registro
${JSON.stringify(row,null,2)}
\`\`\`
`
}
export function readMaNote(text) {
  const blocks = [...text.matchAll(/```ma-registro\r?\n([\s\S]*?)\r?\n```/g)]
  if (blocks.length !== 1) throw new Error('A nota deve conter exatamente um registro de M&A')
  const row = JSON.parse(blocks[0][1])
  validateMa([row])
  return row
}
export async function buildMaCatalog({ write = true, root = new URL('../../',import.meta.url) } = {}) {
  const meta = JSON.parse(await readFile(new URL('wiki/queries/ma/coverage.json',root),'utf8'))
  const directory = new URL('wiki/queries/ma/',root)
  const rows = []
  for (const year of (await readdir(directory,{withFileTypes:true})).filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))) {
    for (const name of (await readdir(new URL(`${year.name}/`,directory))).filter(name => name.endsWith('.md')).sort()) rows.push(readMaNote(await readFile(new URL(`${year.name}/${name}`,directory),'utf8')))
  }
  validateMa(rows)
  const result = {...meta,transactions:rows.sort((a,b) => b.publicationDate.localeCompare(a.publicationDate) || a.id.localeCompare(b.id))}
  if (write) await writeFile(new URL('cotacoes/src/ma/transactions.json',root),JSON.stringify(result,null,2) + '\n')
  return result
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await buildMaCatalog()
  console.log(`M&A: ${catalog.transactions.length} registros preparados a partir das notas históricas`)
}
