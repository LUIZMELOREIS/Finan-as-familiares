import { useSessao, type TamanhoLetra } from '../../store/sessao'
import { Interruptor } from './comuns'

const TAMANHOS: Array<{ id: TamanhoLetra; nome: string; px: number }> = [
  { id: 'normal', nome: 'Normal', px: 17 },
  { id: 'grande', nome: 'Grande', px: 19 },
  { id: 'muito-grande', nome: 'Muito grande', px: 22 },
]

export function Acessibilidade() {
  const pref = useSessao((e) => e.preferencias)
  const salvar = useSessao((e) => e.salvarPreferencias)
  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <h2 className="titulo-secao">Tamanho da letra</h2>
        <div className="grid grid-cols-3 gap-2">
          {TAMANHOS.map((t) => (
            <button key={t.id} className={`botao flex-col !gap-1 !py-3 !h-auto ${pref.letra === t.id ? 'botao-primario' : 'botao-secundario'}`} onClick={() => salvar({ letra: t.id })} aria-pressed={pref.letra === t.id}>
              <span style={{ fontSize: t.px * 1.3 }} aria-hidden>Aa</span>
              <span className="text-xs font-normal">{t.nome}</span>
            </button>
          ))}
        </div>
        <p className="bg-painel rounded-xl p-3 border border-borda">Prévia: você gastou <strong>R$ 87,40</strong> na padaria hoje de manhã.</p>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="titulo-secao">Tema</h2>
        <div className="grid grid-cols-2 gap-2">
          <button className={`botao !min-h-14 ${pref.tema === 'escuro' ? 'botao-primario' : 'botao-secundario'}`} onClick={() => salvar({ tema: 'escuro' })} aria-pressed={pref.tema === 'escuro'}>🌙 Escuro</button>
          <button className={`botao !min-h-14 ${pref.tema === 'claro' ? 'botao-primario' : 'botao-secundario'}`} onClick={() => salvar({ tema: 'claro' })} aria-pressed={pref.tema === 'claro'}>☀️ Claro</button>
        </div>
        <p className="text-sm text-suave">Muita gente lê melhor no tema claro, principalmente de dia.</p>
      </section>

      <section className="card p-4">
        <Interruptor ligado={pref.alto_contraste} aoMudar={(v) => salvar({ alto_contraste: v })} rotulo="Alto contraste" descricao="Textos secundários e bordas mais fortes." />
      </section>

      <p className="text-xs text-suave">Essas escolhas valem só neste aparelho. Botões têm pelo menos 48 px e sempre vêm com ícone e texto.</p>
    </div>
  )
}
