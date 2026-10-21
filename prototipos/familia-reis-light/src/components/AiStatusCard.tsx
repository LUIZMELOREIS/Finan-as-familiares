/** ==== STATUS DA IA: spinner + texto animado + esqueleto dos campos que serão extraídos ==== */
export function AiStatusCard() {
  return (
    <section className="card" aria-live="polite" aria-busy="true">
      <div className="status-ia">
        <div className="spinner" aria-hidden="true" />
        <div>
          <p style={{ fontWeight: 700 }}><span className="pontos">IA lendo o seu recibo</span></p>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Extraindo valor, data, estabelecimento e categoria</p>
        </div>
      </div>
      <div aria-hidden="true">
        <div className="esqueleto" style={{ width: '45%' }} />
        <div className="esqueleto" style={{ width: '70%' }} />
        <div className="esqueleto" style={{ width: '55%' }} />
      </div>
    </section>
  )
  /* ==== FIM DO STATUS DA IA ==== */
}
