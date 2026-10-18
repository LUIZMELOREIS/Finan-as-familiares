/** Folha "Outras…": o cardápio completo em abas para escolher a categoria de um item. */
import { useState } from 'react'
import { useBoot } from '../../store/sessao'
import type { Categoria } from '../../tipos'
import { Folha } from '../Folha'
import { Cardapio, abaDe, type AbaCardapio } from '../lancar/Cardapio'

export function FolhaCardapio({ aberta, aoFechar, titulo, escolhida, aoEscolher }: {
  aberta: boolean
  aoFechar: () => void
  titulo?: string
  escolhida?: string
  aoEscolher: (c: Categoria) => void
}) {
  const { tipos, grupos, categorias } = useBoot()
  const [aba, setAba] = useState<AbaCardapio>(() => abaDe(categorias.find((c) => c.id === escolhida)))
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={titulo ?? 'Qual é a despesa?'} largura={760}>
      <Cardapio tipos={tipos} grupos={grupos} categorias={categorias} escolhida={escolhida ?? ''} aoEscolher={aoEscolher} aba={aba} aoMudarAba={setAba} />
    </Folha>
  )
}
