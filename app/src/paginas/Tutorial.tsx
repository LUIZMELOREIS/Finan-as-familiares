/** Tutorial — 4 telas sóbrias (ícone, título, duas linhas), pontinhos, Próximo / Pular. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessao } from '../store/sessao'
import { Icone } from '../componentes/Icone'

const PASSOS = [
  { icone: 'book-open', titulo: 'Deus é o dono, nós administramos', texto: '“Do Senhor é a terra e a sua plenitude” (Salmo 24.1). Cuidar bem do que recebemos começa com clareza sobre cada real.' },
  { icone: 'camera', titulo: 'Lance em segundos', texto: 'Foto do cupom, fatura em PDF, digitação pelo cardápio ou voz. Em até três toques o gasto está registrado.' },
  { icone: 'inbox', titulo: 'Contas e cartões entram sozinhos', texto: 'As faturas chegam pelo e-mail e as compras pelo SMS do banco. Você só confirma a categoria na Caixa de entrada.' },
  { icone: 'users', titulo: 'Decidam juntos e acompanhem os projetos', texto: 'Propostas, votação e reunião mensal. Cada projeto mostra se a família está no ritmo para a meta.' },
]

export default function Tutorial() {
  const nav = useNavigate()
  const salvarPreferencias = useSessao((e) => e.salvarPreferencias)
  const [i, setI] = useState(0)
  const passo = PASSOS[i]
  const ultimo = i === PASSOS.length - 1
  const concluir = () => { salvarPreferencias({ tutorial_visto: true }); nav('/', { replace: true }) }

  return (
    <div style={{ minHeight: '80dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <section className="card" style={{ width: 'min(420px, 100%)', textAlign: 'center', padding: '32px 24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }} aria-live="polite">
        <span className="ico" style={{ width: 56, height: 56, borderRadius: 14, ['--c' as string]: 'var(--sel)' }}><Icone nome={passo.icone} tamanho={26} /></span>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '6px 0 0', lineHeight: 1.3 }}>{passo.titulo}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.55, minHeight: '3.1em' }}>{passo.texto}</p>
        <div style={{ display: 'flex', gap: 6, margin: '6px 0 2px' }} aria-label={`Tela ${i + 1} de ${PASSOS.length}`}>
          {PASSOS.map((_, k) => <i key={k} style={{ display: 'block', width: k === i ? 18 : 6, height: 6, borderRadius: 3, background: k === i ? 'var(--sel)' : 'var(--line)', transition: 'width .15s' }} />)}
        </div>
        <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
          {!ultimo && <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={concluir}>Pular</button>}
          {i > 0 && ultimo && <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setI(i - 1)}><Icone nome="chevron-left" />Anterior</button>}
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => (ultimo ? concluir() : setI(i + 1))}>{ultimo ? 'Começar' : 'Próximo'}<Icone nome={ultimo ? 'check' : 'chevron-right'} /></button>
        </div>
      </section>
    </div>
  )
}
