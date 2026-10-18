/**
 * Tipos compartilhados entre o app (PWA) e a API do Apps Script.
 * Este arquivo é o CONTRATO: as abas da planilha BD_Financas_Familia têm
 * exatamente estes campos (em snake_case), e a API devolve/recebe estes objetos.
 */

export type Perfil = 'Administrador' | 'Adulto' | 'Dependente'
export type TipoLancamento = 'receita' | 'despesa'
export type FormaPgto = 'dinheiro' | 'pix' | 'débito' | 'crédito' | 'boleto'
export type OrigemLancamento = 'manual' | 'foto' | 'voz' | 'chat' | 'sms' | 'email' | 'fatura' | 'recorrente' | 'telegram'
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
  dependente_ve_salarios: boolean
  rotina_vigia: boolean
  rotina_quinzenal: boolean
  rotina_fechamento: boolean
  telegram_ativo?: boolean
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

/** Nome de cor da paleta (seção 2.3 do prompt): indigo, magenta, gold, orange, green, red, lilac, rose, slate. */
export type CorPaleta = 'indigo' | 'sel' | 'magenta' | 'gold' | 'orange' | 'green' | 'red' | 'lilac' | 'rose' | 'slate'

/** Os 4 cards de tipo da tela inicial: Receitas, Despesas fixas, Despesas variáveis e Projetos. Nunca aumentam. */
export interface Tipo {
  id: 't_receitas' | 't_fixas' | 't_variaveis' | 't_projetos'
  nome: string
  icone: string // nome Lucide (kebab-case)
  cor: CorPaleta
  ordem: number
}

/** Grupo do cardápio (ex.: Moradia, Alimentação). Só existe dentro de um dos 3 tipos. */
export interface Grupo {
  id: string
  tipo_id: Tipo['id']
  nome: string
  cor: CorPaleta
  /** Agrupamento fixo usado nos gráficos: Moradia, Contas de consumo, Saúde e educação, Transporte, Alimentação, Lazer, Dízimo e ofertas, Outros. */
  grupo_analise: string
  ordem: number
  ativo?: boolean
}

/** Item do cardápio de despesas/receitas. */
export interface Categoria {
  id: string
  tipo_id: Tipo['id']
  grupo_id: string
  nome: string
  icone: string // nome Lucide (kebab-case), ex.: "shopping-cart"
  cor: CorPaleta
  tipo: TipoLancamento
  fixa: boolean
  orcamento_mensal: number
  palavras_chave: string // "COPEL;SANEPAR"
  grupo_analise: string
  ativa: boolean
  sensivel?: boolean // Dependente não vê (salários)
  oculta_cardapio?: boolean // ex.: aporte em projeto (lançado pela tela Projetos)
}

/** Regra aprendida: esta loja cai sempre nesta categoria. */
export interface RegraLoja {
  id: string
  loja_normalizada: string
  categoria_id: string
  criado_por: string
  criado_em: string
  acertos: number
}

/** Alerta personalizado ("Delivery acima de R$ 400/mês → avisar Luiz e Nina"). */
export interface Alerta {
  id: string
  nome: string
  tipo: 'categoria_acima' | 'grupo_acima' | 'nova_assinatura' | 'cobranca_duplicada' | 'fora_do_padrao'
  categoria_id?: string
  grupo_id?: string
  limite: number
  avisar: string[] // usuario_id[] (vazio = todos)
  ativo: boolean
  ultimo_disparo?: string
  status_atual?: 'ok' | 'disparado'
  percentual_atual?: number
}

/** Patrimônio informado manualmente (contas, investimentos). */
export interface Patrimonio {
  id: string
  nome: string
  tipo: 'conta' | 'poupanca' | 'investimento' | 'imovel' | 'veiculo' | 'outro'
  instituicao: string
  titular_id: string
  saldos: Array<{ competencia: string; valor: number }>
  ativo: boolean
}

/** Aviso gerado pelo vigia diário / análise quinzenal / fechamento. */
export interface Aviso {
  id: string
  data: string
  tipo: 'fora_do_padrao' | 'cobranca_duplicada' | 'nova_assinatura' | 'vencimento' | 'sem_categoria' | 'tendencia' | 'fechamento' | 'alerta_personalizado'
  titulo: string
  detalhe: string
  gravidade: 'red' | 'warn' | 'proj' | 'ok'
  acao?: { rotulo: string; rota: string }
  lido?: boolean
}

/** Saída prevista (contas, parcelas, assinaturas, faturas) para 30/60/90 dias. */
export interface SaidaPrevista {
  id: string
  data: string
  titulo: string
  subtitulo: string
  valor: number
  icone: string
  status: 'lida_do_email' | 'prevista' | 'estimada' | 'parcela' | 'parcial'
  rota?: string
}

/** Mensagem do Assistente. */
export interface MensagemAssistente {
  id: string
  papel: 'eu' | 'assistente'
  texto: string
  data: string
  barras?: Array<{ rotulo: string; valor: number; cor?: CorPaleta }>
  lancamento?: Lancamento
  etiqueta?: string
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
  anexo_miniatura?: string
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
  tipos: Tipo[]
  grupos: Grupo[]
  categorias: Categoria[]
  regras_loja: RegraLoja[]
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
  por_tipo: Record<string, { realizado: number; orcado: number }>
  projetos: { guardado_total: number; percentual_medio: number; ativos: number }
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
    previsto?: boolean // mês futuro: valores previstos (orçamento/recorrentes)
    por_tipo: Record<string, number>
    por_grupo_analise: Record<string, number>
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
