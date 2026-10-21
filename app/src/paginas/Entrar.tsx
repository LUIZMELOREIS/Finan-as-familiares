/**
 * Entrar — a capa da família: foto em tela cheia com véu, brasão, "Família <Sobrenome>",
 * lema e PIN. Também recebe convites (?convite=), o modo demonstração e a conexão
 * do primeiro celular à API.
 */
import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Usuario } from '../tipos'
import { api, type Sessao } from '../api/cliente'
import { useSessao } from '../store/sessao'
import { Crest } from '../componentes/Brasao'
import { Avatar } from '../componentes/Avatar'
import { Icone } from '../componentes/Icone'
import { TecladoPin } from '../componentes/entrar/TecladoPin'
import { Convite, type DadosConvite } from '../componentes/entrar/Convite'
import { EscolherDemo } from '../componentes/entrar/EscolherDemo'
import { ConectarApi } from '../componentes/entrar/ConectarApi'
import { lerPerfis, lembrarPerfil, esquecerPerfis, type PerfilLembrado } from '../componentes/entrar/perfis'
import { useInstalacao } from '../hooks/useInstalacao'
import type { RespostaPerfis } from '../componentes/entrar/ConectarApi'
import { decodificarConvite } from '../util/convite'
import { URL_API_PADRAO } from '../familia'

type Modo = 'inicio' | 'perfis' | 'pin' | 'convite' | 'demo' | 'api'

export default function Entrar({ erro }: { erro?: string }) {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const entrar = useSessao((e) => e.entrar)
  const [perfis, setPerfis] = useState<PerfilLembrado[]>(lerPerfis)
  // Convite: parâmetros soltos (?convite=&perfil=&api=&familia=) ou compactos (?c=base64url).
  const compacto = decodificarConvite(sp.get('c'))
  const codigoConvite = (sp.get('convite') ?? compacto?.convite ?? '').toUpperCase()
  const perfilConvite = sp.get('perfil') ?? compacto?.perfil ?? 'Adulto'
  const apiConvite = sp.get('api') ?? compacto?.api ?? ''
  const familiaConvite = sp.get('familia') ?? compacto?.familia ?? ''
  const conviteDemo = (sp.get('demo') ?? compacto?.demo) === '1' || (!apiConvite && !familiaConvite && !!codigoConvite && !URL_API_PADRAO)
  // Sem `api` no link, usa o endereço da família embutido no app (o link fica curto e difícil de quebrar).
  const urlApiConvite = conviteDemo ? '' : apiConvite || URL_API_PADRAO
  const [convite, setConvite] = useState<DadosConvite | null>(codigoConvite && (conviteDemo || (urlApiConvite && familiaConvite))
    ? { codigo: codigoConvite, perfil: perfilConvite, url_api: urlApiConvite, token_familia: conviteDemo ? 'demo' : familiaConvite }
    : null)
  const [modo, setModo] = useState<Modo>(convite ? 'convite' : codigoConvite || familiaConvite ? 'api' : perfis.length ? 'perfis' : 'inicio')
  const [perfil, setPerfil] = useState<PerfilLembrado | null>(null)
  const [conectando, setConectando] = useState(false)
  const inst = useInstalacao()
  const [pin, setPin] = useState('')
  const [erroPin, setErroPin] = useState('')
  const [entrando, setEntrando] = useState(false)

  const foto = perfis[0]?.url_foto_capa || ''
  const nomeFamilia = perfis[0]?.nome_familia || 'Finanças da Família'
  const nomeCurto = nomeFamilia.replace(/^Fam[ií]lia\s+/i, '')
  const tituloFamilia = perfis.length ? `Família ${nomeCurto}` : 'Finanças da Família'

  // Link "outro aparelho" (família sem convite): busca os perfis sozinho e vai direto ao PIN.
  useEffect(() => {
    if (codigoConvite || !familiaConvite || !urlApiConvite) return
    const base: Sessao = { url_api: urlApiConvite, token_familia: familiaConvite, token: '', usuario_id: '' }
    setConectando(true)
    api<RespostaPerfis>('perfis_familia', {}, base)
      .then((r) => {
        if (!r?.perfis?.length) return
        setPerfis(r.perfis.map((u) => ({ usuario_id: u.id, apelido: u.apelido, nome: u.nome, cor: u.cor, avatar: u.avatar, url_api: base.url_api, token_familia: base.token_familia, nome_familia: r.nome_familia, url_foto_capa: r.url_foto_capa })))
        setPerfil(null); setModo('perfis')
      })
      .catch(() => { /* fica na tela "Conectar à API", já preenchida */ })
      .finally(() => setConectando(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Entra de fato: lembra o perfil, navega para "/" ANTES de chamar entrar() (o roteador remonta). */
  const concluir = useCallback((u: Pick<Usuario, 'id' | 'apelido' | 'nome' | 'cor' | 'avatar'>, sessao: Sessao, familia: { nome_familia?: string; url_foto_capa?: string }) => {
    lembrarPerfil(u, sessao, familia)
    nav('/', { replace: true })
    void entrar(sessao).then(() => {
      const b = useSessao.getState().boot
      if (b) lembrarPerfil(b.usuario, sessao, b.config)
    })
  }, [entrar, nav])

  // PIN completo → entrar_pin
  const tentarPin = useCallback((p: PerfilLembrado, valor: string) => {
    setEntrando(true); setErroPin('')
    const base: Sessao = { url_api: p.url_api, token_familia: p.token_familia, token: '', usuario_id: p.usuario_id }
    api<Usuario>('entrar_pin', { usuario_id: p.usuario_id, pin: valor }, base)
      .then((u) => {
        if (!u?.token) throw new Error('A API não devolveu o acesso.')
        concluir(u, { ...base, token: u.token, usuario_id: u.id }, { nome_familia: p.nome_familia, url_foto_capa: p.url_foto_capa })
      })
      .catch((e) => {
        setErroPin(e instanceof Error ? e.message : 'PIN incorreto')
        setPin('')
        setEntrando(false)
      })
  }, [concluir])

  const escolherPerfil = (p: PerfilLembrado) => { setPerfil(p); setPin(''); setErroPin(''); setModo('pin') }
  const esquecer = () => { esquecerPerfis(); setPerfis([]); setPerfil(null); setModo('inicio') }

  return (
    <div className="capa">
      {foto && <div className="foto" style={{ backgroundImage: `url(${JSON.stringify(foto)})` }} aria-hidden="true" />}
      <div className="veu" aria-hidden="true" />
      <main className="conteudo">
        <Crest />
        <div>
          <h1>{tituloFamilia}</h1>
          {perfis.length > 0 && <p className="sub" style={{ margin: '2px 0 0' }}>Finanças da Família</p>}
        </div>
        <p className="verse">“Eu e a minha casa serviremos ao Senhor.”<b>Josué 24.15</b></p>

        {erro && (
          <div role="alert" style={{ background: 'color-mix(in srgb, var(--red) 18%, transparent)', color: '#FF8B91', borderRadius: 10, padding: '8px 12px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <Icone nome="lock" />{/Sessão expirada/i.test(erro) ? 'Sessão expirada. Entre de novo com o seu PIN.' : erro}
          </div>
        )}

        {modo === 'perfis' && (
          <>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)', margin: '6px 0 0' }}>Quem é você?</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: '100%' }}>
              {perfis.map((p) => (
                <button key={`${p.url_api}|${p.usuario_id}`} type="button" onClick={() => escolherPerfil(p)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', minWidth: 96 }}>
                  <Avatar usuario={{ nome: p.nome, apelido: p.apelido, avatar: p.avatar, cor: p.cor }} tamanho={56} />
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: '#fff' }}>{p.apelido}</span>
                  {!p.url_api && <span className="tag proj">exemplo</span>}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginTop: 8 }}>
              {!inst.instalado && inst.podeInstalar && <button type="button" className="btn btn-primary btn-block" onClick={() => void inst.instalar()}><Icone nome="download" />Instalar o app neste aparelho</button>}
              {!inst.instalado && !inst.podeInstalar && <p className="sub" style={{ margin: 0 }}>{inst.ios ? 'Para instalar: Compartilhar → Adicionar à Tela de Início.' : 'Para instalar: menu ⋮ do navegador → Instalar app.'}</p>}
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setModo('inicio')}>Outra forma de entrar</button>
              <button type="button" className="btn btn-sm" style={{ color: 'var(--muted)' }} onClick={esquecer}>Esquecer os perfis deste aparelho</button>
            </div>
          </>
        )}

        {modo === 'pin' && perfil && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar usuario={{ nome: perfil.nome, apelido: perfil.apelido, avatar: perfil.avatar, cor: perfil.cor }} tamanho={40} />
              <div style={{ textAlign: 'left' }}><div style={{ fontWeight: 500, fontSize: 14, color: '#fff' }}>{perfil.apelido}</div><div className="sub">{entrando ? 'Conferindo…' : 'Digite o seu PIN'}</div></div>
            </div>
            <TecladoPin valor={pin} aoMudar={(v) => { setPin(v); setErroPin(''); if (v.length === 4 && !entrando) tentarPin(perfil, v) }} desabilitado={entrando} />
            {erroPin && <p role="alert" style={{ color: '#FF8B91', fontSize: 13, margin: 0 }}>{erroPin}</p>}
            <button type="button" className="btn btn-sm" style={{ color: 'var(--muted)' }} onClick={() => { setModo(perfis.length ? 'perfis' : 'inicio'); setPerfil(null) }}>Não sou {perfil.apelido}</button>
          </>
        )}

        {modo === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 6 }}>
            <p className="sub" style={{ margin: '0 0 4px' }}>Para entrar, peça ao administrador da família um link de convite — ele abre direto neste aparelho.</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setModo('demo')}><Icone nome="sparkles" />Experimentar com dados de exemplo</button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setModo('api')}><Icone nome="database" />Já tenho a URL da API</button>
            {perfis.length > 0 && <button type="button" className="btn btn-sm" style={{ color: 'var(--muted)' }} onClick={() => setModo('perfis')}>Voltar aos perfis lembrados</button>}
          </div>
        )}

        {modo === 'demo' && (
          <EscolherDemo
            aoCancelar={() => setModo(perfis.length ? 'perfis' : 'inicio')}
            aoEscolher={(sessao, p) => concluir({ id: p.usuario_id, apelido: p.apelido, nome: p.nome, cor: p.cor, avatar: '' }, sessao, { nome_familia: 'Família Reis' })}
          />
        )}

        {modo === 'api' && conectando && <p className="sub">Conectando à família…</p>}
        {modo === 'api' && !conectando && (
          <ConectarApi
            codigoInicial={codigoConvite}
            urlInicial={apiConvite || URL_API_PADRAO}
            tokenInicial={familiaConvite}
            perfil={codigoConvite ? perfilConvite : 'Administrador'}
            aoCancelar={() => setModo(perfis.length ? 'perfis' : 'inicio')}
            aoConectar={(c) => { setConvite(c); setModo('convite') }}
            aoPerfis={(r, base) => {
              setPerfis(r.perfis.map((u) => ({ usuario_id: u.id, apelido: u.apelido, nome: u.nome, cor: u.cor, avatar: u.avatar, url_api: base.url_api, token_familia: base.token_familia, nome_familia: r.nome_familia, url_foto_capa: r.url_foto_capa })))
              setPerfil(null); setModo('perfis')
            }}
          />
        )}

        {modo === 'convite' && convite && (
          <Convite
            convite={convite}
            aoCancelar={() => { setConvite(null); setModo(perfis.length ? 'perfis' : 'inicio') }}
            aoEntrar={(u, sessao) => concluir(u, sessao, {})}
          />
        )}
      </main>
    </div>
  )
}
