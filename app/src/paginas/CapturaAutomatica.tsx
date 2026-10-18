/**
 * Captura automática: guia passo a passo (iPhone, Android, e-mail, fatura, Telegram)
 * com a URL do webhook e o token do usuário já preenchidos, simulador de SMS e segurança.
 */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, emModoDemo, lerSessao } from '../api/cliente'
import { useBoot } from '../store/sessao'
import { dataBr, moeda } from '../util/formato'
import { PADROES_BANCO, lerSms, type LeituraSms } from '../util/extrator'
import { Cabecalho } from '../componentes/Cabecalho'
import { Icone } from '../componentes/Icone'
import { BotaoCopiar, CampoCopiavel, baixarArquivo, useAcao } from '../componentes/config/comuns'

type Aba = 'iphone' | 'android' | 'email' | 'fatura' | 'telegram'
const ABAS: Array<{ id: Aba; nome: string }> = [
  { id: 'iphone', nome: 'iPhone (Atalhos)' },
  { id: 'android', nome: 'Android (MacroDroid)' },
  { id: 'email', nome: 'E-mail do banco' },
  { id: 'fatura', nome: 'Fatura mensal' },
  { id: 'telegram', nome: 'Telegram' },
]
const SMS_TESTE = 'Compra aprovada no seu Itaú final 4321: R$ 10,00 em TESTE em 17/10 às 10:00.'

function Passos({ passos }: { passos: ReactNode[] }) {
  return (
    <div className="rows">
      {passos.map((p, i) => (
        <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
          <span className="ico-sm num" style={{ fontWeight: 600, fontSize: 12.5 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.5, paddingTop: 4 }}>{p}</div>
        </div>
      ))}
    </div>
  )
}

function Codigo({ texto, nomeArquivo }: { texto: string; nomeArquivo?: string }) {
  return (
    <div className="mt-3">
      <pre className="campo" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.5 }}>{texto}</pre>
      <div className="flex gap-2 mt-2 flex-wrap">
        <BotaoCopiar texto={texto} rotulo="Copiar JSON" />
        {nomeArquivo && <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => baixarArquivo(texto, nomeArquivo, 'application/json')}><Icone nome="download" />Baixar macro (.macro JSON)</button>}
      </div>
    </div>
  )
}

export default function CapturaAutomatica() {
  const boot = useBoot()
  const sessao = lerSessao()
  const demo = emModoDemo()
  const urlWebhook = demo || !sessao?.url_api ? 'https://script.google.com/macros/s/SEU_ID_DE_IMPLANTACAO/exec?webhook=1' : `${sessao.url_api}?webhook=1`
  const tokenFamilia = sessao?.token_familia || 'TOKEN_DA_FAMILIA'
  const token = boot.usuario.token || 'SEU_TOKEN'
  const [aba, setAba] = useState<Aba>('iphone')
  const [sms, setSms] = useState('')
  const [leitura, setLeitura] = useState<LeituraSms | null>(null)
  const { rodar, ocupado } = useAcao()
  const [vinculo, setVinculo] = useState<{ codigo: string; url_bot: string } | null>(null)

  const corpo = (canal: string, texto: string) => JSON.stringify({ token_familia: tokenFamilia, token, canal, texto }, null, 2)
  const macro = JSON.stringify({
    formatVersion: 2, name: 'Finanças da Família — SMS do banco', enabled: true,
    triggers: [{ type: 'SMSReceivedTrigger', contact: 'Qualquer contato', contentContains: 'aprovada' }, { type: 'NotificationTrigger', apps: ['app do banco'] }],
    actions: [{ type: 'HttpRequestAction', method: 'POST', url: urlWebhook, contentType: 'text/plain', followRedirects: true, body: { token_familia: tokenFamilia, token, canal: 'sms_android', texto: '{sms_message}' } }],
    observacao: 'Arquivo ilustrativo: se a importação reclamar da versão, crie a macro manualmente seguindo os passos da tela Captura automática.',
  }, null, 2)
  const bancos = Array.from(new Set(PADROES_BANCO.map((p) => p.banco))).map((b) => (b === 'Genérico' ? 'BV, Ailos/Sicredi/Sicoob (formato genérico)' : b))
  const vincular = () => rodar(async () => setVinculo(await api('vincular_telegram')))

  return (
    <>
      <Cabecalho titulo="Captura automática" subtitulo="Os SMS e alertas do banco viram lançamentos na Caixa de entrada." voltarPara="/configuracoes" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="flex flex-col gap-3.5">
          <div className="card">
            <h3>Seus dados de conexão {demo && <span className="tag warn">exemplo — modo demonstração</span>}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 10px' }}>Nenhum app lê SMS sozinho. Uma automação do seu celular encaminha a mensagem de compra para a API da família, com o seu token pessoal.</p>
            <CampoCopiavel rotulo="URL do webhook" valor={urlWebhook} />
            <div className="grid gap-x-3 sm:grid-cols-2">
              <CampoCopiavel rotulo="Token da família" valor={tokenFamilia} segredo />
              <CampoCopiavel rotulo="Seu token (pessoal)" valor={token} segredo />
            </div>
          </div>

          <div>
            <div className="tabs" role="tablist" aria-label="Como capturar">
              {ABAS.map((a) => <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}>{a.nome}</button>)}
            </div>
            <div className="card">
              {aba === 'iphone' && (
                <>
                  <h3>iPhone — app Atalhos <span className="sub">iOS 17 ou mais recente, roda na hora</span></h3>
                  <Passos passos={[
                    <>Abra o app <b>Atalhos</b> (vem instalado; se apagou, baixe de graça na App Store).</>,
                    <>Toque na aba <b>Automação</b> → <b>Nova automação</b> (ou o <b>+</b>).</>,
                    <>Escolha <b>Mensagem</b>.</>,
                    <>Em <b>Remetente</b>, toque em <b>Escolher</b> e selecione o contato do banco (salve o número curto como “Itaú SMS”). Se o banco usa vários números, deixe em branco e preencha <b>A mensagem contém</b>: <code>aprovada</code>.</>,
                    <>Marque <b>Executar imediatamente</b> e toque em <b>Seguinte</b>.</>,
                    <>Toque em <b>Novo atalho em branco</b> → <b>Adicionar ação</b> → procure <b>Obter conteúdo do URL</b>.</>,
                    <>Na ação: <b>URL</b> = a URL do webhook acima. Toque na seta <b>›</b>: <b>Método: POST</b>, <b>Corpo da solicitação: JSON</b>. Toque em <b>Adicionar novo campo</b> 4 vezes (tipo Texto): <code>token_familia</code>, <code>token</code>, <code>canal</code> = <code>sms_ios</code> e <code>texto</code> = a variável <b>Mensagem</b>.</>,
                    <>Toque em <b>Concluído</b>. Teste pedindo a alguém que mande este SMS: <i>{SMS_TESTE}</i></>,
                  ]} />
                  <Codigo texto={corpo('sms_ios', '<variável Mensagem>')} />
                  <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>Bancos que mandam notificação em vez de SMS (Nubank, Inter, C6): ative “Avisos por SMS” ou “Alertas por e-mail” no app do banco. O iPhone não automatiza notificações de outros apps.</p>
                </>
              )}
              {aba === 'android' && (
                <>
                  <h3>Android — MacroDroid <span className="sub">grátis, até 5 macros; Tasker também serve</span></h3>
                  <Passos passos={[
                    <>Instale o <b>MacroDroid</b> pela Play Store e abra → <b>Adicionar macro</b>.</>,
                    <><b>Gatilho (+)</b> → <b>Conectividade / Mensagens → SMS recebido</b> → “Qualquer contato” (ou o número do banco) → <b>Conteúdo contém</b>: <code>aprovada</code>. Para bancos que notificam, acrescente <b>Dispositivo → Notificação recebida</b> → app do banco (permita o acesso às notificações).</>,
                    <><b>Ação (+)</b> → <b>Conectividade → Requisição HTTP</b>: <b>Método</b> POST · <b>URL</b> = a URL do webhook · <b>Tipo de conteúdo</b> <code>text/plain</code> · <b>Corpo da solicitação</b> = o JSON abaixo (no gatilho de notificação use <code>{'{not_title} {not_text}'}</code> no lugar de <code>{'{sms_message}'}</code>).</>,
                    <>Em <b>Opções avançadas</b>, marque <b>Seguir redirecionamentos</b> (o Google redireciona a chamada).</>,
                    <>Dê o nome “Finanças da Família” e salve. Em Xiaomi/Samsung, coloque o MacroDroid em <b>apps sem restrição</b> de bateria.</>,
                  ]} />
                  <Codigo texto={corpo('sms_android', '{sms_message}')} />
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button className="btn btn-ghost" onClick={() => baixarArquivo(macro, 'financas-da-familia.macro', 'application/json')}><Icone nome="download" />Baixar macro (.macro JSON)</button>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>Importe em Menu → Importar macro. O arquivo é ilustrativo: se o MacroDroid reclamar da versão, crie a macro manualmente. <b>Tasker:</b> Perfil → Evento → Telefone → Received Text → Tarefa → Rede → HTTP Request (POST, mesmo corpo com <code>%SMSRB</code>).</p>
                </>
              )}
              {aba === 'email' && (
                <>
                  <h3>E-mail de alerta do banco <span className="sub">funciona em qualquer celular</span></h3>
                  <Passos passos={[
                    <>No app do banco, ative <b>alerta de compra por e-mail</b> (Cartões → Notificações / Avisos).</>,
                    <>No Gmail (computador): <b>Configurações → Ver todas as configurações → Filtros → Criar novo filtro</b>.</>,
                    <><b>De</b>: o remetente do banco (ex.: <code>@itau.com.br OR @nubank.com.br</code>). <b>Contém as palavras</b>: <code>compra aprovada</code>.</>,
                    <><b>Criar filtro → Aplicar o marcador → Novo marcador: <code>Alertas Cartão</code></b>. O Apps Script lê esse marcador a cada hora e manda as compras para a Caixa de entrada.</>,
                  ]} />
                </>
              )}
              {aba === 'fatura' && (
                <>
                  <h3>Fatura do cartão <span className="sub">a rede de segurança mensal</span></h3>
                  <Passos passos={[
                    <>Quando a fatura fechar, vá em <b>Caixa de entrada → Importar fatura</b>, escolha o cartão e envie o <b>PDF</b> (ou o <b>OFX/CSV</b> que o banco exporta).</>,
                    <>O app lê todas as compras e <b>cruza com o que já foi lançado</b> (mesmo valor, até 2 dias de diferença).</>,
                    <>Só o que <b>ninguém lançou</b> vai para a Caixa de entrada, com a categoria sugerida já marcada.</>,
                  ]} />
                  <Link to="/caixa" className="btn btn-primary mt-3"><Icone nome="upload" />Importar fatura na Caixa de entrada</Link>
                </>
              )}
              {aba === 'telegram' && (
                <>
                  <h3>Telegram <span className="sub">bot gratuito da família</span></h3>
                  <Passos passos={[
                    <>Toque em <b>Vincular meu Telegram</b> para gerar um código de 6 dígitos.</>,
                    <>Abra o bot pelo link e envie <code>/start CÓDIGO</code>.</>,
                    <>Pronto: mande “gastei 45 na padaria no pix” ou a foto do cupom; o bot confirma e lança. Os avisos das rotinas chegam no mesmo chat (ligue em Configurações › Rotinas).</>,
                  ]} />
                  <button className="btn btn-primary mt-3" disabled={ocupado} onClick={vincular}><Icone nome="send" />Vincular meu Telegram</button>
                  {vinculo && (
                    <div className="rows mt-3">
                      <div className="row"><span className="ico-sm"><Icone nome="external-link" /></span><div className="t"><b>Abrir o bot</b><small><a href={vinculo.url_bot} target="_blank" rel="noreferrer" style={{ color: 'var(--sel)' }}>{vinculo.url_bot}</a></small></div></div>
                      <div className="row"><span className="ico-sm"><Icone nome="send" /></span><div className="t"><b>Enviar</b><small className="num" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>/start {vinculo.codigo}</small></div><BotaoCopiar texto={`/start ${vinculo.codigo}`} /></div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="card">
            <h3>Testar agora <span className="sub">cole um SMS do banco</span></h3>
            <textarea className="campo" rows={4} value={sms} onChange={(e) => setSms(e.target.value)} placeholder={SMS_TESTE} aria-label="SMS para simular" />
            <div className="flex gap-2 mt-2 flex-wrap">
              <button className="btn btn-primary" onClick={() => setLeitura(lerSms(sms || SMS_TESTE))}><Icone nome="sparkles" />Simular</button>
              <button className="btn btn-ghost" onClick={() => { setSms(SMS_TESTE); setLeitura(lerSms(SMS_TESTE)) }}>Usar o exemplo</button>
            </div>
            {leitura && (
              <div className="rows mt-3">
                {leitura.valido ? (
                  <>
                    <div className="row"><span className="t"><b>Banco</b></span><span className="amt">{leitura.banco}</span></div>
                    <div className="row"><span className="t"><b>Valor</b></span><span className="amt num">{moeda(leitura.valor)}</span></div>
                    <div className="row"><span className="t"><b>Loja</b></span><span className="amt" style={{ fontWeight: 500 }}>{leitura.estabelecimento}</span></div>
                    <div className="row"><span className="t"><b>Final do cartão</b></span><span className="amt num">{leitura.final_cartao || '—'}</span></div>
                    <div className="row"><span className="t"><b>Data</b></span><span className="amt num">{dataBr(leitura.data)}</span></div>
                    {leitura.parcelas && <div className="row"><span className="t"><b>Parcelas</b></span><span className="amt num">{leitura.parcelas}</span></div>}
                    <div className="row"><span className="tag ok">Cairia na Caixa de entrada</span></div>
                  </>
                ) : (
                  <div className="row"><span className="ico-sm"><Icone nome="circle-alert" /></span><span className="t"><b>Não vira lançamento</b><small>{leitura.motivo}</small></span></div>
                )}
              </div>
            )}
            <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '12px 0 4px' }}>Bancos reconhecidos automaticamente:</p>
            <div className="flex flex-wrap gap-1">{bancos.map((b) => <span key={b} className="tag proj">{b}</span>)}</div>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '8px 0 0' }}>Formatos diferentes são enviados ao Claude, que extrai os dados mesmo assim.</p>
          </div>
          <div className="card">
            <h3>Segurança</h3>
            <div className="rows">
              <div className="row" style={{ alignItems: 'flex-start' }}><span className="ico-sm"><Icone nome="lock" /></span><div className="t" style={{ whiteSpace: 'normal' }}><b>Token pessoal e revogável</b><small>Identifica quem comprou; o app também confere o final do cartão. Para revogar: Configurações › Membros › Renovar token.</small></div></div>
              <div className="row" style={{ alignItems: 'flex-start' }}><span className="ico-sm"><Icone nome="eye-off" /></span><div className="t" style={{ whiteSpace: 'normal' }}><b>Nunca guardamos</b><small>Número completo do cartão, CVV, senha ou códigos de verificação. Mensagens que não são de compra são descartadas.</small></div></div>
              <div className="row" style={{ alignItems: 'flex-start' }}><span className="ico-sm"><Icone nome="shield-check" /></span><div className="t" style={{ whiteSpace: 'normal' }}><b>Só o texto da compra</b><small>Vai pela sua automação, direto para a API da família, em HTTPS.</small></div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
