import { useEffect, useState } from 'react'

const CORES = ['#5B5BE0', '#BD55C7', '#F2C552', '#E0852F', '#4CB963', '#4FA3E0']

/** Chuva de confete (ao bater 25/50/75/100% de um sonho). */
export function Confete({ ativo, quantidade = 60 }: { ativo: boolean; quantidade?: number }) {
  const [pecas, setPecas] = useState<Array<{ id: number; x: number; atraso: number; cor: string }>>([])
  useEffect(() => {
    if (!ativo) return
    setPecas(Array.from({ length: quantidade }, (_, i) => ({ id: i, x: Math.random() * 100, atraso: Math.random() * 0.8, cor: CORES[i % CORES.length] })))
    const t = setTimeout(() => setPecas([]), 3500)
    return () => clearTimeout(t)
  }, [ativo, quantidade])
  if (!pecas.length) return null
  return (
    <>
      {pecas.map((p) => (
        <span key={p.id} className="confete" style={{ left: `${p.x}vw`, background: p.cor, animationDelay: `${p.atraso}s` }} aria-hidden />
      ))}
    </>
  )
}
