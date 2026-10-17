/**
 * Folha "Propor projeto" / "Editar projeto": nome, ícone Lucide, cor, meta, data-alvo,
 * valor inicial, versículo, prioridade e o interruptor "Levar ao Conselho antes de começar".
 */
import { useState, type CSSProperties, type FormEvent } from 'react'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { CorPaleta, Decisao } from '../../tipos'
import { hojeIso, somarMeses } from '../../util/formato'
import { Folha } from '../Folha'
import { Icone, NOMES_ICONES_CARDAPIO, corVar } from '../Icone'
import { lerValorBr, CORES_PROJETO, brl, rotuloDataAlvo, type ProjetoCalculado } from './calculos'
import { VERSICULOS_PROJETO } from './projetos'

const CORES: CorPaleta[] = [...CORES_PROJETO, 'red']
const NOMES_COR: Record<string, string> = { gold: 'Ouro', green: 'Verde', indigo: 'Índigo', magenta: 'Magenta', orange: 'Laranja', lilac: 'Lilás', rose: 'Rosa', slate: 'Ardósia', red: 'Vermelho' }
const PRIORIDADES = [{ v: 1, r: 'Alta' }, { v: 2, r: 'Média' }, { v: 3, r: 'Baixa' }]

interface Props {
  aberta: boolean
  aoFechar: () => void
  /** Projeto existente para editar; vazio = novo. */
  projeto?: ProjetoCalculado
  corAtual?: string
  aoSalvar: (p: ProjetoCalculado) => void
}

export function FormularioProjeto({ aberta, aoFechar, projeto, corAtual, aoSalvar }: Props) {
  if (!aberta) return null
  return <Formulario aoFechar={aoFechar} projeto={projeto} corAtual={corAtual} aoSalvar={aoSalvar} />
}

function Formulario({ aoFechar, projeto, corAtual, aoSalvar }: Omit<Props, 'aberta'>) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const ehDependente = boot.usuario.perfil === 'Dependente'
  const editando = !!projeto
  const [nome, setNome] = useState(projeto?.nome ?? '')
  const [icone, setIcone] = useState(projeto?.icone ?? 'target')
  const [cor, setCor] = useState<string>(projeto?.cor ?? corAtual ?? 'gold')
  const [meta, setMeta] = useState(projeto ? String(projeto.meta_valor).replace('.', ',') : '')
  const [alvo, setAlvo] = useState(projeto?.data_alvo.slice(0, 7) ?? somarMeses(hojeIso().slice(0, 7), 12))
  const [inicial, setInicial] = useState(projeto ? String(projeto.valor_inicial).replace('.', ',') : '')
  const [versiculo, setVersiculo] = useState(projeto?.versiculo ?? 'Lucas 14:28')
  const [prioridade, setPrioridade] = useState(ehDependente ? 3 : (projeto?.prioridade ?? 2))
  const [conselho, setConselho] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mostrarIcones, setMostrarIcones] = useState(false)

  const metaNum = lerValorBr(meta)
  const valido = nome.trim().length >= 2 && metaNum > 0 && /^\d{4}-\d{2}$/.test(alvo)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!valido || salvando) return
    setSalvando(true)
    try {
      const corpo: ProjetoCalculado = {
        id: projeto?.id ?? '',
        nome: nome.trim(), icone, foto_url: projeto?.foto_url ?? '',
        meta_valor: metaNum, data_alvo: `${alvo}-01`, valor_inicial: lerValorBr(inicial),
        prioridade: ehDependente ? 3 : prioridade,
        status: projeto?.status ?? (conselho ? 'votação' : 'ativo'),
        versiculo, criado_por: projeto?.criado_por ?? boot.usuario.id, criado_em: projeto?.criado_em ?? '',
        cor: cor as CorPaleta,
      }
      const salvo = await api<ProjetoCalculado>('salvar_projeto', { projeto: corpo })
      if (!editando && conselho) {
        const prazo = new Date(); prazo.setDate(prazo.getDate() + 7)
        const decisao: Partial<Decisao> = {
          titulo: `Novo projeto: ${salvo.nome}`,
          descricao: `Meta de ${brl(salvo.meta_valor)} até ${rotuloDataAlvo(salvo.data_alvo)}${salvo.valor_inicial ? `, começando com ${brl(salvo.valor_inicial)}` : ''}.`,
          tipo: 'novo projeto', valor: salvo.meta_valor, prazo: prazo.toISOString().slice(0, 10), status: 'aberta', projeto_id: salvo.id,
        }
        await api('salvar_decisao', { decisao })
      }
      avisar(editando ? 'Projeto atualizado.' : conselho ? 'Proposta enviada ao Conselho da família.' : 'Projeto criado.', { tipo: 'ok' })
      aoSalvar({ ...salvo, cor: cor as CorPaleta })
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não foi possível salvar o projeto.', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Folha aberta aoFechar={aoFechar} titulo={editando ? 'Editar projeto' : 'Propor projeto'}>
      <form onSubmit={enviar} noValidate>
        <div className="field">
          <label htmlFor="pj-nome">Nome do projeto</label>
          <input id="pj-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Viagem de julho" autoFocus maxLength={60} />
        </div>

        <div className="field">
          <span className="rotulo" id="pj-icone-rotulo">Ícone e cor</span>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" className="ico" style={{ '--c': corVar(cor), width: 44, height: 44, borderRadius: 10, border: '1px solid var(--line)' } as CSSProperties} onClick={() => setMostrarIcones((v) => !v)} aria-expanded={mostrarIcones} aria-label="Escolher ícone">
              <Icone nome={icone} tamanho={20} />
            </button>
            <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Cor">
              {CORES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={NOMES_COR[c]} onClick={() => setCor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: corVar(c), outline: cor === c ? '2px solid var(--text)' : '2px solid transparent', outlineOffset: 2, margin: 6 }} />
              ))}
            </div>
          </div>
          {mostrarIcones && (
            <div className="grid gap-1.5 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))' }} role="radiogroup" aria-labelledby="pj-icone-rotulo">
              {NOMES_ICONES_CARDAPIO.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={icone === n} aria-label={n} onClick={() => { setIcone(n); setMostrarIcones(false) }}
                  className="ico" style={{ '--c': icone === n ? corVar(cor) : 'var(--slate)', width: 44, height: 44, borderRadius: 9, border: icone === n ? '1px solid var(--sel)' : '1px solid transparent' } as CSSProperties}>
                  <Icone nome={n} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label htmlFor="pj-meta">Meta (R$)</label>
            <input id="pj-meta" className="num" inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="18.000" />
          </div>
          <div className="field">
            <label htmlFor="pj-alvo">Data-alvo</label>
            <input id="pj-alvo" type="month" value={alvo} min={hojeIso().slice(0, 7)} onChange={(e) => setAlvo(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label htmlFor="pj-inicial">Valor inicial (R$)</label>
            <input id="pj-inicial" className="num" inputMode="decimal" value={inicial} onChange={(e) => setInicial(e.target.value)} placeholder="0" disabled={editando} />
          </div>
          <div className="field">
            <label htmlFor="pj-prio">Prioridade</label>
            <select id="pj-prio" value={prioridade} onChange={(e) => setPrioridade(Number(e.target.value))} disabled={ehDependente}>
              {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}
            </select>
          </div>
        </div>

        {boot.config.fe_ativa !== false && (
          <div className="field">
            <label htmlFor="pj-vers">Versículo do projeto</label>
            <select id="pj-vers" value={versiculo} onChange={(e) => setVersiculo(e.target.value)}>
              {!VERSICULOS_PROJETO.some((v) => v.referencia === versiculo) && <option value={versiculo}>{versiculo}</option>}
              {VERSICULOS_PROJETO.map((v) => <option key={v.id} value={v.referencia}>{v.referencia} — {v.texto.slice(0, 48)}…</option>)}
            </select>
          </div>
        )}

        {!editando && (
          <div className="flex items-center justify-between gap-3 py-2" style={{ borderTop: '1px solid var(--line)', marginBottom: 14, minHeight: 44 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Levar ao Conselho antes de começar</div>
              <div className="sub">Abre uma votação de 7 dias; o projeto só começa se for aprovado.</div>
            </div>
            <button type="button" role="switch" aria-checked={conselho} aria-label="Levar ao Conselho antes de começar" onClick={() => setConselho((v) => !v)} style={{ padding: 12, display: 'grid', placeItems: 'center', minWidth: 44, minHeight: 44 }}>
              <span className="switch" aria-checked={conselho} />
            </button>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!valido || salvando}>
            <Icone nome={conselho && !editando ? 'vote' : 'check'} />{salvando ? 'Salvando…' : editando ? 'Salvar' : conselho ? 'Enviar ao Conselho' : 'Criar projeto'}
          </button>
        </div>
      </form>
    </Folha>
  )
}
