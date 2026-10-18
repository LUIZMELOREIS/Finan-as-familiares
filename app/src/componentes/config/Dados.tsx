import { useEffect, useState } from 'react'
import type { RegistroLog } from '../../tipos'
import { api, emModoDemo } from '../../api/cliente'
import { useBoot } from '../../store/sessao'
import { dataBr } from '../../util/formato'
import { Icone } from '../Icone'
import { Carregando } from '../Carregando'
import { useAcao } from './comuns'

function abrirOuBaixar(url: string, nome: string) {
  if (!url || url === '#') throw new Error('O servidor não devolveu um arquivo. No modo demonstração só a exportação CSV está disponível.')
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
  } else window.open(url, '_blank', 'noopener')
}

export function Dados() {
  const boot = useBoot()
  const { rodar, ocupado } = useAcao()
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const [log, setLog] = useState<RegistroLog[] | null>(null)
  useEffect(() => { if (ehAdmin) api<RegistroLog[]>('log', { limite: 40 }).then(setLog).catch(() => setLog([])) }, [ehAdmin])
  const exportar = (formato: 'csv' | 'xlsx') => rodar(async () => {
    const { url } = await api<{ url: string }>('exportar', { formato })
    abrirOuBaixar(url, formato === 'csv' ? 'lancamentos.csv' : 'lancamentos.xlsx')
  })
  const backup = () => rodar(async () => {
    const { url } = await api<{ url: string }>('backup_agora')
    if (url && url !== '#') window.open(url, '_blank', 'noopener')
  }, 'Backup feito na pasta Backups do Drive.')
  const demo = emModoDemo()
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="flex flex-col gap-3.5">
        <div className="card">
          <h3>Onde ficam os dados <span className="sub">no Google Drive da família</span></h3>
          <div className="rows">
            <a className="row" style={{ minHeight: 56, textDecoration: 'none', color: 'inherit', opacity: boot.config.url_planilha ? 1 : 0.6 }} href={boot.config.url_planilha || undefined} target="_blank" rel="noreferrer" aria-disabled={!boot.config.url_planilha}>
              <span className="ico-sm"><Icone nome="file-spreadsheet" /></span><span className="t"><b>Abrir a planilha</b><small>{boot.config.url_planilha ? 'BD_Financas_Familia (todas as abas)' : demo ? 'Indisponível no modo demonstração' : 'URL não informada na aba Config'}</small></span><Icone nome="external-link" style={{ color: 'var(--faint)' }} />
            </a>
            <a className="row" style={{ minHeight: 56, textDecoration: 'none', color: 'inherit', opacity: boot.config.url_pasta_drive ? 1 : 0.6 }} href={boot.config.url_pasta_drive || undefined} target="_blank" rel="noreferrer" aria-disabled={!boot.config.url_pasta_drive}>
              <span className="ico-sm"><Icone nome="database" /></span><span className="t"><b>Abrir a pasta no Drive</b><small>Comprovantes, contas, faturas, identidade e backups</small></span><Icone nome="external-link" style={{ color: 'var(--faint)' }} />
            </a>
          </div>
        </div>
        {ehAdmin && (
          <div className="card">
            <h3>Exportar e proteger</h3>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-ghost" disabled={ocupado} onClick={() => exportar('csv')}><Icone nome="download" />Exportar CSV</button>
              <button className="btn btn-ghost" disabled={ocupado} onClick={() => exportar('xlsx')}><Icone nome="file-spreadsheet" />Exportar Excel</button>
              <button className="btn btn-primary" disabled={ocupado} onClick={backup}><Icone nome="shield-check" />Fazer backup agora</button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>O backup semanal é automático (pasta Backups). Exclusões são reversíveis: nada é apagado da planilha, só marcado.</p>
          </div>
        )}
      </div>
      {ehAdmin && (
        <div className="card">
          <h3>Log de auditoria <span className="sub">últimas ações</span></h3>
          {log === null ? <Carregando /> : (
            <div className="rows" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {log.map((r, i) => (
                <div key={i} className="row">
                  <span className="ico-sm"><Icone nome="file-text" /></span>
                  <span className="t"><b>{r.acao}</b><small>{dataBr(r.data.slice(0, 10))} {r.data.slice(11, 16)} · {boot.usuarios.find((u) => u.id === r.usuario_id)?.apelido ?? r.usuario_id} · {r.detalhe}</small></span>
                </div>
              ))}
              {!log.length && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum registro ainda.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
