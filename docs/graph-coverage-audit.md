# Independent graph coverage inventory

Audit date: 2026-11-09. Scope: source and route inspection of the local application; no deployment, live-source completeness certification, or visual browser approval.

## Reachable news inputs

The current UI reads four primary article datasets: `news.json` (News and MarketNews), `temas.json` (MoedasNoticias and TemaNoticias), `sector-news.json` (SectorNews), and `curadoria-noticias.json` (CuradoriaNoticias). KnowledgeMap also reads the retained `knowledge-news.json` archive. The archive packager reads those same four primary files. This covers the current article source types, not every publication in the world or unavailable live records.

`ReformaTributaria.jsx` retains a default component for `reforma-tributaria.json`, but it has no current importer. Resumo imports its named MoedasNoticias/TemaNoticias components instead. The obsolete default is not evidence of a current missing article feed.

Locally available snapshots at inspection: sector-news has 43 topic buckets and 29 raw records; curadoria-noticias has 4 buckets and 216 raw records. These counts precede validation, deduplication, and age filtering. `news.json`, `temas.json`, and `knowledge-news.json` are absent locally. This initial local-only limitation was superseded by the separately captured published snapshot independently checked below.

## Content inventory

- CATALOGO_SETORIAL: 11 sectors, 68 subsectors, routed to `setores/pasta/{id}` and `setores/topico/{id}/{index}`.
- 67 generated public study JSONs plus the special TIC_STUDY at tic/0 cover the 68 study routes.
- CONCEITOS: 29 learning concepts, 57 explicit LIGACOES; routes `aprender/{id}`.
- BANKING_TOPICS: 38 editorial topics, plus 5 INSUMOS. Existing alias logic collapses 12 banking topic routes into catalogue sectors. This shares a thematic anchor but does not expose each original article-list route.
- GLOSSARY: 34 explanations, rendered through Explain, including dynamic keys in Macro, Curves, ExecutiveRatesTable, and Indexadores. Only 5 appear in generated.glossaryRoutes; this generated map is not a complete glossary inventory. Some duplicate learning concepts (SOFR, cupom, Focus).
- searchContent.generated.json: 44 additional search documents, including calculators, economic indicators, bank data, and general application areas. These are broader than the requested sector/concept/news entity inventory and are not all graph nodes.

SetoresB3 and SectorProfile have no current component importers. Their B3 taxonomy and older profiles should not be advertised as active route coverage.

## Completeness and factual-risk checks

1. The original model silently omitted eligible news without lexical sector/concept matches. A pending-classification administrative hub is an honest connectivity fallback, but must never be described as a discovered economic relationship.
2. Global catalog membership alone is not study-content coverage. Editorial relations extracted from studies must be included in the global graph as well as the contextual projection to support a global completeness claim.
3. Classification provenance must survive duplicate URLs across feeds. Collection timestamps cannot renew publication dates. Generic untrusted tags must not create economic claims.
4. Study matching should read editorial prose only, not URLs/source metadata. Section paragraphs, bullets, and table rows are inspected. Charts, diagrams, canvas questions, transcript, method, and limitations are not all scanned by the initial contextual matcher; do not claim literal coverage of every word or all possible semantic relationships.
5. Exact title phrase matching is not comprehensive semantic understanding. A pending classification is not an error to conceal; surface its count separately.
6. A 36-news drawing limit must remain distinguishable from graph admission coverage. List view can expose all admitted articles. Filters may hide a node's neighbor even when the complete graph has a valid edge.
7. Session-storage keys are distinct per study and global map. Study wrappers remount via keys on researched-study routes; verify route-switch restoration and browser Back in browser CI.
8. Existing openPage permits only aprender/setores destinations. Any future glossary/application node integration needs verified destination handling, not fabricated learning routes.

## Verification limits

The final integration includes all 34 glossary explanations (with concept aliases deduplicated), and the published snapshot described below was verified. This inventory still does not assert coverage of all 44 general application search documents, every subsection of study content, every possible semantic relationship, or future production updates. Those limits must accompany any claim of complete coverage. Browser behavior requires executable browser tests; static inspection is not visual acceptance.

## Glossary registry delivered during audit

`cotacoes/src/knowledgeGlossary.js` now inventories all 34 glossary entries with original description and complete explanation text. Three entries reuse existing learning concepts (SOFR, cupom cambial, Focus); 31 have distinct glossary IDs. Nineteen glossary entries have verified owning application area destinations, and the three aliases use existing learning routes. Twelve retain an explicit unavailable-destination marker instead of an invented URL. An owning-area route is not a deep link that automatically opens its help popup; historical/parity explanations require the user to open the relevant chart. Final core integration now inserts these entries and explicit glossary-membership edges. Original explanations are retained in summary/body for distinct entries and summary/glossaryBody for aliases. The UI exposes the complete explanation in a details panel.

Focused `knowledge-glossary.test.mjs`: 3 tests passed. They verify complete key coverage, original content, deduplication targets, valid application tabs, and honest unavailable destinations. These checks do not constitute a browser navigation test.


## Independent published-snapshot verification

The parent captured all five datasets read-only from `https://fernandocastilho.github.io/painel-especialista/` into `/workspace/shared/sector-graph-live-data`. Independently reran the current graph against those files at the exact audit reference `2026-11-09T00:13:54.439Z` and compared every source SHA-256 to `docs/graph-coverage-snapshot-20261109.json`. All five hashes match. This verifies the supplied captured bytes; the auditor did not independently re-fetch the URLs.

Results reproduced exactly: 1,084 nodes, 1,502 links; 886 included valid news items, of which 436 have thematic classification and 450 attach explicitly to pending classification. Zero unlinked nodes and zero missing edge endpoints. All 34 original glossary explanations survive integration. Thirty targeted model, contextual graph, and glossary tests pass.

The audit reports one rejected raw record and 657 duplicate records; raw records are not unique articles. Pending-classification edges establish administrative connectivity, not inferred economic relevance. Institutional coverage remains partial according to the snapshot's own coverage notes. This is bounded evidence for the captured files and evaluation instant, not proof that future arrivals will always be classified, the running deployed JavaScript already matches the working tree, or all upstream publications are available. No publication or browser/visual proof was performed by this audit.
