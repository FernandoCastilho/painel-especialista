import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// 15/11/2026: a etapa "Coletar TFC e moedas contratuais do BNDES" foi interrompida em 8 min e o site ficou sem moedas.json.
// A coleta precisa terminar (e gravar o arquivo, com o último dado válido no que faltar) antes do limite da etapa.
test('coleta de TFC e moedas tem prazo total menor que o limite da etapa e sempre grava o arquivo', async () => {
  const script = await readFile(new URL('../scripts/fetch-moedas.mjs', import.meta.url), 'utf8')
  const workflow = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const prazo = Number(script.match(/PRAZO_MS = Number\(process\.env\.MOEDAS_PRAZO_MS\) \|\| (\d+) \* 60e3/)?.[1])
  const etapa = workflow.match(/name: Coletar TFC e moedas contratuais do BNDES[\s\S]*?timeout-minutes: (\d+)/)?.[1]
  assert.ok(prazo > 0 && Number(etapa) > 0, 'prazo e limite encontrados')
  assert.ok(prazo + 1 <= Number(etapa), `prazo de ${prazo} min deixa ao menos 1 min antes do limite de ${etapa} min`)
  assert.match(script, /signal: AbortSignal\.timeout\(Math\.min\(40000, restante\(\)\)\)/)
  assert.ok(script.indexOf("writeFile(new URL('../public/moedas.json'") > script.indexOf('for (const { id, name } of MOEDAS_CATALOG)'), 'grava depois do laço, sempre')
})
