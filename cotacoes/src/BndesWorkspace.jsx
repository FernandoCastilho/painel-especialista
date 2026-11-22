import { useState } from 'react'
import FinameMateriais from './FinameMateriais.jsx'
import BndesTlpExigivel from './BndesTlpExigivel.jsx'
import BndesLcdCap from './BndesLcdCap.jsx'
import BndesCreditoTfb from './BndesCreditoTfb.jsx'
import Bndes from './Bndes.jsx'
import BndesCustosProdutos from './BndesCustosProdutos.jsx'
import './BndesWorkspace.css'
import './FinameComparisonLayout.css'
import './CalculatorPattern.css'
import CalcBack from './CalcBack.jsx'

const PROFILES = [
  ['finame-materiais', 'Finame Materiais Industrializados'],
  ['finame-veiculos', 'Finame Veículos'],
  ['bndes-giro', 'BNDES Giro'],
  ['bndes-tlp-exigivel', 'TLP exigível · projeção própria'],
  ['bndes-selic-lcd', 'Selic + LCD · projeção própria'],
]

const ALIASES = { 'finame-veiculos': 'Finame Veículos', 'bndes-giro': 'BNDES Giro' }

// Uma entrada, com os motores e as condições de cada modalidade preservados.
// As rotas anteriores continuam válidas; abrir taxas não desmonta o formulário.
export default function BndesWorkspace({ profile = 'finame-materiais', onView, onBack, apresentacao }) {
  const [area, setArea] = useState('simulate')
  const [quotesView, setQuotesView] = useState('')
  // "Finame Veículos" e "BNDES Giro" são só opções de apresentação: usam a mesma calculadora e os mesmos cálculos do Finame Materiais.
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
      <div hidden={profile !== 'finame-materiais'}><FinameMateriais onBack={onBack} onFundingView={navigate} profileControl={profile === 'finame-materiais' ? profileControl : null} apresentacao={apresentacao} /></div>
      {profile === 'bndes-tlp-exigivel' && <BndesTlpExigivel onBack={onBack} />}
      {profile === 'bndes-selic-lcd' && <BndesLcdCap onBack={onBack} />}
      {historical && <BndesCreditoTfb onBack={onBack} />}
    </div>
    {area === 'costs' && <div className="bw-costs"><BndesCustosProdutos /></div>}
    <div hidden={area !== 'quotes'} className="bw-quotes">
      <p className="status">Todas as famílias disponíveis no painel: TFB, TFC, TLP e moedas contratuais. Cada referência conserva data, unidade, fonte e avisos; não significa cotação ao vivo.</p>
      <Bndes embedded view={quotesView} onView={setQuotesView} />
    </div>
  </section></div>
}
