import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const EXPECTED_STUDIES = 80
export const REQUIRED_RATES = [0.75, 1, 1.25, 1.5, 2]
export const REVIEW_CATEGORIES = ['numbers', 'negations', 'acronyms', 'properNames', 'omissions', 'repetitions']
export const CANDIDATE_FIELDS = ['unresolvedWrittenNumbers', 'longUnmatchedReferenceSpans', 'criticalMeaningReviewCandidates', 'unmatchedAcronyms', 'properNameReviewCandidates']
export const PLAYER_FILES = ['cotacoes/src/ResearchedSectorStudy.jsx', 'cotacoes/src/sectorStudies/presentation.js', 'cotacoes/scripts/smoke-researched-sectors.cjs']
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const positive = value => Number.isFinite(value) && value > 0
const close = (a, b, tolerance = 0.1) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance
const sameKeys = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length && actual.every(key => expected.includes(key))
const empty = value => Array.isArray(value) && value.length === 0
const timestamp = value => nonempty(value) && Number.isFinite(Date.parse(value))
// Independent of the optional batch module: legacy, batch-free releases can run this gate.
export function narrationText(transcript) {
  return (Array.isArray(transcript) ? transcript : [transcript]).filter(Boolean).flatMap(text => text.trim().split(/\n\s*\n/)).filter(Boolean).join('\n\n')
}
export function reviewCandidates(comparison) {
  return CANDIDATE_FIELDS.flatMap(category => (comparison?.[category] || []).map(candidate => ({ category, candidate, candidateSha256: sha256(JSON.stringify({ category, candidate })) })))
}
function completeCoverage(windows, duration) {
  if (!positive(duration) || !Array.isArray(windows) || !windows.length) return false
  let end = 0
  for (const window of [...windows].sort((a, b) => a.coreStart - b.coreStart)) {
    if (!Number.isFinite(window.coreStart) || !Number.isFinite(window.coreEnd) || window.coreStart < 0 || window.coreEnd <= window.coreStart || window.coreStart > end + 0.01 || window.coreEnd > duration + 0.1) return false
    if (!Number.isFinite(window.start) || !Number.isFinite(window.end) || window.start > window.coreStart || window.end < window.coreEnd) return false
    end = Math.max(end, window.coreEnd)
  }
  return close(end, duration, 0.01)
}
async function exists(filename) {
  try { await stat(filename); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}
async function jsonFile(filename) {
  const raw = await readFile(filename)
  return { raw, data: JSON.parse(raw.toString('utf8')) }
}

/** Read-only evidence validation. Never generates, upgrades or approves an audit. */
export async function validateSectorRelease({ appRoot, requireAudio = false, allowNoAudio = false }) {
  const root = path.resolve(appRoot, '..')
  const issues = []
  const check = (condition, message) => { if (!condition) issues.push(message) }
  check(!allowNoAudio || requireAudio, '--allow-no-audio requires the release gate (--require-audio)')
  const catalogPath = path.join(appRoot, 'src/sectorStudies/studies.json')
  const audioDir = path.join(appRoot, 'public/audio/sectors')
  const manifestPath = path.join(audioDir, 'manifest.json')
  const evidencePath = path.join(root, 'docs/sector-research/audio-release-evidence.json')
  let catalog
  try { catalog = await jsonFile(catalogPath) } catch (error) {
    // A missing file inside an existing module is broken, not an absent batch.
    if (error.code !== 'ENOENT' || await exists(path.dirname(catalogPath))) return { studies: 0, issues: ['sector catalog missing, unreadable or invalid'] }
  }
  const studies = catalog ? catalog.data : []
  if (!Array.isArray(studies)) return { studies: 0, issues: ['sector catalog must be an array'] }
  let audioFiles = []
  try { audioFiles = await readdir(audioDir) } catch (error) { if (error.code !== 'ENOENT') issues.push('sector audio directory unreadable') }
  if (!studies.length) {
    check(!audioFiles.length && !await exists(evidencePath), 'empty/absent catalog has orphan sector audio or release evidence')
    return { studies: 0, issues }
  }
  const keys = studies.map(study => `${study?.group}/${study?.topicIndex}`)
  check(new Set(keys).size === studies.length, 'duplicate study keys')
  if (requireAudio) check(studies.length === EXPECTED_STUDIES, `final sector batch must contain ${EXPECTED_STUDIES} studies; found ${studies.length}`)
  // Explicit, user-authorized documentary release. Any trace of batch audio makes
  // this exception inapplicable; mixed/partial audio still needs the full gate.
  const audioDeferred = requireAudio && allowNoAudio && studies.every(study => study?.audio == null) && !audioFiles.length && !await exists(evidencePath)
  const current = new Map()
  for (const study of studies) {
    const key = `${study?.group}/${study?.topicIndex}`
    if (!/^[a-z0-9-]+$/.test(study?.group || '') || !Number.isInteger(study?.topicIndex) || study.topicIndex < 0 || key === 'tic/0') { issues.push(`${key}: invalid batch key or original TIC pilot included`); continue }
    check(study.reviewStatus === 'approved', `${key}: documentary review not approved`)
    if (!study.audio?.src) { if (requireAudio && !audioDeferred) issues.push(`${key}: audio missing`); continue }
    const expected = `./audio/sectors/${study.group}-${study.topicIndex}.mp3`
    let textSha256
    try { textSha256 = sha256(narrationText(study.transcript)); check(nonempty(narrationText(study.transcript)), `${key}: transcript empty`) } catch { issues.push(`${key}: transcript invalid`); continue }
    check(study.audio.src === expected && study.audio.textSha256 === textSha256, `${key}: audio/transcript mismatch`)
    try {
      const bytes = await readFile(path.join(audioDir, `${study.group}-${study.topicIndex}.mp3`))
      const fileSha256 = sha256(bytes)
      check(bytes.length > 0 && study.audio.fileSha256 === fileSha256, `${key}: audio file hash mismatch`)
      if (requireAudio) check(study.audio.bytes === bytes.length && positive(study.audio.durationSeconds), `${key}: audio length/duration invalid`)
      current.set(key, { study, src: expected, fileSha256, textSha256, bytes: bytes.length, duration: study.audio.durationSeconds })
    } catch { issues.push(`${key}: audio file unavailable`) }
  }
  if (!requireAudio || audioDeferred) return { studies: studies.length, issues, audioDeferred }
  let manifest, evidence
  try { manifest = await jsonFile(manifestPath) } catch { issues.push('audio manifest missing or invalid') }
  try { evidence = (await jsonFile(evidencePath)).data } catch { issues.push('audio release evidence missing or invalid') }
  check(record(manifest?.data), 'audio manifest must be an object')
  check(record(evidence), 'audio release evidence must be an object')
  if (!record(manifest?.data) || !record(evidence)) return { studies: studies.length, issues }
  const entries = manifest.data?.studies
  check(record(entries) && sameKeys(Object.keys(entries), keys), 'audio manifest coverage must be exactly 80/80 canonical keys')
  check(sameKeys(audioFiles.filter(file => file.endsWith('.mp3')), studies.map(study => `${study.group}-${study.topicIndex}.mp3`)), 'MP3 coverage differs from canonical batch')
  for (const [key, row] of current) {
    const entry = entries?.[key]
    check(entry && entry.src === row.src && entry.fileSha256 === row.fileSha256 && entry.textSha256 === row.textSha256 && entry.bytes === row.bytes && entry.durationSeconds === row.duration, `${key}: manifest does not match current study/audio bytes`)
  }
  const sources = { canonicalStudiesSha256: sha256(catalog.raw), manifestSha256: sha256(manifest.raw) }
  const checkSources = (report, label) => {
    for (const [field, hash] of Object.entries(sources)) check(report?.sources?.[field] === hash, `${label}: stale/missing ${field}`)
  }
  check(evidence.schemaVersion === 1 && evidence.scope === 'sector-automated-audio-release' && evidence.expectedStudyCount === EXPECTED_STUDIES, 'release evidence schema/scope/count invalid')
  check(evidence.humanOrNativeListeningPerformed === false && evidence.absoluteAudioQualityGuaranteed === false && nonempty(evidence.limitations), 'release evidence must disclose no perceptual listening or absolute quality guarantee')
  checkSources(evidence, 'release evidence')
  const loaded = new Map()
  async function loadEvidence(ref, label) {
    if (!record(ref) || !/^docs\/sector-research\/[a-zA-Z0-9_./-]+\.json$/.test(ref.path || '') || ref.path.split('/').includes('..') || !/^[0-9a-f]{64}$/.test(ref.sha256 || '')) { issues.push(`${label}: report reference missing or invalid`); return null }
    const filename = path.join(root, ref.path)
    try {
      const resolved = await realpath(filename)
      if (!resolved.startsWith(`${await realpath(path.join(root, 'docs/sector-research'))}${path.sep}`)) throw new Error('report escapes evidence directory')
      const value = loaded.get(filename) || await jsonFile(filename)
      loaded.set(filename, value)
      check(sha256(value.raw) === ref.sha256, `${label}: report hash mismatch`)
      return value.data
    } catch { issues.push(`${label}: report unavailable or invalid`); return null }
  }
  const reports = {}
  for (const name of ['technical', 'fidelity', 'review', 'browser']) {
    reports[name] = await loadEvidence(evidence.reports?.[name], name)
    check(record(reports[name]), `${name}: report must be an object`)
    if (reports[name]) checkSources(name === 'browser' ? reports[name].audioPlayback : reports[name], name)
  }
  const { technical, fidelity, review, browser } = reports
  for (const [name, report] of Object.entries({ technical, fidelity, review })) {
    if (!report) continue
    check(report.schemaVersion === 1 && record(report.files) && sameKeys(Object.keys(report.files), keys), `${name}: report coverage/schema must be exactly 80/80`)
  }
  if (technical) {
    check(technical.status === 'complete_technical_audit', 'technical: audit is incomplete')
    for (const name of ['canonicalStudies', 'approvedStudies', 'manifestEntries', 'presentMp3Files', 'auditedFiles', 'passedTechnicalChecks']) check(technical.summary?.[name] === EXPECTED_STUDIES, `technical: ${name} must be 80`)
    for (const name of ['filesWithWarnings', 'filesFailed', 'approvedStudiesPendingAudio', 'filesAwaitingRegeneration']) check(technical.summary?.[name] === 0, `technical: ${name} must be zero`)
    for (const name of ['pendingStudyKeys', 'awaitingRegenerationStudyKeys', 'manifestKeysWithoutCanonicalStudy', 'unreferencedMp3Files']) check(empty(technical[name]), `technical: ${name} missing or nonempty`)
  }
  if (fidelity) {
    check(fidelity.status === 'automatic_screening_complete_review_pending', 'fidelity: full automated screening not complete')
    for (const name of ['canonicalStudies', 'availableAudioFiles', 'filesFullyTranscribed', 'currentTranscriptAudioFiles']) check(fidelity.summary?.[name] === EXPECTED_STUDIES, `fidelity: ${name} must be 80`)
    for (const name of ['pendingFullTranscription', 'availableAudioPendingTranscription', 'studiesPendingAudio', 'audioAwaitingRegeneration', 'humanListeningCompleted']) check(fidelity.summary?.[name] === 0, `fidelity: ${name} must be zero`)
    for (const name of ['pendingStudyKeys', 'pendingGeneratedStudyKeys', 'awaitingRegenerationStudyKeys', 'pendingGenerationStudyKeys']) check(empty(fidelity[name]), `fidelity: ${name} missing or nonempty`)
    check(fidelity.summary?.finalAudioApproval === false && Array.isArray(fidelity.limitations) && fidelity.limitations.length > 0, 'fidelity: automated screening must retain listening limitations, not final audio approval')
    check(nonempty(fidelity.method?.engine) && fidelity.method?.modelPromptedWithExpectedTranscript === false, 'fidelity: recognition method missing or prompted with expected words')
  }
  if (review) {
    check(review.status === 'complete_automated_discrepancy_review' && review.humanOrNativeListeningPerformed === false && nonempty(review.limitations), 'review: complete discrepancy review with listening limitations required')
    check(review.sources?.fidelityReportSha256 === evidence.reports?.fidelity?.sha256, 'review: stale fidelity report binding')
  }
  const playback = browser?.audioPlayback
  if (browser) {
    check(!browser.failure && empty(browser.errors), 'browser: failed/incomplete browser run')
    check(playback?.schemaVersion === 1 && playback?.expected === EXPECTED_STUDIES && Array.isArray(playback.results) && sameKeys(playback.results.map(row => row.studyKey), keys), 'browser: real playback coverage must be exactly 80/80')
    check(playback?.humanOrNativeListeningPerformed === false && nonempty(playback?.scope), 'browser: short playback must not claim integral listening')
    for (const filename of PLAYER_FILES) {
      try { check(playback?.sources?.playerFiles?.[filename] === sha256(await readFile(path.join(root, filename))), `browser: stale player/test source ${filename}`) } catch { issues.push(`browser: player/test source missing ${filename}`) }
    }
  }
  for (const [key, currentRow] of current) {
    const { fileSha256, textSha256, duration } = currentRow
    const technicalRow = technical?.files?.[key]
    if (technical) check(record(technicalRow), `${key}: technical row missing/invalid`)
    if (technicalRow) {
      check(technicalRow.studyKey === key && technicalRow.status === 'pass_technical_only' && empty(technicalRow.failures) && empty(technicalRow.warnings), `${key}: technical row has unresolved issues`)
      check(technicalRow.integrity?.fileSha256 === fileSha256 && technicalRow.integrity?.textSha256 === textSha256 && technicalRow.integrity?.bytes === currentRow.bytes && technicalRow.integrity?.fileSha256MatchesManifest === true && technicalRow.integrity?.textSha256MatchesManifest === true, `${key}: stale technical row hashes`)
      check(technicalRow.fullDecode?.complete === true && technicalRow.fullDecode?.exitCode === 0 && close(technicalRow.signal?.decodedDurationSeconds, duration) && technicalRow.signal?.nonFiniteSamples === 0, `${key}: integral decode missing/incomplete`)
    }
    const fidelityRow = fidelity?.files?.[key]
    if (fidelity) check(record(fidelityRow), `${key}: fidelity row missing/invalid`)
    if (fidelityRow) {
      check(fidelityRow.studyKey === key && fidelityRow.fileSha256 === fileSha256 && fidelityRow.textSha256 === textSha256, `${key}: stale fidelity row hashes`)
      check(fidelityRow.recognition?.completeContinuousCoverage === true && close(fidelityRow.recognition?.coveredSeconds, duration, 0.01) && completeCoverage(fidelityRow.recognition?.windows, duration), `${key}: ASR does not cover the entire current recording`)
      check(nonempty(fidelityRow.model) && CANDIDATE_FIELDS.every(field => Array.isArray(fidelityRow.comparison?.[field])), `${key}: fidelity model/candidate review data missing`)
    }
    const reviewRow = review?.files?.[key]
    if (review) check(record(reviewRow), `${key}: review row missing/invalid`)
    if (reviewRow) {
      check(reviewRow.studyKey === key && reviewRow.fileSha256 === fileSha256 && reviewRow.textSha256 === textSha256, `${key}: stale review row hashes`)
      check(nonempty(reviewRow.reviewer) && timestamp(reviewRow.reviewedAt) && nonempty(reviewRow.method) && sameKeys(reviewRow.reviewedCategories || [], REVIEW_CATEGORIES), `${key}: critical review record incomplete`)
      check(fidelityRow && reviewRow.comparisonSha256 === sha256(JSON.stringify(fidelityRow.comparison)), `${key}: critical review is not bound to current ASR comparison`)
      const candidates = fidelityRow && CANDIDATE_FIELDS.every(field => Array.isArray(fidelityRow.comparison?.[field])) ? reviewCandidates(fidelityRow.comparison) : []
      const resolutions = reviewRow.resolutions
      check(Array.isArray(resolutions) && sameKeys(resolutions.map(row => row.candidateSha256), candidates.map(row => row.candidateSha256)), `${key}: every ASR candidate needs an explicit current resolution`)
      for (const resolution of Array.isArray(resolutions) ? resolutions : []) {
        check(['recognizer_error', 'nonmaterial_variation'].includes(resolution.disposition) && nonempty(resolution.reason), `${key}: unresolved/material discrepancy`)
        const supporting = await loadEvidence(resolution.evidence, `${key}: discrepancy resolution`)
        const item = Number.isInteger(resolution.evidenceItem) && resolution.evidenceItem >= 0 ? supporting?.items?.[resolution.evidenceItem] : null
        check(item?.studyKey === key && item?.fileSha256 === fileSha256 && (!item.textSha256 || item.textSha256 === textSha256) && nonempty(item.reviewNote) && nonempty(item.sourceExcerpt) && nonempty(item.recognizedExcerpt), `${key}: discrepancy evidence must identify the current recording and reviewed excerpts`)
        const allowedStatuses = resolution.disposition === 'recognizer_error' ? ['reconciled_by_context_recheck', 'resolved_as_recognizer_error'] : ['residual_lexical_ASR_ambiguity_not_material_audio_failure', 'resolved_as_nonmaterial_variation']
        check(allowedStatuses.includes(item?.status), `${key}: discrepancy evidence does not support the disposition`)
      }
    }
    const browserRow = Array.isArray(playback?.results) ? playback.results.find(row => row.studyKey === key) : null
    if (browserRow) {
      check(browserRow.status === 'passed' && browserRow.src === currentRow.src && browserRow.fileSha256 === fileSha256 && browserRow.textSha256 === textSha256 && close(browserRow.durationSeconds, duration), `${key}: browser evidence not bound to current media`)
      check(positive(browserRow.playedTo) && browserRow.paused === true && browserRow.ended === true && browserRow.preservesPitch === true && browserRow.durationLabels === true && browserRow.seekedTo >= duration - 0.5 && browserRow.seekedTo < duration && close(browserRow.endedAt, duration, 0.05), `${key}: real play/pause/seek/end evidence incomplete`)
      check(positive(browserRow.pauseObservation?.waitedMs) && close(browserRow.pauseObservation?.before, browserRow.pauseObservation?.after, 0.03), `${key}: pause not observed`)
      check(sameKeys(browserRow.rates || [], REQUIRED_RATES) && Array.isArray(browserRow.rateChecks) && sameKeys(browserRow.rateChecks.map(row => row.rate), REQUIRED_RATES) && browserRow.rateChecks.every(row => row.observedRate === row.rate && Number.isFinite(row.before) && row.after > row.before + 0.05), `${key}: not every playback rate actually advanced`)
    }
  }
  return { studies: studies.length, issues }
}
