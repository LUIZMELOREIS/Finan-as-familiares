import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icone } from './Icone'

const CHAVE_RECARGA = 'ff_recarregou_apos_erro'

/** Erro de carregar um pedaço do app (versão nova publicada enquanto a antiga estava aberta). */
export function ehErroDeCarregamento(erro: unknown): boolean {
  const m = erro instanceof Error ? erro.message : String(erro ?? '')
  return /dynamically imported module|Importing a module script failed|Failed to fetch|Load failed|ChunkLoadError|error loading dynamically/i.test(m)
}

interface Estado { erro: Error | null }

/**
 * Limite de erro global: em vez de tela preta, mostra o que aconteceu e oferece Recarregar e Voltar ao
 * Painel. Quando o erro é de carregamento de código (versão nova no ar), recarrega sozinho uma vez.
 */
export class LimiteDeErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null }

  static getDerivedStateFromError(erro: Error): Estado { return { erro } }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Erro na tela:', erro, info.componentStack)
    if (ehErroDeCarregamento(erro)) {
      try {
        if (sessionStorage.getItem(CHAVE_RECARGA) !== '1') { sessionStorage.setItem(CHAVE_RECARGA, '1'); window.location.reload(); return }
      } catch { window.location.reload(); return }
    }
  }

  recarregar = () => { try { sessionStorage.removeItem(CHAVE_RECARGA) } catch { /* ignora */ } window.location.reload() }
  voltar = () => { this.setState({ erro: null }); window.location.hash = '#/' }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children
    const carregamento = ehErroDeCarregamento(erro)
    return (
      <div role="alert" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--panel, #141519)', color: 'var(--text, #ECECF2)' }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: 24 }}>
          <Icone nome="triangle-alert" tamanho={36} style={{ color: 'var(--gold, #F2C552)', margin: '0 auto 10px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{carregamento ? 'O app foi atualizado' : 'Esta tela encontrou um problema'}</h2>
          <p className="sub" style={{ margin: '0 0 16px' }}>
            {carregamento
              ? 'Uma versão nova foi publicada enquanto esta estava aberta. Toque em Recarregar para continuar.'
              : 'Nada foi perdido. Toque em Recarregar ou volte ao Painel. Se repetir, mande uma foto desta tela.'}
          </p>
          {!carregamento && <p style={{ fontSize: 11.5, color: 'var(--faint, #5E6072)', wordBreak: 'break-word', margin: '0 0 16px' }}>{erro.message}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={this.recarregar}><Icone nome="refresh-cw" />Recarregar</button>
            <button type="button" className="btn btn-ghost" onClick={this.voltar}><Icone nome="chevron-left" />Voltar ao Painel</button>
          </div>
        </div>
      </div>
    )
  }
}
