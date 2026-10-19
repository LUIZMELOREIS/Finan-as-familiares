/** "Já tenho a URL da API": o administrador conecta o primeiro celular (URL + token da família + código de convite). */
import { useState } from 'react'
import { api } from '../../api/cliente'
import type { DadosConvite } from './Convite'

export function ConectarApi({ aoConectar, aoCancelar, codigoInicial = '', perfil = 'Administrador' }: { aoConectar: (c: DadosConvite) => void; aoCancelar: () => void; codigoInicial?: string; perfil?: string }) {
  const [url, setUrl] = useState('')
  const [tokenFamilia, setTokenFamilia] = useState('')
  const [codigo, setCodigo] = useState(codigoInicial)
  const [erro, setErro] = useState('')
  const [testando, setTestando] = useState(false)

  const conectar = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = url.trim()
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(u) && !/^https:\/\//.test(u)) { setErro('A URL deve começar com https:// (normalmente termina em /exec).'); return }
    setTestando(true); setErro('')
    try {
      const r = await api<{ versao: string; nome_familia: string }>('ping', {}, { url_api: u, token_familia: tokenFamilia.trim(), token: '', usuario_id: '' })
      if (!r?.versao) throw new Error('A API respondeu, mas não parece ser o Finanças da Família.')
      aoConectar({ codigo: codigo.trim().toUpperCase(), perfil, url_api: u, token_familia: tokenFamilia.trim() })
    } catch (er) {
      setErro(er instanceof Error ? er.message : 'Não foi possível conectar')
    } finally { setTestando(false) }
  }

  return (
    <form className="card" style={{ width: '100%', textAlign: 'left', padding: 18 }} onSubmit={conectar}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Conectar à API da família</h2>
      <p className="sub" style={{ margin: '0 0 12px' }}>Os três dados aparecem no registro de <code>linkDeAcesso()</code> do Apps Script (o token também fica na aba Config da planilha).</p>
      <div className="field"><label htmlFor="api-url">URL da API (App da Web)</label><input id="api-url" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" placeholder="https://script.google.com/macros/s/…/exec" required /></div>
      <div className="field"><label htmlFor="api-fam">Token da família</label><input id="api-fam" value={tokenFamilia} onChange={(e) => setTokenFamilia(e.target.value)} autoComplete="off" required /></div>
      <div className="field"><label htmlFor="api-conv">Código de convite do administrador</label><input id="api-conv" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" style={{ textTransform: 'uppercase' }} required /></div>
      {erro && <p role="alert" style={{ color: '#FF8B91', fontSize: 13, margin: '0 0 10px' }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={testando}>{testando ? 'Testando a conexão…' : 'Conectar'}</button>
      <button type="button" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={aoCancelar}>Voltar</button>
    </form>
  )
}
