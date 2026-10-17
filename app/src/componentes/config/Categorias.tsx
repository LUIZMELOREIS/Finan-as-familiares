import { useMemo, useState } from 'react'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { Categoria, Grupo } from '../../tipos'
import { Folha } from '../Folha'
import { Campo, Interruptor, SeletorCor, SeletorIcone } from './comuns'
import { lerValor, numero } from '../../util/formato'

const MAX_GRUPOS = 7

function novaCategoria(grupo: Grupo): Categoria {
  return { id: '', grupo_id: grupo.id, nome: '', icone: '🧾', cor: grupo.cor, tipo: grupo.tipo === 'receita' ? 'receita' : 'despesa', fixa: false, orcamento_mensal: 0, palavras_chave: '', ativa: true, subgrupo: '', sensivel: false }
}

export function Categorias() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarCategorias = useSessao((e) => e.atualizarCategorias)
  const atualizarGrupos = useSessao((e) => e.atualizarGrupos)
  const [grupoEdit, setGrupoEdit] = useState<Grupo | null>(null)
  const [catEdit, setCatEdit] = useState<Categoria | null>(null)
  const [orcTxt, setOrcTxt] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)

  const grupos = useMemo(() => [...boot.grupos].sort((a, b) => a.ordem - b.ordem), [boot.grupos])
  const subgrupos = useMemo(() => Array.from(new Set(boot.categorias.map((c) => c.subgrupo).filter(Boolean))) as string[], [boot.categorias])

  function abrirCat(c: Categoria) {
    setCatEdit({ ...c })
    setOrcTxt(c.orcamento_mensal ? numero(c.orcamento_mensal) : '')
  }

  async function salvarGrupo() {
    if (!grupoEdit) return
    if (!grupoEdit.nome.trim()) { avisar('Dê um nome ao card.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const salvo = await api<Grupo>('salvar_grupo', { grupo: grupoEdit })
      atualizarGrupos(boot.grupos.some((g) => g.id === salvo.id) ? boot.grupos.map((g) => (g.id === salvo.id ? salvo : g)) : [...boot.grupos, salvo])
      avisar('Card salvo ✅', { tipo: 'ok' })
      setGrupoEdit(null)
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  async function salvarCat() {
    if (!catEdit) return
    if (!catEdit.nome.trim()) { avisar('Dê um nome à categoria.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const categoria: Categoria = { ...catEdit, orcamento_mensal: lerValor(orcTxt), palavras_chave: catEdit.palavras_chave.split(/[\n;]/).map((s) => s.trim()).filter(Boolean).join(';') }
      const salvo = await api<Categoria>('salvar_categoria', { categoria })
      atualizarCategorias(boot.categorias.some((c) => c.id === salvo.id) ? boot.categorias.map((c) => (c.id === salvo.id ? salvo : c)) : [...boot.categorias, salvo])
      avisar('Categoria salva ✅', { tipo: 'ok' })
      setCatEdit(null)
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">Os <strong>cards</strong> são os grandes blocos da tela inicial. Dentro deles ficam as <strong>categorias</strong>. Toque para editar.</p>
      {grupos.map((g) => {
        const cats = boot.categorias.filter((c) => c.grupo_id === g.id)
        const expandido = aberto === g.id
        return (
          <section key={g.id} className="card overflow-hidden">
            <div className="flex items-center gap-2 p-3" style={{ borderLeft: `6px solid ${g.cor}` }}>
              <button className="flex-1 flex items-center gap-3 text-left min-h-12" onClick={() => setAberto(expandido ? null : g.id)} aria-expanded={expandido}>
                <span className="text-3xl" aria-hidden>{g.icone}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{g.nome}</span>
                  <span className="block text-xs text-suave">{cats.length} categoria(s) · {g.tipo === 'receita' ? 'entradas' : g.tipo === 'projeto' ? 'sonhos' : 'despesas'}</span>
                </span>
                <span className="text-suave" aria-hidden>{expandido ? '▴' : '▾'}</span>
              </button>
              <button className="botao botao-fantasma !px-2 text-sm" onClick={() => setGrupoEdit({ ...g })}>✏️ Card</button>
            </div>
            {expandido && (
              <div className="border-t border-borda p-2 space-y-1">
                {cats.map((c) => (
                  <button key={c.id} className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-card-hover text-left min-h-12 ${c.ativa === false ? 'opacity-50' : ''}`} onClick={() => abrirCat(c)}>
                    <span className="text-2xl w-9 text-center" aria-hidden>{c.icone}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">{c.nome}</span>
                      <span className="block text-xs text-suave truncate">{[c.subgrupo, c.fixa ? 'fixa' : null, c.sensivel ? '🔒 sensível' : null, c.orcamento_mensal ? `orç. R$ ${numero(c.orcamento_mensal)}` : null, c.ativa === false ? 'inativa' : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="w-3 h-3 rounded-full" style={{ background: c.cor }} aria-hidden />
                  </button>
                ))}
                <button className="botao botao-secundario w-full" onClick={() => abrirCat(novaCategoria(g))}>➕ Nova categoria em {g.nome}</button>
              </div>
            )}
          </section>
        )
      })}
      {grupos.length < MAX_GRUPOS ? (
        <button className="botao botao-secundario w-full" onClick={() => setGrupoEdit({ id: '', nome: '', icone: '📦', cor: '#4FA3E0', ordem: grupos.length + 1, tipo: 'despesa' })}>➕ Novo card ({MAX_GRUPOS - grupos.length} restante{MAX_GRUPOS - grupos.length > 1 ? 's' : ''})</button>
      ) : (
        <p className="text-sm text-suave text-center">Limite de {MAX_GRUPOS} cards atingido — para a tela inicial continuar simples.</p>
      )}

      {/* Folha: grupo */}
      <Folha aberta={!!grupoEdit} aoFechar={() => setGrupoEdit(null)} titulo={grupoEdit?.id ? 'Editar card' : 'Novo card'}>
        {grupoEdit && (
          <div className="space-y-3">
            <Campo rotulo="Nome do card"><input className="campo" value={grupoEdit.nome} onChange={(e) => setGrupoEdit({ ...grupoEdit, nome: e.target.value })} placeholder="Ex.: Carro" /></Campo>
            <SeletorIcone valor={grupoEdit.icone} aoMudar={(icone) => setGrupoEdit({ ...grupoEdit, icone })} />
            <SeletorCor valor={grupoEdit.cor} aoMudar={(cor) => setGrupoEdit({ ...grupoEdit, cor })} />
            {!grupoEdit.id && (
              <Campo rotulo="Tipo">
                <select className="campo" value={grupoEdit.tipo} onChange={(e) => setGrupoEdit({ ...grupoEdit, tipo: e.target.value as Grupo['tipo'] })}>
                  <option value="despesa">Despesas</option><option value="receita">Entradas</option>
                </select>
              </Campo>
            )}
            <button className="botao botao-primario w-full" onClick={salvarGrupo} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar card'}</button>
          </div>
        )}
      </Folha>

      {/* Folha: categoria */}
      <Folha aberta={!!catEdit} aoFechar={() => setCatEdit(null)} titulo={catEdit?.id ? 'Editar categoria' : 'Nova categoria'}>
        {catEdit && (
          <div className="space-y-3">
            <Campo rotulo="Nome"><input className="campo" value={catEdit.nome} onChange={(e) => setCatEdit({ ...catEdit, nome: e.target.value })} placeholder="Ex.: Mercado" /></Campo>
            <SeletorIcone valor={catEdit.icone} aoMudar={(icone) => setCatEdit({ ...catEdit, icone })} />
            <SeletorCor valor={catEdit.cor} aoMudar={(cor) => setCatEdit({ ...catEdit, cor })} />
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Card (grupo)">
                <select className="campo" value={catEdit.grupo_id} onChange={(e) => setCatEdit({ ...catEdit, grupo_id: e.target.value })}>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.icone} {g.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Tipo">
                <select className="campo" value={catEdit.tipo} onChange={(e) => setCatEdit({ ...catEdit, tipo: e.target.value as Categoria['tipo'] })}>
                  <option value="despesa">Despesa</option><option value="receita">Receita</option>
                </select>
              </Campo>
            </div>
            <Campo rotulo="Subgrupo (agrupa no painel)">
              <input className="campo" list="lista-subgrupos" value={catEdit.subgrupo ?? ''} onChange={(e) => setCatEdit({ ...catEdit, subgrupo: e.target.value })} placeholder="Ex.: Alimentação" />
              <datalist id="lista-subgrupos">{subgrupos.map((s) => <option key={s} value={s} />)}</datalist>
            </Campo>
            <Campo rotulo="Orçamento mensal (R$) — 0 = sem limite"><input className="campo" inputMode="decimal" value={orcTxt} onChange={(e) => setOrcTxt(e.target.value)} placeholder="0,00" /></Campo>
            <Campo rotulo="Palavras-chave (uma por linha ou separadas por ;)" dica="Servem para sugerir a categoria automaticamente nos SMS, cupons e e-mails.">
              <textarea className="campo font-mono text-sm" rows={3} value={catEdit.palavras_chave.replace(/;/g, '\n')} onChange={(e) => setCatEdit({ ...catEdit, palavras_chave: e.target.value })} placeholder={'CONDOR\nMUFFATO\nSUPERMERCADO'} />
            </Campo>
            <Interruptor ligado={catEdit.fixa} aoMudar={(v) => setCatEdit({ ...catEdit, fixa: v })} rotulo="Despesa fixa" descricao="Conta que vem todo mês (luz, aluguel…)" />
            <Interruptor ligado={!!catEdit.sensivel} aoMudar={(v) => setCatEdit({ ...catEdit, sensivel: v })} rotulo="Sensível" descricao="Júnior não vê (ex.: salários)" />
            <Interruptor ligado={catEdit.ativa !== false} aoMudar={(v) => setCatEdit({ ...catEdit, ativa: v })} rotulo="Ativa" descricao="Inativa some das listas, mas o histórico fica." />
            <button className="botao botao-primario w-full" onClick={salvarCat} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar categoria'}</button>
          </div>
        )}
      </Folha>
    </div>
  )
}
