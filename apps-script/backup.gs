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
