/**
 * setup.gs — Instalação: pasta no Drive, planilha com todas as abas, dados iniciais (cardápio),
 * primeiro administrador, gatilhos. Também migração da versão 1, dados de exemplo (seed) e
 * utilitários do Drive.
 *
 * Como usar (no editor do Apps Script): escolha a função `instalar` e clique em Executar.
 * É idempotente: rodar de novo não duplica nada (só completa o que faltar). Numa planilha da
 * versão 1 ele também MIGRA: cria as abas/colunas novas, converte o perfil "Júnior" em
 * "Dependente", preenche a aba Tipos e completa tipo_id/grupo_analise/cor dos grupos e categorias.
 *
 * Script Properties usadas (Configurações do projeto → Propriedades do script):
 *  - SOBRENOME (opcional): nome da família. Padrão: SOBRENOME_PADRAO abaixo.
 *  - URL_APP: endereço do app publicado (para montar o link de convite).
 *  - CHAVE_API_CLAUDE / MODELO_CLAUDE: leitura inteligente e assistente (opcional).
 *  - TOKEN_TELEGRAM: token do bot (opcional; ver telegram.gs).
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

  // Abas e cabeçalhos (cria o que falta, acrescenta colunas novas).
  ORDEM_ABAS.forEach((nome) => { obterAba(nome); garantirColunas(nome); });
  const padrao = planilha.getSheets().find((s) => ['Sheet1', 'Página1', 'Planilha1'].indexOf(s.getName()) >= 0);
  if (padrao && planilha.getSheets().length > 1) planilha.deleteSheet(padrao);

  // Dados iniciais (só se a aba estiver vazia) e migração do cardápio da versão 1.
  if (!lerAba('Tipos').length) inserirLinhas('Tipos', dadosIniciaisTipos());
  if (!lerAba('Grupos').length) inserirLinhas('Grupos', dadosIniciaisGrupos());
  if (!lerAba('Categorias').length) inserirLinhas('Categorias', dadosIniciaisCategorias());
  if (!lerAba('Versiculos').length) inserirLinhas('Versiculos', dadosIniciaisVersiculos());
  const migracao = migrarParaVersao2();

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
      id: gerarId('u'), nome: 'Administrador', apelido: 'Administrador', avatar: '', cor: 'indigo', perfil: 'Administrador',
      ativo: true, criado_em: agora, ultimo_acesso: agora, mesada_mensal: 0, token: gerarToken(32), origem: 'instalacao',
    }, prepararPin(PIN_INICIAL_ADMIN))]);
    avisoPin = 'Usuário "Administrador" criado com PIN ' + PIN_INICIAL_ADMIN + ' — TROQUE o PIN no primeiro acesso (Configurações → Família → Redefinir PIN).';
  }

  instalarGatilhos();

  const cfg = lerConfigCompleta();
  const resumo = {
    pasta: pasta.getUrl(),
    planilha: planilha.getUrl(),
    token_familia: cfg.token_familia,
    migracao,
    proximo_passo: 'Implantar → Nova implantação → App da Web (Executar como: Eu; Acesso: Qualquer pessoa). Depois defina URL_APP e, se quiser, CHAVE_API_CLAUDE e TOKEN_TELEGRAM nas Propriedades do script (para o Telegram, rode configurarTelegram()).',
  };
  console.log('Instalação concluída.\n' + (avisoPin ? avisoPin + '\n' : '') + JSON.stringify(resumo, null, 2));
  return resumo;
}

// ---------- Migração da versão 1 ----------

/** Nome da cor da paleta a partir de um hexadecimal antigo (ou devolve o próprio nome se já for da paleta). */
function corDaPaleta(valor, padrao) {
  const v = String(valor || '').trim();
  if (!v) return padrao || 'indigo';
  const cores = dadosIniciaisCores();
  if (cores[v] !== undefined) return v;
  const hex = v.toUpperCase();
  const nome = Object.keys(cores).find((k) => String(cores[k]).toUpperCase() === hex);
  return nome || padrao || 'indigo';
}

/**
 * Migra uma planilha da versão 1 para a 2 (idempotente):
 *  - Usuarios: perfil "Júnior" → "Dependente";
 *  - Config: junior_ve_salarios → dependente_ve_salarios;
 *  - Grupos: tipo_id, cor da paleta, grupo_analise e ativo (a partir dos dados iniciais quando o id
 *    é conhecido; senão inferidos do campo antigo `tipo`); grupos novos do cardápio v2 são incluídos;
 *  - Categorias: tipo_id, grupo_id, grupo_analise, ícone Lucide, cor e oculta_cardapio a partir dos
 *    dados iniciais quando o id é conhecido; categorias só da v1 recebem o tipo do grupo; categorias
 *    novas do cardápio v2 são incluídas.
 * Devolve um resumo do que mudou.
 */
function migrarParaVersao2() {
  const resumo = { usuarios: 0, grupos: 0, categorias: 0, config: 0 };
  // Usuários.
  lerAba('Usuarios').forEach((u) => {
    if (normalizar(u.perfil) === 'JUNIOR') { atualizarPorId('Usuarios', u.id, { perfil: 'Dependente' }); resumo.usuarios++; }
  });
  // Config.
  const bruta = {};
  lerAba('Config').forEach((r) => { bruta[r.chave] = r.valor; });
  if (bruta.dependente_ve_salarios === undefined && bruta.junior_ve_salarios !== undefined) { salvarConfigChaves({ dependente_ve_salarios: paraBooleano(bruta.junior_ve_salarios) }); resumo.config++; }
  // Grupos.
  const gruposIniciais = indexarPorId(dadosIniciaisGrupos());
  const gruposAtuais = lerAba('Grupos');
  gruposAtuais.forEach((g) => {
    if (g.tipo_id && g.grupo_analise && dadosIniciaisCores()[g.cor] !== undefined) return;
    const ini = gruposIniciais[g.id];
    const tipoAntigo = String(g.tipo || '');
    const tipoId = g.tipo_id || (ini ? ini.tipo_id : (tipoAntigo === 'receita' ? TIPO_RECEITAS : tipoAntigo === 'projeto' ? TIPO_PROJETOS : TIPO_VARIAVEIS));
    atualizarPorId('Grupos', g.id, {
      tipo_id: tipoId, nome: ini ? ini.nome : g.nome, cor: ini ? ini.cor : corDaPaleta(g.cor, 'slate'),
      grupo_analise: g.grupo_analise || (ini ? ini.grupo_analise : (tipoId === TIPO_RECEITAS ? 'Receitas' : tipoId === TIPO_PROJETOS ? 'Projetos' : 'Outros')),
      ordem: ini ? ini.ordem : g.ordem, ativo: g.ativo === '' || g.ativo === undefined ? true : g.ativo,
    });
    resumo.grupos++;
  });
  const idsGrupos = {};
  lerAba('Grupos').forEach((g) => { idsGrupos[g.id] = true; });
  const gruposNovos = dadosIniciaisGrupos().filter((g) => !idsGrupos[g.id]);
  if (gruposNovos.length) { inserirLinhas('Grupos', gruposNovos); resumo.grupos += gruposNovos.length; }
  // Categorias.
  const catIniciais = indexarPorId(dadosIniciaisCategorias());
  const grpMap = indexarPorId(lerAba('Grupos'));
  lerAba('Categorias').forEach((c) => {
    if (c.tipo_id && c.grupo_analise && dadosIniciaisCores()[c.cor] !== undefined) return;
    const ini = catIniciais[c.id];
    const grupo = grpMap[ini ? ini.grupo_id : c.grupo_id] || grpMap[c.grupo_id] || {};
    const tipoId = ini ? ini.tipo_id : (c.tipo === 'receita' ? TIPO_RECEITAS : (c.id === CATEGORIA_APORTE_ANTIGA ? TIPO_PROJETOS : (grupo.tipo_id || (c.fixa ? TIPO_FIXAS : TIPO_VARIAVEIS))));
    atualizarPorId('Categorias', c.id, {
      tipo_id: tipoId, grupo_id: ini ? ini.grupo_id : c.grupo_id, icone: ini ? ini.icone : (/^[a-z0-9-]+$/.test(String(c.icone || '')) ? c.icone : 'tag'),
      cor: ini ? ini.cor : corDaPaleta(c.cor, grupo.cor || 'slate'), grupo_analise: c.grupo_analise || (ini ? ini.grupo_analise : (grupo.grupo_analise || 'Outros')),
      oculta_cardapio: ini ? ini.oculta_cardapio : (c.id === CATEGORIA_APORTE_ANTIGA || tipoId === TIPO_PROJETOS), sensivel: !!c.sensivel,
      palavras_chave: c.palavras_chave || (ini ? ini.palavras_chave : ''),
    });
    resumo.categorias++;
  });
  const idsCats = {};
  lerAba('Categorias').forEach((c) => { idsCats[c.id] = true; });
  const catsNovas = dadosIniciaisCategorias().filter((c) => !idsCats[c.id]);
  if (catsNovas.length) { inserirLinhas('Categorias', catsNovas); resumo.categorias += catsNovas.length; }
  if (resumo.usuarios || resumo.grupos || resumo.categorias || resumo.config) console.log('Migração v2: ' + JSON.stringify(resumo));
  return resumo;
}

// ---------- Gatilhos ----------

/** Funções que rodam sozinhas e seu horário (as rotinas ligáveis ficam em instalarGatilhosRotinas). */
const GATILHOS = [
  { fn: 'processarEmails', tipo: 'hora' },
  { fn: 'processarPastaEntrada', tipo: 'hora' },
  { fn: 'gerarPrevistosDoMes', tipo: 'dia', hora: 6 },
  { fn: 'avisarVencimentos', tipo: 'dia', hora: 8 },
  { fn: 'backupSemanal', tipo: 'semana' },
];

/** Gatilhos das rotinas que a família liga/desliga em Configurações. */
const FUNCOES_ROTINAS = ['vigiaDiario', 'lembreteDiario', 'analiseQuinzenal', 'fechamentoDoMes'];

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
  instalarGatilhosRotinas(lerConfig());
  console.log('Gatilhos instalados: ' + ScriptApp.getProjectTriggers().length);
}

/** Hora (0-23) de um horário "HH:MM". */
function horaDe(horario, padrao) {
  return Math.min(23, Math.max(0, Number(String(horario || '').split(':')[0]) || padrao || 20));
}

/**
 * Instala os gatilhos das rotinas conforme a Config:
 *  - rotina_vigia ligada → vigiaDiario na hora do lembrete (padrão 20h), que inclui o lembrete diário;
 *    desligada → só lembreteDiario nessa hora;
 *  - rotina_quinzenal → analiseQuinzenal nos dias 1 e 16 às 7h;
 *  - rotina_fechamento → fechamentoDoMes no dia 1º às 6h.
 */
function instalarGatilhosRotinas(cfg) {
  const c = cfg || lerConfig();
  ScriptApp.getProjectTriggers().filter((t) => FUNCOES_ROTINAS.indexOf(t.getHandlerFunction()) >= 0).forEach((t) => ScriptApp.deleteTrigger(t));
  const hora = horaDe(c.lembrete_horario, 20);
  ScriptApp.newTrigger(c.rotina_vigia === false ? 'lembreteDiario' : 'vigiaDiario').timeBased().everyDays(1).atHour(hora).create();
  if (c.rotina_quinzenal !== false) {
    ScriptApp.newTrigger('analiseQuinzenal').timeBased().onMonthDay(1).atHour(7).create();
    ScriptApp.newTrigger('analiseQuinzenal').timeBased().onMonthDay(16).atHour(7).create();
  }
  if (c.rotina_fechamento !== false) ScriptApp.newTrigger('fechamentoDoMes').timeBased().onMonthDay(1).atHour(6).create();
}

/** Compatibilidade com a v1: reinstala as rotinas com um novo horário de lembrete. */
function instalarGatilhoLembrete(horario) {
  instalarGatilhosRotinas(Object.assign({}, lerConfig(), { lembrete_horario: horario }));
}

// ---------- Dados de exemplo ----------

/** Gerador pseudoaleatório determinístico (os números são sempre os mesmos). */
function criarAleatorio(semente) {
  let s = semente;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const PREFIXO_SEED = 'seed_';

/**
 * seed_exemplo(): 12 meses de dados coerentes com o modo demonstração do app (Família Reis:
 * Luiz, Nina, Júlia e Pedro; cartões Itaú 4821 e Nubank 0937; 9 contas fixas; salários, dízimo,
 * dia a dia, assinaturas, compra parcelada, aportes; 4 projetos; 3 decisões; 3 alertas; 4 itens de
 * patrimônio; 4 itens na caixa de entrada). Tudo com id começando por "seed_" para limpar_exemplo()
 * conseguir remover. Os usuários de exemplo entram com PIN 1234.
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
  const anoAtual = Number(compAtual.slice(0, 4));
  const pin = prepararPin('1234');

  const usuarios = [
    { id: 'seed_u_luiz', nome: 'Luiz Reis', apelido: 'Luiz', avatar: '', cor: 'indigo', perfil: 'Administrador', mesada_mensal: 0 },
    { id: 'seed_u_nina', nome: 'Nina Reis', apelido: 'Nina', avatar: '', cor: 'magenta', perfil: 'Administrador', mesada_mensal: 0 },
    { id: 'seed_u_julia', nome: 'Júlia Reis', apelido: 'Júlia', avatar: '', cor: 'gold', perfil: 'Dependente', mesada_mensal: 150 },
    { id: 'seed_u_pedro', nome: 'Pedro Reis', apelido: 'Pedro', avatar: '', cor: 'green', perfil: 'Dependente', mesada_mensal: 100 },
  ].map((u) => Object.assign(u, { ativo: true, criado_em: agora, ultimo_acesso: agora, token: gerarToken(32), origem: 'seed' }, pin));
  inserirLinhas('Usuarios', usuarios);

  const cartoes = [
    { id: 'seed_k_itau_luiz', apelido: 'Itaú', banco: 'Itaú', final: '4821', titular_id: 'seed_u_luiz', dia_fechamento: 28, dia_vencimento: 5, cor: 'orange', ativo: true },
    { id: 'seed_k_nu_nina', apelido: 'Nubank', banco: 'Nubank', final: '0937', titular_id: 'seed_u_nina', dia_fechamento: 20, dia_vencimento: 1, cor: 'magenta', ativo: true },
  ];
  inserirLinhas('Cartoes', cartoes);

  const contasFixas = [
    { id: 'seed_f_luz', nome: 'Luz — Copel', categoria_id: 'c_luz', valor_previsto: 412, dia_vencimento: 20, remetente_email: 'copel.com', codigo_cliente: '12345678' },
    { id: 'seed_f_agua', nome: 'Água — Sanepar', categoria_id: 'c_agua', valor_previsto: 168, dia_vencimento: 2, remetente_email: 'sanepar.com.br', codigo_cliente: '987654' },
    { id: 'seed_f_gas', nome: 'Gás — Compagas', categoria_id: 'c_gas', valor_previsto: 72, dia_vencimento: 12, remetente_email: 'compagas.com.br', codigo_cliente: '55443' },
    { id: 'seed_f_internet', nome: 'Internet', categoria_id: 'c_internet', valor_previsto: 139, dia_vencimento: 8, remetente_email: 'vivo.com.br', codigo_cliente: '' },
    { id: 'seed_f_celular', nome: 'Celulares', categoria_id: 'c_telefone', valor_previsto: 189, dia_vencimento: 3, remetente_email: 'claro.com.br', codigo_cliente: '' },
    { id: 'seed_f_plano', nome: 'Plano de saúde', categoria_id: 'c_plano_saude', valor_previsto: 2120, dia_vencimento: 25, remetente_email: 'unimed.coop.br', codigo_cliente: '' },
    { id: 'seed_f_faculdade', nome: 'Faculdade', categoria_id: 'c_escola', valor_previsto: 1480, dia_vencimento: 5, remetente_email: '', codigo_cliente: '' },
    { id: 'seed_f_prestacao', nome: 'Prestação da casa', categoria_id: 'c_prestacao_casa', valor_previsto: 2450, dia_vencimento: 10, remetente_email: '', codigo_cliente: '' },
    { id: 'seed_f_condominio', nome: 'Condomínio', categoria_id: 'c_condominio', valor_previsto: 610, dia_vencimento: 10, remetente_email: '', codigo_cliente: '' },
  ].map((c) => Object.assign(c, { ativa: true }));
  inserirLinhas('ContasFixas', contasFixas);

  const lojas = {
    c_mercado: ['Supermercado Condor', 'Muffato', 'Festval', 'Atacadão'], c_feira: ['Feira do Batel', 'Hortifruti Boa Safra'],
    c_padaria: ['Padaria Pão Quente', 'Panificadora Imperial'], c_acougue: ['Casa de Carnes Boi Nobre'], c_delivery: ['iFood', 'Pizzaria Baggio', 'Rappi'],
    c_restaurantes: ['Madero', 'Café do Mercado', 'Outback'], c_combustivel: ['Posto Shell', 'Posto Ipiranga'], c_estacionamento: ['Estapar', 'Sem Parar'],
    c_app_transporte: ['Uber', '99'], c_manutencao_carro: ['Auto Center Silva', 'Lava Car'], c_farmacia: ['Drogaria Nissei', 'Panvel'],
    c_consultas: ['Clínica Vida', 'Laboratório Frischmann'], c_cabelo: ['Salão da Vera', 'Barbearia do Zé'], c_reparos: ['Leroy Merlin', 'Balaroti'],
    c_moveis: ['Tok&Stok', 'Havan'], c_limpeza: ['Diarista', 'Lavanderia Lavô'], c_passeios: ['Cinemark', 'Teatro Guaíra', 'Parque Barigui'],
    c_viagens: ['Pousada Serra Verde'], c_hobbies: ['Smart Fit', 'Livraria Curitiba'], c_roupas: ['Renner', 'Riachuelo', 'Centauro'],
    c_presentes: ['Floricultura Flores & Cia'], c_pet: ['Petz', 'Cobasi'], c_imprevistos: ['Cartório', 'Detran'],
  };
  const faixas = {
    c_mercado: [5, 220, 460], c_feira: [2, 40, 70], c_padaria: [8, 14, 42], c_acougue: [2, 70, 120], c_delivery: [6, 40, 95], c_restaurantes: [2, 90, 180],
    c_combustivel: [4, 160, 260], c_estacionamento: [4, 15, 50], c_app_transporte: [3, 18, 55], c_manutencao_carro: [1, 90, 300],
    c_farmacia: [3, 40, 140], c_consultas: [1, 120, 300], c_cabelo: [2, 50, 110], c_reparos: [1, 60, 260], c_moveis: [0, 100, 400], c_limpeza: [1, 60, 120],
    c_passeios: [2, 80, 220], c_viagens: [0, 300, 900], c_hobbies: [2, 60, 150], c_roupas: [1, 90, 320], c_presentes: [1, 50, 150], c_pet: [1, 70, 160], c_imprevistos: [1, 30, 120],
  };
  const categorias = lerAba('Categorias');
  const lancamentos = [], contasAPagar = [], orcamento = [], aportes = [];
  const competencias = [];
  const vazio = { cartao_id: '', parcela: '', anexo_url: '', editado_por: '', excluido: false, projeto_id: '', hash_dedup: '' };

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
      lancamentos.push(Object.assign({ id: sid('l'), competencia: comp, criado_em: l.data + 'T12:00:00', status: 'confirmado' }, vazio, l));
    };

    // Receitas (dezembro: 13º salário).
    add({ data: dia(5), tipo: 'receita', valor: mes === 12 ? 13500 : 9000, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'seed_u_luiz', origem: 'recorrente' });
    add({ data: dia(5), tipo: 'receita', valor: mes === 12 ? 9450 : 6300, categoria_id: 'c_salario', descricao: 'Salário', estabelecimento: 'Empresa', forma_pgto: 'pix', usuario_id: 'seed_u_nina', origem: 'recorrente' });
    add({ data: dia(18), tipo: 'receita', valor: entre(700, 1600), categoria_id: 'c_renda_extra', descricao: 'Consultoria', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'seed_u_luiz', origem: 'manual' });
    if (rnd() > 0.6) add({ data: dia(22), tipo: 'receita', valor: entre(100, 400), categoria_id: 'c_rendimentos', descricao: 'Rendimento CDB', estabelecimento: 'Banco', forma_pgto: 'pix', usuario_id: 'seed_u_nina', origem: 'manual' });
    add({ data: dia(1), tipo: 'receita', valor: 150, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'seed_u_julia', origem: 'recorrente' });
    add({ data: dia(1), tipo: 'receita', valor: 100, categoria_id: 'c_mesada_recebida', descricao: 'Mesada', estabelecimento: '', forma_pgto: 'pix', usuario_id: 'seed_u_pedro', origem: 'recorrente' });

    // Dízimo e ofertas.
    add({ data: dia(7), tipo: 'despesa', valor: 1530, categoria_id: 'c_dizimo', descricao: 'Dízimo', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'seed_u_luiz', origem: 'recorrente' });
    add({ data: dia(14), tipo: 'despesa', valor: entre(60, 120), categoria_id: 'c_ofertas', descricao: 'Oferta', estabelecimento: 'Igreja', forma_pgto: 'pix', usuario_id: 'seed_u_nina', origem: 'manual' });
    add({ data: dia(21), tipo: 'despesa', valor: 50, categoria_id: 'c_missoes', descricao: 'Missões', estabelecimento: 'Agência Missionária', forma_pgto: 'pix', usuario_id: 'seed_u_luiz', origem: 'manual' });

    // Contas fixas (com fatura em ContasAPagar).
    contasFixas.forEach((cf) => {
      let valor = cf.valor_previsto, consumo, unidade;
      if (cf.id === 'seed_f_luz') { valor = Math.round(cf.valor_previsto * (1 + 0.3 * Math.cos(((mes - 1) / 12) * 2 * Math.PI)) * (0.95 + rnd() * 0.1) * 100) / 100; consumo = Math.round(valor / 0.98); unidade = 'kWh'; }
      else if (cf.id === 'seed_f_agua') { valor = entre(150, 190); consumo = Math.round(valor / 9); unidade = 'm³'; }
      else if (cf.id === 'seed_f_gas') { valor = entre(60, 85); consumo = Math.round(valor / 7); unidade = 'm³'; }
      const venc = comp + '-' + zeros(cf.dia_vencimento);
      const paga = venc < hoje;
      const conta = {
        id: sid('cp'), conta_fixa_id: cf.id, competencia: comp, valor, vencimento: venc,
        linha_digitavel: '83640000001 2 21440138000 0 00000012345 6 78901234567 8',
        pix_copia_cola: '00020126580014br.gov.bcb.pix0136demo-chave-pix-familia520400005303986540' + valor.toFixed(2) + '5802BR5913FAMILIA REIS6008CURITIBA62070503***6304ABCD',
        consumo: consumo ? consumo + ' ' + unidade : '', consumo_valor: consumo, consumo_unidade: unidade || '', anexo_url: '',
        status: paga ? 'paga' : 'aberta', pago_em: paga ? venc : '', pago_por: paga ? 'seed_u_luiz' : '', lancamento_id: '',
      };
      contasAPagar.push(conta);
      if (paga) {
        const l = Object.assign({ id: sid('l'), data: venc, competencia: comp, tipo: 'despesa', valor, categoria_id: cf.categoria_id, descricao: cf.nome, estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'seed_u_luiz', origem: 'email', status: 'confirmado', criado_em: venc + 'T09:00:00' }, vazio);
        lancamentos.push(l);
        conta.lancamento_id = l.id;
      } else if (ehAtual) {
        lancamentos.push(Object.assign({ id: sid('l'), data: venc, competencia: comp, tipo: 'despesa', valor: cf.valor_previsto, categoria_id: cf.categoria_id, descricao: cf.nome + ' (previsto)', estabelecimento: cf.nome, forma_pgto: 'boleto', usuario_id: 'seed_u_luiz', origem: 'recorrente', status: 'a_confirmar', criado_em: comp + '-01T09:00:00' }, vazio, { hash_dedup: 'previsto_' + cf.id + '_' + comp }));
      }
    });
    add({ data: dia(10), tipo: 'despesa', valor: 140, categoria_id: 'c_iptu', descricao: 'IPTU (parcela)', estabelecimento: 'Prefeitura de Curitiba', forma_pgto: 'boleto', usuario_id: 'seed_u_luiz', origem: 'recorrente' });
    add({ data: dia(15), tipo: 'despesa', valor: 310, categoria_id: 'c_seguro_carro', descricao: 'Seguro do carro', estabelecimento: 'Porto Seguro', forma_pgto: 'crédito', cartao_id: 'seed_k_itau_luiz', usuario_id: 'seed_u_luiz', origem: 'recorrente' });
    add({ data: dia(12), tipo: 'despesa', valor: 250, categoria_id: 'c_cursos', descricao: 'Curso de inglês', estabelecimento: 'Escola de idiomas', forma_pgto: 'boleto', usuario_id: 'seed_u_nina', origem: 'recorrente' });
    add({ data: dia(9), tipo: 'despesa', valor: 55.9, categoria_id: 'c_streaming', descricao: 'Netflix', estabelecimento: 'NETFLIX.COM', forma_pgto: 'crédito', cartao_id: 'seed_k_nu_nina', usuario_id: 'seed_u_nina', origem: 'sms' });
    add({ data: dia(11), tipo: 'despesa', valor: 21.9, categoria_id: 'c_streaming', descricao: 'Spotify', estabelecimento: 'SPOTIFY', forma_pgto: 'crédito', cartao_id: 'seed_k_nu_nina', usuario_id: 'seed_u_nina', origem: 'sms' });
    if (i <= 1) add({ data: dia(13), tipo: 'despesa', valor: 44.9, categoria_id: 'c_streaming', descricao: 'Streaming', estabelecimento: 'DISNEY PLUS', forma_pgto: 'crédito', cartao_id: 'seed_k_itau_luiz', usuario_id: 'seed_u_luiz', origem: 'sms' });
    add({ data: dia(2), tipo: 'despesa', valor: 24.9, categoria_id: 'c_apps', descricao: 'iCloud', estabelecimento: 'APPLE.COM/BILL', forma_pgto: 'crédito', cartao_id: 'seed_k_itau_luiz', usuario_id: 'seed_u_luiz', origem: 'sms' });
    if (mes === 1) add({ data: dia(20), tipo: 'despesa', valor: 1850, categoria_id: 'c_ipva', descricao: 'IPVA', estabelecimento: 'Detran PR', forma_pgto: 'boleto', usuario_id: 'seed_u_luiz', origem: 'manual' });

    // Variáveis.
    Object.keys(faixas).forEach((cat) => {
      const f = faixas[cat];
      const n = Math.round(f[0] * (0.7 + rnd() * 0.6) + (f[0] === 0 && rnd() > 0.75 ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const quem = escolher(['seed_u_luiz', 'seed_u_nina', 'seed_u_nina', 'seed_u_luiz', 'seed_u_julia', 'seed_u_pedro']);
        const dependente = quem === 'seed_u_julia' || quem === 'seed_u_pedro';
        const forma = dependente ? 'pix' : escolher(['crédito', 'débito', 'pix', 'dinheiro']);
        const cartao = forma === 'crédito' ? (quem === 'seed_u_nina' ? 'seed_k_nu_nina' : 'seed_k_itau_luiz') : '';
        const loja = escolher(lojas[cat] || ['Loja']);
        const valorBase = entre(f[1], f[2]);
        const valor = dependente ? Math.min(valorBase, entre(8, 40)) : valorBase;
        add({ data: dia(1 + Math.floor(rnd() * ultimoDia)), tipo: 'despesa', valor, categoria_id: cat, descricao: loja, estabelecimento: loja, forma_pgto: forma, cartao_id: cartao, usuario_id: quem, origem: escolher(['manual', 'foto', 'voz', 'sms', 'manual', 'chat']) });
      }
    });
    // Delivery acima da média e cobrança duplicada no mês atual (para o vigia ter o que avisar).
    if (ehAtual) for (let k = 0; k < 4; k++) add({ data: dia(2 + k * 3), tipo: 'despesa', valor: entre(45, 92), categoria_id: 'c_delivery', descricao: 'iFood', estabelecimento: 'IFOOD', forma_pgto: 'crédito', cartao_id: 'seed_k_itau_luiz', usuario_id: 'seed_u_luiz', origem: 'sms' });
    if (ehAtual) { add({ data: dia(14), tipo: 'despesa', valor: 64.9, categoria_id: 'c_farmacia', descricao: 'Drogaria Nissei', estabelecimento: 'DROGARIA NISSEI', forma_pgto: 'crédito', cartao_id: 'seed_k_nu_nina', usuario_id: 'seed_u_nina', origem: 'sms' }); add({ data: dia(14), tipo: 'despesa', valor: 64.9, categoria_id: 'c_farmacia', descricao: 'Drogaria Nissei', estabelecimento: 'DROGARIA NISSEI', forma_pgto: 'crédito', cartao_id: 'seed_k_nu_nina', usuario_id: 'seed_u_nina', origem: 'sms' }); }
    if (mes === 12) add({ data: dia(20), tipo: 'despesa', valor: 1200, categoria_id: 'c_presentes', descricao: 'Presentes de Natal', estabelecimento: 'Shopping', forma_pgto: 'crédito', cartao_id: 'seed_k_nu_nina', usuario_id: 'seed_u_nina', origem: 'manual' });
    if (mes === 7) add({ data: dia(10), tipo: 'despesa', valor: 1100, categoria_id: 'c_viagens', descricao: 'Pousada em Morretes', estabelecimento: 'Pousada Serra Verde', forma_pgto: 'crédito', cartao_id: 'seed_k_itau_luiz', usuario_id: 'seed_u_luiz', origem: 'manual' });

    // Compra parcelada em 10x (parcelas futuras aparecem em Próximas saídas).
    if (i === 3) for (let pIdx = 0; pIdx < 10; pIdx++) lancamentos.push(Object.assign({ id: sid('l'), data: dia(16), competencia: somarMeses(comp, pIdx), tipo: 'despesa', valor: 189.9, categoria_id: 'c_moveis', descricao: 'Sofá da sala', estabelecimento: 'Tok&Stok', forma_pgto: 'crédito', usuario_id: 'seed_u_nina', origem: 'fatura', status: pIdx <= 3 ? 'confirmado' : 'a_confirmar', criado_em: dia(16) + 'T12:00:00' }, vazio, { cartao_id: 'seed_k_nu_nina', parcela: (pIdx + 1) + '/10', hash_dedup: 'seed_parc_sofa_' + pIdx }));

    // Aportes nos projetos.
    add({ data: dia(6), tipo: 'despesa', valor: 800, categoria_id: CATEGORIA_APORTE, descricao: 'Aporte: Viagem de julho', estabelecimento: 'Poupança', forma_pgto: 'pix', usuario_id: 'seed_u_luiz', origem: 'manual', projeto_id: 'seed_p_viagem' });
    add({ data: dia(6), tipo: 'despesa', valor: 600, categoria_id: CATEGORIA_APORTE, descricao: 'Aporte: Reserva de emergência', estabelecimento: 'CDB', forma_pgto: 'pix', usuario_id: 'seed_u_nina', origem: 'manual', projeto_id: 'seed_p_reserva' });

    categorias.forEach((c) => { if (c.orcamento_mensal) orcamento.push({ competencia: comp, categoria_id: c.id, valor_planejado: c.orcamento_mensal }); });
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
    { id: 'seed_p_viagem', nome: 'Viagem de julho', icone: 'plane', foto_url: '', meta_valor: 18000, data_alvo: (anoAtual + 1) + '-06-30', valor_inicial: 240, prioridade: 1, status: 'ativo', versiculo: 'Lucas 14:28', criado_por: 'seed_u_nina', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'seed_p_reserva', nome: 'Reserva de emergência', icone: 'shield-check', foto_url: '', meta_valor: 60000, data_alvo: (anoAtual + 1) + '-12-31', valor_inicial: 4000, prioridade: 2, status: 'ativo', versiculo: 'Provérbios 6:6-8', criado_por: 'seed_u_luiz', criado_em: somarMeses(compAtual, -11) + '-10' },
    { id: 'seed_p_carro', nome: 'Troca do carro', icone: 'car', foto_url: '', meta_valor: 45000, data_alvo: (anoAtual + 2) + '-12-01', valor_inicial: 2800, prioridade: 3, status: 'votação', versiculo: 'Provérbios 21:5', criado_por: 'seed_u_luiz', criado_em: hoje },
    { id: 'seed_p_bike', nome: 'Bicicleta da Júlia', icone: 'bike', foto_url: '', meta_valor: 900, data_alvo: somarMeses(compAtual, 5) + '-01', valor_inicial: 120, prioridade: 4, status: 'ativo', versiculo: 'Provérbios 13:11', criado_por: 'seed_u_julia', criado_em: somarMeses(compAtual, -3) + '-01' },
  ];
  inserirLinhas('Projetos', projetos);
  lancamentos.filter((l) => l.projeto_id).forEach((l) => aportes.push({ id: sid('a'), projeto_id: l.projeto_id, data: l.data, valor: l.valor, usuario_id: l.usuario_id, observacao: '' }));
  aportes.push({ id: sid('a'), projeto_id: 'seed_p_bike', data: somarMeses(compAtual, -2) + '-10', valor: 30, usuario_id: 'seed_u_julia', observacao: 'Guardei da mesada' });
  aportes.push({ id: sid('a'), projeto_id: 'seed_p_bike', data: somarMeses(compAtual, -1) + '-12', valor: 50, usuario_id: 'seed_u_julia', observacao: 'Vendi livros usados' });
  aportes.push({ id: sid('a'), projeto_id: 'seed_p_bike', data: hoje, valor: 10, usuario_id: 'seed_u_pedro', observacao: 'Para ajudar a Júlia' });
  inserirLinhas('Aportes', aportes);

  inserirLinhas('Decisoes', [
    { id: 'seed_d_carro', titulo: 'Começar a guardar para trocar o carro', descricao: 'Proposta: R$ 1.800/mês a partir do mês que vem. Meta de R$ 45 mil até ' + (anoAtual + 2) + '.', tipo: 'novo projeto', valor: 45000, criado_por: 'seed_u_luiz', criado_em: hoje, prazo: somarMeses(compAtual, 1) + '-05', status: 'aberta', projeto_id: 'seed_p_carro' },
    { id: 'seed_d_viagem', titulo: 'Viagem de julho', descricao: 'Uma semana no litoral de Santa Catarina em julho do ano que vem.', tipo: 'novo projeto', valor: 18000, criado_por: 'seed_u_nina', criado_em: somarMeses(compAtual, -11) + '-08', prazo: somarMeses(compAtual, -11) + '-15', status: 'aprovada', projeto_id: 'seed_p_viagem' },
    { id: 'seed_d_tv', titulo: 'Comprar TV nova para a sala', descricao: 'A TV da sala parou. Orçamento de R$ 2.800 em 10x.', tipo: 'gasto grande', valor: 2800, criado_por: 'seed_u_nina', criado_em: somarMeses(compAtual, -1) + '-20', prazo: somarMeses(compAtual, -1) + '-27', status: 'aprovada', projeto_id: '' },
  ]);
  inserirLinhas('Votos', [
    { decisao_id: 'seed_d_carro', usuario_id: 'seed_u_luiz', voto: 'sim', comentario: 'O atual já tem 12 anos.', data: hoje },
    { decisao_id: 'seed_d_carro', usuario_id: 'seed_u_julia', voto: 'sim', comentario: 'Mas primeiro a viagem!', data: hoje },
    { decisao_id: 'seed_d_viagem', usuario_id: 'seed_u_luiz', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-09' },
    { decisao_id: 'seed_d_viagem', usuario_id: 'seed_u_nina', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-08' },
    { decisao_id: 'seed_d_viagem', usuario_id: 'seed_u_julia', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-09' },
    { decisao_id: 'seed_d_viagem', usuario_id: 'seed_u_pedro', voto: 'sim', comentario: '', data: somarMeses(compAtual, -11) + '-10' },
    { decisao_id: 'seed_d_tv', usuario_id: 'seed_u_luiz', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-21' },
    { decisao_id: 'seed_d_tv', usuario_id: 'seed_u_nina', voto: 'sim', comentario: '', data: somarMeses(compAtual, -1) + '-20' },
    { decisao_id: 'seed_d_tv', usuario_id: 'seed_u_pedro', voto: 'não', comentario: 'Prefiro um videogame', data: somarMeses(compAtual, -1) + '-22' },
  ]);

  inserirLinhas('Alertas', [
    { id: 'seed_al_1', nome: 'Delivery acima de R$ 400/mês', tipo: 'categoria_acima', categoria_id: 'c_delivery', grupo_id: '', limite: 400, avisar: ['seed_u_luiz', 'seed_u_nina'], ativo: true, ultimo_disparo: '' },
    { id: 'seed_al_2', nome: 'Supermercado acima de R$ 2.000/mês', tipo: 'categoria_acima', categoria_id: 'c_mercado', grupo_id: '', limite: 2000, avisar: [], ativo: true, ultimo_disparo: '' },
    { id: 'seed_al_3', nome: 'Nova assinatura detectada', tipo: 'nova_assinatura', categoria_id: '', grupo_id: '', limite: 0, avisar: ['seed_u_luiz'], ativo: true, ultimo_disparo: '' },
  ]);

  const serie = (fn) => JSON.stringify(Array.from({ length: 12 }, (_, k) => ({ competencia: somarMeses(compAtual, -11 + k), valor: fn(k) })));
  inserirLinhas('Patrimonio', [
    { id: 'seed_pt_1', nome: 'Conta corrente', tipo: 'conta', instituicao: 'Itaú', titular_id: 'seed_u_luiz', saldos: serie((k) => 3000 + k * 180 + Math.round(rnd() * 900)), ativo: true },
    { id: 'seed_pt_2', nome: 'Reserva (CDB)', tipo: 'investimento', instituicao: 'Nubank', titular_id: 'seed_u_nina', saldos: serie((k) => 4000 + k * 640), ativo: true },
    { id: 'seed_pt_3', nome: 'Poupança da viagem', tipo: 'poupanca', instituicao: 'Caixa', titular_id: 'seed_u_luiz', saldos: serie((k) => 240 + (k + 1) * 800), ativo: true },
    { id: 'seed_pt_4', nome: 'Carro', tipo: 'veiculo', instituicao: '', titular_id: 'seed_u_luiz', saldos: serie((k) => 42000 - k * 250), ativo: true },
  ]);

  const caixa = [
    { texto: 'Compra aprovada no seu Itaú final 4821: R$ 87,40 em PADARIA PAO QUENTE em ' + hoje.slice(8, 10) + '/' + hoje.slice(5, 7) + ' às 08:12.', canal: 'sms_ios', valor: 87.4, est: 'PADARIA PAO QUENTE', final: '4821', uid: 'seed_u_luiz', data: hoje },
    { texto: 'Nubank: Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 0937.', canal: 'sms_android', valor: 156.9, est: 'DROGARIA NISSEI', final: '0937', uid: 'seed_u_nina', data: hoje },
    { texto: 'Alerta de compra: POSTO SHELL R$ 210,00 cartão final 4821', canal: 'email', valor: 210, est: 'POSTO SHELL', final: '4821', uid: 'seed_u_luiz', data: hoje },
    { texto: 'Compra aprovada no seu Itaú final 4821: R$ 44,90 em DISNEY PLUS em 13/' + hoje.slice(5, 7) + '.', canal: 'sms_ios', valor: 44.9, est: 'DISNEY PLUS', final: '4821', uid: 'seed_u_luiz', data: compAtual + '-13' },
  ].map((c) => {
    const sug = sugerirCategoria(c.est, categorias);
    return { id: sid('ce'), recebido_em: agora, canal: c.canal, texto_bruto: c.texto, valor: c.valor, estabelecimento: c.est, final_cartao: c.final, data_compra: c.data, sugestao_categoria: sug[0], sugestoes: sug, usuario_id: c.uid, status: 'pendente', lancamento_id: '', hash_dedup: hashDedup(c.valor, c.data, c.final, c.est) };
  });
  inserirLinhas('CaixaEntrada', caixa);

  console.log('Dados de exemplo criados: ' + lancamentos.length + ' lançamentos em ' + competencias.length + ' meses. Usuários de exemplo entram com PIN 1234.');
  return { lancamentos: lancamentos.length, meses: competencias.length };
}

/** Remove tudo o que seed_exemplo() criou (ids "seed_" e o orçamento das competências do seed). */
function limpar_exemplo() {
  const ehSeed = (campo) => (r) => String(r[campo] || '').indexOf(PREFIXO_SEED) === 0;
  const removidos = {};
  ['Usuarios', 'Cartoes', 'ContasFixas', 'Lancamentos', 'ContasAPagar', 'Projetos', 'Aportes', 'Decisoes', 'CaixaEntrada', 'Alertas', 'Patrimonio'].forEach((aba) => { removidos[aba] = removerLinhas(aba, ehSeed('id')); });
  removidos.Votos = removerLinhas('Votos', ehSeed('decisao_id'));
  removidos.Conversas = removerLinhas('Conversas', ehSeed('usuario_id'));
  removidos.Telegram = removerLinhas('Telegram', ehSeed('usuario_id'));
  removidos.RegrasLoja = removerLinhas('RegrasLoja', ehSeed('criado_por'));
  let comps = [];
  try { comps = JSON.parse(propriedade('SEED_COMPETENCIAS', '[]')); } catch (e) { comps = []; }
  removidos.Orcamento = removerLinhas('Orcamento', (o) => comps.indexOf(o.competencia) >= 0);
  PropertiesService.getScriptProperties().deleteProperty('SEED_COMPETENCIAS');
  console.log('Dados de exemplo removidos: ' + JSON.stringify(removidos));
  return removidos;
}
