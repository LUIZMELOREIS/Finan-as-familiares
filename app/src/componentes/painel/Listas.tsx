/** Linha 5 do Painel: "Próximas saídas" (30 dias) e "Avisos do assistente" — `.rows/.row/.tag` da referência. */
import { useNavigate } from 'react-router-dom'
import type { Aviso, SaidaPrevista } from '../../tipos'
import { Icone } from '../Icone'
import { brl, rotuloPrazo } from './formato'

const TAG_SAIDA: Record<SaidaPrevista['status'], { classe: string; rotulo: (s: SaidaPrevista) => string }> = {
  lida_do_email: { classe: 'warn', rotulo: (s) => rotuloPrazo(s.data) },
  prevista: { classe: 'proj', rotulo: () => 'previsto' },
  parcial: { classe: 'proj', rotulo: () => 'parcial' },
  estimada: { classe: 'proj', rotulo: () => 'estimado' },
  parcela: { classe: 'proj', rotulo: () => 'parcela' },
}

function ddmm(iso: string) { return `${iso.slice(8, 10)}/${iso.slice(5, 7)}` }

export function ProximasSaidas({ saidas }: { saidas: SaidaPrevista[] | null }) {
  const nav = useNavigate()
  return (
    <article className="card span2">
      <h3>Próximas saídas <span className="sub">contas, parcelas e assinaturas — 30 dias</span></h3>
      <div className="rows">
        {saidas === null && <p className="sub" style={{ margin: 0 }}>Carregando…</p>}
        {saidas && saidas.length === 0 && <p className="sub" style={{ margin: 0 }}>Nenhuma saída prevista nos próximos 30 dias.</p>}
        {saidas?.slice(0, 6).map((s) => {
          const tag = TAG_SAIDA[s.status] ?? TAG_SAIDA.prevista
          const sub = s.status === 'parcial' ? s.subtitulo : `vence ${ddmm(s.data)} · ${s.subtitulo}`
          const Tag = s.rota ? 'button' : 'div'
          return (
            <Tag key={s.id} className="row" {...(s.rota ? { type: 'button' as const, onClick: () => nav(s.rota!) } : {})}>
              <div className="ico-sm"><Icone nome={s.icone === 'credit' ? 'credit-card' : s.icone} /></div>
              <div className="t"><b>{s.titulo}</b><small>{sub}</small></div>
              <span className={`tag ${tag.classe}`}>{tag.rotulo(s)}</span>
              <span className="amt num">{brl(s.valor, 2)}</span>
            </Tag>
          )
        })}
      </div>
    </article>
  )
}

const ICONE_AVISO: Record<Aviso['tipo'], string> = {
  fora_do_padrao: 'triangle-alert', cobranca_duplicada: 'repeat', nova_assinatura: 'tv', vencimento: 'calendar-clock',
  sem_categoria: 'receipt', tendencia: 'trending-up', fechamento: 'file-text', alerta_personalizado: 'bell',
}

export function AvisosAssistente({ avisos }: { avisos: Aviso[] | null }) {
  const nav = useNavigate()
  return (
    <article className="card span2">
      <h3>Avisos do assistente <span className="sub">vigia diário</span></h3>
      <div className="rows">
        {avisos === null && <p className="sub" style={{ margin: 0 }}>Carregando…</p>}
        {avisos && avisos.length === 0 && <p className="sub" style={{ margin: 0 }}>Nenhum aviso hoje. O vigia roda todos os dias às 20h.</p>}
        {avisos?.map((a) => (
          <div key={a.id} className="row" style={a.lido ? { opacity: 0.6 } : undefined}>
            <div className="ico-sm"><Icone nome={ICONE_AVISO[a.tipo] ?? 'bell'} /></div>
            <div className="t"><b>{a.titulo}</b><small>{a.detalhe}</small></div>
            {a.acao
              ? <button type="button" className={`tag ${a.gravidade}`} onClick={() => nav(a.acao!.rota)} style={{ minHeight: 28 }}>{a.acao.rotulo}</button>
              : <span className={`tag ${a.gravidade}`}>{a.tipo === 'fechamento' ? 'relatório' : 'aviso'}</span>}
          </div>
        ))}
      </div>
    </article>
  )
}
