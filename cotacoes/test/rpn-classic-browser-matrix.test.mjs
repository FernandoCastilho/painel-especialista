import test from 'node:test'
import assert from 'node:assert/strict'
import fixtures from '../scripts/rpn-classic-browser-vectors.cjs'
import { CLASSIC_KEYS, createClassicRpnController } from '../src/rpnClassicController.mjs'

test('matriz browser enumera à parte todos os mapeamentos clássicos e cada um tem vetor',()=>{
  const c=createClassicRpnController()
  const supported=[
    ...CLASSIC_KEYS,
    ...CLASSIC_KEYS.flatMap(id=>['f','g'].filter(layer=>!['f','g','on'].includes(id)&&c.isSupported(id,layer))
      .map(layer=>layer+':'+id)),
  ].sort()
  assert.deepEqual(fixtures.required,supported)
  assert.equal(new Set(fixtures.required).size,96)
  assert.equal(new Set(fixtures.cases.map(c=>c.name)).size,fixtures.cases.length)
  for(const mapped of supported){
    const [prefix,id]=mapped.includes(':')?mapped.split(':'):[null,mapped]
    assert.ok(fixtures.cases.some(row=>row.coverage.includes(mapped)&&row.steps.some((step,i)=>
      step.kind==='key'&&step.id===id&&(!prefix||row.steps[i-1]?.id===prefix))),mapped)
  }
})

test('o número deve sair no formato apresentado, não em JSON interno, e a tolerância segue o arredondamento exibido',()=>{
  const { parseDisplay, displayedTolerance }=fixtures
  assert.equal(parseDisplay('−25.001,123'),-25001.123)
  assert.equal(parseDisplay('2,86E-10'),2.86e-10)
  assert.equal(parseDisplay('4,0'),4)
  assert.equal(parseDisplay('4,'),4)
  assert.ok(Number.isNaN(parseDisplay('1.23')))
  assert.ok(Number.isNaN(parseDisplay('25,11,4046 1')))
  assert.ok(Number.isNaN(parseDisplay('')))
  assert.ok(displayedTolerance('0,001')<.000501)
  assert.ok(displayedTolerance('2,86E-10')<.000000000000501)
})

test('CI executa a matriz sem tolerar falhas e tenta preservar relatório mesmo se a prévia não abrir', async () => {
  const { readFile } = await import('node:fs/promises')
  const workflow=await readFile(new URL('../../.github/workflows/cotacoes-ci.yml',import.meta.url),'utf8')
  const calc=workflow.split('\n  smoke-calculadoras:\n')[1].split('\n  smoke-navegacao:')[0]
  const pre=calc.split('      - name: Preparar relatório da matriz RPN\n')[1].split('      - name: ')[0]
  const matrix=calc.split('      - name: Testar funções da RPN clássica em Chrome\n')[1].split('      - name: ')[0]
  const upload=calc.split('      - name: Evidências da matriz da RPN clássica\n')[1].split('      - name: ')[0]
  assert.match(calc,/SMOKE_CHANNEL: chrome/)
  assert.match(pre,/if: always\(\)/)
  assert.match(pre,/"state":"not-started"/)
  assert.match(pre,/qa-universal\/rpn-classic-matrix\/report\.json/)
  assert.match(matrix,/!cancelled\(\) && steps\.serve\.outcome == 'success'/)
  assert.match(matrix,/node scripts\/smoke-rpn-classic-matrix\.cjs/)
  assert.doesNotMatch(matrix,/continue-on-error|\|\| true/)
  assert.match(upload,/if: always\(\)/)
  assert.match(upload,/actions\/upload-artifact@v4/)
  assert.match(upload,/runner\.temp \}\}\/qa-universal\/rpn-classic-matrix/)
  assert.match(upload,/if-no-files-found: error/)
})
