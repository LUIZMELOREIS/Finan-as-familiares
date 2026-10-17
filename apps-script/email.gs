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

/** Processa as duas filas de e-mail. Devolve { contas, alertas }. */
function processarEmails() {
  const processado = obterMarcador(MARCADOR_PROCESSADO);
  obterMarcador(MARCADOR_CONTAS);
  obterMarcador(MARCADOR_ALERTAS);
  const resultado = { contas: 0, alertas: 0, erros: 0 };

  const contas = GmailApp.search('label:"' + MARCADOR_CONTAS + '" -label:"' + MARCADOR_PROCESSADO + '"', 0, MAX_THREADS_POR_VEZ);
  contas.forEach((thread) => {
    try { resultado.contas += processarThreadConta(thread); } catch (e) { resultado.erros++; console.error('Conta por e-mail: ' + e.message); }
    thread.addLabel(processado);
  });

  const alertas = GmailApp.search('label:"' + MARCADOR_ALERTAS + '" -label:"' + MARCADOR_PROCESSADO + '"', 0, MAX_THREADS_POR_VEZ);
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
  const admin = lerAba('Usuarios').find((u) => u.perfil === 'Administrador' && u.ativo) || null;
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
