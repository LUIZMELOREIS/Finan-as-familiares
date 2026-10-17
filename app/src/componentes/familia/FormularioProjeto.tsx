import { useEffect, useState, type FormEvent } from 'react'
import { Folha } from '../Folha'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { dataBr, hojeIso, lerValor, moeda } from '../../util/formato'
import { dataMaisDias, somarCompetencia } from './calculos'
import { LUCAS_14_28, versiculoPorReferencia, versiculosPorTema } from './versiculos'
import type { Decisao, Projeto } from '../../tipos'

const ICONES = ['✈️', '🏠', '🚗', '🚲', '🎓', '🛟', '💒', '🏖️', '🎸', '💻', '📱', '🐶', '🎁', '⛪', '🛋️', '🏔️']
const PRIORIDADES: Array<{ valor: number; nome: string }> = [
  { valor: 1, nome: '1 — Muito importante' },
  { valor: 2, nome: '2 — Importante' },
  { valor: 3, nome: '3 — Média' },
  { valor: 4, nome: '4 — Baixa' },
  { valor: 5, nome: '5 — Para depois' },
]

interface Props {
  aberto: boolean
  aoFechar: () => void
  /** Projeto existente → edição; vazio → novo sonho. */
  inicial?: Projeto | null
  aoSalvo: (projeto: Projeto, projetos: Projeto[]) => void
}

/** Formulário "Novo sonho" / "Editar sonho", em Folha. */
export function FormularioProjeto({ aberto, aoFechar, inicial, aoSalvo }: Props) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarProjetos = useSessao((e) => e.atualizarProjetos)
  const ehJunior = boot.usuario.perfil === 'Júnior'
  const editando = !!inicial?.id

  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('✈️')
  const [fotoUrl, setFotoUrl] = useState('')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [meta, setMeta] = useState('')
  const [dataAlvo, setDataAlvo] = useState('')
  const [valorInicial, setValorInicial] = useState('')
  const [versiculo, setVersiculo] = useState(LUCAS_14_28)
  const [prioridade, setPrioridade] = useState(3)
  const [levarAoConselho, setLevarAoConselho] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Preenche ao abrir (novo ou edição).
  useEffect(() => {
    if (!aberto) return
    setNome(inicial?.nome ?? '')
    setIcone(inicial?.icone ?? '✈️')
    setFotoUrl(inicial?.foto_url ?? '')
    setMeta(inicial ? String(inicial.meta_valor).replace('.', ',') : '')
    setDataAlvo(inicial?.data_alvo?.slice(0, 10) ?? `${somarCompetencia(hojeIso().slice(0, 7), 12)}-01`)
    setValorInicial(inicial ? String(inicial.valor_inicial).replace('.', ',') : '')
    setVersiculo(inicial?.versiculo || LUCAS_14_28)
    setPrioridade(inicial?.prioridade ?? (ehJunior ? 4 : 3))
    setLevarAoConselho(false)
  }, [aberto, inicial, ehJunior])

  const opcoesVersiculo = versiculosPorTema('planejamento', 'provisão')
  const textoVersiculo = versiculoPorReferencia(versiculo)?.texto

  const escolherFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setEnviandoFoto(true)
    try {
      const blob = await comprimirImagem(arquivo, 1200, 0.78)
      const base64 = await arquivoParaBase64(blob)
      const r = await api<{ url: string; id: string }>('enviar_arquivo', {
        imagem_base64: base64,
        mime: blob.type || 'image/jpeg',
        pasta: 'Projetos e Sonhos',
        nome_arquivo: `sonho-${(nome || 'novo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`,
      })
      setFotoUrl(r.url)
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não foi possível enviar a foto', { tipo: 'erro' })
    } finally {
      setEnviandoFoto(false)
    }
  }

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const metaNum = lerValor(meta)
    if (!nome.trim() || metaNum <= 0 || !dataAlvo) {
      avisar('Preencha o nome, a meta e a data-alvo.', { tipo: 'erro' })
      return
    }
    setSalvando(true)
    try {
      const projeto: Projeto = {
        id: inicial?.id ?? '',
        nome: nome.trim(),
        icone: icone || '✈️',
        foto_url: fotoUrl,
        meta_valor: metaNum,
        data_alvo: dataAlvo,
        valor_inicial: lerValor(valorInicial),
        prioridade: ehJunior && !editando ? 4 : prioridade,
        status: inicial?.status ?? (levarAoConselho ? 'votação' : 'ativo'),
        versiculo,
        criado_por: inicial?.criado_por ?? boot.usuario.id,
        criado_em: inicial?.criado_em ?? hojeIso(),
      }
      const salvo = await api<Projeto>('salvar_projeto', { projeto })
      if (!editando && levarAoConselho) {
        const decisao: Decisao = {
          id: '',
          titulo: `Novo sonho: ${salvo.nome}`,
          descricao: `Meta de ${moeda(salvo.meta_valor)} até ${dataBr(salvo.data_alvo)}. Vamos começar a guardar?`,
          tipo: 'novo projeto',
          valor: salvo.meta_valor,
          criado_por: boot.usuario.id,
          criado_em: hojeIso(),
          prazo: dataMaisDias(hojeIso(), 7),
          status: 'aberta',
          projeto_id: salvo.id,
        }
        await api<Decisao>('salvar_decisao', { decisao })
      }
      const projetos = await api<Projeto[]>('listar_projetos')
      atualizarProjetos(projetos)
      avisar(editando ? 'Sonho atualizado.' : levarAoConselho ? 'Sonho criado e enviado ao Conselho da Família.' : 'Sonho criado. Que Deus abençoe o caminho até lá!', { tipo: 'ok' })
      aoSalvo(projetos.find((p) => p.id === salvo.id) ?? salvo, projetos)
      aoFechar()
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não foi possível salvar', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Folha aberta={aberto} aoFechar={aoFechar} titulo={editando ? '✏️ Editar sonho' : '✨ Novo sonho'}>
      <form onSubmit={salvar} className="space-y-4">
        <label className="block">
          <span className="rotulo">Nome do sonho</span>
          <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Viagem para a praia" maxLength={60} required />
        </label>

        <div>
          <span className="rotulo">Ícone</span>
          <div className="flex items-center gap-2">
            <input className="campo !w-20 text-center text-2xl" value={icone} onChange={(e) => setIcone(e.target.value.slice(0, 4))} aria-label="Emoji do sonho" />
            <div className="flex gap-1 overflow-x-auto rolagem-escondida flex-1 py-1">
              {ICONES.map((i) => (
                <button type="button" key={i} className={`botao !min-w-12 !px-2 text-2xl ${i === icone ? 'botao-primario' : 'botao-secundario'}`} onClick={() => setIcone(i)} aria-label={`Ícone ${i}`} aria-pressed={i === icone}>{i}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="rotulo">Foto inspiradora (opcional)</span>
          <div className="flex items-center gap-3">
            {fotoUrl ? <img src={fotoUrl} alt="" className="w-20 h-20 rounded-xl object-cover" /> : <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl" style={{ background: 'linear-gradient(135deg, var(--laranja), var(--amarelo))' }} aria-hidden>{icone}</div>}
            <label className="botao botao-secundario cursor-pointer flex-1">
              📷 {enviandoFoto ? 'Enviando…' : fotoUrl ? 'Trocar a foto' : 'Escolher uma foto'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => escolherFoto(e.target.files?.[0])} disabled={enviandoFoto} />
            </label>
            {fotoUrl && <button type="button" className="botao botao-fantasma" onClick={() => setFotoUrl('')}>🗑️ <span className="text-sm">Tirar</span></button>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="rotulo">Meta (R$)</span>
            <input className="campo" inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="12.000,00" required />
          </label>
          <label className="block">
            <span className="rotulo">Até quando?</span>
            <input className="campo" type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} required />
          </label>
          <label className="block">
            <span className="rotulo">Já temos guardado (R$)</span>
            <input className="campo" inputMode="decimal" value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} placeholder="0,00" />
          </label>
          {!ehJunior && (
            <label className="block">
              <span className="rotulo">Prioridade</span>
              <select className="campo" value={prioridade} onChange={(e) => setPrioridade(Number(e.target.value))}>
                {PRIORIDADES.map((p) => <option key={p.valor} value={p.valor}>{p.nome}</option>)}
              </select>
            </label>
          )}
        </div>

        {boot.config.fe_ativa && (
          <label className="block">
            <span className="rotulo">Versículo do sonho</span>
            <select className="campo" value={versiculo} onChange={(e) => setVersiculo(e.target.value)}>
              {!opcoesVersiculo.some((v) => v.referencia === versiculo) && <option value={versiculo}>{versiculo}</option>}
              {opcoesVersiculo.map((v) => <option key={v.id} value={v.referencia}>{v.referencia} — {v.tema}</option>)}
            </select>
            {textoVersiculo && <p className="text-sm text-suave italic mt-2 leading-relaxed">“{textoVersiculo}” — {versiculo}</p>}
          </label>
        )}

        {!editando && (
          <label className="card flex items-center gap-3 p-3 cursor-pointer">
            <input type="checkbox" className="w-6 h-6 accent-[var(--primaria)]" checked={levarAoConselho} onChange={(e) => setLevarAoConselho(e.target.checked)} />
            <span>
              <span className="font-semibold block">🗳️ Levar ao Conselho antes de começar</span>
              <span className="text-sm text-suave">O sonho fica "em votação" e a família decide junta.</span>
            </span>
          </label>
        )}

        <button type="submit" className="botao botao-primario w-full text-lg !min-h-14" disabled={salvando || enviandoFoto}>
          {salvando ? '⏳ Salvando…' : editando ? '💾 Salvar alterações' : '✨ Criar o sonho'}
        </button>
      </form>
    </Folha>
  )
}
