/**
 * Estado global do app (zustand): sessão, dados do bootstrap, preferências de
 * acessibilidade e avisos ("toasts" com desfazer).
 */
import { create } from 'zustand'
import type { Bootstrap, Categoria, Grupo, Usuario, Config, Projeto, Cartao, ContaFixa, Versiculo, RegraLoja } from '../tipos'
import { competenciaDe } from '../util/formato'
import { api, lerSessao, salvarSessao, type Sessao } from '../api/cliente'
import { sincronizarFila, tamanhoFila, aoMudarFila } from '../api/fila'

export type TamanhoLetra = 'normal' | 'grande' | 'muito-grande'
export interface Preferencias {
  tema: 'escuro' | 'claro'
  letra: TamanhoLetra
  alto_contraste: boolean
  tutorial_visto: boolean
}

const CHAVE_PREF = 'ff_preferencias'
function lerPreferencias(): Preferencias {
  try {
    return { tema: 'escuro', letra: 'normal', alto_contraste: false, tutorial_visto: false, ...JSON.parse(localStorage.getItem(CHAVE_PREF) || '{}') }
  } catch {
    return { tema: 'escuro', letra: 'normal', alto_contraste: false, tutorial_visto: false }
  }
}
export function aplicarPreferencias(p: Preferencias) {
  const raiz = document.documentElement
  raiz.dataset.tema = p.tema
  raiz.dataset.letra = p.letra
  raiz.dataset.contraste = p.alto_contraste ? 'alto' : 'normal'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', '#0D0E23')
}

/** Filtros globais do painel (ano, mês, membro) — vivem na barra lateral/cabeçalho. */
export interface Filtros {
  ano: number
  mes: number // 1..12
  membro: string // '' = toda a família
}

export interface Aviso {
  id: number
  texto: string
  tipo?: 'ok' | 'erro' | 'info'
  desfazer?: () => void | Promise<void>
}

interface Estado {
  sessao: Sessao | null
  carregando: boolean
  erroBoot: string | null
  boot: Bootstrap | null
  preferencias: Preferencias
  avisos: Aviso[]
  pendentesCaixa: number
  contasAPagar: number
  filaOffline: number
  online: boolean
  filtros: Filtros

  // Ações
  iniciar: () => Promise<void>
  entrar: (sessao: Sessao) => Promise<void>
  sair: () => void
  recarregarBoot: () => Promise<void>
  atualizarConfig: (c: Partial<Config>) => void
  atualizarProjetos: (p: Projeto[]) => void
  atualizarCategorias: (c: Categoria[]) => void
  atualizarGrupos: (g: Grupo[]) => void
  atualizarUsuarios: (u: Usuario[]) => void
  atualizarCartoes: (k: Cartao[]) => void
  atualizarContasFixas: (f: ContaFixa[]) => void
  setPendentesCaixa: (n: number) => void
  setContasAPagar: (n: number) => void
  setFiltros: (f: Partial<Filtros>) => void
  atualizarRegrasLoja: (r: RegraLoja[]) => void
  salvarPreferencias: (p: Partial<Preferencias>) => void
  avisar: (texto: string, opcoes?: { tipo?: Aviso['tipo']; desfazer?: Aviso['desfazer']; duracao?: number }) => void
  fecharAviso: (id: number) => void
}

let proximoAviso = 1

export const useSessao = create<Estado>((set, get) => ({
  sessao: lerSessao(),
  carregando: true,
  erroBoot: null,
  boot: null,
  preferencias: lerPreferencias(),
  avisos: [],
  pendentesCaixa: 0,
  contasAPagar: 0,
  filaOffline: 0,
  filtros: { ano: Number(competenciaDe().slice(0, 4)), mes: Number(competenciaDe().slice(5, 7)), membro: '' },
  online: typeof navigator === 'undefined' ? true : navigator.onLine,

  iniciar: async () => {
    aplicarPreferencias(get().preferencias)
    aoMudarFila((n) => set({ filaOffline: n }))
    set({ filaOffline: await tamanhoFila() })
    window.addEventListener('online', async () => {
      set({ online: true })
      const s = get().sessao
      if (s?.url_api) {
        const n = await sincronizarFila(s.url_api)
        if (n) get().avisar(`${n} lançamento(s) enviados agora que a internet voltou.`, { tipo: 'ok' })
      }
    })
    window.addEventListener('offline', () => set({ online: false }))
    const s = get().sessao
    if (!s) {
      set({ carregando: false })
      return
    }
    await get().recarregarBoot()
    if (s.url_api && navigator.onLine) sincronizarFila(s.url_api).catch(() => {})
  },

  entrar: async (sessao) => {
    salvarSessao(sessao)
    set({ sessao, carregando: true, erroBoot: null })
    await get().recarregarBoot()
  },

  sair: () => {
    salvarSessao(null)
    set({ sessao: null, boot: null, carregando: false })
  },

  recarregarBoot: async () => {
    try {
      const boot = await api<Bootstrap>('bootstrap')
      set({ boot, pendentesCaixa: boot.pendentes_caixa, carregando: false, erroBoot: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar'
      if (/Sessão expirada|Família não encontrada/.test(msg)) {
        salvarSessao(null)
        set({ sessao: null, boot: null, carregando: false, erroBoot: msg })
      } else set({ carregando: false, erroBoot: msg })
    }
  },

  atualizarConfig: (c) => set((e) => (e.boot ? { boot: { ...e.boot, config: { ...e.boot.config, ...c } } } : {})),
  atualizarProjetos: (projetos) => set((e) => (e.boot ? { boot: { ...e.boot, projetos } } : {})),
  atualizarCategorias: (categorias) => set((e) => (e.boot ? { boot: { ...e.boot, categorias } } : {})),
  atualizarGrupos: (grupos) => set((e) => (e.boot ? { boot: { ...e.boot, grupos } } : {})),
  atualizarUsuarios: (usuarios) => set((e) => (e.boot ? { boot: { ...e.boot, usuarios } } : {})),
  atualizarCartoes: (cartoes) => set((e) => (e.boot ? { boot: { ...e.boot, cartoes } } : {})),
  atualizarContasFixas: (contas_fixas) => set((e) => (e.boot ? { boot: { ...e.boot, contas_fixas } } : {})),
  setPendentesCaixa: (n) => set({ pendentesCaixa: n }),
  setContasAPagar: (n) => set({ contasAPagar: n }),
  setFiltros: (f) => set((e) => ({ filtros: { ...e.filtros, ...f } })),
  atualizarRegrasLoja: (regras_loja) => set((e) => (e.boot ? { boot: { ...e.boot, regras_loja } } : {})),

  salvarPreferencias: (p) => {
    const novas = { ...get().preferencias, ...p }
    try { localStorage.setItem(CHAVE_PREF, JSON.stringify(novas)) } catch { /* ignora */ }
    aplicarPreferencias(novas)
    set({ preferencias: novas })
  },

  avisar: (texto, opcoes) => {
    const id = proximoAviso++
    set((e) => ({ avisos: [...e.avisos, { id, texto, tipo: opcoes?.tipo ?? 'info', desfazer: opcoes?.desfazer }] }))
    setTimeout(() => get().fecharAviso(id), opcoes?.duracao ?? (opcoes?.desfazer ? 5000 : 3500))
  },
  fecharAviso: (id) => set((e) => ({ avisos: e.avisos.filter((a) => a.id !== id) })),
}))

/** Atalhos de leitura. */
export function useBoot() {
  const boot = useSessao((e) => e.boot)
  if (!boot) throw new Error('Bootstrap ainda não carregado')
  return boot
}
export function usuarioPorId(usuarios: Usuario[], id: string | undefined) {
  return usuarios.find((u) => u.id === id)
}
export function categoriaPorId(categorias: Categoria[], id: string | undefined) {
  return categorias.find((c) => c.id === id)
}
export function grupoPorId(grupos: Grupo[], id: string | undefined) {
  return grupos.find((g) => g.id === id)
}
/** Competência AAAA-MM dos filtros atuais. */
export function competenciaDosFiltros(f: Filtros): string {
  return `${f.ano}-${String(f.mes).padStart(2, '0')}`
}
export type { Versiculo }
