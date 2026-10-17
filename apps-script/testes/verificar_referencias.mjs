/**
 * Lista chamadas de função nos .gs que não estão definidas em nenhum arquivo nem são
 * serviços/objetos conhecidos do Apps Script. Uso: node apps-script/testes/verificar_referencias.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const arquivos = fs.readdirSync(raiz).filter((f) => f.endsWith('.gs'))
const codigo = Object.fromEntries(arquivos.map((f) => [f, fs.readFileSync(path.join(raiz, f), 'utf8')]))
const definidas = new Set()
for (const c of Object.values(codigo)) {
  for (const m of c.matchAll(/^function\s+([A-Za-z_]\w*)/gm)) definidas.add(m[1])
  for (const m of c.matchAll(/^class\s+([A-Za-z_]\w*)/gm)) definidas.add(m[1])
  for (const m of c.matchAll(/^const\s+([A-Z_]\w*)/gm)) definidas.add(m[1])
}
const conhecidas = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'new', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'RegExp', 'Error', 'parseFloat', 'parseInt', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'Set', 'Map', 'Promise', 'Symbol', 'super', 'constructor'])
const problemas = []
for (const [f, c] of Object.entries(codigo)) {
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/`(?:[^`\\]|\\.)*`/g, '``').replace(/\/(?:[^/\\\n]|\\.)+\/[gimsuy]*/g, '//')
  // Nomes locais (const/let/var, parâmetros e arrow functions) não contam.
  const locais = new Set()
  for (const m of semComentarios.matchAll(/(?:const|let|var)\s+([A-Za-z_]\w*)\s*=/g)) locais.add(m[1])
  for (const m of semComentarios.matchAll(/\(([^()]*)\)\s*=>/g)) m[1].split(',').forEach((x) => locais.add(x.trim()))
  for (const m of semComentarios.matchAll(/function\s*\w*\s*\(([^()]*)\)/g)) m[1].split(',').forEach((x) => locais.add(x.trim()))
  for (const m of semComentarios.matchAll(/(?<![\w.])([A-Za-z_]\w*)\s*\(/g)) {
    const nome = m[1]
    if (definidas.has(nome) || conhecidas.has(nome) || locais.has(nome)) continue
    problemas.push(f + ': ' + nome)
  }
}
const unicos = [...new Set(problemas)]
console.log(unicos.length ? 'Chamadas sem definição:\n' + unicos.join('\n') : 'Todas as chamadas de função têm definição.')
process.exit(unicos.length ? 1 : 0)
