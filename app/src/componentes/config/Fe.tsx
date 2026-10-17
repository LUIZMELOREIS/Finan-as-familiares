import { useState } from 'react'
import type { Config } from '../../tipos'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { Icone } from '../Icone'
import { Campo, Interruptor, useAcao } from './comuns'
import { LEMA_PADRAO } from './Identidade'

export function Fe() {
  const boot = useBoot()
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const { rodar, ocupado } = useAcao()
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const [f, setF] = useState({
    fe_ativa: boot.config.fe_ativa !== false,
    versiculo_lema: boot.config.versiculo_lema || LEMA_PADRAO,
    regra_votacao: boot.config.regra_votacao || 'maioria',
    valor_gasto_grande: boot.config.valor_gasto_grande || 0,
    dependente_ve_salarios: !!boot.config.dependente_ve_salarios,
  })
  const salvar = () => rodar(async () => atualizarConfig(await api<Config>('salvar_config', { config: f })), 'Preferências salvas.')
  const v = boot.versiculo_do_dia
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="card">
        <h3>Fé <span className="sub">tudo aqui pode ser desligado</span></h3>
        <div className="rows mb-3">
          <div className="row" style={{ minHeight: 52 }}>
            <span className="ico-sm"><Icone nome="book-marked" /></span>
            <div className="t"><b>Versículo do dia e lema</b><small>Barra lateral, relatório mensal e pauta da reunião.</small></div>
            <Interruptor ligado={f.fe_ativa} aoMudar={(fe_ativa) => setF({ ...f, fe_ativa })} rotulo="Versículo do dia" desabilitado={!ehAdmin} />
          </div>
        </div>
        <Campo rotulo="Lema da família"><textarea className="campo" rows={2} value={f.versiculo_lema} onChange={(e) => setF({ ...f, versiculo_lema: e.target.value })} disabled={!ehAdmin} /></Campo>
        {f.fe_ativa && v && (
          <p className="verse" style={{ margin: '0 0 14px' }}>“{v.texto}”<b>{v.referencia}</b></p>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: 0 }}>Mensagens curtas e respeitosas, nunca de culpa. Versão Almeida (domínio público).</p>
      </div>
      <div className="card">
        <h3>Decisões em família</h3>
        <Campo rotulo="Regra de votação">
          <div className="seg" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <button type="button" aria-pressed={f.regra_votacao === 'maioria'} disabled={!ehAdmin} onClick={() => setF({ ...f, regra_votacao: 'maioria' })}>Maioria simples</button>
            <button type="button" aria-pressed={f.regra_votacao === 'maioria_mais_pais'} disabled={!ehAdmin} onClick={() => setF({ ...f, regra_votacao: 'maioria_mais_pais' })}>Maioria + administradores</button>
          </div>
        </Campo>
        <Campo rotulo="Gasto grande a partir de (R$)" ajuda="Acima deste valor, a despesa passa pelo Conselho antes.">
          <input className="campo num" type="number" inputMode="decimal" min={0} step="50" value={f.valor_gasto_grande} onChange={(e) => setF({ ...f, valor_gasto_grande: Number(e.target.value) })} disabled={!ehAdmin} />
        </Campo>
        <div className="rows mb-3">
          <div className="row" style={{ minHeight: 52 }}>
            <div className="t"><b>Dependente vê salários</b><small>Por padrão, categorias sensíveis ficam escondidas dos dependentes.</small></div>
            <Interruptor ligado={f.dependente_ve_salarios} aoMudar={(dependente_ve_salarios) => setF({ ...f, dependente_ve_salarios })} rotulo="Dependente vê salários" desabilitado={!ehAdmin} />
          </div>
        </div>
        {ehAdmin ? <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar</button> : <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Só o administrador altera estas preferências.</p>}
      </div>
    </div>
  )
}
