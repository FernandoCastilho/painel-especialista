import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import * as React from 'react'
const require = createRequire(import.meta.url)
const walk = node => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === 'object' ? [node,...walk(node.props?.children)] : []
for (const file of ['SectorPodcast','ResearchedSectorStudy']) test(`${file}: late audio callbacks tolerate a cleared ref after navigation`, async () => {
  const source = await readFile(new URL(`../src/${file}.jsx`,import.meta.url),'utf8')
  const {code}=await transform(source+(file==='ResearchedSectorStudy'?'\nexport { ResearchAudio }':''),{loader:'jsx',format:'cjs',jsx:'automatic'})
  const module={exports:{}}
  runInNewContext(code,{module,exports:module.exports,require:name=>name==='react'?{...React,useRef:()=>({current:null}),useState:initial=>[initial,()=>{}]}:name==='react/jsx-runtime'?require(name):name.includes('ticPodcastTranscript')?'Texto de teste':name.includes('presentation.js')?{durationLabel:()=>'',transcriptParagraphs:()=>[]}:name.endsWith('.css')?{}:{}})
  const Component=file==='SectorPodcast'?module.exports.default:module.exports.ResearchAudio
  const tree=Component({study:{title:'Teste',audio:{src:'./test.mp3'},transcript:'Teste'}})
  const audio=walk(tree).find(node=>node.type==='audio')
  assert.ok(audio)
  assert.doesNotThrow(()=>audio.props.onLoadedMetadata())
  assert.doesNotThrow(()=>audio.props.onRateChange())
  assert.doesNotThrow(()=>audio.props.onPlay())
})
