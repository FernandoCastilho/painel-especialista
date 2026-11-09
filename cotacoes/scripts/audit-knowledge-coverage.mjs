import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { buildKnowledgeGraph } from '../src/knowledgeGraph.js'

// Read-only audit of a captured set of published article datasets.
const directory = process.argv[2] || 'public'
const now = process.argv[3] ? Date.parse(process.argv[3]) : Date.now()
const files = { sectorNews: 'sector-news.json', news: 'news.json', temas: 'temas.json', curadoria: 'curadoria-noticias.json', archive: 'knowledge-news.json' }
const inputs = {}, sources = {}
for (const [key, file] of Object.entries(files)) {
  try {
    const bytes = await readFile(resolve(directory, file))
    inputs[key] = JSON.parse(bytes)
    sources[file] = { status: 'read', sha256: createHash('sha256').update(bytes).digest('hex'), generatedAt: inputs[key].generatedAt }
  } catch (error) { sources[file] = { status: 'unavailable', reason: error.code === 'ENOENT' ? 'missing' : 'invalid-or-unreadable' } }
}
const graph = buildKnowledgeGraph({ ...inputs, now })
const connected = new Set(graph.links.flatMap(link => [link.source, link.target]))
const unlinked = graph.nodes.filter(node => !connected.has(node.id)).map(node => node.id)
const output = { checkedAt: new Date(now).toISOString(), scope: 'Snapshot supplied to this audit, not a guarantee about later news or unavailable sources.', sources, nodes: graph.nodes.length, links: graph.links.length, meta: graph.meta, unlinked, allSourcesRead: Object.values(sources).every(source => source.status === 'read'), allIncludedNewsConnected: graph.nodes.filter(node => node.type === 'news').every(node => connected.has(node.id)) }
console.log(JSON.stringify(output, null, 2))
if (!output.allSourcesRead || !output.allIncludedNewsConnected) process.exitCode = 1
