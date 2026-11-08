import { useState } from 'react'

const audioUrl = './audio/cupom-cambial-notebooklm-2026-11-08.m4a'

export default function AprenderAudio() {
  const [failed, setFailed] = useState(false)
  return <section aria-label="Cupom cambial em áudio" className="learn-audio">
    <h3>Ouça a explicação</h3>
    <p>Resumo em português · piloto gerado com IA no NotebookLM. Os números são exemplos didáticos.</p>
    <audio controls preload="metadata" aria-label="Ouvir explicação sobre cupom cambial" src={audioUrl} onError={() => setFailed(true)} />
    {failed && <p role="alert">Não foi possível carregar o áudio. Você pode baixar o arquivo ou continuar lendo a explicação abaixo.</p>}
    <a href={audioUrl} download>Baixar áudio (M4A)</a>
  </section>
}
