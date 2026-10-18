import { useMemo, useState } from 'react'
import type { Categoria, Grupo, Tipo } from '../../tipos'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { moeda } from '../../util/formato'
import { Icone, corVar } from '../Icone'
import { Folha } from '../Folha'
import { Campo, Interruptor, SeletorCor, SeletorIcone, useAcao } from './comuns'

export const GRUPOS_ANALISE = ['Moradia', 'Contas de consumo', 'Saúde e educação', 'Transporte', 'Alimentação', 'Lazer', 'Dízimo e ofertas', 'Outros']
const TIPOS_EDITAVEIS: Array<Tipo['id']> = ['t_receitas', 't_fixas', 't_variaveis']

function FolhaGrupo({ grupo, aoFechar }: { grupo: Grupo; aoFechar: () => void }) {
  const boot = useBoot()
  const atualizarGrupos = useSessao((e) => e.atualizarGrupos)
  const { rodar, ocupado } = useAcao()
  const [f, setF] = useState<Grupo>({ ...grupo })
  const salvar = () => rodar(async () => {
    if (!f.nome.trim()) throw new Error('Informe o nome do grupo.')
    const salvo = await api<Grupo>('salvar_grupo', { grupo: f })
    atualizarGrupos(boot.grupos.some((g) => g.id === salvo.id) ? boot.grupos.map((g) => (g.id === salvo.id ? salvo : g)) : [...boot.grupos, salvo])
    aoFechar()
  }, 'Grupo salvo.')
  const tipo = boot.tipos.find((t) => t.id === f.tipo_id)
  return (
    <Folha aberta aoFechar={aoFechar} titulo={grupo.id ? 'Editar grupo' : `Novo grupo em ${tipo?.nome ?? ''}`}>
      <Campo rotulo="Nome do grupo"><input className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus={!grupo.id} /></Campo>
      <Campo rotulo="Cor do filete e dos ícones"><SeletorCor valor={f.cor} aoMudar={(cor) => setF({ ...f, cor })} /></Campo>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Grupo de análise (gráficos)">
          <select className="campo" value={f.grupo_analise} onChange={(e) => setF({ ...f, grupo_analise: e.target.value })}>{GRUPOS_ANALISE.map((g) => <option key={g}>{g}</option>)}</select>
        </Campo>
        <Campo rotulo="Ordem"><input className="campo num" type="number" min={1} value={f.ordem} onChange={(e) => setF({ ...f, ordem: Number(e.target.value) })} /></Campo>
      </div>
      <div className="rows mb-3">
        <div className="row" style={{ minHeight: 52 }}>
          <div className="t"><b>Visível no cardápio</b><small>Grupos ocultos continuam nos relatórios antigos.</small></div>
          <Interruptor ligado={f.ativo !== false} aoMudar={(v) => setF({ ...f, ativo: v })} rotulo="Visível" />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '0 0 12px' }}>O grupo pertence ao tipo <b>{tipo?.nome}</b>. Os 4 cards da tela inicial não aumentam.</p>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar</button>
      </div>
    </Folha>
  )
}

function FolhaCategoria({ categoria, aoFechar }: { categoria: Categoria; aoFechar: () => void }) {
  const boot = useBoot()
  const atualizarCategorias = useSessao((e) => e.atualizarCategorias)
  const { rodar, ocupado } = useAcao()
  const [f, setF] = useState<Categoria>({ ...categoria })
  const [palavras, setPalavras] = useState((categoria.palavras_chave || '').split(';').map((s) => s.trim()).filter(Boolean).join('\n'))
  const grupo = boot.grupos.find((g) => g.id === f.grupo_id)
  const gruposPorTipo = TIPOS_EDITAVEIS.map((tid) => ({ tipo: boot.tipos.find((t) => t.id === tid)!, grupos: boot.grupos.filter((g) => g.tipo_id === tid).sort((a, b) => a.ordem - b.ordem) }))
  const salvar = () => rodar(async () => {
    if (!f.nome.trim()) throw new Error('Informe o nome.')
    const g = boot.grupos.find((x) => x.id === f.grupo_id)
    const salvo = await api<Categoria>('salvar_categoria', {
      categoria: { ...f, tipo_id: g?.tipo_id ?? f.tipo_id, cor: g?.cor ?? f.cor, grupo_analise: g?.grupo_analise ?? f.grupo_analise, palavras_chave: palavras.split('\n').map((s) => s.trim()).filter(Boolean).join(';') },
    })
    atualizarCategorias(boot.categorias.some((c) => c.id === salvo.id) ? boot.categorias.map((c) => (c.id === salvo.id ? salvo : c)) : [...boot.categorias, salvo])
    aoFechar()
  }, 'Categoria salva.')
  return (
    <Folha aberta aoFechar={aoFechar} titulo={categoria.id ? 'Editar categoria' : `Nova categoria em ${grupo?.nome ?? ''}`}>
      <Campo rotulo="Nome"><input className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus={!categoria.id} /></Campo>
      <Campo rotulo="Ícone"><SeletorIcone valor={f.icone} cor={grupo?.cor} aoMudar={(icone) => setF({ ...f, icone })} /></Campo>
      <Campo rotulo="Grupo" ajuda="Mudar o grupo move a categoria, inclusive de tipo. A cor e o grupo de análise vêm do grupo.">
        <select className="campo" value={f.grupo_id} onChange={(e) => setF({ ...f, grupo_id: e.target.value })}>
          {gruposPorTipo.map(({ tipo, grupos }) => <optgroup key={tipo.id} label={tipo.nome}>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</optgroup>)}
        </select>
      </Campo>
      <Campo rotulo="Orçamento mensal (R$)"><input className="campo num" type="number" inputMode="decimal" min={0} step="0.01" value={f.orcamento_mensal} onChange={(e) => setF({ ...f, orcamento_mensal: Number(e.target.value) })} /></Campo>
      <Campo rotulo="Palavras-chave (uma por linha)" ajuda="Usadas para classificar SMS, e-mails e faturas automaticamente. Ex.: COPEL, SANEPAR, POSTO.">
        <textarea className="campo" rows={3} value={palavras} onChange={(e) => setPalavras(e.target.value)} style={{ textTransform: 'uppercase' }} />
      </Campo>
      <div className="rows mb-3">
        <div className="row" style={{ minHeight: 52 }}><div className="t"><b>Despesa fixa</b><small>Gera o lançamento previsto todo mês.</small></div><Interruptor ligado={f.fixa} aoMudar={(fixa) => setF({ ...f, fixa })} rotulo="Despesa fixa" /></div>
        <div className="row" style={{ minHeight: 52 }}><div className="t"><b>Sensível</b><small>Dependentes não veem (salários).</small></div><Interruptor ligado={!!f.sensivel} aoMudar={(sensivel) => setF({ ...f, sensivel })} rotulo="Sensível" /></div>
        <div className="row" style={{ minHeight: 52 }}><div className="t"><b>Ativa</b><small>Inativas somem do cardápio, mas os lançamentos antigos ficam.</small></div><Interruptor ligado={f.ativa} aoMudar={(ativa) => setF({ ...f, ativa })} rotulo="Ativa" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar</button>
      </div>
    </Folha>
  )
}

export function Cardapio() {
  const boot = useBoot()
  const tipos = boot.tipos.filter((t) => TIPOS_EDITAVEIS.includes(t.id)).sort((a, b) => a.ordem - b.ordem)
  const [aba, setAba] = useState<Tipo['id']>('t_fixas')
  const [grupoEd, setGrupoEd] = useState<Grupo | null>(null)
  const [catEd, setCatEd] = useState<Categoria | null>(null)
  const grupos = useMemo(() => boot.grupos.filter((g) => g.tipo_id === aba).sort((a, b) => a.ordem - b.ordem), [boot.grupos, aba])
  const tipoAtual = boot.tipos.find((t) => t.id === aba)

  const novaCategoria = (g: Grupo): Categoria => ({ id: '', tipo_id: g.tipo_id, grupo_id: g.id, nome: '', icone: 'wallet', cor: g.cor, tipo: g.tipo_id === 't_receitas' ? 'receita' : 'despesa', fixa: g.tipo_id === 't_fixas', orcamento_mensal: 0, palavras_chave: '', grupo_analise: g.grupo_analise, ativa: true, sensivel: false })
  const novoGrupo = (): Grupo => ({ id: '', tipo_id: aba, nome: '', cor: tipoAtual?.cor ?? 'indigo', grupo_analise: 'Outros', ordem: grupos.length + 1, ativo: true })

  return (
    <>
      <div className="card mb-3.5" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: 'var(--muted)' }}>
        <Icone nome="info" style={{ color: 'var(--gold)' }} />
        <span>Os 4 cards da tela inicial não aumentam; novos grupos só dentro de <b>Receitas</b>, <b>Despesas fixas</b> e <b>Despesas variáveis</b>.</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Tipo">
        {tipos.map((t) => <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => setAba(t.id)}>{t.nome}</button>)}
      </div>
      <div className="card">
        <h3>{tipoAtual?.nome} <span className="sub">{grupos.length} grupos · {boot.categorias.filter((c) => c.tipo_id === aba).length} categorias</span></h3>
        {grupos.map((g) => {
          const cats = boot.categorias.filter((c) => c.grupo_id === g.id).sort((a, b) => a.nome.localeCompare(b.nome))
          return (
            <div key={g.id} className="menu-group" style={{ ['--c' as string]: corVar(g.cor) }}>
              <h4>
                <span style={{ flex: 1 }}>{g.nome}{g.ativo === false && <span className="tag proj" style={{ marginLeft: 8 }}>oculto</span>}</span>
                {g.grupo_analise !== g.nome && <span className="sub">análise: {g.grupo_analise}</span>}
                <button className="icon-btn" style={{ width: 44, height: 44, margin: '-10px 0' }} onClick={() => setGrupoEd(g)} aria-label={`Editar grupo ${g.nome}`}><Icone nome="pencil" /></button>
              </h4>
              <div className="rows">
                {cats.map((c) => (
                  <button key={c.id} className="row" style={{ minHeight: 48 }} onClick={() => setCatEd(c)}>
                    <span className="ico-sm" style={{ color: corVar(g.cor) }}><Icone nome={c.icone} /></span>
                    <span className="t"><b>{c.nome}</b><small>{c.orcamento_mensal ? `${moeda(c.orcamento_mensal)}/mês` : 'Sem orçamento'}{c.palavras_chave ? ` · ${c.palavras_chave.split(';').filter(Boolean).length} chaves` : ''}</small></span>
                    <span className="flex gap-1">
                      {c.fixa && <span className="tag proj">fixa</span>}
                      {c.sensivel && <span className="tag warn">sensível</span>}
                      {c.oculta_cardapio && <span className="tag proj">oculta</span>}
                      {!c.ativa && <span className="tag red">inativa</span>}
                    </span>
                    <Icone nome="chevron-right" style={{ color: 'var(--faint)' }} />
                  </button>
                ))}
                <button className="row" style={{ minHeight: 44, color: 'var(--muted)', fontSize: 12.5 }} onClick={() => setCatEd(novaCategoria(g))}>
                  <span className="ico-sm" style={{ background: 'transparent', border: '1px dashed var(--line)' }}><Icone nome="plus" /></span>
                  <span className="t"><b style={{ fontWeight: 400, color: 'var(--muted)' }}>Nova categoria em {g.nome}</b></span>
                </button>
              </div>
            </div>
          )
        })}
        <button className="btn btn-ghost" onClick={() => setGrupoEd(novoGrupo())}><Icone nome="plus" />Novo grupo em {tipoAtual?.nome}</button>
      </div>
      {grupoEd && <FolhaGrupo grupo={grupoEd} aoFechar={() => setGrupoEd(null)} />}
      {catEd && <FolhaCategoria categoria={catEd} aoFechar={() => setCatEd(null)} />}
    </>
  )
}
