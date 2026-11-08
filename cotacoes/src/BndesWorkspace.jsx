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
  return <section className="cx bw" aria-labelledby="bw-title">
    <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
    <div className="bw-heading"><div><h2 id="bw-title">BNDES</h2><p>Simulação, comparação de custos e referências em um só lugar.</p></div><span className="bw-badge">Estimativas · não é proposta contratual</span></div>
    <nav className="bw-nav" aria-label="Área BNDES">
      <button type="button" aria-pressed={area === 'simulate' && !historical} onClick={() => { setArea('simulate'); if (historical) onView('finame-materiais') }}>Simular financiamento</button>
      <button type="button" aria-pressed={area === 'quotes'} onClick={() => setArea('quotes')}>Taxas e históricos</button>
      <button type="button" aria-pressed={area === 'simulate' && historical} onClick={() => navigate('bndes-credito-tfb')}>Exemplo conferido · histórico</button>
    </nav>
    <div hidden={area !== 'simulate'} className="bw-simulation">
      {!historical && <div className="bw-profile"><label htmlFor="bw-profile">Perfil da simulação</label><select id="bw-profile" value={profile} onChange={event => navigate(event.target.value)}>{PROFILES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><p>Regras, entradas e cronogramas específicos de cada perfil. Não há transferência automática entre modalidades.</p></div>}
      <div hidden={profile !== 'finame-materiais'}><FinameMateriais onBack={onBack} onFundingView={navigate} /></div>
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
