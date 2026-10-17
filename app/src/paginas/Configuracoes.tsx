import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { useBoot } from '../store/sessao'
import type { Perfil } from '../tipos'
import { Identidade } from '../componentes/config/Identidade'
import { Membros } from '../componentes/config/Membros'
import { Categorias } from '../componentes/config/Categorias'
import { ContasFixas } from '../componentes/config/ContasFixas'
import { Cartoes } from '../componentes/config/Cartoes'
import { Orcamento } from '../componentes/config/Orcamento'
import { Acessibilidade } from '../componentes/config/Acessibilidade'
import { Fe } from '../componentes/config/Fe'
import { Dados } from '../componentes/config/Dados'

interface Secao { rota: string; icone: string; nome: string; descricao: string; perfis: Perfil[]; elemento?: ReactNode; para?: string }

const TODOS: Perfil[] = ['Administrador', 'Adulto', 'Júnior']
const ADULTOS: Perfil[] = ['Administrador', 'Adulto']
const ADMIN: Perfil[] = ['Administrador']

const SECOES: Secao[] = [
  { rota: 'identidade', icone: '🏡', nome: 'Identidade da Família', descricao: 'Nome, lema, foto de capa e brasão', perfis: ADMIN, elemento: <Identidade /> },
  { rota: 'membros', icone: '👨‍👩‍👧‍👦', nome: 'Membros', descricao: 'Quem usa o app, perfis, PIN, convites e tokens', perfis: ADMIN, elemento: <Membros /> },
  { rota: 'categorias', icone: '🗂️', nome: 'Cards e Categorias', descricao: 'Os blocos da tela inicial e as categorias de cada um', perfis: ADMIN, elemento: <Categorias /> },
  { rota: 'contas-fixas', icone: '🧾', nome: 'Contas fixas', descricao: 'Luz, água, internet… valor previsto e dia de vencimento', perfis: ADMIN, elemento: <ContasFixas /> },
  { rota: 'cartoes', icone: '💳', nome: 'Cartões', descricao: 'Apelido, banco, final e titular (nunca o número completo)', perfis: ADMIN, elemento: <Cartoes /> },
  { rota: 'captura', icone: '⚡', nome: 'Captura automática', descricao: 'SMS, notificações e e-mail do banco', perfis: ADMIN, para: '/captura' },
  { rota: 'orcamento', icone: '🎯', nome: 'Orçamento', descricao: 'Quanto planejar por categoria em cada mês', perfis: ADMIN, elemento: <Orcamento /> },
  { rota: 'acessibilidade', icone: '👓', nome: 'Acessibilidade', descricao: 'Tamanho da letra, tema claro/escuro, contraste', perfis: TODOS, elemento: <Acessibilidade /> },
  { rota: 'fe', icone: '🙏', nome: 'Fé', descricao: 'Versículo do dia, divisão Dar/Poupar/Viver, regra do Conselho', perfis: ADULTOS, elemento: <Fe /> },
  { rota: 'dados', icone: '🗄️', nome: 'Dados', descricao: 'Planilha, exportar, backup e log', perfis: ADULTOS, elemento: <Dados /> },
]

function Indice({ secoes }: { secoes: Secao[] }) {
  return (
    <>
      <Cabecalho titulo="Configurações" voltarPara="/mais" />
      <nav className="max-w-3xl mx-auto p-4 space-y-2" aria-label="Seções de configuração">
        {secoes.map((s) => (
          <Link key={s.rota} to={s.para ?? `/configuracoes/${s.rota}`} className="card card-toque p-4 flex items-center gap-4">
            <span className="text-3xl w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--primaria) 18%, transparent)' }} aria-hidden>{s.icone}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-lg leading-tight">{s.nome}</span>
              <span className="block text-sm text-suave">{s.descricao}</span>
            </span>
            <span className="text-suave text-2xl" aria-hidden>›</span>
          </Link>
        ))}
      </nav>
    </>
  )
}

function Pagina({ secao }: { secao: Secao }) {
  return (
    <>
      <Cabecalho titulo={secao.nome} voltarPara="/configuracoes" />
      <div className="max-w-3xl mx-auto p-4">{secao.elemento}</div>
    </>
  )
}

export default function Configuracoes() {
  const boot = useBoot()
  const perfil = boot.usuario.perfil
  const permitidas = SECOES.filter((s) => s.perfis.includes(perfil))
  return (
    <Routes>
      <Route index element={<Indice secoes={permitidas} />} />
      {permitidas.filter((s) => s.elemento).map((s) => <Route key={s.rota} path={s.rota} element={<Pagina secao={s} />} />)}
      <Route path="captura" element={<Navigate to="/captura" replace />} />
      <Route path="*" element={<Navigate to="/configuracoes" replace />} />
    </Routes>
  )
}
