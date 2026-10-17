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
    .replace(/[̀-ͯ]/g, '')
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
