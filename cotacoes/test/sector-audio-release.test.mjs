import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { validateSectorRelease, sha256, CANDIDATE_FIELDS, REVIEW_CATEGORIES, REQUIRED_RATES, PLAYER_FILES, reviewCandidates, narrationText } from '../scripts/sector-audio-release-lib.mjs'
import { transcriptText } from '../src/sectorStudies/presentation.js'

async function fixture(t, count = 80) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sector-release-synthetic-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const appRoot = path.join(root, 'cotacoes')
  const studies = Array.from({ length: count }, (_, topicIndex) => ({ group: 'synthetic', topicIndex, reviewStatus: 'approved', transcript: ['Synthetic fixture, never a real audio audit.'] }))
  const write = async (filename, value) => {
    const target = path.join(root, filename)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, typeof value === 'string' ? value : JSON.stringify(value))
  }
  const saveStudies = () => write('cotacoes/src/sectorStudies/studies.json', studies)
  await saveStudies()
  const run = options => validateSectorRelease({ appRoot, requireAudio: true, allowNoAudio: true, ...options })
  return { root, appRoot, studies, write, saveStudies, run }
}

test('explicit no-audio release permits exactly66 approved documentary studies and says audio is deferred', async t => {
  const f = await fixture(t)
  const result = await f.run()
  assert.deepEqual(result.issues, [])
  assert.equal(result.audioDeferred, true)
  assert.equal(result.studies, 80)
  const strict = await f.run({ allowNoAudio: false })
  assert.match(strict.issues.join('\n'), /audio missing/)
  assert.match(strict.issues.join('\n'), /manifest missing/)
  assert.match(strict.issues.join('\n'), /release evidence missing/)
})

test('no-audio exception never accepts a partial or unreviewed batch', async t => {
  const partial = await fixture(t, 65)
  assert.match((await partial.run()).issues.join('\n'), /must contain 80/)
  const unreviewed = await fixture(t)
  unreviewed.studies[0].reviewStatus = 'pending'
  await unreviewed.saveStudies()
  assert.match((await unreviewed.run()).issues.join('\n'), /documentary review not approved/)
})

for (const kind of ['association', 'empty association', 'MP3', 'manifest', 'release evidence']) {
  test(`no-audio exception is disabled by any ${kind}`, async t => {
    const f = await fixture(t)
    if (kind === 'association' || kind === 'empty association') {
      f.studies[0].audio = kind === 'association' ? { src: './audio/sectors/synthetic-0.mp3' } : {}
      await f.saveStudies()
    } else if (kind === 'MP3') await f.write('cotacoes/public/audio/sectors/synthetic-0.mp3', 'not real audio')
    else if (kind === 'manifest') await f.write('cotacoes/public/audio/sectors/manifest.json', { studies: {} })
    else await f.write('docs/sector-research/audio-release-evidence.json', {})
    const result = await f.run()
    assert.notEqual(result.audioDeferred, true)
    assert.ok(result.issues.length > 0)
  })
}

test('absent/empty sector batch preserves unrelated releases and original TIC', async t => {
  const f = await fixture(t, 0)
  await f.write('cotacoes/public/audio/tic-2026-11-06.mp3', 'untouched pilot fixture')
  assert.deepEqual((await f.run({ allowNoAudio: false })).issues, [])
  await rm(path.join(f.appRoot, 'src/sectorStudies'), { recursive: true })
  assert.deepEqual((await f.run({ allowNoAudio: false })).issues, [])
  await f.write('cotacoes/public/audio/sectors/orphan.mp3', 'orphan')
  assert.match((await f.run()).issues.join('\n'), /orphan/)
})

test('invalid or accidentally deleted catalog fails closed', async t => {
  const f = await fixture(t)
  await f.write('cotacoes/src/sectorStudies/studies.json', 'null')
  assert.match((await f.run()).issues.join('\n'), /must be an array/)
  await f.write('cotacoes/src/sectorStudies/studies.json', '{invalid')
  assert.match((await f.run()).issues.join('\n'), /catalog missing, unreadable or invalid/)
  await rm(path.join(f.appRoot, 'src/sectorStudies/studies.json'))
  assert.match((await f.run()).issues.join('\n'), /catalog missing, unreadable or invalid/)
})

// Tiny synthetic bytes + synthetic audit records test the validator only. They are
// never real MP3s, decoder output, ASR runs, browser runs or release deliverables.
async function completeFixture(t) {
  const f = await fixture(t)
  const manifest = { version: 1, studies: {} }
  for (const study of f.studies) {
    const key = `${study.group}/${study.topicIndex}`
    const bytes = `SYNTHETIC TEST BYTES ${key}`
    const audio = { src: `./audio/sectors/${study.group}-${study.topicIndex}.mp3`, fileSha256: sha256(bytes), textSha256: sha256(narrationText(study.transcript)), durationSeconds: 10, bytes: Buffer.byteLength(bytes) }
    study.audio = audio
    manifest.studies[key] = audio
    await f.write(`cotacoes/public/${audio.src.slice(2)}`, bytes)
  }
  await f.saveStudies()
  await f.write('cotacoes/public/audio/sectors/manifest.json', manifest)
  const sources = {
    canonicalStudiesSha256: sha256(await readFile(path.join(f.appRoot, 'src/sectorStudies/studies.json'))),
    manifestSha256: sha256(await readFile(path.join(f.appRoot, 'public/audio/sectors/manifest.json'))),
  }
  const technical = { schemaVersion: 1, status: 'complete_technical_audit', sources, summary: { canonicalStudies: 80, approvedStudies: 80, manifestEntries: 80, presentMp3Files: 80, auditedFiles: 80, passedTechnicalChecks: 80, filesWithWarnings: 0, filesFailed: 0, approvedStudiesPendingAudio: 0, filesAwaitingRegeneration: 0 }, pendingStudyKeys: [], awaitingRegenerationStudyKeys: [], manifestKeysWithoutCanonicalStudy: [], unreferencedMp3Files: [], files: {} }
  const fidelity = { schemaVersion: 1, status: 'automatic_screening_complete_review_pending', sources, summary: { canonicalStudies: 80, availableAudioFiles: 80, filesFullyTranscribed: 80, currentTranscriptAudioFiles: 80, pendingFullTranscription: 0, availableAudioPendingTranscription: 0, studiesPendingAudio: 0, audioAwaitingRegeneration: 0, humanListeningCompleted: 0, finalAudioApproval: false }, pendingStudyKeys: [], pendingGeneratedStudyKeys: [], awaitingRegenerationStudyKeys: [], pendingGenerationStudyKeys: [], limitations: ['Synthetic test, no perceptual listening.'], method: { engine: 'synthetic unit fixture', modelPromptedWithExpectedTranscript: false }, files: {} }
  const review = { schemaVersion: 1, status: 'complete_automated_discrepancy_review', sources: { ...sources }, humanOrNativeListeningPerformed: false, limitations: 'Synthetic fixture, no naturalness guarantee or perceptual listening.', files: {} }
  const playerFiles = {}
  for (const filename of PLAYER_FILES) {
    await f.write(filename, `synthetic player source ${filename}`)
    playerFiles[filename] = sha256(await readFile(path.join(f.root, filename)))
  }
  const browser = { errors: [], audioPlayback: { schemaVersion: 1, expected: 80, sources: { ...sources, playerFiles }, humanOrNativeListeningPerformed: false, scope: 'Synthetic control tests, not integral listening.', results: [] } }
  for (const study of f.studies) {
    const key = `${study.group}/${study.topicIndex}`
    const { fileSha256, textSha256, src, bytes } = study.audio
    const identity = { studyKey: key, fileSha256, textSha256 }
    technical.files[key] = { studyKey: key, status: 'pass_technical_only', failures: [], warnings: [], integrity: { fileSha256, textSha256, bytes, fileSha256MatchesManifest: true, textSha256MatchesManifest: true }, fullDecode: { complete: true, exitCode: 0 }, signal: { decodedDurationSeconds: 10, nonFiniteSamples: 0 } }
    const comparison = Object.fromEntries(CANDIDATE_FIELDS.map(field => [field, []]))
    fidelity.files[key] = { ...identity, model: 'synthetic', recognition: { completeContinuousCoverage: true, coveredSeconds: 10, windows: [{ start: 0, end: 5, coreStart: 0, coreEnd: 5 }, { start: 5, end: 10, coreStart: 5, coreEnd: 10 }] }, comparison }
    review.files[key] = { ...identity, comparisonSha256: sha256(JSON.stringify(comparison)), reviewer: 'synthetic unit fixture', reviewedAt: '2026-11-06T12:00:00Z', method: 'synthetic review', reviewedCategories: REVIEW_CATEGORIES, resolutions: [] }
    browser.audioPlayback.results.push({ ...identity, src, status: 'passed', durationSeconds: 10, playedTo: 0.2, paused: true, ended: true, preservesPitch: true, durationLabels: true, seekedTo: 9.75, endedAt: 10, rates: REQUIRED_RATES, rateChecks: REQUIRED_RATES.map(rate => ({ rate, observedRate: rate, before: 1, after: 1.2 })), pauseObservation: { waitedMs: 150, before: 0.2, after: 0.2 } })
  }
  const evidence = { schemaVersion: 1, scope: 'sector-automated-audio-release', expectedStudyCount: 80, sources, humanOrNativeListeningPerformed: false, absoluteAudioQualityGuaranteed: false, limitations: 'Synthetic test, not real release or perceptual listening.', reports: {} }
  const reports = { technical, fidelity, review, browser }
  const save = async () => {
    review.sources.fidelityReportSha256 ??= sha256(JSON.stringify(fidelity))
    for (const [name, report] of Object.entries(reports)) {
      const filename = `docs/sector-research/audio-${name}-synthetic.json`
      await f.write(filename, report)
      evidence.reports[name] = { path: filename, sha256: sha256(JSON.stringify(report)) }
    }
    await f.write('docs/sector-research/audio-release-evidence.json', evidence)
  }
  await save()
  return { ...f, manifest, evidence, reports, save }
}

test('normalization matches production transcript identity', () => {
  for (const transcript of [' Text. \n\n Second. ', ['One.', '', ' Two.\n\nThree. ']]) assert.equal(narrationText(transcript), transcriptText(transcript))
})

test('complete synthetic66 evidence satisfies strict automated contract without perceptual approval', async t => {
  const f = await completeFixture(t)
  assert.deepEqual((await f.run({ allowNoAudio: false })).issues, [])
  assert.deepEqual((await f.run()).issues, [])
  assert.notEqual((await f.run()).audioDeferred, true)
})

for (const name of ['technical', 'fidelity', 'review', 'browser']) {
  test(`strict gate rejects missing, partial and null ${name} reports despite metadata66`, async t => {
    const f = await completeFixture(t)
    if (name === 'browser') f.reports.browser.audioPlayback.results.pop()
    else delete f.reports[name].files['synthetic/65']
    await f.save()
    assert.match((await f.run()).issues.join('\n'), /coverage/)
    f.reports[name] = null
    // Keep the mutable review object in save; replace the bytes directly instead.
    const ref = f.evidence.reports[name]
    await f.write(ref.path, 'null')
    ref.sha256 = sha256('null')
    await f.write('docs/sector-research/audio-release-evidence.json', f.evidence)
    assert.match((await f.run()).issues.join('\n'), /report must be an object/)
    await rm(path.join(f.root, ref.path))
    assert.match((await f.run()).issues.join('\n'), /report unavailable/)
  })
}

test('content changes invalidate byte hashes, source bindings and report checksums', async t => {
  const f = await completeFixture(t)
  await f.write('cotacoes/public/audio/sectors/synthetic-0.mp3', 'new bytes')
  assert.match((await f.run()).issues.join('\n'), /audio file hash mismatch/)
  f.studies[1].transcript = ['Changed transcript']
  await f.saveStudies()
  assert.match((await f.run()).issues.join('\n'), /stale\/missing canonicalStudiesSha256/)
  await f.write(f.evidence.reports.technical.path, { ...f.reports.technical, changed: true })
  assert.match((await f.run()).issues.join('\n'), /report hash mismatch/)
  await f.write(PLAYER_FILES[0], 'changed player')
  assert.match((await f.run()).issues.join('\n'), /stale player\/test source/)
})

test('full decode and continuous ASR coverage are checked beyond status/count metadata', async t => {
  const f = await completeFixture(t)
  f.reports.technical.files['synthetic/0'].fullDecode.complete = false
  f.reports.fidelity.files['synthetic/1'].recognition.windows[1].coreStart = 6
  await f.save()
  const issues = (await f.run()).issues.join('\n')
  assert.match(issues, /integral decode missing\/incomplete/)
  assert.match(issues, /ASR does not cover the entire/)
})

test('metadata-only browser checks and stale media never satisfy actual player evidence', async t => {
  const f = await completeFixture(t)
  const rows = f.reports.browser.audioPlayback.results
  rows[0].fileSha256 = '0'.repeat(64)
  rows[1].rateChecks[0].after = 1
  delete rows[2].pauseObservation
  rows[3].ended = false
  f.reports.browser.failure = 'interrupted run'
  await f.save()
  const issues = (await f.run()).issues.join('\n')
  assert.match(issues, /browser evidence not bound/)
  assert.match(issues, /not every playback rate actually advanced/)
  assert.match(issues, /pause not observed/)
  assert.match(issues, /real play\/pause\/seek\/end evidence incomplete/)
  assert.match(issues, /failed\/incomplete browser run/)
})

test('material candidates require explicit hash-bound, supported resolutions', async t => {
  const f = await completeFixture(t)
  const key = 'synthetic/0'
  const comparison = f.reports.fidelity.files[key].comparison
  comparison.criticalMeaningReviewCandidates.push({ reference: 'não', recognized: 'sim', audioSeconds: [1, 2] })
  f.reports.review.sources.fidelityReportSha256 = sha256(JSON.stringify(f.reports.fidelity))
  f.reports.review.files[key].comparisonSha256 = sha256(JSON.stringify(comparison))
  await f.save()
  assert.match((await f.run()).issues.join('\n'), /every ASR candidate needs an explicit current resolution/)
  const supporting = { items: [{ studyKey: key, fileSha256: f.studies[0].audio.fileSha256, sourceExcerpt: 'synthetic reference', recognizedExcerpt: 'synthetic recheck', reviewNote: 'Synthetic explanation, never real evidence.', status: 'resolved_as_recognizer_error' }] }
  const filename = 'docs/sector-research/synthetic-resolution.json'
  await f.write(filename, supporting)
  const resolution = { candidateSha256: reviewCandidates(comparison)[0].candidateSha256, disposition: 'recognizer_error', reason: 'Synthetic fixture', evidence: { path: filename, sha256: sha256(JSON.stringify(supporting)) }, evidenceItem: 0 }
  f.reports.review.files[key].resolutions = [resolution]
  await f.save()
  assert.deepEqual((await f.run()).issues, [])
  resolution.disposition = 'unresolved_material'
  await f.save()
  assert.match((await f.run()).issues.join('\n'), /unresolved\/material discrepancy/)
})

test('strict evidence forbids approval/listening claims and stale per-file rows', async t => {
  const f = await completeFixture(t)
  f.evidence.humanOrNativeListeningPerformed = true
  f.reports.fidelity.summary.finalAudioApproval = true
  f.reports.technical.files['synthetic/0'] = null
  f.reports.review.files['synthetic/1'].textSha256 = '0'.repeat(64)
  await f.save()
  const issues = (await f.run()).issues.join('\n')
  assert.match(issues, /no perceptual listening/)
  assert.match(issues, /not final audio approval/)
  assert.match(issues, /technical row missing\/invalid/)
  assert.match(issues, /stale review row hashes/)
})
