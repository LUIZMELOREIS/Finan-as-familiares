import { moeda } from '../../util/formato'

/**
 * Campo de valor grande (`.amount`): o usuário digita só os dígitos e o campo
 * vai formatando em R$ (os dois últimos dígitos são os centavos). Teclado
 * numérico no celular.
 */
export function CampoValor({ id, valor, aoMudar, autoFoco, className = '' }: {
  id?: string
  valor: number
  aoMudar: (v: number) => void
  autoFoco?: boolean
  className?: string
}) {
  return (
    <input
      id={id}
      className={`amount num ${className}`}
      inputMode="decimal"
      autoComplete="off"
      autoFocus={autoFoco}
      placeholder="R$ 0,00"
      aria-label="Valor"
      value={valor ? moeda(valor) : ''}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, '').slice(0, 12)
        aoMudar(digitos ? Number(digitos) / 100 : 0)
      }}
      onFocus={(e) => e.target.select()}
    />
  )
}
