import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { useBoot, useSessao } from '../store/sessao'
import { api, emModoDemo } from '../api/cliente'

const URL_GUIA = 'https://github.com/luizmeloreis/finan-as-familiares/blob/main/GUIA_DA_FAMILIA.md'

interface Item { icone: string; nome: string; descricao: string; para?: string; href?: string; aoClicar?: () => void; cor?: string }

export default function Mais() {
  const boot = useBoot()
  const nav = useNavigate()
  const sair = useSessao((e) => e.sair)
  const avisar = useSessao((e) => e.avisar)
  const recarregarBoot = useSessao((e) => e.recarregarBoot)
  const pendentes = useSessao((e) => e.pendentesCaixa)
  const [reiniciando, setReiniciando] = useState(false)
  const u = boot.usuario
  const ehJunior = u.perfil === 'Júnior'
  const temJunior = boot.usuarios.some((x) => x.perfil === 'Júnior' && x.ativo !== false)
  const demo = emModoDemo()
  const versao = (import.meta.env.VITE_VERSAO as string | undefined) ?? (demo ? 'demo' : '1.0')

  const itens: Item[] = [
    ...(!ehJunior ? [{ icone: '🏠', nome: 'Contas da Casa', descricao: 'Luz, água, internet… vencimentos, código de barras e pagamento', para: '/contas' }] : []),
    { icone: '🗳️', nome: 'Conselho da Família', descricao: 'Propostas e votações: gastos grandes e novos sonhos', para: '/conselho' },
    ...(!ehJunior ? [{ icone: '📅', nome: 'Reunião mensal', descricao: 'Pauta pronta: como fechou o mês, o que estourou, oração', para: '/reuniao' }] : []),
    ...(ehJunior || temJunior ? [{ icone: '🐷', nome: 'Mesada', descricao: ehJunior ? 'Quanto você ainda tem e o seu cofrinho' : 'Mesada e cofrinho dos filhos', para: '/mesada' }] : []),
    { icone: '📥', nome: 'Caixa de Entrada', descricao: pendentes ? `${pendentes} compra(s) esperando categoria` : 'Compras capturadas por SMS, e-mail e fatura', para: '/caixa' },
    { icone: '⚡', nome: 'Captura automática', descricao: 'Passo a passo para o celular lançar as compras sozinho', para: '/captura' },
    { icone: '⚙️', nome: 'Configurações', descricao: ehJunior ? 'Tamanho da letra e tema' : 'Família, membros, categorias, cartões, orçamento, fé e dados', para: '/configuracoes' },
    { icone: '🎓', nome: 'Tutorial', descricao: 'Reveja as 4 telas de apresentação do app', para: '/tutorial' },
    ...(!ehJunior && boot.config.url_planilha ? [{ icone: '📗', nome: 'Abrir a planilha no Drive', descricao: 'Os dados são seus: tudo fica na planilha do Google', href: boot.config.url_planilha }] : []),
    { icone: '📖', nome: 'Guia da família', descricao: 'Manual completo, em linguagem simples', href: URL_GUIA },
  ]

  async function reiniciarDemo() {
    setReiniciando(true)
    try {
      await api('reiniciar_demo')
      await recarregarBoot()
      avisar('Dados de exemplo recriados ✅', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível reiniciar', { tipo: 'erro' })
    } finally {
      setReiniciando(false)
    }
  }

  const classeItem = 'card card-toque p-4 flex items-center gap-4 text-left w-full'
  const conteudo = (i: Item) => (
    <>
      <span className="text-3xl w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--primaria) 18%, transparent)' }} aria-hidden>{i.icone}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-lg leading-tight">{i.nome}</span>
        <span className="block text-sm text-suave">{i.descricao}</span>
      </span>
      <span className="text-suave text-2xl" aria-hidden>{i.href ? '↗' : '›'}</span>
    </>
  )

  return (
    <>
      <Cabecalho titulo="Mais" voltarPara="/" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Cabeçalho do usuário */}
        <div className="card p-4 flex items-center gap-4">
          <span className="w-16 h-16 rounded-full flex items-center justify-center text-4xl shrink-0 border-4" style={{ background: 'color-mix(in srgb, ' + u.cor + ' 30%, transparent)', borderColor: u.cor }} aria-hidden>{u.avatar}</span>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-xl truncate">{u.apelido}</div>
            <div className="text-sm text-suave truncate">{u.nome} · {u.perfil}</div>
            <div className="text-xs text-suave mt-1">{boot.config.nome_familia} · versão {versao}</div>
          </div>
        </div>

        {demo && (
          <div className="card p-4 border-amarelo space-y-3" style={{ borderColor: 'var(--amarelo)' }}>
            <div className="font-bold">🧪 Você está no modo demonstração</div>
            <p className="text-sm text-suave">Os números são de exemplo e ficam só neste aparelho. Nada vai para uma planilha de verdade.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button className="botao botao-secundario" onClick={reiniciarDemo} disabled={reiniciando}>{reiniciando ? '⏳ Reiniciando…' : '🔄 Reiniciar dados de exemplo'}</button>
              <button className="botao botao-primario" onClick={() => { sair(); nav('/entrar') }}>🔗 Conectar à minha família</button>
            </div>
          </div>
        )}

        <nav aria-label="Mais opções" className="space-y-2">
          {itens.map((i) =>
            i.para ? (
              <Link key={i.nome} to={i.para} className={classeItem}>{conteudo(i)}</Link>
            ) : i.href ? (
              <a key={i.nome} href={i.href} target="_blank" rel="noopener noreferrer" className={classeItem}>{conteudo(i)}</a>
            ) : (
              <button key={i.nome} onClick={i.aoClicar} className={classeItem}>{conteudo(i)}</button>
            ),
          )}
        </nav>

        <button className="botao botao-secundario w-full !min-h-14" onClick={() => { sair(); nav('/entrar') }}>
          🚪 Trocar de usuário / Sair
        </button>
        <p className="text-center text-xs text-suave pb-2">Finanças da Família · feito com fé para a nossa casa</p>
      </div>
    </>
  )
}
