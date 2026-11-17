import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PALCO, alternar, alternarVarios, buscarBlocos, chaveNoticia, contarPorGrupo, dataCapa, escala, guardarMontagem, lerMontagem, mover, noticiasDoSlide, passoTecla, validos } from '../src/apresentar.js'
import { readTheme, readThemePreference, setThemeOverride, setThemePreference, THEME_EVENT } from '../src/systemTheme.js'

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')

test('apresentar: palco 16:9 e escala que nunca corta o slide', () => {
  assert.equal(PALCO.w / PALCO.h, 16 / 9)
  assert.equal(escala(PALCO.w, PALCO.h), 1)
  assert.equal(escala(PALCO.w * 2, PALCO.h), 1) // limitado pela altura
  assert.equal(escala(PALCO.w / 2), 0.5) // miniatura: só a largura conta
  assert.equal(escala(0, 0), 1) // medida ainda indisponível: não zera nem quebra o desenho
  assert.equal(escala(NaN), 1)
})

test('apresentar: marcar, desmarcar e ordenar os slides', () => {
  assert.deepEqual(alternar([], 'a'), ['a'])
  assert.deepEqual(alternar(['a', 'b'], 'c'), ['a', 'b', 'c']) // o novo entra no fim, na ordem da escolha
  assert.deepEqual(alternar(['a', 'b', 'c'], 'b'), ['a', 'c'])
  assert.deepEqual(alternarVarios(['a'], ['a', 'b', 'c']), ['a', 'b', 'c']) // completa o grupo sem repetir
  assert.deepEqual(alternarVarios(['x', 'a', 'b'], ['a', 'b']), ['x']) // grupo inteiro marcado: desmarca só o grupo
  assert.deepEqual(mover(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b'])
  assert.deepEqual(mover(['a', 'b', 'c'], 'a', 1), ['b', 'a', 'c'])
  const base = ['a', 'b']
  assert.equal(mover(base, 'a', -1), base) // nas pontas nada muda
  assert.equal(mover(base, 'b', 1), base)
  assert.equal(mover(base, 'z', 1), base)
  assert.deepEqual(validos(['a', 'sumiu', 'b'], new Set(['a', 'b'])), ['a', 'b'])
  assert.deepEqual(contarPorGrupo(['a', 'b', 'z'], [{ id: 'a', grupo: 'juros' }, { id: 'b', grupo: 'juros' }, { id: 'c', grupo: 'mercado' }]), { juros: 2 })
})

test('apresentar: teclado troca de slide sem sair dos limites', () => {
  assert.equal(passoTecla(0, 'ArrowRight', 3), 1)
  assert.equal(passoTecla(2, 'ArrowRight', 3), 2)
  assert.equal(passoTecla(2, ' ', 3), 2)
  assert.equal(passoTecla(1, 'ArrowLeft', 3), 0)
  assert.equal(passoTecla(0, 'ArrowLeft', 3), 0)
  assert.equal(passoTecla(1, 'Home', 3), 0)
  assert.equal(passoTecla(0, 'End', 3), 2)
  assert.equal(passoTecla(1, 'a', 3), 1) // tecla comum não navega
})

test('apresentar: notícias do slide são as mais recentes, sem as retiradas e até o limite', () => {
  const itens = [{ t: 1, title: 'antiga', link: 'l1' }, { t: 3, title: 'nova', link: 'l3' }, { t: 2, title: 'meio', link: 'l2' }, { t: 4, title: '', link: 'l4' }, null]
  assert.deepEqual(noticiasDoSlide(itens).map((n) => n.title), ['nova', 'meio', 'antiga'])
  assert.deepEqual(noticiasDoSlide(itens, ['l3']).map((n) => n.title), ['meio', 'antiga'])
  assert.deepEqual(noticiasDoSlide(itens, [], 1).map((n) => n.title), ['nova'])
  assert.deepEqual(noticiasDoSlide(null), [])
  assert.equal(chaveNoticia({ link: 'x', title: 't', t: 1 }), 'x')
  assert.equal(chaveNoticia({ title: 't', t: 1 }), 't|1') // sem endereço, o título e a hora identificam a matéria
})

test('apresentar: busca de blocos ignora acento e exige todas as palavras', () => {
  const blocos = [{ id: 'a', grupo: 'mercado', label: 'Dólar' }, { id: 'b', grupo: 'cenarios', sub: 'Projeções', label: 'Histórico do Focus · Selic' }, { id: 'c', grupo: 'setores', label: 'Serrarias · Resumo executivo' }]
  const nome = (id) => ({ mercado: 'Mercado', cenarios: 'Cenários', setores: 'Setores' }[id])
  assert.equal(buscarBlocos(blocos, '', nome), null)
  assert.equal(buscarBlocos(blocos, ' d ', nome), null) // menos de duas letras: a lista por seção continua
  assert.deepEqual(buscarBlocos(blocos, 'dolar', nome).map((b) => b.id), ['a'])
  assert.deepEqual(buscarBlocos(blocos, 'FOCUS selic', nome).map((b) => b.id), ['b'])
  assert.deepEqual(buscarBlocos(blocos, 'cenarios', nome).map((b) => b.id), ['b']) // acha também pelo nome da seção
  assert.deepEqual(buscarBlocos(blocos, 'serraria resumo', nome).map((b) => b.id), ['c'])
  assert.deepEqual(buscarBlocos(blocos, 'focus ipca', nome), [])
  assert.equal(buscarBlocos(blocos, 'se', nome, 1).length, 1)
})

test('apresentar: a montagem fica só na memória da página, nunca no armazenamento do navegador', () => {
  const m = { cliente: 'Empresa de teste', setor: 'Madeira', sel: ['juros-cdi'], opcoes: {} }
  guardarMontagem(m)
  assert.equal(lerMontagem(), m)
  for (const f of ['apresentar.js', 'Apresentar.jsx', 'apresentarBlocos.jsx', 'apresentarNoticias.jsx', 'apresentarSetores.jsx', 'ApresentarCalculadora.jsx', 'ApresentarAjuste.jsx', 'apresentarIds.js']) {
    assert.doesNotMatch(src(f), /localStorage|sessionStorage|indexedDB|document\.cookie/, `${f}: a montagem (e o nome do cliente) não pode ser gravada`)
    assert.doesNotMatch(src(f), /\bfetch\(/, `${f}: a aba só lê os arquivos de dados do próprio painel`)
  }
  guardarMontagem({ cliente: '', setor: '', sel: [], opcoes: {} })
})

test('apresentar: capa traz a data por extenso em Brasília', () => {
  assert.equal(dataCapa(Date.parse('2026-11-17T15:00:00Z')), '17 de novembro de 2026')
  assert.equal(dataCapa(Date.parse('2026-11-18T01:30:00Z')), '17 de novembro de 2026') // 22h30 do dia 17 em Brasília
})

test('tema: uma tela pode impor o tema claro sem mexer na escolha salva', () => {
  const eventos = []
  const alvo = { matchMedia: () => ({ matches: false }), localStorage: { v: {}, getItem(k) { return this.v[k] ?? null }, setItem(k, v) { this.v[k] = v }, removeItem(k) { delete this.v[k] } }, dispatchEvent: (e) => eventos.push(e.type) }
  setThemePreference('dark', alvo)
  assert.equal(readTheme(alvo), 'dark')
  setThemeOverride('light', alvo)
  assert.equal(readTheme(alvo), 'light')
  assert.equal(readThemePreference(alvo), 'dark') // a escolha da pessoa continua guardada
  assert.equal(alvo.localStorage.getItem('painel-theme'), 'dark')
  setThemeOverride(null, alvo)
  assert.equal(readTheme(alvo), 'dark') // ao sair da tela, o painel volta ao tema escolhido
  setThemeOverride('qualquer', alvo)
  assert.equal(readTheme(alvo), 'dark') // valor inválido não impõe nada
  assert.ok(eventos.filter((e) => e === THEME_EVENT).length >= 4) // cada mudança avisa a tela
})

test('apresentar: estrutura da aba e regras dos slides', () => {
  const tela = src('Apresentar.jsx'), css = src('Apresentar.css'), blocos = src('apresentarBlocos.jsx'), calc = src('ApresentarCalculadora.jsx')
  assert.match(tela, /setThemeOverride\('light'\)/) // a apresentação é sempre clara
  assert.match(tela, /return \(\) => \{ setThemeOverride\(null\)/) // e devolve o tema ao sair
  assert.match(tela, /inert: ''/) // miniaturas não recebem foco nem clique dentro do slide
  assert.match(tela, /'aria-modal': 'true'/)
  assert.match(css, /\.sl \{[^}]*width: 1120px; height: 630px/) // mesmo tamanho do PALCO
  assert.match(css, /\.sl \{[^}]*background: #fff/)
  for (const grupo of ['mercado', 'juros', 'cenarios', 'noticias', 'bndes', 'setores', 'bancos', 'feriados', 'calculadoras']) assert.match(blocos, new RegExp(`id: '${grupo}'`), `seção ${grupo} na montagem`)
  assert.doesNotMatch(blocos, /Aprender|aprender/) // Aprender fica fora da apresentação, a pedido
  assert.match(calc, /LINHAS_DE_PLANILHA = 14/) // tabelas longas (memórias e planilhas) não entram no slide das calculadoras
  assert.match(css, /\.sl-calc \[data-painel\^="Memória"\]/)
})
