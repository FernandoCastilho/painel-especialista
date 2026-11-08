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
 m.DEST.write_text(json.dumps(old));m.main()
 assert json.loads(m.DEST.read_text())==old
`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.equal(result.status, 0, result.stderr)
})
