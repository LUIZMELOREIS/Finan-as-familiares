/**
 * MODO DEMONSTRAÇÃO — implementa as mesmas ações da API (docs/API.md) em cima
 * de dados locais (IndexedDB), com 12 meses de exemplo. Serve para:
 *  - conhecer o app antes de instalar o Apps Script;
 *  - testes visuais e automáticos;
 *  - a Fase 2 (painel igual à referência) com dados realistas.
 */
import { get, set } from 'idb-keyval'
import dadosBase from '../../../dados/grupos_categorias.json'
import versiculosBase from '../../../dados/versiculos.json'
import type {
  Aporte, Bootstrap, Cartao, Categoria, Config, ContaAPagar, ContaFixa, DadosPainel, Decisao, Grupo,
  ItemCaixaEntrada, Lancamento, LeituraExtraida, Orcamento, Projeto, Reuniao, RespostaApi, ResumoMes,
  Usuario, Versiculo, VotoRegistro, FormaPgto,
} from '../tipos'
import { agoraIso, competenciaDe, gerarId, hashDedup, hojeIso, normalizar, somarMeses } from '../util/formato'
import { extrairDeTexto, sugerirCategoria } from '../util/extrator'

interface Banco {
  config: Config
  usuarios: Usuario[]
  grupos: Grupo[]
  categorias: Categoria[]
  lancamentos: Lancamento[]
  contas_fixas: ContaFixa[]
  contas_a_pagar: ContaAPagar[]
  cartoes: Cartao[]
  caixa_entrada: ItemCaixaEntrada[]
  orcamento: Orcamento[]
  projetos: Projeto[]
  aportes: Aporte[]
  decisoes: Decisao[]
  votos: VotoRegistro[]
  reunioes: Reuniao[]
  log: Array<{ data: string; usuario_id: string; acao: string; detalhe: string }>
}

const CHAVE = 'ff_mock_banco_v1'
let cache: Banco | null = null

// ---------- Gerador de dados de exemplo (12 meses) ----------

/** Gerador pseudoaleatório determinístico para os dados serem sempre iguais. */
function criarAleatorio(semente: number) {
  let s = semente
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function gerarBancoExemplo(): Banco {
  const rnd = criarAleatorio(2026)
  const entre = (a: number, b: number) => Math.round((a + rnd() * (b - a)) * 100) / 100
  const escolher = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]

  const usuarios: Usuario[] = [
    { id: 'u_pai', nome: 'Luiz', apelido: 'Pai', avatar: '👨', cor: '#5B5BE0', perfil: 'Administrador', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), token: 'tok_pai_demo' },
    { id: 'u_mae', nome: 'Ana', apelido: 'Mãe', avatar: '👩', cor: '#BD55C7', perfil: 'Administrador', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), token: 'tok_mae_demo' },
    { id: 'u_filha', nome: 'Júlia', apelido: 'Ju', avatar: '👧', cor: '#F2C552', perfil: 'Júnior', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), mesada_mensal: 150, token: 'tok_ju_demo' },
    { id: 'u_filho', nome: 'Pedro', apelido: 'Pedrão', avatar: '👦', cor: '#4CB963', perfil: 'Júnior', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), mesada_mensal: 100, token: 'tok_pedro_demo' },
  ]

  const grupos = dadosBase.grupos as Grupo[]
  const categorias: Categoria[] = (dadosBase.categorias as Array<Omit<Categoria, 'ativa'>>).map((c) => ({ ...c, ativa: true }))

  const cartoes: Cartao[] = [
    { id: 'k_itau_pai', apelido: 'Itaú do Pai', banco: 'Itaú', final: '4321', titular_id: 'u_pai', dia_fechamento: 25, dia_vencimento: 5, cor: '#E0852F', ativo: true },
    { id: 'k_nu_mae', apelido: 'Nubank da Mãe', banco: 'Nubank', final: '8765', titular_id: 'u_mae', dia_fechamento: 20, dia_vencimento: 1, cor: '#BD55C7', ativo: true },
  ]

  const contas_fixas: ContaFixa[] = [
    { id: 'f_luz', nome: 'Copel (luz)', categoria_id: 'c_luz', valor_previsto: 280, dia_vencimento: 10, remetente_email: 'copel.com', codigo_cliente: '12345678', ativa: true },
    { id: 'f_agua', nome: 'Sanepar (água)', categoria_id: 'c_agua', valor_previsto: 110, dia_vencimento: 15, remetente_email: 'sanepar.com.br', codigo_cliente: '987654', ativa: true },
    { id: 'f_gas', nome: 'Compagas (gás)', categoria_id: 'c_gas', valor_previsto: 95, dia_vencimento: 12, remetente_email: 'compagas.com.br', codigo_cliente: '55443', ativa: true },
    { id: 'f_internet', nome: 'Internet fibra', categoria_id: 'c_internet', valor_previsto: 129.9, dia_vencimento: 8, remetente_email: 'vivo.com.br', codigo_cliente: '', ativa: true },
    { id: 'f_plano', nome: 'Unimed', categoria_id: 'c_plano_saude', valor_previsto: 890, dia_vencimento: 20, remetente_email: 'unimed.coop.br', codigo_cliente: '', ativa: true },
    { id: 'f_escola', nome: 'Colégio', categoria_id: 'c_escola', valor_previsto: 1250, dia_vencimento: 5, remetente_email: '', codigo_cliente: '', ativa: true },
    { id: 'f_aluguel', nome: 'Prestação da casa', categoria_id: 'c_aluguel', valor_previsto: 2100, dia_vencimento: 10, remetente_email: '', codigo_cliente: '', ativa: true },
    { id: 'f_condominio', nome: 'Condomínio', categoria_id: 'c_condominio', valor_previsto: 480, dia_vencimento: 10, remetente_email: '', codigo_cliente: '', ativa: true },
  ]

  const lancamentos: Lancamento[] = []
  const contas_a_pagar: ContaAPagar[] = []
  const orcamento: Orcamento[] = []
  const hoje = hojeIso()
  const compAtual = competenciaDe()
  const estabelecimentos: Record<string, string[]> = {
    c_mercado: ['Condor Super Center', 'Muffato', 'Festval', 'Atacadão'],
    c_feira: ['Feira do Batel', 'Hortifruti Boa Safra'],
    c_padaria: ['Padaria Pão Quente', 'Panificadora Imperial'],
    c_delivery: ['iFood', 'Pizzaria Baggio', 'Rappi'],
    c_farmacia: ['Drogaria Nissei', 'Panvel'],
    c_cuidados: ['Salão da Vera', 'Barbearia do Zé', 'O Boticário'],
    c_combustivel: ['Posto Shell', 'Posto Ipiranga'],
    c_transporte: ['Uber', 'Estacionamento Shopping'],
    c_passeios: ['Churrascaria Jardins', 'Cinemark', 'Café do Mercado'],
    c_streaming: ['Netflix', 'Spotify', 'Disney+'],
    c_hobbies: ['Smart Fit', 'Livraria Curitiba'],
    c_roupas: ['Renner', 'Riachuelo', 'Centauro'],
    c_presentes: ['Floricultura Flores & Cia', 'Loja de Presentes'],
    c_casa_manutencao: ['Leroy Merlin', 'Balaroti'],
    c_pet: ['Petz', 'Cobasi'],
  }

  // 12 meses: do mês atual menos 11 até o atual.
  for (let i = 11; i >= 0; i--) {
    const comp = somarMeses(compAtual, -i)
    const [ano, mes] = comp.split('-').map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const ehAtual = comp === compAtual
    const diaMax = ehAtual ? Number(hoje.slice(8, 10)) : ultimoDia
    const dia = (d: number) => `${comp}-${String(Math.min(d, diaMax)).padStart(2, '0')}`
    const add = (l: Omit<Lancamento, 'id' | 'competencia' | 'criado_em' | 'status'> & Partial<Lancamento>) => {
      if (Number(l.data.slice(8, 10)) > diaMax) return
      lancamentos.push({ id: gerarId('l'), competencia: comp, criado_em: `${l.data}T12:00:00`, status: 'confirmado', ...l })
    }

    // Receitas
    add({ data: dia(5), tipo: 'receita', valor: 8500, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'u_pai', origem: 'recorrente' })
    add({ data: dia(5), tipo: 'receita', valor: 6200, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'u_mae', origem: 'recorrente' })
    if (rnd() > 0.5) add({ data: dia(18), tipo: 'receita', valor: entre(300, 1500), categoria_id: 'c_renda_extra', descricao: 'Consultoria', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'u_pai', origem: 'manual' })
    add({ data: dia(1), tipo: 'receita', valor: 150, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'u_filha', origem: 'recorrente' })
    add({ data: dia(1), tipo: 'receita', valor: 100, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'u_filho', origem: 'recorrente' })

    // Dízimo e ofertas
    add({ data: dia(7), tipo: 'despesa', valor: 1470, categoria_id: 'c_dizimo', descricao: 'Dízimo', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'u_pai', origem: 'recorrente' })
    add({ data: dia(14), tipo: 'despesa', valor: entre(50, 200), categoria_id: 'c_ofertas', descricao: 'Oferta', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'u_mae', origem: 'manual' })
    if (rnd() > 0.6) add({ data: dia(21), tipo: 'despesa', valor: 100, categoria_id: 'c_missoes', descricao: 'Missões', estabelecimento: 'Agência Missionária', forma_pgto: 'pix', usuario_id: 'u_pai', origem: 'manual' })

    // Contas da casa (fixas) — com variação sazonal na luz
    for (const cf of contas_fixas) {
      let valor = cf.valor_previsto
      let consumo: number | undefined
      let unidade: string | undefined
      if (cf.id === 'f_luz') {
        const fator = 1 + 0.35 * Math.cos(((mes - 1) / 12) * 2 * Math.PI) // mais caro no verão
        valor = Math.round(cf.valor_previsto * fator * (0.95 + rnd() * 0.1) * 100) / 100
        consumo = Math.round(valor / 0.95)
        unidade = 'kWh'
      } else if (cf.id === 'f_agua') {
        valor = entre(90, 140)
        consumo = Math.round(valor / 9)
        unidade = 'm³'
      } else if (cf.id === 'f_gas') {
        valor = entre(80, 120)
        consumo = Math.round(valor / 7)
        unidade = 'm³'
      }
      const venc = `${comp}-${String(cf.dia_vencimento).padStart(2, '0')}`
      const paga = venc <= hoje
      const conta: ContaAPagar = {
        id: gerarId('cp'), conta_fixa_id: cf.id, competencia: comp, valor, vencimento: venc,
        linha_digitavel: '83640000001 2 21440138000 0 00000012345 6 78901234567 8',
        pix_copia_cola: '00020126580014br.gov.bcb.pix0136demo-chave-pix-familia520400005303986540' + valor.toFixed(2) + '5802BR5913FAMILIA DEMO6008CURITIBA62070503***6304ABCD',
        consumo: consumo ? `${consumo} ${unidade}` : undefined, consumo_valor: consumo, consumo_unidade: unidade,
        status: paga ? 'paga' : 'aberta', pago_em: paga ? venc : undefined, pago_por: paga ? 'u_pai' : undefined,
      }
      contas_a_pagar.push(conta)
      if (paga) {
        const l: Lancamento = { id: gerarId('l'), data: venc, competencia: comp, tipo: 'despesa', valor, categoria_id: cf.categoria_id, descricao: cf.nome, estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'u_pai', origem: 'email', status: 'confirmado', criado_em: `${venc}T09:00:00` }
        lancamentos.push(l)
        conta.lancamento_id = l.id
      } else if (ehAtual) {
        // previsto a confirmar
        lancamentos.push({ id: gerarId('l'), data: venc, competencia: comp, tipo: 'despesa', valor: cf.valor_previsto, categoria_id: cf.categoria_id, descricao: `${cf.nome} (previsto)`, estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'u_pai', origem: 'recorrente', status: 'a_confirmar', criado_em: `${comp}-01T09:00:00` })
      }
    }
    add({ data: dia(10), tipo: 'despesa', valor: 920, categoria_id: 'c_financiamento_carro', descricao: 'Parcela do carro', estabelecimento: 'BV Financeira', forma_pgto: 'boleto', usuario_id: 'u_pai', origem: 'recorrente' })
    add({ data: dia(15), tipo: 'despesa', valor: 185, categoria_id: 'c_seguro_carro', descricao: 'Seguro auto', estabelecimento: 'Porto Seguro', forma_pgto: 'crédito', cartao_id: 'k_itau_pai', usuario_id: 'u_pai', origem: 'recorrente' })
    add({ data: dia(3), tipo: 'despesa', valor: 149.9, categoria_id: 'c_telefone', descricao: 'Plano família', estabelecimento: 'Vivo', forma_pgto: 'crédito', cartao_id: 'k_nu_mae', usuario_id: 'u_mae', origem: 'recorrente' })
    if (mes === 1 || mes === 2) add({ data: dia(20), tipo: 'despesa', valor: 1850, categoria_id: 'c_ipva', descricao: 'IPVA', estabelecimento: 'Detran PR', forma_pgto: 'boleto', usuario_id: 'u_pai', origem: 'manual' })
    if (mes === 2) add({ data: dia(25), tipo: 'despesa', valor: 1400, categoria_id: 'c_iptu', descricao: 'IPTU (cota única)', estabelecimento: 'Prefeitura de Curitiba', forma_pgto: 'boleto', usuario_id: 'u_pai', origem: 'manual' })

    // Dia a dia (variáveis)
    const faixas: Record<string, [number, number, number]> = {
      // categoria: [qtd por mês, mín, máx]
      c_mercado: [5, 180, 520], c_feira: [4, 40, 90], c_padaria: [10, 12, 48], c_delivery: [5, 35, 120],
      c_farmacia: [3, 25, 160], c_cuidados: [2, 40, 120], c_combustivel: [4, 150, 250], c_transporte: [4, 12, 45],
      c_passeios: [3, 60, 220], c_streaming: [3, 21.9, 55.9], c_hobbies: [2, 50, 120], c_roupas: [2, 80, 350],
      c_presentes: [1, 60, 200], c_casa_manutencao: [1, 40, 400], c_pet: [2, 60, 180],
    }
    for (const [cat, [qtd, mn, mx]] of Object.entries(faixas)) {
      const n = Math.max(0, Math.round(qtd * (0.7 + rnd() * 0.6)))
      for (let k = 0; k < n; k++) {
        const quem = escolher(['u_pai', 'u_mae', 'u_mae', 'u_pai', 'u_filha', 'u_filho'])
        const formas: FormaPgto[] = ['crédito', 'débito', 'pix', 'dinheiro']
        const forma = quem.startsWith('u_fil') ? 'pix' : escolher(formas)
        const cartao = forma === 'crédito' ? (quem === 'u_mae' ? 'k_nu_mae' : 'k_itau_pai') : undefined
        const est = escolher(estabelecimentos[cat] ?? ['Loja'])
        const valorBase = entre(mn, mx)
        const valor = quem.startsWith('u_fil') ? Math.min(valorBase, entre(5, 40)) : valorBase
        add({ data: dia(1 + Math.floor(rnd() * ultimoDia)), tipo: 'despesa', valor, categoria_id: cat, descricao: est, estabelecimento: est, forma_pgto: forma, cartao_id: cartao, usuario_id: quem, origem: escolher(['manual', 'foto', 'voz', 'sms', 'manual']) })
      }
    }
    if (mes === 12) add({ data: dia(20), tipo: 'despesa', valor: 1200, categoria_id: 'c_presentes', descricao: 'Presentes de Natal', estabelecimento: 'Shopping', forma_pgto: 'crédito', cartao_id: 'k_nu_mae', usuario_id: 'u_mae', origem: 'manual' })

    // Aportes nos sonhos (lançamento + aporte)
    add({ data: dia(6), tipo: 'despesa', valor: 800, categoria_id: 'c_aporte_sonho', descricao: 'Aporte: Viagem a Gramado', estabelecimento: 'Poupança', forma_pgto: 'pix', usuario_id: 'u_pai', origem: 'manual', projeto_id: 'p_gramado' })
    add({ data: dia(6), tipo: 'despesa', valor: 500, categoria_id: 'c_aporte_sonho', descricao: 'Aporte: Reserva de emergência', estabelecimento: 'CDB', forma_pgto: 'pix', usuario_id: 'u_mae', origem: 'manual', projeto_id: 'p_reserva' })

    // Orçamento do mês = orçamento padrão das categorias
    for (const c of categorias) if (c.orcamento_mensal) orcamento.push({ competencia: comp, categoria_id: c.id, valor_planejado: c.orcamento_mensal })
    orcamento.push({ competencia: comp, categoria_id: 'c_dizimo', valor_planejado: 1470 })
  }

  const projetos: Projeto[] = [
    { id: 'p_gramado', nome: 'Viagem a Gramado', icone: '🏔️', foto_url: '', meta_valor: 12000, data_alvo: somarMeses(compAtual, 7) + '-15', valor_inicial: 1500, prioridade: 1, status: 'ativo', versiculo: 'Lucas 14:28', criado_por: 'u_mae', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'p_reserva', nome: 'Reserva de emergência', icone: '🛟', foto_url: '', meta_valor: 30000, data_alvo: somarMeses(compAtual, 30) + '-01', valor_inicial: 8000, prioridade: 2, status: 'ativo', versiculo: 'Provérbios 6:6-8', criado_por: 'u_pai', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'p_carro', nome: 'Trocar o carro', icone: '🚙', foto_url: '', meta_valor: 45000, data_alvo: somarMeses(compAtual, 36) + '-01', valor_inicial: 0, prioridade: 3, status: 'votação', versiculo: 'Provérbios 21:5', criado_por: 'u_pai', criado_em: hoje },
    { id: 'p_bike_ju', nome: 'Bicicleta da Ju', icone: '🚲', foto_url: '', meta_valor: 900, data_alvo: somarMeses(compAtual, 5) + '-01', valor_inicial: 120, prioridade: 4, status: 'ativo', versiculo: 'Provérbios 13:11', criado_por: 'u_filha', criado_em: somarMeses(compAtual, -3) + '-01' },
  ]
  const aportes: Aporte[] = lancamentos
    .filter((l) => l.projeto_id)
    .map((l) => ({ id: gerarId('a'), projeto_id: l.projeto_id!, data: l.data, valor: l.valor, usuario_id: l.usuario_id, observacao: '' }))
  aportes.push({ id: gerarId('a'), projeto_id: 'p_bike_ju', data: somarMeses(compAtual, -2) + '-10', valor: 30, usuario_id: 'u_filha', observacao: 'Guardei da mesada' })
  aportes.push({ id: gerarId('a'), projeto_id: 'p_bike_ju', data: somarMeses(compAtual, -1) + '-12', valor: 50, usuario_id: 'u_filha', observacao: 'Vendi livros usados' })
  aportes.push({ id: gerarId('a'), projeto_id: 'p_bike_ju', data: hoje, valor: 10, usuario_id: 'u_filho', observacao: 'Pra ajudar a Ju' })

  const decisoes: Decisao[] = [
    { id: 'd_carro', titulo: 'Começar a guardar para trocar o carro', descricao: 'Proposta: R$ 1.000/mês a partir do mês que vem. Meta de R$ 45 mil em 3 anos.', tipo: 'novo projeto', valor: 45000, criado_por: 'u_pai', criado_em: hoje, prazo: somarMeses(compAtual, 1) + '-05', status: 'aberta', projeto_id: 'p_carro' },
    { id: 'd_tv', titulo: 'Comprar TV nova para a sala', descricao: 'A TV da sala parou. Orçamento de R$ 2.800 em 10x.', tipo: 'gasto grande', valor: 2800, criado_por: 'u_mae', criado_em: somarMeses(compAtual, -1) + '-20', prazo: somarMeses(compAtual, -1) + '-27', status: 'aprovada' },
  ]
  const votos: VotoRegistro[] = [
    { decisao_id: 'd_carro', usuario_id: 'u_pai', voto: 'sim', comentario: 'O atual já tem 12 anos.', data: hoje },
    { decisao_id: 'd_carro', usuario_id: 'u_filha', voto: 'sim', comentario: 'Mas primeiro Gramado!', data: hoje },
    { decisao_id: 'd_tv', usuario_id: 'u_pai', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-21' },
    { decisao_id: 'd_tv', usuario_id: 'u_mae', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-20' },
    { decisao_id: 'd_tv', usuario_id: 'u_filho', voto: 'não', comentario: 'Prefiro um videogame', data: somarMeses(compAtual, -1) + '-22' },
  ]

  const caixa_entrada: ItemCaixaEntrada[] = [
    { id: 'ce_1', recebido_em: agoraIso(), canal: 'sms_ios', texto_bruto: 'Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12.', valor: 87.4, estabelecimento: 'PADARIA PAO QUENTE', final_cartao: '4321', data_compra: hoje, sugestao_categoria: 'c_padaria', sugestoes: ['c_padaria', 'c_mercado', 'c_delivery', 'c_passeios', 'c_feira'], usuario_id: 'u_pai', status: 'pendente' },
    { id: 'ce_2', recebido_em: agoraIso(), canal: 'sms_android', texto_bruto: 'Nubank: Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 8765.', valor: 156.9, estabelecimento: 'DROGARIA NISSEI', final_cartao: '8765', data_compra: hoje, sugestao_categoria: 'c_farmacia', sugestoes: ['c_farmacia', 'c_cuidados', 'c_mercado', 'c_imprevistos'], usuario_id: 'u_mae', status: 'pendente' },
    { id: 'ce_3', recebido_em: agoraIso(), canal: 'email', texto_bruto: 'Alerta de compra: POSTO SHELL R$ 210,00 cartão final 4321', valor: 210, estabelecimento: 'POSTO SHELL', final_cartao: '4321', data_compra: hoje, sugestao_categoria: 'c_combustivel', sugestoes: ['c_combustivel', 'c_transporte', 'c_casa_manutencao', 'c_imprevistos'], usuario_id: 'u_pai', status: 'pendente' },
  ]

  const config: Config = {
    nome_familia: 'Família Melo Reis', sobrenome: 'Melo Reis', url_brasao: '', url_foto_capa: '',
    versiculo_lema: '"Eu e a minha casa serviremos ao Senhor." — Josué 24:15', moeda: 'BRL', dia_fechamento_mes: 1,
    lembrete_horario: '20:00', fe_ativa: true, divisao_dar: 10, divisao_poupar: 15, divisao_viver: 75,
    valor_gasto_grande: 1000, regra_votacao: 'maioria_mais_pais', junior_ve_salarios: false,
    url_planilha: 'https://docs.google.com/spreadsheets/', url_pasta_drive: 'https://drive.google.com/',
  }

  return { config, usuarios, grupos, categorias, lancamentos, contas_fixas, contas_a_pagar, cartoes, caixa_entrada, orcamento, projetos, aportes, decisoes, votos, reunioes: [], log: [] }
}

// ---------- Persistência ----------

async function carregar(): Promise<Banco> {
  if (cache) return cache
  const salvo = await get<Banco>(CHAVE).catch(() => null)
  cache = salvo ?? gerarBancoExemplo()
  if (!salvo) await persistir()
  return cache
}
async function persistir() {
  if (cache) await set(CHAVE, cache).catch(() => {})
}
export async function reiniciarDemo() {
  cache = gerarBancoExemplo()
  await persistir()
}

// ---------- Helpers ----------

const ok = <T,>(dados: T): RespostaApi<T> => ({ ok: true, dados, versao: 'demo' })
const erro = (msg: string): RespostaApi => ({ ok: false, erro: msg })

function ehJunior(b: Banco, uid: string) {
  return b.usuarios.find((u) => u.id === uid)?.perfil === 'Júnior'
}
function filtrarSensivel(b: Banco, uid: string, ls: Lancamento[]) {
  if (!ehJunior(b, uid) || b.config.junior_ve_salarios) return ls
  const sensiveis = new Set(b.categorias.filter((c) => c.sensivel).map((c) => c.id))
  return ls.filter((l) => !sensiveis.has(l.categoria_id))
}
function ativos(ls: Lancamento[]) {
  return ls.filter((l) => !l.excluido)
}
function valorAtual(b: Banco, p: Projeto) {
  return p.valor_inicial + b.aportes.filter((a) => a.projeto_id === p.id).reduce((s, a) => s + a.valor, 0)
}
function registrarLog(b: Banco, uid: string, acao: string, detalhe: string) {
  b.log.unshift({ data: agoraIso(), usuario_id: uid, acao, detalhe })
  if (b.log.length > 500) b.log.length = 500
}

function versiculoDoDia(tema?: string): Versiculo {
  const lista = (versiculosBase as Versiculo[]).filter((v) => !tema || v.tema === tema)
  const dia = Math.floor(Date.now() / 86_400_000)
  return lista[dia % lista.length]
}

function resumoMes(b: Banco, uid: string, comp: string): ResumoMes {
  const ls = filtrarSensivel(b, uid, ativos(b.lancamentos)).filter((l) => l.competencia === comp && l.status === 'confirmado')
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const r: ResumoMes = { competencia: comp, entrou: 0, saiu: 0, sobrou: 0, por_grupo: {}, por_categoria: {}, por_usuario: {} }
  for (const g of b.grupos) r.por_grupo[g.id] = { realizado: 0, orcado: 0 }
  for (const o of b.orcamento.filter((o) => o.competencia === comp)) {
    const c = catMap.get(o.categoria_id)
    r.por_categoria[o.categoria_id] = { realizado: 0, orcado: o.valor_planejado }
    if (c && r.por_grupo[c.grupo_id]) r.por_grupo[c.grupo_id].orcado += o.valor_planejado
  }
  for (const l of ls) {
    const c = catMap.get(l.categoria_id)
    if (l.tipo === 'receita') r.entrou += l.valor
    else r.saiu += l.valor
    if (c) {
      r.por_grupo[c.grupo_id] = r.por_grupo[c.grupo_id] ?? { realizado: 0, orcado: 0 }
      r.por_grupo[c.grupo_id].realizado += l.valor
      r.por_categoria[c.id] = r.por_categoria[c.id] ?? { realizado: 0, orcado: 0 }
      r.por_categoria[c.id].realizado += l.valor
    }
    if (l.tipo === 'despesa') r.por_usuario[l.usuario_id] = (r.por_usuario[l.usuario_id] ?? 0) + l.valor
  }
  r.sobrou = r.entrou - r.saiu
  return r
}

function painel(b: Banco, uid: string, ano: number, filtroUsuario?: string): DadosPainel {
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const todos = filtrarSensivel(b, uid, ativos(b.lancamentos)).filter((l) => l.status === 'confirmado' && (!filtroUsuario || l.usuario_id === filtroUsuario))
  const meses: DadosPainel['meses'] = []
  for (let m = 1; m <= 12; m++) {
    const comp = `${ano}-${String(m).padStart(2, '0')}`
    const ls = todos.filter((l) => l.competencia === comp)
    const item: DadosPainel['meses'][number] = { competencia: comp, saldo: 0, receitas: 0, despesas: 0, salarios: 0, outras_receitas: 0, por_grupo: {}, por_categoria: {}, por_usuario: {} }
    for (const l of ls) {
      const c = catMap.get(l.categoria_id)
      if (l.tipo === 'receita') {
        item.receitas += l.valor
        if (c?.subgrupo === 'Salários') item.salarios += l.valor
        else item.outras_receitas += l.valor
      } else {
        item.despesas += l.valor
        if (c) {
          item.por_grupo[c.grupo_id] = (item.por_grupo[c.grupo_id] ?? 0) + l.valor
          item.por_categoria[c.id] = (item.por_categoria[c.id] ?? 0) + l.valor
        }
        item.por_usuario[l.usuario_id] = (item.por_usuario[l.usuario_id] ?? 0) + l.valor
      }
    }
    item.saldo = item.receitas - item.despesas
    meses.push(item)
  }
  const compAtual = competenciaDe()
  const orcado: Record<string, number> = {}
  for (const o of b.orcamento.filter((o) => o.competencia === compAtual)) orcado[o.categoria_id] = o.valor_planejado
  const poup: DadosPainel['poupanca_projetos'] = []
  let acumulado = b.projetos.reduce((s, p) => s + p.valor_inicial, 0)
  for (let m = 1; m <= 12; m++) {
    const comp = `${ano}-${String(m).padStart(2, '0')}`
    acumulado += b.aportes.filter((a) => a.data.slice(0, 7) === comp).reduce((s, a) => s + a.valor, 0)
    poup.push({ competencia: comp, total: acumulado })
  }
  return { ano, meses, orcado_por_categoria: orcado, poupanca_projetos: poup }
}

function distribuirParcelas(b: Banco, base: Lancamento, parcelas: number): Lancamento[] {
  const cartao = b.cartoes.find((k) => k.id === base.cartao_id)
  const valorParcela = Math.round((base.valor / parcelas) * 100) / 100
  const diaCompra = Number(base.data.slice(8, 10))
  // Compra depois do fechamento cai na competência seguinte.
  let compInicial = competenciaDe(base.data)
  if (cartao && diaCompra > cartao.dia_fechamento) compInicial = somarMeses(compInicial, 1)
  const grupo = gerarId('parc')
  const lista: Lancamento[] = []
  for (let i = 0; i < parcelas; i++) {
    lista.push({ ...base, id: gerarId('l'), competencia: somarMeses(compInicial, i), valor: i === parcelas - 1 ? Math.round((base.valor - valorParcela * (parcelas - 1)) * 100) / 100 : valorParcela, parcela: `${i + 1}/${parcelas}`, hash_dedup: `${grupo}_${i}` })
  }
  return lista
}

function gerarPauta(b: Banco, uid: string, comp: string): string {
  const r = resumoMes(b, uid, comp)
  const ant = resumoMes(b, uid, somarMeses(comp, -1))
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const estouradas = Object.entries(r.por_categoria).filter(([, v]) => v.orcado && v.realizado > v.orcado).map(([id, v]) => `- ${catMap.get(id)?.icone ?? ''} ${catMap.get(id)?.nome ?? id}: ${v.realizado.toFixed(2)} de ${v.orcado.toFixed(2)} planejados`)
  const subiram = b.contas_fixas.map((cf) => {
    const a = b.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === comp)
    const p = b.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === somarMeses(comp, -1))
    if (a && p && p.valor > 0 && a.valor / p.valor > 1.2) return `- ${cf.nome}: subiu ${Math.round((a.valor / p.valor - 1) * 100)}% (${p.valor.toFixed(2)} → ${a.valor.toFixed(2)})`
    return null
  }).filter(Boolean)
  const sonhos = b.projetos.filter((p) => p.status === 'ativo').map((p) => {
    const atual = valorAtual(b, p)
    return `- ${p.icone} ${p.nome}: ${Math.round((atual / p.meta_valor) * 100)}% (${atual.toFixed(2)} de ${p.meta_valor.toFixed(2)})`
  })
  const abertas = b.decisoes.filter((d) => d.status === 'aberta').map((d) => `- ${d.titulo} (prazo ${d.prazo})`)
  const v = versiculoDoDia('família')
  return [
    `# Reunião da Família — ${comp}`,
    '', '## 1. Como fechou o mês',
    `- Entrou: R$ ${r.entrou.toFixed(2)} · Saiu: R$ ${r.saiu.toFixed(2)} · Sobrou: R$ ${r.sobrou.toFixed(2)} ${r.sobrou >= 0 ? '✅' : '⚠️'}`,
    `- Mês anterior sobrou: R$ ${ant.sobrou.toFixed(2)}`,
    '', '## 2. O que estourou', ...(estouradas.length ? estouradas : ['- Nada estourou. Glória a Deus!']),
    '', '## 3. Contas que subiram', ...(subiram.length ? (subiram as string[]) : ['- Nenhuma conta subiu mais de 20%.']),
    '', '## 4. Situação dos sonhos', ...sonhos,
    '', '## 5. Decisões abertas', ...(abertas.length ? abertas : ['- Nenhuma.']),
    '', '## 6. Para refletir', `> "${v.texto}" — ${v.referencia}`,
    '', '## 7. O que decidimos', '_(preencher)_', '', '## 8. Motivo de oração e gratidão', '_(preencher)_',
  ].join('\n')
}

// ---------- Despachante ----------

export async function chamarMock(corpo: Record<string, unknown>): Promise<RespostaApi> {
  const b = await carregar()
  const acao = String(corpo.acao)
  const uid = String(corpo.usuario_id || '')
  const p = corpo as Record<string, any>
  const eu = b.usuarios.find((u) => u.id === uid)

  // Pequeno atraso para parecer rede (e testar estados de carregamento).
  await new Promise((r) => setTimeout(r, 120))

  try {
    switch (acao) {
      case 'ping':
        return ok({ versao: 'demo', nome_familia: b.config.nome_familia })

      case 'entrar_convite': {
        const u: Usuario = { id: gerarId('u'), nome: p.apelido, apelido: p.apelido, avatar: p.avatar || '🙂', cor: p.cor || '#5B5BE0', perfil: p.perfil || 'Adulto', ativo: true, criado_em: agoraIso(), ultimo_acesso: agoraIso(), token: gerarId('tok') }
        b.usuarios.push(u)
        await persistir()
        return ok(u)
      }
      case 'entrar_pin': {
        const u = b.usuarios.find((x) => x.id === p.usuario_id)
        if (!u) return erro('Usuário não encontrado')
        if (p.pin && String(p.pin).length !== 4) return erro('PIN incorreto')
        return ok({ ...u, token: u.token || gerarId('tok') })
      }
      case 'bootstrap': {
        if (!eu) return erro('Sessão expirada')
        const pend = b.caixa_entrada.filter((c) => c.status === 'pendente' && (eu.perfil !== 'Júnior' || c.usuario_id === uid)).length
        const boot: Bootstrap = {
          config: b.config, usuario: eu,
          usuarios: b.usuarios.map((u) => ({ ...u, token: eu.perfil === 'Administrador' || u.id === uid ? u.token : undefined })),
          grupos: b.grupos, categorias: b.categorias.filter((c) => c.ativa && (eu.perfil !== 'Júnior' || !c.sensivel || b.config.junior_ve_salarios)),
          cartoes: b.cartoes, contas_fixas: b.contas_fixas,
          projetos: b.projetos.map((pr) => ({ ...pr, valor_atual: valorAtual(b, pr) })),
          versiculo_do_dia: versiculoDoDia(), pendentes_caixa: pend,
        }
        return ok(boot)
      }
      case 'resumo_mes':
        return ok(resumoMes(b, uid, String(p.competencia || competenciaDe())))

      case 'listar_lancamentos': {
        let ls = filtrarSensivel(b, uid, ativos(b.lancamentos))
        if (eu?.perfil === 'Júnior') ls = ls.filter((l) => l.usuario_id === uid || l.categoria_id === 'c_aporte_sonho')
        if (p.competencia) ls = ls.filter((l) => l.competencia === p.competencia)
        if (p.categoria_id) ls = ls.filter((l) => l.categoria_id === p.categoria_id)
        if (p.grupo_id) {
          const ids = new Set(b.categorias.filter((c) => c.grupo_id === p.grupo_id).map((c) => c.id))
          ls = ls.filter((l) => ids.has(l.categoria_id))
        }
        if (p.usuario_id_filtro) ls = ls.filter((l) => l.usuario_id === p.usuario_id_filtro)
        if (p.status) ls = ls.filter((l) => l.status === p.status)
        return ok([...ls].sort((a, c) => (a.data < c.data ? 1 : a.data > c.data ? -1 : 0)))
      }
      case 'salvar_lancamento': {
        const l = p.lancamento as Lancamento
        const novo: Lancamento = {
          ...l, id: l.id || gerarId('l'), competencia: l.competencia || competenciaDe(l.data), usuario_id: l.usuario_id || uid,
          status: l.status || 'confirmado', criado_em: l.criado_em || agoraIso(), editado_por: l.id ? uid : undefined,
          hash_dedup: l.hash_dedup || hashDedup(l.valor, l.data, b.cartoes.find((k) => k.id === l.cartao_id)?.final || '', l.estabelecimento || l.descricao || ''),
        }
        const parcelas = Number(p.parcelas || 0)
        let criados: Lancamento[]
        if (parcelas > 1 && !l.id) criados = distribuirParcelas(b, novo, parcelas)
        else criados = [novo]
        for (const c of criados) {
          const idx = b.lancamentos.findIndex((x) => x.id === c.id)
          if (idx >= 0) b.lancamentos[idx] = c
          else b.lancamentos.push(c)
          if (c.projeto_id && !l.id) b.aportes.push({ id: gerarId('a'), projeto_id: c.projeto_id, data: c.data, valor: c.valor, usuario_id: c.usuario_id, observacao: c.descricao })
        }
        registrarLog(b, uid, l.id ? 'editar_lancamento' : 'novo_lancamento', `${novo.descricao} R$ ${novo.valor}`)
        await persistir()
        return ok(criados)
      }
      case 'excluir_lancamento': {
        const l = b.lancamentos.find((x) => x.id === p.id)
        if (!l) return erro('Lançamento não encontrado')
        if (eu?.perfil === 'Júnior' && l.usuario_id !== uid) return erro('Sem permissão')
        l.excluido = true
        l.editado_por = uid
        registrarLog(b, uid, 'excluir_lancamento', `${l.descricao} R$ ${l.valor}`)
        await persistir()
        return ok({ id: l.id })
      }
      case 'desfazer_exclusao': {
        const l = b.lancamentos.find((x) => x.id === p.id)
        if (!l) return erro('Lançamento não encontrado')
        l.excluido = false
        await persistir()
        return ok(l)
      }
      case 'painel':
        if (eu?.perfil === 'Júnior') return erro('Sem permissão')
        return ok(painel(b, uid, Number(p.ano || new Date().getFullYear()), p.usuario_id_filtro))

      case 'listar_categorias':
        return ok(b.categorias)
      case 'salvar_categoria': {
        const c = p.categoria as Categoria
        const novo = { ...c, id: c.id || gerarId('c'), ativa: c.ativa ?? true }
        const i = b.categorias.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.categorias[i] = novo
        else b.categorias.push(novo)
        await persistir()
        return ok(novo)
      }
      case 'salvar_grupo': {
        const g = p.grupo as Grupo
        const novo = { ...g, id: g.id || gerarId('g') }
        const i = b.grupos.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.grupos[i] = novo
        else b.grupos.push(novo)
        await persistir()
        return ok(novo)
      }
      case 'listar_orcamento':
        return ok(b.orcamento.filter((o) => o.competencia === p.competencia))
      case 'salvar_orcamento': {
        const itens = p.itens as Orcamento[]
        b.orcamento = b.orcamento.filter((o) => o.competencia !== p.competencia).concat(itens.map((i) => ({ ...i, competencia: p.competencia })))
        await persistir()
        return ok(itens)
      }
      case 'copiar_orcamento': {
        const de = b.orcamento.filter((o) => o.competencia === p.de).map((o) => ({ ...o, competencia: p.para }))
        b.orcamento = b.orcamento.filter((o) => o.competencia !== p.para).concat(de)
        await persistir()
        return ok(de)
      }

      case 'ler_imagem': {
        // No modo demonstração não há Claude: devolvemos uma leitura de exemplo
        // plausível conforme o tipo, para o fluxo de confirmação funcionar.
        const tipo = p.tipo as string
        let leitura: LeituraExtraida
        if (tipo === 'conta') {
          leitura = { empresa: 'Copel Distribuição', competencia: competenciaDe(), vencimento: somarMeses(competenciaDe(), 0) + '-10', valor: 312.47, linha_digitavel: '83640000003 1 12470138000 0 00000012345 6 78901234567 8', consumo_valor: 328, consumo_unidade: 'kWh', conta_fixa_id: 'f_luz', categoria_id: 'c_luz', confianca: 0.92, origem_leitura: 'claude', anexo_url: '' }
        } else if (tipo === 'fatura_cartao') {
          const existentes = new Set(ativos(b.lancamentos).map((l) => l.hash_dedup))
          const compras = [
            { data: hojeIso(), estabelecimento: 'CONDOR SUPER CENTER', valor: 312.5 },
            { data: hojeIso(), estabelecimento: 'NETFLIX.COM', valor: 55.9 },
            { data: hojeIso(), estabelecimento: 'POSTO SHELL', valor: 210 },
            { data: hojeIso(), estabelecimento: 'LOJA DE DEPARTAMENTOS', valor: 189.9, parcela: '1/3' },
          ].map((c) => ({ ...c, ja_lancada: existentes.has(hashDedup(c.valor, c.data, '4321', c.estabelecimento)) }))
          leitura = { compras, confianca: 0.9, origem_leitura: 'claude', anexo_url: '' }
        } else {
          leitura = { valor: 87.4, data: hojeIso(), estabelecimento: 'Padaria Pão Quente', cnpj: '12.345.678/0001-90', forma_pgto: 'débito', categoria_id: 'c_padaria', itens: [{ nome: 'Pão francês 1kg', valor: 18.9 }, { nome: 'Leite integral 2un', valor: 11.8 }, { nome: 'Bolo de fubá', valor: 24.7 }, { nome: 'Café 500g', valor: 32 }], confianca: 0.88, origem_leitura: 'claude', anexo_url: '' }
        }
        return ok(leitura)
      }
      case 'ler_texto': {
        const extraido = extrairDeTexto(String(p.texto || ''), b.categorias)
        return ok(extraido)
      }
      case 'consultar_nfce':
        return ok({ valor: 87.4, data: hojeIso(), estabelecimento: 'Padaria Pão Quente', cnpj: '12.345.678/0001-90', categoria_id: 'c_padaria', confianca: 0.99, origem_leitura: 'nfce' } satisfies LeituraExtraida)

      case 'listar_contas_fixas':
        return ok(b.contas_fixas)
      case 'salvar_conta_fixa': {
        const c = p.conta_fixa as ContaFixa
        const novo = { ...c, id: c.id || gerarId('f') }
        const i = b.contas_fixas.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.contas_fixas[i] = novo
        else b.contas_fixas.push(novo)
        await persistir()
        return ok(novo)
      }
      case 'listar_contas_a_pagar': {
        let cs = b.contas_a_pagar
        if (p.competencia) cs = cs.filter((c) => c.competencia === p.competencia)
        if (p.status) cs = cs.filter((c) => c.status === p.status)
        return ok([...cs].sort((a, c) => (a.vencimento < c.vencimento ? -1 : 1)))
      }
      case 'salvar_conta_a_pagar': {
        const c = p.conta as ContaAPagar
        const novo = { ...c, id: c.id || gerarId('cp'), status: c.status || 'aberta' }
        const i = b.contas_a_pagar.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.contas_a_pagar[i] = novo
        else b.contas_a_pagar.push(novo)
        await persistir()
        return ok(novo)
      }
      case 'marcar_conta_paga': {
        const c = b.contas_a_pagar.find((x) => x.id === p.id)
        if (!c) return erro('Conta não encontrada')
        const cf = b.contas_fixas.find((f) => f.id === c.conta_fixa_id)
        c.status = 'paga'
        c.pago_em = hojeIso()
        c.pago_por = uid
        // remove o previsto e cria o real
        b.lancamentos = b.lancamentos.filter((l) => !(l.status === 'a_confirmar' && l.competencia === c.competencia && l.categoria_id === cf?.categoria_id))
        const l: Lancamento = { id: gerarId('l'), data: hojeIso(), competencia: c.competencia, tipo: 'despesa', valor: c.valor, categoria_id: cf?.categoria_id || 'c_imprevistos', descricao: cf?.nome || 'Conta', estabelecimento: cf?.nome || '', forma_pgto: (p.forma_pgto as FormaPgto) || 'boleto', usuario_id: uid, origem: 'fatura', status: 'confirmado', criado_em: agoraIso(), anexo_url: c.anexo_url }
        b.lancamentos.push(l)
        c.lancamento_id = l.id
        registrarLog(b, uid, 'pagar_conta', `${cf?.nome} R$ ${c.valor}`)
        await persistir()
        return ok(c)
      }
      case 'consumo_historico':
        return ok(b.contas_a_pagar.filter((c) => c.conta_fixa_id === p.conta_fixa_id).sort((a, c) => (a.competencia < c.competencia ? -1 : 1)).map((c) => ({ competencia: c.competencia, consumo_valor: c.consumo_valor ?? 0, consumo_unidade: c.consumo_unidade ?? '', valor: c.valor })))

      case 'listar_cartoes':
        return ok(b.cartoes)
      case 'salvar_cartao': {
        const k = p.cartao as Cartao
        const novo = { ...k, id: k.id || gerarId('k'), final: String(k.final).slice(-4), ativo: k.ativo ?? true }
        const i = b.cartoes.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.cartoes[i] = novo
        else b.cartoes.push(novo)
        await persistir()
        return ok(novo)
      }

      case 'listar_caixa_entrada': {
        let cs = b.caixa_entrada
        if (eu?.perfil === 'Júnior') cs = cs.filter((c) => c.usuario_id === uid)
        if (p.status) cs = cs.filter((c) => c.status === p.status)
        return ok(cs)
      }
      case 'resolver_caixa_entrada': {
        const c = b.caixa_entrada.find((x) => x.id === p.id)
        if (!c) return erro('Item não encontrado')
        if (p.acao_caixa === 'ignorar') {
          c.status = 'ignorado'
        } else {
          const cartao = b.cartoes.find((k) => k.final === c.final_cartao)
          const l: Lancamento = { id: gerarId('l'), data: c.data_compra, competencia: competenciaDe(c.data_compra), tipo: 'despesa', valor: c.valor, categoria_id: p.categoria_id || c.sugestao_categoria, descricao: p.descricao || c.estabelecimento, estabelecimento: c.estabelecimento, forma_pgto: 'crédito', cartao_id: cartao?.id, usuario_id: c.usuario_id, origem: c.canal === 'email' ? 'email' : c.canal === 'fatura' ? 'fatura' : 'sms', status: 'confirmado', criado_em: agoraIso(), hash_dedup: hashDedup(c.valor, c.data_compra, c.final_cartao, c.estabelecimento) }
          b.lancamentos.push(l)
          c.status = 'lançado'
          c.lancamento_id = l.id
        }
        await persistir()
        return ok(c)
      }
      case 'importar_fatura': {
        const existentes = ativos(b.lancamentos)
        const cartao = b.cartoes.find((k) => k.id === p.cartao_id)
        const texto = String(p.texto || '')
        // CSV/OFX simples: data;estabelecimento;valor por linha. Sem texto = exemplo.
        const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        const compras = (linhas.length ? linhas.map((ln) => { const [data, est, val] = ln.split(/[;,\t]/); return { data: data?.includes('/') ? data.split('/').reverse().join('-') : data, estabelecimento: est || '', valor: Number(String(val).replace(',', '.')) || 0 } }) : [
          { data: hojeIso(), estabelecimento: 'CONDOR SUPER CENTER', valor: 312.5 },
          { data: hojeIso(), estabelecimento: 'NETFLIX.COM', valor: 55.9 },
          { data: somarMeses(competenciaDe(), 0) + '-03', estabelecimento: 'VIVO', valor: 149.9 },
        ]).map((c) => {
          // tolerância de ±2 dias e mesmo valor
          const d = new Date(c.data).getTime()
          const ja = existentes.some((l) => Math.abs(l.valor - c.valor) < 0.005 && Math.abs(new Date(l.data).getTime() - d) <= 2 * 86_400_000 && (normalizar(l.estabelecimento).split(' ')[0] === normalizar(c.estabelecimento).split(' ')[0] || l.cartao_id === cartao?.id))
          return { ...c, ja_lancada: ja }
        })
        return ok({ compras, confianca: 0.9, origem_leitura: 'regex' } satisfies LeituraExtraida)
      }
      case 'confirmar_importacao': {
        const cartao = b.cartoes.find((k) => k.id === p.cartao_id)
        const criados: ItemCaixaEntrada[] = []
        for (const c of p.compras as Array<{ data: string; estabelecimento: string; valor: number }>) {
          const sug = sugerirCategoria(c.estabelecimento, b.categorias)
          const item: ItemCaixaEntrada = { id: gerarId('ce'), recebido_em: agoraIso(), canal: 'fatura', texto_bruto: `${c.data} ${c.estabelecimento} ${c.valor}`, valor: c.valor, estabelecimento: c.estabelecimento, final_cartao: cartao?.final || '', data_compra: c.data, sugestao_categoria: sug[0] || 'c_imprevistos', sugestoes: sug, usuario_id: cartao?.titular_id || uid, status: 'pendente' }
          b.caixa_entrada.push(item)
          criados.push(item)
        }
        await persistir()
        return ok(criados)
      }

      case 'listar_projetos':
        return ok(b.projetos.map((pr) => ({ ...pr, valor_atual: valorAtual(b, pr) })))
      case 'salvar_projeto': {
        const pr = p.projeto as Projeto
        const novo: Projeto = { ...pr, id: pr.id || gerarId('p'), criado_por: pr.criado_por || uid, criado_em: pr.criado_em || agoraIso(), status: pr.status || 'ativo' }
        const i = b.projetos.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.projetos[i] = novo
        else b.projetos.push(novo)
        await persistir()
        return ok({ ...novo, valor_atual: valorAtual(b, novo) })
      }
      case 'aportar': {
        const a: Aporte = { id: gerarId('a'), projeto_id: p.projeto_id, data: hojeIso(), valor: Number(p.valor), usuario_id: uid, observacao: p.observacao || '' }
        b.aportes.push(a)
        const pr = b.projetos.find((x) => x.id === a.projeto_id)
        b.lancamentos.push({ id: gerarId('l'), data: a.data, competencia: competenciaDe(), tipo: 'despesa', valor: a.valor, categoria_id: 'c_aporte_sonho', descricao: `Aporte: ${pr?.nome ?? ''}`, estabelecimento: 'Poupança', forma_pgto: 'pix', usuario_id: uid, origem: 'manual', status: 'confirmado', criado_em: agoraIso(), projeto_id: a.projeto_id })
        if (pr && valorAtual(b, pr) >= pr.meta_valor) pr.status = 'concluído'
        registrarLog(b, uid, 'aporte', `${pr?.nome} R$ ${a.valor}`)
        await persistir()
        return ok(a)
      }
      case 'listar_aportes':
        return ok(b.aportes.filter((a) => a.projeto_id === p.projeto_id).sort((a, c) => (a.data < c.data ? 1 : -1)))

      case 'listar_decisoes': {
        let ds = b.decisoes
        if (p.status) ds = ds.filter((d) => d.status === p.status)
        return ok(ds.map((d) => ({ ...d, votos: b.votos.filter((v) => v.decisao_id === d.id) })))
      }
      case 'salvar_decisao': {
        const d = p.decisao as Decisao
        const novo: Decisao = { ...d, id: d.id || gerarId('d'), criado_por: d.criado_por || uid, criado_em: d.criado_em || agoraIso(), status: d.status || 'aberta' }
        const i = b.decisoes.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.decisoes[i] = novo
        else b.decisoes.push(novo)
        await persistir()
        return ok({ ...novo, votos: b.votos.filter((v) => v.decisao_id === novo.id) })
      }
      case 'votar': {
        const d = b.decisoes.find((x) => x.id === p.decisao_id)
        if (!d) return erro('Decisão não encontrada')
        if (d.status !== 'aberta') return erro('Esta votação já foi encerrada')
        b.votos = b.votos.filter((v) => !(v.decisao_id === d.id && v.usuario_id === uid))
        b.votos.push({ decisao_id: d.id, usuario_id: uid, voto: p.voto, comentario: p.comentario || '', data: agoraIso() })
        await persistir()
        return ok({ ...d, votos: b.votos.filter((v) => v.decisao_id === d.id) })
      }
      case 'encerrar_decisao': {
        const d = b.decisoes.find((x) => x.id === p.decisao_id)
        if (!d) return erro('Decisão não encontrada')
        const vs = b.votos.filter((v) => v.decisao_id === d.id)
        const sim = vs.filter((v) => v.voto === 'sim').length
        const nao = vs.filter((v) => v.voto === 'não').length
        let aprovada = sim > nao
        if (b.config.regra_votacao === 'maioria_mais_pais') {
          const pais = b.usuarios.filter((u) => u.perfil === 'Administrador').map((u) => u.id)
          const paisContra = vs.some((v) => pais.includes(v.usuario_id) && v.voto === 'não')
          aprovada = aprovada && !paisContra
        }
        d.status = aprovada ? 'aprovada' : 'recusada'
        if (d.projeto_id) {
          const pr = b.projetos.find((x) => x.id === d.projeto_id)
          if (pr) pr.status = aprovada ? 'ativo' : 'pausado'
        }
        await persistir()
        return ok({ ...d, votos: vs })
      }
      case 'pauta_reuniao': {
        const comp = String(p.competencia || competenciaDe())
        const existente = b.reunioes.find((r) => r.competencia === comp)
        if (existente) return ok(existente)
        const r: Reuniao = { id: gerarId('r'), competencia: comp, data: hojeIso(), pauta: gerarPauta(b, uid, comp), decidido: '', oracao_gratidao: '', criado_por: uid }
        return ok(r)
      }
      case 'salvar_reuniao': {
        const r = p.reuniao as Reuniao
        const novo = { ...r, id: r.id || gerarId('r') }
        const i = b.reunioes.findIndex((x) => x.id === novo.id || x.competencia === novo.competencia)
        if (i >= 0) b.reunioes[i] = novo
        else b.reunioes.push(novo)
        await persistir()
        return ok(novo)
      }

      case 'listar_usuarios':
        return ok(b.usuarios.map((u) => ({ ...u, token: eu?.perfil === 'Administrador' ? u.token : undefined })))
      case 'salvar_usuario': {
        const u = p.usuario as Usuario
        const novo = { ...u, id: u.id || gerarId('u'), criado_em: u.criado_em || agoraIso(), ultimo_acesso: u.ultimo_acesso || agoraIso(), token: u.token || gerarId('tok') }
        const i = b.usuarios.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.usuarios[i] = { ...b.usuarios[i], ...novo, token: b.usuarios[i].token }
        else b.usuarios.push(novo)
        await persistir()
        return ok(novo)
      }
      case 'gerar_convite': {
        const codigo = Math.random().toString(36).slice(2, 8).toUpperCase()
        const url = `${location.origin}${location.pathname}#/entrar?convite=${codigo}&perfil=${encodeURIComponent(p.perfil || 'Adulto')}&demo=1`
        return ok({ codigo_convite: codigo, url, expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      }
      case 'renovar_token': {
        const u = b.usuarios.find((x) => x.id === (p.usuario_id || uid))
        if (!u) return erro('Usuário não encontrado')
        u.token = gerarId('tok')
        await persistir()
        return ok({ token: u.token })
      }
      case 'redefinir_pin':
        return ok({ ok: true })
      case 'salvar_config':
        b.config = { ...b.config, ...(p.config as Partial<Config>) }
        await persistir()
        return ok(b.config)
      case 'enviar_arquivo': {
        // Guardamos como data URL local no modo demonstração.
        const url = `data:${p.mime};base64,${p.imagem_base64}`
        return ok({ url, id: gerarId('arq') })
      }
      case 'salvar_brasao_svg': {
        const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(String(p.svg))))}`
        b.config.url_brasao = url
        await persistir()
        return ok({ url_brasao: url, url_icone_192: url, url_icone_512: url })
      }
      case 'versiculo_do_dia':
        return ok(versiculoDoDia(p.tema))
      case 'mesada': {
        const alvo = b.usuarios.find((u) => u.id === (p.usuario_id || uid))
        const comp = String(p.competencia || competenciaDe())
        const gasto = ativos(b.lancamentos).filter((l) => l.usuario_id === alvo?.id && l.competencia === comp && l.tipo === 'despesa' && l.categoria_id !== 'c_aporte_sonho').reduce((s, l) => s + l.valor, 0)
        const cofrinho = b.aportes.filter((a) => a.usuario_id === alvo?.id).reduce((s, a) => s + a.valor, 0)
        return ok({ mesada_mensal: alvo?.mesada_mensal ?? 0, gasto, saldo: (alvo?.mesada_mensal ?? 0) - gasto, cofrinho })
      }
      case 'exportar': {
        const ls = ativos(b.lancamentos).filter((l) => !p.competencia || l.competencia === p.competencia)
        const catMap = new Map(b.categorias.map((c) => [c.id, c.nome]))
        const linhas = ['data;tipo;valor;categoria;descricao;estabelecimento;forma_pgto;quem;origem', ...ls.map((l) => [l.data, l.tipo, l.valor.toFixed(2).replace('.', ','), catMap.get(l.categoria_id) ?? '', l.descricao, l.estabelecimento, l.forma_pgto, b.usuarios.find((u) => u.id === l.usuario_id)?.apelido ?? '', l.origem].join(';'))]
        const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
        return ok({ url: URL.createObjectURL(blob) })
      }
      case 'backup_agora':
        return ok({ url: b.config.url_pasta_drive || '#' })
      case 'registrar_push':
        return ok({ ok: true })
      case 'log':
        return ok(b.log.slice(0, Number(p.limite || 100)))
      case 'reiniciar_demo':
        await reiniciarDemo()
        return ok({ ok: true })
      default:
        return erro(`Ação desconhecida no modo demonstração: ${acao}`)
    }
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Erro inesperado')
  }
}
