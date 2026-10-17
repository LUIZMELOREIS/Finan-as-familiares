/**
 * Tutorial: 4 telas de boas-vindas deslizáveis (pontinhos, Próximo / Pular).
 * Ao terminar, marca `tutorial_visto` e vai para a tela inicial. Acessível depois em /tutorial.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessao } from '../store/sessao'

const TELAS = [
  { icone: '🙏', cor: '#F2C552', titulo: 'Deus é o dono, nós administramos', texto: 'Este app ajuda a nossa família a cuidar bem do que recebemos, com transparência e sem culpa.', versiculo: '“Do Senhor é a terra e a sua plenitude.” — Salmo 24:1' },
  { icone: '⚡', cor: '#5B5BE0', titulo: 'Lance em segundos', texto: 'Toque no botão “+” e escolha: fotografar o cupom, falar o gasto ou digitar. No máximo 3 toques.', versiculo: '' },
  { icone: '📥', cor: '#BD55C7', titulo: 'Contas e cartões entram sozinhos', texto: 'As contas da casa e as compras no cartão chegam por e-mail e SMS. Você só confirma na Caixa de Entrada.', versiculo: '' },
  { icone: '✈️', cor: '#E0852F', titulo: 'Sonhem e decidam juntos', texto: 'Criem sonhos com meta e prazo, acompanhem o termômetro e votem as decisões grandes no Conselho da Família.', versiculo: '“Porque qual de vós, querendo edificar uma torre, não se assenta primeiro a fazer as contas?” — Lucas 14:28' },
]

export default function Tutorial() {
  const nav = useNavigate()
  const salvarPreferencias = useSessao((e) => e.salvarPreferencias)
  const [atual, setAtual] = useState(0)
  const trilhoRef = useRef<HTMLDivElement>(null)

  // Acompanha o deslize com o dedo.
  useEffect(() => {
    const el = trilhoRef.current
    if (!el) return
    const f = () => setAtual(Math.round(el.scrollLeft / el.clientWidth))
    el.addEventListener('scroll', f, { passive: true })
    return () => el.removeEventListener('scroll', f)
  }, [])

  function irPara(i: number) {
    const el = trilhoRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
    setAtual(i)
  }
  function terminar() {
    salvarPreferencias({ tutorial_visto: true })
    nav('/', { replace: true })
  }

  const ultima = atual === TELAS.length - 1

  return (
    <div className="min-h-dvh bg-app flex flex-col area-segura-topo area-segura-base">
      <div className="flex justify-end px-4 pt-3">
        <button className="botao botao-fantasma" onClick={terminar}>Pular</button>
      </div>

      <div ref={trilhoRef} className="flex-1 flex overflow-x-auto snap-x snap-mandatory rolagem-escondida" aria-roledescription="carrossel" aria-label="Boas-vindas">
        {TELAS.map((t, i) => (
          <section key={t.titulo} className="w-full shrink-0 snap-center flex flex-col items-center justify-center text-center px-8" aria-label={`Tela ${i + 1} de ${TELAS.length}`} aria-hidden={i !== atual}>
            <div className="w-36 h-36 rounded-full flex items-center justify-center text-7xl mb-6 shadow-lg" style={{ background: `color-mix(in srgb, ${t.cor} 25%, transparent)`, border: `3px solid ${t.cor}` }} aria-hidden>{t.icone}</div>
            <h1 className="text-2xl font-extrabold leading-tight">{t.titulo}</h1>
            <p className="text-suave mt-3 max-w-sm text-lg leading-snug">{t.texto}</p>
            {t.versiculo && <p className="italic text-sm mt-4 max-w-sm" style={{ color: t.cor }}>{t.versiculo}</p>}
          </section>
        ))}
      </div>

      <div className="px-6 pb-6 max-w-md w-full mx-auto">
        <div className="flex justify-center gap-2 mb-5" role="tablist" aria-label="Telas">
          {TELAS.map((t, i) => (
            <button key={t.titulo} role="tab" aria-selected={i === atual} aria-label={`Ir para a tela ${i + 1}`} onClick={() => irPara(i)} className="p-2">
              <span className={`block h-3 rounded-full transition-all ${i === atual ? 'w-8 bg-primaria-sel' : 'w-3 bg-borda'}`} />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="botao botao-secundario !min-h-16 text-lg" onClick={() => irPara(Math.max(0, atual - 1))} disabled={atual === 0}><span aria-hidden>‹</span> Anterior</button>
          <button className="botao botao-primario !min-h-16 text-lg" onClick={() => (ultima ? terminar() : irPara(atual + 1))}>{ultima ? 'Começar' : 'Próximo'} <span aria-hidden>{ultima ? '🚀' : '›'}</span></button>
        </div>
      </div>
    </div>
  )
}
