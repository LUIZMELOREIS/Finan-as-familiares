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
    if (texto) {
      try {
        Object.assign(params, JSON.parse(texto));
      } catch (erro) {
        throw new ErroUsuario('Não entendi o pedido (o corpo não é um JSON válido).');
      }
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
