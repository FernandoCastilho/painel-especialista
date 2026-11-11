import { useState } from 'react'
import FinameMateriais from './FinameMateriais.jsx'
import BndesTlpExigivel from './BndesTlpExigivel.jsx'
import BndesLcdCap from './BndesLcdCap.jsx'
import BndesCreditoTfb from './BndesCreditoTfb.jsx'
import Bndes from './Bndes.jsx'
import './BndesWorkspace.css'

const PROFILES = [
  ['finame-materiais', 'Finame Materiais Industrializados'],
  ['bndes-tlp-exigivel', 'TLP exigível · projeção própria'],
  ['bndes-selic-lcd', 'Selic + LCD · projeção própria'],
]

// Uma entrada, com os motores e as condições de cada modalidade preservados.
// As rotas anteriores continuam válidas; abrir taxas não desmonta o formulário.
export default function BndesWorkspace({ profile = 'finame-materiais', onView, onBack }) {
  const [area, setArea] = useState('simulate')
  const [quotesView, setQuotesView] = useState('')
  const historical = profile === 'bndes-credito-tfb'
  const navigate = next => { setArea('simulate'); onView(next) }
  const profileControl = <div className="bw-profile"><label htmlFor="bw-profile">Linha</label><select id="bw-profile" value={profile} onChange={event => navigate(event.target.value)}>{PROFILES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
  return <section className="cx bw" aria-labelledby="bw-title">
    <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
    <div className="bw-heading"><h2 id="bw-title"><strong>BNDES</strong><span>{profile === 'finame-materiais' ? 'Finame Materiais' : 'Financiamentos'}</span></h2>
    <nav className="bw-nav" aria-label="Área BNDES">
      <button type="button" aria-pressed={area === 'simulate' && !historical} onClick={() => { setArea('simulate'); if (historical) onView('finame-materiais') }} aria-label="Simular financiamento">Simular</button>
      <button type="button" aria-pressed={area === 'quotes'} onClick={() => setArea('quotes')}>Taxas e históricos</button>
    </nav></div>
    <div hidden={area !== 'simulate'} className="bw-simulation">
      {!historical && profile !== 'finame-materiais' && profileControl}
      <div hidden={profile !== 'finame-materiais'}><FinameMateriais onBack={onBack} onFundingView={navigate} profileControl={profile === 'finame-materiais' ? profileControl : null} /></div>
      {profile === 'bndes-tlp-exigivel' && <BndesTlpExigivel onBack={onBack} />}
      {profile === 'bndes-selic-lcd' && <BndesLcdCap onBack={onBack} />}
      {historical && <BndesCreditoTfb onBack={onBack} />}
    </div>
    <div hidden={area !== 'quotes'} className="bw-quotes">
      <p className="status">Todas as famílias disponíveis no painel: TFB, TFC, TLP e moedas contratuais. Cada referência conserva data, unidade, fonte e avisos; não significa cotação ao vivo.</p>
      <Bndes embedded view={quotesView} onView={setQuotesView} />
    </div>
  </section>
}
