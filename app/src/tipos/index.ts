/**
 * Tipos compartilhados entre o app (PWA) e a API do Apps Script.
 * Este arquivo é o CONTRATO: as abas da planilha BD_Financas_Familia têm
 * exatamente estes campos (em snake_case), e a API devolve/recebe estes objetos.
 */

export type Perfil = 'Administrador' | 'Adulto' | 'Júnior'
export type TipoLancamento = 'receita' | 'despesa'
export type FormaPgto = 'dinheiro' | 'pix' | 'débito' | 'crédito' | 'boleto'
export type OrigemLancamento = 'manual' | 'foto' | 'voz' | 'sms' | 'email' | 'fatura' | 'recorrente'
export type StatusLancamento = 'confirmado' | 'a_confirmar'
export type StatusConta = 'aberta' | 'paga'
export type CanalCaixa = 'sms_ios' | 'sms_android' | 'email' | 'fatura'
export type StatusCaixa = 'pendente' | 'lançado' | 'duplicado' | 'ignorado'
export type StatusProjeto = 'votação' | 'ativo' | 'concluído' | 'pausado'
export type TipoDecisao = 'novo projeto' | 'gasto grande' | 'ajuste de orçamento'
export type StatusDecisao = 'aberta' | 'aprovada' | 'recusada'
export type Voto = 'sim' | 'não' | 'abster'
export type TemaVersiculo =
  | 'mordomia' | 'generosidade' | 'contentamento' | 'planejamento' | 'dívida' | 'família' | 'provisão'

export interface Config {
  nome_familia: string
  sobrenome: string
  url_brasao: string
  url_foto_capa: string
  versiculo_lema: string
  moeda: string
  dia_fechamento_mes: number
  lembrete_horario: string // "20:00"
  fe_ativa: boolean
  divisao_dar: number // % da renda
  divisao_poupar: number
  divisao_viver: number
  valor_gasto_grande: number // acima disso exige decisão do Conselho
  regra_votacao: 'maioria' | 'maioria_mais_pais'
  junior_ve_salarios: boolean
  url_planilha?: string
  url_pasta_drive?: string
}

export interface Usuario {
  id: string
  nome: string
  apelido: string
  avatar: string // emoji ou URL
  cor: string
  perfil: Perfil
  ativo: boolean
  criado_em: string
  ultimo_acesso: string
  mesada_mensal?: number
  token?: string // só devolvido para o próprio usuário / administrador
}

export interface Grupo {
  id: string
  nome: string
  icone: string
  cor: string
  ordem: number
  tipo: TipoLancamento | 'projeto'
}

export interface Categoria {
  id: string
  grupo_id: string
  nome: string
  icone: string
  cor: string
  tipo: TipoLancamento
  fixa: boolean
  orcamento_mensal: number
  palavras_chave: string // "COPEL;SANEPAR"
  ativa: boolean
  subgrupo?: string // "Moradia", "Consumo", "Alimentação"...
  sensivel?: boolean // Júnior não vê (salários)
}

export interface Lancamento {
  id: string
  data: string // dd/mm/aaaa no app → ISO (aaaa-mm-dd) na API
  competencia: string // AAAA-MM
  tipo: TipoLancamento
  valor: number
  categoria_id: string
  descricao: string
  estabelecimento: string
  forma_pgto: FormaPgto
  cartao_id?: string
  parcela?: string // "2/6"
  usuario_id: string
  origem: OrigemLancamento
  anexo_url?: string
  status: StatusLancamento
  hash_dedup?: string
  criado_em: string
  editado_por?: string
  excluido?: boolean
  projeto_id?: string // aporte vinculado
}

export interface ContaFixa {
  id: string
  nome: string
  categoria_id: string
  valor_previsto: number
  dia_vencimento: number
  remetente_email: string
  codigo_cliente: string
  ativa: boolean
}

export interface ContaAPagar {
  id: string
  conta_fixa_id: string
  competencia: string
  valor: number
  vencimento: string // ISO
  linha_digitavel?: string
  pix_copia_cola?: string
  consumo?: string // "320 kWh" | "12 m³" | "200 GB"
  consumo_valor?: number
  consumo_unidade?: string
  anexo_url?: string
  status: StatusConta
  pago_em?: string
  pago_por?: string
  lancamento_id?: string
}

export interface Cartao {
  id: string
  apelido: string
  banco: string
  final: string // 4 últimos dígitos — NUNCA o número completo
  titular_id: string
  dia_fechamento: number
  dia_vencimento: number
  cor: string
  ativo: boolean
}

export interface ItemCaixaEntrada {
  id: string
  recebido_em: string
  canal: CanalCaixa
  texto_bruto: string
  valor: number
  estabelecimento: string
  final_cartao: string
  data_compra: string
  sugestao_categoria: string // categoria_id
  sugestoes: string[] // até 6 categoria_id ordenadas
  usuario_id: string
  status: StatusCaixa
  lancamento_id?: string
}

export interface Orcamento {
  competencia: string
  categoria_id: string
  valor_planejado: number
}

export interface Projeto {
  id: string
  nome: string
  icone: string
  foto_url: string
  meta_valor: number
  data_alvo: string // ISO
  valor_inicial: number
  prioridade: number
  status: StatusProjeto
  versiculo: string
  criado_por: string
  criado_em: string
  valor_atual?: number // calculado: valor_inicial + soma dos aportes
}

export interface Aporte {
  id: string
  projeto_id: string
  data: string
  valor: number
  usuario_id: string
  observacao: string
}

export interface Decisao {
  id: string
  titulo: string
  descricao: string
  tipo: TipoDecisao
  valor: number
  criado_por: string
  criado_em: string
  prazo: string
  status: StatusDecisao
  projeto_id?: string
  votos?: VotoRegistro[]
}

export interface VotoRegistro {
  decisao_id: string
  usuario_id: string
  voto: Voto
  comentario: string
  data: string
}

export interface Versiculo {
  id: string
  referencia: string
  texto: string
  tema: TemaVersiculo
}

export interface RegistroLog {
  data: string
  usuario_id: string
  acao: string
  detalhe: string
}

export interface Reuniao {
  id: string
  competencia: string
  data: string
  pauta: string // markdown gerado
  decidido: string
  oracao_gratidao: string
  criado_por: string
}

/** Pacote inicial carregado ao abrir o app (uma chamada só). */
export interface Bootstrap {
  config: Config
  usuario: Usuario
  usuarios: Usuario[]
  grupos: Grupo[]
  categorias: Categoria[]
  cartoes: Cartao[]
  contas_fixas: ContaFixa[]
  projetos: Projeto[]
  versiculo_do_dia: Versiculo
  pendentes_caixa: number
}

/** Resumo de um mês para a tela inicial. */
export interface ResumoMes {
  competencia: string
  entrou: number
  saiu: number
  sobrou: number
  por_grupo: Record<string, { realizado: number; orcado: number }>
  por_categoria: Record<string, { realizado: number; orcado: number }>
  por_usuario: Record<string, number>
}

/** Dados do painel (dashboard) para um ano inteiro. */
export interface DadosPainel {
  ano: number
  meses: Array<{
    competencia: string
    saldo: number
    receitas: number
    despesas: number
    salarios: number
    outras_receitas: number
    por_grupo: Record<string, number>
    por_categoria: Record<string, number>
    por_usuario: Record<string, number>
  }>
  orcado_por_categoria: Record<string, number> // por competência atual
  poupanca_projetos: Array<{ competencia: string; total: number }>
}

/** Resultado da leitura inteligente (foto, voz, fatura). */
export interface LeituraExtraida {
  valor?: number
  data?: string
  estabelecimento?: string
  cnpj?: string
  descricao?: string
  forma_pgto?: FormaPgto
  categoria_id?: string
  itens?: Array<{ nome: string; valor: number }>
  // Para contas da casa
  empresa?: string
  competencia?: string
  vencimento?: string
  linha_digitavel?: string
  pix_copia_cola?: string
  consumo_valor?: number
  consumo_unidade?: string
  conta_fixa_id?: string
  // Para fatura de cartão
  compras?: Array<{ data: string; estabelecimento: string; valor: number; parcela?: string; ja_lancada: boolean }>
  confianca: number // 0..1
  origem_leitura: 'claude' | 'ocr_drive' | 'regex' | 'nfce'
  anexo_url?: string
}

/** Envelope padrão das respostas da API. */
export interface RespostaApi<T = unknown> {
  ok: boolean
  dados?: T
  erro?: string
  versao?: string
}
