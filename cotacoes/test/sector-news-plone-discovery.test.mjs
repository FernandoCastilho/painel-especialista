import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ploneDiscoveryUrl, isPloneDiscoveryUrl, parsePloneDiscovery } from '../scripts/sector-news-safe/plone-discovery.mjs'
for (const id of ['aneel', 'susep']) {
  const fixture = JSON.parse(await readFile(new URL(`./fixtures/institutional-review/${id}-search.json`, import.meta.url)))
  test(`${id}: verified official discovery yields bounded original links only`, () => {
    const query = JSON.parse(new URL(ploneDiscoveryUrl(id)).searchParams.get('query'))
    assert.equal(query.b_size, 5); assert.equal(query.limit, 5); assert.equal(query.b_start, 0)
    const items = parsePloneDiscovery(JSON.stringify(fixture), id)
    assert.ok(items.length > 0 && items.length <= 5)
    for (const item of items) assert.deepEqual(Object.keys(item).sort(), ['link', 'title'])
    assert.equal(isPloneDiscoveryUrl(id, ploneDiscoveryUrl(id)), true)
    for (const url of [ploneDiscoveryUrl(id)+'&b_start=5', ploneDiscoveryUrl(id)+'#x', ploneDiscoveryUrl(id).replace('www.gov.br','other.test')]) assert.equal(isPloneDiscoveryUrl(id, url), false)
  })
  test(`${id}: malformed, oversized, foreign, unpublished and unsafe candidates fail closed`, () => {
    for (const body of ['<html>captcha</html>', 'null', '{}', 'x'.repeat(2_000_001)]) assert.throws(() => parsePloneDiscovery(body, id))
    for (const mutate of [d=>d.items_total=-1,d=>d.items.push(...d.items),d=>d['@id']='https://other.test/',d=>d.items[0].review_state='private',d=>d.items[0]['@type']='Document',d=>d.items[0]['@id']+='?x=1',d=>d.items[0]['@id']=d.items[0]['@id'].replace('/2026/','/%2e%2e/'),d=>d.items[0].title='<script>bad</script>']) {
      const data=structuredClone(fixture);mutate(data);assert.throws(()=>parsePloneDiscovery(JSON.stringify(data),id))
    }
  })
}
test('unreviewed sources cannot use this discovery adapter',()=>{
  for(const id of ['anvisa','mtur','ibge','mec','unknown','__proto__']) {
    assert.throws(()=>ploneDiscoveryUrl(id));assert.equal(isPloneDiscoveryUrl(id,'https://www.gov.br/'),false)
  }
})
