import { fileURLToPath } from 'node:url'
import { validateSectorRelease } from './sector-audio-release-lib.mjs'

const args = process.argv.slice(2)
if (args.some(arg => !['--require-audio', '--allow-no-audio'].includes(arg)) || (args.includes('--allow-no-audio') && !args.includes('--require-audio'))) throw new Error('Usage: node scripts/validate-sector-release.mjs [--require-audio [--allow-no-audio]]')
const result = await validateSectorRelease({ appRoot: fileURLToPath(new URL('..', import.meta.url)), requireAudio: args.includes('--require-audio'), allowNoAudio: args.includes('--allow-no-audio') })
if (result.issues.length) throw new Error(`Sector publication blocked:\n${result.issues.join('\n')}`)
if (!result.studies) console.log('Sector release gate: no sector batch present; unrelated release may continue. Original TIC unchanged.')
else if (result.audioDeferred) console.log(`Sector documentary-only release passed: ${result.studies}/80 approved studies; no sector MP3, manifest or audio associations. Audio explicitly deferred, NOT approved.`)
else if (args.includes('--require-audio')) console.log(`Sector automated release evidence passed: ${result.studies}/80 current recordings, full decode/ASR, discrepancy review and browser controls. No human/native perceptual listening or absolute audio-quality approval.`)
else console.log(`Sector documentary gate passed: ${result.studies} approved studies. Audio release evidence was NOT evaluated; this is not publication approval.`)
