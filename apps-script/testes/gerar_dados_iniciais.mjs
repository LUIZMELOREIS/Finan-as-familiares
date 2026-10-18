/**
 * Gera apps-script/dados_iniciais.gs a partir de dados/grupos_categorias.json e dados/versiculos.json.
 * Uso: node apps-script/testes/gerar_dados_iniciais.mjs
 * (Não digite os dados à mão: rode este script sempre que os JSON mudarem.)
 *
 * Versão 2: além de grupos, categorias e versículos, o JSON traz `tipos` (os 4 cards),
 * `grupos_analise` (agrupamento fixo dos gráficos) e `cores` (paleta).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const gc = JSON.parse(readFileSync(join(raiz, 'dados', 'grupos_categorias.json'), 'utf8'))
const versiculos = JSON.parse(readFileSync(join(raiz, 'dados', 'versiculos.json'), 'utf8'))

const tipos = gc.tipos.map((t) => ({ id: t.id, nome: t.nome, icone: t.icone, cor: t.cor, ordem: t.ordem }))
const grupos = gc.grupos.map((g) => ({ id: g.id, tipo_id: g.tipo_id, nome: g.nome, cor: g.cor, grupo_analise: g.grupo_analise, ordem: g.ordem, ativo: g.ativo === undefined ? true : !!g.ativo }))
const categorias = gc.categorias.map((c) => ({
  id: c.id, tipo_id: c.tipo_id, grupo_id: c.grupo_id, nome: c.nome, icone: c.icone, cor: c.cor, tipo: c.tipo,
  fixa: !!c.fixa, orcamento_mensal: Number(c.orcamento_mensal) || 0, palavras_chave: c.palavras_chave || '',
  grupo_analise: c.grupo_analise, sensivel: !!c.sensivel, oculta_cardapio: !!c.oculta_cardapio, ativa: c.ativa === undefined ? true : !!c.ativa,
}))
const gruposAnalise = gc.grupos_analise || []
const cores = gc.cores || {}

const linhas = (lista) => lista.map((o) => '  ' + JSON.stringify(o)).join(',\n')

const saida = `/**
 * dados_iniciais.gs — Dados iniciais gravados por instalar(): tipos, grupos, categorias (cardápio),
 * grupos de análise, paleta de cores e versículos.
 *
 * ARQUIVO GERADO AUTOMATICAMENTE por apps-script/testes/gerar_dados_iniciais.mjs
 * a partir de dados/grupos_categorias.json e dados/versiculos.json. Não edite à mão:
 * altere os JSON e rode o script de novo.
 *
 * Versículos: Almeida Revista e Corrigida (domínio público).
 */

/** Os 4 tipos (cards da tela inicial): Receitas, Despesas fixas, Despesas variáveis, Projetos. Nunca aumentam. */
function dadosIniciaisTipos() {
  return [
${linhas(tipos)}
  ];
}

/** Grupos do cardápio (cada um dentro de um tipo; cor da paleta; grupo de análise dos gráficos). */
function dadosIniciaisGrupos() {
  return [
${linhas(grupos)}
  ];
}

/** Categorias (cardápio) com ícone Lucide, palavras-chave para classificação automática e orçamento. */
function dadosIniciaisCategorias() {
  return [
${linhas(categorias)}
  ];
}

/** Agrupamento fixo usado nos gráficos (nome → cor da paleta). */
function dadosIniciaisGruposAnalise() {
  return [
${linhas(gruposAnalise)}
  ];
}

/** Paleta de cores do padrão visual (nome → hexadecimal). */
function dadosIniciaisCores() {
  return ${JSON.stringify(cores)};
}

/** Versículos sobre mordomia, generosidade, planejamento, família etc. */
function dadosIniciaisVersiculos() {
  return [
${linhas(versiculos)}
  ];
}
`
writeFileSync(join(raiz, 'apps-script', 'dados_iniciais.gs'), saida)
console.log(`dados_iniciais.gs gerado: ${tipos.length} tipos, ${grupos.length} grupos, ${categorias.length} categorias, ${gruposAnalise.length} grupos de análise, ${versiculos.length} versículos`)
