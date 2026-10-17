/**
 * Cliente da API. Uma única função `api(acao, params)` que:
 *  - usa o Apps Script quando há URL configurada (sessão real);
 *  - usa o `mock` (dados locais de exemplo) no modo demonstração;
 *  - enfileira lançamentos quando está sem internet (ver fila.ts).
 */
import type { RespostaApi } from '../tipos'
import { chamarMock } from './mock'
import { enfileirar } from './fila'

export interface Sessao {
  url_api: string // vazio = modo demonstração
  token_familia: string
  token: string
  usuario_id: string
}

const CHAVE_SESSAO = 'ff_sessao'

export function lerSessao(): Sessao | null {
  try {
    const s = localStorage.getItem(CHAVE_SESSAO)
    return s ? (JSON.parse(s) as Sessao) : null
  } catch {
    return null
  }
}

export function salvarSessao(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s))
    else localStorage.removeItem(CHAVE_SESSAO)
  } catch {
    /* armazenamento indisponível (modo privado) — segue sem lembrar */
  }
}

export function emModoDemo(): boolean {
  const s = lerSessao()
  return !s?.url_api
}

export class ErroApi extends Error {
  offline: boolean
  constructor(mensagem: string, offline = false) {
    super(mensagem)
    this.offline = offline
  }
}

/** Ações que podem ser enfileiradas quando estiver sem internet. */
const ACOES_OFFLINE = new Set(['salvar_lancamento', 'aportar', 'votar', 'resolver_caixa_entrada', 'marcar_conta_paga'])

export async function api<T = unknown>(acao: string, params: Record<string, unknown> = {}, sessaoForcada?: Sessao): Promise<T> {
  const sessao = sessaoForcada ?? lerSessao()
  const corpo = {
    acao,
    token_familia: sessao?.token_familia ?? '',
    token: sessao?.token ?? '',
    usuario_id: sessao?.usuario_id ?? '',
    ...params,
  }

  // Modo demonstração: tudo local.
  if (!sessao?.url_api) {
    const r = (await chamarMock(corpo)) as RespostaApi<T>
    if (!r.ok) throw new ErroApi(r.erro || 'Erro no modo demonstração')
    return r.dados as T
  }

  // Sem internet: enfileira o que der e avisa.
  if (typeof navigator !== 'undefined' && !navigator.onLine && ACOES_OFFLINE.has(acao)) {
    await enfileirar(corpo)
    throw new ErroApi('Sem internet. Guardamos o lançamento e enviaremos quando a conexão voltar.', true)
  }

  let resposta: Response
  try {
    resposta = await fetch(sessao.url_api, {
      method: 'POST',
      // text/plain evita o preflight CORS, que o Apps Script não responde.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      redirect: 'follow',
    })
  } catch (e) {
    if (ACOES_OFFLINE.has(acao)) {
      await enfileirar(corpo)
      throw new ErroApi('Não foi possível conectar. Guardamos o lançamento para enviar depois.', true)
    }
    throw new ErroApi('Não foi possível conectar ao servidor. Verifique a internet.', true)
  }

  let json: RespostaApi<T>
  try {
    json = (await resposta.json()) as RespostaApi<T>
  } catch {
    throw new ErroApi('Resposta inválida do servidor. A URL da API está correta e publicada como "qualquer pessoa"?')
  }
  if (!json.ok) throw new ErroApi(json.erro || 'Erro desconhecido')
  return json.dados as T
}

/** Lê um arquivo como base64 (sem o prefixo data:). */
export function arquivoParaBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '')
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    leitor.readAsDataURL(arquivo)
  })
}

/** Comprime uma imagem no próprio celular (máx. 1600 px, JPEG ~80%). */
export async function comprimirImagem(arquivo: File, maxLado = 1600, qualidade = 0.8): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) return arquivo
  const bitmap = await createImageBitmap(arquivo).catch(() => null)
  if (!bitmap) return arquivo
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) return arquivo
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || arquivo), 'image/jpeg', qualidade))
}
