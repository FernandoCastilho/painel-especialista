import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calcularRegular, calcularSimples, aliquotaEfetiva, impostoSeletivo, moeda } from '../src/rtcCalc.js'
import { aliquotasDoAno, ANOS_REFORMA } from '../src/rtcAnos.js'

// Casos copiados dos testes e exemplos oficiais da Receita Federal (licença MIT). Referência em cada caso:
// RR = github.com/ReceitaFederal/calculadora-rtc-regime-regular @ 150cccbe (versão 1.6.1)
// SN = github.com/ReceitaFederal/calculadora-rtc-simples-nacional @ c5b0f01c (versão 0.0.6)
const oficial = JSON.parse(readFileSync(new URL('../src/rtcOficial.json', import.meta.url)))
const reducao = cClassTrib => oficial.reducoes.find(r => r.cClassTrib === cClassTrib).reducao
const a2026 = (() => { const a = aliquotasDoAno(2026, oficial); return { cbs: a.cbs, ibsUf: a.ibsUf, ibsMun: a.ibsMun } })()
const hip = { cbs: 8.4, ibsUf: 0.05, ibsMun: 0.05 } // alíquotas informadas nos próprios testes oficiais de 2027/2028
const tabaco = { base: 200, adValorem: 13, quantidade: 1, adRem: 21.3, impostoInformado: 0 }
const confere = (r, esperado) => {
  assert.equal(moeda(r.baseCalculo), esperado.vBC, 'base de cálculo')
  assert.equal(moeda(r.cbs.valor), esperado.cbs, 'CBS')
  assert.equal(moeda(r.ibsUf.valor), esperado.ibsUf, 'IBS estadual')
  assert.equal(moeda(r.ibsMun.valor), esperado.ibsMun, 'IBS municipal')
  if ('vIS' in esperado) assert.equal(moeda(r.impostoSeletivo), esperado.vIS, 'Imposto Seletivo')
}

test('dados oficiais: 2026 com CBS 0,9%, IBS estadual 0,1% e municipal 0%; 2027+ sem alíquota oficial', () => {
  assert.deepEqual(a2026, { cbs: 0.9, ibsUf: 0.1, ibsMun: 0 }) // B0001 linhas 36276–36292
  assert.equal(aliquotasDoAno(2026, oficial).oficial, true)
  for (const ano of ANOS_REFORMA.filter(a => a > 2026)) assert.equal(aliquotasDoAno(ano, oficial).oficial, false)
  assert.equal(oficial.aliquotasReferencia.length, 1) // V0053 apagou 2027–2033
  assert.ok(oficial.reducoes.every(r => Object.values(r.reducao).every(v => v >= 0 && v <= 100)))
  assert.ok(oficial.reducoes.some(r => r.reducao.cbs === 30) && oficial.reducoes.some(r => r.reducao.cbs === 100))
  assert.match(oficial.fonte.versaoBaseDados, /^V\d{4}$/)
})
test('valores iniciais de 2027 a 2033: escada da carga inicial da Receita (decisão de Fernando, 19/11/2026)', () => {
  // B0001 linhas 36269–36440, apagadas pela V0053 em 28/08/2026. Hipótese editável, não alíquota oficial.
  const escada = { 2027: [8.4, 0.05, 0.05], 2028: [8.4, 0.05, 0.05], 2029: [8.5, 1.6, 0.25], 2030: [8.5, 3.2, 0.5],
    2031: [8.5, 4.8, 0.75], 2032: [8.5, 6.4, 1], 2033: [8.5, 16, 2.5] }
  for (const [ano, [cbs, ibsUf, ibsMun]] of Object.entries(escada)) {
    const a = aliquotasDoAno(Number(ano), oficial)
    assert.deepEqual({ cbs: a.cbs, ibsUf: a.ibsUf, ibsMun: a.ibsMun }, { cbs, ibsUf, ibsMun }, ano)
    assert.ok(a.origem.every(o => !/TCU/.test(o)), `${ano} sem referência ao TCU`)
  }
  const a2033 = aliquotasDoAno(2033, oficial)
  assert.equal(moeda(a2033.cbs + a2033.ibsUf + a2033.ibsMun), 27)
  for (const ano of [2027, 2028]) assert.match(aliquotasDoAno(ano, oficial).origem.join(' '), /art\. 347[\s\S]*art\. 349[\s\S]*art\. 344/)
})
test('RR Teste_000001_1 (2026, tributação integral)', () => {
  confere(calcularRegular({ baseCalculo: 200, aliquotas: a2026 }), { vBC: 200, cbs: 1.8, ibsUf: 0.2, ibsMun: 0 })
})
test('RR Teste_000001_2 (2027, Imposto Seletivo 13% + R$ 21,30 entra na base)', () => {
  confere(calcularRegular({ baseCalculo: 200, impostoSeletivo: tabaco, aliquotas: hip }), { vBC: 247.3, cbs: 20.77, ibsUf: 0.12, ibsMun: 0.12, vIS: 47.3 })
})
test('RR Teste_000001_5 (2028, sem Imposto Seletivo)', () => {
  confere(calcularRegular({ baseCalculo: 200, aliquotas: hip }), { vBC: 200, cbs: 16.8, ibsUf: 0.1, ibsMun: 0.1 })
})
test('RR Teste_000001_6 (2028, Imposto Seletivo 5,27% em veículo)', () => {
  confere(calcularRegular({ baseCalculo: 200, impostoSeletivo: { base: 200, adValorem: 5.27, quantidade: 1, impostoInformado: 0 }, aliquotas: hip }),
    { vBC: 210.54, cbs: 17.69, ibsUf: 0.11, ibsMun: 0.11, vIS: 10.54 })
})
test('RR Teste_011002_1 (2026, planos de saúde, redução de 60% da tabela)', () => {
  assert.deepEqual(reducao('011002'), { cbs: 60, ibsUf: 60, ibsMun: 60 })
  confere(calcularRegular({ baseCalculo: 200, aliquotas: a2026, reducao: reducao('011002') }), { vBC: 200, cbs: 0.72, ibsUf: 0.08, ibsMun: 0 })
})
test('RR Teste_200032_1 (2026, medicamentos, redução de 60%)', () => {
  confere(calcularRegular({ baseCalculo: 200, aliquotas: a2026, reducao: reducao('200032') }), { vBC: 200, cbs: 0.72, ibsUf: 0.08, ibsMun: 0 })
})
test('RR Teste_200032_2 (2027, redução de 60% com Imposto Seletivo)', () => {
  confere(calcularRegular({ baseCalculo: 200, impostoSeletivo: tabaco, aliquotas: hip, reducao: reducao('200032') }), { vBC: 247.3, cbs: 8.31, ibsUf: 0.05, ibsMun: 0.05, vIS: 47.3 })
})
test('RR Teste_200002_1 (2026, produtor rural, redução de 100%)', () => {
  confere(calcularRegular({ baseCalculo: 200, aliquotas: a2026, reducao: reducao('200002') }), { vBC: 200, cbs: 0, ibsUf: 0, ibsMun: 0 })
})
test('RR Teste_200002_2 (2027, redução de 100% com Imposto Seletivo)', () => {
  confere(calcularRegular({ baseCalculo: 200, impostoSeletivo: tabaco, aliquotas: hip, reducao: reducao('200002') }), { vBC: 247.3, cbs: 0, ibsUf: 0, ibsMun: 0, vIS: 47.3 })
})
test('RR docs/exemplos.md item 3 (educação 200028: 8,8% × 0,4 = 3,52%)', () => {
  const r = calcularRegular({ baseCalculo: 1200, aliquotas: { cbs: 8.8, ibsUf: 0.05, ibsMun: 0.05 }, reducao: reducao('200028') })
  assert.equal(r.cbs.aliquotaEfetiva, 3.52)
  assert.equal(moeda(r.ibsUf.aliquotaEfetiva), 0.02)
  confere(r, { vBC: 1200, cbs: 42.24, ibsUf: 0.24, ibsMun: 0.24 })
  assert.equal(moeda(r.ibs), 0.48)
})
test('RR docs/exemplos.md totais (arroz 200003 + cerveja com IS + educação): vBC 1.465,00, CBS 56,76, IBS 0,64, IS 15,00', () => {
  const a = { cbs: 8.8, ibsUf: 0.05, ibsMun: 0.05 }
  const itens = [
    calcularRegular({ baseCalculo: 100, aliquotas: a, reducao: reducao('200003') }),
    calcularRegular({ impostoSeletivo: { base: 150, adValorem: 10, quantidade: 12, impostoInformado: 15 }, aliquotas: a }),
    calcularRegular({ baseCalculo: 1200, aliquotas: a, reducao: reducao('200028') }),
  ]
  const soma = f => itens.reduce((t, i) => t + f(i), 0)
  assert.equal(moeda(soma(i => i.baseCalculo)), 1465)
  assert.equal(moeda(soma(i => i.cbs.valor)), 56.76)
  assert.equal(moeda(soma(i => i.ibs)), 0.64)
  assert.equal(moeda(soma(i => i.impostoSeletivo)), 15)
})
test('RR Teste_000001_9 (regras da base com Imposto Seletivo)', () => {
  const caso = (baseCalculo, isBase, informado) => moeda(calcularRegular({ baseCalculo, aliquotas: hip,
    impostoSeletivo: { base: isBase, adValorem: 13, quantidade: 1, adRem: 21.3, impostoInformado: informado ?? undefined } }).baseCalculo)
  assert.equal(caso(200, 188, 12), 233.74)
  assert.equal(caso(null, 188, 12), 233.74)
  assert.equal(caso(null, 188, null), 233.74)
  assert.equal(caso(200, 188, null), 245.74)
  assert.equal(caso(188, 188, 0), 233.74)
  assert.equal(calcularRegular({ baseCalculo: 200.5, aliquotas: hip, impostoSeletivo: { base: 188.25, adValorem: 13, quantidade: 1, adRem: 21.3, impostoInformado: 12.25 } }).baseCalculo, 234.0225)
  assert.equal(impostoSeletivo({ base: 188, adValorem: 13, quantidade: 1, adRem: 21.3 }), 45.74)
})
test('RR ArredondamentoUtils: 8 casas e arredondamento bancário', () => {
  assert.equal(moeda(17.68536), 17.69)
  assert.equal(moeda(0.0825), 0.08)
  assert.equal(moeda(0.645), 0.64)
  assert.equal(moeda(11.875), 11.88)
  assert.equal(aliquotaEfetiva(0.9, 60), 0.36)
})
const sn = (receita, tipoReceita, vIS = 0) => calcularSimples({ receita, impostoSeletivo: vIS, pIbs: 1.25, pCbs: 2.75, tipoReceita })
test('SN Teste_SimplesNacionalCalculoService caso01 (venda interna)', () => {
  const r = sn(1000, 1)
  assert.deepEqual([r.baseCalculo, r.ibs, r.cbs, r.total], [1000, 12.5, 27.5, 40])
})
test('SN caso02 (Imposto Seletivo fora da receita, somado ao total)', () => {
  const r = sn(950, 1, 50)
  assert.deepEqual([r.receita, r.ibs, r.cbs, r.impostoSeletivo, r.total], [950, 11.875, 26.125, 50, 88])
})
test('SN caso03 (mercado interno e exportação: metade da receita)', () => {
  const r = sn(1000, 5)
  assert.deepEqual([r.baseCalculo, r.ibs, r.cbs], [500, 6.25, 13.75])
})
test('SN caso04 (exportação indireta: valores suspensos, nada devido)', () => {
  const r = sn(1000, 4)
  assert.deepEqual([r.ibs, r.ibsPendente, r.cbs, r.cbsPendente, r.total], [0, 12.5, 0, 27.5, 0])
})
test('SN caso05a07 (exportação direta: tudo zero)', () => {
  const r = sn(1000, 3)
  assert.deepEqual([r.baseCalculo, r.ibs, r.cbs, r.ibsPendente, r.cbsPendente], [0, 0, 0, 0, 0])
})
test('extrator lê INSERT, UPDATE e DELETE oficiais como texto e para em forma desconhecida', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const raiz = mkdtempSync(join(tmpdir(), 'rtc-'))
  mkdirSync(join(raiz, 'flyway/sql/criacao'), { recursive: true }); mkdirSync(join(raiz, 'flyway/sql/manutencao'))
  writeFileSync(join(raiz, 'pom.xml'), '<artifactId>CalculadorTributo</artifactId><version>9.9.9</version>')
  writeFileSync(join(raiz, 'flyway/sql/criacao/B0001__sistema_tributario_completo.sql'), `
INSERT INTO VERSAO_BASE_DADO (VRBD_DATA, VRBD_DESCRICAO, VRBD_VERSAO_BASE_DADO) VALUES (datetime('2025-01-01'), 'carga; inicial', 'v0001');
INSERT INTO SITUACAO_TRIBUTARIA (SITR_ID, SITR_CD, SITR_DESCRICAO, SITR_INICIO_VIGENCIA, SITR_FIM_VIGENCIA) VALUES (1, '200', 'Alíquota reduzida', '2026-01-01', NULL);
INSERT INTO CLASSIFICACAO_TRIBUTARIA (CLTR_ID, CLTR_SITR_ID, CLTR_CD, CLTR_DESCRICAO, CLTR_INICIO_VIGENCIA, CLTR_FIM_VIGENCIA) VALUES
 ( -- comentário com ; dentro
  1, 1, '200001', 'Item d''água', '2026-01-01', NULL), (2, 1, '200002', 'Apagado', '2026-01-01', NULL);
INSERT INTO PERCENTUAL_REDUCAO (PERE_ID, PERE_CLTR_ID, PERE_TBTO_ID, PERE_VALOR, PERE_INICIO_VIGENCIA, PERE_FIM_VIGENCIA) VALUES
 (1, 1, 2, 30.0, '2026-01-01', NULL), (2, 1, 3, 30.0, '2026-01-01', NULL), (3, 1, 4, 30.0, '2026-01-01', NULL), (4, 2, 2, 60.0, '2026-01-01', NULL);
INSERT INTO ALIQUOTA_REFERENCIA (ALRE_ID, ALRE_VALOR, ALRE_INICIO_VIGENCIA, ALRE_FIM_VIGENCIA, ALRE_TBTO_ID) VALUES
 (1, 0.90, '2026-01-01', NULL, 2), (2, 0.10, '2026-01-01', NULL, 3), (3, 0.00, '2026-01-01', NULL, 4), (4, 8.40, '2027-01-01', NULL, 2);`)
  writeFileSync(join(raiz, 'flyway/sql/manutencao/V0002__x.sql'), `
INSERT INTO VERSAO_BASE_DADO (VRBD_DATA, VRBD_VERSAO_BASE_DADO, VRBD_DESCRICAO) VALUES (datetime('2026-09-02'), 'V0002', 'Ajustes');
UPDATE PERCENTUAL_REDUCAO SET PERE_VALOR=40.0 WHERE PERE_ID IN (1, 2, 3);
DELETE FROM CLASSIFICACAO_TRIBUTARIA WHERE CLTR_ID = 2;
DELETE FROM ALIQUOTA_REFERENCIA WHERE ALRE_TBTO_ID IN (2, 3, 4) AND ALRE_INICIO_VIGENCIA > '2026-12-31';
UPDATE ALIQUOTA_REFERENCIA SET ALRE_FIM_VIGENCIA = '2026-12-31' WHERE ALRE_INICIO_VIGENCIA <= '2026-12-31' and ALRE_TBTO_ID IN (2,3,4);`)
  const script = new URL('../scripts/extract-rtc-oficial.py', import.meta.url).pathname
  const saida = join(raiz, 'out.json')
  const ok = spawnSync('python3', ['-I', script, raiz, saida], { encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stderr)
  const out = JSON.parse(readFileSync(saida, 'utf8'))
  assert.equal(out.fonte.versaoCalculadora, '9.9.9')
  assert.equal(out.fonte.versaoBaseDados, 'V0002')
  assert.deepEqual(out.aliquotasReferencia, [{ ano: 2026, inicio: '2026-01-01', fim: '2026-12-31', cbs: 0.9, ibsUf: 0.1, ibsMun: 0 }])
  assert.deepEqual(out.reducoes.map(r => [r.cClassTrib, r.descricao, r.reducao]), [['200001', "Item d'água", { cbs: 40, ibsUf: 40, ibsMun: 40 }]])
  writeFileSync(join(raiz, 'flyway/sql/manutencao/V0003__y.sql'), "UPDATE PERCENTUAL_REDUCAO SET PERE_VALOR=0 WHERE PERE_ID > 1;")
  const falha = spawnSync('python3', ['-I', script, raiz, saida], { encoding: 'utf8' })
  assert.notEqual(falha.status, 0)
  assert.match(falha.stderr, /UPDATE não reconhecido/)
})
