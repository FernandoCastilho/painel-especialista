import { lazy, useState } from 'react'
import './BndesSimulation.css'
import CalcBack from './CalcBack.jsx'

const FinameMateriais = lazy(() => import('./FinameMateriais.jsx'))
const BndesTlpExigivel = lazy(() => import('./BndesTlpExigivel.jsx'))
const BndesLcdCap = lazy(() => import('./BndesLcdCap.jsx'))
const BndesCreditoTfb = lazy(() => import('./BndesCreditoTfb.jsx'))
const Bndes = lazy(() => import('./Bndes.jsx'))
const BndesCustosProdutos = lazy(() => import('./BndesCustosProdutos.jsx'))

export const PROFILES = [
  ['finame-materiais', 'Finame Materiais Industrializados'],
  ['finame-veiculos', 'Finame Veículos · Ônibus e caminhões'],
  ['finame-bk', 'Finame BK · Máquinas e equipamentos'],
  ['brasil-soberano-bk', 'Brasil Soberano · Bens de capital'],
  ['bndes-giro', 'BNDES Giro'],
  ['bndes-tlp-exigivel', 'TLP exigível · projeção própria'],
  ['bndes-selic-lcd', 'Selic + LCD · projeção própria'],
]

export const ALIASES = { 'finame-veiculos': 'Finame Veículos', 'finame-bk': 'Finame BK', 'brasil-soberano-bk': 'Brasil Soberano', 'bndes-giro': 'BNDES Giro' }
// Finame Veículos, Finame BK e Brasil Soberano usam o mesmo motor, cada um com as regras do seu produto (prazo, carência, custos e taxas).
const PRODUTO_DA_VARIANTE = { 'finame-veiculos': 'veiculos-onibus', 'finame-bk': 'bk-maquinas', 'brasil-soberano-bk': 'brasil-soberano-bk' }

// Depois da primeira visita, os campos e o período consultado continuam montados.
function PainelVisitado({ aberto, className, children }) {
  const [visitado, setVisitado] = useState(aberto)
  if (aberto && !visitado) setVisitado(true)
  return <div hidden={!aberto} className={className}>{(aberto || visitado) && children}</div>
}

// Uma entrada, com os motores e as condições de cada modalidade preservados.
// As rotas anteriores continuam válidas; abrir taxas não desmonta o formulário.
export default function BndesWorkspace({ profile = 'finame-materiais', onView, onBack, apresentacao }) {
  const [area, setArea] = useState('simulate')
  const [quotesView, setQuotesView] = useState('')
  // "BNDES Giro" é só opção de apresentação. Finame Veículos, Finame BK e Brasil Soberano usam a mesma calculadora com as regras de cada produto.
  const [variante, setVariante] = useState('')
  const historical = profile === 'bndes-credito-tfb'
  const navigate = next => {
    setArea('simulate')
    const alias = ALIASES[next]
    setVariante(alias ? next : '')
    onView(alias ? 'finame-materiais' : next)
  }
  const selected = profile === 'finame-materiais' && variante ? variante : profile
  const profileControl = <div className="bw-profile"><label htmlFor="bw-profile">Linha</label><select id="bw-profile" value={selected} onChange={event => navigate(event.target.value)}>{PROFILES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
  return <div className="bndes-page">
    <section className="cx bw" aria-labelledby="bw-title">
    <div className="bw-heading"><div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="bw-title"><img className="bndes-official-logo" src="./brands/bndes.png" alt="BNDES · O banco nacional do desenvolvimento" /><span>{profile === 'finame-materiais' ? (ALIASES[variante] ?? 'Finame Materiais') : 'Financiamentos'}</span></h2></div>
    <nav className="bw-nav" aria-label="Área BNDES">
      <button type="button" aria-pressed={area === 'simulate' && !historical} onClick={() => { setArea('simulate'); if (historical) navigate('finame-materiais') }} aria-label="Simular financiamento">Simular</button>
      <button type="button" aria-pressed={area === 'quotes'} onClick={() => setArea('quotes')}>Taxas e históricos</button>
      <button type="button" aria-pressed={area === 'costs'} onClick={() => setArea('costs')}>Custos por produto</button>
    </nav></div>
    <div hidden={area !== 'simulate'} className="bw-simulation">
      {!historical && profile !== 'finame-materiais' && profileControl}
      <PainelVisitado aberto={profile === 'finame-materiais'}><FinameMateriais onBack={onBack} onFundingView={navigate} profileControl={profile === 'finame-materiais' ? profileControl : null} apresentacao={apresentacao} produto={PRODUTO_DA_VARIANTE[variante] ?? 'materiais'} /></PainelVisitado>
      {profile === 'bndes-tlp-exigivel' && <BndesTlpExigivel onBack={onBack} />}
      {profile === 'bndes-selic-lcd' && <BndesLcdCap onBack={onBack} />}
      {historical && <BndesCreditoTfb onBack={onBack} />}
    </div>
    {area === 'costs' && <div className="bw-costs"><BndesCustosProdutos /></div>}
    <PainelVisitado aberto={area === 'quotes'} className="bw-quotes">
      <p className="status">Todas as famílias disponíveis no painel: TFB, TFC, TLP e moedas contratuais. Cada referência conserva data, unidade, fonte e avisos; não significa cotação ao vivo.</p>
      <Bndes embedded view={quotesView} onView={setQuotesView} />
    </PainelVisitado>
  </section></div>
}
