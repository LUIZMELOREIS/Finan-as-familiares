import { Cabecalho } from '../componentes/Cabecalho'

export default function Entrar({ erro }: { erro?: string }) {
  return (
    <>
      <Cabecalho titulo="Entrar" voltarPara="/" />
      <div className="max-w-3xl mx-auto p-4 text-suave">Em construção… {erro}</div>
    </>
  )
}
