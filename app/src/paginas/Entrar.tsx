/**
 * Entrada "estilo Netflix": quem é você? → PIN. Com convite: instalar na tela
 * inicial → avatar + apelido → criar PIN. Também: modo demonstração e conexão
 * manual (URL da API + token da família + código do convite).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/cliente'
import { useSessao } from '../store/sessao'
import type { Usuario } from '../tipos'
import { usePerfisLembrados, type PerfilLembrado } from '../hooks/usePerfisLembrados'
import { TecladoDigitos } from '../componentes/lancar/TecladoDigitos'
import { Avatar } from '../componentes/inicio/Avatar'

type Etapa = 'inicio' | 'quem' | 'pin' | 'demo' | 'manual' | 'instalar' | 'avatar' | 'criar_pin'

const AVATARES = ['👨', '👩', '👴', '👵', '👦', '👧', '🧑', '👶', '🧔', '👱‍♀️', '👩‍🦱', '👨‍🦳', '🧑‍🦰', '👩‍🦳', '🙋‍♂️', '🙋‍♀️', '🐶', '🐱', '🦁', '🐼', '🦊', '🐸', '🦄', '🐧']
const CORES = ['#5B5BE0', '#BD55C7', '#F2C552', '#E0852F', '#4CB963', '#4FA3E0', '#E5535B', '#8E6CF0']

const PERFIS_DEMO: Array<PerfilLembrado & { token: string; perfil: string }> = [
  { usuario_id: 'u_pai', apelido: 'Pai', avatar: '👨', cor: '#5B5BE0', url_api: '', token_familia: 'demo', token: 'tok_pai_demo', perfil: 'Administrador' },
  { usuario_id: 'u_mae', apelido: 'Mãe', avatar: '👩', cor: '#BD55C7', url_api: '', token_familia: 'demo', token: 'tok_mae_demo', perfil: 'Administrador' },
  { usuario_id: 'u_filha', apelido: 'Ju', avatar: '👧', cor: '#F2C552', url_api: '', token_familia: 'demo', token: 'tok_ju_demo', perfil: 'Júnior' },
  { usuario_id: 'u_filho', apelido: 'Pedrão', avatar: '👦', cor: '#4CB963', url_api: '', token_familia: 'demo', token: 'tok_pedro_demo', perfil: 'Júnior' },
]

interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

function emStandalone() {
  return (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) || (navigator as unknown as { standalone?: boolean }).standalone === true
}
function ehIphone() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Quatro bolinhas do PIN. */
function Bolinhas({ quantidade }: { quantidade: number }) {
  return (
    <div className="flex justify-center gap-4 my-4" aria-label={`${quantidade} de 4 dígitos`} role="status">
      {[0, 1, 2, 3].map((i) => <span key={i} className={`w-5 h-5 rounded-full border-2 border-primaria-sel transition ${i < quantidade ? 'bg-primaria-sel' : ''}`} />)}
    </div>
  )
}

export default function Entrar({ erro }: { erro?: string }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const entrarSessao = useSessao((e) => e.entrar)
  // Vai para o início ANTES de entrar: enquanto o bootstrap carrega, o App desmonta o
  // roteador; se navegássemos depois, o novo roteador não saberia da mudança e ficaria em /entrar.
  const entrar = async (s: Parameters<typeof entrarSessao>[0]) => { nav('/', { replace: true }); await entrarSessao(s) }
  const { perfis, lembrar, esquecer } = usePerfisLembrados()

  const convite = params.get('convite') || ''
  const perfilConvite = params.get('perfil') || ''
  const urlPadrao = params.get('api') || import.meta.env.VITE_API_URL || ''
  const familiaPadrao = params.get('familia') || import.meta.env.VITE_TOKEN_FAMILIA || ''

  const [urlApi, setUrlApi] = useState(urlPadrao)
  const [tokenFamilia, setTokenFamilia] = useState(familiaPadrao)
  const [codigo, setCodigo] = useState(convite)
  const [etapa, setEtapa] = useState<Etapa>(() => (convite ? (emStandalone() ? 'avatar' : 'instalar') : perfis.length ? 'quem' : 'inicio'))
  const [perfilSel, setPerfilSel] = useState<PerfilLembrado | null>(null)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [confirmandoPin, setConfirmandoPin] = useState(false)
  const [avatar, setAvatar] = useState(AVATARES[0])
  const [cor, setCor] = useState(CORES[0])
  const [apelido, setApelido] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(erro ?? null)
  const [eventoInstalar, setEventoInstalar] = useState<EventoInstalar | null>(null)

  useEffect(() => { if (erro) setMensagem(erro) }, [erro])

  // Android/Chrome: guarda o evento para mostrar o botão "Instalar app".
  useEffect(() => {
    const f = (e: Event) => { e.preventDefault(); setEventoInstalar(e as EventoInstalar) }
    window.addEventListener('beforeinstallprompt', f)
    return () => window.removeEventListener('beforeinstallprompt', f)
  }, [])

  // ?demo=1 entra direto como Pai.
  useEffect(() => { if (params.get('demo') === '1') entrarDemo(PERFIS_DEMO[0]) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function entrarDemo(p: (typeof PERFIS_DEMO)[number]) {
    setOcupado(true)
    try { await entrar({ url_api: '', token_familia: 'demo', token: p.token, usuario_id: p.usuario_id }) } finally { setOcupado(false) }
  }

  async function enviarPin(valor: string) {
    if (!perfilSel) return
    setOcupado(true)
    setMensagem(null)
    try {
      const u = await api<Usuario>('entrar_pin', { usuario_id: perfilSel.usuario_id, pin: valor }, { url_api: perfilSel.url_api, token_familia: perfilSel.token_familia, token: '', usuario_id: perfilSel.usuario_id })
      if (!u.token) throw new Error('O servidor não devolveu o token')
      lembrar({ ...perfilSel, apelido: u.apelido, avatar: u.avatar, cor: u.cor })
      await entrar({ url_api: perfilSel.url_api, token_familia: perfilSel.token_familia, token: u.token, usuario_id: u.id })
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : 'PIN incorreto')
      setPin('')
    } finally {
      setOcupado(false)
    }
  }

  async function concluirConvite(pinFinal: string) {
    setOcupado(true)
    setMensagem(null)
    try {
      const u = await api<Usuario>('entrar_convite', { codigo_convite: codigo, apelido: apelido.trim(), avatar, cor, pin: pinFinal, perfil: perfilConvite || undefined }, { url_api: urlApi.trim(), token_familia: tokenFamilia.trim(), token: '', usuario_id: '' })
      if (!u.token) throw new Error('O servidor não devolveu o token')
      lembrar({ usuario_id: u.id, apelido: u.apelido, avatar: u.avatar, cor: u.cor, url_api: urlApi.trim(), token_familia: tokenFamilia.trim() })
      await entrar({ url_api: urlApi.trim(), token_familia: tokenFamilia.trim(), token: u.token, usuario_id: u.id })
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : 'Não foi possível entrar com o convite')
      setPin(''); setPin2(''); setConfirmandoPin(false)
    } finally {
      setOcupado(false)
    }
  }

  // Teclado do PIN (entrar e criar)
  function digitoPin(d: string) {
    if (ocupado) return
    if (etapa === 'pin') {
      const novo = (pin + d).slice(0, 4)
      setPin(novo)
      if (novo.length === 4) enviarPin(novo)
      return
    }
    if (!confirmandoPin) {
      const novo = (pin + d).slice(0, 4)
      setPin(novo)
      if (novo.length === 4) setTimeout(() => setConfirmandoPin(true), 250)
    } else {
      const novo = (pin2 + d).slice(0, 4)
      setPin2(novo)
      if (novo.length === 4) {
        if (novo === pin) concluirConvite(novo)
        else { setMensagem('Os PINs não são iguais. Vamos de novo.'); setPin(''); setPin2(''); setConfirmandoPin(false) }
      }
    }
  }
  function apagarPin() {
    if (etapa === 'pin' || !confirmandoPin) setPin((p) => p.slice(0, -1))
    else setPin2((p) => p.slice(0, -1))
  }

  const instrucoesInstalar = useMemo(() => {
    if (ehIphone()) return { titulo: 'No iPhone (Safari)', passos: ['Toque no botão Compartilhar (quadrado com seta para cima) na barra de baixo.', 'Role e toque em “Adicionar à Tela de Início”.', 'Toque em “Adicionar”. O app aparece com o brasão da família.'], icone: '📲' }
    return { titulo: 'No Android (Chrome)', passos: ['Toque no menu ⋮ no canto superior direito.', 'Toque em “Instalar app” (ou “Adicionar à tela inicial”).', 'Confirme. O app aparece com o brasão da família.'], icone: '🤖' }
  }, [])

  const Logo = (
    <div className="flex flex-col items-center text-center mb-6">
      <img src={import.meta.env.BASE_URL + 'brasao.svg'} alt="" className="w-24 h-24 drop-shadow-lg" />
      <h1 className="text-2xl font-extrabold mt-3">Finanças da Família</h1>
      <p className="text-suave text-sm">Deus é o dono, nós administramos.</p>
    </div>
  )

  return (
    <div className="min-h-dvh bg-app flex flex-col">
      <main className="flex-1 flex flex-col max-w-md w-full mx-auto px-5 py-8 area-segura-topo area-segura-base">
        {mensagem && (
          <div className="card p-3 mb-4 border-vermelho text-sm flex items-start gap-2" role="alert"><span aria-hidden>⚠️</span><span>{mensagem}</span></div>
        )}

        {/* ---------- Início ---------- */}
        {etapa === 'inicio' && (
          <div className="flex flex-col flex-1 justify-center">
            {Logo}
            <div className="space-y-3">
              <button className="botao botao-primario !min-h-18 text-lg w-full" onClick={() => setEtapa('demo')} disabled={ocupado}>
                <span aria-hidden>✨</span> Experimentar com dados de exemplo
              </button>
              <button className="botao botao-secundario !min-h-14 w-full" onClick={() => setEtapa('manual')}>
                <span aria-hidden>🔗</span> Já tenho a URL da API
              </button>
              {perfis.length > 0 && (
                <button className="botao botao-fantasma w-full" onClick={() => setEtapa('quem')}><span aria-hidden>👥</span> Entrar com um perfil deste celular</button>
              )}
            </div>
            <p className="text-xs text-suave text-center mt-6">Recebeu um link de convite da família? Abra o link neste celular e ele traz você para cá já configurado.</p>
          </div>
        )}

        {/* ---------- Quem é você? ---------- */}
        {etapa === 'quem' && (
          <div className="flex flex-col flex-1 justify-center">
            {Logo}
            <h2 className="text-xl font-bold text-center mb-4">Quem é você?</h2>
            <div className="grid grid-cols-2 gap-4">
              {perfis.map((p) => (
                <button key={p.usuario_id + p.url_api} className="card card-toque flex flex-col items-center gap-2 p-4 min-h-36" onClick={() => { setPerfilSel(p); setPin(''); setMensagem(null); setEtapa('pin') }}>
                  <Avatar usuario={p} tamanho={72} />
                  <span className="font-bold text-lg">{p.apelido}</span>
                  {!p.url_api && <span className="text-xs text-suave">demonstração</span>}
                </button>
              ))}
            </div>
            <div className="mt-6 space-y-2">
              <button className="botao botao-fantasma w-full" onClick={() => setEtapa('inicio')}><span aria-hidden>➕</span> Outro perfil ou convite</button>
            </div>
          </div>
        )}

        {/* ---------- PIN ---------- */}
        {etapa === 'pin' && perfilSel && (
          <div className="flex flex-col flex-1 justify-center">
            <div className="flex flex-col items-center">
              <Avatar usuario={perfilSel} tamanho={80} />
              <h2 className="text-xl font-bold mt-3">Olá, {perfilSel.apelido}!</h2>
              <p className="text-suave">Digite seu PIN de 4 dígitos</p>
              <Bolinhas quantidade={pin.length} />
              {ocupado && <div className="text-sm text-suave mb-2" role="status">Entrando…</div>}
            </div>
            <TecladoDigitos aoDigito={digitoPin} aoApagar={apagarPin} desabilitado={ocupado} />
            <div className="flex justify-between mt-4">
              <button className="botao botao-fantasma text-sm whitespace-nowrap" onClick={() => setEtapa('quem')}><span aria-hidden>‹</span> Trocar perfil</button>
              <button className="botao botao-fantasma text-sm whitespace-nowrap" onClick={() => { esquecer(perfilSel.usuario_id); setEtapa(perfis.length > 1 ? 'quem' : 'inicio') }}><span aria-hidden>🗑️</span> Esquecer perfil</button>
            </div>
          </div>
        )}

        {/* ---------- Demonstração ---------- */}
        {etapa === 'demo' && (
          <div className="flex flex-col flex-1 justify-center">
            {Logo}
            <h2 className="text-xl font-bold text-center">Dados de exemplo</h2>
            <p className="text-suave text-center text-sm mb-4">Escolha com quem quer experimentar. Nada é enviado para lugar nenhum.</p>
            <div className="grid grid-cols-2 gap-4">
              {PERFIS_DEMO.map((p) => (
                <button key={p.usuario_id} className="card card-toque flex flex-col items-center gap-2 p-4 min-h-36" onClick={() => entrarDemo(p)} disabled={ocupado}>
                  <Avatar usuario={p} tamanho={72} />
                  <span className="font-bold text-lg">{p.apelido}</span>
                  <span className="text-xs text-suave">{p.perfil}</span>
                </button>
              ))}
            </div>
            <button className="botao botao-fantasma w-full mt-6" onClick={() => setEtapa('inicio')}><span aria-hidden>‹</span> Voltar</button>
          </div>
        )}

        {/* ---------- Conexão manual ---------- */}
        {etapa === 'manual' && (
          <div className="flex flex-col flex-1 justify-center">
            {Logo}
            <h2 className="text-xl font-bold mb-1">Conectar à família</h2>
            <p className="text-suave text-sm mb-4">O administrador encontra estes dados no README e na aba Config da planilha.</p>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setMensagem(null); setEtapa(emStandalone() ? 'avatar' : 'instalar') }}>
              <label className="block"><span className="rotulo">URL da API (App da Web do Apps Script)</span>
                <input className="campo" type="url" inputMode="url" placeholder="https://script.google.com/macros/s/…/exec" value={urlApi} onChange={(e) => setUrlApi(e.target.value)} />
              </label>
              <label className="block"><span className="rotulo">Token da família</span>
                <input className="campo" placeholder="xxxxxxxx" value={tokenFamilia} onChange={(e) => setTokenFamilia(e.target.value)} required />
              </label>
              <label className="block"><span className="rotulo">Código de convite</span>
                <input className="campo" placeholder="ex.: ABC123" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} required autoCapitalize="characters" />
              </label>
              <p className="text-xs text-suave">Sem URL da API, o app funciona em modo demonstração (dados só neste celular).</p>
              <button className="botao botao-primario !min-h-14 w-full" type="submit">Continuar <span aria-hidden>→</span></button>
              <button className="botao botao-fantasma w-full" type="button" onClick={() => setEtapa(perfis.length ? 'quem' : 'inicio')}><span aria-hidden>‹</span> Voltar</button>
            </form>
          </div>
        )}

        {/* ---------- Instalar na tela inicial ---------- */}
        {etapa === 'instalar' && (
          <div className="flex flex-col flex-1 justify-center">
            <div className="text-center mb-4">
              <div className="text-6xl" aria-hidden>{instrucoesInstalar.icone}</div>
              <h2 className="text-xl font-bold mt-2">Instale na tela inicial</h2>
              <p className="text-suave text-sm">Assim o app abre como qualquer outro, em tela cheia, e recebe avisos.</p>
            </div>
            <div className="card p-4">
              <div className="font-bold mb-2">{instrucoesInstalar.titulo}</div>
              <ol className="space-y-2 text-sm list-decimal pl-5">{instrucoesInstalar.passos.map((p) => <li key={p}>{p}</li>)}</ol>
            </div>
            <div className="mt-5 space-y-3">
              {eventoInstalar && (
                <button className="botao botao-primario !min-h-14 w-full" onClick={async () => { await eventoInstalar.prompt(); setEventoInstalar(null) }}>
                  <span aria-hidden>⬇️</span> Instalar app agora
                </button>
              )}
              <button className={`botao ${eventoInstalar ? 'botao-secundario' : 'botao-primario'} !min-h-14 w-full`} onClick={() => setEtapa('avatar')}>
                {eventoInstalar ? 'Depois, continuar no navegador' : 'Já instalei / Continuar'} <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ---------- Avatar e apelido ---------- */}
        {etapa === 'avatar' && (
          <div className="flex flex-col flex-1">
            <div className="flex flex-col items-center mb-4">
              <Avatar usuario={{ avatar, cor, apelido: apelido || 'Você' }} tamanho={88} />
              <h2 className="text-xl font-bold mt-3">Como quer aparecer?</h2>
              {perfilConvite && <span className="text-xs text-suave">Perfil: {perfilConvite}</span>}
            </div>
            <label className="block mb-4"><span className="rotulo">Seu apelido (como a família te chama)</span>
              <input className="campo text-lg" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex.: Pai, Vó Lu, Ju…" maxLength={20} autoFocus />
            </label>
            <span className="rotulo">Escolha um avatar</span>
            <div className="grid grid-cols-6 gap-2 mb-4" role="radiogroup" aria-label="Avatar">
              {AVATARES.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={avatar === a} onClick={() => setAvatar(a)} className={`h-12 rounded-xl text-2xl flex items-center justify-center border-2 ${avatar === a ? 'border-primaria-sel bg-primaria/20' : 'border-transparent bg-card'}`} aria-label={`Avatar ${a}`}>{a}</button>
              ))}
            </div>
            <span className="rotulo">E uma cor</span>
            <div className="flex gap-2 flex-wrap mb-6" role="radiogroup" aria-label="Cor">
              {CORES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} onClick={() => setCor(c)} className={`w-12 h-12 rounded-full border-4 ${cor === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} aria-label={`Cor ${c}`} />
              ))}
            </div>
            <button className="botao botao-primario !min-h-14 w-full mt-auto" disabled={!apelido.trim()} onClick={() => { setPin(''); setPin2(''); setConfirmandoPin(false); setMensagem(null); setEtapa('criar_pin') }}>Criar meu PIN <span aria-hidden>→</span></button>
          </div>
        )}

        {/* ---------- Criar PIN ---------- */}
        {etapa === 'criar_pin' && (
          <div className="flex flex-col flex-1 justify-center">
            <div className="flex flex-col items-center">
              <Avatar usuario={{ avatar, cor, apelido }} tamanho={72} />
              <h2 className="text-xl font-bold mt-3">{confirmandoPin ? 'Digite o PIN de novo' : 'Crie um PIN de 4 dígitos'}</h2>
              <p className="text-suave text-sm text-center">{confirmandoPin ? 'Só para confirmar que ficou certo.' : 'Você vai usá-lo para entrar neste celular.'}</p>
              <Bolinhas quantidade={confirmandoPin ? pin2.length : pin.length} />
              {ocupado && <div className="text-sm text-suave mb-2" role="status">Criando seu acesso…</div>}
            </div>
            <TecladoDigitos aoDigito={digitoPin} aoApagar={apagarPin} desabilitado={ocupado} />
            <button className="botao botao-fantasma w-full mt-4" onClick={() => setEtapa('avatar')}><span aria-hidden>‹</span> Voltar</button>
          </div>
        )}
      </main>
    </div>
  )
}
