import { useEffect, useRef, useState } from 'react'
import './AcessoPorEmail.css'
import { codigoValido, confirmarCodigo, emailValido, exigirAcesso, guardarAcesso, lerAcesso, limparAcesso, normalizarEmail, pedirCodigo, registrarVisita } from './acessoEmail.js'

const ESPERA_REENVIO = 60

// Porta de entrada: pede o e-mail, envia um código de 6 dígitos para ele e só libera o painel com o código certo.
// Quem já confirmou neste aparelho entra direto; a visita é registrada em segundo plano (no máximo uma vez por dia).
export default function AcessoPorEmail({ children }) {
  const [exigir] = useState(() => exigirAcesso())
  const [acesso, setAcesso] = useState(() => (exigir ? lerAcesso() : null))
  const [etapa, setEtapa] = useState('email') // 'email' | 'codigo'
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const envioEmCurso = useRef(false)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (!exigir || !acesso) return
    const hoje = new Date().toISOString().slice(0, 10)
    let ultima = null
    try { ultima = localStorage.getItem('painel-acesso-visita') } catch { /* sem armazenamento */ }
    if (ultima === hoje) return
    registrarVisita(acesso).then((r) => {
      if (r.ok) { try { localStorage.setItem('painel-acesso-visita', hoje) } catch { /* ok */ } }
      else if (!r.rede) { limparAcesso(); setAcesso(null) } // o servidor não reconhece mais este acesso
    })
  }, [exigir, acesso])

  useEffect(() => {
    if (espera <= 0) return undefined
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  if (!exigir || acesso) return children

  const enviarCodigo = async (e) => {
    e?.preventDefault()
    if (ocupado || envioEmCurso.current) return
    if (!emailValido(email)) { setErro('Digite um e-mail válido, como nome@empresa.com.br.'); return }
    setOcupado(true); setErro('')
    envioEmCurso.current = true
    const r = await pedirCodigo(email)
    envioEmCurso.current = false
    setOcupado(false)
    if (!r.ok) { setErro(r.erro || 'Não foi possível enviar o código.'); return }
    if (r.token) { entrar({ email: normalizarEmail(email), token: r.token }); return } // e-mail com entrada direta: sem código
    setEmail(normalizarEmail(email)); setCodigo(''); setEtapa('codigo'); setEspera(ESPERA_REENVIO)
  }

  const confirmar = async (e) => {
    e.preventDefault()
    if (ocupado) return
    if (!codigoValido(codigo)) { setErro('O código tem 6 números.'); return }
    setOcupado(true); setErro('')
    const r = await confirmarCodigo(email, codigo)
    setOcupado(false)
    if (!r.ok || !r.token) { setErro(r.erro || 'Código incorreto.'); return }
    entrar({ email, token: r.token })
  }

  function entrar(novo) {
    guardarAcesso(novo)
    setAcesso(novo)
  }

  return (
    <main className="acesso-email">
      <form className="acesso-card" onSubmit={etapa === 'email' ? enviarCodigo : confirmar} noValidate aria-labelledby="acesso-titulo">
        <h1 id="acesso-titulo">PEME · Painel Especializado no Mercado</h1>
        {etapa === 'email' ? (
          <>
            <p>Para entrar, digite seu e-mail. Vamos enviar um código de confirmação para ele.</p>
            <label htmlFor="acesso-email">E-mail</label>
            <input id="acesso-email" type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => { setEmail(e.target.value); setErro('') }} />
            <button type="submit" className="btn" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar código'}</button>
          </>
        ) : (
          <>
            <p>Enviamos um código de 6 números para <b>{email}</b>. Veja também a caixa de spam.</p>
            <label htmlFor="acesso-codigo">Código</label>
            <input id="acesso-codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required value={codigo} onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '')); setErro('') }} />
            <button type="submit" className="btn" disabled={ocupado}>{ocupado ? 'Conferindo…' : 'Entrar'}</button>
            <div className="acesso-links">
              <button type="button" className="acesso-link" disabled={ocupado || espera > 0} onClick={enviarCodigo}>{espera > 0 ? `Enviar de novo em ${espera}s` : 'Enviar de novo'}</button>
              <button type="button" className="acesso-link" onClick={() => { setEtapa('email'); setErro('') }}>Usar outro e-mail</button>
            </div>
          </>
        )}
        <p className="acesso-erro" role="alert">{erro}</p>
        <p className="acesso-aviso">Usamos seu e-mail apenas para registrar quem acessa o painel. Não enviamos propaganda nem repassamos a terceiros.</p>
      </form>
    </main>
  )
}
