/**
 * setup.gs — Instalação: pasta no Drive, planilha com todas as abas, dados iniciais,
 * primeiro administrador, gatilhos. Também dados de exemplo (seed) e utilitários do Drive.
 *
 * Como usar (no editor do Apps Script): escolha a função `instalar` e clique em Executar.
 * É idempotente: rodar de novo não duplica nada (só completa o que faltar).
 *
 * Script Properties usadas (Configurações do projeto → Propriedades do script):
 *  - SOBRENOME (opcional): nome da família. Padrão: SOBRENOME_PADRAO abaixo.
 *  - URL_APP: endereço do app publicado (para montar o link de convite).
 *  - CHAVE_API_CLAUDE / MODELO_CLAUDE: leitura inteligente (opcional).
 *  - URL_SERVICO_PUSH / TOKEN_SERVICO_PUSH: notificações push (opcional).
 *  - EMAILS_ADMIN: e-mails dos administradores para os resumos (opcional).
 *  - ID_PASTA / ID_PLANILHA: gravadas automaticamente por instalar().
 */

/** Sobrenome padrão da família (pode editar aqui ou definir SOBRENOME nas Script Properties). */
const SOBRENOME_PADRAO = 'Melo Reis';

/** Subpastas criadas dentro de "Finanças da Família <Sobrenome>". */
const SUBPASTAS = ['Cupons e Recibos', 'Contas da Casa', 'Contas da Casa/_Entrada', 'Faturas de Cartão', 'Projetos e Sonhos', 'Identidade da Família', 'Backups'];

/** PIN inicial do primeiro administrador — TROQUE no primeiro acesso. */
const PIN_INICIAL_ADMIN = '1234';

function obterSobrenome() {
  return propriedade('SOBRENOME', SOBRENOME_PADRAO);
}

// ---------- Utilitários do Drive (usados por vários arquivos) ----------

/** Procura uma subpasta pelo nome; cria se não existir. */
function obterOuCriarSubpasta(pai, nome) {
  const it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

/** Pasta raiz "Finanças da Família <Sobrenome>" (id em ID_PASTA; procura/cria se preciso). */
function pastaRaiz() {
  const id = propriedade('ID_PASTA', '');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* foi apagada: recria abaixo */ }
  }
  const pasta = obterOuCriarSubpasta(DriveApp.getRootFolder(), 'Finanças da Família ' + obterSobrenome());
  definirPropriedade('ID_PASTA', pasta.getId());
  return pasta;
}

/** Pasta por caminho relativo à raiz, criando o que faltar: "Contas da Casa/2026/10". */
function pastaPorCaminho(caminho) {
  let pasta = pastaRaiz();
  String(caminho || '').split('/').map((s) => s.trim()).filter(Boolean).forEach((nome) => { pasta = obterOuCriarSubpasta(pasta, nome); });
  return pasta;
}

/** "Qualquer pessoa com o link pode ver" — necessário para o app mostrar imagens/anexos sem login Google. */
function compartilharComLink(arquivo) {
  try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { console.warn('Não consegui compartilhar com link: ' + e.message); }
}

/** URL de visualização direta (serve como src de <img>). */
function urlVisualizacao(id) {
  return 'https://drive.google.com/uc?export=view&id=' + id;
}

/** URL de download direto. */
function urlDownload(id) {
  return 'https://drive.google.com/uc?export=download&id=' + id;
}

// ---------- Instalação ----------

/**
 * Cria tudo o que o sistema precisa. Pode rodar quantas vezes quiser.
 * Ao final, imprime no log o token da família e o próximo passo.
 */
function instalar() {
  const sobrenome = obterSobrenome();
  const pasta = pastaRaiz();
  SUBPASTAS.forEach((p) => pastaPorCaminho(p));

  // Planilha dentro da pasta.
  let idPlanilha = propriedade('ID_PLANILHA', '');
  let planilha = null;
  if (idPlanilha) { try { planilha = SpreadsheetApp.openById(idPlanilha); } catch (e) { planilha = null; } }
  if (!planilha) {
    const existentes = pasta.getFilesByName(NOME_PLANILHA);
    if (existentes.hasNext()) planilha = SpreadsheetApp.open(existentes.next());
    else {
      planilha = SpreadsheetApp.create(NOME_PLANILHA);
      DriveApp.getFileById(planilha.getId()).moveTo(pasta);
    }
    idPlanilha = planilha.getId();
    definirPropriedade('ID_PLANILHA', idPlanilha);
  }
  _memoria.planilha = planilha;
  planilha.setSpreadsheetTimeZone(FUSO);

  // Abas e cabeçalhos.
  ORDEM_ABAS.forEach((nome) => { obterAba(nome); garantirColunas(nome); });
  const padrao = planilha.getSheets().find((s) => ['Sheet1', 'Página1', 'Planilha1'].indexOf(s.getName()) >= 0);
  if (padrao && planilha.getSheets().length > 1) planilha.deleteSheet(padrao);

  // Dados iniciais (só se a aba estiver vazia).
  if (!lerAba('Grupos').length) inserirLinhas('Grupos', dadosIniciaisGrupos());
  if (!lerAba('Categorias').length) inserirLinhas('Categorias', dadosIniciaisCategorias());
  if (!lerAba('Versiculos').length) inserirLinhas('Versiculos', dadosIniciaisVersiculos());

  // Config: completa o que faltar; token da família.
  const atual = lerConfigCompleta();
  const faltando = {};
  const base = configPadrao(sobrenome);
  Object.keys(base).forEach((k) => { if (atual[k] === undefined) faltando[k] = base[k]; });
  if (!atual.token_familia) faltando.token_familia = gerarToken(24);
  faltando.url_planilha = planilha.getUrl();
  faltando.url_pasta_drive = pasta.getUrl();
  salvarConfigChaves(faltando);

  // Primeiro administrador.
  let avisoPin = '';
  if (!lerAba('Usuarios').length) {
    const agora = agoraIso();
    inserirLinhas('Usuarios', [Object.assign({
      id: gerarId('u'), nome: 'Administrador', apelido: 'Administrador', avatar: '👤', cor: '#5B5BE0', perfil: 'Administrador',
      ativo: true, criado_em: agora, ultimo_acesso: agora, mesada_mensal: 0, token: gerarToken(32), origem: 'instalacao',
    }, prepararPin(PIN_INICIAL_ADMIN))]);
    avisoPin = 'Usuário "Administrador" criado com PIN ' + PIN_INICIAL_ADMIN + ' — TROQUE o PIN no primeiro acesso (Mais → Família → Redefinir PIN).';
  }

  instalarGatilhos();

  const cfg = lerConfigCompleta();
  const resumo = {
    pasta: pasta.getUrl(),
    planilha: planilha.getUrl(),
    token_familia: cfg.token_familia,
    proximo_passo: 'Implantar → Nova implantação → App da Web (Executar como: Eu; Acesso: Qualquer pessoa). Depois defina URL_APP e, se quiser, CHAVE_API_CLAUDE nas Propriedades do script.',
  };
  console.log('Instalação concluída.\n' + (avisoPin ? avisoPin + '\n' : '') + JSON.stringify(resumo, null, 2));
  return resumo;
}

// ---------- Gatilhos ----------

/** Funções que rodam sozinhas e seu horário. */
const GATILHOS = [
  { fn: 'processarEmails', tipo: 'hora' },
  { fn: 'processarPastaEntrada', tipo: 'hora' },
  { fn: 'gerarPrevistosDoMes', tipo: 'dia', hora: 6 },
  { fn: 'avisarVencimentos', tipo: 'dia', hora: 8 },
  { fn: 'backupSemanal', tipo: 'semana' },
];

/** Remove todos os gatilhos deste projeto. */
function desinstalar_gatilhos() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  console.log('Gatilhos removidos.');
}

/** (Re)instala todos os gatilhos (idempotente: apaga os antigos antes). */
function instalarGatilhos() {
  desinstalar_gatilhos();
  GATILHOS.forEach((g) => {
    const b = ScriptApp.newTrigger(g.fn).timeBased();
    if (g.tipo === 'hora') b.everyHours(1).create();
    else if (g.tipo === 'dia') b.everyDays(1).atHour(g.hora).create();
    else b.onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  });
  instalarGatilhoLembrete(lerConfig().lembrete_horario || '20:00');
  console.log('Gatilhos instalados: ' + ScriptApp.getProjectTriggers().length);
}

/** Gatilho do lembrete diário na hora configurada (Config.lembrete_horario, "HH:MM"). */
function instalarGatilhoLembrete(horario) {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'lembreteDiario').forEach((t) => ScriptApp.deleteTrigger(t));
  const hora = Math.min(23, Math.max(0, Number(String(horario || '20:00').split(':')[0]) || 20));
  ScriptApp.newTrigger('lembreteDiario').timeBased().everyDays(1).atHour(hora).create();
}

// ---------- Dados de exemplo ----------

/** Gerador pseudoaleatório determinístico (os números são sempre os mesmos). */
function criarAleatorio(semente) {
  let s = semente;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const PREFIXO_SEED = 'seed_';

/**
 * seed_exemplo(): 12 meses de dados coerentes com o modo demonstração do app
 * (4 usuários, 2 cartões, 8 contas fixas, salários, dízimo, dia a dia, aportes, 4 sonhos,
 * 2 decisões, 3 itens na caixa de entrada). Tudo com id começando por "seed_" para
 * limpar_exemplo() conseguir remover. Os usuários de exemplo entram com PIN 1234.
 */
function seed_exemplo() {
  if (lerAba('Usuarios').some((u) => u.id.indexOf(PREFIXO_SEED) === 0)) { console.log('Dados de exemplo já existem. Rode limpar_exemplo() antes.'); return; }
  const rnd = criarAleatorio(2026);
  const entre = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;
  const escolher = (arr) => arr[Math.floor(rnd() * arr.length)];
  let seq = 0;
  const sid = (prefixo) => PREFIXO_SEED + prefixo + '_' + (++seq).toString(36);
  const agora = agoraIso();
  const hoje = hojeIso();
  const compAtual = competenciaDe();
  const pin = prepararPin('1234');

  const usuarios = [
    { id: 'seed_u_pai', nome: 'Luiz', apelido: 'Pai', avatar: '👨', cor: '#5B5BE0', perfil: 'Administrador', mesada_mensal: 0 },
    { id: 'seed_u_mae', nome: 'Ana', apelido: 'Mãe', avatar: '👩', cor: '#BD55C7', perfil: 'Administrador', mesada_mensal: 0 },
    { id: 'seed_u_filha', nome: 'Júlia', apelido: 'Ju', avatar: '👧', cor: '#F2C552', perfil: 'Júnior', mesada_mensal: 150 },
    { id: 'seed_u_filho', nome: 'Pedro', apelido: 'Pedrão', avatar: '👦', cor: '#4CB963', perfil: 'Júnior', mesada_mensal: 100 },
  ].map((u) => Object.assign(u, { ativo: true, criado_em: agora, ultimo_acesso: agora, token: gerarToken(32), origem: 'seed' }, pin));
  inserirLinhas('Usuarios', usuarios);

  const cartoes = [
    { id: 'seed_k_itau_pai', apelido: 'Itaú do Pai', banco: 'Itaú', final: '4321', titular_id: 'seed_u_pai', dia_fechamento: 25, dia_vencimento: 5, cor: '#E0852F', ativo: true },
    { id: 'seed_k_nu_mae', apelido: 'Nubank da Mãe', banco: 'Nubank', final: '8765', titular_id: 'seed_u_mae', dia_fechamento: 20, dia_vencimento: 1, cor: '#BD55C7', ativo: true },
  ];
  inserirLinhas('Cartoes', cartoes);

  const contasFixas = [
    { id: 'seed_f_luz', nome: 'Copel (luz)', categoria_id: 'c_luz', valor_previsto: 280, dia_vencimento: 10, remetente_email: 'copel.com', codigo_cliente: '12345678' },
    { id: 'seed_f_agua', nome: 'Sanepar (água)', categoria_id: 'c_agua', valor_previsto: 110, dia_vencimento: 15, remetente_email: 'sanepar.com.br', codigo_cliente: '987654' },
    { id: 'seed_f_gas', nome: 'Compagas (gás)', categoria_id: 'c_gas', valor_previsto: 95, dia_vencimento: 12, remetente_email: 'compagas.com.br', codigo_cliente: '55443' },
    { id: 'seed_f_internet', nome: 'Internet fibra', categoria_id: 'c_internet', valor_previsto: 129.9, dia_vencimento: 8, remetente_email: 'vivo.com.br', codigo_cliente: '' },
    { id: 'seed_f_plano', nome: 'Unimed', categoria_id: 'c_plano_saude', valor_previsto: 890, dia_vencimento: 20, remetente_email: 'unimed.coop.br', codigo_cliente: '' },
    { id: 'seed_f_escola', nome: 'Colégio', categoria_id: 'c_escola', valor_previsto: 1250, dia_vencimento: 5, remetente_email: '', codigo_cliente: '' },
    { id: 'seed_f_aluguel', nome: 'Prestação da casa', categoria_id: 'c_aluguel', valor_previsto: 2100, dia_vencimento: 10, remetente_email: '', codigo_cliente: '' },
    { id: 'seed_f_condominio', nome: 'Condomínio', categoria_id: 'c_condominio', valor_previsto: 480, dia_vencimento: 10, remetente_email: '', codigo_cliente: '' },
  ].map((c) => Object.assign(c, { ativa: true }));
  inserirLinhas('ContasFixas', contasFixas);

  const estabelecimentos = {
    c_mercado: ['Condor Super Center', 'Muffato', 'Festval', 'Atacadão'], c_feira: ['Feira do Batel', 'Hortifruti Boa Safra'],
    c_padaria: ['Padaria Pão Quente', 'Panificadora Imperial'], c_delivery: ['iFood', 'Pizzaria Baggio', 'Rappi'],
    c_farmacia: ['Drogaria Nissei', 'Panvel'], c_cuidados: ['Salão da Vera', 'Barbearia do Zé', 'O Boticário'],
    c_combustivel: ['Posto Shell', 'Posto Ipiranga'], c_transporte: ['Uber', 'Estacionamento Shopping'],
    c_passeios: ['Churrascaria Jardins', 'Cinemark', 'Café do Mercado'], c_streaming: ['Netflix', 'Spotify', 'Disney+'],
    c_hobbies: ['Smart Fit', 'Livraria Curitiba'], c_roupas: ['Renner', 'Riachuelo', 'Centauro'],
    c_presentes: ['Floricultura Flores & Cia', 'Loja de Presentes'], c_casa_manutencao: ['Leroy Merlin', 'Balaroti'], c_pet: ['Petz', 'Cobasi'],
  };
  const faixas = {
    c_mercado: [5, 180, 520], c_feira: [4, 40, 90], c_padaria: [10, 12, 48], c_delivery: [5, 35, 120], c_farmacia: [3, 25, 160],
    c_cuidados: [2, 40, 120], c_combustivel: [4, 150, 250], c_transporte: [4, 12, 45], c_passeios: [3, 60, 220], c_streaming: [3, 21.9, 55.9],
    c_hobbies: [2, 50, 120], c_roupas: [2, 80, 350], c_presentes: [1, 60, 200], c_casa_manutencao: [1, 40, 400], c_pet: [2, 60, 180],
  };
  const categorias = lerAba('Categorias');
  const lancamentos = [], contasAPagar = [], orcamento = [], aportes = [];
  const competencias = [];

  for (let i = 11; i >= 0; i--) {
    const comp = somarMeses(compAtual, -i);
    competencias.push(comp);
    const mes = Number(comp.slice(5, 7));
    const ultimoDia = ultimoDiaDoMes(comp);
    const ehAtual = comp === compAtual;
    const diaMax = ehAtual ? Number(hoje.slice(8, 10)) : ultimoDia;
    const dia = (d) => comp + '-' + zeros(Math.min(d, diaMax));
    const add = (l) => {
      if (Number(l.data.slice(8, 10)) > diaMax) return;
      lancamentos.push(Object.assign({ id: sid('l'), competencia: comp, criado_em: l.data + 'T12:00:00', status: 'confirmado', cartao_id: '', parcela: '', anexo_url: '', editado_por: '', excluido: false, projeto_id: '', hash_dedup: '' }, l));
    };

    add({ data: dia(5), tipo: 'receita', valor: 8500, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'seed_u_pai', origem: 'recorrente' });
    add({ data: dia(5), tipo: 'receita', valor: 6200, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'seed_u_mae', origem: 'recorrente' });
    if (rnd() > 0.5) add({ data: dia(18), tipo: 'receita', valor: entre(300, 1500), categoria_id: 'c_renda_extra', descricao: 'Consultoria', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'seed_u_pai', origem: 'manual' });
    add({ data: dia(1), tipo: 'receita', valor: 150, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'seed_u_filha', origem: 'recorrente' });
    add({ data: dia(1), tipo: 'receita', valor: 100, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'seed_u_filho', origem: 'recorrente' });

    add({ data: dia(7), tipo: 'despesa', valor: 1470, categoria_id: 'c_dizimo', descricao: 'Dízimo', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'seed_u_pai', origem: 'recorrente' });
    add({ data: dia(14), tipo: 'despesa', valor: entre(50, 200), categoria_id: 'c_ofertas', descricao: 'Oferta', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'seed_u_mae', origem: 'manual' });
    if (rnd() > 0.6) add({ data: dia(21), tipo: 'despesa', valor: 100, categoria_id: 'c_missoes', descricao: 'Missões', estabelecimento: 'Agência Missionária', forma_pgto: 'pix', usuario_id: 'seed_u_pai', origem: 'manual' });

    contasFixas.forEach((cf) => {
      let valor = cf.valor_previsto, consumo, unidade;
      if (cf.id === 'seed_f_luz') { const fator = 1 + 0.35 * Math.cos(((mes - 1) / 12) * 2 * Math.PI); valor = Math.round(cf.valor_previsto * fator * (0.95 + rnd() * 0.1) * 100) / 100; consumo = Math.round(valor / 0.95); unidade = 'kWh'; }
      else if (cf.id === 'seed_f_agua') { valor = entre(90, 140); consumo = Math.round(valor / 9); unidade = 'm³'; }
      else if (cf.id === 'seed_f_gas') { valor = entre(80, 120); consumo = Math.round(valor / 7); unidade = 'm³'; }
      const venc = comp + '-' + zeros(cf.dia_vencimento);
      const paga = venc <= hoje;
      const conta = {
        id: sid('cp'), conta_fixa_id: cf.id, competencia: comp, valor, vencimento: venc,
        linha_digitavel: '83640000001 2 21440138000 0 00000012345 6 78901234567 8',
        pix_copia_cola: '00020126580014br.gov.bcb.pix0136demo-chave-pix-familia520400005303986540' + valor.toFixed(2) + '5802BR5913FAMILIA DEMO6008CURITIBA62070503***6304ABCD',
        consumo: consumo ? consumo + ' ' + unidade : '', consumo_valor: consumo, consumo_unidade: unidade || '', anexo_url: '',
        status: paga ? 'paga' : 'aberta', pago_em: paga ? venc : '', pago_por: paga ? 'seed_u_pai' : '', lancamento_id: '',
      };
      contasAPagar.push(conta);
      if (paga) {
        const l = { id: sid('l'), data: venc, competencia: comp, tipo: 'despesa', valor, categoria_id: cf.categoria_id, descricao: cf.nome, estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'seed_u_pai', origem: 'email', status: 'confirmado', criado_em: venc + 'T09:00:00', cartao_id: '', parcela: '', anexo_url: '', editado_por: '', excluido: false, projeto_id: '', hash_dedup: '' };
        lancamentos.push(l);
        conta.lancamento_id = l.id;
      } else if (ehAtual) {
        lancamentos.push({ id: sid('l'), data: venc, competencia: comp, tipo: 'despesa', valor: cf.valor_previsto, categoria_id: cf.categoria_id, descricao: cf.nome + ' (previsto)', estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'seed_u_pai', origem: 'recorrente', status: 'a_confirmar', criado_em: comp + '-01T09:00:00', cartao_id: '', parcela: '', anexo_url: '', editado_por: '', excluido: false, projeto_id: '', hash_dedup: 'previsto_' + cf.id + '_' + comp });
      }
    });
    add({ data: dia(10), tipo: 'despesa', valor: 920, categoria_id: 'c_financiamento_carro', descricao: 'Parcela do carro', estabelecimento: 'BV Financeira', forma_pgto: 'boleto', usuario_id: 'seed_u_pai', origem: 'recorrente' });
    add({ data: dia(15), tipo: 'despesa', valor: 185, categoria_id: 'c_seguro_carro', descricao: 'Seguro auto', estabelecimento: 'Porto Seguro', forma_pgto: 'crédito', cartao_id: 'seed_k_itau_pai', usuario_id: 'seed_u_pai', origem: 'recorrente' });
    add({ data: dia(3), tipo: 'despesa', valor: 149.9, categoria_id: 'c_telefone', descricao: 'Plano família', estabelecimento: 'Vivo', forma_pgto: 'crédito', cartao_id: 'seed_k_nu_mae', usuario_id: 'seed_u_mae', origem: 'recorrente' });
    if (mes === 1 || mes === 2) add({ data: dia(20), tipo: 'despesa', valor: 1850, categoria_id: 'c_ipva', descricao: 'IPVA', estabelecimento: 'Detran PR', forma_pgto: 'boleto', usuario_id: 'seed_u_pai', origem: 'manual' });
    if (mes === 2) add({ data: dia(25), tipo: 'despesa', valor: 1400, categoria_id: 'c_iptu', descricao: 'IPTU (cota única)', estabelecimento: 'Prefeitura de Curitiba', forma_pgto: 'boleto', usuario_id: 'seed_u_pai', origem: 'manual' });

    Object.keys(faixas).forEach((cat) => {
      const f = faixas[cat];
      const n = Math.max(0, Math.round(f[0] * (0.7 + rnd() * 0.6)));
      for (let k = 0; k < n; k++) {
        const quem = escolher(['seed_u_pai', 'seed_u_mae', 'seed_u_mae', 'seed_u_pai', 'seed_u_filha', 'seed_u_filho']);
        const forma = quem.indexOf('seed_u_fil') === 0 ? 'pix' : escolher(['crédito', 'débito', 'pix', 'dinheiro']);
        const cartao = forma === 'crédito' ? (quem === 'seed_u_mae' ? 'seed_k_nu_mae' : 'seed_k_itau_pai') : '';
        const est = escolher(estabelecimentos[cat] || ['Loja']);
        const valorBase = entre(f[1], f[2]);
        const valor = quem.indexOf('seed_u_fil') === 0 ? Math.min(valorBase, entre(5, 40)) : valorBase;
        add({ data: dia(1 + Math.floor(rnd() * ultimoDia)), tipo: 'despesa', valor, categoria_id: cat, descricao: est, estabelecimento: est, forma_pgto: forma, cartao_id: cartao, usuario_id: quem, origem: escolher(['manual', 'foto', 'voz', 'sms', 'manual']) });
      }
    });
    if (mes === 12) add({ data: dia(20), tipo: 'despesa', valor: 1200, categoria_id: 'c_presentes', descricao: 'Presentes de Natal', estabelecimento: 'Shopping', forma_pgto: 'crédito', cartao_id: 'seed_k_nu_mae', usuario_id: 'seed_u_mae', origem: 'manual' });

    add({ data: dia(6), tipo: 'despesa', valor: 800, categoria_id: 'c_aporte_sonho', descricao: 'Aporte: Viagem a Gramado', estabelecimento: 'Poupança', forma_pgto: 'pix', usuario_id: 'seed_u_pai', origem: 'manual', projeto_id: 'seed_p_gramado' });
    add({ data: dia(6), tipo: 'despesa', valor: 500, categoria_id: 'c_aporte_sonho', descricao: 'Aporte: Reserva de emergência', estabelecimento: 'CDB', forma_pgto: 'pix', usuario_id: 'seed_u_mae', origem: 'manual', projeto_id: 'seed_p_reserva' });

    categorias.forEach((c) => { if (c.orcamento_mensal) orcamento.push({ competencia: comp, categoria_id: c.id, valor_planejado: c.orcamento_mensal }); });
    orcamento.push({ competencia: comp, categoria_id: 'c_dizimo', valor_planejado: 1470 });
  }

  lancamentos.forEach((l) => { if (!l.hash_dedup) l.hash_dedup = hashDedup(l.valor, l.data, l.cartao_id ? (cartoes.find((k) => k.id === l.cartao_id) || {}).final || '' : '', l.estabelecimento || l.descricao); });
  inserirLinhas('Lancamentos', lancamentos);
  inserirLinhas('ContasAPagar', contasAPagar);

  // Orçamento: só nas competências que ainda não têm.
  const comOrcamento = {};
  lerAba('Orcamento').forEach((o) => { comOrcamento[o.competencia] = true; });
  const novoOrcamento = orcamento.filter((o) => !comOrcamento[o.competencia]);
  if (novoOrcamento.length) inserirLinhas('Orcamento', novoOrcamento);
  definirPropriedade('SEED_COMPETENCIAS', JSON.stringify(competencias.filter((c) => !comOrcamento[c])));

  const projetos = [
    { id: 'seed_p_gramado', nome: 'Viagem a Gramado', icone: '🏔️', foto_url: '', meta_valor: 12000, data_alvo: somarMeses(compAtual, 7) + '-15', valor_inicial: 1500, prioridade: 1, status: 'ativo', versiculo: 'Lucas 14:28', criado_por: 'seed_u_mae', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'seed_p_reserva', nome: 'Reserva de emergência', icone: '🛟', foto_url: '', meta_valor: 30000, data_alvo: somarMeses(compAtual, 30) + '-01', valor_inicial: 8000, prioridade: 2, status: 'ativo', versiculo: 'Provérbios 6:6-8', criado_por: 'seed_u_pai', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'seed_p_carro', nome: 'Trocar o carro', icone: '🚙', foto_url: '', meta_valor: 45000, data_alvo: somarMeses(compAtual, 36) + '-01', valor_inicial: 0, prioridade: 3, status: 'votação', versiculo: 'Provérbios 21:5', criado_por: 'seed_u_pai', criado_em: hoje },
    { id: 'seed_p_bike_ju', nome: 'Bicicleta da Ju', icone: '🚲', foto_url: '', meta_valor: 900, data_alvo: somarMeses(compAtual, 5) + '-01', valor_inicial: 120, prioridade: 4, status: 'ativo', versiculo: 'Provérbios 13:11', criado_por: 'seed_u_filha', criado_em: somarMeses(compAtual, -3) + '-01' },
  ];
  inserirLinhas('Projetos', projetos);
  lancamentos.filter((l) => l.projeto_id).forEach((l) => aportes.push({ id: sid('a'), projeto_id: l.projeto_id, data: l.data, valor: l.valor, usuario_id: l.usuario_id, observacao: '' }));
  aportes.push({ id: sid('a'), projeto_id: 'seed_p_bike_ju', data: somarMeses(compAtual, -2) + '-10', valor: 30, usuario_id: 'seed_u_filha', observacao: 'Guardei da mesada' });
  aportes.push({ id: sid('a'), projeto_id: 'seed_p_bike_ju', data: somarMeses(compAtual, -1) + '-12', valor: 50, usuario_id: 'seed_u_filha', observacao: 'Vendi livros usados' });
  aportes.push({ id: sid('a'), projeto_id: 'seed_p_bike_ju', data: hoje, valor: 10, usuario_id: 'seed_u_filho', observacao: 'Pra ajudar a Ju' });
  inserirLinhas('Aportes', aportes);

  inserirLinhas('Decisoes', [
    { id: 'seed_d_carro', titulo: 'Começar a guardar para trocar o carro', descricao: 'Proposta: R$ 1.000/mês a partir do mês que vem. Meta de R$ 45 mil em 3 anos.', tipo: 'novo projeto', valor: 45000, criado_por: 'seed_u_pai', criado_em: hoje, prazo: somarMeses(compAtual, 1) + '-05', status: 'aberta', projeto_id: 'seed_p_carro' },
    { id: 'seed_d_tv', titulo: 'Comprar TV nova para a sala', descricao: 'A TV da sala parou. Orçamento de R$ 2.800 em 10x.', tipo: 'gasto grande', valor: 2800, criado_por: 'seed_u_mae', criado_em: somarMeses(compAtual, -1) + '-20', prazo: somarMeses(compAtual, -1) + '-27', status: 'aprovada', projeto_id: '' },
  ]);
  inserirLinhas('Votos', [
    { decisao_id: 'seed_d_carro', usuario_id: 'seed_u_pai', voto: 'sim', comentario: 'O atual já tem 12 anos.', data: hoje },
    { decisao_id: 'seed_d_carro', usuario_id: 'seed_u_filha', voto: 'sim', comentario: 'Mas primeiro Gramado!', data: hoje },
    { decisao_id: 'seed_d_tv', usuario_id: 'seed_u_pai', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-21' },
    { decisao_id: 'seed_d_tv', usuario_id: 'seed_u_mae', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-20' },
    { decisao_id: 'seed_d_tv', usuario_id: 'seed_u_filho', voto: 'não', comentario: 'Prefiro um videogame', data: somarMeses(compAtual, -1) + '-22' },
  ]);

  const caixa = [
    { texto: 'Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12.', canal: 'sms_ios', valor: 87.4, est: 'PADARIA PAO QUENTE', final: '4321', uid: 'seed_u_pai' },
    { texto: 'Nubank: Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 8765.', canal: 'sms_android', valor: 156.9, est: 'DROGARIA NISSEI', final: '8765', uid: 'seed_u_mae' },
    { texto: 'Alerta de compra: POSTO SHELL R$ 210,00 cartão final 4321', canal: 'email', valor: 210, est: 'POSTO SHELL', final: '4321', uid: 'seed_u_pai' },
  ].map((c) => {
    const sug = sugerirCategoria(c.est, categorias);
    return { id: sid('ce'), recebido_em: agora, canal: c.canal, texto_bruto: c.texto, valor: c.valor, estabelecimento: c.est, final_cartao: c.final, data_compra: hoje, sugestao_categoria: sug[0], sugestoes: sug, usuario_id: c.uid, status: 'pendente', lancamento_id: '', hash_dedup: hashDedup(c.valor, hoje, c.final, c.est) };
  });
  inserirLinhas('CaixaEntrada', caixa);

  console.log('Dados de exemplo criados: ' + lancamentos.length + ' lançamentos em ' + competencias.length + ' meses. Usuários de exemplo entram com PIN 1234.');
  return { lancamentos: lancamentos.length, meses: competencias.length };
}

/** Remove tudo o que seed_exemplo() criou (ids "seed_" e o orçamento das competências do seed). */
function limpar_exemplo() {
  const ehSeed = (campo) => (r) => String(r[campo] || '').indexOf(PREFIXO_SEED) === 0;
  const removidos = {};
  ['Usuarios', 'Cartoes', 'ContasFixas', 'Lancamentos', 'ContasAPagar', 'Projetos', 'Aportes', 'Decisoes', 'CaixaEntrada'].forEach((aba) => { removidos[aba] = removerLinhas(aba, ehSeed('id')); });
  removidos.Votos = removerLinhas('Votos', ehSeed('decisao_id'));
  let comps = [];
  try { comps = JSON.parse(propriedade('SEED_COMPETENCIAS', '[]')); } catch (e) { comps = []; }
  removidos.Orcamento = removerLinhas('Orcamento', (o) => comps.indexOf(o.competencia) >= 0);
  PropertiesService.getScriptProperties().deleteProperty('SEED_COMPETENCIAS');
  console.log('Dados de exemplo removidos: ' + JSON.stringify(removidos));
  return removidos;
}
