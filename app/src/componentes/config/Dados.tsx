import { useState } from 'react'
import { api, emModoDemo } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { RegistroLog } from '../../tipos'
import { Carregando } from '../Carregando'

export function Dados() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const recarregarBoot = useSessao((e) => e.recarregarBoot)
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const demo = emModoDemo()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [log, setLog] = useState<RegistroLog[] | null>(null)
  const c = boot.config

  async function rodar(nome: string, fn: () => Promise<void>) {
    setOcupado(nome)
    try { await fn() } catch (e) { avisar(e instanceof Error ? e.message : 'Algo deu errado', { tipo: 'erro' }) } finally { setOcupado(null) }
  }
  const abrir = (url?: string) => { if (url) window.open(url, '_blank', 'noopener') }

  const exportar = (formato: 'csv' | 'xlsx') => rodar(formato, async () => {
    const r = await api<{ url: string }>('exportar', { formato })
    if (formato === 'csv' && r.url.startsWith('blob:')) {
      const a = document.createElement('a'); a.href = r.url; a.download = `financas-familia.csv`; a.click()
    } else abrir(r.url)
    avisar('Exportação pronta ✅', { tipo: 'ok' })
  })

  const botao = (nome: string, icone: string, texto: string, descricao: string, acao: () => void, classe = 'botao-secundario') => (
    <button key={nome} className={`botao ${classe} w-full justify-start !py-3 !h-auto`} onClick={acao} disabled={!!ocupado}>
      <span className="text-2xl" aria-hidden>{ocupado === nome ? '⏳' : icone}</span>
      <span className="text-left flex-1"><span className="block">{texto}</span><span className="block text-xs font-normal opacity-80">{descricao}</span></span>
    </button>
  )

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-2">
        <h2 className="titulo-secao">Seus dados são seus</h2>
        <p className="text-sm text-suave">Tudo fica na planilha e na pasta da família no Google Drive. O app só lê e escreve lá.</p>
        {botao('planilha', '📗', 'Abrir a planilha no Drive', 'BD_Financas_Familia — todas as abas', () => abrir(c.url_planilha))}
        {botao('pasta', '📁', 'Abrir a pasta da família', 'Cupons, contas, faturas, projetos e backups', () => abrir(c.url_pasta_drive))}
      </section>

      {ehAdmin && (
        <>
          <section className="card p-4 space-y-2">
            <h2 className="titulo-secao">Exportar e backup</h2>
            {botao('csv', '📄', 'Exportar CSV', 'Abre no Excel, Numbers ou Google Planilhas', () => exportar('csv'))}
            {botao('xlsx', '📊', 'Exportar Excel (.xlsx)', 'Uma aba por tipo de dado', () => exportar('xlsx'))}
            {botao('backup', '💾', 'Fazer backup agora', 'Cópia da planilha na pasta Backups (além do semanal automático)', () => rodar('backup', async () => { const r = await api<{ url: string }>('backup_agora'); avisar('Backup feito ✅', { tipo: 'ok' }); abrir(r.url) }))}
          </section>

          <section className="card p-4 space-y-2">
            <h2 className="titulo-secao">Log de auditoria</h2>
            <p className="text-sm text-suave">Quem fez o quê e quando (últimas 100 ações).</p>
            {log === null ? (
              botao('log', '🕵️', 'Ver log de auditoria', 'Exclusões, pagamentos, mudanças de configuração', () => rodar('log', async () => setLog(await api<RegistroLog[]>('log', { limite: 100 }))))
            ) : ocupado === 'log' ? <Carregando /> : log.length ? (
              <ul className="divide-y divide-borda text-sm max-h-96 overflow-y-auto">
                {log.map((r, i) => {
                  const u = boot.usuarios.find((x) => x.id === r.usuario_id)
                  return (
                    <li key={i} className="py-2 flex gap-2">
                      <span className="text-suave text-xs w-28 shrink-0">{new Date(r.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex-1"><strong>{u?.apelido ?? r.usuario_id}</strong> · {r.acao}<span className="block text-suave text-xs">{r.detalhe}</span></span>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="text-sm text-suave">Nenhuma ação registrada ainda.</p>}
          </section>
        </>
      )}

      {demo && (
        <section className="card p-4 space-y-2" style={{ borderColor: 'var(--amarelo)' }}>
          <h2 className="titulo-secao">Modo demonstração</h2>
          {botao('demo', '🔄', 'Reiniciar dados de exemplo', 'Apaga o que você mexeu e recria os 12 meses de exemplo', () => rodar('demo', async () => { await api('reiniciar_demo'); await recarregarBoot(); avisar('Dados de exemplo recriados ✅', { tipo: 'ok' }) }), 'botao-amarelo')}
        </section>
      )}
    </div>
  )
}
