import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const snapshot = JSON.parse(readFileSync(new URL('../src/ibgeCbsSnapshot.json', import.meta.url)))
test('three IBGE populations are explicit and all published ratios reconcile to source cells', () => {
  assert.deepEqual(snapshot.datasets.map(d => d.kind).sort(), ['comercio', 'industria', 'servicos'])
  for (const dataset of snapshot.datasets) {
    assert.ok(dataset.population.length > 20)
    assert.ok(dataset.groups.length >= 5)
    assert.ok(Number.isFinite(Date.parse(dataset.retrievedAt)))
    assert.ok(dataset.query.includes(`/p/${dataset.year}/`))
    assert.ok(dataset.source.startsWith('https://sidra.ibge.gov.br/tabela/'))
    const ids = new Set()
    for (const g of dataset.groups) {
      assert.ok(!ids.has(g.id)); ids.add(g.id)
      const revenue = dataset.revenue.reduce((sum, id) => sum + g.values[id], 0)
      const spending = dataset.costs.reduce((sum, id) => sum + g.values[id], 0)
      assert.ok(revenue > 0 && Number.isFinite(revenue))
      assert.ok(spending >= 0 && Number.isFinite(spending))
      assert.equal(g.revenueThousands, revenue)
      assert.equal(g.spendingThousands, spending)
      assert.equal(g.spendingRatio, spending / revenue)
      assert.ok(dataset.revenue.every(id => !dataset.costs.includes(id)))
    }
  }
})
test('IBGE outage preserves previous source dates and values; incomplete first run writes nothing', () => {
  const script = new URL('../scripts/fetch-ibge-cbs.py', import.meta.url).pathname
  const result = spawnSync('python3', ['-c', `
import importlib.util,json,pathlib,tempfile
spec=importlib.util.spec_from_file_location('collector',${JSON.stringify(script)})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def fail(*args): raise OSError('offline test')
m.read_json=fail
with tempfile.TemporaryDirectory() as tmp:
 m.DEST=pathlib.Path(tmp)/'snapshot.json'
 try:m.main();raise AssertionError('must fail first run')
 except SystemExit:pass
 assert not m.DEST.exists()
 old={'schemaVersion':1,'datasets':[{'kind':s['kind'],'retrievedAt':'2026-11-01','groups':[{'value':123}]} for s in m.SPECS]}
 m.DEST.write_text(json.dumps(old));before=m.DEST.read_bytes();m.main()
 assert m.DEST.read_bytes()==before
`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /::warning title=IBGE CBS/)
})

test('routine publication validates preserved CBS data without network requests or writes', () => {
  const script = new URL('../scripts/fetch-ibge-cbs.py', import.meta.url).pathname
  const result = spawnSync('python3', ['-c', `
import pathlib,runpy,sys,urllib.request
script=${JSON.stringify(script)}
dest=pathlib.Path(script).resolve().parents[1]/'src'/'ibgeCbsSnapshot.json'
before=dest.read_bytes()
def forbidden(*args,**kwargs):raise AssertionError('A suspended collector must never access the network')
urllib.request.urlopen=forbidden
sys.argv=[script]
runpy.run_path(script,run_name='__main__')
assert dest.read_bytes()==before
`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Nenhuma consulta externa realizada/)
  assert.match(result.stdout, /::notice title=IBGE CBS/)
  for (const kind of ['comercio', 'industria', 'servicos']) assert.match(result.stdout, new RegExp(`IBGE ${kind}: base`))
  const workflow = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  assert.match(workflow, /name: Validar base preservada da CBS \(coleta IBGE suspensa\)/)
  assert.match(workflow, /run: python3 scripts\/fetch-ibge-cbs\.py\s*\n/)
  assert.doesNotMatch(workflow, /run:.*fetch-ibge-cbs\.py.*--refresh/)
})

test('CBS discloses preserved year and valid collection date independently from editable spending', () => {
  const source = readFileSync(new URL('../src/CbsCaixa.jsx', import.meta.url), 'utf8')
  assert.match(source, /role="note" aria-label="Atualização da referência IBGE"/)
  assert.match(source, /Base preservada · IBGE \{dataset.year\}/)
  assert.match(source, /Atualização automática suspensa após falha de acesso ao IBGE \(HTTP 403\)/)
  assert.match(source, /Última coleta válida: \{new Date\(dataset.retrievedAt\)/)
  assert.match(source, /Não é uma consulta em tempo real/)
})
