import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { useBoot, useSessao } from '../store/sessao'
import { emModoDemo } from '../api/cliente'
import { PADROES_BANCO, lerSms } from '../util/extrator'
import { moeda } from '../util/formato'
import { Abas, LinhaCopiar, baixarArquivo, copiarTexto } from '../componentes/config/comuns'

const URL_EXEMPLO = 'https://script.google.com/macros/s/SEU_ID_DE_IMPLANTACAO/exec'
const SMS_EXEMPLO = 'Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12.'

function Passo({ n, titulo, children }: { n: number; titulo: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-9 h-9 rounded-full bg-primaria text-white font-bold flex items-center justify-center shrink-0" aria-hidden>{n}</span>
      <div className="flex-1 min-w-0 pt-1">
        <div className="font-semibold">{titulo}</div>
        {children && <div className="text-sm text-suave mt-0.5 space-y-1">{children}</div>}
      </div>
    </li>
  )
}
const Menu = ({ children }: { children: React.ReactNode }) => <kbd className="inline-block bg-painel border border-borda rounded px-1.5 py-0.5 text-xs font-sans not-italic text-texto">{children}</kbd>

export default function CapturaAutomatica() {
  const boot = useBoot()
  const sessao = useSessao((e) => e.sessao)
  const avisar = useSessao((e) => e.avisar)
  const demo = emModoDemo()
  const [aba, setAba] = useState('iphone')
  const [smsTeste, setSmsTeste] = useState(SMS_EXEMPLO)
  const [resultado, setResultado] = useState<ReturnType<typeof lerSms> | null>(null)

  const urlWebhook = `${demo || !sessao?.url_api ? URL_EXEMPLO : sessao.url_api}?webhook=1`
  const token = boot.usuario.token ?? '(peça ao Administrador em Configurações › Membros)'
  const tokenFamilia = sessao?.token_familia || 'TOKEN_DA_FAMILIA'

  const corpoIphone = useMemo(() => JSON.stringify({ token_familia: tokenFamilia, token, canal: 'sms_ios', texto: 'Mensagem' }, null, 2), [tokenFamilia, token])
  const corpoAndroid = useMemo(() => JSON.stringify({ token_familia: tokenFamilia, token, canal: 'sms_android', texto: '{sms_message}' }, null, 2), [tokenFamilia, token])

  function baixarMacro() {
    // Formato ILUSTRATIVO inspirado na exportação do MacroDroid. Ao importar, o MacroDroid pode pedir
    // para refazer o gatilho/ação — os valores (URL, token, corpo) estão prontos para copiar.
    const macro = {
      _comentario: 'Macro de exemplo para o MacroDroid — Finanças da Família. Se a importação falhar, crie a macro manualmente seguindo os passos do app e copie a URL e o corpo daqui.',
      macroName: 'Finanças da Família — SMS do banco',
      enabled: true,
      triggerList: [
        { type: 'SMSReceived', contentFilter: 'aprovada', matchAny: true, senderFilter: '' },
        { type: 'NotificationReceived', applicationNameList: ['Itaú', 'Nubank', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Inter', 'C6 Bank'], textContent: 'compra' },
      ],
      actionList: [
        { type: 'HttpRequest', method: 'POST', url: urlWebhook, contentType: 'text/plain', body: corpoAndroid, followRedirects: true },
      ],
      constraintList: [],
    }
    baixarArquivo('financas-familia-sms.macro', JSON.stringify(macro, null, 2), 'application/json')
    avisar('Arquivo .macro baixado. Importe no MacroDroid (Macros › ⋮ › Importar).', { tipo: 'ok' })
  }

  const copiar = async (t: string, nome: string) => avisar((await copiarTexto(t)) ? `${nome} copiado ✅` : 'Não foi possível copiar', { tipo: 'ok' })

  return (
    <>
      <Cabecalho titulo="Captura automática" voltarPara="/mais" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <p className="text-suave">Faça o celular avisar o app toda vez que o banco mandar "compra aprovada". A compra cai na <Link to="/caixa" className="underline text-primaria-sel">Caixa de Entrada</Link> e você só escolhe a categoria.</p>

        {demo && (
          <div className="card p-3 text-sm" style={{ borderColor: 'var(--amarelo)' }}>
            🧪 <strong>Modo demonstração:</strong> a URL abaixo é só um exemplo. Quando a família conectar ao Apps Script, a URL e o token de verdade aparecem aqui.
          </div>
        )}

        <section className="space-y-2">
          <LinhaCopiar rotulo="URL do webhook" valor={urlWebhook} avisar={(t) => avisar(t, { tipo: 'ok' })} />
          <LinhaCopiar rotulo={`Seu token pessoal (${boot.usuario.apelido})`} valor={token} avisar={(t) => avisar(t, { tipo: 'ok' })} mascarar />
        </section>

        <Abas
          abas={[
            { id: 'iphone', rotulo: 'iPhone', icone: '📱' },
            { id: 'android', rotulo: 'Android', icone: '🤖' },
            { id: 'email', rotulo: 'E-mail do banco', icone: '📧' },
            { id: 'fatura', rotulo: 'Fatura mensal', icone: '🧾' },
          ]}
          ativa={aba}
          aoMudar={setAba}
        />

        {aba === 'iphone' && (
          <section className="card p-4 space-y-4">
            <h2 className="font-bold text-lg">📱 iPhone — app Atalhos</h2>
            <p className="text-sm text-suave">Leva uns 5 minutos. Os nomes abaixo são exatamente os do app <strong>Atalhos</strong> (já vem no iPhone).</p>
            <ol className="space-y-3">
              <Passo n={1} titulo="Abra o app Atalhos e toque em Automação">Depois em <Menu>Nova automação</Menu> (ou no "+" no canto).</Passo>
              <Passo n={2} titulo="Escolha o gatilho Mensagem">Em <Menu>A mensagem contém</Menu> escreva <strong>aprovada</strong>. Opcional: em <Menu>Remetente</Menu> coloque o número do seu banco.</Passo>
              <Passo n={3} titulo="Marque Executar imediatamente">Assim não precisa confirmar a cada SMS. Toque em <Menu>Seguinte</Menu>.</Passo>
              <Passo n={4} titulo="Adicione a ação Obter conteúdo do URL">Toque em <Menu>Nova automação em branco</Menu> → <Menu>Adicionar ação</Menu> → busque <strong>Obter conteúdo do URL</strong>.</Passo>
              <Passo n={5} titulo="Cole a URL do webhook">No campo do URL, cole a URL copiada lá em cima.</Passo>
              <Passo n={6} titulo="Mostre mais e ajuste">Toque na seta da ação → <Menu>Método</Menu> = <strong>POST</strong> → <Menu>Corpo da solicitação</Menu> = <strong>JSON</strong>.</Passo>
              <Passo n={7} titulo="Adicione os 4 campos do corpo">
                <span className="block">• <code>token_familia</code> = <code>{tokenFamilia}</code></span>
                <span className="block">• <code>token</code> = <code>{boot.usuario.token ? `${boot.usuario.token.slice(0, 6)}…` : 'seu token'}</code></span>
                <span className="block">• <code>canal</code> = <code>sms_ios</code></span>
                <span className="block">• <code>texto</code> = toque em <Menu>Selecionar variável</Menu> e escolha <strong>Mensagem</strong> (o conteúdo do SMS).</span>
              </Passo>
              <Passo n={8} titulo="Pronto! Toque em Concluído">Na próxima compra, o SMS vai para a Caixa de Entrada. Teste mandando um SMS com o texto de exemplo lá embaixo.</Passo>
            </ol>
            <div>
              <div className="rotulo">Corpo JSON pronto (para conferir os valores)</div>
              <pre className="bg-painel border border-borda rounded-xl p-3 text-xs overflow-x-auto">{corpoIphone}</pre>
              <button className="botao botao-secundario w-full mt-2" onClick={() => copiar(corpoIphone, 'Corpo JSON')}>📋 Copiar corpo JSON</button>
              <p className="text-xs text-suave mt-1">No Atalhos, o campo <code>texto</code> precisa ser a variável <strong>Mensagem</strong>, não a palavra "Mensagem".</p>
            </div>
            <p className="text-xs text-suave break-words">Se o POST falhar no seu iPhone, o webhook também aceita GET: <code className="break-all">{urlWebhook}&amp;token_familia=…&amp;token=…&amp;canal=sms_ios&amp;texto=…</code></p>
          </section>
        )}

        {aba === 'android' && (
          <section className="card p-4 space-y-4">
            <h2 className="font-bold text-lg">🤖 Android — app MacroDroid</h2>
            <p className="text-sm text-suave">Instale o <strong>MacroDroid</strong> (gratuito na Play Store). Ele dispara uma ação quando chega SMS ou notificação do banco.</p>
            <ol className="space-y-3">
              <Passo n={1} titulo="Crie uma macro nova">Toque em <Menu>Adicionar macro</Menu>.</Passo>
              <Passo n={2} titulo="Gatilho: SMS recebido">Em <Menu>Gatilhos</Menu> → <Menu>Conectividade</Menu> → <strong>SMS recebido</strong> → "Qualquer contato" → conteúdo contém <strong>aprovada</strong>.</Passo>
              <Passo n={3} titulo="Gatilho extra: Notificação recebida">Para bancos que avisam por notificação (Nubank, Inter): <Menu>Gatilhos</Menu> → <Menu>Dispositivo</Menu> → <strong>Notificação recebida</strong> → escolha o app do banco → texto contém <strong>compra</strong>.</Passo>
              <Passo n={4} titulo="Ação: Requisição HTTP">Em <Menu>Ações</Menu> → <Menu>Conectividade</Menu> → <strong>Requisição HTTP</strong> → método <strong>POST</strong> → URL = a URL do webhook.</Passo>
              <Passo n={5} titulo="Tipo de conteúdo e corpo">Em <Menu>Tipo de conteúdo</Menu> escolha <strong>text/plain</strong>. Em <Menu>Corpo</Menu>, cole o JSON abaixo — o <code>{'{sms_message}'}</code> é a variável do MacroDroid com o texto do SMS (para notificação use <code>{'{not_text}'}</code>).</Passo>
              <Passo n={6} titulo="Dê um nome e salve">Permita que o MacroDroid leia SMS e notificações quando ele pedir.</Passo>
            </ol>
            <div>
              <div className="rotulo">Corpo JSON pronto</div>
              <pre className="bg-painel border border-borda rounded-xl p-3 text-xs overflow-x-auto">{corpoAndroid}</pre>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <button className="botao botao-secundario" onClick={() => copiar(corpoAndroid, 'Corpo JSON')}>📋 Copiar corpo JSON</button>
                <button className="botao botao-primario" onClick={baixarMacro}>⬇️ Baixar macro (.macro JSON)</button>
              </div>
              <p className="text-xs text-suave mt-1">O arquivo .macro é um modelo ilustrativo com a URL e o token já preenchidos. Se a importação pedir ajustes, crie a macro pelos passos acima e copie os valores do arquivo.</p>
            </div>
          </section>
        )}

        {aba === 'email' && (
          <section className="card p-4 space-y-4">
            <h2 className="font-bold text-lg">📧 Alertas por e-mail do banco</h2>
            <p className="text-sm text-suave">Muitos bancos mandam e-mail a cada compra. O app lê esses e-mails a cada hora pelo Gmail do Administrador (o mesmo que roda a planilha).</p>
            <ol className="space-y-3">
              <Passo n={1} titulo="Ative os alertas de compra no app do banco">Normalmente em Cartão → Notificações → "Avisos por e-mail".</Passo>
              <Passo n={2} titulo="Crie o marcador no Gmail">No Gmail (computador): <Menu>Configurações</Menu> → <Menu>Marcadores</Menu> → <Menu>Criar novo marcador</Menu> com o nome exato <strong>Alertas Cartão</strong>.</Passo>
              <Passo n={3} titulo="Crie o filtro">Na busca, clique nas opções (ícone de filtro) → <Menu>De</Menu>: o remetente do banco (ex.: <code>itau.com.br</code>) → <Menu>Contém as palavras</Menu>: <strong>compra aprovada</strong> → <Menu>Criar filtro</Menu> → marque <Menu>Aplicar o marcador</Menu> = Alertas Cartão.</Passo>
              <Passo n={4} titulo="Contas da casa também">Faça o mesmo com o marcador <strong>Contas da Casa</strong> para as faturas de luz, água e internet: elas entram sozinhas no calendário de vencimentos.</Passo>
            </ol>
            <p className="text-xs text-suave">Depois de lido, o e-mail recebe o marcador "Processado" e nunca é apagado.</p>
          </section>
        )}

        {aba === 'fatura' && (
          <section className="card p-4 space-y-4">
            <h2 className="font-bold text-lg">🧾 Fatura mensal do cartão</h2>
            <p className="text-sm text-suave">Sem SMS nem e-mail? Uma vez por mês, importe a fatura: o app compara com o que já foi lançado e só traz o que falta.</p>
            <ol className="space-y-3">
              <Passo n={1} titulo="Baixe a fatura no app do banco">Em PDF, ou exporte em OFX/CSV (opção "Exportar" da fatura).</Passo>
              <Passo n={2} titulo="Na Caixa de Entrada, toque em Importar fatura">Escolha o cartão e envie o arquivo (ou tire uma foto da fatura impressa).</Passo>
              <Passo n={3} titulo="Confira a lista">As compras já lançadas aparecem em cinza. Marque as novas e toque em "Trazer para a Caixa".</Passo>
            </ol>
            <Link to="/caixa" className="botao botao-primario w-full">📥 Ir para a Caixa de Entrada</Link>
          </section>
        )}

        {/* Testar agora */}
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-lg">🧪 Testar agora</h2>
          <p className="text-sm text-suave">Cole um SMS do seu banco e veja o que o app entende dele (o teste é feito aqui no celular, nada é enviado).</p>
          <textarea className="campo text-sm" rows={3} value={smsTeste} onChange={(e) => setSmsTeste(e.target.value)} aria-label="SMS de exemplo" />
          <button className="botao botao-primario w-full" onClick={() => setResultado(lerSms(smsTeste))}>▶️ Simular</button>
          {resultado && (
            resultado.valido ? (
              <div className="bg-painel border border-verde rounded-xl p-3 space-y-1">
                <div className="font-bold text-verde">✅ Reconhecido ({resultado.banco})</div>
                <div>Valor: <strong>{moeda(resultado.valor)}</strong></div>
                <div>Estabelecimento: <strong>{resultado.estabelecimento}</strong></div>
                <div>Final do cartão: <strong>{resultado.final_cartao || '—'}</strong> {resultado.final_cartao && (boot.cartoes.find((k) => k.final === resultado.final_cartao) ? `(${boot.cartoes.find((k) => k.final === resultado.final_cartao)?.apelido})` : '— cartão não cadastrado')}</div>
                {resultado.parcelas && <div>Parcelas: <strong>{resultado.parcelas}</strong></div>}
                <div className="text-sm text-suave">Data: {resultado.data}</div>
              </div>
            ) : (
              <div className="bg-painel border border-vermelho rounded-xl p-3">
                <div className="font-bold text-vermelho">❌ Não reconhecido</div>
                <div className="text-sm">{resultado.motivo}. Se for um SMS de compra de verdade, mande o texto ao Administrador para incluirmos o padrão — enquanto isso o servidor tenta ler com a ajuda da IA.</div>
              </div>
            )
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold min-h-12 flex items-center">Bancos reconhecidos de imediato ({PADROES_BANCO.length})</summary>
            <div className="flex flex-wrap gap-2 mt-2">
              {PADROES_BANCO.map((p) => <span key={p.banco} className="px-3 py-1.5 rounded-full bg-painel border border-borda">{p.banco}</span>)}
            </div>
            <p className="text-xs text-suave mt-2">Outros bancos passam pelo padrão genérico e, no servidor, pela leitura com IA.</p>
          </details>
        </section>

        {/* Segurança */}
        <section className="card p-4 space-y-2">
          <h2 className="font-bold text-lg">🔒 Segurança</h2>
          <ul className="text-sm text-suave space-y-1 list-disc pl-5">
            <li>O token é <strong>pessoal</strong>: identifica quem comprou. Se vazar, o Administrador gera outro em Configurações › Membros e o antigo para de funcionar na hora.</li>
            <li>Guardamos só valor, loja, data e os <strong>4 últimos dígitos</strong> do cartão — nunca o número completo.</li>
            <li>Mensagens com <strong>códigos de verificação</strong>, senhas e propagandas são descartadas e não ficam salvas.</li>
            <li>Tudo fica na planilha da família, no Drive de vocês.</li>
          </ul>
        </section>
      </div>
    </>
  )
}
