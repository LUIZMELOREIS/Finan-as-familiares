/**
 * Lista chamadas de função nos .gs que não estão definidas em nenhum arquivo nem são
 * serviços/objetos conhecidos do Apps Script. Uso: node apps-script/testes/verificar_referencias.mjs
 *
 * Antes de procurar as chamadas, o código passa por um tokenizador simples que remove strings
 * ('…', "…", `…`), comentários (// e /* *\/) e expressões regulares numa única passada — assim
 * uma URL com "//" dentro de uma string ou um apóstrofo num comentário não confundem a análise.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const arquivos = fs.readdirSync(raiz).filter((f) => f.endsWith('.gs'))
const codigo = Object.fromEntries(arquivos.map((f) => [f, fs.readFileSync(path.join(raiz, f), 'utf8')]))

/** Remove strings, comentários e regex, preservando as quebras de linha. */
function semLiterais(src) {
  let out = ''
  let i = 0
  let ultimoSignificativo = ''
  const podeSerRegex = () => /^$|[(,=:[!&|?{};+\-*%<>~^]$/.test(ultimoSignificativo) || /\b(return|typeof|case|in|of|new|delete|void|throw)$/.test(ultimoSignificativo)
  while (i < src.length) {
    const c = src[i], d = src[i + 1]
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '/' && d === '*') { const fim = src.indexOf('*/', i + 2); const trecho = src.slice(i, fim < 0 ? src.length : fim + 2); out += trecho.replace(/[^\n]/g, ' '); i += trecho.length; continue }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++ }
      const trecho = src.slice(i, j + 1)
      out += c + trecho.slice(1, -1).replace(/[^\n]/g, ' ') + c
      i = j + 1; ultimoSignificativo = c; continue
    }
    if (c === '/' && podeSerRegex()) {
      let j = i + 1, emClasse = false
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === '[') emClasse = true
        else if (src[j] === ']') emClasse = false
        else if (src[j] === '/' && !emClasse) break
        j++
      }
      while (/[gimsuy]/.test(src[j + 1] || '')) j++
      out += '/' + ' '.repeat(Math.max(0, j - i - 1)) + '/'
      i = j + 1; ultimoSignificativo = '/'; continue
    }
    out += c
    if (!/\s/.test(c)) ultimoSignificativo = /\w/.test(c) ? (ultimoSignificativo.match(/\w+$/) ? ultimoSignificativo.match(/\w+$/)[0] + c : c) : c
    i++
  }
  return out
}

const definidas = new Set()
for (const c of Object.values(codigo)) {
  for (const m of c.matchAll(/^function\s+([A-Za-z_]\w*)/gm)) definidas.add(m[1])
  for (const m of c.matchAll(/^class\s+([A-Za-z_]\w*)/gm)) definidas.add(m[1])
  for (const m of c.matchAll(/^const\s+([A-Z_]\w*)/gm)) definidas.add(m[1])
}
const conhecidas = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'new', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'RegExp', 'Error', 'parseFloat', 'parseInt', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'Set', 'Map', 'Promise', 'Symbol', 'super', 'constructor'])
const problemas = []
for (const [f, c] of Object.entries(codigo)) {
  const limpo = semLiterais(c)
  // Nomes locais (const/let/var, parâmetros e arrow functions) não contam.
  const locais = new Set()
  for (const m of limpo.matchAll(/(?:const|let|var)\s+([A-Za-z_]\w*)\s*=/g)) locais.add(m[1])
  for (const m of limpo.matchAll(/\(([^()]*)\)\s*=>/g)) m[1].split(',').forEach((x) => locais.add(x.trim()))
  for (const m of limpo.matchAll(/function\s*\w*\s*\(([^()]*)\)/g)) m[1].split(',').forEach((x) => locais.add(x.trim()))
  for (const m of limpo.matchAll(/(?<![\w.])([A-Za-z_]\w*)\s*\(/g)) {
    const nome = m[1]
    if (definidas.has(nome) || conhecidas.has(nome) || locais.has(nome)) continue
    problemas.push(f + ': ' + nome)
  }
}
const unicos = [...new Set(problemas)]
console.log(unicos.length ? 'Chamadas sem definição:\n' + unicos.join('\n') : 'Todas as chamadas de função têm definição.')
process.exit(unicos.length ? 1 : 0)
