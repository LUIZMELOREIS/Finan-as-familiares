import { useEffect, useState } from 'react'
import { ReceiptScanner } from '../components/ReceiptScanner'
import { UploadArea } from '../components/UploadArea'
import { AiStatusCard } from '../components/AiStatusCard'

type Etapa = 'escolher' | 'lendo' | 'conferir'

interface Extraido { valor: string; data: string; loja: string; categoria: string }

/**
 * ==== TELA DE LEITURA INTELIGENTE ====
 * 1) tirar foto ou enviar arquivo → 2) status "IA lendo" → 3) conferir campos e salvar.
 * A extração aqui é simulada; no app real ela vem da API (Claude) a partir da imagem/PDF.
 */
export function SmartUploadScreen({ aoSalvar }: { aoSalvar: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>('escolher')
  const [previa, setPrevia] = useState('')
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [dados, setDados] = useState<Extraido>({ valor: '', data: '', loja: '', categoria: 'mercado' })

  // Simula o tempo de processamento da IA e preenche os campos.
  useEffect(() => {
    if (etapa !== 'lendo') return
    const t = setTimeout(() => {
      setDados({ valor: '87,40', data: new Date().toISOString().slice(0, 10), loja: 'Padaria Pão Quente', categoria: 'mercado' })
      setEtapa('conferir')
    }, 2500)
    return () => clearTimeout(t)
  }, [etapa])

  const comecar = (imagem: string, nome = '') => { setPrevia(imagem); setNomeArquivo(nome); setEtapa('lendo') }

  return (
    <>
      <header>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Lançar com IA</h1>
        <p style={{ color: 'var(--muted)' }}>Fotografe o cupom ou envie um PDF. A IA preenche o lançamento.</p>
      </header>

      {etapa === 'escolher' && (
        <>
          <ReceiptScanner aoCapturar={(img) => comecar(img)} />
          <UploadArea aoEscolher={(arq) => {
            if (arq.type.startsWith('image/')) { const r = new FileReader(); r.onload = () => comecar(String(r.result), arq.name); r.readAsDataURL(arq) }
            else comecar('', arq.name)
          }} />
        </>
      )}

      {etapa === 'lendo' && (
        <>
          {previa ? <img className="previa" src={previa} alt="Prévia do cupom" /> : <p className="card" style={{ color: 'var(--muted)' }}>Arquivo: {nomeArquivo}</p>}
          <AiStatusCard />
        </>
      )}

      {etapa === 'conferir' && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); aoSalvar() }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Confira e salve</h2>
          <div className="campo"><label htmlFor="valor">Valor (R$)</label><input id="valor" inputMode="decimal" value={dados.valor} onChange={(e) => setDados({ ...dados, valor: e.target.value })} /></div>
          <div className="campo"><label htmlFor="data">Data</label><input id="data" type="date" value={dados.data} onChange={(e) => setDados({ ...dados, data: e.target.value })} /></div>
          <div className="campo"><label htmlFor="loja">Estabelecimento</label><input id="loja" value={dados.loja} onChange={(e) => setDados({ ...dados, loja: e.target.value })} /></div>
          <div className="campo">
            <label htmlFor="categoria">Categoria</label>
            <select id="categoria" value={dados.categoria} onChange={(e) => setDados({ ...dados, categoria: e.target.value })}>
              <option value="mercado">Mercado</option><option value="transporte">Transporte</option><option value="lazer">Lazer</option>
              <option value="saude">Saúde</option><option value="casa">Casa</option><option value="educacao">Educação</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEtapa('escolher')}>Refazer</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Salvar lançamento</button>
          </div>
        </form>
      )}
    </>
  )
  /* ==== FIM DA LEITURA INTELIGENTE ==== */
}
