/**
 * Regras CSS mínimas que as telas do Painel precisam além do index.css (que é o contrato
 * e não é editado aqui). Ficam fora das camadas do Tailwind para vencerem `.btn`/`.groups`.
 */
const CSS = [
  // botões da topbar que a referência esconde no celular (`.topbar .btn{display:none}`)
  '@media (max-width:760px){.topbar .acoes .so-desktop{display:none}}',
  '@media (min-width:761px){.so-celular{display:none !important}}',
  // três cards de tipo (visão do Dependente): 3 colunas no computador, 2 no tablet/celular
  '.groups.groups-3{grid-template-columns:repeat(3,1fr)}',
  '@media (max-width:1180px){.groups.groups-3{grid-template-columns:repeat(2,1fr)}}',
].join('')

export function EstilosLocais() {
  return <style>{CSS}</style>
}
