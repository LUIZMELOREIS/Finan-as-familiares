/**
 * Na referência, os botões da `.topbar` somem no celular (≤ 760 px). Para a ação principal
 * continuar alcançável, `AcoesTopbar` mostra os botões só no computador e `AcaoCelular`
 * repete a ação como botão largo, só no celular, abaixo do conteúdo.
 */
import type { ReactNode } from 'react'

export function AcoesTopbar({ children }: { children: ReactNode }) {
  return <span className="hidden md:flex gap-2">{children}</span>
}

export function AcaoCelular({ children }: { children: ReactNode }) {
  return <div className="md:hidden flex flex-col gap-2 nao-imprimir" style={{ marginTop: 14 }}>{children}</div>
}
