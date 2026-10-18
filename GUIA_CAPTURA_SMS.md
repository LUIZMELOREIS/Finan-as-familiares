# 📲 Guia de captura automática dos gastos do cartão

> Como fazer os SMS e alertas do banco virarem lançamentos na **Caixa de Entrada** do app, sem digitar nada.

## Por que precisa de configuração?

Nenhum app web (e nenhum app da App Store no iPhone) pode ler os SMS do celular sozinho — a Apple não permite, e no Android o Google restringe essa permissão. Por isso a captura é feita por uma **automação do próprio celular**, que **encaminha o SMS para a API da família** assim que ele chega. É seguro: só vai o texto da mensagem de compra, com o **seu token pessoal** (que você pode revogar a qualquer momento).

Dentro do app, a tela **Configurações → Captura automática** mostra **a URL e o seu token já preenchidos** e tem botões "Copiar" para cada passo. Este guia é a versão impressa.

Você vai precisar de dois dados (estão na tela "Captura automática"):

| Dado | Onde pegar |
|---|---|
| **URL do webhook** | a URL da API terminada em `/exec`, seguida de `?webhook=1` |
| **Token da família** e **seu token** | tela Captura automática (ou Configurações → Membros, para o administrador) |

O corpo enviado é sempre este JSON:

```json
{ "token_familia": "TOKEN_DA_FAMILIA", "token": "SEU_TOKEN", "canal": "sms_ios", "texto": "<texto do SMS>" }
```

---

## 📱 iPhone — app Atalhos (iOS 17 ou mais recente)

As automações de Mensagem rodam **na hora**, sem perguntar (aparece só uma notificação discreta).

1. Abra o app **Atalhos** (vem instalado; se apagou, baixe de graça na App Store).
2. Toque na aba **Automação** (embaixo) → **Nova automação** (ou o **+** no canto).
3. Escolha **Mensagem**.
4. Em **Remetente**, toque em **Escolher** e selecione o contato/número do banco (dica: salve o número curto do banco como contato "Itaú SMS"). Se o banco usa vários números, deixe o remetente em branco e preencha **A mensagem contém**: `aprovada` (a maioria dos bancos escreve "Compra aprovada").
5. Marque **Executar imediatamente** e desmarque "Notificar ao executar" se preferir. Toque em **Seguinte**.
6. Toque em **Novo atalho em branco** → **Adicionar ação** → procure **"Obter conteúdo do URL"**.
7. Na ação:
   - **URL**: cole a **URL do webhook**.
   - Toque na seta **›** para abrir as opções: **Método: POST**.
   - **Corpo da solicitação: JSON**. Toque em **Adicionar novo campo** 4 vezes (tipo **Texto**):
     | Chave | Valor |
     |---|---|
     | `token_familia` | *(cole o token da família)* |
     | `token` | *(cole o seu token)* |
     | `canal` | `sms_ios` |
     | `texto` | toque no campo → escolha a variável **Mensagem** (a "Entrada do atalho" que vem do gatilho) |
8. Toque em **Concluído**. Pronto.

**Testar:** peça para alguém mandar um SMS para você com o texto
`Compra aprovada no seu Itaú final 4321: R$ 10,00 em TESTE em 17/10 às 10:00.`
Em até 1 minuto o gasto aparece na **Caixa de Entrada** do app. (Use o final do cartão que você cadastrou em Configurações → Cartões.)

**Se o seu banco manda notificação em vez de SMS** (Nubank, Inter, C6…): no app do banco, ative **"Avisos por SMS"** ou **"Alertas de compra por e-mail"** (veja a seção E-mail abaixo). O iPhone não permite automatizar notificações de outros apps.

---

## 🤖 Android — MacroDroid (grátis) ou Tasker

1. Instale o **MacroDroid** pela Play Store (grátis, até 5 macros).
2. Abra → **Adicionar macro**.
3. **Gatilho (+)** → **Conectividade / Mensagens → SMS recebido** → "Qualquer contato" (ou escolha o número do banco) → **Conteúdo contém**: `aprovada` (ou deixe em branco).
   - Para bancos que mandam **notificação** em vez de SMS: adicione também o gatilho **Dispositivo → Notificação recebida** → escolha o app do banco. (Na primeira vez, o MacroDroid pede acesso às notificações: permita.)
4. **Ação (+)** → **Conectividade → Requisição HTTP**:
   - **Método**: POST
   - **URL**: a URL do webhook
   - **Tipo de conteúdo**: `text/plain`
   - **Corpo da solicitação**:
     ```json
     { "token_familia": "TOKEN_DA_FAMILIA", "token": "SEU_TOKEN", "canal": "sms_android", "texto": "{sms_message}" }
     ```
     (para o gatilho de notificação, use `{not_title} {not_text}` no lugar de `{sms_message}`)
   - Em **Opções avançadas**, marque **Seguir redirecionamentos** (o Google redireciona a chamada).
5. Dê um nome ("Finanças da Família") e salve. Se o celular tiver economia de bateria agressiva (Xiaomi, Samsung), coloque o MacroDroid na lista de **apps sem restrição**.

No app, a tela **Captura automática** tem o botão **"Baixar macro"**, que gera um arquivo de exemplo já com a sua URL e token para importar (Menu → Importar macro). Se a importação reclamar da versão, crie a macro manualmente seguindo os passos acima.

**Tasker:** Perfil → Evento → Telefone → *Received Text* → Tarefa → Rede → *HTTP Request* (POST, mesmo corpo com `%SMSRB`).

---

## 📧 E-mail de alerta do banco (funciona em qualquer celular)

A maioria dos bancos permite ativar **alerta de compra por e-mail** (no app do banco: Cartões → Notificações / Avisos). Depois:

1. No Gmail (computador): **⚙️ → Ver todas as configurações → Filtros → Criar novo filtro**.
2. **De**: o remetente do banco (ex.: `@itau.com.br OR @nubank.com.br`). **Contém as palavras**: `compra aprovada`.
3. **Criar filtro → Aplicar o marcador → Novo marcador: `Alertas Cartão`**.
4. O Apps Script lê esse marcador **a cada hora** e manda as compras para a Caixa de Entrada.

---

## 🧾 Fatura do cartão — a rede de segurança mensal

Mesmo que algum SMS se perca, nada escapa: quando a fatura fechar, vá em **Caixa de Entrada → Importar fatura**, escolha o cartão e envie o **PDF** (ou o arquivo **OFX/CSV** que o banco exporta). O app lê todas as compras, **cruza com o que já foi lançado** (mesmo valor, até 2 dias de diferença) e só traz para a Caixa de Entrada o que **ninguém lançou**.

---

## 🔒 Segurança

- O **token é pessoal** e identifica quem comprou; o app também confere o **final do cartão** com o cadastro. Para revogar: Configurações → Membros → **Gerar novo token** (o antigo para de funcionar na hora).
- Os gastos capturados caem na **Caixa de entrada** com a pergunta "R$ X · Loja — qual é a despesa?" e os chips do cardápio com a sugestão marcada. Quando você corrige a sugestão, o app **aprende**: aquela loja passa a cair sempre na despesa escolhida.
- Mensagens que **não são de compra** (códigos de verificação, propaganda, estornos) são **descartadas** e **nunca guardadas**.
- Nunca guardamos número completo de cartão, CVV, senha ou códigos de segurança.

## Telegram (alternativa a tudo isso)

Se a família usar o bot do Telegram (README, Parte 7), basta **encaminhar a mensagem do banco** para o bot, ou mandar "gastei 30 na padaria", ou a foto do cupom. O bot responde com a despesa sugerida e botões para confirmar.

## Bancos reconhecidos automaticamente

Itaú · Bradesco · Santander · Banco do Brasil · Caixa · Nubank · Inter · C6 · BV · Ailos/Sicredi/Sicoob (formato genérico). Se o seu banco escreve de um jeito diferente, o texto é enviado ao Claude, que extrai os dados mesmo assim. Para adicionar um padrão novo, edite a tabela `PADROES_BANCO` em `app/src/util/extrator.ts` e em `apps-script/sms.gs`.
