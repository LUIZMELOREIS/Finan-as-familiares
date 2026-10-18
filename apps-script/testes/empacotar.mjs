// Gera apps-script/dist/FinancasDaFamilia.gs: todos os .gs concatenados em um único arquivo,
// para quem prefere colar UM arquivo no editor do Apps Script em vez de 17.
// O Apps Script compartilha o escopo global entre arquivos, então o resultado é equivalente.
// Uso: node apps-script/testes/empacotar.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
// api.gs primeiro (doGet/doPost), setup.gs em seguida, depois os demais em ordem alfabética.
const prioridade = ['api.gs', 'setup.gs', 'util.gs', 'bd.gs']
const arquivos = readdirSync(raiz).filter((f) => f.endsWith('.gs') && f !== 'dist')
arquivos.sort((a, b) => {
  const pa = prioridade.indexOf(a), pb = prioridade.indexOf(b)
  if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
  return a.localeCompare(b)
})
const partes = [
  '/**',
  ' * Finanças da Família — back-end Google Apps Script (arquivo único).',
  ' * Gerado por apps-script/testes/empacotar.mjs a partir dos arquivos em apps-script/*.gs.',
  ' * Cole este arquivo inteiro no Código.gs do seu projeto e o appsscript.json no manifesto.',
  ` * Gerado em ${new Date().toISOString().slice(0, 10)}.`,
  ' */',
  '',
]
for (const f of arquivos) {
  partes.push(`// ${'='.repeat(78)}`, `// ${f}`, `// ${'='.repeat(78)}`, '', readFileSync(join(raiz, f), 'utf8').trimEnd(), '')
}
mkdirSync(join(raiz, 'dist'), { recursive: true })
writeFileSync(join(raiz, 'dist', 'FinancasDaFamilia.gs'), partes.join('\n'))
console.log(`dist/FinancasDaFamilia.gs gerado com ${arquivos.length} arquivos (${partes.join('\n').length.toLocaleString('pt-BR')} caracteres).`)
