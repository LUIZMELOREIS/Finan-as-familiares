/**
 * Gera apps-script/dados_iniciais.gs a partir de dados/grupos_categorias.json e dados/versiculos.json.
 * Uso: node apps-script/testes/gerar_dados_iniciais.mjs
 * (Não digite os dados à mão: rode este script sempre que os JSON mudarem.)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const gc = JSON.parse(readFileSync(join(raiz, 'dados', 'grupos_categorias.json'), 'utf8'))
const versiculos = JSON.parse(readFileSync(join(raiz, 'dados', 'versiculos.json'), 'utf8'))

const categorias = gc.categorias.map((c) => ({ ...c, ativa: true, sensivel: !!c.sensivel, subgrupo: c.subgrupo || '' }))

const linhas = (lista) => lista.map((o) => '  ' + JSON.stringify(o)).join(',\n')

const saida = `/**
 * dados_iniciais.gs — Dados iniciais gravados por instalar(): grupos, categorias e versículos.
 *
 * ARQUIVO GERADO AUTOMATICAMENTE por apps-script/testes/gerar_dados_iniciais.mjs
 * a partir de dados/grupos_categorias.json e dados/versiculos.json. Não edite à mão:
 * altere os JSON e rode o script de novo.
 *
 * Versículos: Almeida Revista e Corrigida (domínio público).
 */

/** Grupos (os 5 "cards" da tela inicial). */
function dadosIniciaisGrupos() {
  return [
${linhas(gc.grupos)}
  ]
}

/** Categorias com palavras-chave para sugestão automática. */
function dadosIniciaisCategorias() {
  return [
${linhas(categorias)}
  ]
}

/** Versículos sobre mordomia, generosidade, planejamento, família etc. */
function dadosIniciaisVersiculos() {
  return [
${linhas(versiculos)}
  ]
}
`
writeFileSync(join(raiz, 'apps-script', 'dados_iniciais.gs'), saida)
console.log(`dados_iniciais.gs gerado: ${gc.grupos.length} grupos, ${categorias.length} categorias, ${versiculos.length} versículos`)
