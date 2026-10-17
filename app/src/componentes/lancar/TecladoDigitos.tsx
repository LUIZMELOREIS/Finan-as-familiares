/**
 * Teclado numérico GRANDE próprio (0–9, tecla extra opcional e apagar).
 * Usado para o valor em R$ (com vírgula) e para o PIN (sem vírgula).
 */
export function TecladoDigitos({ aoDigito, aoApagar, teclaExtra, aoExtra, aoApagarTudo, desabilitado }: {
  aoDigito: (d: string) => void
  aoApagar: () => void
  teclaExtra?: string
  aoExtra?: () => void
  aoApagarTudo?: () => void
  desabilitado?: boolean
}) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const classe = 'botao botao-secundario !min-h-16 text-2xl font-bold !rounded-2xl'
  return (
    <div className="grid grid-cols-3 gap-2 select-none" role="group" aria-label="Teclado numérico">
      {teclas.map((t) => (
        <button key={t} type="button" className={classe} onClick={() => aoDigito(t)} disabled={desabilitado} aria-label={`Dígito ${t}`}>{t}</button>
      ))}
      {teclaExtra ? (
        <button type="button" className={`${classe} text-suave`} onClick={aoExtra} disabled={desabilitado} aria-label={teclaExtra === ',' ? 'Vírgula' : teclaExtra}>{teclaExtra}</button>
      ) : <span aria-hidden />}
      <button type="button" className={classe} onClick={() => aoDigito('0')} disabled={desabilitado} aria-label="Dígito 0">0</button>
      <button
        type="button"
        className={`${classe} text-suave`}
        onClick={aoApagar}
        onContextMenu={(e) => { e.preventDefault(); aoApagarTudo?.() }}
        disabled={desabilitado}
        aria-label="Apagar último dígito"
      >
        <span aria-hidden>⌫</span>
      </button>
    </div>
  )
}
