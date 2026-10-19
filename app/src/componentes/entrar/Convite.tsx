/**
 * Entrada por convite: Instalar na tela inicial → nome, apelido, cor, foto → PIN (duas vezes) → entrar_convite.
 */
import { useEffect, useState } from 'react'
import type { Usuario } from '../../tipos'
import { api, arquivoParaBase64, comprimirImagem, type Sessao } from '../../api/cliente'
import { Avatar } from '../Avatar'
import { Icone, corVar } from '../Icone'
import { useInstalacao } from '../../hooks/useInstalacao'
import { TecladoPin } from './TecladoPin'

export interface DadosConvite {
  codigo: string
  perfil: string
  url_api: string
  token_familia: string
}

const CORES = ['indigo', 'magenta', 'gold', 'orange', 'green', 'lilac'] as const
type Passo = 'instalar' | 'dados' | 'pin' | 'confirmar'

export function Convite({ convite, aoEntrar, aoCancelar }: { convite: DadosConvite; aoEntrar: (u: Usuario, sessao: Sessao) => void; aoCancelar: () => void }) {
  const inst = useInstalacao()
  const [passo, setPasso] = useState<Passo>(inst.instalado ? 'dados' : 'instalar')
  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [cor, setCor] = useState<string>('indigo')
  const [foto, setFoto] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [estadoApi, setEstadoApi] = useState<'verificando' | 'ok' | 'falha'>(convite.url_api ? 'verificando' : 'ok')
  const [erroApi, setErroApi] = useState('')

  // Com API real, confere logo no início se ela responde: evita descobrir só depois de digitar nome e PIN.
  const verificarApi = async () => {
    if (!convite.url_api) return
    setEstadoApi('verificando'); setErroApi('')
    try {
      const r = await api<{ versao: string }>('ping', {}, { url_api: convite.url_api, token_familia: convite.token_familia, token: '', usuario_id: '' })
      if (!r?.versao) throw new Error('A API respondeu, mas não parece ser o Finanças da Família.')
      setEstadoApi('ok')
    } catch (e) {
      setEstadoApi('falha'); setErroApi(e instanceof Error ? e.message : 'A API não respondeu.')
    }
  }
  useEffect(() => { void verificarApi() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const escolherFoto = async (arq: File | undefined) => {
    if (!arq) return
    try {
      const blob = await comprimirImagem(arq, 512, 0.8)
      const b64 = await arquivoParaBase64(blob)
      setFoto(`data:image/jpeg;base64,${b64}`)
    } catch { setErro('Não foi possível ler a foto.') }
  }

  // Recebe o valor digitado: o estado `pin2` ainda não foi atualizado quando o 4º dígito dispara a confirmação.
  const confirmar = async (confirmacao = pin2) => {
    if (confirmacao.length < 4) return
    if (pin !== confirmacao) { setErro('Os PINs não conferem. Tente de novo.'); setPin(''); setPin2(''); setPasso('pin'); return }
    setEnviando(true); setErro('')
    const sessaoBase: Sessao = { url_api: convite.url_api, token_familia: convite.token_familia, token: '', usuario_id: '' }
    try {
      const u = await api<Usuario>('entrar_convite', { codigo_convite: convite.codigo, nome: nome.trim() || apelido.trim(), apelido: apelido.trim() || nome.trim().split(' ')[0], avatar: foto, cor, pin, perfil: convite.perfil || 'Adulto' }, sessaoBase)
      if (!u?.token) throw new Error('A API não devolveu o acesso. Confira o código do convite.')
      aoEntrar(u, { ...sessaoBase, token: u.token, usuario_id: u.id })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar')
      setEnviando(false)
    }
  }

  const titulo: Record<Passo, string> = { instalar: 'Instalar na tela inicial', dados: 'Como quer aparecer?', pin: 'Escolha um PIN de 4 dígitos', confirmar: 'Repita o PIN' }

  return (
    <div className="card" style={{ width: '100%', textAlign: 'left', padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {passo !== 'instalar' && passo !== 'dados' && <button type="button" className="icon-btn" aria-label="Voltar" onClick={() => setPasso(passo === 'confirmar' ? 'pin' : 'dados')}><Icone nome="chevron-left" /></button>}
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, flex: 1 }}>{titulo[passo]}</h2>
        <span className="sub num">{['instalar', 'dados', 'pin', 'confirmar'].indexOf(passo) + 1}/4</span>
      </div>

      {estadoApi === 'falha' && (
        <div role="alert" style={{ background: 'rgba(229,83,91,.12)', border: '1px solid rgba(229,83,91,.4)', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
          <p style={{ margin: '0 0 6px', color: 'var(--red)' }}><Icone nome="triangle-alert" tamanho={15} style={{ display: 'inline', verticalAlign: -3, marginRight: 6 }} />Não consegui falar com a API da família.</p>
          <p style={{ margin: '0 0 8px', color: 'var(--muted)' }}>{erroApi}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void verificarApi()}>Tentar de novo</button>
        </div>
      )}
      {estadoApi === 'verificando' && <p className="sub" style={{ margin: '0 0 10px' }}>Conferindo a conexão com a API…</p>}

      {passo === 'instalar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5 }}>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Instalado, o app abre em tela cheia e lembra o seu perfil. Leva menos de um minuto.</p>
          {inst.ios ? (
            <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>No Safari, toque em <b style={{ fontWeight: 500 }}>Compartilhar</b> <Icone nome="share-2" tamanho={15} style={{ display: 'inline', verticalAlign: -3 }} /> na barra inferior.</li>
              <li>Role e toque em <b style={{ fontWeight: 500 }}>Adicionar à Tela de Início</b> <Icone nome="plus" tamanho={15} style={{ display: 'inline', verticalAlign: -3 }} />.</li>
              <li>Confirme em <b style={{ fontWeight: 500 }}>Adicionar</b> e abra o app pelo ícone novo.</li>
            </ol>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>No Chrome, toque no menu <Icone nome="more-horizontal" tamanho={15} style={{ display: 'inline', verticalAlign: -3 }} /> no canto superior.</li>
              <li>Toque em <b style={{ fontWeight: 500 }}>Instalar aplicativo</b> ou <b style={{ fontWeight: 500 }}>Adicionar à tela inicial</b>.</li>
              <li>Abra o app pelo ícone novo e continue por lá.</li>
            </ol>
          )}
          {inst.podeInstalar && <button type="button" className="btn btn-primary btn-block" onClick={() => inst.instalar().then((ok) => ok && setPasso('dados'))}><Icone nome="download" />Instalar agora</button>}
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setPasso('dados')}>Continuar no navegador</button>
        </div>
      )}

      {passo === 'dados' && (
        <form onSubmit={(e) => { e.preventDefault(); if (apelido.trim() || nome.trim()) setPasso('pin') }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <Avatar usuario={{ nome, apelido, avatar: foto, cor }} tamanho={56} />
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
              <Icone nome="camera" />{foto ? 'Trocar foto' : 'Foto (opcional)'}
              <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => escolherFoto(e.target.files?.[0])} />
            </label>
            {foto && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFoto('')}>Remover</button>}
          </div>
          <div className="field"><label htmlFor="cv-nome">Nome</label><input id="cv-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Como está no documento" /></div>
          <div className="field"><label htmlFor="cv-apelido">Apelido (como a família chama)</label><input id="cv-apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} autoComplete="nickname" placeholder="Ex.: Luiz" required /></div>
          <div className="field">
            <span className="rotulo">Cor</span>
            <div style={{ display: 'flex', gap: 10 }} role="radiogroup" aria-label="Cor do perfil">
              {CORES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c} onClick={() => setCor(c)}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: corVar(c), outline: cor === c ? '2px solid #fff' : '2px solid transparent', outlineOffset: 3 }} />
              ))}
            </div>
          </div>
          <p className="sub" style={{ margin: '0 0 10px' }}>Perfil: {convite.perfil || 'Adulto'}{convite.url_api ? '' : ' · modo demonstração'}</p>
          <button type="submit" className="btn btn-primary btn-block" disabled={!apelido.trim() && !nome.trim()}>Continuar</button>
        </form>
      )}

      {passo === 'pin' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p className="sub" style={{ margin: 0 }}>Você usará este PIN para abrir o app neste aparelho.</p>
          <TecladoPin valor={pin} aoMudar={(v) => { setPin(v); setErro(''); if (v.length === 4) setTimeout(() => setPasso('confirmar'), 150) }} rotulo="PIN" />
        </div>
      )}

      {passo === 'confirmar' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p className="sub" style={{ margin: 0 }}>Digite o mesmo PIN mais uma vez.</p>
          <TecladoPin valor={pin2} aoMudar={(v) => { setPin2(v); setErro(''); if (v.length === 4) setTimeout(() => confirmar(v), 100) }} desabilitado={enviando} rotulo="Confirmação do PIN" />
          {enviando && <p className="sub" style={{ margin: 0 }}>Entrando…</p>}
        </div>
      )}

      {erro && <p role="alert" style={{ color: '#FF8B91', fontSize: 13, marginTop: 10 }}>{erro}</p>}
      <button type="button" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={aoCancelar}>Cancelar</button>
    </div>
  )
}
