/** Card "Rotinas automáticas": Vigia diário, Análise quinzenal e Fechamento do mês, com interruptores. */
import { api } from '../../api/cliente'
import type { Config } from '../../tipos'
import { useBoot, useSessao } from '../../store/sessao'
import { Icone } from '../Icone'

type ChaveRotina = 'rotina_vigia' | 'rotina_quinzenal' | 'rotina_fechamento'
const ROTINAS: Array<{ chave: ChaveRotina; icone: string; nome: string; texto: string }> = [
  { chave: 'rotina_vigia', icone: 'bell', nome: 'Vigia diário', texto: 'Gasto fora do padrão, cobrança duplicada, assinatura nova, conta perto do vencimento.' },
  { chave: 'rotina_quinzenal', icone: 'trending-up', nome: 'Análise quinzenal', texto: 'Tendências por categoria antes de virarem problema.' },
  { chave: 'rotina_fechamento', icone: 'calendar', nome: 'Fechamento do mês', texto: 'Relatório do mês, projeção dos próximos 3 meses e pauta da reunião da família — dia 1º.' },
]

export function Rotinas() {
  const { config, usuario } = useBoot()
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const avisar = useSessao((e) => e.avisar)
  const podeAlterar = usuario.perfil === 'Administrador'

  async function alternar(chave: ChaveRotina) {
    const novo = !config[chave]
    atualizarConfig({ [chave]: novo } as Partial<Config>)
    try {
      await api('salvar_config', { config: { [chave]: novo } })
    } catch (e) {
      atualizarConfig({ [chave]: !novo } as Partial<Config>)
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar', { tipo: 'erro' })
    }
  }

  return (
    <div className="card">
      <h3>Rotinas automáticas {!podeAlterar && <span className="sub">só o administrador altera</span>}</h3>
      {ROTINAS.map((r) => {
        const ligada = config[r.chave] !== false
        return (
          <div key={r.chave} className="routine">
            <div className="ico" aria-hidden="true"><Icone nome={r.icone} /></div>
            <b>{r.nome}</b>
            <button type="button" className="switch" role="switch" aria-checked={ligada} aria-label={`${r.nome}: ${ligada ? 'ligada' : 'desligada'}`} disabled={!podeAlterar} onClick={() => alternar(r.chave)} />
            <small>{r.texto}</small>
          </div>
        )
      })}
    </div>
  )
}
