/** "Experimentar com dados de exemplo": escolha entre os 4 perfis da Família Reis. */
import { Avatar } from '../Avatar'
import { Icone } from '../Icone'
import { PERFIS_DEMO } from './perfis'
import type { Sessao } from '../../api/cliente'

export function EscolherDemo({ aoEscolher, aoCancelar }: { aoEscolher: (sessao: Sessao, perfil: (typeof PERFIS_DEMO)[number]) => void; aoCancelar: () => void }) {
  return (
    <div className="card" style={{ width: '100%', textAlign: 'left', padding: 18 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Dados de exemplo</h2>
      <p className="sub" style={{ margin: '0 0 10px' }}>Família Reis, 12 meses de lançamentos fictícios, tudo guardado só neste aparelho. Escolha com quem entrar:</p>
      <div className="rows">
        {PERFIS_DEMO.map((p) => (
          <button key={p.usuario_id} type="button" className="row" style={{ minHeight: 48 }} onClick={() => aoEscolher({ url_api: '', token_familia: 'demo', token: p.token, usuario_id: p.usuario_id }, p)}>
            <Avatar usuario={{ nome: p.nome, apelido: p.apelido, avatar: '', cor: p.cor }} tamanho={34} />
            <span className="t"><b>{p.apelido}</b><small>{p.perfil}</small></span>
            <Icone nome="chevron-right" style={{ color: 'var(--muted)' }} />
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={aoCancelar}>Voltar</button>
    </div>
  )
}
