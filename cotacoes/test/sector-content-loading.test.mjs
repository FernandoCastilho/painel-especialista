import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildSectorContent } from '../scripts/build-sector-content.mjs'

test('every runtime study remains an exact copy of its reviewed source; obsolete generated files disappear', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'sector-content-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const root = pathToFileURL(directory + '/')
  await mkdir(new URL('src/sectorStudies/', root), { recursive: true })
  const source = await readFile(new URL('../src/sectorStudies/studies.json', import.meta.url), 'utf8')
  const studies = JSON.parse(source)
  await writeFile(new URL('src/sectorStudies/studies.json', root), source)
  await mkdir(new URL('public/sector-studies/', root), { recursive: true })
  await writeFile(new URL('public/sector-studies/obsolete.json', root), '{}')
  const result = await buildSectorContent(root)
  assert.equal(result.count, studies.length)
  const files = await readdir(new URL('public/sector-studies/', root))
  assert.equal(files.length, studies.length)
  const catalog = JSON.parse(await readFile(new URL('src/sectorStudies/catalog.generated.json', root), 'utf8'))
  for (const study of studies) {
    const key = `${study.group}-${study.topicIndex}`
    assert.ok(catalog.includes(key))
    const runtime = JSON.parse(await readFile(new URL(`public/sector-studies/${key}.json`, root), 'utf8'))
    assert.deepEqual(runtime, study, `${key}: source content changed`)
  }
  assert.equal(await readFile(new URL('src/sectorStudies/studies.json', root), 'utf8'), source)
})
