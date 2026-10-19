/**
 * Finanças da Família — back-end Google Apps Script (arquivo único).
 * Gerado por apps-script/testes/empacotar.mjs a partir dos arquivos em apps-script/*.gs.
 * Cole este arquivo inteiro no Código.gs do seu projeto e o appsscript.json no manifesto.
 * Gerado em 2026-10-19.
 */

// ==============================================================================
// api.gs
// ==============================================================================

/**
 * api.gs — Porta de entrada do App da Web: doGet(e) e doPost(e).
 *
 *  - Lê o corpo JSON (enviado como text/plain para evitar o preflight CORS).
 *  - Roteia pela `acao` usando a tabela obterAcoes() (perfil mínimo + função).
 *  - Autentica: token_familia (aba Config) → token do usuário (aba Usuarios) → aplica o perfil.
 *  - Responde sempre no envelope { ok, dados, erro, versao } em JSON.
 *  - `?webhook=1` (GET ou POST) vai para o webhook de SMS em sms.gs.
 *  - `?telegram=1` (POST) vai para o webhook do bot do Telegram em telegram.gs.
 *  - Ações de escrita são registradas na aba Log.
 *
 * Perfis (versão 2): Administrador, Adulto e Dependente (chamado "Júnior" na versão 1 —
 * planilhas antigas continuam funcionando, o nome é convertido na leitura).
 *
 * Mensagens de erro são em português e aparecem na tela do app. Três delas são
 * "contratuais" (o app reage a elas): "Sessão expirada", "Sem permissão", "Família não encontrada".
 */

/** Hierarquia dos perfis: quem tem nível maior pode tudo que o menor pode. "Júnior" é sinônimo antigo. */
const NIVEL_PERFIL = { 'Dependente': 1, 'Júnior': 1, 'Adulto': 2, 'Administrador': 3 };

/** Parâmetros que nunca vão para o Log (segredos e arquivos grandes). */
const PARAMS_OCULTOS_LOG = ['token', 'token_familia', 'pin', 'imagem_base64', 'svg', 'texto', 'assinatura', 'mensagem', 'historico'];

/**
 * Tabela de ações: nome → { perfil mínimo (null = sem autenticação), fn(p, ctx), escrita }.
 * Montada por função (e não como const global) porque a ordem de carga dos arquivos .gs
 * não é garantida — assim todas as funções já existem quando a tabela é lida.
 */
function obterAcoes() {
  return {
    // Sem autenticação
    ping: { perfil: null, fn: acaoPing },
    entrar_convite: { perfil: null, fn: acaoEntrarConvite, escrita: true },
    entrar_pin: { perfil: null, fn: acaoEntrarPin },

    // Carga inicial e lançamentos
    bootstrap: { perfil: 'Dependente', fn: acaoBootstrap },
    resumo_mes: { perfil: 'Dependente', fn: acaoResumoMes },
    listar_lancamentos: { perfil: 'Dependente', fn: acaoListarLancamentos },
    salvar_lancamento: { perfil: 'Dependente', fn: acaoSalvarLancamento, escrita: true },
    excluir_lancamento: { perfil: 'Dependente', fn: acaoExcluirLancamento, escrita: true },
    desfazer_exclusao: { perfil: 'Dependente', fn: acaoDesfazerExclusao, escrita: true },
    painel: { perfil: 'Adulto', fn: acaoPainel },
    listar_categorias: { perfil: 'Dependente', fn: acaoListarCategorias },
    salvar_categoria: { perfil: 'Administrador', fn: acaoSalvarCategoria, escrita: true },
    salvar_grupo: { perfil: 'Administrador', fn: acaoSalvarGrupo, escrita: true },
    listar_regras_loja: { perfil: 'Dependente', fn: acaoListarRegrasLoja },
    salvar_regra_loja: { perfil: 'Dependente', fn: acaoSalvarRegraLoja, escrita: true },
    listar_orcamento: { perfil: 'Adulto', fn: acaoListarOrcamento },
    salvar_orcamento: { perfil: 'Administrador', fn: acaoSalvarOrcamento, escrita: true },
    copiar_orcamento: { perfil: 'Administrador', fn: acaoCopiarOrcamento, escrita: true },
    mesada: { perfil: 'Dependente', fn: acaoMesada },
    exportar: { perfil: 'Administrador', fn: acaoExportar, escrita: true },
    log: { perfil: 'Administrador', fn: acaoLog },

    // Leitura inteligente
    ler_imagem: { perfil: 'Dependente', fn: acaoLerImagem, escrita: true },
    ler_texto: { perfil: 'Dependente', fn: acaoLerTexto },
    consultar_nfce: { perfil: 'Dependente', fn: acaoConsultarNfce },

    // Contas da casa e previsão de saídas
    listar_contas_fixas: { perfil: 'Adulto', fn: acaoListarContasFixas },
    salvar_conta_fixa: { perfil: 'Administrador', fn: acaoSalvarContaFixa, escrita: true },
    listar_contas_a_pagar: { perfil: 'Adulto', fn: acaoListarContasAPagar },
    salvar_conta_a_pagar: { perfil: 'Adulto', fn: acaoSalvarContaAPagar, escrita: true },
    marcar_conta_paga: { perfil: 'Adulto', fn: acaoMarcarContaPaga, escrita: true },
    consumo_historico: { perfil: 'Adulto', fn: acaoConsumoHistorico },
    proximas_saidas: { perfil: 'Adulto', fn: acaoProximasSaidas },

    // Cartões e caixa de entrada
    listar_cartoes: { perfil: 'Adulto', fn: acaoListarCartoes },
    salvar_cartao: { perfil: 'Administrador', fn: acaoSalvarCartao, escrita: true },
    listar_caixa_entrada: { perfil: 'Dependente', fn: acaoListarCaixaEntrada },
    resolver_caixa_entrada: { perfil: 'Dependente', fn: acaoResolverCaixaEntrada, escrita: true },
    importar_fatura: { perfil: 'Adulto', fn: acaoImportarFatura },
    confirmar_importacao: { perfil: 'Adulto', fn: acaoConfirmarImportacao, escrita: true },

    // Família: projetos, decisões, reunião
    listar_projetos: { perfil: 'Dependente', fn: acaoListarProjetos },
    salvar_projeto: { perfil: 'Dependente', fn: acaoSalvarProjeto, escrita: true }, // Dependente só cria/edita o próprio (checado na função)
    aportar: { perfil: 'Dependente', fn: acaoAportar, escrita: true },
    listar_aportes: { perfil: 'Dependente', fn: acaoListarAportes },
    listar_decisoes: { perfil: 'Dependente', fn: acaoListarDecisoes },
    salvar_decisao: { perfil: 'Dependente', fn: acaoSalvarDecisao, escrita: true },
    votar: { perfil: 'Dependente', fn: acaoVotar, escrita: true },
    encerrar_decisao: { perfil: 'Administrador', fn: acaoEncerrarDecisao, escrita: true },
    pauta_reuniao: { perfil: 'Adulto', fn: acaoPautaReuniao },
    salvar_reuniao: { perfil: 'Adulto', fn: acaoSalvarReuniao, escrita: true },
    listar_reunioes: { perfil: 'Adulto', fn: acaoListarReunioes },
    relatorio_mensal: { perfil: 'Adulto', fn: acaoRelatorioMensal },
    versiculo_do_dia: { perfil: 'Dependente', fn: acaoVersiculoDoDia },

    // Assistente, avisos, alertas e patrimônio (versão 2)
    assistente: { perfil: 'Dependente', fn: acaoAssistente, escrita: true },
    assistente_sugestoes: { perfil: 'Dependente', fn: acaoAssistenteSugestoes },
    listar_conversa: { perfil: 'Dependente', fn: acaoListarConversa },
    listar_avisos: { perfil: 'Adulto', fn: acaoListarAvisos },
    marcar_aviso_lido: { perfil: 'Adulto', fn: acaoMarcarAvisoLido, escrita: true },
    listar_alertas: { perfil: 'Adulto', fn: acaoListarAlertas },
    salvar_alerta: { perfil: 'Adulto', fn: acaoSalvarAlerta, escrita: true },
    excluir_alerta: { perfil: 'Adulto', fn: acaoExcluirAlerta, escrita: true },
    listar_patrimonio: { perfil: 'Adulto', fn: acaoListarPatrimonio },
    salvar_patrimonio: { perfil: 'Administrador', fn: acaoSalvarPatrimonio, escrita: true },
    registrar_saldo_patrimonio: { perfil: 'Adulto', fn: acaoRegistrarSaldoPatrimonio, escrita: true },
    vincular_telegram: { perfil: 'Dependente', fn: acaoVincularTelegram, escrita: true },

    // Usuários, configuração e arquivos
    listar_usuarios: { perfil: 'Adulto', fn: acaoListarUsuarios },
    salvar_usuario: { perfil: 'Administrador', fn: acaoSalvarUsuario, escrita: true },
    gerar_convite: { perfil: 'Administrador', fn: acaoGerarConvite, escrita: true },
    renovar_token: { perfil: 'Dependente', fn: acaoRenovarToken, escrita: true },
    redefinir_pin: { perfil: 'Administrador', fn: acaoRedefinirPin, escrita: true },
    salvar_config: { perfil: 'Administrador', fn: acaoSalvarConfig, escrita: true },
    enviar_arquivo: { perfil: 'Adulto', fn: acaoEnviarArquivo, escrita: true },
    salvar_brasao_svg: { perfil: 'Administrador', fn: acaoSalvarBrasaoSvg, escrita: true },
    backup_agora: { perfil: 'Administrador', fn: acaoBackupAgora, escrita: true },
    registrar_push: { perfil: 'Dependente', fn: acaoRegistrarPush, escrita: true },
  };
}

// ---------- Entradas HTTP ----------

function doGet(e) {
  return responderJson(tratarRequisicao(e || {}, 'GET'));
}

function doPost(e) {
  return responderJson(tratarRequisicao(e || {}, 'POST'));
}

/** Monta a saída JSON (ContentService). */
function responderJson(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

/** Junta parâmetros da URL com o corpo JSON (text/plain). */
function extrairParametros(e, metodo) {
  const params = Object.assign({}, e.parameter || {});
  if (metodo === 'POST' && e.postData && e.postData.contents) {
    const texto = String(e.postData.contents).trim();
    // O app envia JSON como text/plain. Um corpo de formulário (application/x-www-form-urlencoded, usado por
    // alguns apps de automação no webhook) já chega desmontado em e.parameter e não deve passar pelo JSON.parse.
    if (texto && (texto.charAt(0) === '{' || texto.charAt(0) === '[')) {
      let corpo;
      try { corpo = JSON.parse(texto); } catch (erro) { throw new ErroUsuario('Não entendi o pedido (o corpo não é um JSON válido).'); }
      if (corpo && typeof corpo === 'object' && !Array.isArray(corpo)) Object.assign(params, corpo);
    } else if (texto && !Object.keys(params).length) {
      throw new ErroUsuario('Não entendi o pedido (o corpo não é um JSON válido).');
    }
  }
  return params;
}

/** Decide entre webhook de SMS, webhook do Telegram e ação normal; nunca deixa uma exceção escapar sem envelope. */
function tratarRequisicao(e, metodo) {
  try {
    const parametrosUrl = (e && e.parameter) || {};
    // O Telegram envia o "update" como JSON no corpo; o sinal vem só na URL (?telegram=1).
    if (String(parametrosUrl.telegram || '') === '1') return { ok: true, dados: tratarWebhookTelegram(e, parametrosUrl), versao: VERSAO_API };
    const params = extrairParametros(e, metodo);
    if (String(params.webhook || '') === '1') return { ok: true, dados: tratarWebhook(params), versao: VERSAO_API };
    return executarAcao(params);
  } catch (erro) {
    return envelopeErro(erro);
  }
}

/** Converte qualquer erro em { ok:false, erro } com mensagem legível. */
function envelopeErro(erro) {
  const msg = erro && erro.message ? erro.message : String(erro);
  if (!(erro instanceof ErroUsuario)) console.error('Erro na API: ' + msg + (erro && erro.stack ? '\n' + erro.stack : ''));
  return { ok: false, erro: erro instanceof ErroUsuario ? msg : 'Algo deu errado no servidor: ' + msg, versao: VERSAO_API };
}

// ---------- Roteamento e autenticação ----------

/** Monta o contexto de execução para um usuário já carregado (usado pela API e pelo Telegram). */
function contextoPara(usuario, p) {
  const perfil = usuario ? normalizarPerfil(usuario.perfil) : '';
  return {
    p: p || {}, usuario: usuario || null, uid: usuario ? usuario.id : '', perfil,
    ehDependente: perfil === 'Dependente', ehJunior: perfil === 'Dependente', // ehJunior: nome antigo, mantido por compatibilidade
    ehAdmin: perfil === 'Administrador', config: lerConfig(),
  };
}

/** Executa uma ação do contrato com autenticação e perfil. */
function executarAcao(p) {
  const nome = String(p.acao || '');
  if (!nome) throw new ErroUsuario('Ação não informada.');
  const def = obterAcoes()[nome];
  if (!def) throw new ErroUsuario('Ação desconhecida: ' + nome);

  let ctx = { p, usuario: null, uid: '', perfil: '', ehDependente: false, ehJunior: false, ehAdmin: false, config: null };

  if (nome !== 'ping') {
    validarTokenFamilia(p.token_familia);
    ctx.config = lerConfig();
  }
  if (def.perfil) {
    const usuario = autenticarUsuario(p.token, p.usuario_id);
    ctx = contextoPara(usuario, p);
    exigirPerfil(ctx, def.perfil);
  }

  const dados = def.fn(p, ctx);
  if (def.escrita) registrarLog(ctx.uid || '', nome, resumirParaLog(p));
  return { ok: true, dados: dados === undefined ? null : dados, versao: VERSAO_API };
}

/** Confere o token da família (aba Config). */
function validarTokenFamilia(token) {
  const cfg = lerConfigCompleta();
  if (!cfg.token_familia || !token || !compararConstante(String(token), String(cfg.token_familia))) {
    throw new ErroUsuario('Família não encontrada');
  }
}

/** Carrega o usuário pelo token; atualiza o último acesso uma vez por dia. */
function autenticarUsuario(token, usuarioIdInformado) {
  if (!token) throw new ErroUsuario('Sessão expirada');
  const usuario = usuarioPorToken(String(token));
  if (!usuario || !usuario.ativo) throw new ErroUsuario('Sessão expirada');
  if (usuarioIdInformado && String(usuarioIdInformado) !== usuario.id) throw new ErroUsuario('Sessão expirada');
  if (String(usuario.ultimo_acesso || '').slice(0, 10) !== hojeIso()) {
    try { atualizarPorId('Usuarios', usuario.id, { ultimo_acesso: agoraIso() }); } catch (e) { /* não é crítico */ }
  }
  return usuario;
}

/** Lança "Sem permissão" se o perfil do contexto for menor que o exigido. */
function exigirPerfil(ctx, perfilMinimo) {
  if ((NIVEL_PERFIL[ctx.perfil] || 0) < (NIVEL_PERFIL[perfilMinimo] || 0)) throw new ErroUsuario('Sem permissão');
}

/** Resumo dos parâmetros para a aba Log (sem segredos e sem arquivos). */
function resumirParaLog(p) {
  const copia = {};
  Object.keys(p || {}).forEach((k) => {
    if (k === 'acao' || PARAMS_OCULTOS_LOG.indexOf(k) >= 0) return;
    const v = p[k];
    if (typeof v === 'string' && v.length > 120) return;
    copia[k] = v;
  });
  if (copia.lancamento) copia.lancamento = { id: copia.lancamento.id, valor: copia.lancamento.valor, descricao: copia.lancamento.descricao };
  if (copia.usuario) copia.usuario = { id: copia.usuario.id, apelido: copia.usuario.apelido, perfil: copia.usuario.perfil };
  return JSON.stringify(copia).slice(0, 400);
}

// ---------- Ajudantes de perfil usados por várias ações ----------

/** Ids das categorias sensíveis (salários) que o Dependente não vê. */
function idsCategoriasSensiveis() {
  return lerAba('Categorias').filter((c) => c.sensivel).map((c) => c.id);
}

/** Dependente pode ver dados sensíveis? (configuração dependente_ve_salarios) */
function dependenteVeSensivel(ctx) {
  return !ctx.ehDependente || !!(ctx.config && ctx.config.dependente_ve_salarios);
}

/** Nome antigo (v1) de dependenteVeSensivel — mantido para quem ainda chamar. */
function juniorVeSensivel(ctx) {
  return dependenteVeSensivel(ctx);
}

/** Remove lançamentos de categorias sensíveis quando o usuário é Dependente. */
function filtrarSensivel(ctx, lancamentos) {
  if (dependenteVeSensivel(ctx)) return lancamentos;
  const sensiveis = idsCategoriasSensiveis();
  return lancamentos.filter((l) => sensiveis.indexOf(l.categoria_id) < 0);
}

/** Categorias ativas visíveis para o usuário. */
function categoriasVisiveis(ctx) {
  return lerAba('Categorias').filter((c) => c.ativa && (dependenteVeSensivel(ctx) || !c.sensivel));
}

/** Lançamentos não excluídos. */
function lancamentosAtivos() {
  return lerAba('Lancamentos').filter((l) => !l.excluido);
}

/** Contexto "de sistema" (sem usuário) para as rotinas automáticas: vê tudo. */
function contextoSistema() {
  return { p: {}, usuario: null, uid: '', perfil: 'Administrador', ehDependente: false, ehJunior: false, ehAdmin: true, config: lerConfig() };
}

// ---------- ping ----------

/** Sem autenticação. Devolve o nome da família só se o token_familia conferir. */
function acaoPing(p) {
  let nome = '';
  try {
    const cfg = lerConfigCompleta();
    if (p.token_familia && cfg.token_familia && compararConstante(String(p.token_familia), String(cfg.token_familia))) nome = cfg.nome_familia || '';
  } catch (e) { /* planilha ainda não instalada: responde mesmo assim */ }
  return { versao: VERSAO_API, nome_familia: nome };
}

// ==============================================================================
// setup.gs
// ==============================================================================

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
 *  - URL_APP (opcional): endereço do app publicado (para montar o link de convite). Padrão: URL_APP_PADRAO.
 *  - CHAVE_API_CLAUDE / MODELO_CLAUDE: leitura inteligente e assistente (opcional).
 *  - TOKEN_TELEGRAM: token do bot (opcional; ver telegram.gs).
 *  - URL_SERVICO_PUSH / TOKEN_SERVICO_PUSH: notificações push (opcional).
 *  - EMAILS_ADMIN: e-mails dos administradores para os resumos (opcional).
 *  - ID_PASTA / ID_PLANILHA: gravadas automaticamente por instalar() (ID_PASTA pode ser definida antes para escolher a pasta).
 */

/** Sobrenome padrão da família (pode editar aqui ou definir SOBRENOME nas Script Properties). */
const SOBRENOME_PADRAO = 'Melo Reis';

/** Endereço padrão do app publicado (GitHub Pages deste repositório). Pode sobrescrever com URL_APP nas Script Properties. */
const URL_APP_PADRAO = 'https://luizmeloreis.github.io/Finan-as-familiares/';

function obterUrlApp() {
  return propriedade('URL_APP', URL_APP_PADRAO);
}

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

/**
 * Pasta do Drive escolhida pela família para guardar tudo (planilha, cupons, contas, faturas, backups):
 * "FINANCAS FAMILIARES - APP". É usada quando a conta que instala tem acesso a ela; senão, a
 * instalação cria "Finanças da Família <Sobrenome>" na raiz do Drive. ID_PASTA nas Script
 * Properties tem prioridade sobre as duas.
 */
const ID_PASTA_PADRAO = '1bRifuNP_-E256Gb64wIjPKrtkYSzNN4c';

/** Pasta raiz (ID_PASTA → ID_PASTA_PADRAO → cria "Finanças da Família <Sobrenome>"). */
function pastaRaiz() {
  const id = propriedade('ID_PASTA', '');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* foi apagada: segue abaixo */ }
  }
  if (ID_PASTA_PADRAO) {
    try {
      const escolhida = DriveApp.getFolderById(ID_PASTA_PADRAO);
      definirPropriedade('ID_PASTA', escolhida.getId());
      return escolhida;
    } catch (e) { /* sem acesso à pasta escolhida: cria uma própria */ }
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
  // O endpoint "uc?export=view" deixou de servir imagens em <img>; este funciona para arquivos
  // compartilhados com "qualquer pessoa com o link".
  return 'https://lh3.googleusercontent.com/d/' + id;
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
    proximo_passo: 'Implantar → Nova implantação → App da Web (Executar como: Eu; Acesso: Qualquer pessoa) → Implantar. ' +
      'Depois volte aqui, escolha a função linkDeAcesso e clique em Executar: o registro mostra o link para abrir no celular. ' +
      'Opcional: CHAVE_API_CLAUDE e TOKEN_TELEGRAM nas Propriedades do script (para o Telegram, rode configurarTelegram()).',
  };
  console.log('Instalação concluída.\n' + (avisoPin ? avisoPin + '\n' : '') + JSON.stringify(resumo, null, 2));
  return resumo;
}

/**
 * linkDeAcesso — Rode DEPOIS de implantar como App da Web (e depois de instalar()).
 * Cria um convite de Administrador e imprime no registro de execução um link pronto para
 * abrir no celular: ele já leva a URL da API, o token da família e o código do convite,
 * então não é preciso digitar nada nem mexer em Propriedades do script.
 *
 * Na primeira vez, o convite fica ligado ao usuário "Administrador" criado por instalar():
 * quem abrir o link escolhe nome, foto e PIN e passa a ser esse administrador.
 * Nas vezes seguintes, cria um convite de Administrador novo (para outro adulto da família).
 */
function linkDeAcesso() {
  const cfg = lerConfigCompleta();
  if (!cfg.token_familia) throw new Error('Rode instalar() primeiro.');
  const api = urlDoAppWeb();
  const usuarios = lerAba('Usuarios');
  const adminInicial = usuarios.find((u) => u.perfil === 'Administrador' && u.origem === 'instalacao' && u.apelido === 'Administrador');
  const convite = criarConvite('Administrador', adminInicial ? adminInicial.id : 'instalacao', adminInicial ? adminInicial.id : '');
  const link = montarLinkConvite(convite.codigo, 'Administrador', api, cfg.token_familia);
  const linhas = [];
  if (!api) {
    linhas.push('O App da Web ainda não foi implantado. Faça: Implantar → Nova implantação → App da Web (Executar como: Eu; Acesso: Qualquer pessoa) → Implantar. Depois rode linkDeAcesso() de novo.');
    linhas.push('Enquanto isso, estes dados servem para "Já tenho a URL da API" no app:');
  } else {
    linhas.push('ABRA ESTE LINK NO NAVEGADOR DO CELULAR (vale por ' + DIAS_VALIDADE_CONVITE + ' dias, uma única vez):');
    linhas.push(link);
    linhas.push('');
    linhas.push('No celular: Compartilhar → "Adicionar à Tela de Início" (iPhone) ou menu ⋮ → "Instalar app" (Android); depois escolha nome, foto e PIN.');
    if (/\/dev$/.test(api)) linhas.push('Atenção: a URL da API terminou em /dev. Use a URL que termina em /exec (Implantar → Gerenciar implantações) no lugar dela.');
    linhas.push('');
    linhas.push('Se preferir digitar no app ("Já tenho a URL da API"):');
  }
  linhas.push('  URL da API: ' + (api || '(implante primeiro)'));
  linhas.push('  Token da família: ' + cfg.token_familia);
  linhas.push('  Código do convite: ' + convite.codigo + ' (perfil Administrador)');
  console.log(linhas.join('\n'));
  return { link, url_api: api, token_familia: cfg.token_familia, codigo_convite: convite.codigo, expira_em: convite.expira_em };
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
      // A v1 não tinha a coluna `ativo` em Grupos: a célula vazia é lida como false, então grupo sem tipo_id (v1) fica ativo.
      ordem: ini ? ini.ordem : g.ordem, ativo: g.tipo_id ? !!g.ativo : true,
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
  const h = parseInt(String(horario || '').split(':')[0], 10); // "00:30" → 0 (e não o padrão)
  return isNaN(h) ? (padrao === undefined ? 20 : padrao) : Math.min(23, Math.max(0, h));
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

// ==============================================================================
// util.gs
// ==============================================================================

/**
 * util.gs — Funções puras de apoio (sem acesso a planilha, Drive ou rede).
 *
 * Tudo aqui pode ser testado fora do Apps Script (ver testes/executar.mjs).
 * Mantém a mesma lógica de app/src/util/formato.ts para que o app e o servidor
 * calculem hash_dedup, competência e normalização do mesmo jeito.
 */

/** Versão da API devolvida no envelope. */
const VERSAO_API = '2.0.0';

/** Ids fixos dos 4 tipos (cards da tela inicial). Nunca aumentam. */
const TIPO_RECEITAS = 't_receitas';
const TIPO_FIXAS = 't_fixas';
const TIPO_VARIAVEIS = 't_variaveis';
const TIPO_PROJETOS = 't_projetos';
/** Só estes três tipos aceitam grupos novos. */
const TIPOS_COM_GRUPOS = [TIPO_RECEITAS, TIPO_FIXAS, TIPO_VARIAVEIS];
/** Categoria dos aportes em projetos (lançada pela tela Projetos; não conta como despesa). */
const CATEGORIA_APORTE = 'c_aporte_projeto';
/** Nomes antigos (v1) que ainda podem aparecer em planilhas antigas. */
const CATEGORIA_APORTE_ANTIGA = 'c_aporte_sonho';

/** Fuso usado para datas (o mesmo do appsscript.json). */
const FUSO = 'America/Sao_Paulo';

/** Arredonda para 2 casas (centavos). */
function arredondar(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

/** Converte "1.234,56", "1234.56", 45 em número (0 se inválido). */
function lerValor(texto) {
  if (texto === null || texto === undefined || texto === '') return 0;
  if (typeof texto === 'number') return arredondar(texto);
  let t = String(texto).replace(/[^\d,.-]/g, '');
  if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? 0 : arredondar(n);
}

/** Preenche com zeros à esquerda. */
function zeros(n, tamanho) {
  let s = String(n);
  while (s.length < (tamanho || 2)) s = '0' + s;
  return s;
}

/** É um objeto Date (checagem por "duck typing", para não depender do realm). */
function ehData(v) {
  return !!v && typeof v === 'object' && typeof v.getTime === 'function';
}

/** Objeto Date → "aaaa-mm-dd" (no fuso local do script). */
function dataParaIso(d) {
  if (!ehData(d) || isNaN(d.getTime())) return '';
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) return Utilities.formatDate(d, FUSO, 'yyyy-MM-dd');
  return d.getFullYear() + '-' + zeros(d.getMonth() + 1) + '-' + zeros(d.getDate());
}

/** Objeto Date → "aaaa-mm-ddThh:mm:ss" (no fuso local do script). */
function dataHoraParaIso(d) {
  if (!ehData(d) || isNaN(d.getTime())) return '';
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) return Utilities.formatDate(d, FUSO, "yyyy-MM-dd'T'HH:mm:ss");
  return dataParaIso(d) + 'T' + zeros(d.getHours()) + ':' + zeros(d.getMinutes()) + ':' + zeros(d.getSeconds());
}

/** Hoje em ISO (aaaa-mm-dd). */
function hojeIso() {
  return dataParaIso(new Date());
}

/** Agora em ISO com hora. */
function agoraIso() {
  return dataHoraParaIso(new Date());
}

/** "aaaa-mm-dd" → Date (meio-dia local, para não escorregar de dia por fuso). */
function isoParaData(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

/** dd/mm/aaaa → ISO; se já for ISO, devolve só a parte da data. */
function normalizarDataIso(texto) {
  if (!texto) return '';
  if (ehData(texto)) return dataParaIso(texto);
  const s = String(texto).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const ano = br[3].length === 2 ? '20' + br[3] : br[3];
    return ano + '-' + zeros(br[2]) + '-' + zeros(br[1]);
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  return s;
}

/** AAAA-MM de uma data ISO (ou de hoje). */
function competenciaDe(iso) {
  return (iso ? normalizarDataIso(iso) : hojeIso()).slice(0, 7);
}

/** Soma n meses a uma competência AAAA-MM. */
function somarMeses(comp, n) {
  const partes = String(comp).split('-').map(Number);
  const d = new Date(partes[0], partes[1] - 1 + n, 1);
  return d.getFullYear() + '-' + zeros(d.getMonth() + 1);
}

/** Soma n dias a uma data ISO. */
function somarDias(iso, n) {
  const d = isoParaData(iso) || new Date();
  d.setDate(d.getDate() + n);
  return dataParaIso(d);
}

/** Diferença em dias entre duas datas ISO (b - a). */
function diferencaDias(a, b) {
  const da = isoParaData(a), db = isoParaData(b);
  if (!da || !db) return NaN;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** Último dia do mês de uma competência. */
function ultimoDiaDoMes(comp) {
  const partes = String(comp).split('-').map(Number);
  return new Date(partes[0], partes[1], 0).getDate();
}

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "2026-03" → "Março de 2026" (ou, com curto=true, "Mar/26" — igual ao app). */
function nomeCompetencia(comp, curto) {
  const partes = String(comp).split('-').map(Number);
  if (!partes[0] || !partes[1]) return comp;
  if (curto) return MESES_CURTOS_PT[partes[1] - 1] + '/' + String(partes[0]).slice(2);
  return MESES_PT[partes[1] - 1] + ' de ' + partes[0];
}

/** Nome do mês em minúsculas ("outubro") a partir da competência. */
function nomeMes(comp) {
  const m = Number(String(comp).slice(5, 7));
  return m >= 1 && m <= 12 ? MESES_PT[m - 1].toLowerCase() : String(comp);
}

/** "2026-10-17" → "17/10/2026" */
function dataBr(iso) {
  const s = String(iso || '').slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : s;
}

/** Nome do perfil na versão 2: "Júnior" (v1) passou a se chamar "Dependente". */
function normalizarPerfil(perfil) {
  const p = String(perfil || '').trim();
  if (normalizar(p) === 'JUNIOR') return 'Dependente';
  if (['Administrador', 'Adulto', 'Dependente'].indexOf(p) >= 0) return p;
  return p || 'Adulto';
}

/**
 * Uma categoria conta como despesa "de verdade"? Aportes em projetos (tipo t_projetos,
 * categoria c_aporte_projeto) são poupança: saem do caixa, mas não são gasto.
 */
function ehDespesaReal(categoria) {
  if (!categoria || categoria.tipo !== 'despesa') return false;
  if (categoria.tipo_id === TIPO_PROJETOS) return false;
  return categoria.id !== CATEGORIA_APORTE && categoria.id !== CATEGORIA_APORTE_ANTIGA;
}

/** Média simples de uma lista de números (0 se vazia). */
function media(lista) {
  if (!lista || !lista.length) return 0;
  return lista.reduce((s, v) => s + (Number(v) || 0), 0) / lista.length;
}

/** Soma de uma lista de números. */
function somar(lista, pegar) {
  return (lista || []).reduce((s, x) => s + (Number(pegar ? pegar(x) : x) || 0), 0);
}

/** Normaliza texto para comparação: sem acento, maiúsculo, só letras/números. */
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hash simples e determinístico (djb2), igual ao do app. */
function hashTexto(texto) {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** hash_dedup = valor + data + final_cartao + estabelecimento normalizado (igual ao app). */
function hashDedup(valor, dataIso, finalCartao, estabelecimento) {
  return hashTexto(
    Number(valor).toFixed(2) + '|' + String(dataIso || '').slice(0, 10) + '|' + (finalCartao || '') + '|' + normalizar(estabelecimento).slice(0, 20)
  );
}

/** Gera um id curto e único com prefixo ("l_k3j2h1abcde"). */
function gerarId(prefixo) {
  return (prefixo || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Token aleatório longo (sessões, token_familia). */
function gerarToken(tamanho) {
  const alfabeto = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < (tamanho || 32); i++) s += alfabeto.charAt(Math.floor(Math.random() * alfabeto.length));
  return s;
}

/** Código de convite legível (6 caracteres, sem 0/O/1/I). */
function gerarCodigoConvite() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alfabeto.charAt(Math.floor(Math.random() * alfabeto.length));
  return s;
}

/** Formata valor em reais para e-mails e pautas (R$ 1.234,56). */
function moeda(valor) {
  const n = arredondar(valor);
  const negativo = n < 0;
  const partes = Math.abs(n).toFixed(2).split('.');
  const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negativo ? '-' : '') + 'R$ ' + inteiro + ',' + partes[1];
}

/** Só os 4 últimos dígitos de um número de cartão — nunca guardamos o número completo. */
function apenasFinalCartao(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return digitos.slice(-4);
}

/** Converte "S"/"N", true/false, "true"/"false" em booleano. */
function paraBooleano(v) {
  if (v === true || v === false) return v;
  const s = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
  return s === 'S' || s === 'TRUE' || s === '1' || s === 'SIM';
}

/** Cópia rasa sem chaves undefined (para gravar/retornar limpo). */
function semUndefined(obj) {
  const r = {};
  Object.keys(obj || {}).forEach((k) => { if (obj[k] !== undefined) r[k] = obj[k]; });
  return r;
}

/**
 * Distribui uma compra parcelada no cartão (função pura).
 * Regra: compra depois do dia de fechamento cai na competência seguinte;
 * cada parcela vai para um mês; a última recebe o ajuste de centavos.
 * @param {Object} base lançamento base (valor total, data, cartao_id...)
 * @param {number} parcelas quantidade
 * @param {Object|null} cartao cartão (usa dia_fechamento) ou null
 * @param {Function} [geradorId] para testes determinísticos
 */
function distribuirParcelas(base, parcelas, cartao, geradorId) {
  const gid = geradorId || gerarId;
  const total = arredondar(base.valor);
  const valorParcela = arredondar(total / parcelas);
  const diaCompra = Number(String(base.data).slice(8, 10));
  let compInicial = competenciaDe(base.data);
  if (cartao && diaCompra > Number(cartao.dia_fechamento)) compInicial = somarMeses(compInicial, 1);
  const grupo = gid('parc');
  const lista = [];
  for (let i = 0; i < parcelas; i++) {
    const ultima = i === parcelas - 1;
    lista.push(Object.assign({}, base, {
      id: gid('l'),
      competencia: somarMeses(compInicial, i),
      valor: ultima ? arredondar(total - valorParcela * (parcelas - 1)) : valorParcela,
      parcela: (i + 1) + '/' + parcelas,
      hash_dedup: grupo + '_' + i,
    }));
  }
  return lista;
}

/**
 * Regra de votação (função pura).
 * - 'maioria': aprovada se sim > não.
 * - 'maioria_mais_pais': além da maioria, nenhum Administrador (pai/mãe) pode ter votado "não".
 * @param {Array} votos [{usuario_id, voto}]
 * @param {string} regra
 * @param {Array<string>} idsPais ids dos usuários Administrador
 */
function aplicarRegraVotacao(votos, regra, idsPais) {
  const sim = votos.filter((v) => v.voto === 'sim').length;
  const nao = votos.filter((v) => v.voto === 'não').length;
  let aprovada = sim > nao;
  if (regra === 'maioria_mais_pais') {
    const paisContra = votos.some((v) => idsPais.indexOf(v.usuario_id) >= 0 && v.voto === 'não');
    aprovada = aprovada && !paisContra;
  }
  return aprovada;
}

/**
 * Sugere até 6 categorias para um texto pelas palavras-chave (mesma lógica do app).
 * @param {string} texto
 * @param {Array} categorias
 * @param {string} [tipo] 'despesa' (padrão) ou 'receita'
 */
function sugerirCategoria(texto, categorias, tipo) {
  const alvo = tipo || 'despesa';
  const t = normalizar(texto);
  const pontuadas = [];
  (categorias || []).forEach((c) => {
    if (c.tipo !== alvo || c.ativa === false) return;
    let pontos = 0;
    String(c.palavras_chave || '').split(';').map((s) => normalizar(s)).filter(Boolean).forEach((pc) => {
      if (t.indexOf(pc) >= 0) pontos += pc.length >= 5 ? 3 : 2;
    });
    if (t.indexOf(normalizar(c.nome)) >= 0) pontos += 2;
    const primeira = normalizar(c.nome).split(' ')[0];
    if (primeira.length > 3 && t.indexOf(primeira) >= 0) pontos += 1;
    if (pontos) pontuadas.push({ id: c.id, pontos });
  });
  pontuadas.sort((a, b) => b.pontos - a.pontos);
  const ids = pontuadas.map((p) => p.id);
  const padrao = ['c_mercado', 'c_padaria', 'c_delivery', 'c_farmacia', 'c_combustivel', 'c_passeios', 'c_imprevistos'];
  padrao.forEach((p) => {
    if (ids.length < 6 && ids.indexOf(p) < 0 && (categorias || []).some((c) => c.id === p)) ids.push(p);
  });
  return ids.slice(0, 6);
}

/** Erro "de negócio": a mensagem vai direto para o usuário. */
class ErroUsuario extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroUsuario';
  }
}

// ==============================================================================
// bd.gs
// ==============================================================================

/**
 * bd.gs — Camada de acesso à planilha BD_Financas_Familia.
 *
 * Responsabilidades:
 *  - esquema de todas as abas (colunas, tipos);
 *  - ler uma aba como array de objetos (cabeçalho → chave);
 *  - inserir, atualizar por id, substituir linhas;
 *  - cache em memória por execução + CacheService (em pedaços) para leituras pesadas,
 *    invalidado a cada escrita;
 *  - LockService nas escritas;
 *  - conversão de tipos: números, booleanos ("S"/"N"), listas ("a;b;c") e datas em texto ISO
 *    (gravamos datas como TEXTO para não sofrer com fuso horário).
 *
 * Nenhuma regra de negócio aqui — só leitura e gravação.
 *
 * Versão 2: abas Tipos, RegrasLoja, Alertas, Patrimonio, Avisos, Conversas e Telegram;
 * Grupos e Categorias ganharam tipo_id, grupo_analise e cor da paleta (ver app/src/tipos/index.ts).
 */

/** Nome da planilha criada por instalar(). */
const NOME_PLANILHA = 'BD_Financas_Familia';

/**
 * Esquema das abas. As colunas são exatamente os campos de app/src/tipos/index.ts,
 * mais algumas colunas internas (pin_hash, pin_sal, origem em Usuarios; hash_dedup na CaixaEntrada).
 *  - numeros: lidos como Number
 *  - booleanos: gravados "S"/"N"
 *  - listas: gravadas "a;b;c" e lidas como array
 *  - datas: colunas só com data (aaaa-mm-dd); as demais datas levam hora
 *  - cachear: usa CacheService além da memória
 */
const ESQUEMA = {
  Config: { colunas: ['chave', 'valor'], cachear: true },
  Usuarios: {
    colunas: ['id', 'nome', 'apelido', 'avatar', 'cor', 'perfil', 'ativo', 'criado_em', 'ultimo_acesso', 'mesada_mensal', 'token', 'pin_hash', 'pin_sal', 'origem'],
    numeros: ['mesada_mensal'], booleanos: ['ativo'], cachear: true,
  },
  Tipos: { colunas: ['id', 'nome', 'icone', 'cor', 'ordem'], numeros: ['ordem'], cachear: true },
  Grupos: { colunas: ['id', 'tipo_id', 'nome', 'cor', 'grupo_analise', 'ordem', 'ativo'], numeros: ['ordem'], booleanos: ['ativo'], cachear: true },
  Categorias: {
    colunas: ['id', 'tipo_id', 'grupo_id', 'nome', 'icone', 'cor', 'tipo', 'fixa', 'orcamento_mensal', 'palavras_chave', 'grupo_analise', 'sensivel', 'oculta_cardapio', 'ativa'],
    numeros: ['orcamento_mensal'], booleanos: ['fixa', 'ativa', 'sensivel', 'oculta_cardapio'], cachear: true,
  },
  RegrasLoja: { colunas: ['id', 'loja_normalizada', 'categoria_id', 'criado_por', 'criado_em', 'acertos'], numeros: ['acertos'], cachear: true },
  Lancamentos: {
    colunas: ['id', 'data', 'competencia', 'tipo', 'valor', 'categoria_id', 'descricao', 'estabelecimento', 'forma_pgto', 'cartao_id', 'parcela', 'usuario_id', 'origem', 'anexo_url', 'status', 'hash_dedup', 'criado_em', 'editado_por', 'excluido', 'projeto_id'],
    numeros: ['valor'], booleanos: ['excluido'], datas: ['data'], cachear: true,
  },
  ContasFixas: {
    colunas: ['id', 'nome', 'categoria_id', 'valor_previsto', 'dia_vencimento', 'remetente_email', 'codigo_cliente', 'ativa'],
    numeros: ['valor_previsto', 'dia_vencimento'], booleanos: ['ativa'], cachear: true,
  },
  ContasAPagar: {
    colunas: ['id', 'conta_fixa_id', 'competencia', 'valor', 'vencimento', 'linha_digitavel', 'pix_copia_cola', 'consumo', 'consumo_valor', 'consumo_unidade', 'anexo_url', 'status', 'pago_em', 'pago_por', 'lancamento_id'],
    numeros: ['valor', 'consumo_valor'], datas: ['vencimento', 'pago_em'], cachear: true,
  },
  Cartoes: {
    colunas: ['id', 'apelido', 'banco', 'final', 'titular_id', 'dia_fechamento', 'dia_vencimento', 'cor', 'ativo'],
    numeros: ['dia_fechamento', 'dia_vencimento'], booleanos: ['ativo'], cachear: true,
  },
  CaixaEntrada: {
    colunas: ['id', 'recebido_em', 'canal', 'texto_bruto', 'valor', 'estabelecimento', 'final_cartao', 'data_compra', 'sugestao_categoria', 'sugestoes', 'usuario_id', 'status', 'lancamento_id', 'hash_dedup'],
    numeros: ['valor'], listas: ['sugestoes'], datas: ['data_compra'], cachear: true,
  },
  Orcamento: { colunas: ['competencia', 'categoria_id', 'valor_planejado'], numeros: ['valor_planejado'], cachear: true },
  Projetos: {
    colunas: ['id', 'nome', 'icone', 'foto_url', 'meta_valor', 'data_alvo', 'valor_inicial', 'prioridade', 'status', 'versiculo', 'criado_por', 'criado_em'],
    numeros: ['meta_valor', 'valor_inicial', 'prioridade'], datas: ['data_alvo'], cachear: true,
  },
  Aportes: { colunas: ['id', 'projeto_id', 'data', 'valor', 'usuario_id', 'observacao'], numeros: ['valor'], datas: ['data'], cachear: true },
  Decisoes: {
    colunas: ['id', 'titulo', 'descricao', 'tipo', 'valor', 'criado_por', 'criado_em', 'prazo', 'status', 'projeto_id'],
    numeros: ['valor'], datas: ['prazo'], cachear: true,
  },
  Votos: { colunas: ['decisao_id', 'usuario_id', 'voto', 'comentario', 'data'], cachear: true },
  Versiculos: { colunas: ['id', 'referencia', 'texto', 'tema'], cachear: true },
  Reunioes: { colunas: ['id', 'competencia', 'data', 'pauta', 'decidido', 'oracao_gratidao', 'criado_por'], datas: ['data'], cachear: true },
  // Alertas personalizados ("Delivery acima de R$ 400/mês → avisar Luiz e Nina"). `avisar` = lista de usuario_id (vazia = todos).
  Alertas: {
    colunas: ['id', 'nome', 'tipo', 'categoria_id', 'grupo_id', 'limite', 'avisar', 'ativo', 'ultimo_disparo'],
    numeros: ['limite'], listas: ['avisar'], booleanos: ['ativo'], cachear: true,
  },
  // Patrimônio manual. `saldos` é JSON: [{"competencia":"2026-10","valor":1234.5}].
  Patrimonio: { colunas: ['id', 'nome', 'tipo', 'instituicao', 'titular_id', 'saldos', 'ativo'], booleanos: ['ativo'], cachear: true },
  // Avisos gerados pelas rotinas (vigia, quinzenal, fechamento). `acao` é JSON {rotulo, rota}.
  Avisos: { colunas: ['id', 'data', 'tipo', 'titulo', 'detalhe', 'gravidade', 'acao', 'lido', 'usuario_id'], booleanos: ['lido'], cachear: true },
  // Histórico do assistente por usuário. `barras` e `lancamento` em JSON.
  Conversas: { colunas: ['id', 'usuario_id', 'papel', 'texto', 'data', 'barras', 'lancamento_id', 'etiqueta'], cachear: true },
  // Vínculo chat do Telegram ↔ usuário (codigo de 6 dígitos até ser usado).
  Telegram: { colunas: ['usuario_id', 'chat_id', 'codigo', 'vinculado_em', 'ativo'], booleanos: ['ativo'], cachear: true },
  Push: { colunas: ['usuario_id', 'assinatura', 'criado_em'], cachear: false },
  Log: { colunas: ['data', 'usuario_id', 'acao', 'detalhe'], cachear: false },
};

/** Ordem em que as abas são criadas na planilha. */
const ORDEM_ABAS = ['Config', 'Usuarios', 'Tipos', 'Grupos', 'Categorias', 'RegrasLoja', 'Lancamentos', 'ContasFixas', 'ContasAPagar', 'Cartoes', 'CaixaEntrada', 'Orcamento', 'Projetos', 'Aportes', 'Decisoes', 'Votos', 'Alertas', 'Patrimonio', 'Avisos', 'Conversas', 'Telegram', 'Versiculos', 'Reunioes', 'Push', 'Log'];

/** Cache em memória válido só durante esta execução. */
const _memoria = { planilha: null, abas: {}, dados: {} };

// ---------- Propriedades do script ----------

/** Lê uma Script Property (ou o padrão). */
function propriedade(nome, padrao) {
  const v = PropertiesService.getScriptProperties().getProperty(nome);
  return v === null || v === undefined || v === '' ? (padrao === undefined ? '' : padrao) : v;
}

/** Grava uma Script Property. */
function definirPropriedade(nome, valor) {
  PropertiesService.getScriptProperties().setProperty(nome, String(valor));
}

// ---------- Planilha e abas ----------

/** Abre a planilha do banco (id em Script Properties: ID_PLANILHA). */
function obterPlanilha() {
  if (_memoria.planilha) return _memoria.planilha;
  const id = propriedade('ID_PLANILHA');
  if (!id) throw new Error('Planilha não configurada. Rode instalar() no editor do Apps Script.');
  _memoria.planilha = SpreadsheetApp.openById(id);
  return _memoria.planilha;
}

/** Devolve a aba; se não existir, cria com o cabeçalho do esquema (útil em atualizações). */
function obterAba(nome) {
  if (_memoria.abas[nome]) return _memoria.abas[nome];
  const esquema = ESQUEMA[nome];
  if (!esquema) throw new Error('Aba desconhecida: ' + nome);
  const planilha = obterPlanilha();
  let aba = planilha.getSheetByName(nome);
  if (!aba) aba = criarAba(planilha, nome);
  _memoria.abas[nome] = aba;
  return aba;
}

/** Cria a aba com cabeçalho, linha 1 congelada e colunas de texto em formato "texto simples". */
function criarAba(planilha, nome) {
  const esquema = ESQUEMA[nome];
  const aba = planilha.insertSheet(nome);
  aba.getRange(1, 1, 1, esquema.colunas.length).setValues([esquema.colunas]).setFontWeight('bold');
  aba.setFrozenRows(1);
  // Colunas de texto em formato "@" para a planilha não converter "2026-10-17" em data nem "0123" em 123.
  const formatos = esquema.colunas.map((c) => (ehNumero(esquema, c) ? '0.00' : '@'));
  aba.getRange(2, 1, Math.max(aba.getMaxRows() - 1, 1), esquema.colunas.length).setNumberFormats(
    Array.from({ length: Math.max(aba.getMaxRows() - 1, 1) }, () => formatos)
  );
  return aba;
}

/** Garante que a aba tem todas as colunas do esquema (acrescenta as que faltam no fim). */
function garantirColunas(nome) {
  const aba = obterAba(nome);
  const esquema = ESQUEMA[nome];
  const ultima = aba.getLastColumn();
  const cabecalho = ultima ? aba.getRange(1, 1, 1, ultima).getValues()[0].map(String) : [];
  const faltando = esquema.colunas.filter((c) => cabecalho.indexOf(c) < 0);
  if (!faltando.length) return;
  aba.getRange(1, cabecalho.length + 1, 1, faltando.length).setValues([faltando]).setFontWeight('bold');
  invalidarCache(nome);
}

function ehNumero(esquema, coluna) { return (esquema.numeros || []).indexOf(coluna) >= 0; }
function ehBooleano(esquema, coluna) { return (esquema.booleanos || []).indexOf(coluna) >= 0; }
function ehLista(esquema, coluna) { return (esquema.listas || []).indexOf(coluna) >= 0; }
function ehSoData(esquema, coluna) { return (esquema.datas || []).indexOf(coluna) >= 0; }

// ---------- Conversão de tipos ----------

/** Célula da planilha → valor JS conforme a coluna. */
function celulaParaValor(esquema, coluna, v) {
  if (ehNumero(esquema, coluna)) return typeof v === 'number' ? v : lerValor(v);
  if (ehBooleano(esquema, coluna)) return paraBooleano(v);
  if (ehLista(esquema, coluna)) return String(v || '').split(';').map((s) => s.trim()).filter(Boolean);
  if (ehData(v)) return ehSoData(esquema, coluna) ? dataParaIso(v) : dataHoraParaIso(v);
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Valor JS → célula da planilha. */
function valorParaCelula(esquema, coluna, v) {
  if (v === undefined || v === null) return '';
  if (ehNumero(esquema, coluna)) return typeof v === 'number' ? v : lerValor(v);
  if (ehBooleano(esquema, coluna)) return paraBooleano(v) ? 'S' : 'N';
  if (ehLista(esquema, coluna)) return Array.isArray(v) ? v.join(';') : String(v);
  if (ehData(v)) return ehSoData(esquema, coluna) ? dataParaIso(v) : dataHoraParaIso(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Linha (array) → objeto, usando o cabeçalho real da aba. */
function linhaParaObjeto(esquema, cabecalho, linha) {
  const o = {};
  cabecalho.forEach((coluna, i) => {
    if (!coluna) return;
    o[coluna] = celulaParaValor(esquema, coluna, linha[i]);
  });
  return o;
}

/** Objeto → linha (array) na ordem do cabeçalho real da aba. */
function objetoParaLinha(esquema, cabecalho, obj) {
  return cabecalho.map((coluna) => valorParaCelula(esquema, coluna, obj[coluna]));
}

// ---------- Cache (memória + CacheService em pedaços) ----------

const TAMANHO_PEDACO_CACHE = 45000; // CacheService aceita até 100 KB (em bytes) por chave; acentos ocupam 2 bytes
const SEGUNDOS_CACHE = 600;

function chaveCache(nome) { return 'aba_' + nome + '_' + propriedade('ID_PLANILHA').slice(0, 8); }

/** Guarda um texto grande no CacheService, dividido em pedaços. */
function cacheGravar(chave, texto) {
  try {
    const cache = CacheService.getScriptCache();
    const pedacos = {};
    let n = 0;
    for (let i = 0; i < texto.length; i += TAMANHO_PEDACO_CACHE) { pedacos[chave + '_' + n] = texto.slice(i, i + TAMANHO_PEDACO_CACHE); n++; }
    pedacos[chave] = String(n);
    cache.putAll(pedacos, SEGUNDOS_CACHE);
  } catch (e) { /* cache é só otimização */ }
}

/** Lê um texto grande do CacheService (ou null). */
function cacheLer(chave) {
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get(chave));
    if (!n) return null;
    const chaves = [];
    for (let i = 0; i < n; i++) chaves.push(chave + '_' + i);
    const partes = cache.getAll(chaves);
    let texto = '';
    for (let i = 0; i < n; i++) {
      if (partes[chave + '_' + i] === undefined || partes[chave + '_' + i] === null) return null;
      texto += partes[chave + '_' + i];
    }
    return texto;
  } catch (e) { return null; }
}

/** Apaga o cache de uma aba (memória e CacheService). Chamado em toda escrita. */
function invalidarCache(nome) {
  delete _memoria.dados[nome];
  try {
    const cache = CacheService.getScriptCache();
    const chave = chaveCache(nome);
    const n = Number(cache.get(chave)) || 0;
    const chaves = [chave];
    for (let i = 0; i < n; i++) chaves.push(chave + '_' + i);
    cache.removeAll(chaves);
  } catch (e) { /* ignora */ }
}

// ---------- Leitura ----------

/**
 * Lê a aba inteira como array de objetos. Cada objeto recebe a propriedade não enumerável
 * `_linha` (número da linha na planilha) para permitir atualizações.
 */
function lerAba(nome) {
  if (_memoria.dados[nome]) return _memoria.dados[nome];
  const esquema = ESQUEMA[nome];
  if (!esquema) throw new Error('Aba desconhecida: ' + nome);
  let registros = null;
  if (esquema.cachear) {
    const texto = cacheLer(chaveCache(nome));
    if (texto) {
      try {
        const pacote = JSON.parse(texto);
        registros = pacote.dados.map((o, i) => marcarLinha(o, pacote.linhas[i]));
      } catch (e) { registros = null; }
    }
  }
  if (!registros) {
    registros = lerAbaDaPlanilha(nome);
    if (esquema.cachear) cacheGravar(chaveCache(nome), JSON.stringify({ dados: registros, linhas: registros.map((r) => r._linha) }));
  }
  _memoria.dados[nome] = registros;
  return registros;
}

/** Leitura direta da planilha (sem cache). */
function lerAbaDaPlanilha(nome) {
  const aba = obterAba(nome);
  const esquema = ESQUEMA[nome];
  const valores = aba.getDataRange().getValues();
  if (valores.length < 2) return [];
  const cabecalho = valores[0].map(String);
  const registros = [];
  for (let i = 1; i < valores.length; i++) {
    const linha = valores[i];
    if (linha.every((c) => c === '' || c === null)) continue; // pula linhas vazias
    registros.push(marcarLinha(linhaParaObjeto(esquema, cabecalho, linha), i + 1));
  }
  return registros;
}

function marcarLinha(obj, numero) {
  Object.defineProperty(obj, '_linha', { value: numero, enumerable: false, writable: true });
  return obj;
}

/** Cabeçalho real da aba (array de nomes). */
function cabecalhoDa(nome) {
  const aba = obterAba(nome);
  const ultima = aba.getLastColumn();
  if (!ultima) return ESQUEMA[nome].colunas.slice();
  return aba.getRange(1, 1, 1, ultima).getValues()[0].map(String);
}

/** Busca um registro por id (ou por outra coluna). */
function buscarPorId(nome, id, coluna) {
  const chave = coluna || 'id';
  return lerAba(nome).find((r) => r[chave] === id) || null;
}

// ---------- Escrita ----------

/** Executa fn com trava de script (evita duas escritas simultâneas). */
function comLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Formatos de número para um bloco de linhas (texto "@" nas colunas de texto). */
function formatosPara(esquema, cabecalho, qtdLinhas) {
  const linha = cabecalho.map((c) => (ehNumero(esquema, c) ? '0.00' : '@'));
  const m = [];
  for (let i = 0; i < qtdLinhas; i++) m.push(linha);
  return m;
}

/** Insere um ou vários objetos no fim da aba. Devolve os objetos gravados. */
function inserirLinhas(nome, objetos) {
  const lista = Array.isArray(objetos) ? objetos : [objetos];
  if (!lista.length) return [];
  const esquema = ESQUEMA[nome];
  return comLock(() => {
    garantirColunas(nome);
    const aba = obterAba(nome);
    const cabecalho = cabecalhoDa(nome);
    const linhas = lista.map((o) => objetoParaLinha(esquema, cabecalho, o));
    const inicio = aba.getLastRow() + 1;
    const faixa = aba.getRange(inicio, 1, linhas.length, cabecalho.length);
    faixa.setNumberFormats(formatosPara(esquema, cabecalho, linhas.length));
    faixa.setValues(linhas);
    invalidarCache(nome);
    return lista.map((o, i) => marcarLinha(o, inicio + i));
  });
}

/**
 * Atualiza a linha cujo `coluna` (padrão "id") é igual a `id`, mesclando `mudancas`.
 * Devolve o objeto completo atualizado ou null se não existir.
 */
function atualizarPorId(nome, id, mudancas, coluna) {
  const chave = coluna || 'id';
  const esquema = ESQUEMA[nome];
  return comLock(() => {
    garantirColunas(nome);
    let atual = buscarPorId(nome, id, chave);
    if (!atual) { invalidarCache(nome); atual = buscarPorId(nome, id, chave); }
    if (!atual) return null;
    const aba = obterAba(nome);
    const cabecalho = cabecalhoDa(nome);
    const idxChave = cabecalho.indexOf(chave) + 1;
    // Confere se a linha ainda é a esperada (outra execução pode ter reescrito a aba).
    let linha = atual._linha;
    if (String(aba.getRange(linha, idxChave).getValue()) !== String(id)) {
      invalidarCache(nome);
      atual = buscarPorId(nome, id, chave);
      if (!atual) return null;
      linha = atual._linha;
    }
    const novo = Object.assign({}, atual, semUndefined(mudancas));
    const faixa = aba.getRange(linha, 1, 1, cabecalho.length);
    faixa.setNumberFormats(formatosPara(esquema, cabecalho, 1));
    faixa.setValues([objetoParaLinha(esquema, cabecalho, novo)]);
    invalidarCache(nome);
    return marcarLinha(novo, linha);
  });
}

/** Insere se não existir id, senão atualiza. Devolve o objeto gravado. */
function salvarPorId(nome, objeto, coluna) {
  const chave = coluna || 'id';
  if (objeto[chave] && buscarPorId(nome, objeto[chave], chave)) return atualizarPorId(nome, objeto[chave], objeto, chave);
  return inserirLinhas(nome, [objeto])[0];
}

/** Reescreve a aba inteira com `objetos` (usado para remover linhas: Orçamento, Votos, limpeza). */
function substituirAba(nome, objetos) {
  const esquema = ESQUEMA[nome];
  return comLock(() => {
    garantirColunas(nome);
    const aba = obterAba(nome);
    const cabecalho = cabecalhoDa(nome);
    const ultima = aba.getLastRow();
    if (ultima > 1) aba.getRange(2, 1, ultima - 1, Math.max(aba.getLastColumn(), cabecalho.length)).clearContent();
    if (objetos.length) {
      const linhas = objetos.map((o) => objetoParaLinha(esquema, cabecalho, o));
      const faixa = aba.getRange(2, 1, linhas.length, cabecalho.length);
      faixa.setNumberFormats(formatosPara(esquema, cabecalho, linhas.length));
      faixa.setValues(linhas);
    }
    invalidarCache(nome);
    return objetos;
  });
}

/** Remove as linhas em que `filtro(obj)` é verdadeiro. Devolve quantas saíram. */
function removerLinhas(nome, filtro) {
  const todos = lerAba(nome);
  const restantes = todos.filter((r) => !filtro(r));
  if (restantes.length === todos.length) return 0;
  substituirAba(nome, restantes);
  return todos.length - restantes.length;
}

// ---------- Config (aba chave/valor) ----------

/** Campos numéricos e booleanos da Config (os demais são texto). */
const CONFIG_NUMEROS = ['dia_fechamento_mes', 'divisao_dar', 'divisao_poupar', 'divisao_viver', 'valor_gasto_grande'];
const CONFIG_BOOLEANOS = ['fe_ativa', 'dependente_ve_salarios', 'junior_ve_salarios', 'rotina_vigia', 'rotina_quinzenal', 'rotina_fechamento', 'telegram_ativo'];

/** Valores padrão da Config (gravados em instalar()). */
function configPadrao(sobrenome) {
  return {
    nome_familia: 'Família ' + sobrenome,
    sobrenome: sobrenome,
    url_brasao: '',
    url_foto_capa: '',
    versiculo_lema: '"Eu e a minha casa serviremos ao Senhor." — Josué 24:15',
    moeda: 'BRL',
    dia_fechamento_mes: 1,
    lembrete_horario: '20:00',
    fe_ativa: true,
    divisao_dar: 10,
    divisao_poupar: 15,
    divisao_viver: 75,
    valor_gasto_grande: 1000,
    regra_votacao: 'maioria_mais_pais',
    dependente_ve_salarios: false,
    rotina_vigia: true,
    rotina_quinzenal: true,
    rotina_fechamento: true,
    telegram_ativo: false,
    url_planilha: '',
    url_pasta_drive: '',
  };
}

/** Lê a Config como objeto tipado (inclui token_familia — NÃO devolver ao app sem filtrar). */
function lerConfigCompleta() {
  const cfg = {};
  lerAba('Config').forEach((r) => {
    const chave = String(r.chave || '');
    if (!chave) return;
    let v = r.valor;
    if (CONFIG_NUMEROS.indexOf(chave) >= 0) v = lerValor(v);
    else if (CONFIG_BOOLEANOS.indexOf(chave) >= 0) v = paraBooleano(v);
    else v = v === null || v === undefined ? '' : String(v);
    cfg[chave] = v;
  });
  // Planilha v1: a chave antiga junior_ve_salarios vale como dependente_ve_salarios.
  if (cfg.dependente_ve_salarios === undefined && cfg.junior_ve_salarios !== undefined) cfg.dependente_ve_salarios = cfg.junior_ve_salarios;
  delete cfg.junior_ve_salarios;
  return cfg;
}

/** Config pública (sem token_familia nem chaves internas). */
function lerConfig() {
  const cfg = lerConfigCompleta();
  delete cfg.token_familia;
  return cfg;
}

/** Grava/atualiza várias chaves da Config de uma vez. */
function salvarConfigChaves(obj) {
  const esquema = ESQUEMA.Config;
  comLock(() => {
    garantirColunas('Config');
    const aba = obterAba('Config');
    const atuais = lerAba('Config');
    const cabecalho = cabecalhoDa('Config');
    const novas = [];
    Object.keys(obj).forEach((chave) => {
      let v = obj[chave];
      if (CONFIG_BOOLEANOS.indexOf(chave) >= 0) v = paraBooleano(v) ? 'S' : 'N';
      else if (v === null || v === undefined) v = '';
      else v = String(v);
      const existente = atuais.find((r) => r.chave === chave);
      if (existente) aba.getRange(existente._linha, 1, 1, cabecalho.length).setNumberFormat('@').setValues([objetoParaLinha(esquema, cabecalho, { chave, valor: v })]);
      else novas.push({ chave, valor: v });
    });
    if (novas.length) {
      const inicio = aba.getLastRow() + 1;
      const faixa = aba.getRange(inicio, 1, novas.length, cabecalho.length);
      faixa.setNumberFormat('@');
      faixa.setValues(novas.map((n) => objetoParaLinha(esquema, cabecalho, n)));
    }
    invalidarCache('Config');
  });
  return lerConfig();
}

// ---------- Log ----------

/** Registra uma ação na aba Log (sem lock: só anexa uma linha). */
function registrarLog(usuarioId, acao, detalhe) {
  try {
    const aba = obterAba('Log');
    aba.appendRow([agoraIso(), usuarioId || '', acao || '', String(detalhe || '').slice(0, 500)]);
  } catch (e) { /* log nunca derruba a ação */ }
}

// ==============================================================================
// assistente.gs
// ==============================================================================

/**
 * assistente.gs — Assistente financeiro da família (tela Assistente e bot do Telegram).
 *
 * Como funciona:
 *  1. montarResumoAgregado(): o servidor resume os dados da planilha (totais por categoria/grupo/mês
 *     dos últimos 12 meses, médias de 3 meses, contas a vencer, projetos com ritmo, assinaturas
 *     detectadas e os apelidos dos membros). Nada mais pessoal vai para a IA.
 *  2. Com CHAVE_API_CLAUDE: conversa com o Claude (Messages API) usando *tool use*. As ferramentas
 *     buscar_lancamentos, total_por_categoria, projetar_meta, lancar_despesa e proximas_saidas são
 *     executadas aqui, na planilha, e o resultado volta ao modelo até a resposta final (máx. 6 voltas).
 *     O modelo responde curto, em português, com valores "R$ 1.234,56" e, quando compara coisas,
 *     termina com uma linha JSON {"barras":[...]} que o servidor extrai para a mini-barra do app.
 *  3. Sem chave: responderLocal() resolve as perguntas mais comuns por regras (gasto por categoria,
 *     assinaturas, contas da semana, fechamento do mês, onde economizar, projetos) e lança por texto.
 *     É o mesmo comportamento do modo demonstração (app/src/api/mock.ts).
 *  4. Cada conversa fica na aba Conversas, por usuário.
 */

const MAX_VOLTAS_FERRAMENTAS = 6;
const MAX_MENSAGENS_HISTORICO = 10;
const MAX_CONVERSA_POR_USUARIO = 200;

// ---------- Resumo agregado (o que a IA recebe) ----------

/** Resumo agregado dos dados (função pura). */
function montarResumoAgregado(d, visao, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const catMap = indexarPorId(d.categorias);
  const grpMap = indexarPorId(d.grupos);
  const ls = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado');
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const c = somarMeses(comp, -i);
    const r = calcularResumoMes(d, visao, c);
    const porCategoria = {};
    Object.keys(r.por_categoria).forEach((id) => { if (r.por_categoria[id].realizado) porCategoria[id] = r.por_categoria[id].realizado; });
    meses.push({ competencia: c, entrou: r.entrou, saiu: r.saiu, sobrou: r.sobrou, por_tipo: r.por_tipo, por_categoria: porCategoria });
  }
  const despesas = ls.filter((l) => l.tipo === 'despesa' && ehDespesaReal(catMap[l.categoria_id]));
  const medias3m = {};
  d.categorias.filter((c) => c.tipo === 'despesa').forEach((c) => {
    const m = mediaCategoria3m(despesas, c.id, comp);
    if (m) medias3m[c.id] = arredondar(m);
  });
  return {
    hoje: h,
    competencia_atual: comp,
    membros: d.usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, apelido: u.apelido, perfil: normalizarPerfil(u.perfil) })),
    tipos: d.tipos.map((t) => ({ id: t.id, nome: t.nome })),
    categorias: d.categorias.filter((c) => c.ativa && (!c.sensivel || !visao || visao.ver_sensivel !== false)).map((c) => ({ id: c.id, nome: c.nome, tipo_id: c.tipo_id, grupo: grpMap[c.grupo_id] ? grpMap[c.grupo_id].nome : '', orcamento_mensal: c.orcamento_mensal || 0 })),
    meses,
    medias_3m_por_categoria: medias3m,
    proximas_saidas_30d: calcularProximasSaidas(d, 30, h).map((s) => ({ data: s.data, titulo: s.titulo, valor: s.valor, status: s.status })),
    projetos: d.projetos.filter((p) => p.status !== 'concluído').map((p) => { const pc = comProjetoCalculado(d, p, h); return { id: p.id, nome: p.nome, meta: p.meta_valor, guardado: pc.valor_atual, data_alvo: p.data_alvo, necessario_mes: pc.necessario_mes, media_3m: pc.media_3m, situacao: pc.situacao, status: p.status }; }),
    assinaturas: detectarAssinaturas(d, h).map((a) => ({ nome: a.estabelecimento, valor: a.valor, desde: a.desde, nova: a.nova })),
    decisoes_abertas: d.decisoes.filter((x) => x.status === 'aberta').map((x) => ({ titulo: x.titulo, prazo: x.prazo })),
  };
}

// ---------- Ferramentas (tool use) ----------

/** Definições das ferramentas no formato da Messages API. */
function ferramentasAssistente() {
  return [
    { name: 'buscar_lancamentos', description: 'Lista lançamentos da família com filtros. Use para detalhar gastos (ex.: as compras de delivery do mês).',
      input_schema: { type: 'object', properties: { competencia: { type: 'string', description: 'AAAA-MM' }, categoria_id: { type: 'string' }, grupo_id: { type: 'string' }, tipo_id: { type: 'string' }, usuario_id: { type: 'string' }, texto: { type: 'string', description: 'trecho do estabelecimento ou descrição' }, limite: { type: 'integer' } } } },
    { name: 'total_por_categoria', description: 'Total gasto numa categoria ou grupo numa competência, com a média dos 3 meses anteriores.',
      input_schema: { type: 'object', properties: { competencia: { type: 'string', description: 'AAAA-MM' }, categoria_id: { type: 'string' }, grupo_id: { type: 'string' } }, required: ['competencia'] } },
    { name: 'projetar_meta', description: 'Projeta um projeto (meta de poupança): quanto falta, quanto guardar por mês e quando fecha no ritmo atual; aceita um corte mensal extra (ex.: reduzir delivery em R$ 130).',
      input_schema: { type: 'object', properties: { projeto_id: { type: 'string' }, corte_mensal: { type: 'number', description: 'valor extra por mês direcionado ao projeto' } }, required: ['projeto_id'] } },
    { name: 'lancar_despesa', description: 'Registra um lançamento (despesa ou receita) na planilha. Só use quando a pessoa pediu claramente para lançar/registrar algo.',
      input_schema: { type: 'object', properties: { valor: { type: 'number' }, categoria_id: { type: 'string' }, descricao: { type: 'string' }, estabelecimento: { type: 'string' }, forma_pgto: { type: 'string', enum: ['dinheiro', 'pix', 'débito', 'crédito', 'boleto'] }, data: { type: 'string', description: 'AAAA-MM-DD (padrão hoje)' } }, required: ['valor', 'categoria_id'] } },
    { name: 'proximas_saidas', description: 'Contas, parcelas, assinaturas e faturas previstas para os próximos 30, 60 ou 90 dias.',
      input_schema: { type: 'object', properties: { dias: { type: 'integer', enum: [30, 60, 90] } } } },
  ];
}

/** Executa uma ferramenta na planilha. Devolve um objeto serializável (ou { erro }). */
function executarFerramentaAssistente(nome, entrada, ctx, estado) {
  const e = entrada || {};
  const d = carregarDados();
  const visao = visaoDe(ctx);
  if (nome === 'buscar_lancamentos') {
    let ls = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado');
    if (ctx.ehDependente) ls = ls.filter((l) => l.usuario_id === ctx.uid);
    const cats = d.categorias;
    if (e.competencia) ls = ls.filter((l) => l.competencia === e.competencia);
    if (e.categoria_id) ls = ls.filter((l) => l.categoria_id === e.categoria_id);
    if (e.grupo_id) { const ids = cats.filter((c) => c.grupo_id === e.grupo_id).map((c) => c.id); ls = ls.filter((l) => ids.indexOf(l.categoria_id) >= 0); }
    if (e.tipo_id) { const ids = cats.filter((c) => c.tipo_id === e.tipo_id).map((c) => c.id); ls = ls.filter((l) => ids.indexOf(l.categoria_id) >= 0); }
    if (e.usuario_id) ls = ls.filter((l) => l.usuario_id === e.usuario_id);
    if (e.texto) { const t = normalizar(e.texto); ls = ls.filter((l) => normalizar(l.estabelecimento + ' ' + l.descricao).indexOf(t) >= 0); }
    const limite = Math.min(Number(e.limite) || 30, 100);
    const userMap = indexarPorId(d.usuarios);
    return { total: arredondar(somar(ls, (l) => l.valor)), quantidade: ls.length, lancamentos: ls.sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, limite).map((l) => ({ data: l.data, valor: l.valor, categoria_id: l.categoria_id, descricao: l.descricao, estabelecimento: l.estabelecimento, forma_pgto: l.forma_pgto, quem: userMap[l.usuario_id] ? userMap[l.usuario_id].apelido : '' })) };
  }
  if (nome === 'total_por_categoria') {
    const comp = e.competencia || competenciaDe();
    const despesas = despesasConfirmadas(Object.assign({}, d, { lancamentos: lancamentosVisiveis(d, visao) }));
    const ids = e.categoria_id ? [e.categoria_id] : d.categorias.filter((c) => c.grupo_id === e.grupo_id).map((c) => c.id);
    const total = somar(ids, (id) => totalCategoriaNoMes(despesas, id, comp));
    const med = somar(ids, (id) => mediaCategoria3m(despesas, id, comp));
    const porMes = [0, 1, 2, 3].map((k) => { const c = somarMeses(comp, -k); return { competencia: c, total: arredondar(somar(ids, (id) => totalCategoriaNoMes(despesas, id, c))) }; });
    return { competencia: comp, total: arredondar(total), media_3m: arredondar(med), variacao_pct: med ? Math.round((total / med - 1) * 100) : null, por_mes: porMes, quantidade: despesas.filter((l) => l.competencia === comp && ids.indexOf(l.categoria_id) >= 0).length };
  }
  if (nome === 'projetar_meta') {
    const pr = d.projetos.find((x) => x.id === e.projeto_id) || d.projetos.find((x) => normalizar(x.nome).indexOf(normalizar(e.projeto_id)) >= 0);
    if (!pr) return { erro: 'Projeto não encontrado. Projetos: ' + d.projetos.map((x) => x.id + ' (' + x.nome + ')').join(', ') };
    return projetarMeta(d, pr, Number(e.corte_mensal) || 0);
  }
  if (nome === 'lancar_despesa') {
    const cat = d.categorias.find((c) => c.id === e.categoria_id);
    if (!cat) return { erro: 'categoria_id inválido' };
    const l = acaoSalvarLancamento({ lancamento: { valor: e.valor, categoria_id: e.categoria_id, descricao: e.descricao || cat.nome, estabelecimento: e.estabelecimento || '', forma_pgto: e.forma_pgto || 'pix', data: e.data || hojeIso(), origem: estado && estado.origem ? estado.origem : 'chat' } }, ctx)[0];
    if (estado) estado.lancamento = l;
    return { ok: true, lancamento: { id: l.id, valor: l.valor, categoria: cat.nome, data: l.data, forma_pgto: l.forma_pgto } };
  }
  if (nome === 'proximas_saidas') {
    return { saidas: calcularProximasSaidas(d, [30, 60, 90].indexOf(Number(e.dias)) >= 0 ? Number(e.dias) : 30).map((s) => ({ data: s.data, titulo: s.titulo, valor: s.valor, status: s.status })) };
  }
  return { erro: 'Ferramenta desconhecida: ' + nome };
}

/** Projeção de um projeto (função pura): falta, necessário/mês, meses no ritmo atual, com corte extra. */
function projetarMeta(d, projeto, corteMensal, hoje) {
  const pc = comProjetoCalculado(d, projeto, hoje);
  const falta = Math.max(0, projeto.meta_valor - pc.valor_atual);
  const ritmo = pc.media_3m + (Number(corteMensal) || 0);
  const comp = (hoje || hojeIso()).slice(0, 7);
  const mesesNoRitmo = ritmo > 0 ? Math.ceil(falta / ritmo) : null;
  const alvo = String(projeto.data_alvo || '').slice(0, 7);
  const pa = alvo.split('-').map(Number), ph = comp.split('-').map(Number);
  const mesesAlvo = pa[0] && pa[1] ? Math.max(1, (pa[0] - ph[0]) * 12 + (pa[1] - ph[1])) : null;
  return {
    projeto: projeto.nome, meta: projeto.meta_valor, guardado: pc.valor_atual, falta: arredondar(falta), necessario_mes: pc.necessario_mes, media_3m: pc.media_3m,
    corte_mensal: Number(corteMensal) || 0, ritmo_considerado: arredondar(ritmo), meses_no_ritmo: mesesNoRitmo,
    fecha_em: mesesNoRitmo ? somarMeses(comp, mesesNoRitmo) : null, data_alvo: projeto.data_alvo, meses_ate_alvo: mesesAlvo,
    percentual_no_alvo: mesesAlvo ? Math.min(100, Math.round(((pc.valor_atual + ritmo * mesesAlvo) / (projeto.meta_valor || 1)) * 100)) : null,
    no_prazo: mesesNoRitmo !== null && mesesAlvo !== null ? mesesNoRitmo <= mesesAlvo : false, situacao: pc.situacao,
  };
}

// ---------- Conversa com o Claude ----------

/** System prompt em português. */
function sistemaAssistente(resumo, usuario) {
  return 'Você é o assistente financeiro da ' + (resumo.nome_familia || 'família') + ', dentro do app "Finanças da Família" (controle financeiro doméstico, base cristã de mordomia: Deus é o dono, nós administramos). ' +
    'Fala com ' + (usuario ? usuario.apelido : 'um membro da família') + '. Responda SEMPRE em português do Brasil, de forma curta e direta (no máximo 4 frases), com números no formato R$ 1.234,56 e datas dd/mm/aaaa. ' +
    'Use os dados do resumo abaixo e, quando precisar de detalhe, as ferramentas (buscar_lancamentos, total_por_categoria, projetar_meta, proximas_saidas). ' +
    'Só use lancar_despesa quando a pessoa pedir claramente para lançar/registrar um gasto ou receita; depois confirme o que foi lançado. ' +
    'Quando houver comparação entre valores (mês × média, categorias, receitas × despesas), termine a resposta com UMA linha separada contendo só JSON no formato ' +
    '{"barras":[{"rotulo":"Outubro","valor":812.4,"cor":"magenta"},{"rotulo":"Média 3 meses","valor":620,"cor":"indigo"}]} (no máximo 5 barras; cores possíveis: indigo, magenta, gold, orange, green, red, lilac, rose, slate). ' +
    'Nunca invente números: se não souber, diga que não encontrou. Nunca mencione tokens, chaves ou dados de cartão. Tom sério e respeitoso, sem emojis, sem culpa.\n\n' +
    'RESUMO DOS DADOS (JSON):\n' + JSON.stringify(resumo);
}

/** Converte o histórico do app em mensagens da API (só texto, últimas N). */
function historicoParaMensagens(historico) {
  const lista = Array.isArray(historico) ? historico.slice(-MAX_MENSAGENS_HISTORICO) : [];
  const msgs = [];
  lista.forEach((m) => {
    if (!m || !m.texto) return;
    const papel = m.papel === 'eu' ? 'user' : 'assistant';
    // A API exige alternância; funde mensagens seguidas do mesmo papel.
    if (msgs.length && msgs[msgs.length - 1].role === papel) msgs[msgs.length - 1].content += '\n' + String(m.texto);
    else msgs.push({ role: papel, content: String(m.texto) });
  });
  if (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

/**
 * Extrai a linha final {"barras":[...]} do texto (função pura).
 * Devolve { texto (sem a linha), barras (array ou undefined) }.
 */
function extrairBarras(texto) {
  const linhas = String(texto || '').trim().split('\n');
  for (let i = linhas.length - 1; i >= 0 && i >= linhas.length - 3; i--) {
    const ln = linhas[i].trim().replace(/^```json|^```|```$/g, '').trim();
    if (!/^\{\s*"barras"\s*:/.test(ln)) continue;
    try {
      const j = JSON.parse(ln);
      if (!Array.isArray(j.barras)) continue;
      const barras = j.barras.filter((b) => b && b.rotulo !== undefined && !isNaN(Number(b.valor))).slice(0, 5)
        .map((b) => semUndefined({ rotulo: String(b.rotulo).slice(0, 24), valor: arredondar(b.valor), cor: ['indigo', 'sel', 'magenta', 'gold', 'orange', 'green', 'red', 'lilac', 'rose', 'slate'].indexOf(b.cor) >= 0 ? b.cor : undefined }));
      linhas.splice(i, 1);
      return { texto: linhas.join('\n').replace(/```json\s*```/g, '').trim(), barras: barras.length ? barras : undefined };
    } catch (e) { /* não era JSON válido: segue */ }
  }
  return { texto: String(texto || '').trim(), barras: undefined };
}

/**
 * Conversa com o Claude usando tool use. Devolve { texto, barras, lancamento }.
 * `imagem` opcional: { base64, mime } (foto anexada à conversa).
 */
function conversarComClaude(ctx, mensagem, historico, imagem, origem) {
  const d = carregarDados();
  const resumo = montarResumoAgregado(d, visaoDe(ctx));
  resumo.nome_familia = d.config.nome_familia;
  const conteudo = [];
  if (imagem && imagem.base64) conteudo.push(blocoArquivo(imagem.base64, imagem.mime || 'image/jpeg'));
  conteudo.push({ type: 'text', text: mensagem || (imagem ? 'Leia este cupom e me diga o que lançar.' : '') });
  const mensagens = historicoParaMensagens(historico).concat([{ role: 'user', content: conteudo }]);
  const estado = { lancamento: null, origem: origem || 'chat' };
  const corpo = { model: propriedade('MODELO_CLAUDE', MODELO_CLAUDE_PADRAO), max_tokens: 1024, system: sistemaAssistente(resumo, ctx.usuario), tools: ferramentasAssistente(), messages: mensagens };
  let textoFinal = '';
  for (let volta = 0; volta < MAX_VOLTAS_FERRAMENTAS; volta++) {
    const json = requisicaoClaude(corpo);
    const blocos = json.content || [];
    textoFinal = blocos.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (json.stop_reason !== 'tool_use') break;
    corpo.messages.push({ role: 'assistant', content: blocos });
    const resultados = blocos.filter((b) => b.type === 'tool_use').map((b) => {
      let r;
      try { r = executarFerramentaAssistente(b.name, b.input, ctx, estado); } catch (e) { r = { erro: e.message }; }
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(r).slice(0, 20000) };
    });
    corpo.messages.push({ role: 'user', content: resultados });
  }
  const r = extrairBarras(textoFinal);
  return { texto: r.texto || 'Não consegui montar uma resposta agora. Tente perguntar de outro jeito.', barras: r.barras, lancamento: estado.lancamento };
}

// ---------- Respostas por regras locais (sem chave) ----------

/**
 * Categoria citada num texto já normalizado (função pura): compara nome e palavras-chave com
 * fronteira de palavra ("GAS" não casa com "GASTAMOS") e prefere o termo mais longo.
 */
function encontrarCategoriaNoTexto(textoNormalizado, categorias) {
  const t = ' ' + String(textoNormalizado || '') + ' ';
  let melhor = null, tamanho = 0;
  (categorias || []).forEach((c) => {
    const termos = [normalizar(c.nome)].concat(String(c.palavras_chave || '').split(';').map((p) => normalizar(p))).filter((x) => x.length >= 3);
    termos.forEach((termo) => {
      if (termo.length > tamanho && t.indexOf(' ' + termo + ' ') >= 0) { melhor = c; tamanho = termo.length; }
    });
  });
  return melhor;
}

/**
 * Responde às perguntas mais comuns sem IA (função pura, igual ao mock).
 * Devolve { texto, barras?, lancamento? (objeto a gravar), etiqueta? }.
 */
function responderLocal(d, visao, uid, texto, hoje) {
  const h = hoje || hojeIso();
  const t = normalizar(texto);
  const comp = h.slice(0, 7);
  const mesNome = nomeMes(comp);
  const catMap = indexarPorId(d.categorias);
  const ls = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado');
  const despesas = ls.filter((l) => l.tipo === 'despesa' && ehDespesaReal(catMap[l.categoria_id]));
  const total = (cid, c) => totalCategoriaNoMes(despesas, cid, c);
  const media3 = (cid) => mediaCategoria3m(despesas, cid, comp);
  const categoriasVisiveisLocal = d.categorias.filter((c) => c.ativa && !c.oculta_cardapio && (!c.sensivel || !visao || visao.ver_sensivel !== false));

  // 1. Lançamento por texto.
  if (/^(GASTEI|PAGUEI|COMPREI|LANCA|LANCE|LANCAR|REGISTRA|REGISTRE|RECEBI|GANHEI)\b/.test(t) || /\bREAIS?\b|R\$/.test(t)) {
    const e = extrairDeTexto(texto, categoriasVisiveisLocal);
    const regra = e.estabelecimento ? regraDaLoja(e.estabelecimento, d.regras_loja) : null;
    if (regra) e.categoria_id = regra.categoria_id;
    if (e.valor && e.categoria_id && catMap[e.categoria_id]) {
      const c = catMap[e.categoria_id];
      const g = d.grupos.find((x) => x.id === c.grupo_id);
      const tp = d.tipos.find((x) => x.id === c.tipo_id);
      const data = e.data || h;
      const lanc = { data, competencia: competenciaDe(data), tipo: c.tipo, valor: e.valor, categoria_id: c.id, descricao: e.descricao || c.nome, estabelecimento: e.estabelecimento || '', forma_pgto: e.forma_pgto || 'pix', usuario_id: uid, origem: 'chat', status: 'confirmado' };
      const quem = (d.usuarios.find((u) => u.id === uid) || {}).apelido || '';
      const forma = lanc.forma_pgto.charAt(0).toUpperCase() + lanc.forma_pgto.slice(1);
      return { texto: 'Lancei **' + moeda(lanc.valor) + ' · ' + c.nome + '** (' + (tp ? tp.nome : '') + ' › ' + (g ? g.nome : '') + '), ' + (data === h ? 'hoje' : dataBr(data)) + ', ' + forma + (quem ? ', por ' + quem : '') + '.', lancamento: lanc, etiqueta: 'lançado' };
    }
    return { texto: 'Não entendi o valor. Tente assim: “gastei 45 na padaria no pix”.' };
  }
  // 2. Gasto por categoria no mês.
  const cat = encontrarCategoriaNoTexto(t, d.categorias.filter((c) => c.tipo === 'despesa' && ehDespesaReal(c)));
  if (cat && /QUANTO|GAST|TOTAL/.test(t)) {
    const atual = total(cat.id, comp);
    const med = media3(cat.id);
    const doMes = despesas.filter((l) => l.categoria_id === cat.id && l.competencia === comp);
    const maior = doMes.slice().sort((a, b) => b.valor - a.valor)[0];
    const variacao = med ? Math.round((atual / med - 1) * 100) : 0;
    return {
      texto: 'Em ' + mesNome + ' foram **' + moeda(atual) + '** em ' + doMes.length + ' lançamento' + (doMes.length === 1 ? '' : 's') + ' de ' + cat.nome + ' — ' + (variacao >= 0 ? variacao + '% acima' : (-variacao) + '% abaixo') + ' da média dos últimos 3 meses (' + moeda(med) + ').' + (maior ? ' O maior foi ' + moeda(maior.valor) + ' no dia ' + maior.data.slice(8, 10) + '.' : ''),
      barras: [{ rotulo: MESES_PT[Number(comp.slice(5)) - 1], valor: arredondar(atual), cor: cat.cor }, { rotulo: 'Média 3 meses', valor: Math.round(med), cor: 'indigo' }],
    };
  }
  // 3. Assinaturas.
  if (/ASSINATURA/.test(t)) {
    const itens = ls.filter((l) => l.competencia === comp && CATEGORIAS_ASSINATURA.indexOf(l.categoria_id) >= 0);
    const soma = somar(itens, (l) => l.valor);
    if (!itens.length) return { texto: 'Não encontrei assinaturas lançadas em ' + mesNome + ' (categorias Streaming, Aplicativos e Seguros diversos).' };
    return { texto: 'Temos ' + itens.length + ' assinatura' + (itens.length > 1 ? 's' : '') + ' este mês, somando **' + moeda(soma) + '**: ' + itens.map((l) => l.descricao + ' (' + moeda(l.valor) + ')').join(', ') + '.', barras: itens.slice(0, 5).map((l) => ({ rotulo: String(l.descricao).slice(0, 14), valor: arredondar(l.valor), cor: 'rose' })) };
  }
  // 4. Contas da semana.
  if (/VENCE|SEMANA|CONTAS/.test(t)) {
    const s = calcularProximasSaidas(d, 7, h);
    if (!s.length) return { texto: 'Nenhuma conta vence nos próximos 7 dias.' };
    return { texto: 'Vencem nos próximos 7 dias: ' + s.map((x) => x.titulo + ' (' + moeda(x.valor) + ', dia ' + x.data.slice(8, 10) + ')').join('; ') + '. Total **' + moeda(somar(s, (x) => x.valor)) + '**.' };
  }
  // 5. Fechamento do mês.
  if (/FECHAMOS|FECHOU|COMO FOI|SALDO/.test(t)) {
    let idx = -1;
    MESES_PT.forEach((m, i) => { if (t.indexOf(normalizar(m)) >= 0) idx = i; });
    const c = idx >= 0 ? comp.slice(0, 4) + '-' + zeros(idx + 1) : somarMeses(comp, -1);
    const r = calcularResumoMes(d, visao, c);
    return {
      texto: nomeCompetencia(c) + ': entrou **' + moeda(r.entrou) + '**, saiu **' + moeda(r.saiu) + '** e ' + (r.sobrou >= 0 ? 'sobrou **' + moeda(r.sobrou) + '**' : 'faltou **' + moeda(-r.sobrou) + '**') + '. Despesas fixas ' + moeda(r.por_tipo[TIPO_FIXAS] ? r.por_tipo[TIPO_FIXAS].realizado : 0) + ' e variáveis ' + moeda(r.por_tipo[TIPO_VARIAVEIS] ? r.por_tipo[TIPO_VARIAVEIS].realizado : 0) + '.',
      barras: [{ rotulo: 'Receitas', valor: r.entrou, cor: 'green' }, { rotulo: 'Despesas', valor: r.saiu, cor: 'magenta' }],
    };
  }
  // 6. Onde economizar.
  if (/ECONOMIZAR|CORTAR|REDUZIR/.test(t)) {
    const variaveis = d.categorias.filter((c) => c.tipo_id === TIPO_VARIAVEIS && ehDespesaReal(c)).map((c) => ({ c, atual: total(c.id, comp), media: media3(c.id) })).filter((x) => x.media > MINIMO_MEDIA_PARA_AVISO).sort((a, b) => (b.atual - b.media) - (a.atual - a.media)).slice(0, 3);
    if (!variaveis.length) return { texto: 'Ainda não há histórico suficiente para comparar os gastos variáveis com a média de 3 meses.' };
    return {
      texto: 'Onde mais subimos em relação à média: ' + variaveis.map((x) => '**' + x.c.nome + '** (' + moeda(x.atual) + ' contra ' + moeda(x.media) + ')').join(', ') + '. Voltar esses três à média liberaria cerca de **' + moeda(somar(variaveis, (x) => Math.max(0, x.atual - x.media))) + '** por mês.',
      barras: variaveis.map((x) => ({ rotulo: x.c.nome.slice(0, 14), valor: Math.round(x.atual), cor: x.c.cor })),
    };
  }
  // 7. Projetos.
  const proj = d.projetos.find((p) => t.indexOf(normalizar(p.nome)) >= 0 || (/VIAGEM/.test(t) && /VIAGEM/.test(normalizar(p.nome))) || (/CARRO/.test(t) && /CARRO/.test(normalizar(p.nome))) || (/RESERVA/.test(t) && /RESERVA/.test(normalizar(p.nome))));
  if (proj && /FECHAR|CONSEGU|DA PARA|RITMO|FALTA|PROJETO|META/.test(t)) {
    const pm = projetarMeta(d, proj, 0, h);
    const delivery = Math.max(0, total('c_delivery', comp) - media3('c_delivery'));
    return { texto: 'No ritmo atual (' + moeda(pm.media_3m) + '/mês) o projeto **' + proj.nome + '** chega a ' + (pm.percentual_no_alvo === null ? '?' : pm.percentual_no_alvo) + '% da meta em ' + nomeCompetencia(String(proj.data_alvo).slice(0, 7), true) + '. Faltam ' + moeda(pm.falta) + '; precisa de ' + moeda(pm.necessario_mes) + ' por mês.' + (delivery > 20 ? ' Reduzindo delivery para a média (−' + moeda(delivery) + '/mês) e direcionando a sobra do mês, a meta fecha ' + (pm.no_prazo ? 'no prazo' : 'mais perto do prazo') + '.' : '') };
  }
  return { texto: 'Posso responder sobre gastos por categoria (“quanto gastamos com delivery este mês?”), assinaturas, contas da semana, fechamento do mês, onde economizar e os projetos. Também lanço despesas: “gastei 120 no posto”. Com a chave do Claude configurada, a conversa fica livre.' };
}

// ---------- Ação principal ----------

/** Monta a MensagemAssistente de resposta. */
function mensagemAssistente(texto, extra) {
  return semUndefined(Object.assign({ id: gerarId('m'), papel: 'assistente', texto, data: agoraIso() }, extra || {}));
}

/**
 * Núcleo do assistente (usado pela API e pelo Telegram). Devolve a MensagemAssistente de resposta e
 * grava as duas mensagens na aba Conversas.
 * @param ctx contexto do usuário; @param mensagem texto; @param historico MensagemAssistente[]; @param imagem {base64, mime}|null
 */
function responderAssistente(ctx, mensagem, historico, imagem, origem) {
  const texto = String(mensagem || '').trim();
  if (!texto && !(imagem && imagem.base64)) throw new ErroUsuario('Escreva uma pergunta ou anexe uma foto.');
  let resposta;
  if (claudeDisponivel()) {
    try {
      const r = conversarComClaude(ctx, texto, historico, imagem, origem);
      resposta = mensagemAssistente(r.texto, { barras: r.barras, lancamento: r.lancamento ? lancamentoPublico(r.lancamento) : undefined, etiqueta: r.lancamento ? 'lançado' : undefined });
    } catch (e) {
      console.warn('Assistente: Claude falhou, usando regras locais: ' + e.message);
      resposta = null;
    }
  }
  if (!resposta && imagem && imagem.base64) resposta = responderFotoLocal(ctx, imagem, origem);
  if (!resposta) {
    const d = carregarDados();
    const r = responderLocal(d, visaoDe(ctx), ctx.uid, texto);
    let lanc;
    if (r.lancamento) {
      lanc = acaoSalvarLancamento({ lancamento: Object.assign({}, r.lancamento, { origem: origem || 'chat' }) }, ctx)[0];
    }
    resposta = mensagemAssistente(r.texto, { barras: r.barras, lancamento: lanc, etiqueta: lanc ? 'lançado' : undefined });
  }
  gravarConversa(ctx.uid, [{ id: gerarId('m'), papel: 'eu', texto: texto || '(foto)', data: agoraIso() }, resposta]);
  return resposta;
}

/** Sem IA: lê a foto do cupom (leitura.gs) e lança o que conseguir extrair. */
function responderFotoLocal(ctx, imagem, origem) {
  const mime = imagem.mime || 'image/jpeg';
  const blob = Utilities.newBlob(Utilities.base64Decode(imagem.base64), mime, nomeArquivoLeitura('cupom', mime, ''));
  const salvo = salvarArquivoLeitura(blob, 'cupom', blob.getName());
  const leitura = lerDocumento(imagem.base64, mime, 'cupom', blob, ctx);
  if (!(leitura.valor > 0) || !leitura.categoria_id) return mensagemAssistente('Não consegui ler o valor do cupom. Tente outra foto, com mais luz, ou digite: “gastei 45 na padaria”.');
  const l = acaoSalvarLancamento({ lancamento: { valor: leitura.valor, data: leitura.data || hojeIso(), categoria_id: leitura.categoria_id, descricao: leitura.descricao || leitura.estabelecimento || '', estabelecimento: leitura.estabelecimento || '', forma_pgto: leitura.forma_pgto || 'débito', anexo_url: salvo.url, origem: origem || 'foto' } }, ctx)[0];
  const cat = buscarPorId('Categorias', l.categoria_id);
  return mensagemAssistente('Lancei **' + moeda(l.valor) + ' · ' + (cat ? cat.nome : '') + '** de ' + (l.estabelecimento || 'cupom') + ', ' + dataBr(l.data) + '. Se a categoria estiver errada, corrija na lista de lançamentos.', { lancamento: l, etiqueta: 'lançado' });
}

/** assistente: resposta à mensagem (texto e/ou foto) do usuário. */
function acaoAssistente(p, ctx) {
  const imagem = p.imagem_base64 ? { base64: String(p.imagem_base64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, ''), mime: String(p.mime || 'image/jpeg').toLowerCase() } : null;
  return responderAssistente(ctx, p.mensagem, p.historico, imagem, 'chat');
}

// ---------- Histórico (aba Conversas) ----------

/** Grava as mensagens do usuário na aba Conversas e mantém só as últimas MAX_CONVERSA_POR_USUARIO. */
function gravarConversa(uid, mensagens) {
  try {
    inserirLinhas('Conversas', mensagens.map((m) => ({
      id: m.id, usuario_id: uid, papel: m.papel, texto: String(m.texto || '').slice(0, 4000), data: m.data,
      barras: m.barras ? JSON.stringify(m.barras) : '', lancamento_id: m.lancamento ? m.lancamento.id : '', etiqueta: m.etiqueta || '',
    })));
    const minhas = lerAba('Conversas').filter((c) => c.usuario_id === uid);
    if (minhas.length > MAX_CONVERSA_POR_USUARIO + 50) {
      const apagar = {};
      minhas.sort((a, b) => (a.data < b.data ? -1 : 1)).slice(0, minhas.length - MAX_CONVERSA_POR_USUARIO).forEach((c) => { apagar[c.id] = true; });
      removerLinhas('Conversas', (c) => apagar[c.id]);
    }
  } catch (e) { console.warn('Não gravei a conversa: ' + e.message); }
}

/** Linha da aba → MensagemAssistente. */
function conversaPublica(c, lancMap) {
  let barras;
  try { barras = c.barras ? JSON.parse(c.barras) : undefined; } catch (e) { barras = undefined; }
  return semUndefined({ id: c.id, papel: c.papel, texto: c.texto, data: c.data, barras, lancamento: c.lancamento_id && lancMap && lancMap[c.lancamento_id] ? lancamentoPublico(lancMap[c.lancamento_id]) : undefined, etiqueta: c.etiqueta || undefined });
}

/** listar_conversa: histórico do próprio usuário (mais antigas primeiro). */
function acaoListarConversa(p, ctx) {
  const limite = Math.min(Number(p.limite) || 40, MAX_CONVERSA_POR_USUARIO);
  const minhas = lerAba('Conversas').filter((c) => c.usuario_id === ctx.uid).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)).slice(-limite);
  const lancMap = indexarPorId(lerAba('Lancamentos'));
  return minhas.map((c) => conversaPublica(c, lancMap));
}

// ---------- Sugestões de pergunta ----------

/** Chips de perguntas para o momento (função pura). */
function sugestoesAssistente(d, visao, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const despesas = despesasConfirmadas(d);
  const sugestoes = [];
  // Categoria variável que mais subiu em relação à média.
  const subiu = d.categorias.filter((c) => c.tipo_id === TIPO_VARIAVEIS && ehDespesaReal(c)).map((c) => ({ c, dif: totalCategoriaNoMes(despesas, c.id, comp) - mediaCategoria3m(despesas, c.id, comp), media: mediaCategoria3m(despesas, c.id, comp) })).filter((x) => x.media > MINIMO_MEDIA_PARA_AVISO && x.dif > 0).sort((a, b) => b.dif - a.dif)[0];
  sugestoes.push('Quanto gastamos com ' + (subiu ? subiu.c.nome.toLowerCase() : 'delivery') + ' este mês?');
  sugestoes.push('Onde podemos economizar?');
  if (d.lancamentos.some((l) => CATEGORIAS_ASSINATURA.indexOf(l.categoria_id) >= 0)) sugestoes.push('Quais assinaturas temos?');
  sugestoes.push('Como fechamos ' + nomeMes(somarMeses(comp, -1)) + '?');
  if (calcularProximasSaidas(d, 7, h).length) sugestoes.push('Contas que vencem esta semana');
  const proj = d.projetos.filter((p) => p.status === 'ativo').sort((a, b) => a.prioridade - b.prioridade)[0];
  if (proj) sugestoes.push('Dá para fechar ' + (/^(a |o )/i.test(proj.nome) ? proj.nome.toLowerCase() : 'o projeto ' + proj.nome) + '?');
  return sugestoes.slice(0, 6);
}

function acaoAssistenteSugestoes(p, ctx) {
  return sugestoesAssistente(carregarDados(), visaoDe(ctx));
}

// ==============================================================================
// auth.gs
// ==============================================================================

/**
 * auth.gs — Convites, PIN e tokens dos usuários.
 *
 *  - Convite: código de 6 caracteres válido por 7 dias, guardado em Script Properties
 *    (chave "convite_<CÓDIGO>"), de uso único.
 *  - PIN: nunca em texto puro. Guardamos SHA-256(sal + ":" + pin) em hexadecimal, com um sal
 *    por usuário (Utilities.computeDigest). A comparação é em tempo constante.
 *  - Token: texto aleatório por usuário; o app guarda no celular. Pode ser renovado
 *    (o antigo deixa de valer na hora).
 */

const DIAS_VALIDADE_CONVITE = 7;
/** Perfis da versão 2 ("Júnior", da v1, é aceito como sinônimo de Dependente — ver normalizarPerfil). */
const PERFIS_VALIDOS = ['Administrador', 'Adulto', 'Dependente'];
const MAX_TENTATIVAS_PIN = 5;
const MINUTOS_BLOQUEIO_PIN = 10;

// ---------- PIN ----------

/** Valida o formato do PIN: 4 a 6 dígitos. */
function validarFormatoPin(pin) {
  if (!/^\d{4,6}$/.test(String(pin || ''))) throw new ErroUsuario('O PIN deve ter de 4 a 6 números.');
  return String(pin);
}

/** SHA-256 em hexadecimal de (sal + ":" + pin). */
function hashPin(pin, sal) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + ':' + pin, Utilities.Charset.UTF_8);
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Comparação em tempo constante (não vaza em quantos caracteres acertou). */
function compararConstante(a, b) {
  const x = String(a || ''), y = String(b || '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/** Gera sal + hash para um PIN novo. */
function prepararPin(pin) {
  const sal = gerarToken(16);
  return { pin_sal: sal, pin_hash: hashPin(validarFormatoPin(pin), sal) };
}

// ---------- Usuários ----------

/** Versão do usuário que pode ir para o app (sem hash/sal; token só quando permitido). */
function usuarioPublico(u, incluirToken) {
  if (!u) return null;
  const pub = {
    id: u.id, nome: u.nome, apelido: u.apelido, avatar: u.avatar, cor: u.cor, perfil: normalizarPerfil(u.perfil),
    ativo: !!u.ativo, criado_em: u.criado_em, ultimo_acesso: u.ultimo_acesso,
    mesada_mensal: Number(u.mesada_mensal) || 0,
  };
  if (incluirToken) pub.token = u.token;
  return pub;
}

/** Busca o usuário pelo token de sessão. */
function usuarioPorToken(token) {
  if (!token) return null;
  return lerAba('Usuarios').find((u) => u.token && compararConstante(u.token, token)) || null;
}

/** Garante que o usuário tem token (gera se estiver vazio). */
function garantirToken(usuario) {
  if (usuario.token) return usuario;
  return atualizarPorId('Usuarios', usuario.id, { token: gerarToken(32) });
}

// ---------- Convites ----------

function chaveConvite(codigo) { return 'convite_' + String(codigo || '').toUpperCase().trim(); }

/** Lê um convite das Script Properties (ou null). */
function lerConvite(codigo) {
  const texto = propriedade(chaveConvite(codigo), '');
  if (!texto) return null;
  try { return JSON.parse(texto); } catch (e) { return null; }
}

/** Remove convites vencidos ou usados (faxina). */
function limparConvitesVencidos() {
  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  const agora = Date.now();
  Object.keys(todas).forEach((k) => {
    if (k.indexOf('convite_') !== 0) return;
    try {
      const c = JSON.parse(todas[k]);
      if (c.usado_por || new Date(c.expira_em).getTime() < agora) props.deleteProperty(k);
    } catch (e) { props.deleteProperty(k); }
  });
}

/**
 * gerar_convite (Administrador): cria o código e a URL que a pessoa abre no celular.
 * A URL inclui a API e o token da família para o app se configurar sozinho.
 */
function acaoGerarConvite(p, ctx) {
  const perfil = PERFIS_VALIDOS.indexOf(normalizarPerfil(p.perfil)) >= 0 ? normalizarPerfil(p.perfil) : 'Adulto';
  const convite = criarConvite(perfil, ctx.uid, p.usuario_id_convidado || '');
  const cfg = lerConfigCompleta();
  const url = montarLinkConvite(convite.codigo, perfil, urlDoAppWeb(), cfg.token_familia || '');
  return { codigo_convite: convite.codigo, url, expira_em: convite.expira_em };
}

/** Cria e grava um convite (código de 6 caracteres, validade DIAS_VALIDADE_CONVITE). usuarioId liga o convite a um usuário já existente. */
function criarConvite(perfil, criadoPor, usuarioId) {
  limparConvitesVencidos();
  const codigo = gerarCodigoConvite();
  const expira = new Date(Date.now() + DIAS_VALIDADE_CONVITE * 86400000);
  const convite = { codigo, perfil, expira_em: expira.toISOString(), criado_por: criadoPor || '', usuario_id: usuarioId || '' };
  definirPropriedade(chaveConvite(codigo), JSON.stringify(convite));
  return convite;
}

/** Link que o convidado abre no celular: app publicado + convite + URL da API + token da família. */
function montarLinkConvite(codigo, perfil, urlApi, tokenFamilia) {
  return obterUrlApp() + '#/entrar?convite=' + codigo + '&perfil=' + encodeURIComponent(perfil) +
    '&api=' + encodeURIComponent(urlApi || '') + '&familia=' + encodeURIComponent(tokenFamilia || '');
}

/** URL pública deste App da Web (vazia se ainda não foi implantado). */
function urlDoAppWeb() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

/**
 * entrar_convite (sem autenticação): cria o usuário (ou ativa um pré-cadastrado), define o PIN
 * e devolve o usuário com token. O convite é de uso único.
 */
function acaoEntrarConvite(p) {
  const codigo = String(p.codigo_convite || '').toUpperCase().trim();
  const convite = lerConvite(codigo);
  if (!convite || convite.usado_por || new Date(convite.expira_em).getTime() < Date.now()) {
    throw new ErroUsuario('Convite inválido ou vencido. Peça um novo ao administrador.');
  }
  const apelido = String(p.apelido || p.nome || '').trim();
  if (!apelido) throw new ErroUsuario('Diga como quer ser chamado (apelido).');
  const pin = prepararPin(p.pin);
  const agora = agoraIso();
  let usuario;
  const existente = convite.usuario_id ? buscarPorId('Usuarios', convite.usuario_id) : null;
  if (existente) {
    usuario = atualizarPorId('Usuarios', existente.id, Object.assign({
      apelido, nome: String(p.nome || existente.nome || apelido).trim(), avatar: p.avatar || existente.avatar || '', cor: p.cor || existente.cor || 'indigo',
      ativo: true, ultimo_acesso: agora, token: gerarToken(32),
    }, pin));
  } else {
    usuario = inserirLinhas('Usuarios', [Object.assign({
      id: gerarId('u'), nome: String(p.nome || apelido).trim(), apelido, avatar: p.avatar || '', cor: p.cor || 'indigo',
      // O perfil vem do convite (definido pelo administrador); o enviado pelo app só vale se o convite não tiver.
      perfil: normalizarPerfil(convite.perfil || p.perfil || 'Adulto'), ativo: true, criado_em: agora, ultimo_acesso: agora, mesada_mensal: 0,
      token: gerarToken(32), origem: 'convite',
    }, pin)])[0];
  }
  convite.usado_por = usuario.id;
  definirPropriedade(chaveConvite(codigo), JSON.stringify(convite));
  registrarLog(usuario.id, 'entrar_convite', 'Entrou com convite ' + codigo + ' como ' + convite.perfil);
  return usuarioPublico(usuario, true);
}

// ---------- Entrada por PIN ----------

function chaveFalhasPin(uid) { return 'pin_falhas_' + uid; }

/** entrar_pin (sem autenticação): confere o PIN e devolve o usuário com token. */
function acaoEntrarPin(p) {
  const usuario = buscarPorId('Usuarios', String(p.usuario_id || ''));
  if (!usuario) throw new ErroUsuario('Usuário não encontrado');
  if (!usuario.ativo) throw new ErroUsuario('Este usuário está desativado. Fale com o administrador.');
  if (!usuario.pin_hash) throw new ErroUsuario('PIN ainda não definido. Peça ao administrador para redefinir.');

  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get(chaveFalhasPin(usuario.id)) || 0);
  if (falhas >= MAX_TENTATIVAS_PIN) throw new ErroUsuario('Muitas tentativas. Aguarde ' + MINUTOS_BLOQUEIO_PIN + ' minutos e tente de novo.');

  const informado = hashPin(String(p.pin || ''), usuario.pin_sal || '');
  if (!compararConstante(informado, usuario.pin_hash)) {
    cache.put(chaveFalhasPin(usuario.id), String(falhas + 1), MINUTOS_BLOQUEIO_PIN * 60);
    throw new ErroUsuario('PIN incorreto');
  }
  cache.remove(chaveFalhasPin(usuario.id));
  const comToken = garantirToken(usuario);
  atualizarPorId('Usuarios', usuario.id, { ultimo_acesso: agoraIso() });
  return usuarioPublico(comToken, true);
}

// ---------- Token e PIN (administração) ----------

/** renovar_token: o próprio usuário ou um Administrador para qualquer um. */
function acaoRenovarToken(p, ctx) {
  const alvo = String(p.usuario_id || ctx.uid);
  if (alvo !== ctx.uid && !ctx.ehAdmin) throw new ErroUsuario('Sem permissão');
  const u = buscarPorId('Usuarios', alvo);
  if (!u) throw new ErroUsuario('Usuário não encontrado');
  const novo = atualizarPorId('Usuarios', alvo, { token: gerarToken(32) });
  return { token: novo.token };
}

/** redefinir_pin (Administrador). */
function acaoRedefinirPin(p, ctx) {
  const u = buscarPorId('Usuarios', String(p.usuario_id || ''));
  if (!u) throw new ErroUsuario('Usuário não encontrado');
  atualizarPorId('Usuarios', u.id, prepararPin(p.pin));
  try { CacheService.getScriptCache().remove(chaveFalhasPin(u.id)); } catch (e) { /* ignora */ }
  return { ok: true };
}

// ---------- Listar / salvar usuários ----------

/** listar_usuarios (Adulto): tokens só para Administrador. */
function acaoListarUsuarios(p, ctx) {
  return lerAba('Usuarios').map((u) => usuarioPublico(u, ctx.ehAdmin || u.id === ctx.uid));
}

/** salvar_usuario (Administrador): cria ou edita. Pode definir PIN inicial via `usuario.pin`. */
function acaoSalvarUsuario(p, ctx) {
  const u = p.usuario || {};
  if (u.perfil) u.perfil = normalizarPerfil(u.perfil);
  if (u.perfil && PERFIS_VALIDOS.indexOf(u.perfil) < 0) throw new ErroUsuario('Perfil inválido: ' + u.perfil);
  const agora = agoraIso();
  const campos = {
    nome: u.nome, apelido: u.apelido, avatar: u.avatar, cor: u.cor, perfil: u.perfil,
    ativo: u.ativo === undefined ? undefined : paraBooleano(u.ativo),
    mesada_mensal: u.mesada_mensal === undefined ? undefined : lerValor(u.mesada_mensal),
  };
  if (u.pin) Object.assign(campos, prepararPin(u.pin));
  let salvo;
  const existente = u.id ? buscarPorId('Usuarios', u.id) : null;
  if (existente) {
    if (existente.id === ctx.uid && campos.perfil && campos.perfil !== 'Administrador') throw new ErroUsuario('Você não pode rebaixar o seu próprio perfil.');
    salvo = atualizarPorId('Usuarios', existente.id, semUndefined(campos));
  } else {
    salvo = inserirLinhas('Usuarios', [Object.assign({
      id: u.id || gerarId('u'), nome: u.apelido || '', apelido: u.apelido || 'Novo membro', avatar: '', cor: 'indigo',
      perfil: 'Adulto', ativo: true, criado_em: agora, ultimo_acesso: agora, mesada_mensal: 0, token: gerarToken(32), origem: 'manual',
    }, semUndefined(campos))])[0];
  }
  return usuarioPublico(salvo, true);
}

// ==============================================================================
// backup.gs
// ==============================================================================

/**
 * backup.gs — Cópia de segurança da planilha na pasta Backups/.
 *
 *  - backupSemanal() (gatilho semanal): copia a planilha com a data no nome e mantém só as 12 últimas;
 *  - backup_agora (ação, Administrador): mesma coisa, sob demanda.
 */

const MAX_BACKUPS = 12;

/** Prefixo dos arquivos de backup (função, e não const, porque depende de bd.gs). */
function prefixoBackup() { return NOME_PLANILHA + '_backup_'; }

/** Faz a cópia e apaga as mais antigas. Devolve o arquivo da cópia. */
function backupSemanal() {
  const original = DriveApp.getFileById(propriedade('ID_PLANILHA'));
  const pasta = pastaPorCaminho('Backups');
  const nome = prefixoBackup() + agoraIso().replace(/[:T]/g, '-').slice(0, 16);
  const copia = original.makeCopy(nome, pasta);
  limparBackupsAntigos(pasta);
  console.log('Backup criado: ' + copia.getUrl());
  return copia;
}

/** Mantém só os MAX_BACKUPS mais recentes. */
function limparBackupsAntigos(pasta) {
  const lista = [];
  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const f = arquivos.next();
    if (f.getName().indexOf(prefixoBackup()) === 0) lista.push(f);
  }
  lista.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  lista.slice(MAX_BACKUPS).forEach((f) => f.setTrashed(true));
}

/** backup_agora: devolve a URL da cópia (abre para quem tem acesso ao Drive). */
function acaoBackupAgora() {
  const copia = backupSemanal();
  return { url: copia.getUrl() };
}

// ==============================================================================
// contas.gs
// ==============================================================================

/**
 * contas.gs — Contas fixas (cadastro) e contas a pagar (boletos do mês).
 *
 *  - CRUD de ContasFixas e ContasAPagar;
 *  - marcar_conta_paga: cria o lançamento real, marca o previsto como excluído;
 *  - consumo_historico: série de consumo (kWh, m³...) por conta;
 *  - criarContaAPagarDeLeitura: usado por email.gs e pela pasta _Entrada;
 *  - avisarVencimentos (gatilho diário 08h): 3 dias antes e no dia → e-mail aos administradores + push;
 *  - alerta de consumo: conta com valor 20% acima da média dos 3 meses anteriores.
 */

const DIAS_AVISO_VENCIMENTO = 3;
const LIMITE_ALERTA_CONSUMO = 1.2; // +20%

// ---------- Contas fixas ----------

function acaoListarContasFixas() {
  return lerAba('ContasFixas');
}

function acaoSalvarContaFixa(p) {
  const c = p.conta_fixa || {};
  if (!c.nome) throw new ErroUsuario('A conta precisa de um nome (ex.: "Copel (luz)").');
  if (!c.categoria_id || !buscarPorId('Categorias', c.categoria_id)) throw new ErroUsuario('Escolha a categoria da conta.');
  const nova = {
    id: c.id || gerarId('f'), nome: c.nome, categoria_id: c.categoria_id, valor_previsto: lerValor(c.valor_previsto),
    dia_vencimento: Math.min(Math.max(Number(c.dia_vencimento) || 10, 1), 31), remetente_email: c.remetente_email || '',
    codigo_cliente: c.codigo_cliente || '', ativa: c.ativa === undefined ? true : paraBooleano(c.ativa),
  };
  return salvarPorId('ContasFixas', nova);
}

// ---------- Contas a pagar ----------

function contaPublica(c) {
  return Object.assign({}, c, { valor: arredondar(c.valor) });
}

function acaoListarContasAPagar(p) {
  let cs = lerAba('ContasAPagar');
  if (p.competencia) cs = cs.filter((c) => c.competencia === p.competencia);
  if (p.status) cs = cs.filter((c) => c.status === p.status);
  return cs.slice().sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)).map(contaPublica);
}

function acaoSalvarContaAPagar(p) {
  const c = p.conta || {};
  const venc = normalizarDataIso(c.vencimento);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) throw new ErroUsuario('Informe a data de vencimento.');
  const valor = lerValor(c.valor);
  if (!(valor > 0)) throw new ErroUsuario('Informe o valor da conta.');
  const consumoValor = c.consumo_valor === undefined || c.consumo_valor === '' ? undefined : lerValor(c.consumo_valor);
  const nova = semUndefined({
    id: c.id || gerarId('cp'), conta_fixa_id: c.conta_fixa_id || '', competencia: c.competencia || competenciaDe(venc), valor, vencimento: venc,
    linha_digitavel: c.linha_digitavel || '', pix_copia_cola: c.pix_copia_cola || '',
    consumo: c.consumo || (consumoValor ? consumoValor + ' ' + (c.consumo_unidade || '') : ''), consumo_valor: consumoValor, consumo_unidade: c.consumo_unidade || '',
    anexo_url: c.anexo_url || '', status: c.status === 'paga' ? 'paga' : 'aberta', pago_em: c.pago_em, pago_por: c.pago_por, lancamento_id: c.lancamento_id,
  });
  return contaPublica(salvarPorId('ContasAPagar', nova));
}

/**
 * marcar_conta_paga: cria o lançamento (despesa confirmada) e marca o previsto do mês como excluído.
 */
function acaoMarcarContaPaga(p, ctx) {
  const c = buscarPorId('ContasAPagar', String(p.id || ''));
  if (!c) throw new ErroUsuario('Conta não encontrada');
  if (c.status === 'paga') throw new ErroUsuario('Esta conta já está marcada como paga.');
  const cf = c.conta_fixa_id ? buscarPorId('ContasFixas', c.conta_fixa_id) : null;
  const categoriaId = cf ? cf.categoria_id : 'c_imprevistos';
  // Remove (soft delete) o previsto da mesma conta/competência.
  lerAba('Lancamentos').filter((l) => !l.excluido && l.status === 'a_confirmar' && l.competencia === c.competencia && (
    (cf && l.hash_dedup === 'previsto_' + cf.id + '_' + c.competencia) || (!cf && l.categoria_id === categoriaId)
  )).forEach((l) => atualizarPorId('Lancamentos', l.id, { excluido: true, editado_por: ctx.uid }));
  const hoje = hojeIso();
  const l = inserirLinhas('Lancamentos', [{
    id: gerarId('l'), data: hoje, competencia: c.competencia, tipo: 'despesa', valor: c.valor, categoria_id: categoriaId,
    descricao: cf ? cf.nome : 'Conta', estabelecimento: cf ? cf.nome : '', forma_pgto: FORMAS_PGTO.indexOf(p.forma_pgto) >= 0 ? p.forma_pgto : 'boleto',
    cartao_id: '', parcela: '', usuario_id: ctx.uid, origem: 'fatura', anexo_url: c.anexo_url || '', status: 'confirmado',
    hash_dedup: hashDedup(c.valor, hoje, '', cf ? cf.nome : 'conta'), criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: '',
  }])[0];
  const atualizada = atualizarPorId('ContasAPagar', c.id, { status: 'paga', pago_em: hoje, pago_por: ctx.uid, lancamento_id: l.id });
  return contaPublica(atualizada);
}

/** consumo_historico: série ordenada por competência. */
function acaoConsumoHistorico(p) {
  return lerAba('ContasAPagar').filter((c) => c.conta_fixa_id === p.conta_fixa_id).sort((a, b) => (a.competencia < b.competencia ? -1 : 1))
    .map((c) => ({ competencia: c.competencia, consumo_valor: Number(c.consumo_valor) || 0, consumo_unidade: c.consumo_unidade || '', valor: arredondar(c.valor) }));
}

// ---------- Criação automática (e-mail / pasta _Entrada) ----------

/**
 * Cria (ou atualiza) uma ContaAPagar a partir de uma LeituraExtraida de tipo "conta".
 * Não duplica: mesma conta fixa + competência atualiza a existente.
 * Devolve { conta, nova: boolean } ou null quando a leitura não tem valor.
 */
function criarContaAPagarDeLeitura(leitura, anexoUrl) {
  if (!leitura || !(leitura.valor > 0)) return null;
  const venc = leitura.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(leitura.vencimento) ? leitura.vencimento : somarDias(hojeIso(), 5);
  const comp = leitura.competencia && /^\d{4}-\d{2}$/.test(leitura.competencia) ? leitura.competencia : competenciaDe(venc);
  const existente = leitura.conta_fixa_id ? lerAba('ContasAPagar').find((c) => c.conta_fixa_id === leitura.conta_fixa_id && c.competencia === comp) : null;
  const dados = semUndefined({
    conta_fixa_id: leitura.conta_fixa_id || '', competencia: comp, valor: arredondar(leitura.valor), vencimento: venc,
    linha_digitavel: leitura.linha_digitavel || '', pix_copia_cola: leitura.pix_copia_cola || '',
    consumo: leitura.consumo_valor ? leitura.consumo_valor + ' ' + (leitura.consumo_unidade || '') : '',
    consumo_valor: leitura.consumo_valor, consumo_unidade: leitura.consumo_unidade || '', anexo_url: anexoUrl || leitura.anexo_url || '',
  });
  if (existente) {
    if (existente.status === 'paga') return { conta: existente, nova: false };
    return { conta: atualizarPorId('ContasAPagar', existente.id, dados), nova: false };
  }
  const nova = inserirLinhas('ContasAPagar', [Object.assign({ id: gerarId('cp'), status: 'aberta' }, dados)])[0];
  return { conta: nova, nova: true };
}

// ---------- Alerta de consumo ----------

/** Média do valor dos 3 meses anteriores da mesma conta (ou 0). */
function mediaAnterior(conta, todas) {
  const anteriores = todas.filter((c) => c.conta_fixa_id === conta.conta_fixa_id && c.competencia < conta.competencia).sort((a, b) => (a.competencia < b.competencia ? 1 : -1)).slice(0, 3);
  if (!anteriores.length) return 0;
  return anteriores.reduce((s, c) => s + c.valor, 0) / anteriores.length;
}

/** Contas abertas cujo valor passou de +20% da média anterior. */
function contasComConsumoAlto() {
  const todas = lerAba('ContasAPagar');
  const fixas = lerAba('ContasFixas');
  return todas.filter((c) => c.status === 'aberta' && c.conta_fixa_id).map((c) => {
    const media = mediaAnterior(c, todas);
    if (!media || c.valor / media < LIMITE_ALERTA_CONSUMO) return null;
    const cf = fixas.find((f) => f.id === c.conta_fixa_id);
    return { conta: c, nome: cf ? cf.nome : 'Conta', media, aumento: Math.round((c.valor / media - 1) * 100) };
  }).filter(Boolean);
}

// ---------- Aviso de vencimentos (gatilho diário 08h) ----------

/** Envia e-mail de resumo aos administradores + push para as contas que vencem em 3 dias ou hoje. */
function avisarVencimentos() {
  const hoje = hojeIso();
  const limite = somarDias(hoje, DIAS_AVISO_VENCIMENTO);
  const fixas = lerAba('ContasFixas');
  const nomeDe = (c) => { const f = fixas.find((x) => x.id === c.conta_fixa_id); return f ? f.nome : 'Conta'; };
  const abertas = lerAba('ContasAPagar').filter((c) => c.status === 'aberta');
  const hojeVence = abertas.filter((c) => c.vencimento === hoje);
  const emBreve = abertas.filter((c) => c.vencimento === limite);
  const atrasadas = abertas.filter((c) => c.vencimento < hoje);
  const consumoAlto = contasComConsumoAlto();
  if (!hojeVence.length && !emBreve.length && !atrasadas.length && !consumoAlto.length) { console.log('avisarVencimentos: nada a avisar'); return 0; }

  const linha = (c) => '<li><b>' + nomeDe(c) + '</b> — ' + moeda(c.valor) + ' — vence ' + c.vencimento.split('-').reverse().join('/') + (c.linha_digitavel ? '<br><small>Código: ' + c.linha_digitavel + '</small>' : '') + '</li>';
  const partes = [];
  if (hojeVence.length) partes.push('<h3>Vencem hoje</h3><ul>' + hojeVence.map(linha).join('') + '</ul>');
  if (emBreve.length) partes.push('<h3>Vencem em ' + DIAS_AVISO_VENCIMENTO + ' dias</h3><ul>' + emBreve.map(linha).join('') + '</ul>');
  if (atrasadas.length) partes.push('<h3>Em atraso</h3><ul>' + atrasadas.map(linha).join('') + '</ul>');
  if (consumoAlto.length) partes.push('<h3>Contas que subiram mais de 20%</h3><ul>' + consumoAlto.map((a) => '<li><b>' + a.nome + '</b>: ' + moeda(a.conta.valor) + ' (média anterior ' + moeda(a.media) + ', +' + a.aumento + '%)</li>').join('') + '</ul>');

  const total = hojeVence.length + emBreve.length + atrasadas.length;
  const assunto = 'Contas da casa: ' + (hojeVence.length ? hojeVence.length + ' vence(m) hoje' : total + ' aviso(s)');
  enviarEmailAdministradores(assunto, '<p>Resumo das contas da família:</p>' + partes.join(''));
  const resumoPush = [hojeVence.length ? hojeVence.length + ' vence(m) hoje' : '', emBreve.length ? emBreve.length + ' em ' + DIAS_AVISO_VENCIMENTO + ' dias' : '', atrasadas.length ? atrasadas.length + ' atrasada(s)' : ''].filter(Boolean).join(' · ');
  if (resumoPush) enviarPushParaPerfis(['Administrador', 'Adulto'], 'Contas da casa', resumoPush, '#/contas');
  return total;
}

// ==============================================================================
// dados_iniciais.gs
// ==============================================================================

/**
 * dados_iniciais.gs — Dados iniciais gravados por instalar(): tipos, grupos, categorias (cardápio),
 * grupos de análise, paleta de cores e versículos.
 *
 * ARQUIVO GERADO AUTOMATICAMENTE por apps-script/testes/gerar_dados_iniciais.mjs
 * a partir de dados/grupos_categorias.json e dados/versiculos.json. Não edite à mão:
 * altere os JSON e rode o script de novo.
 *
 * Versículos: Almeida Revista e Corrigida (domínio público).
 */

/** Os 4 tipos (cards da tela inicial): Receitas, Despesas fixas, Despesas variáveis, Projetos. Nunca aumentam. */
function dadosIniciaisTipos() {
  return [
  {"id":"t_receitas","nome":"Receitas","icone":"wallet","cor":"green","ordem":1},
  {"id":"t_fixas","nome":"Despesas fixas","icone":"house","cor":"indigo","ordem":2},
  {"id":"t_variaveis","nome":"Despesas variáveis","icone":"shopping-cart","cor":"magenta","ordem":3},
  {"id":"t_projetos","nome":"Projetos","icone":"target","cor":"gold","ordem":4}
  ];
}

/** Grupos do cardápio (cada um dentro de um tipo; cor da paleta; grupo de análise dos gráficos). */
function dadosIniciaisGrupos() {
  return [
  {"id":"g_dizimo","tipo_id":"t_fixas","nome":"Dízimo e ofertas","cor":"green","grupo_analise":"Dízimo e ofertas","ordem":1,"ativo":true},
  {"id":"g_moradia","tipo_id":"t_fixas","nome":"Moradia","cor":"indigo","grupo_analise":"Moradia","ordem":2,"ativo":true},
  {"id":"g_consumo","tipo_id":"t_fixas","nome":"Contas de consumo","cor":"lilac","grupo_analise":"Contas de consumo","ordem":3,"ativo":true},
  {"id":"g_saude_edu","tipo_id":"t_fixas","nome":"Saúde e educação","cor":"gold","grupo_analise":"Saúde e educação","ordem":4,"ativo":true},
  {"id":"g_transporte_fixo","tipo_id":"t_fixas","nome":"Transporte","cor":"orange","grupo_analise":"Transporte","ordem":5,"ativo":true},
  {"id":"g_assinaturas","tipo_id":"t_fixas","nome":"Assinaturas","cor":"rose","grupo_analise":"Lazer","ordem":6,"ativo":true},
  {"id":"g_alimentacao","tipo_id":"t_variaveis","nome":"Alimentação","cor":"magenta","grupo_analise":"Alimentação","ordem":7,"ativo":true},
  {"id":"g_transporte_dia","tipo_id":"t_variaveis","nome":"Transporte do dia a dia","cor":"orange","grupo_analise":"Transporte","ordem":8,"ativo":true},
  {"id":"g_saude_cuidados","tipo_id":"t_variaveis","nome":"Saúde e cuidados","cor":"gold","grupo_analise":"Saúde e educação","ordem":9,"ativo":true},
  {"id":"g_casa","tipo_id":"t_variaveis","nome":"Casa","cor":"indigo","grupo_analise":"Moradia","ordem":10,"ativo":true},
  {"id":"g_lazer","tipo_id":"t_variaveis","nome":"Lazer","cor":"rose","grupo_analise":"Lazer","ordem":11,"ativo":true},
  {"id":"g_outros","tipo_id":"t_variaveis","nome":"Outros","cor":"slate","grupo_analise":"Outros","ordem":12,"ativo":true},
  {"id":"g_entradas","tipo_id":"t_receitas","nome":"Entradas","cor":"green","grupo_analise":"Receitas","ordem":13,"ativo":true},
  {"id":"g_projetos","tipo_id":"t_projetos","nome":"Projetos","cor":"gold","grupo_analise":"Projetos","ordem":14,"ativo":true}
  ];
}

/** Categorias (cardápio) com ícone Lucide, palavras-chave para classificação automática e orçamento. */
function dadosIniciaisCategorias() {
  return [
  {"id":"c_dizimo","tipo_id":"t_fixas","grupo_id":"g_dizimo","nome":"Dízimo","icone":"church","cor":"green","tipo":"despesa","fixa":true,"orcamento_mensal":1530,"palavras_chave":"DIZIMO;IGREJA","grupo_analise":"Dízimo e ofertas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_ofertas","tipo_id":"t_fixas","grupo_id":"g_dizimo","nome":"Ofertas","icone":"hand-heart","cor":"green","tipo":"despesa","fixa":false,"orcamento_mensal":100,"palavras_chave":"OFERTA","grupo_analise":"Dízimo e ofertas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_missoes","tipo_id":"t_fixas","grupo_id":"g_dizimo","nome":"Missões e ajuda","icone":"hand-coins","cor":"green","tipo":"despesa","fixa":false,"orcamento_mensal":80,"palavras_chave":"MISSOES;MISSIONARIO;DOACAO;AJUDA;CARIDADE","grupo_analise":"Dízimo e ofertas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_aluguel","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"Aluguel","icone":"key-round","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":0,"palavras_chave":"ALUGUEL;IMOBILIARIA;LOCACAO","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_prestacao_casa","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"Prestação da casa","icone":"house","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":2450,"palavras_chave":"FINANCIAMENTO IMOB;CAIXA HABITACAO;PRESTACAO;SFH","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_condominio","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"Condomínio","icone":"building-2","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":610,"palavras_chave":"CONDOMINIO","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_iptu","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"IPTU","icone":"landmark","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":140,"palavras_chave":"IPTU;PREFEITURA","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_luz","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Luz","icone":"zap","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":412,"palavras_chave":"COPEL;ENEL;CEMIG;LIGHT;CPFL;ENERGIA;ELETRICA;ELETROPAULO","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_agua","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Água","icone":"droplet","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":168,"palavras_chave":"SANEPAR;SABESP;COPASA;CEDAE;AGUA;SANEAMENTO","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_gas","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Gás","icone":"flame","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":72,"palavras_chave":"COMPAGAS;COMGAS;ULTRAGAZ;LIQUIGAS;GAS","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_internet","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Internet","icone":"wifi","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":139,"palavras_chave":"VIVO FIBRA;CLARO NET;OI FIBRA;INTERNET;BANDA LARGA;TIM LIVE;FIBRA","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_telefone","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Telefone e celular","icone":"smartphone","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":189,"palavras_chave":"VIVO;CLARO;TIM;OI;CELULAR;TELEFONE","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_plano_saude","tipo_id":"t_fixas","grupo_id":"g_saude_edu","nome":"Plano de saúde","icone":"heart-pulse","cor":"gold","tipo":"despesa","fixa":true,"orcamento_mensal":2120,"palavras_chave":"UNIMED;AMIL;BRADESCO SAUDE;SULAMERICA;HAPVIDA;PLANO DE SAUDE","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_escola","tipo_id":"t_fixas","grupo_id":"g_saude_edu","nome":"Escola e faculdade","icone":"graduation-cap","cor":"gold","tipo":"despesa","fixa":true,"orcamento_mensal":1480,"palavras_chave":"ESCOLA;COLEGIO;FACULDADE;UNIVERSIDADE;MENSALIDADE;PUC;UP;UNICURITIBA","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_cursos","tipo_id":"t_fixas","grupo_id":"g_saude_edu","nome":"Cursos e livros","icone":"book-open","cor":"gold","tipo":"despesa","fixa":true,"orcamento_mensal":250,"palavras_chave":"CURSO;LIVRARIA;LIVRO;UDEMY;ALURA;KUMON;INGLES","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_financiamento_carro","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"Financiamento do carro","icone":"car","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":0,"palavras_chave":"FINANCIAMENTO VEICULO;CONSORCIO;BV FINANCEIRA;SANTANDER FINANC","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_seguro_carro","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"Seguro do carro","icone":"shield-check","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":310,"palavras_chave":"PORTO SEGURO;AZUL SEGUROS;SEGURO AUTO;TOKIO MARINE;HDI;ALLIANZ","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_ipva","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"IPVA e licenciamento","icone":"landmark","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":150,"palavras_chave":"IPVA;DETRAN;LICENCIAMENTO","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_vale_transporte","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"Vale-transporte","icone":"bus","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":0,"palavras_chave":"VALE TRANSPORTE;CARTAO TRANSPORTE;URBS","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_streaming","tipo_id":"t_fixas","grupo_id":"g_assinaturas","nome":"Streaming","icone":"tv","cor":"rose","tipo":"despesa","fixa":true,"orcamento_mensal":121,"palavras_chave":"NETFLIX;SPOTIFY;DISNEY;AMAZON PRIME;GLOBOPLAY;HBO;MAX;YOUTUBE PREMIUM;DEEZER;PARAMOUNT","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_apps","tipo_id":"t_fixas","grupo_id":"g_assinaturas","nome":"Aplicativos","icone":"smartphone","cor":"rose","tipo":"despesa","fixa":true,"orcamento_mensal":60,"palavras_chave":"APPLE.COM;GOOGLE PLAY;ICLOUD;GOOGLE ONE;MICROSOFT;ADOBE;CANVA;CHATGPT;CLAUDE.AI","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_seguros","tipo_id":"t_fixas","grupo_id":"g_assinaturas","nome":"Seguros diversos","icone":"shield-check","cor":"rose","tipo":"despesa","fixa":true,"orcamento_mensal":100,"palavras_chave":"SEGURO VIDA;SEGURO RESIDENCIAL;PREVIDENCIA;PRUDENTIAL;METLIFE","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_mercado","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Supermercado","icone":"shopping-cart","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":1620,"palavras_chave":"SUPERMERCADO;MERCADO;CONDOR;MUFFATO;CARREFOUR;ASSAI;ATACADAO;ANGELONI;FESTVAL;BIG;PAO DE ACUCAR;EXTRA;SAMS;TAUSTE","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_feira","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Feira e hortifrúti","icone":"apple","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":100,"palavras_chave":"FEIRA;HORTIFRUTI;SACOLAO;VERDURAS;FRUTAS;HORTI","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_padaria","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Padaria","icone":"croissant","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":214,"palavras_chave":"PADARIA;PANIFICADORA;CONFEITARIA;PAES;PAO","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_acougue","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Açougue","icone":"beef","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":180,"palavras_chave":"ACOUGUE;CARNES;FRIGORIFICO;CASA DE CARNES","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_delivery","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Delivery","icone":"bike","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":352,"palavras_chave":"IFOOD;RAPPI;UBER EATS;LANCHE;PIZZA;HAMBURGUER;MC DONALDS;BURGER;DELIVERY;AIQFOME","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_restaurantes","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Restaurantes","icone":"utensils","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":260,"palavras_chave":"RESTAURANTE;CHURRASCARIA;CAFE;LANCHONETE;BAR;SORVETERIA;OUTBACK;MADERO","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_combustivel","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"Combustível","icone":"fuel","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":820,"palavras_chave":"POSTO;COMBUSTIVEL;GASOLINA;ETANOL;SHELL;IPIRANGA;PETROBRAS;BR MANIA;AUTO POSTO","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_estacionamento","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"Estacionamento e pedágio","icone":"parking-meter","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":140,"palavras_chave":"ESTACIONAMENTO;PEDAGIO;ESTAPAR;SEM PARAR;CONECTCAR;VELOE;ZONA AZUL;ESTAR","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_app_transporte","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"App de transporte","icone":"car","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":120,"palavras_chave":"UBER;99;CABIFY;99POP;INDRIVE;ONIBUS;METRO","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_manutencao_carro","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"Manutenção do carro","icone":"wrench","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":180,"palavras_chave":"OFICINA;MECANICA;PNEU;AUTO CENTER;LAVA CAR;LAVAGEM;TROCA DE OLEO;BORRACHARIA","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_farmacia","tipo_id":"t_variaveis","grupo_id":"g_saude_cuidados","nome":"Farmácia","icone":"pill","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":260,"palavras_chave":"FARMACIA;DROGARIA;DROGASIL;PANVEL;NISSEI;PAGUE MENOS;RAIA;REMEDIO;ULTRAFARMA","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_consultas","tipo_id":"t_variaveis","grupo_id":"g_saude_cuidados","nome":"Consultas e exames","icone":"stethoscope","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":200,"palavras_chave":"CLINICA;LABORATORIO;CONSULTA;EXAME;DENTISTA;ODONTO;HOSPITAL;FISIOTERAPIA;PSICOLOG","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_cabelo","tipo_id":"t_variaveis","grupo_id":"g_saude_cuidados","nome":"Cabelo e estética","icone":"scissors","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"SALAO;BARBEARIA;CABELEIREIRO;MANICURE;ESTETICA;PERFUMARIA;BOTICARIO;NATURA","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_reparos","tipo_id":"t_variaveis","grupo_id":"g_casa","nome":"Reparos e manutenção","icone":"hammer","cor":"indigo","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"LEROY MERLIN;MATERIAL DE CONSTRUCAO;ENCANADOR;ELETRICISTA;CONSERTO;BALAROTI;TELHANORTE;CASSOL;FERRAGENS","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_moveis","tipo_id":"t_variaveis","grupo_id":"g_casa","nome":"Móveis e utensílios","icone":"sofa","cor":"indigo","tipo":"despesa","fixa":false,"orcamento_mensal":100,"palavras_chave":"MOVEIS;TOK STOK;MAGAZINE LUIZA;CASAS BAHIA;HAVAN;UTENSILIOS;ELETRODOMESTICO;AMERICANAS","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_limpeza","tipo_id":"t_variaveis","grupo_id":"g_casa","nome":"Limpeza","icone":"spray-can","cor":"indigo","tipo":"despesa","fixa":false,"orcamento_mensal":80,"palavras_chave":"LIMPEZA;DIARISTA;LAVANDERIA;PRODUTOS DE LIMPEZA","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_passeios","tipo_id":"t_variaveis","grupo_id":"g_lazer","nome":"Passeios e eventos","icone":"ticket","cor":"rose","tipo":"despesa","fixa":false,"orcamento_mensal":310,"palavras_chave":"CINEMA;CINEMARK;TEATRO;PARQUE;INGRESSO;SHOW;PASSEIO;ZOOLOGICO;MUSEU;SYMPLA","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_viagens","tipo_id":"t_variaveis","grupo_id":"g_lazer","nome":"Viagens curtas","icone":"plane","cor":"rose","tipo":"despesa","fixa":false,"orcamento_mensal":280,"palavras_chave":"HOTEL;POUSADA;AIRBNB;BOOKING;PASSAGEM;LATAM;GOL;AZUL;RODOVIARIA","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_hobbies","tipo_id":"t_variaveis","grupo_id":"g_lazer","nome":"Hobbies","icone":"palette","cor":"rose","tipo":"despesa","fixa":false,"orcamento_mensal":209,"palavras_chave":"ACADEMIA;SMARTFIT;ESPORTE;JOGO;HOBBY;STEAM;PLAYSTATION;XBOX;INSTRUMENTO;ARTESANATO","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_roupas","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Vestuário","icone":"shirt","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":190,"palavras_chave":"RENNER;C&A;RIACHUELO;ZARA;HERING;CALCADOS;ROUPA;SHEIN;CENTAURO;MARISA;NIKE;ADIDAS","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_presentes","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Presentes","icone":"gift","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":90,"palavras_chave":"PRESENTE;ANIVERSARIO;FLORICULTURA;FLORES","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_pet","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Pets","icone":"paw-print","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":120,"palavras_chave":"PET;PETZ;COBASI;VETERINARIO;RACAO;PETSHOP","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_imprevistos","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Imprevistos","icone":"triangle-alert","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":70,"palavras_chave":"MULTA;TAXA;JUROS;TARIFA;CARTORIO;DESPACHANTE","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_salario","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Salário","icone":"briefcase","cor":"green","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"SALARIO;PAGAMENTO;FOLHA;PROVENTOS;INSS;APOSENTADORIA","grupo_analise":"Receitas","sensivel":true,"oculta_cardapio":false,"ativa":true},
  {"id":"c_renda_extra","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Renda extra","icone":"banknote","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"FREELA;BICO;EXTRA;COMISSAO;CONSULTORIA;13","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_aluguel_recebido","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Aluguel recebido","icone":"house","cor":"green","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"ALUGUEL RECEBIDO;LOCACAO","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_rendimentos","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Rendimentos","icone":"piggy-bank","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"RENDIMENTO;JUROS RECEBIDOS;DIVIDENDO;CDB;TESOURO","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_reembolsos","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Reembolsos","icone":"circle-dollar-sign","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"REEMBOLSO;RESTITUICAO;ESTORNO","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_mesada_recebida","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Mesada","icone":"hand-coins","cor":"green","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"MESADA","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_outras_receitas","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Outras entradas","icone":"wallet","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"PRESENTE RECEBIDO;VENDA;OUTRA","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_aporte_projeto","tipo_id":"t_projetos","grupo_id":"g_projetos","nome":"Aporte em projeto","icone":"target","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":0,"palavras_chave":"POUPANCA;APORTE;RESERVA;APLICACAO","grupo_analise":"Projetos","sensivel":false,"oculta_cardapio":true,"ativa":true}
  ];
}

/** Agrupamento fixo usado nos gráficos (nome → cor da paleta). */
function dadosIniciaisGruposAnalise() {
  return [
  {"nome":"Moradia","cor":"indigo"},
  {"nome":"Contas de consumo","cor":"lilac"},
  {"nome":"Saúde e educação","cor":"gold"},
  {"nome":"Transporte","cor":"orange"},
  {"nome":"Alimentação","cor":"magenta"},
  {"nome":"Lazer","cor":"rose"},
  {"nome":"Dízimo e ofertas","cor":"green"},
  {"nome":"Outros","cor":"slate"}
  ];
}

/** Paleta de cores do padrão visual (nome → hexadecimal). */
function dadosIniciaisCores() {
  return {"side":"#0D0E23","panel":"#141519","card":"#1E1F26","card2":"#24252E","line":"#2C2E3A","text":"#ECECF2","muted":"#8E90A2","faint":"#5E6072","indigo":"#5B5BE0","sel":"#7776E6","magenta":"#BD55C7","gold":"#F2C552","orange":"#E0852F","green":"#4CB963","red":"#E5535B","lilac":"#9A99F0","rose":"#E58FD9","slate":"#6B6E80"};
}

/** Versículos sobre mordomia, generosidade, planejamento, família etc. */
function dadosIniciaisVersiculos() {
  return [
  {"id":"v01","referencia":"Josué 24:15","tema":"família","texto":"Porém, se vos parece mal aos vossos olhos servir ao Senhor, escolhei hoje a quem sirvais; porém eu e a minha casa serviremos ao Senhor."},
  {"id":"v02","referencia":"Provérbios 3:9-10","tema":"generosidade","texto":"Honra ao Senhor com a tua fazenda e com as primícias de toda a tua renda; e se encherão os teus celeiros, e transbordarão de mosto os teus lagares."},
  {"id":"v03","referencia":"Provérbios 21:5","tema":"planejamento","texto":"Os pensamentos do diligente tendem só à abundância, porém os de todo apressado, tão-somente à pobreza."},
  {"id":"v04","referencia":"Provérbios 22:7","tema":"dívida","texto":"O rico domina sobre os pobres, e o que toma emprestado é servo do que empresta."},
  {"id":"v05","referencia":"Provérbios 6:6-8","tema":"planejamento","texto":"Vai ter com a formiga, ó preguiçoso; olha para os seus caminhos e sê sábio. Pois ela, não tendo superior, nem oficial, nem dominador, prepara no verão o seu pão; na sega ajunta o seu mantimento."},
  {"id":"v06","referencia":"Provérbios 13:11","tema":"planejamento","texto":"A fazenda que procede da vaidade diminuirá, mas quem a ajunta pelo trabalho terá aumento."},
  {"id":"v07","referencia":"Provérbios 24:27","tema":"planejamento","texto":"Prepara de fora a tua obra, e aparelha-a no campo, e então edifica a tua casa."},
  {"id":"v08","referencia":"Malaquias 3:10","tema":"generosidade","texto":"Trazei todos os dízimos à casa do tesouro, para que haja mantimento na minha casa, e depois fazei prova de mim, diz o Senhor dos Exércitos, se eu não vos abrir as janelas do céu e não derramar sobre vós uma bênção tal, que dela vos advenha a maior abastança."},
  {"id":"v09","referencia":"Mateus 6:19-21","tema":"mordomia","texto":"Não ajunteis tesouros na terra, onde a traça e a ferrugem tudo consomem, e onde os ladrões minam e roubam; mas ajuntai tesouros no céu. Porque onde estiver o vosso tesouro, aí estará também o vosso coração."},
  {"id":"v10","referencia":"Mateus 6:33","tema":"provisão","texto":"Mas buscai primeiro o Reino de Deus, e a sua justiça, e todas essas coisas vos serão acrescentadas."},
  {"id":"v11","referencia":"Lucas 14:28","tema":"planejamento","texto":"Pois qual de vós, querendo edificar uma torre, não se assenta primeiro a fazer as contas dos gastos, para ver se tem com que a acabar?"},
  {"id":"v12","referencia":"Lucas 16:10","tema":"mordomia","texto":"Quem é fiel no mínimo também é fiel no muito; quem é injusto no mínimo também é injusto no muito."},
  {"id":"v13","referencia":"2 Coríntios 9:7","tema":"generosidade","texto":"Cada um contribua segundo propôs no seu coração, não com tristeza ou por necessidade; porque Deus ama ao que dá com alegria."},
  {"id":"v14","referencia":"Filipenses 4:11-13","tema":"contentamento","texto":"Aprendi a contentar-me com o que tenho. Sei estar abatido e sei também ter abundância; em toda a maneira e em todas as coisas estou instruído, tanto a ter fartura como a ter fome, tanto a ter abundância como a padecer necessidade. Posso todas as coisas naquele que me fortalece."},
  {"id":"v15","referencia":"Filipenses 4:19","tema":"provisão","texto":"O meu Deus, segundo as suas riquezas, suprirá todas as vossas necessidades em glória, por Cristo Jesus."},
  {"id":"v16","referencia":"1 Timóteo 6:6-8","tema":"contentamento","texto":"Mas é grande ganho a piedade com contentamento. Porque nada trouxemos para este mundo e manifesto é que nada podemos levar dele. Tendo, porém, sustento e com que nos cobrirmos, estejamos com isso contentes."},
  {"id":"v17","referencia":"1 Timóteo 6:10","tema":"contentamento","texto":"Porque o amor do dinheiro é a raiz de toda espécie de males; e nessa cobiça alguns se desviaram da fé e se traspassaram a si mesmos com muitas dores."},
  {"id":"v18","referencia":"Hebreus 13:5","tema":"contentamento","texto":"Sejam vossos costumes sem avareza, contentando-vos com o que tendes; porque ele disse: Não te deixarei, nem te desampararei."},
  {"id":"v19","referencia":"Salmos 24:1","tema":"mordomia","texto":"Do Senhor é a terra e a sua plenitude, o mundo e aqueles que nele habitam."},
  {"id":"v20","referencia":"Salmos 37:21","tema":"dívida","texto":"O ímpio toma emprestado e não paga; mas o justo se compadece e dá."},
  {"id":"v21","referencia":"Eclesiastes 5:10","tema":"contentamento","texto":"O que amar o dinheiro nunca se fartará de dinheiro; e quem amar a abundância nunca se fartará da renda; também isso é vaidade."},
  {"id":"v22","referencia":"1 Crônicas 29:14","tema":"mordomia","texto":"Porque quem sou eu, e quem é o meu povo, que tivéssemos poder para tão voluntariamente dar semelhantes coisas? Porque tudo vem de ti, e da tua mão to damos."},
  {"id":"v23","referencia":"Deuteronômio 8:18","tema":"provisão","texto":"Antes te lembrarás do Senhor teu Deus, que ele é o que te dá força para adquirires riqueza, para confirmar o seu concerto, que jurou a teus pais, como se vê neste dia."},
  {"id":"v24","referencia":"Provérbios 10:4","tema":"planejamento","texto":"O que trabalha com mão enganosa empobrece, mas a mão dos diligentes enriquece."},
  {"id":"v25","referencia":"Provérbios 11:24-25","tema":"generosidade","texto":"Alguns há que espalham, e ainda se lhes acrescenta mais; e outros, que retêm mais do que é justo, mas é para a sua perda. A alma generosa engordará, e o que regar também será regado."},
  {"id":"v26","referencia":"Provérbios 13:22","tema":"família","texto":"O homem de bem deixa uma herança aos filhos de seus filhos, mas a fazenda do pecador é depositada para o justo."},
  {"id":"v27","referencia":"Provérbios 15:16","tema":"contentamento","texto":"Melhor é o pouco com o temor do Senhor do que um grande tesouro onde há inquietação."},
  {"id":"v28","referencia":"Provérbios 15:22","tema":"família","texto":"Sem conselho os projetos saem vãos, mas, com a multidão de conselheiros, se confirmarão."},
  {"id":"v29","referencia":"Provérbios 16:3","tema":"planejamento","texto":"Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos."},
  {"id":"v30","referencia":"Provérbios 16:9","tema":"planejamento","texto":"O coração do homem considera o seu caminho, mas o Senhor lhe dirige os passos."},
  {"id":"v31","referencia":"Provérbios 19:17","tema":"generosidade","texto":"Ao Senhor empresta o que se compadece do pobre, e ele lhe pagará o seu benefício."},
  {"id":"v32","referencia":"Provérbios 21:20","tema":"planejamento","texto":"Tesouro desejável e azeite há na casa do sábio, mas o homem insensato os devora."},
  {"id":"v33","referencia":"Provérbios 22:1","tema":"contentamento","texto":"Mais digno de ser escolhido é o bom nome do que as muitas riquezas; e a graça é melhor do que a riqueza e o ouro."},
  {"id":"v34","referencia":"Provérbios 22:26-27","tema":"dívida","texto":"Não estejas entre os que se comprometem e entre os que ficam por fiadores de dívidas. Se não tens com que pagar, por que tirariam a tua cama de debaixo de ti?"},
  {"id":"v35","referencia":"Provérbios 23:4-5","tema":"contentamento","texto":"Não te canses para enriqueceres; dá de mão à tua prudência. Porventura, fitarás os olhos naquilo que não é nada? Porque, certamente, isso se fará asas e voará ao céu como a águia."},
  {"id":"v36","referencia":"Provérbios 27:23-24","tema":"mordomia","texto":"Procura conhecer o estado das tuas ovelhas; põe o teu coração sobre os teus rebanhos, porque o tesouro não dura para sempre, nem a coroa de geração em geração."},
  {"id":"v37","referencia":"Provérbios 28:20","tema":"planejamento","texto":"O homem fiel abundará em bênçãos, mas o que se apressa a enriquecer não ficará sem castigo."},
  {"id":"v38","referencia":"Provérbios 30:8-9","tema":"contentamento","texto":"Não me dês nem a pobreza nem a riqueza; mantém-me do pão da minha porção acostumada; para que, porventura, de farto te não negue e diga: Quem é o Senhor? Ou que, empobrecendo, venha a furtar e lance mão do nome de Deus."},
  {"id":"v39","referencia":"Provérbios 31:16","tema":"planejamento","texto":"Considera uma herdade e adquire-a; planta uma vinha com o fruto de suas mãos."},
  {"id":"v40","referencia":"Eclesiastes 11:2","tema":"planejamento","texto":"Reparte com sete e ainda até com oito, porque não sabes que mal haverá sobre a terra."},
  {"id":"v41","referencia":"Salmos 37:25","tema":"provisão","texto":"Fui moço e agora sou velho; mas nunca vi desamparado o justo, nem a sua semente a mendigar o pão."},
  {"id":"v42","referencia":"Salmos 112:5","tema":"generosidade","texto":"Bem irá ao homem que se compadece e empresta; disporá as suas coisas com juízo."},
  {"id":"v43","referencia":"Salmos 127:1","tema":"família","texto":"Se o Senhor não edificar a casa, em vão trabalham os que a edificam; se o Senhor não guardar a cidade, em vão vigia a sentinela."},
  {"id":"v44","referencia":"Salmos 128:1-2","tema":"família","texto":"Bem-aventurado aquele que teme ao Senhor e anda nos seus caminhos! Pois comerás do trabalho das tuas mãos; feliz serás, e te irá bem."},
  {"id":"v45","referencia":"Ageu 1:6","tema":"mordomia","texto":"Semeais muito e recolheis pouco; comeis, porém não vos fartais; bebeis, porém não vos saciais; vestis-vos, porém ninguém se aquece; e o que recebe salário, recebe salário num saquitel furado."},
  {"id":"v46","referencia":"Mateus 6:24","tema":"mordomia","texto":"Ninguém pode servir a dois senhores, porque ou há de odiar um e amar o outro ou se dedicará a um e desprezará o outro. Não podeis servir a Deus e a Mamom."},
  {"id":"v47","referencia":"Mateus 6:26","tema":"provisão","texto":"Olhai para as aves do céu, que nem semeiam, nem segam, nem ajuntam em celeiros; e vosso Pai celestial as alimenta. Não tendes vós muito mais valor do que elas?"},
  {"id":"v48","referencia":"Mateus 25:21","tema":"mordomia","texto":"Bem está, servo bom e fiel. Sobre o pouco foste fiel, sobre muito te colocarei; entra no gozo do teu senhor."},
  {"id":"v49","referencia":"Lucas 6:38","tema":"generosidade","texto":"Dai, e ser-vos-á dado; boa medida, recalcada, sacudida e transbordando vos darão; porque com a mesma medida com que medirdes também vos medirão de novo."},
  {"id":"v50","referencia":"Lucas 12:15","tema":"contentamento","texto":"Acautelai-vos e guardai-vos da avareza, porque a vida de qualquer não consiste na abundância do que possui."},
  {"id":"v51","referencia":"Lucas 12:34","tema":"mordomia","texto":"Porque, onde estiver o vosso tesouro, ali estará também o vosso coração."},
  {"id":"v52","referencia":"Lucas 16:11","tema":"mordomia","texto":"Pois, se nas riquezas injustas não fostes fiéis, quem vos confiará as verdadeiras?"},
  {"id":"v53","referencia":"Atos 20:35","tema":"generosidade","texto":"Tenho-vos mostrado em tudo que, trabalhando assim, é necessário auxiliar os enfermos e recordar as palavras do Senhor Jesus, que disse: Mais bem-aventurada coisa é dar do que receber."},
  {"id":"v54","referencia":"Romanos 13:8","tema":"dívida","texto":"A ninguém devais coisa alguma, a não ser o amor com que vos ameis uns aos outros; porque quem ama aos outros cumpriu a lei."},
  {"id":"v55","referencia":"1 Coríntios 4:2","tema":"mordomia","texto":"Além disso, requer-se nos despenseiros que cada um se ache fiel."},
  {"id":"v56","referencia":"1 Coríntios 16:2","tema":"planejamento","texto":"No primeiro dia da semana, cada um de vós ponha de parte o que puder ajuntar, conforme a sua prosperidade, para que se não façam as coletas quando eu chegar."},
  {"id":"v57","referencia":"2 Coríntios 9:6","tema":"generosidade","texto":"E digo isto: Que o que semeia pouco pouco também ceifará; e o que semeia em abundância em abundância também ceifará."},
  {"id":"v58","referencia":"2 Coríntios 9:8","tema":"provisão","texto":"E Deus é poderoso para fazer abundar em vós toda graça, a fim de que, tendo sempre, em tudo, toda suficiência, abundeis em toda boa obra."},
  {"id":"v59","referencia":"Colossenses 3:23","tema":"mordomia","texto":"E, tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens."},
  {"id":"v60","referencia":"1 Tessalonicenses 4:11-12","tema":"planejamento","texto":"E procureis viver quietos, e tratar dos vossos próprios negócios, e trabalhar com vossas próprias mãos, como já vo-lo temos mandado; para que andeis honestamente para com os que estão de fora e não necessiteis de coisa alguma."},
  {"id":"v61","referencia":"1 Timóteo 5:8","tema":"família","texto":"Mas, se alguém não tem cuidado dos seus e principalmente dos da sua família, negou a fé e é pior do que o infiel."},
  {"id":"v62","referencia":"1 Timóteo 6:17-18","tema":"generosidade","texto":"Manda aos ricos deste mundo que não sejam altivos, nem ponham a esperança na incerteza das riquezas, mas em Deus, que abundantemente nos dá todas as coisas para delas gozarmos; que façam o bem, enriqueçam em boas obras, repartam de boa mente e sejam comunicáveis."},
  {"id":"v63","referencia":"Tiago 1:17","tema":"provisão","texto":"Toda boa dádiva e todo dom perfeito vêm do alto, descendo do Pai das luzes, em quem não há mudança, nem sombra de variação."},
  {"id":"v64","referencia":"Tiago 4:13-15","tema":"planejamento","texto":"Eia, agora, vós que dizeis: Hoje ou amanhã iremos a tal cidade, e lá passaremos um ano, e contrataremos, e ganharemos; digo-vos que não sabeis o que acontecerá amanhã. Em lugar do que devíeis dizer: Se o Senhor quiser, e se vivermos, faremos isto ou aquilo."},
  {"id":"v65","referencia":"3 João 1:2","tema":"provisão","texto":"Amado, desejo que te vá bem em todas as coisas e que tenhas saúde, assim como bem vai a tua alma."},
  {"id":"v66","referencia":"Deuteronômio 15:10","tema":"generosidade","texto":"Livremente lhe darás, e que o teu coração não seja maligno, quando lhe deres; pois, por esta causa, te abençoará o Senhor, teu Deus, em toda a tua obra e em tudo no que puseres a tua mão."},
  {"id":"v67","referencia":"Salmos 23:1","tema":"provisão","texto":"O Senhor é o meu pastor; nada me faltará."},
  {"id":"v68","referencia":"Provérbios 3:27","tema":"generosidade","texto":"Não detenhas dos seus donos o bem, estando na tua mão poder fazê-lo."}
  ];
}

// ==============================================================================
// email.gs
// ==============================================================================

/**
 * email.gs — Leitura automática de e-mails (Gmail) e da pasta Contas da Casa/_Entrada.
 *
 * processarEmails() (gatilho a cada hora):
 *  - marcador "Contas da Casa": salva os PDFs em Contas da Casa/AAAA/MM, lê com leitura.gs e cria
 *    a ContaAPagar casada com a conta fixa (pelo remetente/palavras-chave);
 *  - marcador "Alertas Cartão": o texto do e-mail passa pelo parser de SMS (sms.gs) e vai para a
 *    CaixaEntrada;
 *  - ao terminar, a conversa recebe o marcador "Processado" (nunca é lida duas vezes).
 * Os marcadores são criados se não existirem. Os filtros do Gmail (quem recebe qual marcador)
 * são criados pela pessoa — passo a passo no README.
 *
 * processarPastaEntrada() (gatilho a cada hora): PDFs/imagens soltos em `_Entrada` são lidos,
 * viram ContaAPagar e são movidos para a pasta do mês.
 */

const MARCADOR_CONTAS = 'Contas da Casa';
const MARCADOR_ALERTAS = 'Alertas Cartão';
const MARCADOR_PROCESSADO = 'Processado';
const MAX_THREADS_POR_VEZ = 20;

/** Devolve o marcador do Gmail, criando se preciso. */
function obterMarcador(nome) {
  return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
}

/**
 * Conversas com o marcador que ainda não receberam "Processado". Usa o próprio marcador (getThreads) em vez
 * de GmailApp.search('label:"..."'), porque a busca não aceita nomes de marcador com espaço/acento entre aspas.
 * As conversas vêm da mais recente para a mais antiga, então as novas estão sempre no começo.
 */
function threadsNaoProcessadas(marcador, processado) {
  const nomeProcessado = processado.getName();
  return marcador.getThreads(0, MAX_THREADS_POR_VEZ * 5)
    .filter((t) => !t.getLabels().some((l) => l.getName() === nomeProcessado))
    .slice(0, MAX_THREADS_POR_VEZ);
}

/** Processa as duas filas de e-mail. Devolve { contas, alertas }. */
function processarEmails() {
  const processado = obterMarcador(MARCADOR_PROCESSADO);
  obterMarcador(MARCADOR_CONTAS);
  obterMarcador(MARCADOR_ALERTAS);
  const resultado = { contas: 0, alertas: 0, erros: 0 };

  const contas = threadsNaoProcessadas(obterMarcador(MARCADOR_CONTAS), processado);
  contas.forEach((thread) => {
    try { resultado.contas += processarThreadConta(thread); } catch (e) { resultado.erros++; console.error('Conta por e-mail: ' + e.message); }
    thread.addLabel(processado);
  });

  const alertas = threadsNaoProcessadas(obterMarcador(MARCADOR_ALERTAS), processado);
  alertas.forEach((thread) => {
    try { resultado.alertas += processarThreadAlerta(thread); } catch (e) { resultado.erros++; console.error('Alerta por e-mail: ' + e.message); }
    thread.addLabel(processado);
  });
  console.log('processarEmails: ' + JSON.stringify(resultado));
  return resultado;
}

/** Lê os anexos PDF/imagem da conversa, salva no Drive e cria a ContaAPagar. */
function processarThreadConta(thread) {
  let criadas = 0;
  thread.getMessages().forEach((msg) => {
    const remetente = msg.getFrom();
    const anexos = msg.getAttachments({ includeInlineImages: false, includeAttachments: true })
      .filter((a) => /pdf|image\/(jpeg|png)/i.test(a.getContentType()));
    if (!anexos.length) {
      // Sem anexo: tenta extrair da própria mensagem (texto) — valor, vencimento, código de barras.
      const leitura = extrairDeTextoOcr(msg.getPlainBody(), 'conta');
      leitura.empresa = leitura.empresa || remetente;
      completarLeituraConta(leitura, remetente + ' ' + msg.getSubject());
      const r = criarContaAPagarDeLeitura(leitura, '');
      if (r && r.nova) criadas++;
      return;
    }
    anexos.forEach((anexo) => {
      const blob = anexo.copyBlob();
      const comp = competenciaDe();
      const pasta = pastaPorCaminho('Contas da Casa/' + comp.slice(0, 4) + '/' + comp.slice(5, 7));
      const arquivo = pasta.createFile(blob.setName(nomeArquivoLeitura('conta', blob.getContentType(), anexo.getName())));
      compartilharComLink(arquivo);
      const leitura = lerBlobComoConta(blob);
      if (!leitura.conta_fixa_id) completarLeituraConta(leitura, remetente + ' ' + msg.getSubject());
      const r = criarContaAPagarDeLeitura(leitura, urlVisualizacao(arquivo.getId()));
      if (r && r.nova) criadas++;
    });
  });
  return criadas;
}

/** Alertas de compra por e-mail → parser de SMS → CaixaEntrada (membro pelo final do cartão). */
function processarThreadAlerta(thread) {
  let gravados = 0;
  const admin = lerAba('Usuarios').find((u) => normalizarPerfil(u.perfil) === 'Administrador' && u.ativo) || null;
  thread.getMessages().forEach((msg) => {
    const texto = (msg.getSubject() + '\n' + msg.getPlainBody()).replace(/\s+/g, ' ').slice(0, 2000);
    const r = registrarAlertaNaCaixa(texto, 'email', admin);
    if (r.status !== 'ignorado') gravados++;
  });
  return gravados;
}

// ---------- Pasta _Entrada ----------

/** Lê os arquivos soltos em Contas da Casa/_Entrada e move para a pasta do mês. */
function processarPastaEntrada() {
  const entrada = pastaPorCaminho('Contas da Casa/_Entrada');
  const arquivos = entrada.getFiles();
  let processados = 0;
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const mime = arquivo.getMimeType();
    if (!/pdf|image\/(jpeg|png|webp)/i.test(mime)) continue;
    try {
      const blob = arquivo.getBlob();
      const leitura = lerBlobComoConta(blob);
      const comp = competenciaDe();
      const destino = pastaPorCaminho('Contas da Casa/' + comp.slice(0, 4) + '/' + comp.slice(5, 7));
      arquivo.moveTo(destino);
      compartilharComLink(arquivo);
      criarContaAPagarDeLeitura(leitura, urlVisualizacao(arquivo.getId()));
      processados++;
    } catch (e) {
      console.error('Pasta _Entrada: ' + arquivo.getName() + ' — ' + e.message);
    }
  }
  console.log('processarPastaEntrada: ' + processados + ' arquivo(s)');
  return processados;
}

// ==============================================================================
// familia.gs
// ==============================================================================

/**
 * familia.gs — Projetos (metas e aportes), decisões e votos, reunião mensal e relatório do mês,
 * patrimônio manual, versículo do dia, configuração e arquivos de identidade (foto de capa, brasão).
 *
 * Campos calculados dos projetos (iguais ao modo demonstração):
 *  - valor_atual = valor_inicial + soma dos aportes;
 *  - necessario_mes = quanto falta ÷ meses até a data-alvo;
 *  - media_3m = média dos aportes dos 3 meses anteriores;
 *  - situacao: no_ritmo (média ≥ 95% do necessário) | atrasado | votacao | concluido | pausado;
 *  - atraso = (necessário − média) × 3; votos_sim / votos_total / aguardando da decisão vinculada.
 */

// ---------- Projetos ----------

/** valor_atual = valor_inicial + soma dos aportes (função pura sobre os dados). */
function valorAtualProjeto(d, projeto) {
  return arredondar((Number(projeto.valor_inicial) || 0) + somar(d.aportes.filter((a) => a.projeto_id === projeto.id), (a) => a.valor));
}

/** Quanto guardar por mês para fechar a meta na data-alvo (função pura). */
function necessarioPorMes(d, projeto, hoje) {
  const falta = Math.max(0, (Number(projeto.meta_valor) || 0) - valorAtualProjeto(d, projeto));
  const h = String(hoje || hojeIso());
  const alvo = String(projeto.data_alvo || '').slice(0, 7);
  const partesH = h.split('-').map(Number), partesA = alvo.split('-').map(Number);
  const meses = partesA[0] && partesA[1] ? Math.max(1, (partesA[0] - partesH[0]) * 12 + (partesA[1] - partesH[1])) : 12;
  return Math.round(falta / meses);
}

/** Média dos aportes dos 3 meses anteriores ao atual (função pura). */
function mediaAportes3m(d, projeto, hoje) {
  const comp = String(hoje || hojeIso()).slice(0, 7);
  const comps = [1, 2, 3].map((k) => somarMeses(comp, -k));
  return somar(d.aportes.filter((a) => a.projeto_id === projeto.id && comps.indexOf(String(a.data).slice(0, 7)) >= 0), (a) => a.valor) / 3;
}

/** Projeto com todos os campos calculados (função pura). */
function comProjetoCalculado(d, projeto, hoje) {
  const necessario = necessarioPorMes(d, projeto, hoje);
  const med = mediaAportes3m(d, projeto, hoje);
  const atraso = Math.max(0, Math.round((necessario - med) * 3));
  const situacao = projeto.status === 'votação' ? 'votacao' : projeto.status === 'concluído' ? 'concluido' : projeto.status === 'pausado' ? 'pausado' : (med >= necessario * 0.95 ? 'no_ritmo' : 'atrasado');
  const decisao = (d.decisoes || []).find((x) => x.projeto_id === projeto.id);
  const vs = decisao ? (d.votos || []).filter((v) => v.decisao_id === decisao.id) : [];
  const votantes = (d.usuarios || []).filter((u) => u.ativo).length;
  return Object.assign({}, projeto, {
    valor_atual: valorAtualProjeto(d, projeto), necessario_mes: necessario, media_3m: Math.round(med), situacao, atraso,
    votos_sim: vs.filter((v) => v.voto === 'sim').length, votos_total: vs.length, aguardando: Math.max(0, votantes - vs.length),
  });
}

/** Compatibilidade com a v1: só o valor_atual. */
function comValorAtual(projeto, aportes) {
  return Object.assign({}, projeto, { valor_atual: valorAtualProjeto({ aportes: aportes || lerAba('Aportes') }, projeto) });
}

function acaoListarProjetos() {
  const d = carregarDados();
  return d.projetos.map((p) => comProjetoCalculado(d, p)).sort((a, b) => a.prioridade - b.prioridade);
}

/** salvar_projeto: Dependente só cria/edita o próprio projeto; Adulto/Administrador qualquer um. */
function acaoSalvarProjeto(p, ctx) {
  const pr = p.projeto || {};
  if (!pr.nome) throw new ErroUsuario('Dê um nome ao projeto.');
  const meta = lerValor(pr.meta_valor);
  if (!(meta > 0)) throw new ErroUsuario('Informe o valor da meta.');
  const existente = pr.id ? buscarPorId('Projetos', pr.id) : null;
  if (pr.id && !existente) throw new ErroUsuario('Projeto não encontrado');
  if (ctx.ehDependente) {
    if (existente && existente.criado_por !== ctx.uid) throw new ErroUsuario('Sem permissão');
    pr.criado_por = ctx.uid;
    if (!existente) pr.prioridade = Math.max(Number(pr.prioridade) || 0, 4);
  }
  const novo = {
    id: pr.id || gerarId('p'), nome: String(pr.nome).trim(), icone: pr.icone || 'target', foto_url: pr.foto_url || '', meta_valor: meta,
    data_alvo: normalizarDataIso(pr.data_alvo) || somarMeses(competenciaDe(), 12) + '-01', valor_inicial: lerValor(pr.valor_inicial),
    prioridade: Number(pr.prioridade) || (existente ? existente.prioridade : lerAba('Projetos').length + 1),
    status: ['votação', 'ativo', 'concluído', 'pausado'].indexOf(pr.status) >= 0 ? pr.status : (existente ? existente.status : 'ativo'),
    versiculo: pr.versiculo || 'Lucas 14:28', criado_por: existente ? existente.criado_por : (pr.criado_por || ctx.uid),
    criado_em: existente ? existente.criado_em : (pr.criado_em || agoraIso()),
  };
  const salvo = salvarPorId('Projetos', novo);
  return comProjetoCalculado(carregarDados(), salvo);
}

/** Marca o projeto como concluído quando o valor atual bate a meta. */
function verificarMetaProjeto(projetoId) {
  const pr = buscarPorId('Projetos', projetoId);
  if (!pr) return null;
  const atual = comValorAtual(pr);
  if (atual.valor_atual >= pr.meta_valor && pr.status !== 'concluído') atualizarPorId('Projetos', pr.id, { status: 'concluído' });
  return atual;
}

/** aportar: registra o aporte e o lançamento em c_aporte_projeto (que não conta como despesa). */
function acaoAportar(p, ctx) {
  const pr = buscarPorId('Projetos', String(p.projeto_id || ''));
  if (!pr) throw new ErroUsuario('Projeto não encontrado');
  const valor = lerValor(p.valor);
  if (!(valor > 0)) throw new ErroUsuario('Informe um valor maior que zero.');
  const hoje = hojeIso();
  const aporte = inserirLinhas('Aportes', [{ id: gerarId('a'), projeto_id: pr.id, data: hoje, valor, usuario_id: ctx.uid, observacao: String(p.observacao || '') }])[0];
  inserirLinhas('Lancamentos', [{
    id: gerarId('l'), data: hoje, competencia: competenciaDe(hoje), tipo: 'despesa', valor, categoria_id: CATEGORIA_APORTE,
    descricao: 'Aporte: ' + pr.nome, estabelecimento: 'Poupança', forma_pgto: 'pix', cartao_id: '', parcela: '', usuario_id: ctx.uid,
    origem: 'manual', anexo_url: '', status: 'confirmado', hash_dedup: 'aporte_' + aporte.id, criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: pr.id,
  }]);
  verificarMetaProjeto(pr.id);
  return aporte;
}

function acaoListarAportes(p) {
  return lerAba('Aportes').filter((a) => a.projeto_id === p.projeto_id).sort((a, b) => (a.data < b.data ? 1 : -1));
}

// ---------- Decisões e votos ----------

function votosDe(decisaoId, votos) {
  return (votos || lerAba('Votos')).filter((v) => v.decisao_id === decisaoId);
}

function acaoListarDecisoes(p) {
  let ds = lerAba('Decisoes');
  if (p.status) ds = ds.filter((d) => d.status === p.status);
  const votos = lerAba('Votos');
  return ds.map((d) => Object.assign({}, d, { votos: votosDe(d.id, votos) })).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
}

function acaoSalvarDecisao(p, ctx) {
  const d = p.decisao || {};
  if (!d.titulo) throw new ErroUsuario('Dê um título à proposta.');
  const existente = d.id ? buscarPorId('Decisoes', d.id) : null;
  if (existente && existente.status !== 'aberta' && !ctx.ehAdmin) throw new ErroUsuario('Esta votação já foi encerrada');
  if (existente && existente.criado_por !== ctx.uid && !ctx.ehAdmin) throw new ErroUsuario('Sem permissão');
  const nova = {
    id: d.id || gerarId('d'), titulo: d.titulo, descricao: d.descricao || '',
    tipo: ['novo projeto', 'gasto grande', 'ajuste de orçamento'].indexOf(d.tipo) >= 0 ? d.tipo : 'gasto grande',
    valor: lerValor(d.valor), criado_por: existente ? existente.criado_por : (d.criado_por || ctx.uid),
    criado_em: existente ? existente.criado_em : (d.criado_em || agoraIso()),
    prazo: normalizarDataIso(d.prazo) || somarDias(hojeIso(), 7),
    status: existente ? (ctx.ehAdmin && d.status ? d.status : existente.status) : 'aberta', projeto_id: d.projeto_id || '',
  };
  const salva = salvarPorId('Decisoes', nova);
  return Object.assign({}, salva, { votos: votosDe(salva.id) });
}

/** votar: um voto por pessoa (o último vale). */
function acaoVotar(p, ctx) {
  const d = buscarPorId('Decisoes', String(p.decisao_id || ''));
  if (!d) throw new ErroUsuario('Decisão não encontrada');
  if (d.status !== 'aberta') throw new ErroUsuario('Esta votação já foi encerrada');
  if (['sim', 'não', 'abster'].indexOf(p.voto) < 0) throw new ErroUsuario('Voto inválido. Use sim, não ou abster.');
  const outros = lerAba('Votos').filter((v) => !(v.decisao_id === d.id && v.usuario_id === ctx.uid));
  outros.push({ decisao_id: d.id, usuario_id: ctx.uid, voto: p.voto, comentario: String(p.comentario || ''), data: agoraIso() });
  substituirAba('Votos', outros);
  return Object.assign({}, d, { votos: votosDe(d.id) });
}

/** encerrar_decisao (Administrador): aplica a regra de votação da Config. */
function acaoEncerrarDecisao(p, ctx) {
  const d = buscarPorId('Decisoes', String(p.decisao_id || ''));
  if (!d) throw new ErroUsuario('Decisão não encontrada');
  const votos = votosDe(d.id);
  const pais = lerAba('Usuarios').filter((u) => normalizarPerfil(u.perfil) === 'Administrador').map((u) => u.id);
  const aprovada = aplicarRegraVotacao(votos, ctx.config.regra_votacao, pais);
  const atualizada = atualizarPorId('Decisoes', d.id, { status: aprovada ? 'aprovada' : 'recusada' });
  if (d.projeto_id && buscarPorId('Projetos', d.projeto_id)) atualizarPorId('Projetos', d.projeto_id, { status: aprovada ? 'ativo' : 'pausado' });
  return Object.assign({}, atualizada, { votos });
}

// ---------- Reunião mensal e relatório do mês ----------

/**
 * Pauta da reunião em markdown (função pura, mesmo texto do modo demonstração).
 * @param d dados; @param visao visão do usuário; @param comp competência; @param versiculo {texto, referencia}
 */
function gerarPautaMarkdown(d, visao, comp, versiculo, titulo) {
  const r = calcularResumoMes(d, visao, comp);
  const ant = calcularResumoMes(d, visao, somarMeses(comp, -1));
  const catMap = indexarPorId(d.categorias);
  const estouradas = Object.keys(r.por_categoria).filter((id) => r.por_categoria[id].orcado && r.por_categoria[id].realizado > r.por_categoria[id].orcado)
    .map((id) => '- ' + (catMap[id] ? catMap[id].nome : id) + ': ' + moeda(r.por_categoria[id].realizado) + ' de ' + moeda(r.por_categoria[id].orcado) + ' planejados');
  const subiram = d.contas_fixas.map((cf) => {
    const a = d.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === comp);
    const pAnt = d.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === somarMeses(comp, -1));
    if (a && pAnt && pAnt.valor > 0 && a.valor / pAnt.valor > 1.2) return '- ' + cf.nome + ': subiu ' + Math.round((a.valor / pAnt.valor - 1) * 100) + '% (' + moeda(pAnt.valor) + ' → ' + moeda(a.valor) + ')';
    return null;
  }).filter(Boolean);
  const projetos = d.projetos.filter((pr) => pr.status === 'ativo').map((pr) => {
    const pc = comProjetoCalculado(d, pr);
    return '- ' + pr.nome + ': ' + Math.round((pc.valor_atual / (pr.meta_valor || 1)) * 100) + '% (' + moeda(pc.valor_atual) + ' de ' + moeda(pr.meta_valor) + ') — ' + (pc.situacao === 'no_ritmo' ? 'no ritmo' : 'atrasado ' + moeda(pc.atraso));
  });
  const abertas = d.decisoes.filter((x) => x.status === 'aberta').map((x) => '- ' + x.titulo + ' (prazo ' + dataBr(x.prazo) + ')');
  const v = versiculo || { texto: '', referencia: '' };
  return [
    '# ' + (titulo || 'Reunião da família') + ' — ' + nomeCompetencia(comp), '',
    '## 1. Como fechou o mês',
    '- Entrou ' + moeda(r.entrou) + ' · Saiu ' + moeda(r.saiu) + ' · ' + (r.sobrou >= 0 ? 'Sobrou' : 'Faltou') + ' ' + moeda(Math.abs(r.sobrou)),
    '- Mês anterior: ' + (ant.sobrou >= 0 ? 'sobrou' : 'faltou') + ' ' + moeda(Math.abs(ant.sobrou)),
    '', '## 2. O que passou do orçamento'].concat(estouradas.length ? estouradas : ['- Nada passou do orçamento.'],
    ['', '## 3. Contas que subiram'], subiram.length ? subiram : ['- Nenhuma conta subiu mais de 20%.'],
    ['', '## 4. Situação dos projetos'], projetos.length ? projetos : ['- Nenhum projeto ativo.'],
    ['', '## 5. Decisões abertas'], abertas.length ? abertas : ['- Nenhuma.'],
    ['', '## 6. Para refletir', '> "' + v.texto + '" — ' + v.referencia,
     '', '## 7. O que decidimos', '_(preencher)_', '', '## 8. Motivo de gratidão', '_(preencher)_']).join('\n');
}

/** Pauta lendo a planilha (atalho usado pelas ações e rotinas). */
function gerarPauta(ctx, comp, titulo) {
  return gerarPautaMarkdown(carregarDados(), visaoDe(ctx), comp, versiculoDoDia('família'), titulo);
}

/** pauta_reuniao: devolve a reunião já salva da competência ou uma nova com a pauta gerada. */
function acaoPautaReuniao(p, ctx) {
  const comp = String(p.competencia || competenciaDe());
  const existente = lerAba('Reunioes').find((r) => r.competencia === comp);
  if (existente) return existente;
  return { id: gerarId('r'), competencia: comp, data: hojeIso(), pauta: gerarPauta(ctx, comp), decidido: '', oracao_gratidao: '', criado_por: ctx.uid };
}

function acaoSalvarReuniao(p, ctx) {
  const r = p.reuniao || {};
  if (!r.competencia) throw new ErroUsuario('Informe a competência da reunião.');
  const existente = lerAba('Reunioes').find((x) => x.id === r.id || x.competencia === r.competencia);
  const nova = {
    id: existente ? existente.id : (r.id || gerarId('r')), competencia: r.competencia, data: normalizarDataIso(r.data) || hojeIso(),
    pauta: r.pauta || (existente ? existente.pauta : ''), decidido: r.decidido || '', oracao_gratidao: r.oracao_gratidao || '',
    criado_por: existente ? existente.criado_por : (r.criado_por || ctx.uid),
  };
  return salvarPorId('Reunioes', nova);
}

/** listar_reunioes (Adulto): da mais recente para a mais antiga. */
function acaoListarReunioes() {
  return lerAba('Reunioes').slice().sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
}

/**
 * Projeção dos 3 meses seguintes a `comp` (função pura): usa o painel do ano (meses futuros já
 * vêm previstos; meses passados, realizados).
 */
function projetarTresMeses(d, visao, comp, hoje) {
  const cache = {};
  const painelDe = (ano) => { if (!cache[ano]) cache[ano] = calcularPainel(d, visao, ano, '', hoje); return cache[ano]; };
  return [1, 2, 3].map((k) => {
    const c = somarMeses(comp, k);
    const m = painelDe(Number(c.slice(0, 4))).meses.find((x) => x.competencia === c);
    return { competencia: c, receitas: m ? m.receitas : 0, despesas: m ? m.despesas : 0, saldo: m ? m.saldo : 0 };
  });
}

/** relatorio_mensal (Adulto): markdown do fechamento + projeção de 3 meses. */
function acaoRelatorioMensal(p, ctx) {
  const comp = String(p.competencia || somarMeses(competenciaDe(), -1));
  const d = carregarDados();
  const visao = visaoDe(ctx);
  return { markdown: gerarPautaMarkdown(d, visao, comp, versiculoDoDia('família'), 'Relatório do mês'), projecao: projetarTresMeses(d, visao, comp) };
}

// ---------- Patrimônio (manual) ----------

const TIPOS_PATRIMONIO = ['conta', 'poupanca', 'investimento', 'imovel', 'veiculo', 'outro'];

/** Converte a linha da aba (saldos em JSON) no objeto Patrimonio. */
function patrimonioPublico(r) {
  let saldos = [];
  try { saldos = typeof r.saldos === 'string' ? (r.saldos ? JSON.parse(r.saldos) : []) : (r.saldos || []); } catch (e) { saldos = []; }
  saldos = saldos.map((s) => ({ competencia: String(s.competencia), valor: arredondar(s.valor) })).sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  return { id: r.id, nome: r.nome, tipo: r.tipo, instituicao: r.instituicao || '', titular_id: r.titular_id || '', saldos, ativo: !!r.ativo };
}

function acaoListarPatrimonio() {
  return lerAba('Patrimonio').map(patrimonioPublico);
}

/** salvar_patrimonio (Administrador). */
function acaoSalvarPatrimonio(p) {
  const pt = p.patrimonio || {};
  if (!pt.nome) throw new ErroUsuario('Dê um nome ao item (ex.: "Conta corrente").');
  const existente = pt.id ? buscarPorId('Patrimonio', pt.id) : null;
  const saldos = Array.isArray(pt.saldos) ? pt.saldos : (existente ? patrimonioPublico(existente).saldos : []);
  const novo = {
    id: pt.id || gerarId('pt'), nome: String(pt.nome).trim(), tipo: TIPOS_PATRIMONIO.indexOf(pt.tipo) >= 0 ? pt.tipo : 'outro',
    instituicao: pt.instituicao || '', titular_id: pt.titular_id || '',
    saldos: JSON.stringify(saldos.filter((s) => s && s.competencia).map((s) => ({ competencia: String(s.competencia), valor: lerValor(s.valor) }))),
    ativo: pt.ativo === undefined ? true : paraBooleano(pt.ativo),
  };
  return patrimonioPublico(salvarPorId('Patrimonio', novo));
}

/** registrar_saldo_patrimonio (Adulto): grava/substitui o saldo de uma competência. */
function acaoRegistrarSaldoPatrimonio(p) {
  const r = buscarPorId('Patrimonio', String(p.id || ''));
  if (!r) throw new ErroUsuario('Item não encontrado');
  const comp = String(p.competencia || competenciaDe());
  if (!/^\d{4}-\d{2}$/.test(comp)) throw new ErroUsuario('Competência inválida (use AAAA-MM).');
  const saldos = patrimonioPublico(r).saldos.filter((s) => s.competencia !== comp).concat([{ competencia: comp, valor: lerValor(p.valor) }]);
  return patrimonioPublico(atualizarPorId('Patrimonio', r.id, { saldos: JSON.stringify(saldos) }));
}

// ---------- Versículo do dia ----------

/** Rotação determinística pelo dia (todo mundo vê o mesmo versículo no mesmo dia). */
function versiculoDoDia(tema) {
  let lista = lerAba('Versiculos');
  if (!lista.length) lista = dadosIniciaisVersiculos();
  const filtrada = tema ? lista.filter((v) => v.tema === tema) : lista;
  const usar = filtrada.length ? filtrada : lista;
  const dia = Math.floor(Date.now() / 86400000);
  return usar[dia % usar.length];
}

function acaoVersiculoDoDia(p) {
  return versiculoDoDia(p.tema);
}

// ---------- Configuração ----------

const CONFIG_EDITAVEIS = ['nome_familia', 'sobrenome', 'url_brasao', 'url_foto_capa', 'versiculo_lema', 'moeda', 'dia_fechamento_mes', 'lembrete_horario', 'fe_ativa',
  'divisao_dar', 'divisao_poupar', 'divisao_viver', 'valor_gasto_grande', 'regra_votacao', 'dependente_ve_salarios', 'rotina_vigia', 'rotina_quinzenal', 'rotina_fechamento', 'telegram_ativo'];
const CHAVES_ROTINAS = ['lembrete_horario', 'rotina_vigia', 'rotina_quinzenal', 'rotina_fechamento'];

/** salvar_config (Administrador): só as chaves públicas; reinstala os gatilhos das rotinas quando elas mudam. */
function acaoSalvarConfig(p, ctx) {
  const entrada = p.config || {};
  if (entrada.junior_ve_salarios !== undefined && entrada.dependente_ve_salarios === undefined) entrada.dependente_ve_salarios = entrada.junior_ve_salarios; // nome antigo
  const mudancas = {};
  CONFIG_EDITAVEIS.forEach((k) => { if (entrada[k] !== undefined) mudancas[k] = entrada[k]; });
  if (mudancas.lembrete_horario && !/^\d{2}:\d{2}$/.test(String(mudancas.lembrete_horario))) throw new ErroUsuario('Horário do lembrete inválido (use HH:MM).');
  if (mudancas.regra_votacao && ['maioria', 'maioria_mais_pais'].indexOf(mudancas.regra_votacao) < 0) throw new ErroUsuario('Regra de votação inválida.');
  const antes = ctx.config || {};
  const cfg = salvarConfigChaves(mudancas);
  const mudouRotina = CHAVES_ROTINAS.some((k) => mudancas[k] !== undefined && String(paraBooleano(mudancas[k])) + String(mudancas[k]) !== String(paraBooleano(antes[k])) + String(antes[k]));
  if (mudouRotina) {
    try { instalarGatilhosRotinas(cfg); } catch (e) { console.warn('Não reinstalei os gatilhos das rotinas: ' + e.message); }
  }
  return cfg;
}

// ---------- Arquivos de identidade ----------

/** enviar_arquivo (Adulto): salva imagem em Identidade da Família ou Projetos e Sonhos. */
function acaoEnviarArquivo(p) {
  const pastaNome = p.pasta === 'Projetos e Sonhos' ? 'Projetos e Sonhos' : 'Identidade da Família';
  const base64 = String(p.imagem_base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!base64) throw new ErroUsuario('Nenhum arquivo recebido.');
  const mime = String(p.mime || 'image/jpeg');
  if (!/^image\//.test(mime)) throw new ErroUsuario('Envie uma imagem (JPG, PNG, WEBP ou SVG).');
  const nome = String(p.nome_arquivo || ('imagem_' + Date.now())).replace(/[^\w.\- ]/g, '');
  const arquivo = pastaPorCaminho(pastaNome).createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, nome));
  compartilharComLink(arquivo);
  return { url: urlVisualizacao(arquivo.getId()), id: arquivo.getId() };
}

/**
 * salvar_brasao_svg (Administrador): salva o SVG em Identidade da Família e grava url_brasao na Config.
 * Gerar PNG a partir de SVG não é viável no Apps Script (não há rasterizador), então os ícones
 * 192/512 apontam para o MESMO SVG — o app usa SVG no manifest e o service worker cuida do resto.
 */
function acaoSalvarBrasaoSvg(p) {
  const svg = String(p.svg || '').trim();
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new ErroUsuario('O brasão precisa ser um SVG válido.');
  if (/<script/i.test(svg)) throw new ErroUsuario('O SVG não pode conter scripts.');
  const pasta = pastaPorCaminho('Identidade da Família');
  // Substitui o brasão anterior (mantém só um arquivo com esse nome).
  const antigos = pasta.getFilesByName('brasao.svg');
  while (antigos.hasNext()) antigos.next().setTrashed(true);
  const arquivo = pasta.createFile(Utilities.newBlob(svg, 'image/svg+xml', 'brasao.svg'));
  compartilharComLink(arquivo);
  const url = urlVisualizacao(arquivo.getId());
  salvarConfigChaves({ url_brasao: url });
  return { url_brasao: url, url_icone_192: url, url_icone_512: url };
}

// ==============================================================================
// lancamentos.gs
// ==============================================================================

/**
 * lancamentos.gs — Lançamentos, resumo do mês, painel, orçamento, cardápio (tipos/grupos/categorias),
 * regras de loja, previstos das contas fixas, mesada, exportação e log.
 *
 * Regras de negócio (iguais às do modo demonstração em app/src/api/mock.ts):
 *  - competência = mês da data; compra parcelada usa o fechamento do cartão (util.distribuirParcelas);
 *  - soft delete (excluido = S) com desfazer;
 *  - Dependente só vê/edita os próprios lançamentos e nunca categorias sensíveis;
 *  - aportes em projetos (c_aporte_projeto) NÃO contam como despesa (ehDespesaReal);
 *  - hash_dedup calculado quando não vem do app;
 *  - classificação aprende: `aprender_loja` grava a loja → categoria em RegrasLoja.
 *
 * As funções calcularResumoMes/calcularPainel são puras (recebem os dados já lidos) para poderem
 * ser testadas fora do Apps Script.
 */

const FORMAS_PGTO = ['dinheiro', 'pix', 'débito', 'crédito', 'boleto'];

// ---------- Leitura agrupada dos dados ----------

/** Tipos (aba Tipos; se a planilha ainda não tiver a aba preenchida, usa os dados iniciais). */
function lerTipos() {
  const lista = lerAba('Tipos');
  return (lista.length ? lista : dadosIniciaisTipos()).slice().sort((a, b) => a.ordem - b.ordem);
}

/**
 * Lê tudo o que as regras de negócio precisam, de uma vez (todas as abas são cacheadas).
 * O objeto devolvido é o "banco" que as funções puras recebem.
 */
function carregarDados() {
  return {
    config: lerConfig(),
    usuarios: lerAba('Usuarios'),
    tipos: lerTipos(),
    grupos: lerAba('Grupos'),
    categorias: lerAba('Categorias'),
    regras_loja: lerAba('RegrasLoja'),
    lancamentos: lancamentosAtivos(),
    contas_fixas: lerAba('ContasFixas'),
    contas_a_pagar: lerAba('ContasAPagar'),
    cartoes: lerAba('Cartoes'),
    caixa_entrada: lerAba('CaixaEntrada'),
    orcamento: lerAba('Orcamento'),
    projetos: lerAba('Projetos'),
    aportes: lerAba('Aportes'),
    decisoes: lerAba('Decisoes'),
    votos: lerAba('Votos'),
    alertas: lerAba('Alertas'),
    avisos: lerAba('Avisos'),
  };
}

/** Mapa id → objeto. */
function indexarPorId(lista) {
  const m = {};
  (lista || []).forEach((x) => { m[x.id] = x; });
  return m;
}

/** Opções de visibilidade derivadas do contexto (para as funções puras). */
function visaoDe(ctx) {
  return { ver_sensivel: dependenteVeSensivel(ctx), uid: ctx.uid, dependente: !!ctx.ehDependente };
}

/** Lançamentos confirmados visíveis conforme a visão (filtra sensíveis). Função pura. */
function lancamentosVisiveis(d, visao) {
  let ls = d.lancamentos.filter((l) => !l.excluido);
  if (!visao || visao.ver_sensivel !== false) return ls;
  const sensiveis = d.categorias.filter((c) => c.sensivel).map((c) => c.id);
  return ls.filter((l) => sensiveis.indexOf(l.categoria_id) < 0);
}

// ---------- Bootstrap ----------

/** bootstrap: tudo que o app precisa para abrir (uma chamada só). */
function acaoBootstrap(p, ctx) {
  const d = carregarDados();
  const pendentes = d.caixa_entrada.filter((c) => c.status === 'pendente' && (!ctx.ehDependente || c.usuario_id === ctx.uid)).length;
  return {
    config: ctx.config,
    usuario: usuarioPublico(ctx.usuario, true),
    usuarios: d.usuarios.map((u) => usuarioPublico(u, ctx.ehAdmin || u.id === ctx.uid)),
    tipos: d.tipos,
    grupos: d.grupos.filter((g) => g.ativo !== false).slice().sort((a, b) => a.ordem - b.ordem),
    categorias: categoriasVisiveis(ctx),
    regras_loja: d.regras_loja,
    cartoes: d.cartoes.map(cartaoPublico),
    contas_fixas: d.contas_fixas,
    projetos: d.projetos.map((pr) => comProjetoCalculado(d, pr)),
    versiculo_do_dia: versiculoDoDia(),
    pendentes_caixa: pendentes,
  };
}

// ---------- Resumo do mês ----------

/**
 * ResumoMes de uma competência (função pura).
 * @param d dados (carregarDados)
 * @param visao { ver_sensivel, uid, dependente }
 * @param comp "AAAA-MM"
 * @param filtroUsuario usuario_id para filtrar (opcional)
 */
function calcularResumoMes(d, visao, comp, filtroUsuario) {
  let ls = lancamentosVisiveis(d, visao).filter((l) => l.competencia === comp && l.status === 'confirmado');
  if (filtroUsuario) ls = ls.filter((l) => l.usuario_id === filtroUsuario);
  const catMap = indexarPorId(d.categorias);
  const r = { competencia: comp, entrou: 0, saiu: 0, sobrou: 0, por_tipo: {}, projetos: { guardado_total: 0, percentual_medio: 0, ativos: 0 }, por_grupo: {}, por_categoria: {}, por_usuario: {} };
  d.tipos.forEach((t) => { r.por_tipo[t.id] = { realizado: 0, orcado: 0 }; });
  d.grupos.forEach((g) => { r.por_grupo[g.id] = { realizado: 0, orcado: 0 }; });
  const garantirTipo = (id) => { if (id && !r.por_tipo[id]) r.por_tipo[id] = { realizado: 0, orcado: 0 }; };
  const garantirGrupo = (id) => { if (id && !r.por_grupo[id]) r.por_grupo[id] = { realizado: 0, orcado: 0 }; };

  d.orcamento.filter((o) => o.competencia === comp).forEach((o) => {
    const c = catMap[o.categoria_id];
    if (c && c.sensivel && visao && visao.ver_sensivel === false) return;
    r.por_categoria[o.categoria_id] = { realizado: 0, orcado: o.valor_planejado };
    if (c) {
      garantirGrupo(c.grupo_id); garantirTipo(c.tipo_id);
      if (c.grupo_id) r.por_grupo[c.grupo_id].orcado += o.valor_planejado;
      if (c.tipo_id) r.por_tipo[c.tipo_id].orcado += o.valor_planejado;
    }
  });
  // Receita prevista = receitas confirmadas do mês anterior (ou média dos 3 anteriores).
  const todas = lancamentosVisiveis(d, visao).filter((l) => l.tipo === 'receita' && l.status === 'confirmado');
  const recAnt = somar(todas.filter((l) => l.competencia === somarMeses(comp, -1)), (l) => l.valor);
  const rec3 = media([1, 2, 3].map((k) => somar(todas.filter((l) => l.competencia === somarMeses(comp, -k)), (l) => l.valor)));
  garantirTipo(TIPO_RECEITAS);
  r.por_tipo[TIPO_RECEITAS].orcado = arredondar(recAnt || rec3);

  ls.forEach((l) => {
    const c = catMap[l.categoria_id];
    if (!c) return;
    if (l.tipo === 'receita') r.entrou += l.valor;
    else if (ehDespesaReal(c)) r.saiu += l.valor;
    garantirTipo(c.tipo_id); garantirGrupo(c.grupo_id);
    if (c.tipo_id) r.por_tipo[c.tipo_id].realizado += l.valor;
    if (c.grupo_id) r.por_grupo[c.grupo_id].realizado += l.valor; // categoria sem grupo (planilha editada à mão) não derruba o resumo
    r.por_categoria[c.id] = r.por_categoria[c.id] || { realizado: 0, orcado: 0 };
    r.por_categoria[c.id].realizado += l.valor;
    if (ehDespesaReal(c)) r.por_usuario[l.usuario_id] = (r.por_usuario[l.usuario_id] || 0) + l.valor;
  });
  r.entrou = arredondar(r.entrou); r.saiu = arredondar(r.saiu); r.sobrou = arredondar(r.entrou - r.saiu);
  Object.keys(r.por_tipo).forEach((k) => { r.por_tipo[k].realizado = arredondar(r.por_tipo[k].realizado); r.por_tipo[k].orcado = arredondar(r.por_tipo[k].orcado); });
  Object.keys(r.por_grupo).forEach((k) => { r.por_grupo[k].realizado = arredondar(r.por_grupo[k].realizado); r.por_grupo[k].orcado = arredondar(r.por_grupo[k].orcado); });
  Object.keys(r.por_categoria).forEach((k) => { r.por_categoria[k].realizado = arredondar(r.por_categoria[k].realizado); });
  Object.keys(r.por_usuario).forEach((k) => { r.por_usuario[k] = arredondar(r.por_usuario[k]); });

  // Card Projetos: total guardado, % médio das metas e quantidade de ativos.
  const ativosP = d.projetos.filter((pr) => pr.status === 'ativo');
  const guardado = somar(d.projetos.filter((pr) => pr.status !== 'pausado'), (pr) => valorAtualProjeto(d, pr));
  r.projetos = {
    guardado_total: arredondar(guardado),
    percentual_medio: ativosP.length ? Math.round(somar(ativosP, (pr) => Math.min(100, (valorAtualProjeto(d, pr) / (pr.meta_valor || 1)) * 100)) / ativosP.length) : 0,
    ativos: ativosP.length,
  };
  r.por_tipo[TIPO_PROJETOS] = { realizado: arredondar(guardado), orcado: 0 };
  return r;
}

function acaoResumoMes(p, ctx) {
  const d = carregarDados();
  return calcularResumoMes(d, visaoDe(ctx), String(p.competencia || competenciaDe()), p.usuario_id_filtro ? String(p.usuario_id_filtro) : '');
}

// ---------- Painel ----------

/**
 * DadosPainel de um ano (função pura). Meses futuros são previstos: receitas = média dos 3 últimos
 * meses reais (salário de dezembro × 1,5 pelo 13º), despesas = orçamento da competência atual.
 */
function calcularPainel(d, visao, ano, filtroUsuario, hoje) {
  const catMap = indexarPorId(d.categorias);
  const compAtual = (hoje || hojeIso()).slice(0, 7);
  const todos = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado' && (!filtroUsuario || l.usuario_id === filtroUsuario));
  const orcAtual = d.orcamento.filter((o) => o.competencia === compAtual);
  const comps3 = [1, 2, 3].map((k) => somarMeses(compAtual, -k));
  const base3 = todos.filter((l) => comps3.indexOf(l.competencia) >= 0);
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const comp = ano + '-' + zeros(m);
    const futuro = comp > compAtual;
    const item = { competencia: comp, saldo: 0, receitas: 0, despesas: 0, salarios: 0, outras_receitas: 0, previsto: futuro, por_tipo: {}, por_grupo_analise: {}, por_grupo: {}, por_categoria: {}, por_usuario: {} };
    if (futuro) {
      item.salarios = Math.round(somar(base3.filter((l) => l.tipo === 'receita' && l.categoria_id === 'c_salario'), (l) => l.valor) / 3);
      item.outras_receitas = Math.round(somar(base3.filter((l) => l.tipo === 'receita' && l.categoria_id !== 'c_salario'), (l) => l.valor) / 3);
      if (m === 12) item.salarios = Math.round(item.salarios * 1.5);
      item.receitas = item.salarios + item.outras_receitas;
      orcAtual.forEach((o) => {
        const c = catMap[o.categoria_id];
        if (!ehDespesaReal(c)) return;
        if (c.sensivel && visao && visao.ver_sensivel === false) return;
        item.despesas += o.valor_planejado;
        item.por_tipo[c.tipo_id] = (item.por_tipo[c.tipo_id] || 0) + o.valor_planejado;
        item.por_grupo_analise[c.grupo_analise] = (item.por_grupo_analise[c.grupo_analise] || 0) + o.valor_planejado;
      });
    } else {
      todos.filter((l) => l.competencia === comp).forEach((l) => {
        const c = catMap[l.categoria_id];
        if (!c) return;
        if (l.tipo === 'receita') {
          item.receitas += l.valor;
          if (c.id === 'c_salario' || c.subgrupo === 'Salários') item.salarios += l.valor; else item.outras_receitas += l.valor;
        } else if (ehDespesaReal(c)) {
          item.despesas += l.valor;
          item.por_tipo[c.tipo_id] = (item.por_tipo[c.tipo_id] || 0) + l.valor;
          item.por_grupo_analise[c.grupo_analise || 'Outros'] = (item.por_grupo_analise[c.grupo_analise || 'Outros'] || 0) + l.valor;
          item.por_grupo[c.grupo_id] = (item.por_grupo[c.grupo_id] || 0) + l.valor;
          item.por_categoria[c.id] = (item.por_categoria[c.id] || 0) + l.valor;
          item.por_usuario[l.usuario_id] = (item.por_usuario[l.usuario_id] || 0) + l.valor;
        }
      });
    }
    ['receitas', 'despesas', 'salarios', 'outras_receitas'].forEach((k) => { item[k] = arredondar(item[k]); });
    ['por_tipo', 'por_grupo_analise', 'por_grupo', 'por_categoria', 'por_usuario'].forEach((k) => Object.keys(item[k]).forEach((id) => { item[k][id] = arredondar(item[k][id]); }));
    item.saldo = arredondar(item.receitas - item.despesas);
    meses.push(item);
  }
  const orcado = {};
  orcAtual.forEach((o) => { orcado[o.categoria_id] = o.valor_planejado; });
  const poupanca = [];
  let acumulado = somar(d.projetos, (pr) => pr.valor_inicial) + somar(d.aportes.filter((a) => String(a.data) < ano + '-01-01'), (a) => a.valor);
  for (let m = 1; m <= 12; m++) {
    const comp = ano + '-' + zeros(m);
    acumulado += somar(d.aportes.filter((a) => String(a.data).slice(0, 7) === comp), (a) => a.valor);
    poupanca.push({ competencia: comp, total: arredondar(acumulado) });
  }
  return { ano: Number(ano), meses, orcado_por_categoria: orcado, poupanca_projetos: poupanca };
}

/** painel (Adulto): 12 meses de um ano. */
function acaoPainel(p, ctx) {
  const d = carregarDados();
  return calcularPainel(d, visaoDe(ctx), Number(p.ano) || new Date().getFullYear(), p.usuario_id_filtro ? String(p.usuario_id_filtro) : '');
}

// ---------- Lançamentos ----------

/** listar_lancamentos: filtros opcionais; Dependente só vê os próprios e os aportes nos projetos. */
function acaoListarLancamentos(p, ctx) {
  let ls = filtrarSensivel(ctx, lancamentosAtivos());
  if (ctx.ehDependente) ls = ls.filter((l) => l.usuario_id === ctx.uid || l.categoria_id === CATEGORIA_APORTE || l.categoria_id === CATEGORIA_APORTE_ANTIGA);
  const categorias = lerAba('Categorias');
  const porCategorias = (filtro) => { const ids = categorias.filter(filtro).map((c) => c.id); ls = ls.filter((l) => ids.indexOf(l.categoria_id) >= 0); };
  if (p.competencia) ls = ls.filter((l) => l.competencia === p.competencia);
  if (p.categoria_id) ls = ls.filter((l) => l.categoria_id === p.categoria_id);
  if (p.grupo_id) porCategorias((c) => c.grupo_id === p.grupo_id);
  if (p.tipo_id) porCategorias((c) => c.tipo_id === p.tipo_id);
  if (p.grupo_analise) porCategorias((c) => c.grupo_analise === p.grupo_analise);
  if (p.usuario_id_filtro) ls = ls.filter((l) => l.usuario_id === p.usuario_id_filtro);
  if (p.status) ls = ls.filter((l) => l.status === p.status);
  return ls.slice().sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)).map(lancamentoPublico);
}

/** Remove o `_linha` e normaliza tipos para devolver ao app. */
function lancamentoPublico(l) {
  const o = Object.assign({}, l);
  o.valor = arredondar(o.valor);
  o.excluido = !!o.excluido;
  return o;
}

/** Valida e completa um lançamento vindo do app. */
function prepararLancamento(l, ctx) {
  const data = normalizarDataIso(l.data || hojeIso());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroUsuario('Data inválida.');
  const valor = lerValor(l.valor);
  if (!(valor > 0)) throw new ErroUsuario('Informe um valor maior que zero.');
  if (!l.categoria_id) throw new ErroUsuario('Escolha uma categoria.');
  const categoria = buscarPorId('Categorias', l.categoria_id);
  if (!categoria) throw new ErroUsuario('Categoria não encontrada.');
  if (ctx.ehDependente && categoria.sensivel && !dependenteVeSensivel(ctx)) throw new ErroUsuario('Sem permissão');
  const cartao = l.cartao_id ? buscarPorId('Cartoes', l.cartao_id) : null;
  const usuarioId = ctx.ehDependente ? ctx.uid : (l.usuario_id || ctx.uid);
  return semUndefined({
    id: l.id || gerarId('l'),
    data,
    competencia: l.competencia || competenciaDe(data),
    tipo: l.tipo === 'receita' ? 'receita' : (l.tipo || categoria.tipo || 'despesa'),
    valor,
    categoria_id: l.categoria_id,
    descricao: String(l.descricao || categoria.nome || '').trim(),
    estabelecimento: String(l.estabelecimento || '').trim(),
    forma_pgto: FORMAS_PGTO.indexOf(l.forma_pgto) >= 0 ? l.forma_pgto : 'pix',
    cartao_id: l.cartao_id || '',
    parcela: l.parcela || '',
    usuario_id: usuarioId,
    origem: l.origem || 'manual',
    anexo_url: l.anexo_url || '',
    status: l.status === 'a_confirmar' ? 'a_confirmar' : 'confirmado',
    hash_dedup: l.hash_dedup || hashDedup(valor, data, cartao ? cartao.final : '', l.estabelecimento || l.descricao || ''),
    criado_em: l.criado_em || agoraIso(),
    editado_por: l.id ? ctx.uid : '',
    excluido: false,
    projeto_id: l.projeto_id || '',
  });
}

/** salvar_lancamento: novo (com parcelas opcionais) ou edição. `aprender_loja` grava a regra da loja. */
function acaoSalvarLancamento(p, ctx) {
  const l = p.lancamento;
  if (!l || typeof l !== 'object') throw new ErroUsuario('Lançamento não informado.');
  const existente = l.id ? buscarPorId('Lancamentos', l.id) : null;
  if (l.id && !existente) throw new ErroUsuario('Lançamento não encontrado');
  if (existente && ctx.ehDependente && existente.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');

  const novo = prepararLancamento(l, ctx);
  const parcelas = Number(p.parcelas || 0);
  let lista;
  if (existente) {
    lista = [atualizarPorId('Lancamentos', existente.id, Object.assign(novo, { criado_em: existente.criado_em || novo.criado_em }))];
  } else {
    const cartao = novo.cartao_id ? buscarPorId('Cartoes', novo.cartao_id) : null;
    const criar = parcelas > 1 ? distribuirParcelas(novo, parcelas, cartao) : [novo];
    lista = inserirLinhas('Lancamentos', criar);
    // Aporte em projeto lançado direto pelo cardápio/assistente.
    if (novo.projeto_id) {
      inserirLinhas('Aportes', criar.map((c) => ({ id: gerarId('a'), projeto_id: c.projeto_id, data: c.data, valor: c.valor, usuario_id: c.usuario_id, observacao: c.descricao })));
      verificarMetaProjeto(novo.projeto_id);
    }
  }
  if (paraBooleano(p.aprender_loja) && novo.estabelecimento) {
    try { aprenderLoja(novo.estabelecimento, novo.categoria_id, ctx.uid); } catch (e) { console.warn('Não gravei a regra da loja: ' + e.message); }
  }
  return lista.map(lancamentoPublico);
}

/** excluir_lancamento: soft delete. Dependente só os próprios. */
function acaoExcluirLancamento(p, ctx) {
  const l = buscarPorId('Lancamentos', String(p.id || ''));
  if (!l) throw new ErroUsuario('Lançamento não encontrado');
  if (ctx.ehDependente && l.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  atualizarPorId('Lancamentos', l.id, { excluido: true, editado_por: ctx.uid });
  return { id: l.id };
}

/** desfazer_exclusao: volta o lançamento. */
function acaoDesfazerExclusao(p, ctx) {
  const l = buscarPorId('Lancamentos', String(p.id || ''));
  if (!l) throw new ErroUsuario('Lançamento não encontrado');
  if (ctx.ehDependente && l.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  return lancamentoPublico(atualizarPorId('Lancamentos', l.id, { excluido: false, editado_por: ctx.uid }));
}

// ---------- Cardápio: categorias e grupos ----------

function acaoListarCategorias(p, ctx) {
  return lerAba('Categorias').filter((c) => dependenteVeSensivel(ctx) || !c.sensivel);
}

/** salvar_categoria (Administrador): herda tipo_id, cor e grupo_analise do grupo; ícone é nome Lucide. */
function acaoSalvarCategoria(p) {
  const c = p.categoria || {};
  if (!c.nome) throw new ErroUsuario('A categoria precisa de um nome.');
  const grupo = c.grupo_id ? buscarPorId('Grupos', c.grupo_id) : null;
  if (!grupo) throw new ErroUsuario('Escolha o grupo da categoria.');
  const existente = c.id ? buscarPorId('Categorias', c.id) : null;
  const nova = {
    id: c.id || gerarId('c'), tipo_id: grupo.tipo_id || c.tipo_id || TIPO_VARIAVEIS, grupo_id: grupo.id, nome: String(c.nome).trim(),
    icone: String(c.icone || 'tag').trim().toLowerCase(), cor: c.cor || grupo.cor || 'indigo',
    tipo: (grupo.tipo_id || c.tipo_id) === TIPO_RECEITAS ? 'receita' : 'despesa', fixa: paraBooleano(c.fixa), orcamento_mensal: lerValor(c.orcamento_mensal),
    palavras_chave: String(c.palavras_chave || ''), grupo_analise: c.grupo_analise || grupo.grupo_analise || 'Outros',
    sensivel: c.sensivel === undefined ? !!(existente && existente.sensivel) : paraBooleano(c.sensivel),
    oculta_cardapio: c.oculta_cardapio === undefined ? !!(existente && existente.oculta_cardapio) : paraBooleano(c.oculta_cardapio),
    ativa: c.ativa === undefined ? true : paraBooleano(c.ativa),
  };
  return salvarPorId('Categorias', nova);
}

/** salvar_grupo (Administrador): só dentro dos 3 tipos (Receitas, Fixas, Variáveis). */
function acaoSalvarGrupo(p) {
  const g = p.grupo || {};
  if (!g.nome) throw new ErroUsuario('O grupo precisa de um nome.');
  const existente = g.id ? buscarPorId('Grupos', g.id) : null;
  const tipoId = g.tipo_id || (existente ? existente.tipo_id : '');
  if (TIPOS_COM_GRUPOS.indexOf(tipoId) < 0) throw new ErroUsuario('Novos grupos só dentro dos 3 tipos.');
  const novo = {
    id: g.id || gerarId('g'), tipo_id: tipoId, nome: String(g.nome).trim(), cor: g.cor || (existente ? existente.cor : 'indigo'),
    grupo_analise: g.grupo_analise || (existente ? existente.grupo_analise : 'Outros'),
    ordem: Number(g.ordem) || (existente ? existente.ordem : lerAba('Grupos').length + 1),
    ativo: g.ativo === undefined ? true : paraBooleano(g.ativo),
  };
  return salvarPorId('Grupos', novo);
}

// ---------- Regras de loja (classificação que aprende) ----------

/** Procura a regra de uma loja (função pura): a loja normalizada contém a chave da regra. */
function regraDaLoja(estabelecimento, regras) {
  const chave = normalizar(estabelecimento);
  if (!chave) return null;
  let melhor = null;
  (regras || []).forEach((r) => {
    const k = String(r.loja_normalizada || '');
    if (k && (chave === k || chave.indexOf(k) >= 0) && (!melhor || k.length > melhor.loja_normalizada.length)) melhor = r;
  });
  return melhor;
}

/** Aplica a regra de loja a uma lista de sugestões (função pura): a categoria aprendida vai para o 1º lugar. */
function aplicarRegraLoja(estabelecimento, sugestoes, regras) {
  const r = regraDaLoja(estabelecimento, regras);
  if (!r) return (sugestoes || []).slice();
  return [r.categoria_id].concat((sugestoes || []).filter((id) => id !== r.categoria_id)).slice(0, 6);
}

/** Grava/atualiza a regra "esta loja cai nesta categoria". */
function aprenderLoja(loja, categoriaId, uid) {
  const chave = normalizar(loja);
  if (!chave) throw new ErroUsuario('Loja vazia');
  if (!categoriaId || !buscarPorId('Categorias', categoriaId)) throw new ErroUsuario('Categoria não encontrada.');
  const existente = lerAba('RegrasLoja').find((r) => r.loja_normalizada === chave);
  if (existente) return atualizarPorId('RegrasLoja', existente.id, { categoria_id: categoriaId, acertos: (Number(existente.acertos) || 0) + 1 });
  return inserirLinhas('RegrasLoja', [{ id: gerarId('rl'), loja_normalizada: chave, categoria_id: categoriaId, criado_por: uid || '', criado_em: agoraIso(), acertos: 1 }])[0];
}

function acaoListarRegrasLoja() {
  return lerAba('RegrasLoja');
}

/** salvar_regra_loja: chamado quando o usuário corrige a categoria sugerida. */
function acaoSalvarRegraLoja(p, ctx) {
  return aprenderLoja(String(p.loja || ''), String(p.categoria_id || ''), ctx.uid);
}

// ---------- Orçamento ----------

function acaoListarOrcamento(p) {
  return lerAba('Orcamento').filter((o) => o.competencia === p.competencia).map((o) => ({ competencia: o.competencia, categoria_id: o.categoria_id, valor_planejado: o.valor_planejado }));
}

/** salvar_orcamento: substitui todos os itens da competência. */
function acaoSalvarOrcamento(p) {
  const comp = String(p.competencia || '');
  if (!/^\d{4}-\d{2}$/.test(comp)) throw new ErroUsuario('Competência inválida (use AAAA-MM).');
  const itens = (p.itens || []).map((i) => ({ competencia: comp, categoria_id: i.categoria_id, valor_planejado: lerValor(i.valor_planejado) })).filter((i) => i.categoria_id);
  const outros = lerAba('Orcamento').filter((o) => o.competencia !== comp);
  substituirAba('Orcamento', outros.concat(itens));
  return itens;
}

/** copiar_orcamento: copia os itens de `de` para `para` (substituindo os de `para`). */
function acaoCopiarOrcamento(p) {
  const de = String(p.de || ''), para = String(p.para || '');
  if (!de || !para) throw new ErroUsuario('Informe as competências de origem e destino.');
  const todos = lerAba('Orcamento');
  const copiados = todos.filter((o) => o.competencia === de).map((o) => ({ competencia: para, categoria_id: o.categoria_id, valor_planejado: o.valor_planejado }));
  substituirAba('Orcamento', todos.filter((o) => o.competencia !== para).concat(copiados));
  return copiados;
}

// ---------- Previstos das contas fixas (gatilho diário 06h) ----------

/**
 * Cria, para o mês atual, um lançamento "a_confirmar" por conta fixa ativa, com o valor previsto.
 * Idempotente: usa hash_dedup "previsto_<conta>_<competência>". Quando a conta é paga
 * (marcar_conta_paga), o previsto é marcado como excluído.
 * Também garante o orçamento do mês (copia o anterior ou usa o orcamento_mensal das categorias).
 */
function gerarPrevistosDoMes(competencia) {
  // Quando roda pelo gatilho, o 1º argumento é o objeto do evento — por isso a checagem do formato.
  const comp = typeof competencia === 'string' && /^\d{4}-\d{2}$/.test(competencia) ? competencia : competenciaDe();
  const existentes = {};
  lerAba('Lancamentos').forEach((l) => { if (l.hash_dedup) existentes[l.hash_dedup] = true; });
  const admin = lerAba('Usuarios').find((u) => normalizarPerfil(u.perfil) === 'Administrador' && u.ativo);
  const novos = [];
  lerAba('ContasFixas').filter((cf) => cf.ativa).forEach((cf) => {
    const hash = 'previsto_' + cf.id + '_' + comp;
    if (existentes[hash]) return;
    const dia = Math.min(Number(cf.dia_vencimento) || 10, ultimoDiaDoMes(comp));
    novos.push({
      id: gerarId('l'), data: comp + '-' + zeros(dia), competencia: comp, tipo: 'despesa', valor: cf.valor_previsto,
      categoria_id: cf.categoria_id, descricao: cf.nome + ' (previsto)', estabelecimento: cf.nome, forma_pgto: 'boleto',
      cartao_id: '', parcela: '', usuario_id: admin ? admin.id : '', origem: 'recorrente', anexo_url: '', status: 'a_confirmar',
      hash_dedup: hash, criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: '',
    });
  });
  if (novos.length) inserirLinhas('Lancamentos', novos);
  garantirOrcamentoDoMes(comp);
  console.log('gerarPrevistosDoMes: ' + novos.length + ' previsto(s) criado(s) para ' + comp);
  return novos.length;
}

/** Se a competência não tem orçamento, copia o do mês anterior (ou o orcamento_mensal das categorias). */
function garantirOrcamentoDoMes(comp) {
  const todos = lerAba('Orcamento');
  if (todos.some((o) => o.competencia === comp)) return 0;
  let itens = todos.filter((o) => o.competencia === somarMeses(comp, -1)).map((o) => ({ competencia: comp, categoria_id: o.categoria_id, valor_planejado: o.valor_planejado }));
  if (!itens.length) itens = lerAba('Categorias').filter((c) => c.ativa && c.orcamento_mensal > 0).map((c) => ({ competencia: comp, categoria_id: c.id, valor_planejado: c.orcamento_mensal }));
  if (itens.length) inserirLinhas('Orcamento', itens);
  return itens.length;
}

// ---------- Mesada ----------

/** mesada: mesada do mês, quanto gastou, saldo e cofrinho (soma dos aportes do membro). */
function acaoMesada(p, ctx) {
  const alvoId = String(p.usuario_id || ctx.uid);
  if (ctx.ehDependente && alvoId !== ctx.uid) throw new ErroUsuario('Sem permissão');
  const alvo = buscarPorId('Usuarios', alvoId);
  if (!alvo) throw new ErroUsuario('Usuário não encontrado');
  const comp = String(p.competencia || competenciaDe());
  const gasto = lancamentosAtivos().filter((l) => l.usuario_id === alvo.id && l.competencia === comp && l.tipo === 'despesa' && l.categoria_id !== CATEGORIA_APORTE && l.categoria_id !== CATEGORIA_APORTE_ANTIGA).reduce((s, l) => s + l.valor, 0);
  const cofrinho = lerAba('Aportes').filter((a) => a.usuario_id === alvo.id).reduce((s, a) => s + a.valor, 0);
  const mesada = Number(alvo.mesada_mensal) || 0;
  return { mesada_mensal: mesada, gasto: arredondar(gasto), saldo: arredondar(mesada - gasto), cofrinho: arredondar(cofrinho) };
}

// ---------- Exportar ----------

/** Linhas (array de arrays) para exportação, com nomes legíveis. */
function linhasParaExportar(competencia) {
  const catMap = {}, userMap = {};
  lerAba('Categorias').forEach((c) => { catMap[c.id] = c.nome; });
  lerAba('Usuarios').forEach((u) => { userMap[u.id] = u.apelido; });
  const ls = lancamentosAtivos().filter((l) => !competencia || l.competencia === competencia).sort((a, b) => (a.data < b.data ? -1 : 1));
  const linhas = [['data', 'competencia', 'tipo', 'valor', 'categoria', 'descricao', 'estabelecimento', 'forma_pgto', 'quem', 'origem', 'status', 'parcela']];
  ls.forEach((l) => linhas.push([l.data, l.competencia, l.tipo, l.valor, catMap[l.categoria_id] || l.categoria_id, l.descricao, l.estabelecimento, l.forma_pgto, userMap[l.usuario_id] || l.usuario_id, l.origem, l.status, l.parcela || '']));
  return linhas;
}

/**
 * exportar (Administrador): CSV (separador ";", vírgula decimal, com BOM para o Excel) ou XLSX
 * (planilha temporária exportada pelo Drive). O arquivo fica em Backups/Exportações com link
 * "qualquer pessoa com o link" para o celular conseguir baixar.
 */
function acaoExportar(p) {
  const formato = p.formato === 'xlsx' ? 'xlsx' : 'csv';
  const comp = p.competencia ? String(p.competencia) : '';
  const linhas = linhasParaExportar(comp);
  const nomeBase = 'Lancamentos_' + (comp || 'tudo') + '_' + hojeIso();
  const pasta = pastaPorCaminho('Backups/Exportações');
  let arquivo;
  if (formato === 'csv') {
    const csv = '\uFEFF' + linhas.map((ln) => ln.map((c) => {
      if (typeof c === 'number') return c.toFixed(2).replace('.', ',');
      const s = String(c === null || c === undefined ? '' : c);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
    arquivo = pasta.createFile(nomeBase + '.csv', csv, 'text/csv');
  } else {
    const temp = SpreadsheetApp.create(nomeBase);
    const aba = temp.getSheets()[0];
    aba.setName('Lançamentos');
    aba.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
    aba.setFrozenRows(1);
    SpreadsheetApp.flush();
    const url = 'https://docs.google.com/spreadsheets/d/' + temp.getId() + '/export?format=xlsx';
    const resposta = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resposta.getResponseCode() !== 200) throw new ErroUsuario('Não consegui gerar o arquivo Excel agora. Tente o CSV.');
    arquivo = pasta.createFile(resposta.getBlob().setName(nomeBase + '.xlsx'));
    DriveApp.getFileById(temp.getId()).setTrashed(true);
  }
  compartilharComLink(arquivo);
  return { url: urlDownload(arquivo.getId()) };
}

// ---------- Log ----------

/** log (Administrador): últimos registros, do mais novo para o mais antigo. */
function acaoLog(p) {
  const limite = Math.min(Number(p.limite) || 100, 1000);
  const aba = obterAba('Log');
  const ultima = aba.getLastRow();
  if (ultima < 2) return [];
  const inicio = Math.max(2, ultima - limite + 1);
  const valores = aba.getRange(inicio, 1, ultima - inicio + 1, 4).getValues();
  return valores.map((v) => ({ data: ehData(v[0]) ? dataHoraParaIso(v[0]) : String(v[0]), usuario_id: String(v[1]), acao: String(v[2]), detalhe: String(v[3]) })).reverse();
}

// ==============================================================================
// leitura.gs
// ==============================================================================

/**
 * leitura.gs — Leitura inteligente de cupons, contas da casa e faturas de cartão.
 *
 * Ordem de tentativa:
 *  1. API do Claude (visão para fotos, documento para PDF) — chave em Script Properties
 *     `CHAVE_API_CLAUDE`, modelo em `MODELO_CLAUDE` (padrão claude-sonnet-4-5). Pede um JSON
 *     estrito com os campos de LeituraExtraida. Custo: centavos por cupom (uma foto comprimida
 *     tem ~1.500 tokens de entrada; a resposta, ~200 tokens).
 *  2. Sem chave ou em caso de falha: OCR do Drive (converte a imagem/PDF em Google Docs com
 *     `Drive.Files.insert(..., {ocr:true})`, serviço avançado Drive v2) + regex para valor total,
 *     data, CNPJ, linha digitável, kWh/m³.
 *  3. Texto de voz/SMS: regex local primeiro (sms.gs), Claude só quando a confiança é baixa.
 *  4. NFC-e: busca a página do QR na SEFAZ e extrai total/emitente/CNPJ/data por regex.
 *
 * Os arquivos são salvos no Drive na subpasta do tipo, em AAAA/MM, e o link vai em anexo_url.
 *
 * Versão 2: os prompts recebem o cardápio (categorias ativas com ícone e grupo) e pedem o
 * `categoria_id`; depois da leitura as RegrasLoja (loja → categoria aprendida) têm prioridade.
 */

const URL_API_CLAUDE = 'https://api.anthropic.com/v1/messages';
const MODELO_CLAUDE_PADRAO = 'claude-sonnet-4-5';
const VERSAO_API_ANTHROPIC = '2023-06-01';
const MIMES_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ---------- Chamada ao Claude ----------

/** Há chave configurada? */
function claudeDisponivel() {
  return !!propriedade('CHAVE_API_CLAUDE', '');
}

/**
 * Requisição bruta ao endpoint Messages (usada pela leitura e pelo assistente com tool use).
 * Recebe o corpo completo ({model, max_tokens, system, messages, tools?}) e devolve o JSON da resposta.
 * Lança erro se não houver chave, se a API falhar ou se o modelo recusar.
 */
function requisicaoClaude(corpo) {
  const chave = propriedade('CHAVE_API_CLAUDE', '');
  if (!chave) throw new Error('CHAVE_API_CLAUDE não configurada');
  const resposta = UrlFetchApp.fetch(URL_API_CLAUDE, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': chave, 'anthropic-version': VERSAO_API_ANTHROPIC },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();
  if (codigo !== 200) throw new Error('Claude respondeu ' + codigo + ': ' + texto.slice(0, 300));
  const json = JSON.parse(texto);
  if (json.stop_reason === 'refusal') throw new Error('Claude recusou este conteúdo');
  return json;
}

/**
 * Chama o endpoint Messages com blocos de conteúdo (imagem/documento/texto) e devolve o texto.
 * Lança erro se não houver chave ou se a API falhar (quem chama decide o fallback).
 */
function chamarClaude(blocos, maxTokens, sistema) {
  const json = requisicaoClaude({
    model: propriedade('MODELO_CLAUDE', MODELO_CLAUDE_PADRAO),
    max_tokens: maxTokens || 2048,
    system: sistema || 'Você é um assistente que lê documentos financeiros brasileiros e responde SOMENTE com JSON válido, sem comentários, sem markdown.',
    messages: [{ role: 'user', content: blocos }],
  });
  return (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

/** Lista do cardápio para o prompt: "c_mercado: Supermercado (Alimentação, shopping-cart)". */
function cardapioParaPrompt(categorias, grupos) {
  const grpMap = indexarPorId(grupos || []);
  return (categorias || []).filter((c) => c.ativa !== false && !c.oculta_cardapio).map((c) => '- ' + c.id + ': ' + c.nome + ' (' + ((grpMap[c.grupo_id] || {}).nome || c.grupo_analise || '') + (c.icone ? ', ' + c.icone : '') + ')').join('\n');
}

/** Bloco de conteúdo para imagem ou PDF em base64. */
function blocoArquivo(base64, mime) {
  if (mime === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  return { type: 'image', source: { type: 'base64', media_type: MIMES_IMAGEM.indexOf(mime) >= 0 ? mime : 'image/jpeg', data: base64 } };
}

/** Pega o primeiro objeto JSON de uma resposta (tolera texto em volta ou ```json). */
function extrairJson(texto) {
  const limpo = String(texto || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(limpo); } catch (e) { /* tenta recortar */ }
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini >= 0 && fim > ini) {
    try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch (e) { /* abaixo */ }
  }
  throw new Error('Resposta do Claude não é JSON');
}

/** Prompt em português conforme o tipo do documento. `cardapio` = texto de cardapioParaPrompt(). */
function promptLeitura(tipo, contasFixas, cardapio) {
  const hoje = hojeIso();
  if (tipo === 'conta') {
    const lista = (contasFixas || []).map((c) => '- ' + c.id + ': ' + c.nome).join('\n');
    return 'Leia esta conta de consumo/boleto brasileiro e responda SOMENTE com um JSON com os campos:\n' +
      '{"empresa": string, "competencia": "AAAA-MM" (mês de referência), "vencimento": "AAAA-MM-DD", "valor": number (valor total a pagar, em reais),\n' +
      '"linha_digitavel": string (só dígitos e espaços, ou ""), "pix_copia_cola": string (código Pix "copia e cola" se houver, ou ""),\n' +
      '"consumo_valor": number ou null (kWh, m³ ou GB consumidos), "consumo_unidade": "kWh"|"m³"|"GB"|"",\n' +
      '"conta_fixa_id": string ou "" (escolha entre as contas cadastradas abaixo se for a mesma empresa), "confianca": number 0..1}\n' +
      'Contas cadastradas:\n' + (lista || '- (nenhuma)') + '\nHoje é ' + hoje + '. Use ponto como separador decimal. Não invente valores: se não souber, use null ou "".';
  }
  if (tipo === 'fatura_cartao') {
    return 'Leia esta fatura de cartão de crédito brasileira e liste TODAS as compras (não inclua pagamentos, estornos, juros nem o total).\n' +
      'Responda SOMENTE com JSON: {"compras": [{"data": "AAAA-MM-DD", "estabelecimento": string, "valor": number, "parcela": "n/m" ou null}], "confianca": number 0..1}.\n' +
      'Quando a fatura mostrar só dia/mês, deduza o ano pela data de vencimento. Hoje é ' + hoje + '. Use ponto como separador decimal.';
  }
  return 'Leia este cupom fiscal ou recibo brasileiro e responda SOMENTE com JSON:\n' +
    '{"valor": number (total pago), "data": "AAAA-MM-DD", "estabelecimento": string (nome fantasia), "cnpj": string ou "",\n' +
    '"forma_pgto": "dinheiro"|"pix"|"débito"|"crédito"|"boleto"|null, "itens": [{"nome": string, "valor": number}] (até 20 itens, ou []),\n' +
    '"descricao": string curta (ex.: "Compras no mercado"), "categoria_id": string (um id do cardápio abaixo, o que melhor descreve a compra) ou null, "confianca": number 0..1}\n' +
    'Cardápio de despesas (id: nome (grupo, ícone)):\n' + (cardapio || '- (nenhum)') + '\n' +
    'Hoje é ' + hoje + '. Use ponto como separador decimal. Não invente valores: se não souber, use null.';
}

// ---------- Fallback: OCR do Drive + regex ----------

/** Extrai texto de imagem/PDF convertendo para Google Docs com OCR (precisa do serviço avançado Drive). */
function ocrDrive(blob) {
  if (typeof Drive === 'undefined' || !Drive.Files) throw new Error('Serviço avançado Drive não ativado (OCR indisponível)');
  const nome = 'ocr_temp_' + Date.now();
  const mimeDoc = 'application/vnd.google-apps.document';
  // appsscript.json pede a v2 (Files.insert + ocr:true). Se o serviço for ativado como v3 no editor, usa Files.create.
  const arquivo = Drive.Files.insert
    ? Drive.Files.insert({ title: nome, mimeType: mimeDoc }, blob, { ocr: true, ocrLanguage: 'pt' })
    : Drive.Files.create({ name: nome, mimeType: mimeDoc }, blob, { ocrLanguage: 'pt' });
  try {
    return DocumentApp.openById(arquivo.id).getBody().getText();
  } finally {
    try { Drive.Files.remove(arquivo.id); } catch (e) { try { DriveApp.getFileById(arquivo.id).setTrashed(true); } catch (e2) { /* ignora */ } }
  }
}

/** Regex sobre o texto do OCR (função pura). */
function extrairDeTextoOcr(texto, tipo) {
  const t = String(texto || '');
  const r = { confianca: 0.4, origem_leitura: 'ocr_drive' };
  const valores = [];
  const re = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
  let m;
  while ((m = re.exec(t)) !== null) valores.push(lerValor(m[1]));
  const total = t.match(/(?:VALOR\s+(?:TOTAL|A\s+PAGAR|DO\s+DOCUMENTO)|TOTAL(?:\s+R\$)?|TOTAL\s+A\s+PAGAR)\s*:?\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (total) r.valor = lerValor(total[1]);
  else if (valores.length) r.valor = Math.max.apply(null, valores);
  const datas = t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/g) || [];
  const venc = t.match(/VENCIMENTO\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const cnpj = t.match(/CNPJ\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
  if (cnpj) r.cnpj = cnpj[1];
  const linha = t.match(/(\d{5}[.\s]?\d{5}\s?\d{5}[.\s]?\d{6}\s?\d{5}[.\s]?\d{6}\s?\d\s?\d{14})/) || t.match(/((?:\d{11}[\s.-]?\d[\s.-]?){4})/);
  if (linha) r.linha_digitavel = linha[1].replace(/[^\d]/g, ' ').replace(/\s+/g, ' ').trim();
  const kwh = t.match(/(\d+(?:[.,]\d+)?)\s*kWh/i);
  const m3 = t.match(/(\d+(?:[.,]\d+)?)\s*m\s?[³3]\b/i);
  const gb = t.match(/(\d+(?:[.,]\d+)?)\s*GB\b/i);
  if (kwh) { r.consumo_valor = lerValor(kwh[1]); r.consumo_unidade = 'kWh'; }
  else if (m3) { r.consumo_valor = lerValor(m3[1]); r.consumo_unidade = 'm³'; }
  else if (gb) { r.consumo_valor = lerValor(gb[1]); r.consumo_unidade = 'GB'; }
  const pix = t.match(/(000201[0-9A-Za-z.\-*\s]{40,})/);
  if (pix) r.pix_copia_cola = pix[1].replace(/\s+/g, '');
  if (tipo === 'conta') {
    if (venc) r.vencimento = normalizarDataIso(venc[1]);
    else if (datas.length) r.vencimento = normalizarDataIso(datas[datas.length - 1]);
    const ref = t.match(/(?:REFER[ÊE]NCIA|M[ÊE]S\s+DE\s+REFER[ÊE]NCIA|COMPET[ÊE]NCIA)\s*:?\s*(\d{2})\/(\d{4})/i);
    r.competencia = ref ? ref[2] + '-' + ref[1] : (r.vencimento ? competenciaDe(r.vencimento) : competenciaDe());
    const primeiraLinha = t.split('\n').map((s) => s.trim()).filter((s) => s.length > 3)[0] || '';
    r.empresa = primeiraLinha.slice(0, 60);
  } else {
    if (datas.length) r.data = normalizarDataIso(datas[0]);
    const primeiraLinha = t.split('\n').map((s) => s.trim()).filter((s) => s.length > 3 && !/CNPJ|CUPOM|NOTA/i.test(s))[0] || '';
    r.estabelecimento = primeiraLinha.slice(0, 60);
    r.forma_pgto = extrairFormaPgto(t);
  }
  if (r.valor) r.confianca = 0.55;
  return semUndefined(r);
}

// ---------- Casamento com contas fixas e categorias ----------

/** Procura a conta fixa pelo id sugerido, pelo remetente/palavras-chave ou pelo nome da empresa. */
function casarContaFixa(leitura, textoExtra) {
  const contas = lerAba('ContasFixas').filter((c) => c.ativa);
  if (leitura.conta_fixa_id && contas.some((c) => c.id === leitura.conta_fixa_id)) return contas.find((c) => c.id === leitura.conta_fixa_id);
  const texto = normalizar([leitura.empresa, leitura.estabelecimento, textoExtra].filter(Boolean).join(' '));
  const categorias = lerAba('Categorias');
  let melhor = null, melhorPontos = 0;
  contas.forEach((c) => {
    let pontos = 0;
    const nomeNorm = normalizar(c.nome);
    nomeNorm.split(' ').filter((w) => w.length > 3).forEach((w) => { if (texto.indexOf(w) >= 0) pontos += 2; });
    const dominio = normalizar(String(c.remetente_email || '').split('@').pop().split('.')[0]);
    if (dominio && dominio.length > 3 && texto.indexOf(dominio) >= 0) pontos += 3;
    if (c.codigo_cliente && texto.indexOf(normalizar(c.codigo_cliente)) >= 0) pontos += 4;
    const cat = categorias.find((k) => k.id === c.categoria_id);
    if (cat) String(cat.palavras_chave || '').split(';').map(normalizar).filter(Boolean).forEach((pc) => { if (texto.indexOf(pc) >= 0) pontos += 2; });
    if (pontos > melhorPontos) { melhor = c; melhorPontos = pontos; }
  });
  return melhor;
}

/** Completa a leitura de uma conta com conta_fixa_id e categoria_id. */
function completarLeituraConta(leitura, textoExtra) {
  const conta = casarContaFixa(leitura, textoExtra);
  if (conta) { leitura.conta_fixa_id = conta.id; leitura.categoria_id = conta.categoria_id; if (!leitura.empresa) leitura.empresa = conta.nome; }
  else {
    const sug = sugerirCategoria([leitura.empresa, textoExtra].filter(Boolean).join(' '), lerAba('Categorias'));
    leitura.categoria_id = sug[0];
  }
  return leitura;
}

/**
 * Completa a leitura de um cupom com a categoria: 1º a regra de loja aprendida, 2º a que o Claude
 * escolheu no cardápio, 3º as palavras-chave.
 */
function completarLeituraCupom(leitura, ctx) {
  const categorias = categoriasVisiveis(ctx);
  const texto = [leitura.estabelecimento, leitura.descricao].concat((leitura.itens || []).map((i) => i.nome)).filter(Boolean).join(' ');
  const sug = sugerirCategoria(texto, categorias);
  const regra = leitura.estabelecimento ? regraDaLoja(leitura.estabelecimento, lerAba('RegrasLoja')) : null;
  if (regra && categorias.some((c) => c.id === regra.categoria_id)) leitura.categoria_id = regra.categoria_id;
  else if (!leitura.categoria_id || !categorias.some((c) => c.id === leitura.categoria_id)) leitura.categoria_id = sug[0];
  return leitura;
}

// ---------- Leitura de arquivo (foto/PDF) ----------

/** Pasta de destino por tipo. */
function pastaDoTipo(tipo) {
  if (tipo === 'conta') return 'Contas da Casa';
  if (tipo === 'fatura_cartao') return 'Faturas de Cartão';
  return 'Cupons e Recibos';
}

/** Salva o arquivo em <pasta do tipo>/AAAA/MM e devolve { id, url }. */
function salvarArquivoLeitura(blob, tipo, nome) {
  const comp = competenciaDe();
  const pasta = pastaPorCaminho(pastaDoTipo(tipo) + '/' + comp.slice(0, 4) + '/' + comp.slice(5, 7));
  const arquivo = pasta.createFile(blob.setName(nome));
  compartilharComLink(arquivo);
  return { id: arquivo.getId(), url: urlVisualizacao(arquivo.getId()) };
}

/** Nome de arquivo seguro: "cupom_2026-10-17_1430.jpg". */
function nomeArquivoLeitura(tipo, mime, nomeOriginal) {
  const ext = mime === 'application/pdf' ? 'pdf' : (mime || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg');
  const base = String(nomeOriginal || '').replace(/[^\w.\- ]/g, '').replace(/\.[^.]+$/, '').trim();
  const carimbo = agoraIso().replace(/[:T]/g, '-').slice(0, 16);
  return (base || tipo) + '_' + carimbo + '.' + ext;
}

/**
 * Lê um documento (cupom, conta ou fatura) tentando Claude e caindo para OCR+regex.
 * @returns LeituraExtraida (sem anexo_url; quem chama acrescenta)
 */
function lerDocumento(base64, mime, tipo, blob, ctx) {
  const contasFixas = tipo === 'conta' ? lerAba('ContasFixas').filter((c) => c.ativa) : [];
  let leitura = null;
  if (claudeDisponivel()) {
    try {
      const cardapio = tipo === 'cupom' ? cardapioParaPrompt(categoriasVisiveis(ctx || { ehDependente: false, config: lerConfig() }), lerAba('Grupos')) : '';
      const resposta = chamarClaude([blocoArquivo(base64, mime), { type: 'text', text: promptLeitura(tipo, contasFixas, cardapio) }], tipo === 'fatura_cartao' ? 4096 : 1500);
      leitura = normalizarLeituraClaude(extrairJson(resposta), tipo);
      leitura.origem_leitura = 'claude';
    } catch (e) {
      console.warn('Leitura pelo Claude falhou, usando OCR: ' + e.message);
      leitura = null;
    }
  }
  let textoOcr = '';
  if (!leitura) {
    try {
      textoOcr = ocrDrive(blob);
      leitura = extrairDeTextoOcr(textoOcr, tipo);
      if (tipo === 'fatura_cartao') { leitura.compras = comprasDeTextoOcr(textoOcr); leitura.confianca = leitura.compras.length ? 0.4 : 0.1; }
    } catch (e) {
      console.warn('OCR do Drive indisponível: ' + e.message);
      leitura = { confianca: 0, origem_leitura: 'regex', aviso: 'Não consegui ler o arquivo automaticamente. Confira os dados à mão.' };
    }
  }
  if (tipo === 'conta') completarLeituraConta(leitura, textoOcr);
  else if (tipo === 'cupom') completarLeituraCupom(leitura, ctx);
  return leitura;
}

/** Normaliza tipos do JSON devolvido pelo Claude. */
function normalizarLeituraClaude(j, tipo) {
  const r = {};
  const num = (v) => (v === null || v === undefined || v === '' ? undefined : lerValor(v));
  const str = (v) => (v === null || v === undefined ? undefined : String(v).trim() || undefined);
  if (tipo === 'fatura_cartao') {
    r.compras = (j.compras || []).map((c) => semUndefined({ data: normalizarDataIso(c.data), estabelecimento: str(c.estabelecimento) || '', valor: num(c.valor) || 0, parcela: str(c.parcela) })).filter((c) => c.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(c.data));
  } else if (tipo === 'conta') {
    r.empresa = str(j.empresa); r.competencia = str(j.competencia); r.vencimento = j.vencimento ? normalizarDataIso(j.vencimento) : undefined;
    r.valor = num(j.valor); r.linha_digitavel = str(j.linha_digitavel); r.pix_copia_cola = str(j.pix_copia_cola);
    r.consumo_valor = num(j.consumo_valor); r.consumo_unidade = str(j.consumo_unidade); r.conta_fixa_id = str(j.conta_fixa_id);
  } else {
    r.valor = num(j.valor); r.data = j.data ? normalizarDataIso(j.data) : undefined; r.estabelecimento = str(j.estabelecimento); r.cnpj = str(j.cnpj);
    r.forma_pgto = FORMAS_PGTO.indexOf(j.forma_pgto) >= 0 ? j.forma_pgto : undefined; r.descricao = str(j.descricao);
    r.categoria_id = str(j.categoria_id);
    r.itens = (j.itens || []).map((i) => ({ nome: String(i.nome || ''), valor: num(i.valor) || 0 })).slice(0, 30);
  }
  r.confianca = Math.max(0, Math.min(1, Number(j.confianca) || 0.8));
  return semUndefined(r);
}

/** Compras de uma fatura a partir do texto do OCR: linhas "dd/mm ESTABELECIMENTO 123,45". */
function comprasDeTextoOcr(texto) {
  const compras = [];
  const ano = new Date().getFullYear();
  String(texto || '').split('\n').forEach((linha) => {
    const m = linha.match(/^\s*(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/);
    if (!m) return;
    const valor = lerValor(m[5]);
    if (!(valor > 0) || /PAGAMENTO|PGTO/i.test(m[4])) return;
    const a = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(ano);
    const parc = m[4].match(/\b(\d{1,2}\/\d{1,2})\b/);
    compras.push(semUndefined({ data: a + '-' + m[2] + '-' + m[1], estabelecimento: m[4].replace(/\b\d{1,2}\/\d{1,2}\b/, '').trim(), valor, parcela: parc ? parc[1] : undefined }));
  });
  return compras;
}

/** ler_imagem: salva o arquivo, lê e devolve LeituraExtraida com anexo_url. */
function acaoLerImagem(p, ctx) {
  const base64 = String(p.imagem_base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!base64) throw new ErroUsuario('Nenhuma imagem recebida.');
  const mime = String(p.mime || 'image/jpeg').toLowerCase();
  if (mime !== 'application/pdf' && MIMES_IMAGEM.indexOf(mime) < 0) throw new ErroUsuario('Formato não suportado. Envie JPG, PNG, WEBP ou PDF.');
  const tipo = ['cupom', 'conta', 'fatura_cartao'].indexOf(p.tipo) >= 0 ? p.tipo : 'cupom';
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, nomeArquivoLeitura(tipo, mime, p.nome_arquivo));
  const salvo = salvarArquivoLeitura(blob, tipo, blob.getName());
  const leitura = lerDocumento(base64, mime, tipo, blob, ctx);
  leitura.anexo_url = salvo.url;
  return leitura;
}

/** Usado por importar_fatura quando vem PDF/foto. */
function lerArquivoFatura(base64Bruto, mime, nomeOriginal, ctx) {
  const base64 = String(base64Bruto).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, nomeArquivoLeitura('fatura', mime, nomeOriginal));
  const salvo = salvarArquivoLeitura(blob, 'fatura_cartao', blob.getName());
  const leitura = lerDocumento(base64, mime, 'fatura_cartao', blob, ctx);
  leitura.anexo_url = salvo.url;
  return leitura;
}

/** Lê um blob já salvo (usado por email.gs e pela pasta _Entrada). */
function lerBlobComoConta(blob) {
  const base64 = Utilities.base64Encode(blob.getBytes());
  const mime = blob.getContentType() || 'application/pdf';
  return lerDocumento(base64, mime, 'conta', blob, { ehDependente: false, ehJunior: false, config: lerConfig() });
}

// ---------- Texto (voz / SMS) ----------

/** Aplica a regra de loja aprendida a uma leitura (a categoria aprendida vence). */
function aplicarRegraLojaNaLeitura(leitura, categorias) {
  const est = leitura.estabelecimento || leitura.descricao;
  const regra = est ? regraDaLoja(est, lerAba('RegrasLoja')) : null;
  if (regra && (categorias || []).some((c) => c.id === regra.categoria_id)) { leitura.categoria_id = regra.categoria_id; leitura.confianca = Math.max(Number(leitura.confianca) || 0, 0.85); }
  return leitura;
}

/** ler_texto: regex local → RegrasLoja; se a confiança for baixa e houver chave, pede ajuda ao Claude. */
function acaoLerTexto(p, ctx) {
  const texto = String(p.texto || '').trim();
  if (!texto) throw new ErroUsuario('Nenhum texto recebido.');
  const categorias = categoriasVisiveis(ctx);
  const local = aplicarRegraLojaNaLeitura(extrairDeTexto(texto, categorias), categorias);
  if (local.confianca >= 0.7 || !claudeDisponivel()) return local;
  try {
    const prompt = 'Frase dita por um membro da família sobre um gasto ou receita: "' + texto.replace(/"/g, "'") + '".\n' +
      'Responda SOMENTE com JSON: {"valor": number ou null, "data": "AAAA-MM-DD" ou null, "descricao": string, "estabelecimento": string ou null,\n' +
      '"forma_pgto": "dinheiro"|"pix"|"débito"|"crédito"|"boleto"|null, "categoria_id": um id do cardápio abaixo, "confianca": 0..1}.\n' +
      'Cardápio (id: nome (grupo, ícone)):\n' + cardapioParaPrompt(categorias, lerAba('Grupos')) + '\n' +
      'Hoje é ' + hojeIso() + '. Se a data não for dita, use hoje.';
    const j = extrairJson(chamarClaude([{ type: 'text', text: prompt }], 400));
    const r = semUndefined({
      valor: j.valor === null || j.valor === undefined ? local.valor : lerValor(j.valor),
      data: j.data ? normalizarDataIso(j.data) : local.data,
      descricao: j.descricao || local.descricao,
      estabelecimento: j.estabelecimento || local.estabelecimento,
      forma_pgto: FORMAS_PGTO.indexOf(j.forma_pgto) >= 0 ? j.forma_pgto : local.forma_pgto,
      categoria_id: categorias.some((c) => c.id === j.categoria_id) ? j.categoria_id : local.categoria_id,
      confianca: Math.max(local.confianca, Math.min(1, Number(j.confianca) || 0.6)),
      origem_leitura: 'claude',
    });
    return aplicarRegraLojaNaLeitura(r, categorias);
  } catch (e) {
    console.warn('ler_texto: Claude falhou, devolvendo leitura local: ' + e.message);
    return local;
  }
}

// ---------- NFC-e (QR do cupom) ----------

/** consultar_nfce: busca a página do QR e extrai os dados. Se a SEFAZ bloquear, confiança 0. */
function acaoConsultarNfce(p, ctx) {
  const url = String(p.url_qr || '').trim();
  if (!/^https?:\/\//i.test(url) || !/fazenda|sefaz|nfce|nfe/i.test(url)) throw new ErroUsuario('Este QR não parece ser de uma NFC-e.');
  let html = '';
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (FinancasFamilia)' } });
    if (resp.getResponseCode() === 200) html = resp.getContentText();
  } catch (e) { html = ''; }
  const dados = extrairDadosNfce(html);
  if (!dados.valor) {
    return { confianca: 0, origem_leitura: 'nfce', aviso: 'A SEFAZ não devolveu os dados do cupom (pode exigir captcha). Tire uma foto do cupom ou digite o valor.' };
  }
  const categorias = categoriasVisiveis(ctx);
  const sug = aplicarRegraLoja(dados.estabelecimento || '', sugerirCategoria(dados.estabelecimento || '', categorias), lerAba('RegrasLoja'));
  return Object.assign(dados, { categoria_id: sug[0], confianca: 0.95, origem_leitura: 'nfce' });
}

/** Regex sobre o HTML da consulta pública (função pura; layouts variam por estado). */
function extrairDadosNfce(html) {
  const h = String(html || '');
  const texto = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const r = {};
  const total = texto.match(/Valor\s+a\s+pagar\s*(?:R\$)?\s*:?\s*([\d.]+,\d{2})/i) || texto.match(/Valor\s+total\s*(?:R\$)?\s*:?\s*([\d.]+,\d{2})/i) || h.match(/class="totalNumb txtMax"[^>]*>\s*([\d.]+,\d{2})/i);
  if (total) r.valor = lerValor(total[1]);
  const emit = h.match(/id="u20"[^>]*>([^<]+)</i) || h.match(/class="txtTopo"[^>]*>([^<]+)</i) || texto.match(/(?:Raz[ãa]o\s+Social|Nome\s*\/\s*Raz[ãa]o\s+Social)\s*:?\s*([^:]{3,80}?)\s+CNPJ/i);
  if (emit) r.estabelecimento = emit[1].trim();
  const cnpj = texto.match(/CNPJ\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
  if (cnpj) r.cnpj = cnpj[1];
  const data = texto.match(/Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i) || texto.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/);
  if (data) r.data = normalizarDataIso(data[1]);
  const forma = texto.match(/(Cart[ãa]o\s+de\s+(?:Cr[ée]dito|D[ée]bito)|Dinheiro|PIX|Pagamento\s+Instant[âa]neo)/i);
  if (forma) r.forma_pgto = extrairFormaPgto(forma[1]) || (/instant/i.test(forma[1]) ? 'pix' : undefined);
  return semUndefined(r);
}

// ==============================================================================
// notificacoes.gs
// ==============================================================================

/**
 * notificacoes.gs — Push, lembrete diário, e-mail de resumo e o "canal único" notificarUsuario()
 * (push → Telegram → e-mail) usado pelas rotinas.
 *
 * IMPORTANTE sobre Web Push: o padrão exige assinar cada envio com VAPID (ES256). O Apps Script
 * NÃO tem assinatura ECDSA (Utilities só assina HMAC/RSA), então o envio nativo não é possível aqui.
 * Solução adotada:
 *  - registrar_push guarda a assinatura (PushSubscription) na aba Push;
 *  - o envio é delegado a um serviço simples configurável na Script Property `URL_SERVICO_PUSH`
 *    (recebe POST JSON { chave, titulo, corpo, url, assinaturas: [...] } e devolve
 *    { ok, invalidas: [endpoints que expiraram] }). Pode ser uma Cloud Function/Vercel com a
 *    biblioteca web-push; `TOKEN_SERVICO_PUSH` é um segredo compartilhado opcional.
 *  - sem esse serviço, caímos para e-mail (lembrete diário e avisos de vencimento vão para os
 *    administradores). A geração das chaves VAPID (`gerarChavesVapid`) fica no serviço, fora daqui.
 */

const TEXTO_LEMBRETE = 'Você lançou os gastos de hoje?';

/** Há serviço de push configurado? */
function pushConfigurado() {
  return !!propriedade('URL_SERVICO_PUSH', '');
}

/** registrar_push: guarda/atualiza a assinatura do navegador do usuário. */
function acaoRegistrarPush(p, ctx) {
  const assinatura = typeof p.assinatura === 'string' ? JSON.parse(p.assinatura) : p.assinatura;
  if (!assinatura || !assinatura.endpoint) throw new ErroUsuario('Assinatura de notificação inválida.');
  const texto = JSON.stringify(assinatura);
  const outras = lerAba('Push').filter((r) => {
    try { return JSON.parse(r.assinatura).endpoint !== assinatura.endpoint; } catch (e) { return false; }
  });
  outras.push({ usuario_id: ctx.uid, assinatura: texto, criado_em: agoraIso() });
  substituirAba('Push', outras);
  return { ok: true, push_ativo: pushConfigurado() };
}

/**
 * Envia um push para os usuários informados. Devolve true se o serviço aceitou.
 * Se não houver serviço configurado, devolve false (quem chama decide se manda e-mail).
 */
function enviarPush(usuarioIds, titulo, corpo, url) {
  if (!pushConfigurado()) return false;
  const registros = lerAba('Push').filter((r) => !usuarioIds || usuarioIds.indexOf(r.usuario_id) >= 0);
  if (!registros.length) return false;
  const assinaturas = registros.map((r) => { try { return JSON.parse(r.assinatura); } catch (e) { return null; } }).filter(Boolean);
  const resposta = UrlFetchApp.fetch(propriedade('URL_SERVICO_PUSH'), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chave: propriedade('TOKEN_SERVICO_PUSH', ''), titulo, corpo, url: url || '', assinaturas }),
  });
  if (resposta.getResponseCode() !== 200) { console.warn('Serviço de push respondeu ' + resposta.getResponseCode()); return false; }
  try {
    const r = JSON.parse(resposta.getContentText());
    if (r.invalidas && r.invalidas.length) removerAssinaturasInvalidas(r.invalidas);
  } catch (e) { /* resposta sem JSON: tudo bem */ }
  return true;
}

/** Tira da aba Push as assinaturas que o navegador cancelou. */
function removerAssinaturasInvalidas(endpoints) {
  const restantes = lerAba('Push').filter((r) => {
    try { return endpoints.indexOf(JSON.parse(r.assinatura).endpoint) < 0; } catch (e) { return false; }
  });
  substituirAba('Push', restantes);
}

/** Push para todos os usuários ativos de certos perfis. */
function enviarPushParaPerfis(perfis, titulo, corpo, url) {
  const ids = lerAba('Usuarios').filter((u) => u.ativo && perfis.indexOf(normalizarPerfil(u.perfil)) >= 0).map((u) => u.id);
  return enviarPush(ids, titulo, corpo, url);
}

/** Aviso "Você gastou R$ X em Y — de que é isso?" para o dono do cartão. */
function notificarNovaCompra(item) {
  if (!item.usuario_id) return false;
  return enviarPush([item.usuario_id], 'Nova compra no cartão', 'Você gastou ' + moeda(item.valor) + ' em ' + item.estabelecimento + ' — de que é isso?', '#/caixa');
}

/**
 * Notifica uma pessoa pelo melhor canal disponível: push (serviço externo) e Telegram (chat vinculado).
 * Sem nenhum dos dois, cai no e-mail dos administradores quando a pessoa é administradora.
 * Devolve true se algum canal aceitou.
 */
function notificarUsuario(usuarioId, titulo, corpo, url) {
  let ok = false;
  try { ok = enviarPush([usuarioId], titulo, corpo, url) || ok; } catch (e) { console.warn('push: ' + e.message); }
  try { ok = enviarTelegram(usuarioId, '*' + titulo + '*\n' + corpo) || ok; } catch (e) { console.warn('telegram: ' + e.message); }
  if (!ok) {
    const u = buscarPorId('Usuarios', usuarioId);
    if (u && normalizarPerfil(u.perfil) === 'Administrador') ok = enviarEmailAdministradores(titulo, '<p>' + String(corpo).replace(/\n/g, '<br>') + '</p>');
  }
  return ok;
}

/** notificarUsuario() para todos os ativos de certos perfis. Devolve quantos receberam. */
function notificarPerfis(perfis, titulo, corpo, url) {
  const ids = lerAba('Usuarios').filter((u) => u.ativo && perfis.indexOf(normalizarPerfil(u.perfil)) >= 0).map((u) => u.id);
  let n = 0;
  ids.forEach((id) => { if (notificarUsuario(id, titulo, corpo, url)) n++; });
  return n;
}

/**
 * lembreteDiario: "Você lançou os gastos de hoje?" — push a todos (e Telegram a quem vinculou);
 * sem push, e-mail aos administradores. Faz parte do vigia diário (rotinas.gs), mas pode rodar sozinho.
 */
function lembreteDiario() {
  const cfg = lerConfig();
  const enviado = enviarPushParaPerfis(['Administrador', 'Adulto', 'Dependente'], cfg.nome_familia || 'Finanças da Família', TEXTO_LEMBRETE, '#/lancar');
  try { lerAba('Telegram').filter((r) => r.ativo && r.chat_id).forEach((r) => enviarTelegram(r.usuario_id, TEXTO_LEMBRETE)); } catch (e) { console.warn('telegram: ' + e.message); }
  if (!enviado) {
    enviarEmailAdministradores(TEXTO_LEMBRETE, '<p>' + TEXTO_LEMBRETE + '</p><p>Abra o app e registre os gastos do dia. ' +
      '<a href="' + obterUrlApp() + '">Abrir o app</a></p>' +
      '<p><small>Para receber este lembrete como notificação no celular, configure o serviço de push (URL_SERVICO_PUSH). Veja o README.</small></p>');
  }
  return enviado;
}

/** Endereços dos administradores: Script Property EMAILS_ADMIN (separados por vírgula) ou o dono do script. */
function emailsAdministradores() {
  const lista = propriedade('EMAILS_ADMIN', '').split(',').map((s) => s.trim()).filter(Boolean);
  if (lista.length) return lista;
  try { return [Session.getEffectiveUser().getEmail()].filter(Boolean); } catch (e) { return []; }
}

/** Envia um e-mail HTML de resumo aos administradores (nunca derruba quem chamou). */
function enviarEmailAdministradores(assunto, html) {
  const destinos = emailsAdministradores();
  if (!destinos.length) { console.warn('Sem e-mail de administrador para enviar: ' + assunto); return false; }
  const cfg = lerConfig();
  try {
    MailApp.sendEmail({
      to: destinos.join(','),
      subject: '[' + (cfg.nome_familia || 'Finanças da Família') + '] ' + assunto,
      htmlBody: '<div style="font-family:sans-serif;font-size:16px;line-height:1.5">' + html + '<hr><p><small>Enviado automaticamente pelo app Finanças da Família.</small></p></div>',
      name: cfg.nome_familia || 'Finanças da Família',
    });
    return true;
  } catch (e) {
    console.error('Falha ao enviar e-mail: ' + e.message);
    return false;
  }
}

// ==============================================================================
// rotinas.gs
// ==============================================================================

/**
 * rotinas.gs — Previsão de saídas, avisos do assistente, alertas personalizados e as três rotinas
 * automáticas (gatilhos do Apps Script, cada uma liga/desliga em Configurações):
 *
 *  - vigiaDiario() (todo dia na hora do lembrete, padrão 20h): gasto fora do padrão (> 1,35× a média
 *    de 3 meses), cobrança duplicada no cartão, assinatura nova, conta a vencer em 3 dias ou atrasada,
 *    gastos de cartão sem categoria, alertas personalizados e o lembrete "lance os gastos de hoje".
 *    Os avisos vão para a aba Avisos e são enviados (e-mail/push/Telegram) aos administradores ou
 *    às pessoas marcadas em `avisar` no alerta. Cada aviso é enviado uma vez (id estável).
 *  - analiseQuinzenal() (dias 1 e 16): tendências por categoria contra a média de 3 meses e uma
 *    recomendação objetiva.
 *  - fechamentoDoMes() (dia 1º): relatório do mês anterior, projeção de 3 meses e pauta da reunião
 *    → e-mail aos administradores, aba Avisos e aba Reunioes.
 *
 * As funções calcularProximasSaidas / gerarAvisos / alertasCalculados / analisarTendencias são PURAS
 * (recebem os dados de carregarDados() e a data de hoje) e têm o mesmo comportamento do modo
 * demonstração (app/src/api/mock.ts).
 */

const FATOR_FORA_DO_PADRAO = 1.35;
const MINIMO_MEDIA_PARA_AVISO = 50;
const CATEGORIAS_ASSINATURA = ['c_streaming', 'c_apps', 'c_seguros'];

// ---------- Próximas saídas (30/60/90 dias) ----------

/**
 * Saídas previstas: contas a pagar abertas (lidas do e-mail ou previstas), contas fixas ainda sem
 * fatura (estimadas), parcelas futuras de cartão e a fatura do ciclo aberto de cada cartão.
 */
function calcularProximasSaidas(d, dias, hoje) {
  const h = hoje || hojeIso();
  const limite = somarDias(h, Number(dias) || 30);
  const compAtual = h.slice(0, 7);
  const cfMap = indexarPorId(d.contas_fixas);
  const catMap = indexarPorId(d.categorias);
  const icone = (catId, padrao) => (catMap[catId] && catMap[catId].icone) || padrao;
  const saidas = [];
  d.contas_a_pagar.filter((c) => c.status === 'aberta' && c.vencimento >= h && c.vencimento <= limite).forEach((c) => {
    const cf = cfMap[c.conta_fixa_id];
    const lida = !!(c.anexo_url || c.linha_digitavel);
    saidas.push({ id: c.id, data: c.vencimento, titulo: cf ? cf.nome : 'Conta', subtitulo: lida ? 'fatura lida do e-mail' : 'recorrente', valor: arredondar(c.valor), icone: icone(cf ? cf.categoria_id : '', 'receipt'), status: lida ? 'lida_do_email' : 'prevista', rota: '/contas' });
  });
  d.contas_fixas.filter((cf) => cf.ativa).forEach((cf) => {
    [compAtual, somarMeses(compAtual, 1), somarMeses(compAtual, 2), somarMeses(compAtual, 3)].forEach((comp) => {
      const venc = comp + '-' + zeros(Math.min(Number(cf.dia_vencimento) || 10, ultimoDiaDoMes(comp)));
      if (venc < h || venc > limite) return;
      if (d.contas_a_pagar.some((c) => c.conta_fixa_id === cf.id && c.competencia === comp)) return;
      saidas.push({ id: 'est_' + cf.id + '_' + comp, data: venc, titulo: cf.nome, subtitulo: 'aguardando fatura', valor: arredondar(cf.valor_previsto), icone: icone(cf.categoria_id, 'receipt'), status: 'estimada', rota: '/contas' });
    });
  });
  const cartMap = indexarPorId(d.cartoes);
  d.lancamentos.filter((l) => !l.excluido && l.parcela && l.status === 'a_confirmar' && l.competencia >= compAtual).forEach((l) => {
    const k = cartMap[l.cartao_id];
    const data = l.competencia + '-' + zeros(Math.min(Number(k ? k.dia_vencimento : 10) || 10, ultimoDiaDoMes(l.competencia)));
    if (data < h || data > limite) return;
    saidas.push({ id: l.id, data, titulo: l.descricao + ' — parcela ' + l.parcela, subtitulo: 'cartão ' + (k ? k.apelido : '') + ' final ' + (k ? k.final : ''), valor: arredondar(l.valor), icone: icone(l.categoria_id, 'credit-card'), status: 'parcela' });
  });
  d.cartoes.filter((k) => k.ativo).forEach((k) => {
    const compras = d.lancamentos.filter((l) => !l.excluido && l.cartao_id === k.id && l.competencia === compAtual && l.status === 'confirmado');
    if (!compras.length) return;
    const fecha = compAtual + '-' + zeros(Math.min(Number(k.dia_fechamento) || 1, ultimoDiaDoMes(compAtual)));
    const prox = somarMeses(compAtual, 1);
    const data = fecha >= h ? fecha : prox + '-' + zeros(Math.min(Number(k.dia_fechamento) || 1, ultimoDiaDoMes(prox)));
    if (data > limite) return;
    saidas.push({ id: 'fat_' + k.id, data, titulo: 'Cartão ' + k.apelido + ' final ' + k.final, subtitulo: 'fecha ' + data.slice(8, 10) + '/' + data.slice(5, 7) + ' · ' + compras.length + ' compras', valor: arredondar(somar(compras, (l) => l.valor)), icone: 'credit-card', status: 'parcial', rota: '/caixa' });
  });
  return saidas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

function acaoProximasSaidas(p) {
  const dias = [30, 60, 90].indexOf(Number(p.dias)) >= 0 ? Number(p.dias) : 30;
  return calcularProximasSaidas(carregarDados(), dias);
}

// ---------- Vigia: avisos ----------

/** Total gasto numa categoria numa competência (lançamentos confirmados de despesa). */
function totalCategoriaNoMes(ls, categoriaId, comp) {
  return somar(ls.filter((l) => l.categoria_id === categoriaId && l.competencia === comp), (l) => l.valor);
}

/** Média dos 3 meses anteriores a `comp` para a categoria. */
function mediaCategoria3m(ls, categoriaId, comp) {
  return media([1, 2, 3].map((k) => totalCategoriaNoMes(ls, categoriaId, somarMeses(comp, -k))));
}

/** Despesas confirmadas (sem aportes), base de todos os cálculos do vigia. */
function despesasConfirmadas(d) {
  const catMap = indexarPorId(d.categorias);
  return d.lancamentos.filter((l) => !l.excluido && l.status === 'confirmado' && l.tipo === 'despesa' && ehDespesaReal(catMap[l.categoria_id]));
}

/**
 * Assinaturas detectadas (função pura): lojas cobradas no crédito, valor < R$ 200, que aparecem em
 * pelo menos 2 dos últimos 3 meses. Devolve [{ loja, estabelecimento, valor, competencias[], categoria_id, nova }].
 * `nova` = começou nos últimos 2 meses (ninguém cadastrou antes).
 */
function detectarAssinaturas(d, hoje) {
  const comp = (hoje || hojeIso()).slice(0, 7);
  const ls = despesasConfirmadas(d).filter((l) => l.forma_pgto === 'crédito' && l.valor < 200);
  const porLoja = {};
  ls.forEach((l) => {
    const k = normalizar(l.estabelecimento);
    if (!k) return;
    porLoja[k] = porLoja[k] || { loja: k, estabelecimento: l.estabelecimento, valor: l.valor, categoria_id: l.categoria_id, competencias: {} };
    porLoja[k].competencias[l.competencia] = true;
    if (l.competencia >= porLoja[k].ultima || !porLoja[k].ultima) { porLoja[k].ultima = l.competencia; porLoja[k].valor = l.valor; }
  });
  const janela = [comp, somarMeses(comp, -1), somarMeses(comp, -2)];
  return Object.keys(porLoja).map((k) => {
    const a = porLoja[k];
    const comps = Object.keys(a.competencias).sort();
    const recentes = comps.filter((c) => janela.indexOf(c) >= 0);
    if (recentes.length < 2) return null;
    const nova = comps.length <= 3 && comps[0] >= somarMeses(comp, -2) && comps.indexOf(comp) >= 0;
    return { loja: a.loja, estabelecimento: a.estabelecimento, valor: arredondar(a.valor), competencias: comps, categoria_id: a.categoria_id, desde: comps[0], nova };
  }).filter(Boolean);
}

/**
 * Vigia diário: gera os avisos a partir dos dados (sem precisar de IA). Função pura.
 * Os ids são estáveis (mesmo aviso → mesmo id), o que permite marcar como lido e não reenviar.
 */
function gerarAvisos(d, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const ls = despesasConfirmadas(d);
  const avisos = [];
  // 1. Gasto fora do padrão (categorias variáveis): > 1,35× a média dos 3 meses anteriores.
  d.categorias.filter((c) => c.tipo === 'despesa' && !c.fixa && ehDespesaReal(c)).forEach((cat) => {
    const atual = totalCategoriaNoMes(ls, cat.id, comp);
    const med = mediaCategoria3m(ls, cat.id, comp);
    if (med > MINIMO_MEDIA_PARA_AVISO && atual > med * FATOR_FORA_DO_PADRAO) {
      avisos.push({ id: 'av_fora_' + cat.id, data: h, tipo: 'fora_do_padrao', titulo: cat.nome + ' ' + Math.round((atual / med - 1) * 100) + '% acima da média', detalhe: moeda(atual) + ' em ' + nomeMes(comp) + ' contra ' + moeda(med) + ' de média', gravidade: 'red', acao: { rotulo: 'ver', rota: '/tipo/' + (cat.tipo_id || TIPO_VARIAVEIS) + '?categoria=' + cat.id } });
    }
  });
  // 2. Cobrança duplicada no cartão (mesmo valor, loja e dia).
  const vistos = {};
  ls.filter((l) => l.competencia === comp && l.forma_pgto === 'crédito').forEach((l) => {
    const chave = Number(l.valor).toFixed(2) + '|' + normalizar(l.estabelecimento) + '|' + l.data;
    if (vistos[chave] && !avisos.some((a) => a.id === 'av_dup_' + chave)) {
      avisos.push({ id: 'av_dup_' + chave, data: h, tipo: 'cobranca_duplicada', titulo: 'Cobrança repetida no cartão', detalhe: l.estabelecimento + ' ' + moeda(l.valor) + ' duas vezes em ' + l.data.slice(8, 10) + '/' + l.data.slice(5, 7), gravidade: 'warn', acao: { rotulo: 'conferir', rota: '/tipo/' + TIPO_VARIAVEIS + '?categoria=' + l.categoria_id } });
    }
    vistos[chave] = true;
  });
  // 3. Assinatura nova (recorrência recente que não existia antes).
  detectarAssinaturas(d, h).filter((a) => a.nova).forEach((a) => {
    avisos.push({ id: 'av_ass_' + a.loja, data: h, tipo: 'nova_assinatura', titulo: 'Assinatura nova detectada', detalhe: a.estabelecimento + ' ' + moeda(a.valor) + ' desde ' + nomeCompetencia(a.desde, true) + ' — confira se é esperada', gravidade: 'warn', acao: { rotulo: 'categorizar', rota: '/caixa' } });
  });
  // 4. Contas a vencer em 3 dias ou atrasadas.
  const cfMap = indexarPorId(d.contas_fixas);
  d.contas_a_pagar.filter((c) => c.status === 'aberta').forEach((c) => {
    const dias = diferencaDias(h, c.vencimento);
    const nome = cfMap[c.conta_fixa_id] ? cfMap[c.conta_fixa_id].nome : 'Conta';
    if (dias >= 0 && dias <= 3) avisos.push({ id: 'av_venc_' + c.id, data: h, tipo: 'vencimento', titulo: nome + ' vence ' + (dias === 0 ? 'hoje' : 'em ' + dias + ' dia' + (dias > 1 ? 's' : '')), detalhe: moeda(c.valor) + ' · ' + (c.linha_digitavel ? 'código de barras disponível' : 'aguardando fatura'), gravidade: dias === 0 ? 'red' : 'warn', acao: { rotulo: 'pagar', rota: '/contas' } });
    else if (dias < 0) avisos.push({ id: 'av_atr_' + c.id, data: h, tipo: 'vencimento', titulo: nome + ' venceu há ' + (-dias) + ' dia' + (-dias > 1 ? 's' : ''), detalhe: moeda(c.valor), gravidade: 'red', acao: { rotulo: 'pagar', rota: '/contas' } });
  });
  // 5. Gastos de cartão sem categoria (caixa de entrada pendente).
  const pend = d.caixa_entrada.filter((c) => c.status === 'pendente').length;
  if (pend) avisos.push({ id: 'av_semcat', data: h, tipo: 'sem_categoria', titulo: pend + ' gasto' + (pend > 1 ? 's' : '') + ' do cartão sem categoria', detalhe: 'Capturados por SMS — um toque para classificar', gravidade: 'proj', acao: { rotulo: 'abrir', rota: '/caixa' } });
  // 6. Alertas personalizados disparados.
  alertasCalculados(d, h).filter((al) => al.ativo && al.status_atual === 'disparado').forEach((al) => {
    const total = al.total_atual;
    const rota = al.categoria_id ? '/tipo/' + TIPO_VARIAVEIS + '?categoria=' + al.categoria_id : (al.grupo_id ? '/tipo/' + TIPO_VARIAVEIS + '?grupo=' + al.grupo_id : '/caixa');
    avisos.push({ id: 'av_al_' + al.id, data: h, tipo: 'alerta_personalizado', titulo: al.nome, detalhe: total !== undefined ? moeda(total) + ' no mês (limite ' + moeda(al.limite) + ')' : (al.detalhe || ''), gravidade: 'red', acao: { rotulo: 'ver', rota }, avisar: al.avisar || [] });
  });
  const lidos = {};
  (d.avisos || []).forEach((a) => { if (a.lido) lidos[a.id] = true; });
  return avisos.map((a) => Object.assign(a, { lido: !!lidos[a.id] }));
}

// ---------- Alertas personalizados ----------

/** Alertas com status_atual e percentual_atual calculados (função pura). */
function alertasCalculados(d, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const ls = despesasConfirmadas(d).filter((l) => l.competencia === comp);
  const catMap = indexarPorId(d.categorias);
  const assinaturasNovas = detectarAssinaturas(d, h).filter((a) => a.nova);
  return (d.alertas || []).map((al) => {
    const base = Object.assign({}, al, { avisar: Array.isArray(al.avisar) ? al.avisar : String(al.avisar || '').split(';').filter(Boolean), ativo: !!al.ativo, limite: Number(al.limite) || 0 });
    if (al.tipo === 'categoria_acima' || al.tipo === 'grupo_acima') {
      const total = somar(ls.filter((l) => (al.categoria_id ? l.categoria_id === al.categoria_id : (catMap[l.categoria_id] || {}).grupo_id === al.grupo_id)), (l) => l.valor);
      const pct = base.limite ? Math.round((total / base.limite) * 100) : 0;
      return Object.assign(base, { total_atual: arredondar(total), percentual_atual: pct, status_atual: base.limite && total > base.limite ? 'disparado' : 'ok' });
    }
    if (al.tipo === 'nova_assinatura') return Object.assign(base, { status_atual: assinaturasNovas.length ? 'disparado' : 'ok', detalhe: assinaturasNovas.map((a) => a.estabelecimento + ' ' + moeda(a.valor)).join(', ') });
    if (al.tipo === 'fora_do_padrao') {
      const fora = d.categorias.filter((c) => c.tipo === 'despesa' && !c.fixa && ehDespesaReal(c)).filter((c) => { const m = mediaCategoria3m(despesasConfirmadas(d), c.id, comp); return m > MINIMO_MEDIA_PARA_AVISO && totalCategoriaNoMes(ls, c.id, comp) > m * FATOR_FORA_DO_PADRAO; });
      return Object.assign(base, { status_atual: fora.length ? 'disparado' : 'ok', detalhe: fora.map((c) => c.nome).join(', ') });
    }
    if (al.tipo === 'cobranca_duplicada') {
      const vistos = {}; let dup = 0;
      ls.filter((l) => l.forma_pgto === 'crédito').forEach((l) => { const k = Number(l.valor).toFixed(2) + '|' + normalizar(l.estabelecimento) + '|' + l.data; if (vistos[k]) dup++; vistos[k] = true; });
      return Object.assign(base, { status_atual: dup ? 'disparado' : 'ok', detalhe: dup + ' cobrança(s) repetida(s)' });
    }
    return Object.assign(base, { status_atual: 'ok' });
  });
}

/** Versão para o app (sem campos internos). */
function alertaPublico(al) {
  const o = Object.assign({}, al);
  delete o.total_atual; delete o.detalhe;
  return o;
}

function acaoListarAlertas() {
  return alertasCalculados(carregarDados()).map(alertaPublico);
}

const TIPOS_ALERTA = ['categoria_acima', 'grupo_acima', 'nova_assinatura', 'cobranca_duplicada', 'fora_do_padrao'];

/** salvar_alerta (Adulto). */
function acaoSalvarAlerta(p) {
  const a = p.alerta || {};
  if (!a.nome) throw new ErroUsuario('Dê um nome ao alerta (ex.: "Delivery acima de R$ 400/mês").');
  if (TIPOS_ALERTA.indexOf(a.tipo) < 0) throw new ErroUsuario('Tipo de alerta inválido.');
  if (a.tipo === 'categoria_acima' && !(a.categoria_id && buscarPorId('Categorias', a.categoria_id))) throw new ErroUsuario('Escolha a categoria do alerta.');
  if (a.tipo === 'grupo_acima' && !(a.grupo_id && buscarPorId('Grupos', a.grupo_id))) throw new ErroUsuario('Escolha o grupo do alerta.');
  const existente = a.id ? buscarPorId('Alertas', a.id) : null;
  const novo = {
    id: a.id || gerarId('al'), nome: String(a.nome).trim(), tipo: a.tipo, categoria_id: a.categoria_id || '', grupo_id: a.grupo_id || '',
    limite: lerValor(a.limite), avisar: Array.isArray(a.avisar) ? a.avisar : String(a.avisar || '').split(';').filter(Boolean),
    ativo: a.ativo === undefined ? true : paraBooleano(a.ativo), ultimo_disparo: existente ? existente.ultimo_disparo : '',
  };
  const salvo = salvarPorId('Alertas', novo);
  return alertaPublico(alertasCalculados(carregarDados()).find((x) => x.id === salvo.id));
}

function acaoExcluirAlerta(p) {
  const id = String(p.id || '');
  if (!buscarPorId('Alertas', id)) throw new ErroUsuario('Alerta não encontrado');
  removerLinhas('Alertas', (r) => r.id === id);
  return { id };
}

// ---------- Avisos (aba + calculados) ----------

/** Aviso da aba (acao em JSON) → objeto do app. */
function avisoPublico(r) {
  let acao;
  try { acao = typeof r.acao === 'string' ? (r.acao ? JSON.parse(r.acao) : undefined) : r.acao; } catch (e) { acao = undefined; }
  return semUndefined({ id: r.id, data: r.data, tipo: r.tipo, titulo: r.titulo, detalhe: r.detalhe, gravidade: r.gravidade, acao, lido: !!r.lido });
}

/**
 * Lista de avisos do app: os calculados agora (vigia) + os guardados pelas rotinas (tendência,
 * fechamento), sem repetir ids, do mais recente para o mais antigo.
 */
function listarAvisosAtuais(d, hoje) {
  const calculados = gerarAvisos(d, hoje).map((a) => { const o = Object.assign({}, a); delete o.avisar; return o; });
  const ids = {};
  calculados.forEach((a) => { ids[a.id] = true; });
  const guardados = (d.avisos || []).filter((a) => !ids[a.id] && ['tendencia', 'fechamento'].indexOf(a.tipo) >= 0).map(avisoPublico);
  return calculados.concat(guardados.sort((a, b) => (a.data < b.data ? 1 : -1)));
}

function acaoListarAvisos(p) {
  const limite = Math.min(Number(p.limite) || 20, 100);
  return listarAvisosAtuais(carregarDados()).slice(0, limite);
}

/** Grava o aviso na aba (cria ou atualiza pelo id, preservando `lido`). Devolve true se era novo. */
function guardarAviso(aviso, usuarioId) {
  const existente = buscarPorId('Avisos', aviso.id);
  const linha = { id: aviso.id, data: aviso.data, tipo: aviso.tipo, titulo: aviso.titulo, detalhe: aviso.detalhe, gravidade: aviso.gravidade, acao: aviso.acao ? JSON.stringify(aviso.acao) : '', lido: existente ? !!existente.lido : false, usuario_id: usuarioId || '' };
  if (existente) { atualizarPorId('Avisos', aviso.id, linha); return false; }
  inserirLinhas('Avisos', [linha]);
  return true;
}

function acaoMarcarAvisoLido(p, ctx) {
  const id = String(p.id || '');
  const d = carregarDados();
  const aviso = listarAvisosAtuais(d).find((a) => a.id === id);
  if (!aviso) throw new ErroUsuario('Aviso não encontrado');
  guardarAviso(aviso, ctx.uid);
  atualizarPorId('Avisos', id, { lido: true });
  return Object.assign({}, aviso, { lido: true });
}

/** Mantém a aba Avisos enxuta: remove os com mais de 90 dias. */
function limparAvisosAntigos() {
  const limite = somarDias(hojeIso(), -90);
  return removerLinhas('Avisos', (a) => String(a.data || '') < limite);
}

// ---------- Rotina 1: vigia diário ----------

/**
 * Destinatários de um aviso: `avisar` do alerta personalizado (vazio = todos os adultos), senão os
 * administradores. Devolve ids de usuário.
 */
function destinatariosDoAviso(aviso, usuarios) {
  const ativos = usuarios.filter((u) => u.ativo);
  if (aviso.tipo === 'alerta_personalizado') {
    if (aviso.avisar && aviso.avisar.length) return aviso.avisar;
    return ativos.filter((u) => normalizarPerfil(u.perfil) !== 'Dependente').map((u) => u.id);
  }
  return ativos.filter((u) => normalizarPerfil(u.perfil) === 'Administrador').map((u) => u.id);
}

/** Roda todo dia à noite. Devolve { gerados, novos, enviados }. */
function vigiaDiario() {
  const d = carregarDados();
  if (d.config.rotina_vigia === false) { console.log('vigiaDiario: rotina desligada na Config'); return lembreteDiario() ? { gerados: 0, novos: 0, enviados: 0 } : null; }
  const avisos = gerarAvisos(d);
  const novos = [];
  avisos.forEach((a) => { if (guardarAviso(a, '')) novos.push(a); });
  // Avisos "sem categoria" e de vencimento repetem todo dia; só os demais novos viram notificação.
  const paraEnviar = novos.filter((a) => a.tipo !== 'sem_categoria');
  const porPessoa = {};
  paraEnviar.forEach((a) => destinatariosDoAviso(a, d.usuarios).forEach((uid) => { porPessoa[uid] = porPessoa[uid] || []; porPessoa[uid].push(a); }));
  let enviados = 0;
  Object.keys(porPessoa).forEach((uid) => {
    const lista = porPessoa[uid];
    const titulo = lista.length === 1 ? lista[0].titulo : lista.length + ' avisos do assistente';
    const corpo = lista.map((a) => a.titulo + ' — ' + a.detalhe).join('\n');
    if (notificarUsuario(uid, titulo, corpo, '#/')) enviados++;
  });
  if (paraEnviar.length) {
    const html = '<p>Avisos de hoje:</p><ul>' + paraEnviar.map((a) => '<li><b>' + a.titulo + '</b> — ' + a.detalhe + '</li>').join('') + '</ul>';
    enviarEmailAdministradores('Vigia diário: ' + paraEnviar.length + ' aviso(s)', html);
  }
  // Alertas personalizados: registra o último disparo.
  paraEnviar.filter((a) => a.tipo === 'alerta_personalizado').forEach((a) => { try { atualizarPorId('Alertas', a.id.replace(/^av_al_/, ''), { ultimo_disparo: hojeIso() }); } catch (e) { /* ignora */ } });
  // Lembrete "lance os gastos de hoje" faz parte do vigia.
  lembreteDiario();
  try { limparAvisosAntigos(); } catch (e) { /* ignora */ }
  console.log('vigiaDiario: ' + avisos.length + ' aviso(s), ' + novos.length + ' novo(s), ' + enviados + ' pessoa(s) notificada(s)');
  return { gerados: avisos.length, novos: novos.length, enviados };
}

// ---------- Rotina 2: análise quinzenal ----------

/**
 * Tendências por categoria (função pura): compara o mês corrente, projetado para o mês inteiro pelo
 * dia de hoje, com a média dos 3 meses anteriores. Devolve { subiram[], cairam[], recomendacao }.
 */
function analisarTendencias(d, hoje) {
  const h = hoje || hojeIso();
  // Nos primeiros dias do mês (rotina do dia 1º) analisa o mês anterior inteiro.
  const inicioDoMes = Number(h.slice(8, 10)) <= 3;
  const comp = inicioDoMes ? somarMeses(h.slice(0, 7), -1) : h.slice(0, 7);
  const dia = inicioDoMes ? ultimoDiaDoMes(comp) : (Number(h.slice(8, 10)) || 1);
  const fator = ultimoDiaDoMes(comp) / dia; // projeta o mês inteiro
  const ls = despesasConfirmadas(d);
  const itens = d.categorias.filter((c) => c.tipo === 'despesa' && !c.fixa && ehDespesaReal(c)).map((c) => {
    const atual = totalCategoriaNoMes(ls, c.id, comp);
    const med = mediaCategoria3m(ls, c.id, comp);
    const projetado = atual * fator;
    return { categoria_id: c.id, nome: c.nome, cor: c.cor, atual: arredondar(atual), projetado: arredondar(projetado), media: arredondar(med), variacao: med > 0 ? Math.round((projetado / med - 1) * 100) : 0 };
  }).filter((x) => x.media > MINIMO_MEDIA_PARA_AVISO);
  const subiram = itens.filter((x) => x.variacao >= 20).sort((a, b) => b.variacao - a.variacao).slice(0, 5);
  const cairam = itens.filter((x) => x.variacao <= -20).sort((a, b) => a.variacao - b.variacao).slice(0, 3);
  let recomendacao = 'Os gastos variáveis estão dentro da média dos últimos 3 meses. Mantenham o ritmo.';
  if (subiram.length) {
    const top = subiram[0];
    const economia = Math.max(0, top.projetado - top.media);
    recomendacao = top.nome + ' caminha para ' + moeda(top.projetado) + ' no mês, ' + top.variacao + '% acima da média de ' + moeda(top.media) + '. Voltar à média liberaria cerca de ' + moeda(economia) + ' até o fim do mês.';
  }
  return { competencia: comp, subiram, cairam, recomendacao };
}

/** Roda nos dias 1 e 16. Grava um aviso "tendencia" e envia e-mail aos administradores. */
function analiseQuinzenal() {
  const d = carregarDados();
  if (d.config.rotina_quinzenal === false) { console.log('analiseQuinzenal: rotina desligada na Config'); return null; }
  const t = analisarTendencias(d);
  const h = hojeIso();
  const aviso = {
    id: 'av_tend_' + h, data: h, tipo: 'tendencia', titulo: t.subiram.length ? t.subiram.length + ' categoria(s) acima da média' : 'Gastos dentro da média',
    detalhe: t.recomendacao, gravidade: t.subiram.length ? 'warn' : 'ok', acao: { rotulo: 'ver painel', rota: '/' },
  };
  guardarAviso(aviso, '');
  const linha = (x) => '<li><b>' + x.nome + '</b>: ' + moeda(x.atual) + ' até agora (projeção ' + moeda(x.projetado) + ') contra média de ' + moeda(x.media) + ' — ' + (x.variacao > 0 ? '+' : '') + x.variacao + '%</li>';
  const html = '<p>Análise quinzenal de ' + nomeCompetencia(t.competencia) + ':</p>' +
    (t.subiram.length ? '<h3>Subiram</h3><ul>' + t.subiram.map(linha).join('') + '</ul>' : '<p>Nenhuma categoria variável está 20% acima da média.</p>') +
    (t.cairam.length ? '<h3>Caíram</h3><ul>' + t.cairam.map(linha).join('') + '</ul>' : '') +
    '<h3>Recomendação</h3><p>' + t.recomendacao + '</p>';
  enviarEmailAdministradores('Análise quinzenal', html);
  notificarPerfis(['Administrador'], 'Análise quinzenal', t.recomendacao, '#/');
  console.log('analiseQuinzenal: ' + t.subiram.length + ' subiram, ' + t.cairam.length + ' caíram');
  return t;
}

// ---------- Rotina 3: fechamento do mês ----------

/** Roda no dia 1º: relatório do mês anterior + projeção + pauta → e-mail, Avisos e Reunioes. */
function fechamentoDoMes() {
  const d = carregarDados();
  if (d.config.rotina_fechamento === false) { console.log('fechamentoDoMes: rotina desligada na Config'); return null; }
  const comp = somarMeses(competenciaDe(), -1);
  const visao = { ver_sensivel: true };
  const versiculo = versiculoDoDia('família');
  const relatorio = gerarPautaMarkdown(d, visao, comp, versiculo, 'Relatório do mês');
  const pauta = gerarPautaMarkdown(d, visao, comp, versiculo, 'Reunião da família');
  const projecao = projetarTresMeses(d, visao, comp);
  const r = calcularResumoMes(d, visao, comp);
  // Pauta da reunião fica salva (se ainda não houver uma para a competência).
  if (!lerAba('Reunioes').some((x) => x.competencia === comp)) {
    const admin = d.usuarios.find((u) => normalizarPerfil(u.perfil) === 'Administrador' && u.ativo);
    inserirLinhas('Reunioes', [{ id: gerarId('r'), competencia: comp, data: hojeIso(), pauta, decidido: '', oracao_gratidao: '', criado_por: admin ? admin.id : '' }]);
  }
  const h = hojeIso();
  guardarAviso({
    id: 'av_fech_' + comp, data: h, tipo: 'fechamento', titulo: nomeCompetencia(comp) + ': ' + (r.sobrou >= 0 ? 'sobrou ' : 'faltou ') + moeda(Math.abs(r.sobrou)),
    detalhe: 'Entrou ' + moeda(r.entrou) + ' · Saiu ' + moeda(r.saiu) + '. Pauta da reunião pronta.', gravidade: r.sobrou >= 0 ? 'ok' : 'red', acao: { rotulo: 'ver pauta', rota: '/reuniao?competencia=' + comp },
  }, '');
  const html = markdownParaHtml(relatorio) +
    '<h2>Projeção dos próximos 3 meses</h2><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr>' +
    projecao.map((m) => '<tr><td>' + nomeCompetencia(m.competencia) + '</td><td>' + moeda(m.receitas) + '</td><td>' + moeda(m.despesas) + '</td><td>' + moeda(m.saldo) + '</td></tr>').join('') + '</table>' +
    '<h2>Pauta da reunião</h2>' + markdownParaHtml(pauta);
  enviarEmailAdministradores('Fechamento de ' + nomeCompetencia(comp), html);
  notificarPerfis(['Administrador'], 'Fechamento de ' + nomeCompetencia(comp), (r.sobrou >= 0 ? 'Sobrou ' : 'Faltou ') + moeda(Math.abs(r.sobrou)) + '. A pauta da reunião está pronta.', '#/reuniao');
  console.log('fechamentoDoMes: ' + comp + ' fechado');
  return { competencia: comp, resumo: r, projecao };
}

/** Markdown simples (títulos, listas, citações, negrito) → HTML para e-mail. Função pura. */
function markdownParaHtml(md) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const negrito = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_\((.+?)\)_/g, '<i>($1)</i>');
  const linhas = String(md || '').split('\n');
  const saida = [];
  let emLista = false;
  linhas.forEach((ln) => {
    const li = ln.match(/^- (.*)$/);
    if (li) { if (!emLista) { saida.push('<ul>'); emLista = true; } saida.push('<li>' + negrito(esc(li[1])) + '</li>'); return; }
    if (emLista) { saida.push('</ul>'); emLista = false; }
    const h1 = ln.match(/^# (.*)$/), h2 = ln.match(/^## (.*)$/), q = ln.match(/^> (.*)$/);
    if (h1) saida.push('<h1>' + esc(h1[1]) + '</h1>');
    else if (h2) saida.push('<h2>' + esc(h2[1]) + '</h2>');
    else if (q) saida.push('<blockquote>' + esc(q[1]) + '</blockquote>');
    else if (ln.trim()) saida.push('<p>' + negrito(esc(ln)) + '</p>');
  });
  if (emLista) saida.push('</ul>');
  return saida.join('\n');
}

// ==============================================================================
// sms.gs
// ==============================================================================

/**
 * sms.gs — Captura automática de compras no cartão e Caixa de Entrada.
 *
 * Parte 1 (funções PURAS, testáveis fora do Apps Script — ver testes/executar.mjs):
 *  - PADROES_BANCO: regex por banco (porte de app/src/util/extrator.ts, mesmos padrões);
 *  - lerSms(texto): descarta OTP/propaganda/estorno e extrai valor, estabelecimento, final do cartão;
 *  - extrairValor / extrairData / extrairFormaPgto / extrairDeTexto (frase ditada);
 *  - lerFaturaTexto(texto): OFX ou CSV → lista de compras.
 *
 * Parte 2 (toca a planilha):
 *  - tratarWebhook(p): `?webhook=1` — valida tokens, identifica o membro pelo token e pelo final
 *    do cartão (aba Cartoes), calcula hash_dedup, checa duplicidade (±2 dias, mesmo valor) e
 *    grava na CaixaEntrada com até 6 sugestões de categoria;
 *  - listar/resolver caixa de entrada, importar/confirmar fatura, cartões (só 4 últimos dígitos).
 *
 * Segurança: nunca gravamos código de verificação, senha ou número completo de cartão.
 *
 * Versão 2: as RegrasLoja (loja → categoria aprendida) têm prioridade sobre as palavras-chave nas
 * sugestões; resolver_caixa_entrada aprende quando a categoria escolhida difere da sugerida.
 */

// =====================================================================
// PARTE 1 — FUNÇÕES PURAS
// =====================================================================

/** Padrões de SMS/alerta por banco. Para ampliar, basta acrescentar uma linha. */
const PADROES_BANCO = [
  // Itaú: "Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12"
  { banco: 'Itaú', regex: /ITA[UÚ].*?final\s*(\d{4}).*?R\$\s*([\d.]+,\d{2})\s*(?:em|no|na)\s+(.+?)(?:\s+em\s+\d{1,2}\/\d{1,2}|\s+as\s+\d|,|\.|$)/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Nubank: "Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 8765"
  { banco: 'Nubank', regex: /Compra\s+de\s+R\$\s*([\d.]+,\d{2})\s+APROVADA\s+em\s+(.+?)\s+(?:com|no)\b.*?final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // Bradesco: "BRADESCO CARTOES: COMPRA APROVADA NO CARTAO FINAL 1234 EM 17/10 10:00 NO VALOR DE R$ 50,00 EM MERCADO X"
  { banco: 'Bradesco', regex: /BRADESCO.*?FINAL\s*(\d{4}).*?VALOR\s+DE\s+R\$\s*([\d.]+,\d{2})\s+EM\s+(.+?)(?:\.|$)/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Santander: "Santander: compra aprovada cartao final 1234 R$ 50,00 MERCADO X 17/10 10:00"
  { banco: 'Santander', regex: /SANTANDER.*?final\s*(\d{4})\s*R\$\s*([\d.]+,\d{2})\s+(.+?)\s+\d{1,2}\/\d{1,2}/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Banco do Brasil: "BB: Compra aprovada R$ 50,00 em MERCADO X cartao final 1234 17/10 10:00"
  { banco: 'Banco do Brasil', regex: /\bBB\b.*?R\$\s*([\d.]+,\d{2})\s+em\s+(.+?)\s+cart[aã]o\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // Caixa: "CAIXA: Compra aprovada no cartao final 1234, R$ 50,00, MERCADO X, 17/10"
  { banco: 'Caixa', regex: /CAIXA.*?final\s*(\d{4}),?\s*R\$\s*([\d.]+,\d{2}),?\s*(.+?),/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Inter: "Inter: compra aprovada de R$ 50,00 em MERCADO X no cartao final 1234"
  { banco: 'Inter', regex: /INTER.*?R\$\s*([\d.]+,\d{2})\s+em\s+(.+?)\s+no\s+cart[aã]o\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // C6: "C6 Bank: Compra aprovada R$ 50,00 MERCADO X final 1234"
  { banco: 'C6', regex: /C6.*?R\$\s*([\d.]+,\d{2})\s+(.+?)\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // BV / Ailos / cooperativas e genérico: "... R$ 50,00 ... em MERCADO X ... final 1234"
  { banco: 'Genérico', regex: /R\$\s*([\d.]+,\d{2})\s+(?:em|no|na|-)\s+(.+?)(?:\s+(?:com|no|cart[aã]o|final|em\s+\d|as\s+\d|,|\.|$))/i, grupos: { valor: 1, estabelecimento: 2 } },
];

/** Mensagens que NÃO são compra: códigos, senhas, propaganda, avisos. Nunca entram na planilha. */
const IGNORAR_SMS = /c[oó]digo|senha|token|verifica[cç][aã]o|OTP|n[aã]o compartilhe|promo[cç][aã]o|oferta especial|desconto|cashback|clique|acesse|fatura fechada|pagamento recebido|limite dispon/i;

const NUMEROS_POR_EXTENSO = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, mil: 1000,
};

/** Lê um valor em reais de uma frase: "45 reais", "R$ 45,90", "quarenta e cinco reais", "45 e 50". */
function extrairValor(texto) {
  const t = String(texto || '').toLowerCase();
  const m = t.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+[,.]\d{1,2}|\d+)(?:\s*(?:reais|real|conto|pila|pau)?(?:\s*e\s*(\d{1,2})\s*(?:centavos)?)?)/);
  if (m && (t.indexOf('r$') >= 0 || /reais|real|conto|pila|pau|centavos|gastei|paguei|custou|foi|deu|de\s+\d/.test(t) || /\d[,.]\d{2}/.test(m[1]))) {
    let v = m[1];
    if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.');
    let n = parseFloat(v);
    if (m[2] && m[1].indexOf(',') < 0 && m[1].indexOf('.') < 0) n += parseInt(m[2], 10) / 100;
    if (!isNaN(n)) return Math.round(n * 100) / 100;
  }
  // Por extenso simples: "quarenta e cinco reais", "cento e vinte"
  const palavras = t.replace(/[^a-zà-ú\s]/g, ' ').split(/\s+/);
  let total = 0, achou = false, acumulado = 0;
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];
    if (Object.prototype.hasOwnProperty.call(NUMEROS_POR_EXTENSO, p)) {
      const n = NUMEROS_POR_EXTENSO[p];
      if (n === 1000) { acumulado = (acumulado || 1) * 1000; total += acumulado; acumulado = 0; } else acumulado += n;
      achou = true;
    } else if (p !== 'e' && achou) {
      total += acumulado;
      acumulado = 0;
      if (/reais|real|conto|pila/.test(p)) break;
    }
  }
  total += acumulado;
  return achou && total > 0 ? total : undefined;
}

/** Forma de pagamento citada no texto. */
function extrairFormaPgto(texto) {
  const t = normalizar(texto);
  if (/\bPIX\b/.test(t)) return 'pix';
  if (/DEBITO/.test(t)) return 'débito';
  if (/CREDITO|CARTAO|PARCEL/.test(t)) return 'crédito';
  if (/DINHEIRO|ESPECIE/.test(t)) return 'dinheiro';
  if (/BOLETO/.test(t)) return 'boleto';
  return undefined;
}

/** Data relativa: hoje, ontem, anteontem, "dia 12", "12/03". */
function extrairData(texto) {
  const t = normalizar(texto);
  const hoje = new Date();
  if (/ANTEONTEM/.test(t)) return dataParaIso(new Date(hoje.getTime() - 2 * 86400000));
  if (/ONTEM/.test(t)) return dataParaIso(new Date(hoje.getTime() - 86400000));
  const m = String(texto || '').match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : hoje.getFullYear();
    return ano + '-' + zeros(m[2]) + '-' + zeros(m[1]);
  }
  const d = t.match(/\bDIA (\d{1,2})\b/);
  if (d) return hoje.getFullYear() + '-' + zeros(hoje.getMonth() + 1) + '-' + zeros(d[1]);
  return dataParaIso(hoje);
}

/**
 * Lê um SMS/alerta de banco.
 * @returns {{valido:boolean, motivo?:string, banco?:string, valor?:number, estabelecimento?:string, final_cartao?:string, parcelas?:string, data?:string}}
 */
function lerSms(texto) {
  const s = String(texto || '');
  if (!s || s.length < 10) return { valido: false, motivo: 'Mensagem vazia' };
  if (IGNORAR_SMS.test(s) && !/compra/i.test(s)) return { valido: false, motivo: 'Não é uma compra (código, promoção ou aviso)' };
  if (/estorno|cancelad/i.test(s)) return { valido: false, motivo: 'Estorno/cancelamento — ignorado' };
  for (let i = 0; i < PADROES_BANCO.length; i++) {
    const padrao = PADROES_BANCO[i];
    const m = s.match(padrao.regex);
    if (!m) continue;
    const valor = parseFloat(m[padrao.grupos.valor].replace(/\./g, '').replace(',', '.'));
    const estabelecimento = m[padrao.grupos.estabelecimento].trim().replace(/\s+/g, ' ');
    const finalGeral = s.match(/final\s*(\d{4})/i);
    const final_cartao = padrao.grupos.final ? m[padrao.grupos.final] : (finalGeral ? finalGeral[1] : '');
    const parc = s.match(/(\d{1,2})\s*[xX]\b|em\s+(\d{1,2})\s*(?:vezes|parcelas)/);
    const parcelas = parc ? '1/' + (parc[1] || parc[2]) : undefined;
    if (!valor || !estabelecimento) continue;
    return { valido: true, banco: padrao.banco, valor, estabelecimento, final_cartao, parcelas, data: extrairData(s) };
  }
  return { valido: false, motivo: 'Não reconhecemos o formato deste banco' };
}

/** Frase ditada (ou SMS) → LeituraExtraida, usando as categorias para sugerir. */
function extrairDeTexto(texto, categorias) {
  const sms = lerSms(texto);
  if (sms.valido) {
    const sug = sugerirCategoria(sms.estabelecimento || '', categorias);
    return { valor: sms.valor, data: sms.data, estabelecimento: sms.estabelecimento, descricao: sms.estabelecimento, forma_pgto: 'crédito', categoria_id: sug[0], confianca: 0.8, origem_leitura: 'regex' };
  }
  const valor = extrairValor(texto);
  const ehReceita = /recebi|entrou|ganhei|salario|salário|pagaram/i.test(texto);
  const sug = sugerirCategoria(texto, categorias, ehReceita ? 'receita' : 'despesa');
  let descricao = String(texto || '')
    .replace(/r\$\s*[\d.,]+|\b\d+[.,]?\d*\s*(reais|real|conto|pila|centavos)?\b/gi, ' ')
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|no pix|pix|d[ée]bito|cr[ée]dito|dinheiro|boleto|cart[aã]o|hoje|ontem|anteontem|de|da|do|na|no|em|com|e|um|uma|o|a)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (descricao) descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);
  return semUndefined({
    valor, data: extrairData(texto), descricao: descricao || undefined, estabelecimento: descricao || undefined,
    forma_pgto: extrairFormaPgto(texto), categoria_id: sug[0],
    confianca: valor ? 0.7 : 0.3, origem_leitura: 'regex',
  });
}

/** Texto do SMS que vai para a planilha: mascara sequências longas de dígitos (por segurança). */
function sanitizarTextoSms(texto) {
  return String(texto || '').replace(/\b\d{5,}\b/g, '•••••').slice(0, 300);
}

/** Data OFX "20261017120000[-3:BRT]" → ISO. */
function dataOfxParaIso(s) {
  const m = String(s || '').match(/(\d{4})(\d{2})(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

/**
 * Lê uma fatura em texto: OFX (<STMTTRN>) ou CSV/TSV (data;estabelecimento;valor[;parcela]).
 * Devolve [{data, estabelecimento, valor, parcela?}] só com valores positivos (compras).
 */
function lerFaturaTexto(texto) {
  const t = String(texto || '');
  const compras = [];
  if (/<STMTTRN>/i.test(t)) {
    const blocos = t.split(/<STMTTRN>/i).slice(1);
    blocos.forEach((b) => {
      const pega = (tag) => { const m = b.match(new RegExp('<' + tag + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      const valor = Math.abs(lerValor(pega('TRNAMT').replace(',', '.')));
      const tipo = pega('TRNTYPE').toUpperCase();
      const est = pega('MEMO') || pega('NAME');
      // Pagamento da fatura (crédito) não é compra.
      if (!valor || (tipo === 'CREDIT' && /PAGAMENTO|PGTO|PAGTO/i.test(est))) return;
      const parc = est.match(/(\d{1,2})\/(\d{1,2})/);
      compras.push(semUndefined({ data: dataOfxParaIso(pega('DTPOSTED')), estabelecimento: est.replace(/\s+/g, ' '), valor, parcela: parc ? parc[0] : undefined }));
    });
    return compras;
  }
  t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((linha) => {
    if (/^data[;,\t]/i.test(linha)) return; // cabeçalho
    // Separador: ";" ou tabulação; vírgula só quando não há outro (para não quebrar "312,50").
    const sep = linha.indexOf(';') >= 0 ? ';' : (linha.indexOf('\t') >= 0 ? '\t' : ',');
    const partes = linha.split(sep).map((s) => s.replace(/^"|"$/g, '').trim());
    if (partes.length < 3) return;
    const data = normalizarDataIso(partes[0]);
    const valor = lerValor(partes[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !(valor > 0)) return;
    const parc = (partes[3] || '').match(/\d{1,2}\/\d{1,2}/) || partes[1].match(/\b(\d{1,2}\/\d{1,2})\b/);
    compras.push(semUndefined({ data, estabelecimento: partes[1], valor, parcela: parc ? parc[0] : undefined }));
  });
  return compras;
}

/**
 * Verifica se uma compra já existe (função pura): mesmo valor e até ±2 dias de diferença,
 * e (mesmo cartão ou mesma primeira palavra do estabelecimento) — ou mesmo hash_dedup.
 */
function compraJaExiste(compra, lancamentos, itensCaixa, finalCartao, cartaoId) {
  const hash = hashDedup(compra.valor, compra.data, finalCartao || '', compra.estabelecimento || '');
  const primeira = normalizar(compra.estabelecimento).split(' ')[0];
  const mesmoValorEData = (valor, data) => Math.abs(valor - compra.valor) < 0.005 && Math.abs(diferencaDias(data, compra.data)) <= 2;
  const emLanc = (lancamentos || []).some((l) => l.hash_dedup === hash || (mesmoValorEData(l.valor, l.data) && (
    (cartaoId && l.cartao_id === cartaoId) || (primeira && normalizar(l.estabelecimento).split(' ')[0] === primeira)
  )));
  if (emLanc) return true;
  return (itensCaixa || []).some((c) => c.status !== 'ignorado' && (c.hash_dedup === hash || (mesmoValorEData(c.valor, c.data_compra) && (!finalCartao || c.final_cartao === finalCartao))));
}

// =====================================================================
// PARTE 2 — WEBHOOK, CAIXA DE ENTRADA, FATURAS E CARTÕES (tocam a planilha)
// =====================================================================

const CANAIS_VALIDOS = ['sms_ios', 'sms_android', 'email', 'fatura'];

/**
 * Webhook `?webhook=1` (GET ou POST). Devolve { status: 'pendente'|'duplicado'|'ignorado', item }.
 * Tokens inválidos geram erro ("Família não encontrada" / "Sessão expirada").
 */
function tratarWebhook(p) {
  validarTokenFamilia(p.token_familia);
  const usuario = usuarioPorToken(String(p.token || ''));
  if (!usuario || !usuario.ativo) throw new ErroUsuario('Sessão expirada');
  const canal = CANAIS_VALIDOS.indexOf(p.canal) >= 0 ? p.canal : 'sms_android';
  return registrarAlertaNaCaixa(String(p.texto || ''), canal, usuario);
}

/**
 * Lê o alerta, identifica o membro (titular do cartão pelo final, senão quem enviou),
 * checa duplicidade e grava na CaixaEntrada.
 */
function registrarAlertaNaCaixa(texto, canal, usuario) {
  const leitura = lerSms(texto);
  if (!leitura.valido) return { status: 'ignorado', item: null, motivo: leitura.motivo };

  const cartoes = lerAba('Cartoes').filter((k) => k.ativo);
  const cartao = leitura.final_cartao ? cartoes.find((k) => apenasFinalCartao(k.final) === leitura.final_cartao) : null;
  const uid = cartao && cartao.titular_id ? cartao.titular_id : (usuario ? usuario.id : '');
  const compra = { valor: leitura.valor, data: leitura.data, estabelecimento: leitura.estabelecimento };
  const duplicado = compraJaExiste(compra, lancamentosAtivos(), lerAba('CaixaEntrada'), leitura.final_cartao, cartao ? cartao.id : '');
  const sugestoes = aplicarRegraLoja(leitura.estabelecimento, sugerirCategoria(leitura.estabelecimento, lerAba('Categorias')), lerAba('RegrasLoja'));
  const item = {
    id: gerarId('ce'), recebido_em: agoraIso(), canal, texto_bruto: sanitizarTextoSms(texto),
    valor: leitura.valor, estabelecimento: leitura.estabelecimento, final_cartao: leitura.final_cartao || '',
    data_compra: leitura.data, sugestao_categoria: sugestoes[0] || 'c_imprevistos', sugestoes,
    usuario_id: uid, status: duplicado ? 'duplicado' : 'pendente', lancamento_id: '',
    hash_dedup: hashDedup(leitura.valor, leitura.data, leitura.final_cartao || '', leitura.estabelecimento),
  };
  inserirLinhas('CaixaEntrada', [item]);
  if (!duplicado) {
    try { notificarNovaCompra(item); } catch (e) { console.warn('Falha ao notificar nova compra: ' + e.message); }
  }
  return { status: item.status, item: itemCaixaPublico(item) };
}

/** Item da caixa de entrada para o app (sem hash interno). */
function itemCaixaPublico(c) {
  const o = Object.assign({}, c);
  delete o.hash_dedup;
  o.sugestoes = Array.isArray(o.sugestoes) ? o.sugestoes : String(o.sugestoes || '').split(';').filter(Boolean);
  return o;
}

/** listar_caixa_entrada: Dependente só vê os próprios itens. */
function acaoListarCaixaEntrada(p, ctx) {
  let itens = lerAba('CaixaEntrada');
  if (ctx.ehDependente) itens = itens.filter((c) => c.usuario_id === ctx.uid);
  if (p.status) itens = itens.filter((c) => c.status === p.status);
  return itens.slice().sort((a, b) => (a.recebido_em < b.recebido_em ? 1 : -1)).map(itemCaixaPublico);
}

/**
 * resolver_caixa_entrada: 'lancar' cria o lançamento (crédito no cartão do final) ou 'ignorar'.
 * Quando a categoria escolhida é diferente da sugerida, a loja é aprendida (RegrasLoja).
 */
function acaoResolverCaixaEntrada(p, ctx) {
  const c = buscarPorId('CaixaEntrada', String(p.id || ''));
  if (!c) throw new ErroUsuario('Item não encontrado');
  if (ctx.ehDependente && c.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  if (c.status === 'lançado') throw new ErroUsuario('Este item já foi lançado.');
  if (p.acao_caixa === 'ignorar') return itemCaixaPublico(atualizarPorId('CaixaEntrada', c.id, { status: 'ignorado' }));

  const cartao = lerAba('Cartoes').find((k) => apenasFinalCartao(k.final) === c.final_cartao);
  const categoriaId = p.categoria_id || c.sugestao_categoria || 'c_imprevistos';
  if (!buscarPorId('Categorias', categoriaId)) throw new ErroUsuario('Categoria não encontrada.');
  if (ctx.ehDependente) {
    const cat = buscarPorId('Categorias', categoriaId);
    if (cat && cat.sensivel && !dependenteVeSensivel(ctx)) throw new ErroUsuario('Sem permissão');
  }
  if (categoriaId !== c.sugestao_categoria && c.estabelecimento) {
    try { aprenderLoja(c.estabelecimento, categoriaId, ctx.uid); } catch (e) { console.warn('Não gravei a regra da loja: ' + e.message); }
  }
  const data = c.data_compra || hojeIso();
  const l = inserirLinhas('Lancamentos', [{
    id: gerarId('l'), data, competencia: competenciaDe(data), tipo: 'despesa', valor: c.valor, categoria_id: categoriaId,
    descricao: p.descricao || c.estabelecimento, estabelecimento: c.estabelecimento, forma_pgto: 'crédito', cartao_id: cartao ? cartao.id : '',
    parcela: '', usuario_id: c.usuario_id || ctx.uid, origem: c.canal === 'email' ? 'email' : c.canal === 'fatura' ? 'fatura' : 'sms',
    anexo_url: '', status: 'confirmado', hash_dedup: hashDedup(c.valor, data, c.final_cartao, c.estabelecimento),
    criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: '',
  }])[0];
  return itemCaixaPublico(atualizarPorId('CaixaEntrada', c.id, { status: 'lançado', lancamento_id: l.id }));
}

/**
 * importar_fatura (Adulto): PDF/imagem via Claude ou texto OFX/CSV via parser próprio.
 * Devolve LeituraExtraida com compras[] e ja_lancada (conciliação ±2 dias, mesmo valor).
 */
function acaoImportarFatura(p, ctx) {
  const cartao = buscarPorId('Cartoes', String(p.cartao_id || ''));
  if (!cartao) throw new ErroUsuario('Escolha o cartão da fatura.');
  let compras = [];
  let origem = 'regex';
  let confianca = 0.9;
  let anexoUrl = '';
  if (p.imagem_base64) {
    const leitura = lerArquivoFatura(p.imagem_base64, p.mime || 'application/pdf', p.nome_arquivo || '', ctx);
    compras = leitura.compras || [];
    origem = leitura.origem_leitura;
    confianca = leitura.confianca;
    anexoUrl = leitura.anexo_url || '';
  } else if (p.texto) {
    compras = lerFaturaTexto(p.texto);
    if (!compras.length) throw new ErroUsuario('Não encontrei compras nesse arquivo. Envie um OFX ou CSV (data;estabelecimento;valor).');
  } else {
    throw new ErroUsuario('Envie o PDF/foto da fatura ou o arquivo OFX/CSV.');
  }
  const lancs = lancamentosAtivos();
  const caixa = lerAba('CaixaEntrada');
  const conciliadas = compras.map((c) => Object.assign({}, c, { ja_lancada: compraJaExiste(c, lancs, caixa, apenasFinalCartao(cartao.final), cartao.id) }));
  return semUndefined({ compras: conciliadas, confianca, origem_leitura: origem, anexo_url: anexoUrl || undefined });
}

/** confirmar_importacao: cria itens pendentes na CaixaEntrada para as compras escolhidas. */
function acaoConfirmarImportacao(p, ctx) {
  const cartao = buscarPorId('Cartoes', String(p.cartao_id || ''));
  if (!cartao) throw new ErroUsuario('Cartão não encontrado');
  const categorias = lerAba('Categorias');
  const regras = lerAba('RegrasLoja');
  const final = apenasFinalCartao(cartao.final);
  const itens = (p.compras || []).filter((c) => c && lerValor(c.valor) > 0).map((c) => {
    const data = normalizarDataIso(c.data) || hojeIso();
    const sug = aplicarRegraLoja(c.estabelecimento || '', sugerirCategoria(c.estabelecimento || '', categorias), regras);
    return {
      id: gerarId('ce'), recebido_em: agoraIso(), canal: 'fatura', texto_bruto: (data + ' ' + (c.estabelecimento || '') + ' ' + lerValor(c.valor) + (c.parcela ? ' ' + c.parcela : '')).slice(0, 300),
      valor: lerValor(c.valor), estabelecimento: String(c.estabelecimento || '').trim(), final_cartao: final, data_compra: data,
      sugestao_categoria: sug[0] || 'c_imprevistos', sugestoes: sug, usuario_id: cartao.titular_id || ctx.uid, status: 'pendente', lancamento_id: '',
      hash_dedup: hashDedup(lerValor(c.valor), data, final, c.estabelecimento || ''),
    };
  });
  if (!itens.length) return [];
  return inserirLinhas('CaixaEntrada', itens).map(itemCaixaPublico);
}

// ---------- Cartões ----------

/** Garante que só os 4 últimos dígitos saem do servidor. */
function cartaoPublico(k) {
  return Object.assign({}, k, { final: apenasFinalCartao(k.final), ativo: !!k.ativo });
}

function acaoListarCartoes() {
  return lerAba('Cartoes').map(cartaoPublico);
}

/** salvar_cartao (Administrador): trunca sempre para 4 dígitos antes de gravar. */
function acaoSalvarCartao(p) {
  const k = p.cartao || {};
  const final = apenasFinalCartao(k.final);
  if (final.length !== 4) throw new ErroUsuario('Informe só os 4 últimos dígitos do cartão.');
  if (!k.apelido) throw new ErroUsuario('Dê um apelido ao cartão (ex.: "Nubank da Mãe").');
  const novo = {
    id: k.id || gerarId('k'), apelido: k.apelido, banco: k.banco || '', final, titular_id: k.titular_id || '',
    dia_fechamento: Number(k.dia_fechamento) || 1, dia_vencimento: Number(k.dia_vencimento) || 10,
    cor: k.cor || 'indigo', ativo: k.ativo === undefined ? true : paraBooleano(k.ativo),
  };
  return cartaoPublico(salvarPorId('Cartoes', novo));
}

// ==============================================================================
// telegram.gs
// ==============================================================================

/**
 * telegram.gs — Bot do Telegram da família (canal gratuito para lançar por mensagem ou foto e
 * receber os avisos das rotinas).
 *
 * Como ligar (passo a passo também no README):
 *  1. No Telegram, fale com @BotFather → /newbot → escolha nome e usuário (termina em "bot").
 *  2. Copie o token e grave em Script Properties: TOKEN_TELEGRAM.
 *  3. Publique o App da Web e rode configurarTelegram() no editor: ele registra o webhook
 *     (URL do App da Web + ?telegram=1&chave=...) e guarda o usuário do bot.
 *  4. No app, cada pessoa pede "Vincular Telegram" (ação vincular_telegram), recebe um código de
 *     6 dígitos e manda "/start CODIGO" para o bot. Pronto: o chat fica ligado ao usuário.
 *
 * O que o bot faz:
 *  - texto → assistente (mesmas regras/IA da tela Assistente), inclusive "gastei 45 na padaria";
 *  - foto → baixa o arquivo (getFile), lê o cupom (leitura.gs) e responde com botões inline
 *    "Confirmar" / "Trocar categoria" / "Cancelar"; a confirmação grava o lançamento;
 *  - avisos das rotinas (rotinas.gs) chegam pelo chat quando `telegram_ativo` está ligado.
 *
 * Segurança: o webhook só aceita chamadas com a `chave` gerada em configurarTelegram(); o chat só
 * funciona depois de vinculado a um usuário ativo; nunca gravamos o token no código ou na planilha.
 */

const URL_API_TELEGRAM = 'https://api.telegram.org/bot';
const MINUTOS_CUPOM_PENDENTE = 30;

// ---------- Configuração ----------

function tokenTelegram() {
  return propriedade('TOKEN_TELEGRAM', '');
}

function telegramConfigurado() {
  return !!tokenTelegram();
}

/** Chamada genérica à Bot API. Devolve o `result` ou lança erro. */
function chamarTelegram(metodo, parametros) {
  const token = tokenTelegram();
  if (!token) throw new Error('TOKEN_TELEGRAM não configurado');
  const resposta = UrlFetchApp.fetch(URL_API_TELEGRAM + token + '/' + metodo, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(parametros || {}), muteHttpExceptions: true,
  });
  const json = JSON.parse(resposta.getContentText() || '{}');
  if (!json.ok) throw new Error('Telegram ' + metodo + ' falhou: ' + (json.description || resposta.getResponseCode()));
  return json.result;
}

/**
 * configurarTelegram(): rode uma vez no editor depois de publicar o App da Web.
 * Registra o webhook e guarda o usuário do bot (para montar o link t.me/...).
 */
function configurarTelegram() {
  if (!telegramConfigurado()) throw new Error('Defina TOKEN_TELEGRAM nas Propriedades do script antes (token do @BotFather).');
  const urlApp = urlDoAppWeb();
  if (!urlApp) throw new Error('Publique o App da Web antes (Implantar → Nova implantação) para existir uma URL.');
  let chave = propriedade('TELEGRAM_CHAVE_WEBHOOK', '');
  if (!chave) { chave = gerarToken(24); definirPropriedade('TELEGRAM_CHAVE_WEBHOOK', chave); }
  const eu = chamarTelegram('getMe', {});
  if (eu && eu.username) definirPropriedade('USUARIO_BOT_TELEGRAM', eu.username);
  chamarTelegram('setWebhook', { url: urlApp + '?telegram=1&chave=' + chave, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
  salvarConfigChaves({ telegram_ativo: true });
  console.log('Webhook do Telegram configurado para @' + (eu ? eu.username : '?') + '. Peça aos membros para vincular pelo app.');
  return { bot: eu ? eu.username : '', webhook: urlApp + '?telegram=1' };
}

/** Link do bot (https://t.me/NomeDoBot) ou vazio. */
function urlBotTelegram() {
  const nome = propriedade('USUARIO_BOT_TELEGRAM', '');
  return nome ? 'https://t.me/' + nome.replace(/^@/, '') : '';
}

// ---------- Vínculo chat ↔ usuário ----------

/** vincular_telegram: gera um código de 6 dígitos para o usuário mandar "/start CODIGO" ao bot. */
function acaoVincularTelegram(p, ctx) {
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const existente = lerAba('Telegram').find((r) => r.usuario_id === ctx.uid);
  if (existente) atualizarPorId('Telegram', ctx.uid, { codigo }, 'usuario_id');
  else inserirLinhas('Telegram', [{ usuario_id: ctx.uid, chat_id: '', codigo, vinculado_em: '', ativo: false }]);
  return { codigo, url_bot: urlBotTelegram(), bot_configurado: telegramConfigurado() };
}

/**
 * Interpreta "/start CODIGO" (função pura). Devolve null quando não é /start, o código de 6 dígitos
 * quando ele vem certo ou '' quando falta/está malformado (o bot então explica como pegar o código).
 */
function parsearComandoStart(texto) {
  const m = String(texto || '').trim().match(/^\/start(?:@\w+)?(?:[\s=]+(.*))?$/i);
  if (!m) return null; // não é /start
  const resto = String(m[1] || '').trim();
  return /^\d{6}$/.test(resto) ? resto : '';
}

/** Usuário vinculado a um chat_id (ou null). */
function usuarioPorChatTelegram(chatId) {
  const vinculo = lerAba('Telegram').find((r) => String(r.chat_id) === String(chatId) && r.ativo);
  if (!vinculo) return null;
  const u = buscarPorId('Usuarios', vinculo.usuario_id);
  return u && u.ativo ? u : null;
}

/** Liga o chat ao usuário dono do código. Devolve o usuário ou null. */
function vincularChatPorCodigo(chatId, codigo) {
  const vinculo = lerAba('Telegram').find((r) => String(r.codigo) === String(codigo) && r.codigo);
  if (!vinculo) return null;
  const u = buscarPorId('Usuarios', vinculo.usuario_id);
  if (!u || !u.ativo) return null;
  // Um chat só pode pertencer a uma pessoa: desliga vínculos antigos do mesmo chat.
  lerAba('Telegram').filter((r) => String(r.chat_id) === String(chatId) && r.usuario_id !== u.id).forEach((r) => atualizarPorId('Telegram', r.usuario_id, { ativo: false }, 'usuario_id'));
  atualizarPorId('Telegram', u.id, { chat_id: String(chatId), codigo: '', vinculado_em: agoraIso(), ativo: true }, 'usuario_id');
  return u;
}

// ---------- Envio ----------

/** Markdown do app (**negrito**) → Markdown do Telegram (*negrito*), escapando o que atrapalha. */
function textoParaTelegram(texto) {
  return String(texto || '').replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/_\((.+?)\)_/g, '($1)').replace(/`/g, '\'');
}

/** Envia uma mensagem para um chat. Nunca lança (devolve false em falha). */
function enviarMensagemTelegram(chatId, texto, extra) {
  try {
    chamarTelegram('sendMessage', Object.assign({ chat_id: chatId, text: textoParaTelegram(texto).slice(0, 4000), parse_mode: 'Markdown' }, extra || {}));
    return true;
  } catch (e) {
    // Markdown mal formado derruba o envio; tenta sem formatação.
    try { chamarTelegram('sendMessage', Object.assign({ chat_id: chatId, text: String(texto || '').replace(/\*\*/g, '').slice(0, 4000) }, extra || {})); return true; } catch (e2) { console.warn('Telegram: ' + e2.message); return false; }
  }
}

/** enviarTelegram(usuario_id, texto): usado pelas rotinas. Devolve true se enviou. */
function enviarTelegram(usuarioId, texto) {
  if (!telegramConfigurado()) return false;
  const cfg = lerConfig();
  if (cfg.telegram_ativo === false) return false;
  const vinculo = lerAba('Telegram').find((r) => r.usuario_id === usuarioId && r.ativo && r.chat_id);
  if (!vinculo) return false;
  return enviarMensagemTelegram(vinculo.chat_id, texto);
}

// ---------- Webhook ----------

/** Entrada do webhook (?telegram=1). Sempre devolve algo serializável; nunca deixa o Telegram reenviar em loop. */
function tratarWebhookTelegram(e, parametrosUrl) {
  const chave = propriedade('TELEGRAM_CHAVE_WEBHOOK', '');
  if (!chave || String((parametrosUrl || {}).chave || '') !== chave) throw new ErroUsuario('Família não encontrada');
  let update = {};
  try { update = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (erro) { return { ignorado: 'corpo inválido' }; }
  try {
    if (update.callback_query) return tratarCallbackTelegram(update.callback_query);
    if (update.message) return tratarMensagemTelegram(update.message);
  } catch (erro) {
    console.error('Telegram: ' + erro.message);
    const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
    if (chatId) enviarMensagemTelegram(chatId, erro instanceof ErroUsuario ? erro.message : 'Algo deu errado por aqui. Tente de novo em instantes.');
    return { erro: erro.message };
  }
  return { ignorado: 'sem mensagem' };
}

/** Mensagem de texto ou foto. */
function tratarMensagemTelegram(msg) {
  const chatId = msg.chat.id;
  const texto = String(msg.text || msg.caption || '').trim();
  const start = parsearComandoStart(texto);
  if (start !== null) {
    if (!start) { enviarMensagemTelegram(chatId, 'Olá! Para ligar este chat à sua conta, abra o app Finanças da Família → Configurações → Telegram, pegue o código de 6 dígitos e mande aqui: /start 123456'); return { status: 'instrucoes' }; }
    const u = vincularChatPorCodigo(chatId, start);
    if (!u) { enviarMensagemTelegram(chatId, 'Código não encontrado ou vencido. Gere um novo no app (Configurações → Telegram).'); return { status: 'codigo_invalido' }; }
    enviarMensagemTelegram(chatId, 'Pronto, ' + u.apelido + '! Agora você pode mandar "gastei 45 na padaria no pix", perguntar "quanto gastamos com delivery este mês?" ou enviar a foto de um cupom.');
    return { status: 'vinculado', usuario_id: u.id };
  }
  const usuario = usuarioPorChatTelegram(chatId);
  if (!usuario) { enviarMensagemTelegram(chatId, 'Este chat ainda não está ligado a ninguém da família. No app, vá em Configurações → Telegram e mande /start com o código.'); return { status: 'nao_vinculado' }; }
  const ctx = contextoPara(usuario, {});
  if (/^\/(ajuda|help)/i.test(texto)) {
    enviarMensagemTelegram(chatId, 'Posso: lançar gastos ("gastei 45 na padaria"), responder sobre gastos, assinaturas, contas da semana e projetos, e ler fotos de cupom. Comandos: /resumo, /contas, /ajuda.');
    return { status: 'ajuda' };
  }
  if (msg.photo && msg.photo.length) return tratarFotoTelegram(msg, usuario, ctx);
  let pergunta = texto;
  if (/^\/resumo/i.test(texto)) pergunta = 'como fechamos ' + nomeMes(competenciaDe()) + '?';
  if (/^\/contas/i.test(texto)) pergunta = 'contas que vencem esta semana';
  if (!pergunta) { enviarMensagemTelegram(chatId, 'Manda um texto ou a foto de um cupom.'); return { status: 'vazio' }; }
  const resposta = responderAssistente(ctx, pergunta, listarHistoricoCurto(usuario.id), null, 'telegram');
  let saida = resposta.texto;
  if (resposta.barras && resposta.barras.length) saida += '\n\n' + resposta.barras.map((b) => '• ' + b.rotulo + ': ' + moeda(b.valor)).join('\n');
  enviarMensagemTelegram(chatId, saida);
  return { status: 'respondido', usuario_id: usuario.id };
}

/** Últimas mensagens do usuário (para a IA ter contexto no Telegram). */
function listarHistoricoCurto(uid) {
  return lerAba('Conversas').filter((c) => c.usuario_id === uid).sort((a, b) => (a.data < b.data ? -1 : 1)).slice(-6).map((c) => ({ papel: c.papel, texto: c.texto }));
}

/** Baixa um arquivo do Telegram pelo file_id. Devolve { base64, mime }. */
function baixarArquivoTelegram(fileId) {
  const info = chamarTelegram('getFile', { file_id: fileId });
  const resposta = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + tokenTelegram() + '/' + info.file_path, { muteHttpExceptions: true });
  if (resposta.getResponseCode() !== 200) throw new Error('Não consegui baixar a foto do Telegram');
  const blob = resposta.getBlob();
  const mime = blob.getContentType() || 'image/jpeg';
  return { base64: Utilities.base64Encode(blob.getBytes()), mime: MIMES_IMAGEM.indexOf(mime) >= 0 ? mime : 'image/jpeg' };
}

/** Foto → leitura do cupom → botões de confirmação. O cupom pendente fica no cache por 30 minutos. */
function tratarFotoTelegram(msg, usuario, ctx) {
  const chatId = msg.chat.id;
  const foto = msg.photo[msg.photo.length - 1]; // a maior resolução
  const arquivo = baixarArquivoTelegram(foto.file_id);
  const blob = Utilities.newBlob(Utilities.base64Decode(arquivo.base64), arquivo.mime, nomeArquivoLeitura('cupom', arquivo.mime, 'telegram'));
  const salvo = salvarArquivoLeitura(blob, 'cupom', blob.getName());
  const leitura = lerDocumento(arquivo.base64, arquivo.mime, 'cupom', blob, ctx);
  if (!(leitura.valor > 0)) { enviarMensagemTelegram(chatId, 'Não consegui ler o valor do cupom. Tente uma foto com mais luz ou escreva: "gastei 45 na padaria".'); return { status: 'nao_lido' }; }
  const cat = leitura.categoria_id ? buscarPorId('Categorias', leitura.categoria_id) : null;
  const pendente = { valor: leitura.valor, data: leitura.data || hojeIso(), estabelecimento: leitura.estabelecimento || '', descricao: leitura.descricao || leitura.estabelecimento || '', forma_pgto: leitura.forma_pgto || 'débito', categoria_id: leitura.categoria_id || 'c_imprevistos', anexo_url: salvo.url, sugestoes: sugerirCategoria((leitura.estabelecimento || '') + ' ' + (leitura.descricao || ''), categoriasVisiveis(ctx)) };
  guardarCupomPendente(chatId, pendente);
  enviarMensagemTelegram(chatId, 'Li: *' + moeda(pendente.valor) + '* em ' + (pendente.estabelecimento || 'cupom') + ' (' + dataBr(pendente.data) + ')\nCategoria: *' + (cat ? cat.nome : pendente.categoria_id) + '*', {
    reply_markup: { inline_keyboard: [[{ text: 'Confirmar', callback_data: 'conf' }, { text: 'Trocar categoria', callback_data: 'cats' }, { text: 'Cancelar', callback_data: 'canc' }]] },
  });
  return { status: 'aguardando_confirmacao' };
}

function chaveCupomPendente(chatId) { return 'tg_cupom_' + chatId; }
function guardarCupomPendente(chatId, dados) { CacheService.getScriptCache().put(chaveCupomPendente(chatId), JSON.stringify(dados), MINUTOS_CUPOM_PENDENTE * 60); }
function lerCupomPendente(chatId) { const t = CacheService.getScriptCache().get(chaveCupomPendente(chatId)); return t ? JSON.parse(t) : null; }
function apagarCupomPendente(chatId) { CacheService.getScriptCache().remove(chaveCupomPendente(chatId)); }

/** Botões inline: confirmar, trocar categoria (cat:<id>) ou cancelar. */
function tratarCallbackTelegram(cb) {
  const chatId = cb.message.chat.id;
  const dado = String(cb.data || '');
  try { chamarTelegram('answerCallbackQuery', { callback_query_id: cb.id }); } catch (e) { /* ignora */ }
  const usuario = usuarioPorChatTelegram(chatId);
  if (!usuario) { enviarMensagemTelegram(chatId, 'Este chat não está vinculado. Use /start com o código do app.'); return { status: 'nao_vinculado' }; }
  const ctx = contextoPara(usuario, {});
  const pendente = lerCupomPendente(chatId);
  if (dado === 'canc') { apagarCupomPendente(chatId); enviarMensagemTelegram(chatId, 'Cancelado. Nada foi lançado.'); return { status: 'cancelado' }; }
  if (!pendente) { enviarMensagemTelegram(chatId, 'Esse cupom já expirou. Envie a foto de novo.'); return { status: 'expirado' }; }
  if (dado === 'cats') {
    const cats = (pendente.sugestoes || []).map((id) => buscarPorId('Categorias', id)).filter(Boolean).slice(0, 6);
    const linhas = [];
    for (let i = 0; i < cats.length; i += 2) linhas.push(cats.slice(i, i + 2).map((c) => ({ text: c.nome, callback_data: 'cat:' + c.id })));
    linhas.push([{ text: 'Cancelar', callback_data: 'canc' }]);
    enviarMensagemTelegram(chatId, 'Qual é a despesa?', { reply_markup: { inline_keyboard: linhas } });
    return { status: 'escolhendo_categoria' };
  }
  let categoriaId = pendente.categoria_id;
  let aprendeu = false;
  if (dado.indexOf('cat:') === 0) {
    const escolhida = dado.slice(4);
    if (buscarPorId('Categorias', escolhida)) { aprendeu = escolhida !== pendente.categoria_id; categoriaId = escolhida; }
  } else if (dado !== 'conf') return { ignorado: dado };
  const l = acaoSalvarLancamento({ lancamento: { valor: pendente.valor, data: pendente.data, categoria_id: categoriaId, descricao: pendente.descricao, estabelecimento: pendente.estabelecimento, forma_pgto: pendente.forma_pgto, anexo_url: pendente.anexo_url, origem: 'telegram' }, aprender_loja: aprendeu }, ctx)[0];
  apagarCupomPendente(chatId);
  const cat = buscarPorId('Categorias', l.categoria_id);
  enviarMensagemTelegram(chatId, 'Lançado: *' + moeda(l.valor) + ' · ' + (cat ? cat.nome : '') + '* em ' + dataBr(l.data) + (aprendeu ? '. Aprendi: ' + (pendente.estabelecimento || 'esta loja') + ' cai em ' + (cat ? cat.nome : '') + ' daqui em diante.' : '.'));
  gravarConversa(usuario.id, [{ id: gerarId('m'), papel: 'eu', texto: '(foto de cupom)', data: agoraIso() }, mensagemAssistente('Lancei ' + moeda(l.valor) + ' · ' + (cat ? cat.nome : ''), { lancamento: l, etiqueta: 'lançado' })]);
  return { status: 'lancado', lancamento_id: l.id };
}
