import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AVISO_FONTES, AVISO_KEY, AVISO_RESUMO, avisoPendente, deveMostrarAviso, marcaDoAviso, marcarAvisoVisto, textoDoAviso } from '../src/avisoInicial.js'

const read = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const memoria = () => { const map = new Map(); return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) } }

test('o texto do aviso de entrada não mudou', () => {
  assert.equal(AVISO_RESUMO, 'Aplicativo educacional, com informação ilustrativa. Não é recomendação de crédito.')
  assert.deepEqual(AVISO_FONTES, [
    ['Quase ao vivo', 'câmbio, a cada poucos minutos em dias úteis (9h05 às 18h), sem garantia de tempo real.'],
    ['Diário', 'curvas de juros da B3, uma referência por dia útil.'],
    ['Semanal', 'Focus, às segundas.'],
    ['Manual', 'projeções dos bancos, conferidas à mão; cada uma mostra a sua data.'],
  ])
  assert.match(textoDoAviso(), /^Aplicativo educacional[\s\S]*Quase ao vivo: câmbio[\s\S]*Manual: projeções dos bancos/)
})

test('a marca é estável para o mesmo texto e muda quando o texto muda', () => {
  const marca = marcaDoAviso()
  assert.match(marca, /^v1-[0-9a-f]{8}$/)
  assert.equal(marcaDoAviso(), marca)
  assert.equal(marcaDoAviso(textoDoAviso()), marca)
  assert.notEqual(marcaDoAviso(textoDoAviso() + ' Nova ressalva.'), marca)
  assert.notEqual(marcaDoAviso(textoDoAviso().replace('Não é', 'Nao é')), marca)
  // Espaço ou quebra de linha a mais não conta como texto novo.
  assert.equal(marcaDoAviso(`  ${textoDoAviso().replace(/\n/g, '\n\n  ')} `), marca)
})

test('devo mostrar o aviso? primeira vez e texto novo sim; mesmo texto não', () => {
  const marca = marcaDoAviso()
  assert.equal(deveMostrarAviso(marca, null), true, 'nunca visto neste aparelho')
  assert.equal(deveMostrarAviso(marca, undefined), true)
  assert.equal(deveMostrarAviso(marca, ''), true)
  assert.equal(deveMostrarAviso(marca, marca), false, 'mesmo texto já visto')
  assert.equal(deveMostrarAviso(marca, marcaDoAviso('texto antigo')), true, 'texto mudou')
})

test('primeira visita mostra, visitas seguintes não, e texto novo volta a mostrar', () => {
  const storage = memoria()
  assert.equal(avisoPendente(storage), true)
  marcarAvisoVisto(storage)
  assert.equal(storage.map.get(AVISO_KEY), marcaDoAviso())
  assert.equal(avisoPendente(storage), false)
  assert.equal(avisoPendente(storage), false, 'não volta a cada entrada')
  assert.equal(avisoPendente(storage, textoDoAviso() + ' Trecho novo.'), true)
  marcarAvisoVisto(storage, textoDoAviso() + ' Trecho novo.')
  assert.equal(avisoPendente(storage, textoDoAviso() + ' Trecho novo.'), false)
  assert.equal(avisoPendente(storage), true, 'a marca guardada é de outro texto')
})

test('armazenamento bloqueado ou ausente: o aviso aparece e nada quebra', () => {
  const bloqueado = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') } }
  assert.equal(avisoPendente(bloqueado), true)
  assert.doesNotThrow(() => marcarAvisoVisto(bloqueado))
  assert.equal(avisoPendente(null), true)
  assert.doesNotThrow(() => marcarAvisoVisto(null))
})

test('App: aviso sozinho só quando pendente e fora de navegador automatizado; conceito e panorama não abrem sozinhos', () => {
  const app = read('App.jsx')
  assert.match(app, /useState\(\(\) => !navigator\.webdriver && avisoPendente\(\)\)/)
  assert.match(app, /const fecharAviso = \(\) => \{ marcarAvisoVisto\(\); setAvisoAberto\(false\) \}/)
  assert.match(app, /<AvisoInicial open=\{avisoAberto\} onClose=\{fecharAviso\} \/>/)
  // O conteúdo do aviso continua a um clique, na janela do "i", presente em todas as telas.
  assert.match(app, /onClick=\{\(\) => setAvisoAberto\(true\)\}>Ver o aviso de entrada<\/button>/)
  assert.doesNotMatch(app, /<ConceitoDiario/)
  assert.match(app, /<MarketPopup open=\{panorama\.aberto\} slot=\{panorama\.momento\} onClose=\{panorama\.fechar\}/)
  const aviso = read('AvisoInicial.jsx')
  assert.match(aviso, /<p>\{AVISO_RESUMO\}<\/p>/)
  assert.match(aviso, /AVISO_FONTES\.map\(\(\[rotulo, texto\]\) => <li key=\{rotulo\}><b>\{rotulo\}:<\/b> \{texto\}<\/li>\)/)
  // Nenhum dos três componentes agenda abertura por tempo.
  for (const name of ['AvisoInicial.jsx', 'ConceitoDiario.jsx', 'MarketPopup.jsx']) assert.doesNotMatch(read(name), /setInterval|setTimeout|navigator\.locks/, name)
  // Quem não é desta entrega continua desligado em navegador automatizado.
  assert.match(read('Recado.jsx'), /navigator\.webdriver/)
  assert.match(read('AlertaVariacao.jsx'), /navigator\.webdriver/)
})
