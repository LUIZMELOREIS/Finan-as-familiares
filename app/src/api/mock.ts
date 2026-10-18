/**
 * MODO DEMONSTRAÇÃO — implementa as mesmas ações da API (docs/API.md) em cima
 * de dados locais (IndexedDB), com 12 meses de exemplo coerentes com a
 * referência visual (Família Reis: Luiz, Nina e dois dependentes).
 */
import { get, set } from 'idb-keyval'
import dadosBase from '../../../dados/grupos_categorias.json'
import versiculosBase from '../../../dados/versiculos.json'
import type {
  Alerta, Aporte, Aviso, Bootstrap, Cartao, Categoria, Config, ContaAPagar, ContaFixa, DadosPainel, Decisao, Grupo,
  ItemCaixaEntrada, Lancamento, LeituraExtraida, MensagemAssistente, Orcamento, Patrimonio, Projeto, RegraLoja, Reuniao,
  RespostaApi, ResumoMes, SaidaPrevista, Tipo, Usuario, Versiculo, VotoRegistro, FormaPgto,
} from '../tipos'
import { agoraIso, competenciaDe, gerarId, hashDedup, hojeIso, moeda, nomeCompetencia, normalizar, somarMeses, MESES } from '../util/formato'
import { extrairDeTexto, sugerirCategoria } from '../util/extrator'

interface Banco {
  config: Config
  usuarios: Usuario[]
  tipos: Tipo[]
  grupos: Grupo[]
  categorias: Categoria[]
  regras_loja: RegraLoja[]
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
  alertas: Alerta[]
  avisos: Aviso[]
  patrimonio: Patrimonio[]
  conversas: MensagemAssistente[]
  log: Array<{ data: string; usuario_id: string; acao: string; detalhe: string }>
}

const CHAVE = 'ff_mock_banco_v2b'
let cache: Banco | null = null

// ---------- Gerador de dados de exemplo (12 meses) ----------

function criarAleatorio(semente: number) {
  let s = semente
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

export function gerarBancoExemplo(): Banco {
  const rnd = criarAleatorio(2026)
  const entre = (a: number, b: number) => Math.round((a + rnd() * (b - a)) * 100) / 100
  const escolher = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]

  const usuarios: Usuario[] = [
    { id: 'u_luiz', nome: 'Luiz Reis', apelido: 'Luiz', avatar: '', cor: 'indigo', perfil: 'Administrador', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), token: 'tok_pai_demo' },
    { id: 'u_nina', nome: 'Nina Reis', apelido: 'Nina', avatar: '', cor: 'magenta', perfil: 'Administrador', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), token: 'tok_mae_demo' },
    { id: 'u_julia', nome: 'Júlia Reis', apelido: 'Júlia', avatar: '', cor: 'gold', perfil: 'Dependente', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), mesada_mensal: 150, token: 'tok_ju_demo' },
    { id: 'u_pedro', nome: 'Pedro Reis', apelido: 'Pedro', avatar: '', cor: 'green', perfil: 'Dependente', ativo: true, criado_em: '2025-01-01', ultimo_acesso: agoraIso(), mesada_mensal: 100, token: 'tok_pedro_demo' },
  ]

  const tipos = dadosBase.tipos as Tipo[]
  const grupos = (dadosBase.grupos as Grupo[]).map((g) => ({ ...g, ativo: true }))
  const categorias = dadosBase.categorias as Categoria[]

  const cartoes: Cartao[] = [
    { id: 'k_itau_luiz', apelido: 'Itaú', banco: 'Itaú', final: '4821', titular_id: 'u_luiz', dia_fechamento: 28, dia_vencimento: 5, cor: 'orange', ativo: true },
    { id: 'k_nu_nina', apelido: 'Nubank', banco: 'Nubank', final: '0937', titular_id: 'u_nina', dia_fechamento: 20, dia_vencimento: 1, cor: 'magenta', ativo: true },
  ]

  const contas_fixas: ContaFixa[] = [
    { id: 'f_luz', nome: 'Luz — Copel', categoria_id: 'c_luz', valor_previsto: 412, dia_vencimento: 20, remetente_email: 'copel.com', codigo_cliente: '12345678', ativa: true },
    { id: 'f_agua', nome: 'Água — Sanepar', categoria_id: 'c_agua', valor_previsto: 168, dia_vencimento: 2, remetente_email: 'sanepar.com.br', codigo_cliente: '987654', ativa: true },
    { id: 'f_gas', nome: 'Gás — Compagas', categoria_id: 'c_gas', valor_previsto: 72, dia_vencimento: 12, remetente_email: 'compagas.com.br', codigo_cliente: '55443', ativa: true },
    { id: 'f_internet', nome: 'Internet', categoria_id: 'c_internet', valor_previsto: 139, dia_vencimento: 8, remetente_email: 'vivo.com.br', codigo_cliente: '', ativa: true },
    { id: 'f_celular', nome: 'Celulares', categoria_id: 'c_telefone', valor_previsto: 189, dia_vencimento: 3, remetente_email: 'claro.com.br', codigo_cliente: '', ativa: true },
    { id: 'f_plano', nome: 'Plano de saúde', categoria_id: 'c_plano_saude', valor_previsto: 2120, dia_vencimento: 25, remetente_email: 'unimed.coop.br', codigo_cliente: '', ativa: true },
    { id: 'f_faculdade', nome: 'Faculdade', categoria_id: 'c_escola', valor_previsto: 1480, dia_vencimento: 5, remetente_email: '', codigo_cliente: '', ativa: true },
    { id: 'f_prestacao', nome: 'Prestação da casa', categoria_id: 'c_prestacao_casa', valor_previsto: 2450, dia_vencimento: 10, remetente_email: '', codigo_cliente: '', ativa: true },
    { id: 'f_condominio', nome: 'Condomínio', categoria_id: 'c_condominio', valor_previsto: 610, dia_vencimento: 10, remetente_email: '', codigo_cliente: '', ativa: true },
  ]

  const lancamentos: Lancamento[] = []
  const contas_a_pagar: ContaAPagar[] = []
  const orcamento: Orcamento[] = []
  const hoje = hojeIso()
  const compAtual = competenciaDe()
  const lojas: Record<string, string[]> = {
    c_mercado: ['Supermercado Condor', 'Muffato', 'Festval', 'Atacadão'],
    c_feira: ['Feira do Batel', 'Hortifruti Boa Safra'],
    c_padaria: ['Padaria Pão Quente', 'Panificadora Imperial'],
    c_acougue: ['Casa de Carnes Boi Nobre'],
    c_delivery: ['iFood', 'Pizzaria Baggio', 'Rappi'],
    c_restaurantes: ['Madero', 'Café do Mercado', 'Outback'],
    c_combustivel: ['Posto Shell', 'Posto Ipiranga'],
    c_estacionamento: ['Estapar', 'Sem Parar'],
    c_app_transporte: ['Uber', '99'],
    c_manutencao_carro: ['Auto Center Silva', 'Lava Car'],
    c_farmacia: ['Drogaria Nissei', 'Panvel'],
    c_consultas: ['Clínica Vida', 'Laboratório Frischmann'],
    c_cabelo: ['Salão da Vera', 'Barbearia do Zé'],
    c_reparos: ['Leroy Merlin', 'Balaroti'],
    c_moveis: ['Tok&Stok', 'Havan'],
    c_limpeza: ['Diarista', 'Lavanderia Lavô'],
    c_passeios: ['Cinemark', 'Teatro Guaíra', 'Parque Barigui'],
    c_viagens: ['Pousada Serra Verde'],
    c_hobbies: ['Smart Fit', 'Livraria Curitiba'],
    c_roupas: ['Renner', 'Riachuelo', 'Centauro'],
    c_presentes: ['Floricultura Flores & Cia'],
    c_pet: ['Petz', 'Cobasi'],
    c_imprevistos: ['Cartório', 'Detran'],
  }

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
    add({ data: dia(5), tipo: 'receita', valor: mes === 12 ? 13500 : 9000, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'u_luiz', origem: 'recorrente' })
    add({ data: dia(5), tipo: 'receita', valor: mes === 12 ? 9450 : 6300, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'u_nina', origem: 'recorrente' })
    add({ data: dia(18), tipo: 'receita', valor: entre(700, 1600), categoria_id: 'c_renda_extra', descricao: 'Consultoria', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'u_luiz', origem: 'manual' })
    if (rnd() > 0.6) add({ data: dia(22), tipo: 'receita', valor: entre(100, 400), categoria_id: 'c_rendimentos', descricao: 'Rendimento CDB', estabelecimento: 'Banco', forma_pgto: 'pix', usuario_id: 'u_nina', origem: 'manual' })
    add({ data: dia(1), tipo: 'receita', valor: 150, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'u_julia', origem: 'recorrente' })
    add({ data: dia(1), tipo: 'receita', valor: 100, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'u_pedro', origem: 'recorrente' })

    // Dízimo e ofertas
    add({ data: dia(7), tipo: 'despesa', valor: 1530, categoria_id: 'c_dizimo', descricao: 'Dízimo', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'u_luiz', origem: 'recorrente' })
    add({ data: dia(14), tipo: 'despesa', valor: entre(60, 120), categoria_id: 'c_ofertas', descricao: 'Oferta', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'u_nina', origem: 'manual' })
    add({ data: dia(21), tipo: 'despesa', valor: 50, categoria_id: 'c_missoes', descricao: 'Missões', estabelecimento: 'Agência Missionária', forma_pgto: 'pix', usuario_id: 'u_luiz', origem: 'manual' })

    // Contas fixas (com fatura em ContasAPagar)
    for (const cf of contas_fixas) {
      let valor = cf.valor_previsto
      let consumo: number | undefined
      let unidade: string | undefined
      if (cf.id === 'f_luz') { valor = Math.round(cf.valor_previsto * (1 + 0.3 * Math.cos(((mes - 1) / 12) * 2 * Math.PI)) * (0.95 + rnd() * 0.1) * 100) / 100; consumo = Math.round(valor / 0.98); unidade = 'kWh' }
      else if (cf.id === 'f_agua') { valor = entre(150, 190); consumo = Math.round(valor / 9); unidade = 'm³' }
      else if (cf.id === 'f_gas') { valor = entre(60, 85); consumo = Math.round(valor / 7); unidade = 'm³' }
      const venc = `${comp}-${String(cf.dia_vencimento).padStart(2, '0')}`
      const paga = venc < hoje
      const conta: ContaAPagar = {
        id: gerarId('cp'), conta_fixa_id: cf.id, competencia: comp, valor, vencimento: venc,
        linha_digitavel: '83640000001 2 21440138000 0 00000012345 6 78901234567 8',
        pix_copia_cola: '00020126580014br.gov.bcb.pix0136demo-chave-pix-familia5204000053039865406' + valor.toFixed(2) + '5802BR5913FAMILIA REIS6008CURITIBA62070503***6304ABCD',
        consumo: consumo ? `${consumo} ${unidade}` : undefined, consumo_valor: consumo, consumo_unidade: unidade,
        status: paga ? 'paga' : 'aberta', pago_em: paga ? venc : undefined, pago_por: paga ? 'u_luiz' : undefined,
      }
      contas_a_pagar.push(conta)
      if (paga) {
        const l: Lancamento = { id: gerarId('l'), data: venc, competencia: comp, tipo: 'despesa', valor, categoria_id: cf.categoria_id, descricao: cf.nome, estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'u_luiz', origem: 'email', status: 'confirmado', criado_em: `${venc}T09:00:00` }
        lancamentos.push(l)
        conta.lancamento_id = l.id
      } else if (ehAtual) {
        lancamentos.push({ id: gerarId('l'), data: venc, competencia: comp, tipo: 'despesa', valor: cf.valor_previsto, categoria_id: cf.categoria_id, descricao: `${cf.nome} (previsto)`, estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'u_luiz', origem: 'recorrente', status: 'a_confirmar', criado_em: `${comp}-01T09:00:00` })
      }
    }
    add({ data: dia(10), tipo: 'despesa', valor: 140, categoria_id: 'c_iptu', descricao: 'IPTU (parcela)', estabelecimento: 'Prefeitura de Curitiba', forma_pgto: 'boleto', usuario_id: 'u_luiz', origem: 'recorrente' })
    add({ data: dia(15), tipo: 'despesa', valor: 310, categoria_id: 'c_seguro_carro', descricao: 'Seguro do carro', estabelecimento: 'Porto Seguro', forma_pgto: 'crédito', cartao_id: 'k_itau_luiz', usuario_id: 'u_luiz', origem: 'recorrente' })
    add({ data: dia(12), tipo: 'despesa', valor: 250, categoria_id: 'c_cursos', descricao: 'Curso de inglês', estabelecimento: 'Escola de idiomas', forma_pgto: 'boleto', usuario_id: 'u_nina', origem: 'recorrente' })
    add({ data: dia(9), tipo: 'despesa', valor: 55.9, categoria_id: 'c_streaming', descricao: 'Netflix', estabelecimento: 'NETFLIX.COM', forma_pgto: 'crédito', cartao_id: 'k_nu_nina', usuario_id: 'u_nina', origem: 'sms' })
    add({ data: dia(11), tipo: 'despesa', valor: 21.9, categoria_id: 'c_streaming', descricao: 'Spotify', estabelecimento: 'SPOTIFY', forma_pgto: 'crédito', cartao_id: 'k_nu_nina', usuario_id: 'u_nina', origem: 'sms' })
    if (i <= 1) add({ data: dia(13), tipo: 'despesa', valor: 44.9, categoria_id: 'c_streaming', descricao: 'Streaming', estabelecimento: 'DISNEY PLUS', forma_pgto: 'crédito', cartao_id: 'k_itau_luiz', usuario_id: 'u_luiz', origem: 'sms' })
    add({ data: dia(2), tipo: 'despesa', valor: 24.9, categoria_id: 'c_apps', descricao: 'iCloud', estabelecimento: 'APPLE.COM/BILL', forma_pgto: 'crédito', cartao_id: 'k_itau_luiz', usuario_id: 'u_luiz', origem: 'sms' })
    if (mes === 1) add({ data: dia(20), tipo: 'despesa', valor: 1850, categoria_id: 'c_ipva', descricao: 'IPVA', estabelecimento: 'Detran PR', forma_pgto: 'boleto', usuario_id: 'u_luiz', origem: 'manual' })

    // Variáveis
    const faixas: Record<string, [number, number, number]> = {
      c_mercado: [5, 220, 460], c_feira: [2, 40, 70], c_padaria: [8, 14, 42], c_acougue: [2, 70, 120], c_delivery: [6, 40, 95], c_restaurantes: [2, 90, 180],
      c_combustivel: [4, 160, 260], c_estacionamento: [4, 15, 50], c_app_transporte: [3, 18, 55], c_manutencao_carro: [1, 90, 300],
      c_farmacia: [3, 40, 140], c_consultas: [1, 120, 300], c_cabelo: [2, 50, 110], c_reparos: [1, 60, 260], c_moveis: [0, 100, 400], c_limpeza: [1, 60, 120],
      c_passeios: [2, 80, 220], c_viagens: [0, 300, 900], c_hobbies: [2, 60, 150], c_roupas: [1, 90, 320], c_presentes: [1, 50, 150], c_pet: [1, 70, 160], c_imprevistos: [1, 30, 120],
    }
    for (const [cat, [qtd, mn, mx]] of Object.entries(faixas)) {
      const n = Math.round(qtd * (0.7 + rnd() * 0.6) + (qtd === 0 && rnd() > 0.75 ? 1 : 0))
      for (let k = 0; k < n; k++) {
        const quem = escolher(['u_luiz', 'u_nina', 'u_nina', 'u_luiz', 'u_julia', 'u_pedro'])
        const formas: FormaPgto[] = ['crédito', 'débito', 'pix', 'dinheiro']
        const forma = quem === 'u_julia' || quem === 'u_pedro' ? 'pix' : escolher(formas)
        const cartao = forma === 'crédito' ? (quem === 'u_nina' ? 'k_nu_nina' : 'k_itau_luiz') : undefined
        const loja = escolher(lojas[cat] ?? ['Loja'])
        const valorBase = entre(mn, mx)
        const valor = quem === 'u_julia' || quem === 'u_pedro' ? Math.min(valorBase, entre(8, 40)) : valorBase
        add({ data: dia(1 + Math.floor(rnd() * ultimoDia)), tipo: 'despesa', valor, categoria_id: cat, descricao: loja, estabelecimento: loja, forma_pgto: forma, cartao_id: cartao, usuario_id: quem, origem: escolher(['manual', 'foto', 'voz', 'sms', 'manual', 'chat']) })
      }
    }
    // Delivery acima da média no mês atual (para o vigia ter o que avisar)
    if (ehAtual) for (let k = 0; k < 4; k++) add({ data: dia(2 + k * 3), tipo: 'despesa', valor: entre(45, 92), categoria_id: 'c_delivery', descricao: 'iFood', estabelecimento: 'IFOOD', forma_pgto: 'crédito', cartao_id: 'k_itau_luiz', usuario_id: 'u_luiz', origem: 'sms' })
    if (ehAtual) { add({ data: dia(14), tipo: 'despesa', valor: 64.9, categoria_id: 'c_farmacia', descricao: 'Drogaria Nissei', estabelecimento: 'DROGARIA NISSEI', forma_pgto: 'crédito', cartao_id: 'k_nu_nina', usuario_id: 'u_nina', origem: 'sms' }); add({ data: dia(14), tipo: 'despesa', valor: 64.9, categoria_id: 'c_farmacia', descricao: 'Drogaria Nissei', estabelecimento: 'DROGARIA NISSEI', forma_pgto: 'crédito', cartao_id: 'k_nu_nina', usuario_id: 'u_nina', origem: 'sms' }) }
    if (mes === 12) add({ data: dia(20), tipo: 'despesa', valor: 1200, categoria_id: 'c_presentes', descricao: 'Presentes de Natal', estabelecimento: 'Shopping', forma_pgto: 'crédito', cartao_id: 'k_nu_nina', usuario_id: 'u_nina', origem: 'manual' })
    if (mes === 7) add({ data: dia(10), tipo: 'despesa', valor: 1100, categoria_id: 'c_viagens', descricao: 'Pousada em Morretes', estabelecimento: 'Pousada Serra Verde', forma_pgto: 'crédito', cartao_id: 'k_itau_luiz', usuario_id: 'u_luiz', origem: 'manual' })

    // Compra parcelada (parcelas futuras aparecem em Próximas saídas)
    if (i === 3) for (let p = 0; p < 10; p++) lancamentos.push({ id: gerarId('l'), data: dia(16), competencia: somarMeses(comp, p), tipo: 'despesa', valor: 189.9, categoria_id: 'c_moveis', descricao: 'Sofá da sala', estabelecimento: 'Tok&Stok', forma_pgto: 'crédito', cartao_id: 'k_nu_nina', parcela: `${p + 1}/10`, usuario_id: 'u_nina', origem: 'fatura', status: p <= 3 ? 'confirmado' : 'a_confirmar', criado_em: `${dia(16)}T12:00:00`, hash_dedup: `parc_sofa_${p}` })

    // Aportes
    add({ data: dia(6), tipo: 'despesa', valor: 800, categoria_id: 'c_aporte_projeto', descricao: 'Aporte: Viagem de julho', estabelecimento: 'Poupança', forma_pgto: 'pix', usuario_id: 'u_luiz', origem: 'manual', projeto_id: 'p_viagem' })
    add({ data: dia(6), tipo: 'despesa', valor: 1000, categoria_id: 'c_aporte_projeto', descricao: 'Aporte: Reserva de emergência', estabelecimento: 'CDB', forma_pgto: 'pix', usuario_id: 'u_nina', origem: 'manual', projeto_id: 'p_reserva' })

    for (const c of categorias) if (c.orcamento_mensal) orcamento.push({ competencia: comp, categoria_id: c.id, valor_planejado: c.orcamento_mensal })
  }

  const projetos: Projeto[] = [
    { id: 'p_viagem', nome: 'Viagem de julho', icone: 'plane', foto_url: '', meta_valor: 18000, data_alvo: `${new Date().getFullYear() + 1}-06-30`, valor_inicial: 2400, prioridade: 1, status: 'ativo', versiculo: 'Lucas 14:28', criado_por: 'u_nina', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'p_reserva', nome: 'Reserva de emergência', icone: 'shield-check', foto_url: '', meta_valor: 60000, data_alvo: `${new Date().getFullYear() + 2}-12-31`, valor_inicial: 4000, prioridade: 2, status: 'ativo', versiculo: 'Provérbios 6:6-8', criado_por: 'u_luiz', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'p_carro', nome: 'Troca do carro', icone: 'car', foto_url: '', meta_valor: 45000, data_alvo: `${new Date().getFullYear() + 2}-12-01`, valor_inicial: 2800, prioridade: 3, status: 'votação', versiculo: 'Provérbios 21:5', criado_por: 'u_luiz', criado_em: hoje },
    { id: 'p_bike', nome: 'Bicicleta da Júlia', icone: 'bike', foto_url: '', meta_valor: 900, data_alvo: somarMeses(compAtual, 5) + '-01', valor_inicial: 120, prioridade: 4, status: 'ativo', versiculo: 'Provérbios 13:11', criado_por: 'u_julia', criado_em: somarMeses(compAtual, -3) + '-01' },
  ]
  const aportes: Aporte[] = lancamentos.filter((l) => l.projeto_id).map((l) => ({ id: gerarId('a'), projeto_id: l.projeto_id!, data: l.data, valor: l.valor, usuario_id: l.usuario_id, observacao: '' }))
  aportes.push({ id: gerarId('a'), projeto_id: 'p_bike', data: somarMeses(compAtual, -2) + '-10', valor: 30, usuario_id: 'u_julia', observacao: 'Guardei da mesada' })
  aportes.push({ id: gerarId('a'), projeto_id: 'p_bike', data: somarMeses(compAtual, -1) + '-12', valor: 50, usuario_id: 'u_julia', observacao: 'Vendi livros usados' })
  aportes.push({ id: gerarId('a'), projeto_id: 'p_bike', data: hoje, valor: 10, usuario_id: 'u_pedro', observacao: 'Para ajudar a Júlia' })

  const decisoes: Decisao[] = [
    { id: 'd_carro', titulo: 'Começar a guardar para trocar o carro', descricao: 'Proposta: R$ 1.800/mês a partir do mês que vem. Meta de R$ 45 mil até 2028.', tipo: 'novo projeto', valor: 45000, criado_por: 'u_luiz', criado_em: hoje, prazo: somarMeses(compAtual, 1) + '-05', status: 'aberta', projeto_id: 'p_carro' },
    { id: 'd_viagem', titulo: 'Viagem de julho', descricao: 'Uma semana no litoral de Santa Catarina em julho do ano que vem.', tipo: 'novo projeto', valor: 18000, criado_por: 'u_nina', criado_em: somarMeses(compAtual, -11) + '-08', prazo: somarMeses(compAtual, -11) + '-15', status: 'aprovada', projeto_id: 'p_viagem' },
    { id: 'd_tv', titulo: 'Comprar TV nova para a sala', descricao: 'A TV da sala parou. Orçamento de R$ 2.800 em 10x.', tipo: 'gasto grande', valor: 2800, criado_por: 'u_nina', criado_em: somarMeses(compAtual, -1) + '-20', prazo: somarMeses(compAtual, -1) + '-27', status: 'aprovada' },
  ]
  const votos: VotoRegistro[] = [
    { decisao_id: 'd_carro', usuario_id: 'u_luiz', voto: 'sim', comentario: 'O atual já tem 12 anos.', data: hoje },
    { decisao_id: 'd_carro', usuario_id: 'u_julia', voto: 'sim', comentario: 'Mas primeiro a viagem!', data: hoje },
    { decisao_id: 'd_viagem', usuario_id: 'u_luiz', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-09' },
    { decisao_id: 'd_viagem', usuario_id: 'u_nina', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-08' },
    { decisao_id: 'd_viagem', usuario_id: 'u_julia', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-09' },
    { decisao_id: 'd_viagem', usuario_id: 'u_pedro', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-10' },
    { decisao_id: 'd_tv', usuario_id: 'u_luiz', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-21' },
    { decisao_id: 'd_tv', usuario_id: 'u_nina', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-20' },
    { decisao_id: 'd_tv', usuario_id: 'u_pedro', voto: 'não', comentario: 'Prefiro um videogame', data: somarMeses(compAtual, -1) + '-22' },
  ]

  const caixa_entrada: ItemCaixaEntrada[] = [
    { id: 'ce_1', recebido_em: agoraIso(), canal: 'sms_ios', texto_bruto: 'Compra aprovada no seu Itaú final 4821: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12.', valor: 87.4, estabelecimento: 'PADARIA PAO QUENTE', final_cartao: '4821', data_compra: hoje, sugestao_categoria: 'c_padaria', sugestoes: ['c_padaria', 'c_mercado', 'c_delivery', 'c_restaurantes', 'c_feira'], usuario_id: 'u_luiz', status: 'pendente' },
    { id: 'ce_2', recebido_em: agoraIso(), canal: 'sms_android', texto_bruto: 'Nubank: Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 0937.', valor: 156.9, estabelecimento: 'DROGARIA NISSEI', final_cartao: '0937', data_compra: hoje, sugestao_categoria: 'c_farmacia', sugestoes: ['c_farmacia', 'c_cabelo', 'c_mercado', 'c_imprevistos'], usuario_id: 'u_nina', status: 'pendente' },
    { id: 'ce_3', recebido_em: agoraIso(), canal: 'email', texto_bruto: 'Alerta de compra: POSTO SHELL R$ 210,00 cartão final 4821', valor: 210, estabelecimento: 'POSTO SHELL', final_cartao: '4821', data_compra: hoje, sugestao_categoria: 'c_combustivel', sugestoes: ['c_combustivel', 'c_app_transporte', 'c_manutencao_carro', 'c_imprevistos'], usuario_id: 'u_luiz', status: 'pendente' },
    { id: 'ce_4', recebido_em: agoraIso(), canal: 'sms_ios', texto_bruto: 'Compra aprovada no seu Itaú final 4821: R$ 44,90 em DISNEY PLUS em 13/10.', valor: 44.9, estabelecimento: 'DISNEY PLUS', final_cartao: '4821', data_compra: somarMeses(compAtual, 0) + '-13', sugestao_categoria: 'c_streaming', sugestoes: ['c_streaming', 'c_apps', 'c_hobbies', 'c_passeios'], usuario_id: 'u_luiz', status: 'pendente' },
  ]

  const alertas: Alerta[] = [
    { id: 'al_1', nome: 'Delivery acima de R$ 400/mês', tipo: 'categoria_acima', categoria_id: 'c_delivery', limite: 400, avisar: ['u_luiz', 'u_nina'], ativo: true },
    { id: 'al_2', nome: 'Supermercado acima de R$ 2.000/mês', tipo: 'categoria_acima', categoria_id: 'c_mercado', limite: 2000, avisar: [], ativo: true },
    { id: 'al_3', nome: 'Nova assinatura detectada', tipo: 'nova_assinatura', limite: 0, avisar: ['u_luiz'], ativo: true },
  ]

  const patrimonio: Patrimonio[] = [
    { id: 'pt_1', nome: 'Conta corrente', tipo: 'conta', instituicao: 'Itaú', titular_id: 'u_luiz', ativo: true, saldos: Array.from({ length: 12 }, (_, k) => ({ competencia: somarMeses(compAtual, -11 + k), valor: 3000 + k * 180 + Math.round(rnd() * 900) })) },
    { id: 'pt_2', nome: 'Reserva (CDB)', tipo: 'investimento', instituicao: 'Nubank', titular_id: 'u_nina', ativo: true, saldos: Array.from({ length: 12 }, (_, k) => ({ competencia: somarMeses(compAtual, -11 + k), valor: 4000 + k * 640 })) },
    { id: 'pt_3', nome: 'Poupança da viagem', tipo: 'poupanca', instituicao: 'Caixa', titular_id: 'u_luiz', ativo: true, saldos: Array.from({ length: 12 }, (_, k) => ({ competencia: somarMeses(compAtual, -11 + k), valor: 240 + (k + 1) * 800 })) },
    { id: 'pt_4', nome: 'Carro', tipo: 'veiculo', instituicao: '', titular_id: 'u_luiz', ativo: true, saldos: Array.from({ length: 12 }, (_, k) => ({ competencia: somarMeses(compAtual, -11 + k), valor: 42000 - k * 250 })) },
  ]

  const config: Config = {
    nome_familia: 'Família Reis', sobrenome: 'Reis', url_brasao: '', url_foto_capa: '',
    versiculo_lema: '“Eu e a minha casa serviremos ao Senhor.” — Josué 24.15', moeda: 'BRL', dia_fechamento_mes: 1,
    lembrete_horario: '20:00', fe_ativa: true, divisao_dar: 10, divisao_poupar: 15, divisao_viver: 75,
    valor_gasto_grande: 1000, regra_votacao: 'maioria_mais_pais', dependente_ve_salarios: false,
    rotina_vigia: true, rotina_quinzenal: true, rotina_fechamento: true, telegram_ativo: false,
    url_planilha: 'https://docs.google.com/spreadsheets/', url_pasta_drive: 'https://drive.google.com/',
  }

  return { config, usuarios, tipos, grupos, categorias, regras_loja: [], lancamentos, contas_fixas, contas_a_pagar, cartoes, caixa_entrada, orcamento, projetos, aportes, decisoes, votos, reunioes: [], alertas, avisos: [], patrimonio, conversas: [], log: [] }
}

// ---------- Persistência ----------

async function carregar(): Promise<Banco> {
  if (cache) return cache
  const salvo = await get<Banco>(CHAVE).catch(() => null)
  cache = salvo && salvo.tipos ? salvo : gerarBancoExemplo()
  if (!salvo) await persistir()
  return cache
}
async function persistir() { if (cache) await set(CHAVE, cache).catch(() => {}) }
export async function reiniciarDemo() { cache = gerarBancoExemplo(); await persistir() }

// ---------- Helpers ----------

const ok = <T,>(dados: T): RespostaApi<T> => ({ ok: true, dados, versao: 'demo' })
const erro = (msg: string): RespostaApi => ({ ok: false, erro: msg })

const ehDependente = (b: Banco, uid: string) => b.usuarios.find((u) => u.id === uid)?.perfil === 'Dependente'
function filtrarSensivel(b: Banco, uid: string, ls: Lancamento[]) {
  if (!ehDependente(b, uid) || b.config.dependente_ve_salarios) return ls
  const sensiveis = new Set(b.categorias.filter((c) => c.sensivel).map((c) => c.id))
  return ls.filter((l) => !sensiveis.has(l.categoria_id))
}
const ativos = (ls: Lancamento[]) => ls.filter((l) => !l.excluido)
const ehDespesaReal = (c: Categoria | undefined) => !!c && c.tipo === 'despesa' && c.tipo_id !== 't_projetos'
const valorAtual = (b: Banco, p: Projeto) => p.valor_inicial + b.aportes.filter((a) => a.projeto_id === p.id).reduce((s, a) => s + a.valor, 0)
function registrarLog(b: Banco, uid: string, acao: string, detalhe: string) {
  b.log.unshift({ data: agoraIso(), usuario_id: uid, acao, detalhe })
  if (b.log.length > 500) b.log.length = 500
}
function versiculoDoDia(tema?: string): Versiculo {
  const lista = (versiculosBase as Versiculo[]).filter((v) => !tema || v.tema === tema)
  return lista[Math.floor(Date.now() / 86_400_000) % lista.length]
}
function necessarioPorMes(b: Banco, p: Projeto) {
  const falta = Math.max(0, p.meta_valor - valorAtual(b, p))
  const hoje = new Date(); const alvo = new Date(p.data_alvo)
  const meses = Math.max(1, (alvo.getFullYear() - hoje.getFullYear()) * 12 + (alvo.getMonth() - hoje.getMonth()))
  return Math.round(falta / meses)
}
function mediaAportes3m(b: Banco, p: Projeto) {
  const comp = competenciaDe()
  const comps = [1, 2, 3].map((k) => somarMeses(comp, -k))
  return b.aportes.filter((a) => a.projeto_id === p.id && comps.includes(a.data.slice(0, 7))).reduce((s, a) => s + a.valor, 0) / 3
}
function comProjetoCalculado(b: Banco, p: Projeto): Projeto & { necessario_mes: number; media_3m: number; situacao: 'no_ritmo' | 'atrasado' | 'votacao' | 'concluido' | 'pausado'; atraso: number; votos_sim: number; votos_total: number; aguardando: number } {
  const necessario = necessarioPorMes(b, p)
  const media = mediaAportes3m(b, p)
  const atraso = Math.max(0, Math.round((necessario - media) * 3))
  const situacao = p.status === 'votação' ? 'votacao' : p.status === 'concluído' ? 'concluido' : p.status === 'pausado' ? 'pausado' : media >= necessario * 0.95 ? 'no_ritmo' : 'atrasado'
  const d = b.decisoes.find((x) => x.projeto_id === p.id)
  const vs = d ? b.votos.filter((v) => v.decisao_id === d.id) : []
  const votantes = b.usuarios.filter((u) => u.ativo).length
  return { ...p, valor_atual: valorAtual(b, p), necessario_mes: necessario, media_3m: Math.round(media), situacao, atraso, votos_sim: vs.filter((v) => v.voto === 'sim').length, votos_total: vs.length, aguardando: Math.max(0, votantes - vs.length) }
}

function resumoMes(b: Banco, uid: string, comp: string, filtroUsuario?: string): ResumoMes {
  let ls = filtrarSensivel(b, uid, ativos(b.lancamentos)).filter((l) => l.competencia === comp && l.status === 'confirmado')
  if (filtroUsuario) ls = ls.filter((l) => l.usuario_id === filtroUsuario)
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const r: ResumoMes = { competencia: comp, entrou: 0, saiu: 0, sobrou: 0, por_tipo: {}, projetos: { guardado_total: 0, percentual_medio: 0, ativos: 0 }, por_grupo: {}, por_categoria: {}, por_usuario: {} }
  for (const t of b.tipos) r.por_tipo[t.id] = { realizado: 0, orcado: 0 }
  for (const g of b.grupos) r.por_grupo[g.id] = { realizado: 0, orcado: 0 }
  for (const o of b.orcamento.filter((o) => o.competencia === comp)) {
    const c = catMap.get(o.categoria_id)
    r.por_categoria[o.categoria_id] = { realizado: 0, orcado: o.valor_planejado }
    if (c) { r.por_grupo[c.grupo_id].orcado += o.valor_planejado; r.por_tipo[c.tipo_id].orcado += o.valor_planejado }
  }
  // receita prevista = salários do mês anterior (ou do próprio mês)
  const recAnt = ativos(b.lancamentos).filter((l) => l.competencia === somarMeses(comp, -1) && l.tipo === 'receita' && l.status === 'confirmado').reduce((s, l) => s + l.valor, 0)
  r.por_tipo.t_receitas.orcado = recAnt || 16300
  for (const l of ls) {
    const c = catMap.get(l.categoria_id)
    if (!c) continue
    if (l.tipo === 'receita') r.entrou += l.valor
    else if (ehDespesaReal(c)) r.saiu += l.valor
    r.por_tipo[c.tipo_id].realizado += l.valor
    r.por_grupo[c.grupo_id].realizado += l.valor
    r.por_categoria[c.id] = r.por_categoria[c.id] ?? { realizado: 0, orcado: 0 }
    r.por_categoria[c.id].realizado += l.valor
    if (ehDespesaReal(c)) r.por_usuario[l.usuario_id] = (r.por_usuario[l.usuario_id] ?? 0) + l.valor
  }
  r.sobrou = r.entrou - r.saiu
  const ativosP = b.projetos.filter((p) => p.status === 'ativo')
  r.projetos = { guardado_total: b.projetos.filter((p) => p.status !== 'pausado').reduce((s, p) => s + valorAtual(b, p), 0), percentual_medio: ativosP.length ? Math.round(ativosP.reduce((s, p) => s + Math.min(100, (valorAtual(b, p) / p.meta_valor) * 100), 0) / ativosP.length) : 0, ativos: ativosP.length }
  r.por_tipo.t_projetos = { realizado: r.projetos.guardado_total, orcado: 0 }
  return r
}

function painel(b: Banco, uid: string, ano: number, filtroUsuario?: string): DadosPainel {
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const todos = filtrarSensivel(b, uid, ativos(b.lancamentos)).filter((l) => l.status === 'confirmado' && (!filtroUsuario || l.usuario_id === filtroUsuario))
  const compAtual = competenciaDe()
  const meses: DadosPainel['meses'] = []
  for (let m = 1; m <= 12; m++) {
    const comp = `${ano}-${String(m).padStart(2, '0')}`
    const futuro = comp > compAtual
    const item: DadosPainel['meses'][number] = { competencia: comp, saldo: 0, receitas: 0, despesas: 0, salarios: 0, outras_receitas: 0, previsto: futuro, por_tipo: {}, por_grupo_analise: {}, por_grupo: {}, por_categoria: {}, por_usuario: {} }
    if (futuro) {
      // previsão: receitas = média dos últimos 3 meses reais; despesas = orçamento
      const comps = [1, 2, 3].map((k) => somarMeses(compAtual, -k))
      const base = todos.filter((l) => comps.includes(l.competencia))
      item.salarios = Math.round(base.filter((l) => catMap.get(l.categoria_id)?.id === 'c_salario').reduce((s, l) => s + l.valor, 0) / 3)
      item.outras_receitas = Math.round(base.filter((l) => l.tipo === 'receita' && l.categoria_id !== 'c_salario').reduce((s, l) => s + l.valor, 0) / 3)
      if (m === 12) item.salarios = Math.round(item.salarios * 1.5)
      item.receitas = item.salarios + item.outras_receitas
      for (const o of b.orcamento.filter((o) => o.competencia === compAtual)) {
        const c = catMap.get(o.categoria_id)
        if (!ehDespesaReal(c)) continue
        item.despesas += o.valor_planejado
        item.por_tipo[c!.tipo_id] = (item.por_tipo[c!.tipo_id] ?? 0) + o.valor_planejado
        item.por_grupo_analise[c!.grupo_analise] = (item.por_grupo_analise[c!.grupo_analise] ?? 0) + o.valor_planejado
      }
    } else {
      for (const l of todos.filter((l) => l.competencia === comp)) {
        const c = catMap.get(l.categoria_id)
        if (!c) continue
        if (l.tipo === 'receita') { item.receitas += l.valor; if (c.id === 'c_salario') item.salarios += l.valor; else item.outras_receitas += l.valor }
        else if (ehDespesaReal(c)) {
          item.despesas += l.valor
          item.por_tipo[c.tipo_id] = (item.por_tipo[c.tipo_id] ?? 0) + l.valor
          item.por_grupo_analise[c.grupo_analise] = (item.por_grupo_analise[c.grupo_analise] ?? 0) + l.valor
          item.por_grupo[c.grupo_id] = (item.por_grupo[c.grupo_id] ?? 0) + l.valor
          item.por_categoria[c.id] = (item.por_categoria[c.id] ?? 0) + l.valor
          item.por_usuario[l.usuario_id] = (item.por_usuario[l.usuario_id] ?? 0) + l.valor
        }
      }
    }
    item.saldo = item.receitas - item.despesas
    meses.push(item)
  }
  const orcado: Record<string, number> = {}
  for (const o of b.orcamento.filter((o) => o.competencia === compAtual)) orcado[o.categoria_id] = o.valor_planejado
  const poup: DadosPainel['poupanca_projetos'] = []
  let acumulado = b.projetos.reduce((s, p) => s + p.valor_inicial, 0) + b.aportes.filter((a) => a.data < `${ano}-01-01`).reduce((s, a) => s + a.valor, 0)
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
  let compInicial = competenciaDe(base.data)
  if (cartao && Number(base.data.slice(8, 10)) > cartao.dia_fechamento) compInicial = somarMeses(compInicial, 1)
  const grupo = gerarId('parc')
  return Array.from({ length: parcelas }, (_, i) => ({ ...base, id: gerarId('l'), competencia: somarMeses(compInicial, i), valor: i === parcelas - 1 ? Math.round((base.valor - valorParcela * (parcelas - 1)) * 100) / 100 : valorParcela, parcela: `${i + 1}/${parcelas}`, hash_dedup: `${grupo}_${i}`, status: i === 0 ? base.status : 'a_confirmar' }))
}

function proximasSaidas(b: Banco, dias: number): SaidaPrevista[] {
  const hoje = hojeIso()
  const limite = new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
  const saidas: SaidaPrevista[] = []
  const cfMap = new Map(b.contas_fixas.map((c) => [c.id, c]))
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  for (const c of b.contas_a_pagar.filter((c) => c.status === 'aberta' && c.vencimento >= hoje && c.vencimento <= limite)) {
    const cf = cfMap.get(c.conta_fixa_id)
    saidas.push({ id: c.id, data: c.vencimento, titulo: cf?.nome ?? 'Conta', subtitulo: c.anexo_url || c.linha_digitavel ? 'fatura lida do e-mail' : 'recorrente', valor: c.valor, icone: catMap.get(cf?.categoria_id ?? '')?.icone ?? 'receipt', status: c.anexo_url || c.linha_digitavel ? 'lida_do_email' : 'prevista', rota: '/contas' })
  }
  // contas fixas sem fatura ainda (estimadas)
  for (const cf of b.contas_fixas.filter((c) => c.ativa)) {
    for (const comp of [competenciaDe(), somarMeses(competenciaDe(), 1), somarMeses(competenciaDe(), 2)]) {
      const venc = `${comp}-${String(cf.dia_vencimento).padStart(2, '0')}`
      if (venc < hoje || venc > limite) continue
      if (b.contas_a_pagar.some((c) => c.conta_fixa_id === cf.id && c.competencia === comp)) continue
      saidas.push({ id: `est_${cf.id}_${comp}`, data: venc, titulo: cf.nome, subtitulo: 'aguardando fatura', valor: cf.valor_previsto, icone: catMap.get(cf.categoria_id)?.icone ?? 'receipt', status: 'estimada', rota: '/contas' })
    }
  }
  // parcelas futuras de cartão
  for (const l of ativos(b.lancamentos).filter((l) => l.parcela && l.status === 'a_confirmar' && l.competencia >= competenciaDe())) {
    const k = b.cartoes.find((x) => x.id === l.cartao_id)
    const data = `${l.competencia}-${String(k?.dia_vencimento ?? 10).padStart(2, '0')}`
    if (data < hoje || data > limite) continue
    saidas.push({ id: l.id, data, titulo: `${l.descricao} — parcela ${l.parcela}`, subtitulo: `cartão ${k?.apelido ?? ''} final ${k?.final ?? ''}`, valor: l.valor, icone: catMap.get(l.categoria_id)?.icone ?? 'credit-card', status: 'parcela' })
  }
  // faturas dos cartões (soma do ciclo aberto)
  for (const k of b.cartoes.filter((k) => k.ativo)) {
    const comp = competenciaDe()
    const compras = ativos(b.lancamentos).filter((l) => l.cartao_id === k.id && l.competencia === comp && l.status === 'confirmado')
    if (!compras.length) continue
    const fecha = `${comp}-${String(k.dia_fechamento).padStart(2, '0')}`
    const data = fecha >= hoje ? fecha : `${somarMeses(comp, 1)}-${String(k.dia_fechamento).padStart(2, '0')}`
    if (data > limite) continue
    saidas.push({ id: `fat_${k.id}`, data, titulo: `Cartão ${k.apelido} final ${k.final}`, subtitulo: `fecha ${data.slice(8, 10)}/${data.slice(5, 7)} · ${compras.length} compras`, valor: compras.reduce((s, l) => s + l.valor, 0), icone: 'credit-card', status: 'parcial', rota: '/caixa' })
  }
  return saidas.sort((a, c) => (a.data < c.data ? -1 : 1))
}

/** Vigia diário: gera os avisos a partir dos dados (sem precisar de IA). */
function gerarAvisos(b: Banco): Aviso[] {
  const comp = competenciaDe()
  const hoje = hojeIso()
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const ls = ativos(b.lancamentos).filter((l) => l.status === 'confirmado' && l.tipo === 'despesa')
  void catMap
  const avisos: Aviso[] = []
  const totalCat = (cid: string, c: string) => ls.filter((l) => l.categoria_id === cid && l.competencia === c).reduce((s, l) => s + l.valor, 0)
  // gasto fora do padrão (> 1,5× média de 3 meses)
  for (const cat of b.categorias.filter((c) => c.tipo === 'despesa' && !c.fixa)) {
    const atual = totalCat(cat.id, comp)
    const media = [1, 2, 3].reduce((s, k) => s + totalCat(cat.id, somarMeses(comp, -k)), 0) / 3
    if (media > 50 && atual > media * 1.35) avisos.push({ id: `av_fora_${cat.id}`, data: hoje, tipo: 'fora_do_padrao', titulo: `${cat.nome} ${Math.round((atual / media - 1) * 100)}% acima da média`, detalhe: `${moeda(atual)} em ${MESES[Number(comp.slice(5)) - 1].toLowerCase()} contra ${moeda(media)} de média`, gravidade: 'red', acao: { rotulo: 'ver', rota: `/tipo/t_variaveis?categoria=${cat.id}` } })
  }
  // cobrança duplicada (mesmo valor, loja e dia)
  const vistos = new Map<string, Lancamento>()
  for (const l of ls.filter((l) => l.competencia === comp && l.forma_pgto === 'crédito')) {
    const chave = `${l.valor.toFixed(2)}|${normalizar(l.estabelecimento)}|${l.data}`
    if (vistos.has(chave) && !avisos.some((a) => a.id === `av_dup_${chave}`)) avisos.push({ id: `av_dup_${chave}`, data: hoje, tipo: 'cobranca_duplicada', titulo: 'Cobrança repetida no cartão', detalhe: `${l.estabelecimento} ${moeda(l.valor)} duas vezes em ${l.data.slice(8, 10)}/${l.data.slice(5, 7)}`, gravidade: 'warn', acao: { rotulo: 'conferir', rota: `/tipo/t_variaveis?categoria=${l.categoria_id}` } })
    vistos.set(chave, l)
  }
  // assinatura nova (loja recorrente nos últimos 2 meses que não existia antes e não está em conta fixa)
  const porLoja = new Map<string, Set<string>>()
  for (const l of ls.filter((l) => l.forma_pgto === 'crédito' && l.valor < 200)) { const k = normalizar(l.estabelecimento); porLoja.set(k, (porLoja.get(k) ?? new Set()).add(l.competencia)) }
  for (const [loja, comps] of porLoja) {
    const arr = [...comps].sort()
    if (arr.length >= 2 && arr.length <= 3 && arr[0] >= somarMeses(comp, -2) && arr.includes(comp)) {
      const l = ls.find((x) => normalizar(x.estabelecimento) === loja)!
      avisos.push({ id: `av_ass_${loja}`, data: hoje, tipo: 'nova_assinatura', titulo: 'Assinatura nova detectada', detalhe: `${l.estabelecimento} ${moeda(l.valor)} desde ${nomeCompetencia(arr[0], true)} — confira se é esperada`, gravidade: 'warn', acao: { rotulo: 'categorizar', rota: '/caixa' } })
    }
  }
  // contas a vencer em 3 dias
  for (const c of b.contas_a_pagar.filter((c) => c.status === 'aberta')) {
    const d = Math.round((new Date(c.vencimento).getTime() - new Date(hoje).getTime()) / 86_400_000)
    const cf = b.contas_fixas.find((f) => f.id === c.conta_fixa_id)
    if (d >= 0 && d <= 3) avisos.push({ id: `av_venc_${c.id}`, data: hoje, tipo: 'vencimento', titulo: `${cf?.nome ?? 'Conta'} vence ${d === 0 ? 'hoje' : `em ${d} dia${d > 1 ? 's' : ''}`}`, detalhe: `${moeda(c.valor)} · ${c.linha_digitavel ? 'código de barras disponível' : 'aguardando fatura'}`, gravidade: d === 0 ? 'red' : 'warn', acao: { rotulo: 'pagar', rota: '/contas' } })
    else if (d < 0) avisos.push({ id: `av_atr_${c.id}`, data: hoje, tipo: 'vencimento', titulo: `${cf?.nome ?? 'Conta'} venceu há ${-d} dia${-d > 1 ? 's' : ''}`, detalhe: moeda(c.valor), gravidade: 'red', acao: { rotulo: 'pagar', rota: '/contas' } })
  }
  const pend = b.caixa_entrada.filter((c) => c.status === 'pendente').length
  if (pend) avisos.push({ id: 'av_semcat', data: hoje, tipo: 'sem_categoria', titulo: `${pend} gasto${pend > 1 ? 's' : ''} do cartão sem categoria`, detalhe: 'Capturados por SMS — um toque para classificar', gravidade: 'proj', acao: { rotulo: 'abrir', rota: '/caixa' } })
  // alertas personalizados disparados
  for (const al of b.alertas.filter((a) => a.ativo && a.tipo === 'categoria_acima' && a.categoria_id)) {
    const atual = totalCat(al.categoria_id!, comp)
    if (atual > al.limite) avisos.push({ id: `av_al_${al.id}`, data: hoje, tipo: 'alerta_personalizado', titulo: al.nome, detalhe: `${moeda(atual)} no mês (limite ${moeda(al.limite)})`, gravidade: 'red', acao: { rotulo: 'ver', rota: `/tipo/t_variaveis?categoria=${al.categoria_id}` } })
  }
  const lidos = new Set(b.avisos.filter((a) => a.lido).map((a) => a.id))
  // Ordem: o que exige ação (vencimentos, duplicada, assinatura nova, sem categoria, alertas) e só os 2 maiores desvios de padrão.
  const prioridade: Record<Aviso['tipo'], number> = { vencimento: 0, cobranca_duplicada: 1, alerta_personalizado: 2, nova_assinatura: 3, sem_categoria: 4, fora_do_padrao: 5, tendencia: 6, fechamento: 7 }
  const foraDoPadrao = avisos.filter((a) => a.tipo === 'fora_do_padrao').sort((x, y) => Number(y.titulo.match(/(\d+)%/)?.[1] ?? 0) - Number(x.titulo.match(/(\d+)%/)?.[1] ?? 0)).slice(0, 2)
  return avisos
    .filter((a) => a.tipo !== 'fora_do_padrao' || foraDoPadrao.includes(a))
    .sort((x, y) => prioridade[x.tipo] - prioridade[y.tipo])
    .map((a) => ({ ...a, lido: lidos.has(a.id) }))
}

function alertasCalculados(b: Banco): Alerta[] {
  const comp = competenciaDe()
  const ls = ativos(b.lancamentos).filter((l) => l.status === 'confirmado' && l.competencia === comp)
  return b.alertas.map((al) => {
    if (al.tipo === 'categoria_acima' || al.tipo === 'grupo_acima') {
      const total = ls.filter((l) => (al.categoria_id ? l.categoria_id === al.categoria_id : b.categorias.find((c) => c.id === l.categoria_id)?.grupo_id === al.grupo_id)).reduce((s, l) => s + l.valor, 0)
      const pct = al.limite ? Math.round((total / al.limite) * 100) : 0
      return { ...al, percentual_atual: pct, status_atual: pct >= 100 ? 'disparado' : 'ok' as const }
    }
    return { ...al, status_atual: 'ok' as const }
  })
}

/** Assistente por regras locais (sem IA). O servidor real usa o Claude com tool use. */
function responderAssistente(b: Banco, uid: string, texto: string): MensagemAssistente {
  const t = normalizar(texto)
  const comp = competenciaDe()
  const mesNome = MESES[Number(comp.slice(5)) - 1].toLowerCase()
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const ls = filtrarSensivel(b, uid, ativos(b.lancamentos)).filter((l) => l.status === 'confirmado')
  const resp = (texto: string, extra: Partial<MensagemAssistente> = {}): MensagemAssistente => ({ id: gerarId('m'), papel: 'assistente', texto, data: agoraIso(), ...extra })
  const totalCat = (cid: string, c: string) => ls.filter((l) => l.categoria_id === cid && l.competencia === c).reduce((s, l) => s + l.valor, 0)

  // Lançamento por texto
  if (/^(GASTEI|PAGUEI|COMPREI|LANCA|LANCE|RECEBI|GANHEI)\b/.test(t) || /\bREAIS?\b|R\$/.test(t)) {
    const e = extrairDeTexto(texto, b.categorias)
    if (e.valor && e.categoria_id) {
      const c = catMap.get(e.categoria_id)!
      const g = b.grupos.find((x) => x.id === c.grupo_id)
      const tp = b.tipos.find((x) => x.id === c.tipo_id)
      const l: Lancamento = { id: gerarId('l'), data: e.data || hojeIso(), competencia: competenciaDe(e.data), tipo: c.tipo, valor: e.valor, categoria_id: c.id, descricao: e.descricao || c.nome, estabelecimento: e.estabelecimento || '', forma_pgto: e.forma_pgto || 'pix', usuario_id: uid, origem: 'chat', status: 'confirmado', criado_em: agoraIso() }
      b.lancamentos.push(l)
      const quem = b.usuarios.find((u) => u.id === uid)?.apelido
      return resp(`Lancei **${moeda(l.valor)} · ${c.nome}** (${tp?.nome} › ${g?.nome}), ${l.data === hojeIso() ? 'hoje' : l.data.split('-').reverse().join('/')}, ${l.forma_pgto[0].toUpperCase() + l.forma_pgto.slice(1)}, por ${quem}.`, { lancamento: l, etiqueta: 'lançado' })
    }
    return resp('Não entendi o valor. Tente assim: “gastei 45 na padaria no pix”.')
  }
  // Gasto por categoria/grupo no mês
  // Casa por palavra inteira, preferindo o nome mais longo ("delivery" antes de "gás" em "gastamos").
  const temPalavra = (texto: string, termo: string) => !!termo && new RegExp(`(^|\\s)${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(texto)
  const cat = [...b.categorias]
    .filter((c) => c.tipo === 'despesa')
    .sort((a, c) => normalizar(c.nome).length - normalizar(a.nome).length)
    .find((c) => temPalavra(t, normalizar(c.nome)) || (c.palavras_chave || '').split(';').some((p) => p.length >= 4 && temPalavra(t, normalizar(p))))
  if (cat && /QUANTO|GAST|TOTAL/.test(t)) {
    const atual = totalCat(cat.id, comp)
    const media = [1, 2, 3].reduce((s, k) => s + totalCat(cat.id, somarMeses(comp, -k)), 0) / 3
    const n = ls.filter((l) => l.categoria_id === cat.id && l.competencia === comp).length
    const maior = ls.filter((l) => l.categoria_id === cat.id && l.competencia === comp).sort((a, c) => c.valor - a.valor)[0]
    const var_ = media ? Math.round((atual / media - 1) * 100) : 0
    return resp(`Em ${mesNome} foram **${moeda(atual)}** em ${n} lançamento${n === 1 ? '' : 's'} de ${cat.nome} — ${var_ >= 0 ? `${var_}% acima` : `${-var_}% abaixo`} da média dos últimos 3 meses (${moeda(media)}).${maior ? ` O maior foi ${moeda(maior.valor)} no dia ${maior.data.slice(8, 10)}.` : ''}`, { barras: [{ rotulo: MESES[Number(comp.slice(5)) - 1], valor: atual, cor: cat.cor }, { rotulo: 'Média 3 meses', valor: Math.round(media), cor: 'indigo' }] })
  }
  if (/ASSINATURA/.test(t)) {
    const itens = ls.filter((l) => l.competencia === comp && ['c_streaming', 'c_apps', 'c_seguros'].includes(l.categoria_id))
    const total = itens.reduce((s, l) => s + l.valor, 0)
    return resp(`Temos ${itens.length} assinaturas este mês, somando **${moeda(total)}**: ${itens.map((l) => `${l.descricao} (${moeda(l.valor)})`).join(', ')}.`, { barras: itens.slice(0, 5).map((l) => ({ rotulo: l.descricao.slice(0, 14), valor: l.valor, cor: 'rose' as const })) })
  }
  if (/VENCE|SEMANA|CONTAS/.test(t)) {
    const s = proximasSaidas(b, 7)
    if (!s.length) return resp('Nenhuma conta vence nos próximos 7 dias.')
    return resp(`Vencem nos próximos 7 dias: ${s.map((x) => `${x.titulo} (${moeda(x.valor)}, dia ${x.data.slice(8, 10)})`).join('; ')}. Total **${moeda(s.reduce((a, x) => a + x.valor, 0))}**.`)
  }
  if (/FECHAMOS|FECHOU|COMO FOI|SALDO/.test(t)) {
    const idx = MESES.findIndex((m) => t.includes(normalizar(m)))
    const c = idx >= 0 ? `${comp.slice(0, 4)}-${String(idx + 1).padStart(2, '0')}` : somarMeses(comp, -1)
    const r = resumoMes(b, uid, c)
    return resp(`${nomeCompetencia(c)}: entrou **${moeda(r.entrou)}**, saiu **${moeda(r.saiu)}** e ${r.sobrou >= 0 ? `sobrou **${moeda(r.sobrou)}**` : `faltou **${moeda(-r.sobrou)}**`}. Despesas fixas ${moeda(r.por_tipo.t_fixas?.realizado ?? 0)} e variáveis ${moeda(r.por_tipo.t_variaveis?.realizado ?? 0)}.`, { barras: [{ rotulo: 'Receitas', valor: r.entrou, cor: 'green' }, { rotulo: 'Despesas', valor: r.saiu, cor: 'magenta' }] })
  }
  if (/ECONOMIZAR|CORTAR|REDUZIR/.test(t)) {
    const variaveis = b.categorias.filter((c) => c.tipo_id === 't_variaveis').map((c) => ({ c, atual: totalCat(c.id, comp), media: [1, 2, 3].reduce((s, k) => s + totalCat(c.id, somarMeses(comp, -k)), 0) / 3 })).filter((x) => x.media > 50).sort((a, c) => (c.atual - c.media) - (a.atual - a.media)).slice(0, 3)
    return resp(`Onde mais subimos em relação à média: ${variaveis.map((x) => `**${x.c.nome}** (${moeda(x.atual)} contra ${moeda(x.media)})`).join(', ')}. Voltar esses três à média liberaria cerca de **${moeda(variaveis.reduce((s, x) => s + Math.max(0, x.atual - x.media), 0))}** por mês.`, { barras: variaveis.map((x) => ({ rotulo: x.c.nome.slice(0, 14), valor: Math.round(x.atual), cor: x.c.cor })) })
  }
  const proj = b.projetos.find((p) => t.includes(normalizar(p.nome)) || (/VIAGEM/.test(t) && p.nome.includes('Viagem')) || (/CARRO/.test(t) && p.nome.includes('carro')) || (/RESERVA/.test(t) && p.nome.includes('Reserva')))
  if (proj && /FECHAR|CONSEGU|DA PARA|RITMO|FALTA/.test(t)) {
    const pc = comProjetoCalculado(b, proj)
    const falta = proj.meta_valor - pc.valor_atual!
    const mesesNoRitmo = pc.media_3m > 0 ? Math.ceil(falta / pc.media_3m) : 0
    const alvo = new Date(proj.data_alvo)
    const mesesAlvo = Math.max(1, (alvo.getFullYear() - new Date().getFullYear()) * 12 + alvo.getMonth() - new Date().getMonth())
    const pctNoAlvo = Math.min(100, Math.round(((pc.valor_atual! + pc.media_3m * mesesAlvo) / proj.meta_valor) * 100))
    const delivery = Math.max(0, totalCat('c_delivery', comp) - [1, 2, 3].reduce((s, k) => s + totalCat('c_delivery', somarMeses(comp, -k)), 0) / 3)
    return resp(`No ritmo atual (${moeda(pc.media_3m)}/mês) o projeto **${proj.nome}** chega a ${pctNoAlvo}% da meta em ${nomeCompetencia(proj.data_alvo.slice(0, 7), true)}. Faltam ${moeda(falta)}; precisa de ${moeda(pc.necessario_mes)} por mês. ${delivery > 20 ? `Reduzindo delivery para a média (−${moeda(delivery)}/mês) e direcionando a sobra do mês, a meta fecha ${mesesNoRitmo && mesesNoRitmo <= mesesAlvo ? 'no prazo' : 'mais perto do prazo'}.` : ''}`)
  }
  return resp('Posso responder sobre gastos por categoria (“quanto gastamos com delivery este mês?”), assinaturas, contas da semana, fechamento do mês, onde economizar e os projetos. Também lanço despesas: “gastei 120 no posto”. Com a chave do Claude configurada, a conversa fica livre.')
}

function gerarPauta(b: Banco, uid: string, comp: string): string {
  const r = resumoMes(b, uid, comp)
  const ant = resumoMes(b, uid, somarMeses(comp, -1))
  const catMap = new Map(b.categorias.map((c) => [c.id, c]))
  const estouradas = Object.entries(r.por_categoria).filter(([, v]) => v.orcado && v.realizado > v.orcado).map(([id, v]) => `- ${catMap.get(id)?.nome ?? id}: ${moeda(v.realizado)} de ${moeda(v.orcado)} planejados`)
  const subiram = b.contas_fixas.map((cf) => {
    const a = b.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === comp)
    const p = b.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === somarMeses(comp, -1))
    if (a && p && p.valor > 0 && a.valor / p.valor > 1.2) return `- ${cf.nome}: subiu ${Math.round((a.valor / p.valor - 1) * 100)}% (${moeda(p.valor)} → ${moeda(a.valor)})`
    return null
  }).filter(Boolean) as string[]
  const projetos = b.projetos.filter((p) => p.status === 'ativo').map((p) => { const pc = comProjetoCalculado(b, p); return `- ${p.nome}: ${Math.round((pc.valor_atual! / p.meta_valor) * 100)}% (${moeda(pc.valor_atual!)} de ${moeda(p.meta_valor)}) — ${pc.situacao === 'no_ritmo' ? 'no ritmo' : `atrasado ${moeda(pc.atraso)}`}` })
  const abertas = b.decisoes.filter((d) => d.status === 'aberta').map((d) => `- ${d.titulo} (prazo ${d.prazo.split('-').reverse().join('/')})`)
  const v = versiculoDoDia('família')
  return [
    `# Reunião da família — ${nomeCompetencia(comp)}`, '',
    '## 1. Como fechou o mês',
    `- Entrou ${moeda(r.entrou)} · Saiu ${moeda(r.saiu)} · ${r.sobrou >= 0 ? 'Sobrou' : 'Faltou'} ${moeda(Math.abs(r.sobrou))}`,
    `- Mês anterior: ${ant.sobrou >= 0 ? 'sobrou' : 'faltou'} ${moeda(Math.abs(ant.sobrou))}`,
    '', '## 2. O que passou do orçamento', ...(estouradas.length ? estouradas : ['- Nada passou do orçamento.']),
    '', '## 3. Contas que subiram', ...(subiram.length ? subiram : ['- Nenhuma conta subiu mais de 20%.']),
    '', '## 4. Situação dos projetos', ...projetos,
    '', '## 5. Decisões abertas', ...(abertas.length ? abertas : ['- Nenhuma.']),
    '', '## 6. Para refletir', `> "${v.texto}" — ${v.referencia}`,
    '', '## 7. O que decidimos', '_(preencher)_', '', '## 8. Motivo de gratidão', '_(preencher)_',
  ].join('\n')
}

// ---------- Despachante ----------

export async function chamarMock(corpo: Record<string, unknown>): Promise<RespostaApi> {
  const b = await carregar()
  const acao = String(corpo.acao)
  const uid = String(corpo.usuario_id || '')
  const p = corpo as Record<string, any>
  const eu = b.usuarios.find((u) => u.id === uid)
  await new Promise((r) => setTimeout(r, 120))

  try {
    switch (acao) {
      case 'ping': return ok({ versao: 'demo', nome_familia: b.config.nome_familia })

      case 'entrar_convite': {
        const u: Usuario = { id: gerarId('u'), nome: p.nome || p.apelido, apelido: p.apelido, avatar: p.avatar || '', cor: p.cor || 'indigo', perfil: p.perfil === 'Júnior' ? 'Dependente' : p.perfil || 'Adulto', ativo: true, criado_em: agoraIso(), ultimo_acesso: agoraIso(), token: gerarId('tok') }
        b.usuarios.push(u); await persistir(); return ok(u)
      }
      case 'entrar_pin': {
        const u = b.usuarios.find((x) => x.id === p.usuario_id)
        if (!u) return erro('Usuário não encontrado')
        if (p.pin && String(p.pin).length !== 4) return erro('PIN incorreto')
        return ok({ ...u, token: u.token || gerarId('tok') })
      }
      case 'bootstrap': {
        if (!eu) return erro('Sessão expirada')
        const pend = b.caixa_entrada.filter((c) => c.status === 'pendente' && (eu.perfil !== 'Dependente' || c.usuario_id === uid)).length
        const boot: Bootstrap = {
          config: b.config, usuario: eu,
          usuarios: b.usuarios.map((u) => ({ ...u, token: eu.perfil === 'Administrador' || u.id === uid ? u.token : undefined })),
          tipos: b.tipos, grupos: b.grupos,
          categorias: b.categorias.filter((c) => c.ativa && (eu.perfil !== 'Dependente' || !c.sensivel || b.config.dependente_ve_salarios)),
          regras_loja: b.regras_loja, cartoes: b.cartoes, contas_fixas: b.contas_fixas,
          projetos: b.projetos.map((pr) => comProjetoCalculado(b, pr)),
          versiculo_do_dia: versiculoDoDia(), pendentes_caixa: pend,
        }
        return ok(boot)
      }
      case 'resumo_mes': return ok(resumoMes(b, uid, String(p.competencia || competenciaDe()), p.usuario_id_filtro))

      case 'listar_lancamentos': {
        let ls = filtrarSensivel(b, uid, ativos(b.lancamentos))
        if (eu?.perfil === 'Dependente') ls = ls.filter((l) => l.usuario_id === uid || l.categoria_id === 'c_aporte_projeto')
        if (p.competencia) ls = ls.filter((l) => l.competencia === p.competencia)
        if (p.categoria_id) ls = ls.filter((l) => l.categoria_id === p.categoria_id)
        if (p.grupo_id) { const ids = new Set(b.categorias.filter((c) => c.grupo_id === p.grupo_id).map((c) => c.id)); ls = ls.filter((l) => ids.has(l.categoria_id)) }
        if (p.tipo_id) { const ids = new Set(b.categorias.filter((c) => c.tipo_id === p.tipo_id).map((c) => c.id)); ls = ls.filter((l) => ids.has(l.categoria_id)) }
        if (p.grupo_analise) { const ids = new Set(b.categorias.filter((c) => c.grupo_analise === p.grupo_analise).map((c) => c.id)); ls = ls.filter((l) => ids.has(l.categoria_id)) }
        if (p.usuario_id_filtro) ls = ls.filter((l) => l.usuario_id === p.usuario_id_filtro)
        if (p.status) ls = ls.filter((l) => l.status === p.status)
        return ok([...ls].sort((a, c) => (a.data < c.data ? 1 : a.data > c.data ? -1 : 0)))
      }
      case 'salvar_lancamento': {
        const l = p.lancamento as Lancamento
        const cat = b.categorias.find((c) => c.id === l.categoria_id)
        const novo: Lancamento = {
          ...l, id: l.id || gerarId('l'), tipo: l.tipo || cat?.tipo || 'despesa', competencia: l.competencia || competenciaDe(l.data), usuario_id: l.usuario_id || uid,
          status: l.status || 'confirmado', criado_em: l.criado_em || agoraIso(), editado_por: l.id ? uid : undefined,
          hash_dedup: l.hash_dedup || hashDedup(l.valor, l.data, b.cartoes.find((k) => k.id === l.cartao_id)?.final || '', l.estabelecimento || l.descricao || ''),
        }
        const parcelas = Number(p.parcelas || 0)
        const criados = parcelas > 1 && !l.id ? distribuirParcelas(b, novo, parcelas) : [novo]
        for (const c of criados) {
          const idx = b.lancamentos.findIndex((x) => x.id === c.id)
          if (idx >= 0) b.lancamentos[idx] = c; else b.lancamentos.push(c)
          if (c.projeto_id && !l.id) b.aportes.push({ id: gerarId('a'), projeto_id: c.projeto_id, data: c.data, valor: c.valor, usuario_id: c.usuario_id, observacao: c.descricao })
        }
        // aprende a loja
        if (p.aprender_loja && novo.estabelecimento) {
          const chave = normalizar(novo.estabelecimento)
          const r = b.regras_loja.find((x) => x.loja_normalizada === chave)
          if (r) { r.categoria_id = novo.categoria_id; r.acertos++ } else b.regras_loja.push({ id: gerarId('rl'), loja_normalizada: chave, categoria_id: novo.categoria_id, criado_por: uid, criado_em: agoraIso(), acertos: 1 })
        }
        registrarLog(b, uid, l.id ? 'editar_lancamento' : 'novo_lancamento', `${novo.descricao} ${moeda(novo.valor)}`)
        await persistir(); return ok(criados)
      }
      case 'excluir_lancamento': {
        const l = b.lancamentos.find((x) => x.id === p.id)
        if (!l) return erro('Lançamento não encontrado')
        if (eu?.perfil === 'Dependente' && l.usuario_id !== uid) return erro('Sem permissão')
        l.excluido = true; l.editado_por = uid
        registrarLog(b, uid, 'excluir_lancamento', `${l.descricao} ${moeda(l.valor)}`)
        await persistir(); return ok({ id: l.id })
      }
      case 'desfazer_exclusao': { const l = b.lancamentos.find((x) => x.id === p.id); if (!l) return erro('Lançamento não encontrado'); l.excluido = false; await persistir(); return ok(l) }
      case 'painel':
        if (eu?.perfil === 'Dependente') return erro('Sem permissão')
        return ok(painel(b, uid, Number(p.ano || new Date().getFullYear()), p.usuario_id_filtro))

      case 'listar_categorias': return ok(b.categorias)
      case 'salvar_categoria': {
        const c = p.categoria as Categoria
        const g = b.grupos.find((x) => x.id === c.grupo_id)
        const novo: Categoria = { ...c, id: c.id || gerarId('c'), tipo_id: g?.tipo_id ?? c.tipo_id, tipo: g?.tipo_id === 't_receitas' ? 'receita' : 'despesa', cor: c.cor || g?.cor || 'indigo', grupo_analise: c.grupo_analise || g?.grupo_analise || 'Outros', ativa: c.ativa ?? true }
        const i = b.categorias.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.categorias[i] = novo; else b.categorias.push(novo)
        await persistir(); return ok(novo)
      }
      case 'salvar_grupo': {
        const g = p.grupo as Grupo
        if (!['t_receitas', 't_fixas', 't_variaveis'].includes(g.tipo_id)) return erro('Novos grupos só dentro dos 3 tipos.')
        const novo: Grupo = { ...g, id: g.id || gerarId('g'), ativo: g.ativo ?? true, ordem: g.ordem || b.grupos.length + 1 }
        const i = b.grupos.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.grupos[i] = novo; else b.grupos.push(novo)
        await persistir(); return ok(novo)
      }
      case 'listar_regras_loja': return ok(b.regras_loja)
      case 'salvar_regra_loja': {
        const chave = normalizar(String(p.loja || ''))
        if (!chave) return erro('Loja vazia')
        let r = b.regras_loja.find((x) => x.loja_normalizada === chave)
        if (r) { r.categoria_id = p.categoria_id; r.acertos++ } else { r = { id: gerarId('rl'), loja_normalizada: chave, categoria_id: p.categoria_id, criado_por: uid, criado_em: agoraIso(), acertos: 1 }; b.regras_loja.push(r) }
        await persistir(); return ok(r)
      }
      case 'listar_orcamento': return ok(b.orcamento.filter((o) => o.competencia === p.competencia))
      case 'salvar_orcamento': { const itens = p.itens as Orcamento[]; b.orcamento = b.orcamento.filter((o) => o.competencia !== p.competencia).concat(itens.map((i) => ({ ...i, competencia: p.competencia }))); await persistir(); return ok(itens) }
      case 'copiar_orcamento': { const de = b.orcamento.filter((o) => o.competencia === p.de).map((o) => ({ ...o, competencia: p.para })); b.orcamento = b.orcamento.filter((o) => o.competencia !== p.para).concat(de); await persistir(); return ok(de) }

      case 'ler_imagem': {
        const tipo = p.tipo as string
        let leitura: LeituraExtraida
        if (tipo === 'conta') leitura = { empresa: 'Copel Distribuição', competencia: competenciaDe(), vencimento: competenciaDe() + '-20', valor: 412.37, linha_digitavel: '83640000004 1 12370138000 0 00000012345 6 78901234567 8', consumo_valor: 421, consumo_unidade: 'kWh', conta_fixa_id: 'f_luz', categoria_id: 'c_luz', confianca: 0.92, origem_leitura: 'claude', anexo_url: '' }
        else if (tipo === 'fatura_cartao') {
          const existentes = new Set(ativos(b.lancamentos).map((l) => l.hash_dedup))
          const compras = [
            { data: hojeIso(), estabelecimento: 'SUPERMERCADO CONDOR', valor: 312.5 }, { data: hojeIso(), estabelecimento: 'NETFLIX.COM', valor: 55.9 },
            { data: hojeIso(), estabelecimento: 'POSTO SHELL', valor: 210 }, { data: hojeIso(), estabelecimento: 'RENNER', valor: 189.9, parcela: '1/3' },
          ].map((c) => ({ ...c, ja_lancada: existentes.has(hashDedup(c.valor, c.data, '4821', c.estabelecimento)) }))
          leitura = { compras, confianca: 0.9, origem_leitura: 'claude', anexo_url: '' }
        } else leitura = { valor: 187.4, data: hojeIso(), estabelecimento: 'Supermercado Condor — Cristo Rei', cnpj: '76.189.406/0001-81', forma_pgto: 'crédito', categoria_id: 'c_mercado', itens: [{ nome: 'Arroz 5kg', valor: 28.9 }, { nome: 'Carne bovina', valor: 64.5 }, { nome: 'Leite 12un', valor: 59.9 }, { nome: 'Frutas', valor: 34.1 }], confianca: 0.88, origem_leitura: 'claude', anexo_url: '' }
        return ok(leitura)
      }
      case 'ler_texto': {
        const extraido = extrairDeTexto(String(p.texto || ''), b.categorias)
        const regra = extraido.estabelecimento ? b.regras_loja.find((r) => normalizar(extraido.estabelecimento!).includes(r.loja_normalizada)) : null
        if (regra) extraido.categoria_id = regra.categoria_id
        return ok(extraido)
      }
      case 'consultar_nfce': return ok({ valor: 187.4, data: hojeIso(), estabelecimento: 'Supermercado Condor — Cristo Rei', cnpj: '76.189.406/0001-81', categoria_id: 'c_mercado', confianca: 0.99, origem_leitura: 'nfce' } satisfies LeituraExtraida)

      case 'listar_contas_fixas': return ok(b.contas_fixas)
      case 'salvar_conta_fixa': { const c = p.conta_fixa as ContaFixa; const novo = { ...c, id: c.id || gerarId('f') }; const i = b.contas_fixas.findIndex((x) => x.id === novo.id); if (i >= 0) b.contas_fixas[i] = novo; else b.contas_fixas.push(novo); await persistir(); return ok(novo) }
      case 'listar_contas_a_pagar': { let cs = b.contas_a_pagar; if (p.competencia) cs = cs.filter((c) => c.competencia === p.competencia); if (p.status) cs = cs.filter((c) => c.status === p.status); return ok([...cs].sort((a, c) => (a.vencimento < c.vencimento ? -1 : 1))) }
      case 'salvar_conta_a_pagar': { const c = p.conta as ContaAPagar; const novo = { ...c, id: c.id || gerarId('cp'), status: c.status || 'aberta' }; const i = b.contas_a_pagar.findIndex((x) => x.id === novo.id); if (i >= 0) b.contas_a_pagar[i] = novo; else b.contas_a_pagar.push(novo); await persistir(); return ok(novo) }
      case 'marcar_conta_paga': {
        const c = b.contas_a_pagar.find((x) => x.id === p.id)
        if (!c) return erro('Conta não encontrada')
        const cf = b.contas_fixas.find((f) => f.id === c.conta_fixa_id)
        c.status = 'paga'; c.pago_em = hojeIso(); c.pago_por = uid
        b.lancamentos = b.lancamentos.filter((l) => !(l.status === 'a_confirmar' && l.competencia === c.competencia && l.categoria_id === cf?.categoria_id && !l.parcela))
        const l: Lancamento = { id: gerarId('l'), data: hojeIso(), competencia: c.competencia, tipo: 'despesa', valor: c.valor, categoria_id: cf?.categoria_id || 'c_imprevistos', descricao: cf?.nome || 'Conta', estabelecimento: cf?.nome || '', forma_pgto: (p.forma_pgto as FormaPgto) || 'boleto', usuario_id: uid, origem: 'fatura', status: 'confirmado', criado_em: agoraIso(), anexo_url: c.anexo_url }
        b.lancamentos.push(l); c.lancamento_id = l.id
        registrarLog(b, uid, 'pagar_conta', `${cf?.nome} ${moeda(c.valor)}`)
        await persistir(); return ok(c)
      }
      case 'consumo_historico': return ok(b.contas_a_pagar.filter((c) => c.conta_fixa_id === p.conta_fixa_id).sort((a, c) => (a.competencia < c.competencia ? -1 : 1)).map((c) => ({ competencia: c.competencia, consumo_valor: c.consumo_valor ?? 0, consumo_unidade: c.consumo_unidade ?? '', valor: c.valor })))
      case 'proximas_saidas': return ok(proximasSaidas(b, Number(p.dias || 30)))

      case 'listar_cartoes': return ok(b.cartoes)
      case 'salvar_cartao': { const k = p.cartao as Cartao; const novo = { ...k, id: k.id || gerarId('k'), final: String(k.final).replace(/\D/g, '').slice(-4), ativo: k.ativo ?? true }; const i = b.cartoes.findIndex((x) => x.id === novo.id); if (i >= 0) b.cartoes[i] = novo; else b.cartoes.push(novo); await persistir(); return ok(novo) }

      case 'listar_caixa_entrada': { let cs = b.caixa_entrada; if (eu?.perfil === 'Dependente') cs = cs.filter((c) => c.usuario_id === uid); if (p.status) cs = cs.filter((c) => c.status === p.status); return ok(cs) }
      case 'resolver_caixa_entrada': {
        const c = b.caixa_entrada.find((x) => x.id === p.id)
        if (!c) return erro('Item não encontrado')
        if (p.acao_caixa === 'ignorar') c.status = 'ignorado'
        else {
          const cartao = b.cartoes.find((k) => k.final === c.final_cartao)
          const catId = p.categoria_id || c.sugestao_categoria
          const l: Lancamento = { id: gerarId('l'), data: c.data_compra, competencia: competenciaDe(c.data_compra), tipo: 'despesa', valor: c.valor, categoria_id: catId, descricao: p.descricao || c.estabelecimento, estabelecimento: c.estabelecimento, forma_pgto: 'crédito', cartao_id: cartao?.id, usuario_id: c.usuario_id, origem: c.canal === 'email' ? 'email' : c.canal === 'fatura' ? 'fatura' : 'sms', status: 'confirmado', criado_em: agoraIso(), hash_dedup: hashDedup(c.valor, c.data_compra, c.final_cartao, c.estabelecimento) }
          b.lancamentos.push(l); c.status = 'lançado'; c.lancamento_id = l.id
          if (catId !== c.sugestao_categoria) { const chave = normalizar(c.estabelecimento); const r = b.regras_loja.find((x) => x.loja_normalizada === chave); if (r) r.categoria_id = catId; else b.regras_loja.push({ id: gerarId('rl'), loja_normalizada: chave, categoria_id: catId, criado_por: uid, criado_em: agoraIso(), acertos: 1 }) }
        }
        await persistir(); return ok(c)
      }
      case 'importar_fatura': {
        const existentes = ativos(b.lancamentos)
        const cartao = b.cartoes.find((k) => k.id === p.cartao_id)
        const linhas = String(p.texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        // CSV brasileiro: separador ";" (ou tabulação) e vírgula decimal; só usa a vírgula como separador quando não há outro.
        const compras = (linhas.length ? linhas.map((ln) => { const sep = ln.includes(';') ? ';' : ln.includes('\t') ? '\t' : ','; const [data, est, val] = ln.split(sep).map((s) => s.trim()); return { data: data?.includes('/') ? data.split('/').reverse().join('-') : data, estabelecimento: est || '', valor: Number(String(val ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0 } }) : [
          { data: hojeIso(), estabelecimento: 'SUPERMERCADO CONDOR', valor: 312.5 }, { data: hojeIso(), estabelecimento: 'NETFLIX.COM', valor: 55.9 }, { data: competenciaDe() + '-03', estabelecimento: 'CLARO', valor: 189 },
        ]).map((c) => {
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
          const regra = b.regras_loja.find((r) => normalizar(c.estabelecimento).includes(r.loja_normalizada))
          const sug = sugerirCategoria(c.estabelecimento, b.categorias)
          if (regra) sug.unshift(regra.categoria_id)
          const item: ItemCaixaEntrada = { id: gerarId('ce'), recebido_em: agoraIso(), canal: 'fatura', texto_bruto: `${c.data} ${c.estabelecimento} ${c.valor}`, valor: c.valor, estabelecimento: c.estabelecimento, final_cartao: cartao?.final || '', data_compra: c.data, sugestao_categoria: sug[0] || 'c_imprevistos', sugestoes: [...new Set(sug)].slice(0, 6), usuario_id: cartao?.titular_id || uid, status: 'pendente' }
          b.caixa_entrada.push(item); criados.push(item)
        }
        await persistir(); return ok(criados)
      }

      case 'listar_projetos': return ok(b.projetos.map((pr) => comProjetoCalculado(b, pr)))
      case 'salvar_projeto': {
        const pr = p.projeto as Projeto
        if (eu?.perfil === 'Dependente' && pr.id && b.projetos.find((x) => x.id === pr.id)?.criado_por !== uid) return erro('Sem permissão')
        const novo: Projeto = { ...pr, id: pr.id || gerarId('p'), criado_por: pr.criado_por || uid, criado_em: pr.criado_em || agoraIso(), status: pr.status || 'ativo', icone: pr.icone || 'target' }
        const i = b.projetos.findIndex((x) => x.id === novo.id)
        if (i >= 0) b.projetos[i] = novo; else b.projetos.push(novo)
        await persistir(); return ok(comProjetoCalculado(b, novo))
      }
      case 'aportar': {
        const a: Aporte = { id: gerarId('a'), projeto_id: p.projeto_id, data: hojeIso(), valor: Number(p.valor), usuario_id: uid, observacao: p.observacao || '' }
        b.aportes.push(a)
        const pr = b.projetos.find((x) => x.id === a.projeto_id)
        b.lancamentos.push({ id: gerarId('l'), data: a.data, competencia: competenciaDe(), tipo: 'despesa', valor: a.valor, categoria_id: 'c_aporte_projeto', descricao: `Aporte: ${pr?.nome ?? ''}`, estabelecimento: 'Poupança', forma_pgto: 'pix', usuario_id: uid, origem: 'manual', status: 'confirmado', criado_em: agoraIso(), projeto_id: a.projeto_id })
        if (pr && valorAtual(b, pr) >= pr.meta_valor) pr.status = 'concluído'
        registrarLog(b, uid, 'aporte', `${pr?.nome} ${moeda(a.valor)}`)
        await persistir(); return ok(a)
      }
      case 'listar_aportes': return ok(b.aportes.filter((a) => a.projeto_id === p.projeto_id).sort((a, c) => (a.data < c.data ? 1 : -1)))

      case 'listar_decisoes': { let ds = b.decisoes; if (p.status) ds = ds.filter((d) => d.status === p.status); return ok(ds.map((d) => ({ ...d, votos: b.votos.filter((v) => v.decisao_id === d.id) }))) }
      case 'salvar_decisao': { const d = p.decisao as Decisao; const novo: Decisao = { ...d, id: d.id || gerarId('d'), criado_por: d.criado_por || uid, criado_em: d.criado_em || agoraIso(), status: d.status || 'aberta' }; const i = b.decisoes.findIndex((x) => x.id === novo.id); if (i >= 0) b.decisoes[i] = novo; else b.decisoes.push(novo); await persistir(); return ok({ ...novo, votos: b.votos.filter((v) => v.decisao_id === novo.id) }) }
      case 'votar': {
        const d = b.decisoes.find((x) => x.id === p.decisao_id)
        if (!d) return erro('Decisão não encontrada')
        if (d.status !== 'aberta') return erro('Esta votação já foi encerrada')
        b.votos = b.votos.filter((v) => !(v.decisao_id === d.id && v.usuario_id === uid))
        b.votos.push({ decisao_id: d.id, usuario_id: uid, voto: p.voto, comentario: p.comentario || '', data: agoraIso() })
        await persistir(); return ok({ ...d, votos: b.votos.filter((v) => v.decisao_id === d.id) })
      }
      case 'encerrar_decisao': {
        const d = b.decisoes.find((x) => x.id === p.decisao_id)
        if (!d) return erro('Decisão não encontrada')
        const vs = b.votos.filter((v) => v.decisao_id === d.id)
        const sim = vs.filter((v) => v.voto === 'sim').length, nao = vs.filter((v) => v.voto === 'não').length
        let aprovada = sim > nao
        if (b.config.regra_votacao === 'maioria_mais_pais') { const pais = b.usuarios.filter((u) => u.perfil === 'Administrador').map((u) => u.id); aprovada = aprovada && !vs.some((v) => pais.includes(v.usuario_id) && v.voto === 'não') }
        d.status = aprovada ? 'aprovada' : 'recusada'
        if (d.projeto_id) { const pr = b.projetos.find((x) => x.id === d.projeto_id); if (pr) pr.status = aprovada ? 'ativo' : 'pausado' }
        await persistir(); return ok({ ...d, votos: vs })
      }
      case 'pauta_reuniao': {
        const comp = String(p.competencia || competenciaDe())
        const existente = b.reunioes.find((r) => r.competencia === comp)
        if (existente) return ok(existente)
        return ok({ id: gerarId('r'), competencia: comp, data: hojeIso(), pauta: gerarPauta(b, uid, comp), decidido: '', oracao_gratidao: '', criado_por: uid } satisfies Reuniao)
      }
      case 'salvar_reuniao': { const r = p.reuniao as Reuniao; const novo = { ...r, id: r.id || gerarId('r') }; const i = b.reunioes.findIndex((x) => x.id === novo.id || x.competencia === novo.competencia); if (i >= 0) b.reunioes[i] = novo; else b.reunioes.push(novo); await persistir(); return ok(novo) }
      case 'listar_reunioes': return ok([...b.reunioes].sort((a, c) => (a.competencia < c.competencia ? 1 : -1)))
      case 'relatorio_mensal': {
        const comp = String(p.competencia || somarMeses(competenciaDe(), -1))
        const d = painel(b, uid, Number(comp.slice(0, 4)))
        const idx = Number(comp.slice(5)) - 1
        const projecao = [1, 2, 3].map((k) => { const c = somarMeses(comp, k); const m = d.meses.find((x) => x.competencia === c) ?? d.meses[Math.min(11, idx + k)]; return { competencia: c, receitas: m.receitas, despesas: m.despesas, saldo: m.saldo } })
        return ok({ markdown: gerarPauta(b, uid, comp).replace('# Reunião da família', '# Relatório do mês'), projecao })
      }

      case 'listar_avisos': return ok(gerarAvisos(b).slice(0, Number(p.limite || 20)))
      case 'marcar_aviso_lido': { const a = gerarAvisos(b).find((x) => x.id === p.id); if (!a) return erro('Aviso não encontrado'); b.avisos = b.avisos.filter((x) => x.id !== a.id).concat({ ...a, lido: true }); await persistir(); return ok({ ...a, lido: true }) }
      case 'listar_alertas': return ok(alertasCalculados(b))
      case 'salvar_alerta': { const a = p.alerta as Alerta; const novo: Alerta = { ...a, id: a.id || gerarId('al'), ativo: a.ativo ?? true, avisar: a.avisar || [] }; const i = b.alertas.findIndex((x) => x.id === novo.id); if (i >= 0) b.alertas[i] = novo; else b.alertas.push(novo); await persistir(); return ok(alertasCalculados(b).find((x) => x.id === novo.id)) }
      case 'excluir_alerta': { b.alertas = b.alertas.filter((x) => x.id !== p.id); await persistir(); return ok({ id: p.id }) }

      case 'assistente': {
        const minha: MensagemAssistente = { id: gerarId('m'), papel: 'eu', texto: String(p.mensagem || ''), data: agoraIso() }
        const resposta = responderAssistente(b, uid, minha.texto)
        b.conversas.push({ ...minha, id: `${uid}_${minha.id}` }, { ...resposta, id: `${uid}_${resposta.id}` })
        if (b.conversas.length > 400) b.conversas.splice(0, b.conversas.length - 400)
        await persistir(); return ok(resposta)
      }
      case 'assistente_sugestoes': return ok(['Quanto gastamos com delivery este mês?', 'Onde podemos economizar?', 'Quais assinaturas temos?', `Como fechamos ${MESES[Number(somarMeses(competenciaDe(), -1).slice(5)) - 1].toLowerCase()}?`, 'Contas que vencem esta semana', 'Dá para fechar a viagem de julho?'])
      case 'listar_conversa': return ok(b.conversas.filter((m) => m.id.startsWith(`${uid}_`)).slice(-Number(p.limite || 40)))

      case 'listar_patrimonio': return ok(b.patrimonio)
      case 'salvar_patrimonio': { const pt = p.patrimonio as Patrimonio; const novo: Patrimonio = { ...pt, id: pt.id || gerarId('pt'), saldos: pt.saldos || [], ativo: pt.ativo ?? true }; const i = b.patrimonio.findIndex((x) => x.id === novo.id); if (i >= 0) b.patrimonio[i] = novo; else b.patrimonio.push(novo); await persistir(); return ok(novo) }
      case 'registrar_saldo_patrimonio': { const pt = b.patrimonio.find((x) => x.id === p.id); if (!pt) return erro('Item não encontrado'); pt.saldos = pt.saldos.filter((s) => s.competencia !== p.competencia).concat({ competencia: p.competencia, valor: Number(p.valor) }).sort((a, c) => (a.competencia < c.competencia ? -1 : 1)); await persistir(); return ok(pt) }

      case 'listar_usuarios': return ok(b.usuarios.map((u) => ({ ...u, token: eu?.perfil === 'Administrador' ? u.token : undefined })))
      case 'salvar_usuario': { const u = p.usuario as Usuario; const novo = { ...u, id: u.id || gerarId('u'), criado_em: u.criado_em || agoraIso(), ultimo_acesso: u.ultimo_acesso || agoraIso(), token: u.token || gerarId('tok') }; const i = b.usuarios.findIndex((x) => x.id === novo.id); if (i >= 0) b.usuarios[i] = { ...b.usuarios[i], ...novo, token: b.usuarios[i].token }; else b.usuarios.push(novo); await persistir(); return ok(novo) }
      case 'gerar_convite': { const codigo = Math.random().toString(36).slice(2, 8).toUpperCase(); return ok({ codigo_convite: codigo, url: `${location.origin}${location.pathname}#/entrar?convite=${codigo}&perfil=${encodeURIComponent(p.perfil || 'Adulto')}&demo=1`, expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString() }) }
      case 'renovar_token': { const u = b.usuarios.find((x) => x.id === (p.usuario_id || uid)); if (!u) return erro('Usuário não encontrado'); u.token = gerarId('tok'); await persistir(); return ok({ token: u.token }) }
      case 'redefinir_pin': return ok({ ok: true })
      case 'salvar_config': b.config = { ...b.config, ...(p.config as Partial<Config>) }; await persistir(); return ok(b.config)
      case 'enviar_arquivo': return ok({ url: `data:${p.mime};base64,${p.imagem_base64}`, id: gerarId('arq') })
      case 'salvar_brasao_svg': { const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(String(p.svg))))}`; b.config.url_brasao = url; await persistir(); return ok({ url_brasao: url, url_icone_192: url, url_icone_512: url }) }
      case 'versiculo_do_dia': return ok(versiculoDoDia(p.tema))
      case 'mesada': {
        const alvo = b.usuarios.find((u) => u.id === (p.usuario_id || uid))
        const comp = String(p.competencia || competenciaDe())
        const gasto = ativos(b.lancamentos).filter((l) => l.usuario_id === alvo?.id && l.competencia === comp && l.tipo === 'despesa' && l.categoria_id !== 'c_aporte_projeto').reduce((s, l) => s + l.valor, 0)
        const cofrinho = b.aportes.filter((a) => a.usuario_id === alvo?.id).reduce((s, a) => s + a.valor, 0)
        return ok({ mesada_mensal: alvo?.mesada_mensal ?? 0, gasto, saldo: (alvo?.mesada_mensal ?? 0) - gasto, cofrinho })
      }
      case 'exportar': {
        const ls = ativos(b.lancamentos).filter((l) => !p.competencia || l.competencia === p.competencia)
        const catMap = new Map(b.categorias.map((c) => [c.id, c.nome]))
        const linhas = ['data;tipo;valor;categoria;descricao;loja;forma_pgto;quem;origem', ...ls.map((l) => [l.data, l.tipo, l.valor.toFixed(2).replace('.', ','), catMap.get(l.categoria_id) ?? '', l.descricao, l.estabelecimento, l.forma_pgto, b.usuarios.find((u) => u.id === l.usuario_id)?.apelido ?? '', l.origem].join(';'))]
        return ok({ url: URL.createObjectURL(new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })) })
      }
      case 'backup_agora': return ok({ url: b.config.url_pasta_drive || '#' })
      case 'registrar_push': return ok({ ok: true })
      case 'vincular_telegram': return ok({ codigo: String(Math.floor(100000 + Math.random() * 900000)), url_bot: 'https://t.me/FinancasDaFamiliaBot' })
      case 'log': return ok(b.log.slice(0, Number(p.limite || 100)))
      case 'reiniciar_demo': await reiniciarDemo(); return ok({ ok: true })
      default: return erro(`Ação desconhecida no modo demonstração: ${acao}`)
    }
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Erro inesperado')
  }
}
