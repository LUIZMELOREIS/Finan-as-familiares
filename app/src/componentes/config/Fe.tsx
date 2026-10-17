import { useState } from 'react'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { Config } from '../../tipos'
import { Campo, Interruptor } from './comuns'
import { lerValor, numero } from '../../util/formato'

type Divisao = { dar: number; poupar: number; viver: number }

/** Ajusta uma das três partes e redistribui a diferença nas outras duas, mantendo a soma em 100. */
function ajustar(d: Divisao, chave: keyof Divisao, novo: number): Divisao {
  novo = Math.max(0, Math.min(100, Math.round(novo)))
  const outras = (['dar', 'poupar', 'viver'] as const).filter((k) => k !== chave)
  const restante = 100 - novo
  const somaOutras = d[outras[0]] + d[outras[1]]
  const a = somaOutras ? Math.round((d[outras[0]] / somaOutras) * restante) : Math.round(restante / 2)
  const b = restante - a
  return { ...d, [chave]: novo, [outras[0]]: a, [outras[1]]: b } as Divisao
}

export function Fe() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const somenteLeitura = boot.usuario.perfil !== 'Administrador'
  const c = boot.config
  const [feAtiva, setFeAtiva] = useState(c.fe_ativa)
  const [lema, setLema] = useState(c.versiculo_lema)
  const [div, setDiv] = useState<Divisao>({ dar: c.divisao_dar, poupar: c.divisao_poupar, viver: c.divisao_viver })
  const [regra, setRegra] = useState<Config['regra_votacao']>(c.regra_votacao)
  const [gastoGrande, setGastoGrande] = useState(numero(c.valor_gasto_grande))
  const [juniorSalarios, setJuniorSalarios] = useState(c.junior_ve_salarios)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      const parcial: Partial<Config> = { fe_ativa: feAtiva, versiculo_lema: lema.trim(), divisao_dar: div.dar, divisao_poupar: div.poupar, divisao_viver: div.viver, regra_votacao: regra, valor_gasto_grande: lerValor(gastoGrande), junior_ve_salarios: juniorSalarios }
      await api('salvar_config', { config: parcial })
      atualizarConfig(parcial)
      avisar('Configurações salvas ✅', { tipo: 'ok' })
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  const slider = (chave: keyof Divisao, nome: string, icone: string, dica: string) => (
    <div key={chave}>
      <div className="flex justify-between items-baseline">
        <span className="font-semibold"><span aria-hidden>{icone}</span> {nome}</span>
        <span className="font-extrabold tabular-nums text-lg">{div[chave]}%</span>
      </div>
      <input type="range" min={0} max={100} step={1} value={div[chave]} disabled={somenteLeitura} onChange={(e) => setDiv(ajustar(div, chave, Number(e.target.value)))} className="w-full h-12 accent-[var(--primaria)]" aria-label={`${nome}: ${div[chave]}%`} />
      <p className="text-xs text-suave -mt-1">{dica}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {somenteLeitura && <p className="card p-3 text-sm text-suave">👀 Você está vendo como a família configurou. Só um Administrador pode mudar.</p>}

      <section className="card p-4">
        <Interruptor ligado={feAtiva} aoMudar={setFeAtiva} desabilitado={somenteLeitura} rotulo="Versículo do dia" descricao="Mostra um versículo sobre mordomia, contentamento e provisão na tela inicial e na pauta da reunião." />
      </section>

      <section className="card p-4 space-y-2">
        <Campo rotulo="Lema da família">
          <textarea className="campo" rows={2} value={lema} disabled={somenteLeitura} onChange={(e) => setLema(e.target.value)} />
        </Campo>
      </section>

      <section className="card p-4 space-y-4">
        <div>
          <h2 className="titulo-secao">Divisão sugerida da renda</h2>
          <p className="text-sm text-suave">Dar → Poupar → Viver. É um <strong>princípio, não uma obrigação</strong>: serve de referência no orçamento e na reunião.</p>
        </div>
        {slider('dar', 'Dar', '🙏', 'Dízimo, ofertas, missões e ajuda ao próximo')}
        {slider('poupar', 'Poupar', '🐷', 'Sonhos da família e reserva de emergência')}
        {slider('viver', 'Viver', '🏡', 'Casa, dia a dia e lazer')}
        <div className="flex h-4 rounded-full overflow-hidden" aria-hidden>
          <span style={{ width: `${div.dar}%`, background: 'var(--amarelo)' }} /><span style={{ width: `${div.poupar}%`, background: 'var(--laranja)' }} /><span style={{ width: `${div.viver}%`, background: 'var(--primaria)' }} />
        </div>
        {!somenteLeitura && <button className="botao botao-fantasma !min-h-10 text-sm" onClick={() => setDiv({ dar: 10, poupar: 15, viver: 75 })}>Voltar ao padrão (10 / 15 / 75)</button>}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="titulo-secao">Conselho da Família</h2>
        <div>
          <span className="rotulo">Regra de votação</span>
          <div className="space-y-1">
            {([['maioria', 'Maioria simples', 'metade mais um dos votos'], ['maioria_mais_pais', 'Maioria + aprovação dos pais', 'precisa da maioria e do "sim" de um Administrador']] as const).map(([id, nome, dica]) => (
              <button key={id} type="button" disabled={somenteLeitura} className={`botao w-full justify-start !py-2 ${regra === id ? 'botao-primario' : 'botao-secundario'}`} onClick={() => setRegra(id)} aria-pressed={regra === id}>
                <span className="text-left"><span className="block">{nome}</span><span className="block text-xs font-normal opacity-80">{dica}</span></span>
              </button>
            ))}
          </div>
        </div>
        <Campo rotulo='Valor de "gasto grande" (R$)' dica="Acima disso, a compra passa pelo Conselho antes.">
          <input className="campo" inputMode="decimal" value={gastoGrande} disabled={somenteLeitura} onChange={(e) => setGastoGrande(e.target.value)} />
        </Campo>
      </section>

      <section className="card p-4">
        <Interruptor ligado={juniorSalarios} aoMudar={setJuniorSalarios} desabilitado={somenteLeitura} rotulo="Júnior vê salários" descricao="Desligado: os filhos não veem valores de salário nem categorias sensíveis." />
      </section>

      {!somenteLeitura && <button className="botao botao-primario w-full !min-h-14" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar'}</button>}
    </div>
  )
}
