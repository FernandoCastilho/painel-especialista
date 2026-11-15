import { Component } from 'react'
import { ehErroDeCarregamentoDeModulo, recarregarUmaVez } from './falhaCarregamento.js'

// Uma falha de renderização não deve deixar a página silenciosamente vazia.
export default class ErrorBoundary extends Component {
  state = { failed: false, modulo: false, recarregando: false }
  // Falha ao baixar o código de uma tela (versão nova publicada com o painel aberto): recarrega
  // sozinho uma vez. Acontece só na troca de tela, quando a tela de destino ainda nem abriu.
  static getDerivedStateFromError(error) {
    const modulo = ehErroDeCarregamentoDeModulo(error)
    return { failed: true, modulo, recarregando: modulo && recarregarUmaVez() }
  }
  render() {
    if (!this.state.failed) return this.props.children
    if (this.state.recarregando) return <main className="app"><p className="status" role="status">Atualizando o painel…</p></main>
    // "Tentar novamente" não resolve aqui: a falha de download fica memorizada até recarregar.
    if (this.state.modulo) return <main className="app" role="alert">
      <h1>Não foi possível carregar esta tela</h1>
      <p>Confira sua conexão e recarregue a página.</p>
      <button type="button" className="btn" onClick={() => window.location.reload()}>Recarregar página</button>
    </main>
    return <main className="app" role="alert">
      <h1>Não foi possível exibir esta tela</h1>
      <p>Os dados não foram alterados. Tente novamente ou recarregue a página.</p>
      <button type="button" className="btn" onClick={() => this.setState({ failed: false })}>Tentar novamente</button>{' '}
      <button type="button" className="btn" onClick={() => window.location.reload()}>Recarregar</button>
    </main>
  }
}
