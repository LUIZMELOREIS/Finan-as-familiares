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

const TAMANHO_PEDACO_CACHE = 90000; // CacheService aceita até 100 KB por chave
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
