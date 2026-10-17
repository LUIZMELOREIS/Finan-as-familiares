export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-suave" role="status">
      <div className="w-10 h-10 rounded-full border-4 border-borda border-t-primaria animate-spin" />
      <span>{texto}</span>
    </div>
  )
}

export function Vazio({ icone = '🗒️', titulo, texto, children }: { icone?: string; titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="card p-6 text-center">
      <div className="text-4xl mb-2" aria-hidden>{icone}</div>
      <div className="font-bold text-lg">{titulo}</div>
      {texto && <p className="text-suave mt-1">{texto}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
