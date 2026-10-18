import { useNavigate } from 'react-router-dom'
import { useSessao, type TamanhoLetra } from '../../store/sessao'
import { Icone } from '../Icone'
import { Campo, LinhaInterruptor } from './comuns'

const LETRAS: Array<{ id: TamanhoLetra; nome: string; px: number }> = [
  { id: 'normal', nome: 'Normal', px: 14 },
  { id: 'grande', nome: 'Grande', px: 16 },
  { id: 'muito-grande', nome: 'Muito grande', px: 18 },
]

export function Acessibilidade() {
  const pref = useSessao((e) => e.preferencias)
  const salvar = useSessao((e) => e.salvarPreferencias)
  const nav = useNavigate()
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="card">
        <h3>Tamanho da letra <span className="sub">vale para o app inteiro</span></h3>
        <Campo rotulo="Escolha">
          <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {LETRAS.map((l) => <button key={l.id} type="button" aria-pressed={pref.letra === l.id} onClick={() => salvar({ letra: l.id })} style={{ fontSize: l.px }}>{l.nome}</button>)}
          </div>
        </Campo>
        <div className="rows">
          <div className="row"><span className="ico-sm"><Icone nome="type" /></span><span className="t"><b>Prévia</b><small>Supermercado · R$ 1.234,56 · 17/10/2026</small></span><span className="amt num">R$ 1.234,56</span></div>
        </div>
      </div>
      <div className="flex flex-col gap-3.5">
        <div className="card">
          <h3>Tema <span className="sub">os mesmos componentes, outra luz</span></h3>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <button type="button" aria-pressed={pref.tema === 'escuro'} onClick={() => salvar({ tema: 'escuro' })}><Icone nome="moon" /> Escuro</button>
            <button type="button" aria-pressed={pref.tema === 'claro'} onClick={() => salvar({ tema: 'claro' })}><Icone nome="sun" /> Claro</button>
          </div>
          <div className="rows mt-2">
            <LinhaInterruptor titulo="Alto contraste" descricao="Textos secundários e linhas mais fortes." ligado={pref.alto_contraste} aoMudar={(v) => salvar({ alto_contraste: v })} />
          </div>
        </div>
        <div className="card">
          <h3>Ajuda</h3>
          <div className="rows">
            <button className="row" style={{ minHeight: 52 }} onClick={() => { salvar({ tutorial_visto: false }); nav('/tutorial') }}>
              <span className="ico-sm"><Icone nome="book-open" /></span><span className="t"><b>Rever o tutorial</b><small>As telas de apresentação do primeiro acesso.</small></span><Icone nome="chevron-right" style={{ color: 'var(--faint)' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
