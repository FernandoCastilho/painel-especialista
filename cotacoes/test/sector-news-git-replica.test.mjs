import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, rm, chmod, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalGitStoreForTests } from '../scripts/sector-news-safe/git-store.mjs'
import { createSimulationState, digest, STATE_REF, FEED_REF } from '../scripts/sector-news-safe/state.mjs'
const exec = promisify(execFile)
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'git-store-test-')), remote = join(directory, 'remote.git'), working = join(directory, 'seed')
  await mkdir(working)
  t.after(() => rm(directory, { recursive: true, force: true }))
  const git = async (args, cwd = working) => (await exec('git', args, { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } })).stdout.trim()
  await git(['init', '--bare', '--quiet', remote])
  await git(['init', '--quiet'])
  await git(['config', 'user.name', 'Fixture'])
  await git(['config', 'user.email', 'fixture@example.invalid'])
  const state = { ...createSimulationState({ storeId: 'git-test', now: Date.parse('2026-11-08T12:00:00Z') }), environment: 'production' }
  const feed = { schemaVersion: 1, topics: {}, sourceStates: {} }
  async function seed(kind, payload, ref) {
    await git(['checkout', '--orphan', kind])
    await writeFile(join(working, 'record.json'), JSON.stringify({ kind, parent: null, digest: digest(payload), payload }))
    await git(['add', 'record.json'])
    if (kind === 'feed') { await writeFile(join(working, 'sector-news.json'), JSON.stringify(payload)); await git(['add', 'sector-news.json']) }
    await git(['commit', '--quiet', '-m', 'Explicit fixture bootstrap'])
    const root = await git(['rev-parse', 'HEAD'])
    await git(['push', '--quiet', remote, `${root}:${ref}`])
    return root
  }
  const rootToken = await seed('state', state, STATE_REF), feedRootToken = await seed('feed', feed, FEED_REF)
  let protection = true, checks = 0
  const connect = (options = {}) => createLocalGitStoreForTests({ ...options, remote, rootToken, feedRootToken, storeId: 'git-test', verifyProtection: async () => { checks++; if (options.checkProtection) await options.checkProtection(); if (!protection) throw Error('protection_mismatch') } })
  const connection = connect(); t.after(() => connection.close())
  return { ...connection, state, feed, connect, rootToken, git, remote, working, get checks() { return checks }, set protection(value) { protection = value } }
}


// Isolated executable shim models stale replica reads without network calls or production hooks.
async function replica(t, f, mode) {
  const dir = await mkdtemp(join(tmpdir(), 'replica-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const real = (await exec('which', ['git'])).stdout.trim()
  const script = `#!/usr/bin/env node
const fs=require('node:fs'), cp=require('node:child_process');
const args=process.argv.slice(2), real=${JSON.stringify(real)}, dir=${JSON.stringify(dir)};
const go=()=>cp.spawnSync(real,args,{input:fs.readFileSync(0),encoding:'utf8'});
if(args[0]==='fetch' && fs.existsSync(dir+'/pushed')) {
 let n=Number(fs.existsSync(dir+'/reads')?fs.readFileSync(dir+'/reads','utf8'):0)+1;
 fs.writeFileSync(dir+'/reads',String(n));
 if(${JSON.stringify(mode)}==='exhaust' || (${JSON.stringify(mode)}==='delay' && n<=2)) process.exit(0);
}
const r=go();process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
if(args[0]==='push' && r.status===0){
 fs.writeFileSync(dir+'/pushed',String(Number(fs.existsSync(dir+'/pushed')?fs.readFileSync(dir+'/pushed','utf8'):0)+1));
 if(${JSON.stringify(mode)}==='concurrent') {
 const [commit,ref]=args.at(-1).split(':'); const remote=args.at(-2);
 const tree=cp.execFileSync(real,['show','-s','--format=%T',commit],{encoding:'utf8'}).trim();
 const next=cp.execFileSync(real,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree,'-p',commit],{input:'Concurrent fixture\\n',encoding:'utf8'}).trim();
 cp.execFileSync(real,['push','--quiet',remote,next+':'+ref]);
 }
}
process.exit(r.status??1);
`
  await writeFile(join(dir, 'git'), script); await chmod(join(dir, 'git'), 0o755)
  const old = process.env.PATH
  process.env.PATH = dir + ':' + old
  let connection
  try { connection = f.connect({confirmDelayMs: 0}) } finally { process.env.PATH = old }
  t.after(() => connection.close())
  return {connection, reads: async () => Number(await readFile(join(dir, 'reads'), 'utf8')), pushes: async () => Number(await readFile(join(dir, 'pushed'), 'utf8'))}
}
test('confirmation retries stale parent and succeeds on third read without a second push', async t => {
  const f=await fixture(t), {connection:c,reads,pushes}=await replica(t,f,'delay')
  const before=await c.store.read()
  const result=await c.store.compareAndSwap(before.token,{...before.state,revision:1})
  assert.equal(result.state.revision,1)
  assert.equal(await f.git(['rev-parse',result.token+'^'],f.remote),before.token)
  assert.equal(await pushes(),1)
  assert.equal(await reads(),4) // three confirmation reads and final payload verification
})
test('confirmation stops after six stale reads and fresh connection reconciles the one write', async t => {
  const f=await fixture(t), {connection:c,reads,pushes}=await replica(t,f,'exhaust')
  const before=await c.store.read()
  await assert.rejects(c.store.compareAndSwap(before.token,{...before.state,revision:1}),/git_write_not_confirmed/)
  assert.equal(await pushes(),1)
  assert.equal(await reads(),6)
  const fresh=await f.store.read()
  assert.equal(fresh.state.revision,1)
  assert.equal(await f.git(['rev-parse',fresh.token+'^'],f.remote),before.token)
})
test('confirmation refuses a concurrent successor immediately rather than retrying', async t => {
  const f=await fixture(t), {connection:c,reads,pushes}=await replica(t,f,'concurrent')
  const before=await c.store.read()
  await assert.rejects(c.store.compareAndSwap(before.token,{...before.state,revision:1}),/git_write_not_confirmed/)
  assert.equal(await pushes(),1)
  assert.equal(await reads(),1)
})
