import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// Run the actual collector in isolation, never editing the checked-in snapshot.
test('collector preserves porte on denied report, clears valid empty data and recovers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bank-collector-'))
  try {
    for (const sub of ['scripts', 'src', 'public']) await mkdir(join(dir, sub))
    for (const path of ['scripts/fetch-bancos.mjs', 'scripts/bancos-lib.mjs', 'scripts/bancos-transport.mjs', 'src/bancos.js']) {
      await copyFile(new URL('../' + path, import.meta.url), join(dir, path))
    }
    await writeFile(join(dir, 'package.json'), '{"type":"module"}')
    const originalPorte = [{ name: 'Micro', value: 12, source: 'https://olinda.bcb.gov.br/original' }]
    const snapshot = { banks: [{ id: 'itau', observations: [{ id: 'itau', period: 202606, origin: 'bc', metrics: { creditPF: { value: 99 } }, porte: originalPorte }] }] }
    const run = async mode => {
      await writeFile(join(dir, 'public/bancos.json'), JSON.stringify(snapshot))
      await writeFile(join(dir, 'public/bancos-ri.json'), '{"reviewedAt":"2026-11-07","banks":{}}')
      const harness = `
        const NativeDate = Date;
        globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : ['2026-11-08T12:00:00Z'])); } };
        let deniedCalls = 0;
        globalThis.fetch = async url => {
          const u = new URL(url), period = Number(u.searchParams.get('@AnoMes')), report = u.searchParams.get('@Relatorio');
          if (report === "'14'" && '${mode}' === 'denied') { deniedCalls++; return { ok: false, status: 403 }; }
          const value = report === "'1'" && period <= 202606 ? [{CodInst:'C0080099',Conta:'140220',Saldo:123}] : report === "'14'" && '${mode}' === 'recovered' ? [{CodInst:'C0080099',Conta:'23363',NomeColuna:'Micro',Saldo:42}] : [];
          return {ok:true,text:async()=>JSON.stringify({value})};
        };
        await import('./scripts/fetch-bancos.mjs');
        console.log('deniedCalls=' + deniedCalls);
      `
      await writeFile(join(dir, 'run.mjs'), harness)
      const log = execFileSync(process.execPath, [join(dir, 'run.mjs')], { encoding: 'utf8', env: { ...process.env, BANKS_CURL: '', BANKS_CACHE_DIR: '' } })
      return { data: JSON.parse(await readFile(join(dir, 'public/bancos.json'), 'utf8')), log }
    }
    const denied = await run('denied')
    assert.deepEqual(denied.data.banks[0].observations.find(x => x.period === 202606).porte, originalPorte)
    assert.equal(denied.data.stale, true)
    assert.ok(denied.data.errors.every(x => x.includes('relatório 14: HTTP 403')))
    assert.match(denied.log, new RegExp('deniedCalls=' + denied.data.errors.length))
    const empty = await run('empty')
    assert.deepEqual(empty.data.banks[0].observations.find(x => x.period === 202606).porte, [])
    assert.equal(empty.data.stale, false)
    const recovered = await run('recovered')
    assert.equal(recovered.data.banks[0].observations.find(x => x.period === 202606).porte[0].value, 42)
    assert.equal(recovered.data.stale, false)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
