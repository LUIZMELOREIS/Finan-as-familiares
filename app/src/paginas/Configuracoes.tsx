/**
 * Configurações: índice em `.rows` + seções em rotas aninhadas (/configuracoes/<secao>).
 * Perfis: Administrador vê tudo; Adulto: Acessibilidade, Rotinas e alertas, Fé (leitura),
 * Dados (abrir planilha) e Captura; Dependente: Acessibilidade e Captura.
 */
import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import type { Perfil } from '../tipos'
import { api, emModoDemo } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import { Cabecalho } from '../componentes/Cabecalho'
import { Avatar } from '../componentes/Avatar'
import { Icone } from '../componentes/Icone'
import { LinhaIndice, useAcao } from '../componentes/config/comuns'
import { Identidade } from '../componentes/config/Identidade'
import { Membros } from '../componentes/config/Membros'
import { Cardapio } from '../componentes/config/Cardapio'
import { ContasFixas } from '../componentes/config/ContasFixas'
import { Cartoes } from '../componentes/config/Cartoes'
import { Orcamento } from '../componentes/config/Orcamento'
import { Rotinas } from '../componentes/config/Rotinas'
import { Acessibilidade } from '../componentes/config/Acessibilidade'
import { Fe } from '../componentes/config/Fe'
import { Dados } from '../componentes/config/Dados'

interface Secao {
  id: string
  icone: string
  nome: string
  descricao: string
  perfis: Perfil[]
  componente: () => ReactElement
  grupo: 'familia' | 'dinheiro' | 'app'
}

const TODOS: Perfil[] = ['Administrador', 'Adulto', 'Dependente']
const ADULTOS: Perfil[] = ['Administrador', 'Adulto']
const SECOES: Secao[] = [
  { id: 'identidade', icone: 'shield', nome: 'Identidade da família', descricao: 'Nome, lema, foto de capa e brasão', perfis: ['Administrador'], componente: Identidade, grupo: 'familia' },
  { id: 'membros', icone: 'users', nome: 'Membros e convites', descricao: 'Perfis, PIN, tokens e convite por link ou QR', perfis: ['Administrador'], componente: Membros, grupo: 'familia' },
  { id: 'fe', icone: 'book-marked', nome: 'Fé e decisões', descricao: 'Versículo do dia, regra de votação, gasto grande', perfis: ADULTOS, componente: Fe, grupo: 'familia' },
  { id: 'cardapio', icone: 'list-checks', nome: 'Cardápio', descricao: 'Grupos e categorias: nome, ícone, orçamento, palavras-chave', perfis: ['Administrador'], componente: Cardapio, grupo: 'dinheiro' },
  { id: 'orcamento', icone: 'scale', nome: 'Orçamento', descricao: 'Planejado por categoria e divisão da renda', perfis: ['Administrador'], componente: Orcamento, grupo: 'dinheiro' },
  { id: 'contas-fixas', icone: 'calendar-clock', nome: 'Contas fixas', descricao: 'Luz, água, internet, plano de saúde, escola…', perfis: ['Administrador'], componente: ContasFixas, grupo: 'dinheiro' },
  { id: 'cartoes', icone: 'credit-card', nome: 'Cartões', descricao: 'Apelido, final, titular, fechamento e vencimento', perfis: ['Administrador'], componente: Cartoes, grupo: 'dinheiro' },
  { id: 'rotinas', icone: 'bell', nome: 'Rotinas e alertas', descricao: 'Vigia diário, quinzenal, fechamento, alertas e Telegram', perfis: ADULTOS, componente: Rotinas, grupo: 'app' },
  { id: 'captura', icone: 'smartphone', nome: 'Captura automática', descricao: 'SMS e alertas do banco viram lançamentos', perfis: TODOS, componente: () => <Navigate to="/captura" replace />, grupo: 'app' },
  { id: 'acessibilidade', icone: 'type', nome: 'Acessibilidade', descricao: 'Tamanho da letra, tema claro, alto contraste', perfis: TODOS, componente: Acessibilidade, grupo: 'app' },
  { id: 'dados', icone: 'database', nome: 'Dados e backup', descricao: 'Planilha, pasta do Drive, exportar, backup e log', perfis: ADULTOS, componente: Dados, grupo: 'app' },
]
const GRUPOS: Array<{ id: Secao['grupo']; nome: string }> = [
  { id: 'familia', nome: 'Família' },
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'app', nome: 'Aplicativo' },
]

function Indice() {
  const boot = useBoot()
  const sair = useSessao((e) => e.sair)
  const recarregarBoot = useSessao((e) => e.recarregarBoot)
  const nav = useNavigate()
  const { rodar, ocupado } = useAcao()
  const perfil = boot.usuario.perfil
  const visiveis = SECOES.filter((s) => s.perfis.includes(perfil))
  const versao = import.meta.env.VITE_VERSAO ?? 'demo'
  const demo = emModoDemo()
  const reiniciar = () => rodar(async () => { await api('reiniciar_demo'); await recarregarBoot() }, 'Dados de exemplo reiniciados.')

  return (
    <>
      <Cabecalho titulo="Configurações" subtitulo="Identidade, membros, cardápio, rotinas e preferências do app." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-3.5">
          <div className="card">
            <div className="flex items-center gap-3">
              <Avatar usuario={boot.usuario} tamanho={48} />
              <div className="min-w-0 flex-1">
                <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{boot.usuario.nome}</div>
                <div className="flex items-center gap-2 mt-1"><span className={`tag ${perfil === 'Administrador' ? 'warn' : perfil === 'Dependente' ? 'ok' : 'proj'}`}>{perfil}</span><small style={{ color: 'var(--muted)', fontSize: 11.5 }}>{boot.config.nome_familia}</small></div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
              <small style={{ color: 'var(--faint)', fontSize: 11.5 }}>Finanças da Família · versão {versao}</small>
              <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => { sair(); nav('/entrar') }}><Icone nome="log-out" />Trocar de usuário / Sair</button>
            </div>
          </div>
          {demo && (
            <div className="card">
              <h3>Modo demonstração <span className="tag warn">dados de exemplo</span></h3>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>Você está vendo a Família Reis, com 12 meses de exemplo guardados só neste aparelho. Nada sai daqui.</p>
              <div className="flex gap-2 flex-wrap">
                <button className="btn btn-ghost" disabled={ocupado} onClick={reiniciar}><Icone nome="refresh-cw" />Reiniciar dados</button>
                <button className="btn btn-primary" onClick={() => nav('/entrar')}><Icone nome="users" />Conectar à minha família</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3.5">
          {GRUPOS.map((g) => {
            const itens = visiveis.filter((s) => s.grupo === g.id)
            if (!itens.length) return null
            return (
              <div key={g.id} className="card">
                <h3>{g.nome}</h3>
                <div className="rows">{itens.map((s) => <LinhaIndice key={s.id} para={s.id} icone={s.icone} nome={s.nome} descricao={s.descricao} />)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function PaginaSecao({ secao }: { secao: Secao }) {
  const boot = useBoot()
  if (!secao.perfis.includes(boot.usuario.perfil)) return <Navigate to="/configuracoes" replace />
  const Componente = secao.componente
  if (secao.id === 'captura') return <Componente />
  return (
    <>
      <Cabecalho titulo={secao.nome} subtitulo={secao.descricao} voltarPara="/configuracoes" />
      <Componente />
    </>
  )
}

export default function Configuracoes() {
  return (
    <Routes>
      <Route index element={<Indice />} />
      {SECOES.map((s) => <Route key={s.id} path={s.id} element={<PaginaSecao secao={s} />} />)}
      <Route path="*" element={<Navigate to="/configuracoes" replace />} />
    </Routes>
  )
}
