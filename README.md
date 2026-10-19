# 🏡 Finanças da Família

> *"Eu e a minha casa serviremos ao Senhor."* — Josué 24:15

App de **controle financeiro da família**, de uso diário pelo celular (instalável na tela inicial, **sem loja de aplicativos**) e com **painel completo no computador**. Cada membro lança as despesas em segundos (**foto do cupom, fatura, digitação ou voz**) escolhendo num **cardápio pronto**; as contas da casa são **lidas de PDFs e e-mails**; os gastos de cartão esquecidos são **capturados pelos SMS e alertas do banco**; um **assistente financeiro** responde perguntas, vigia gastos fora do padrão e prepara o fechamento do mês; e a família **decide junto** e acompanha a poupança de cada **projeto** (viagem, carro, reserva).

> **Versão 2 (17/10/2026):** o visual segue um contrato obrigatório — `docs/referencia/referencia_visual.html`. Tom sério, sem emojis; ícones de linha Lucide; 4 cards de tipo (Receitas · Despesas fixas · Despesas variáveis · Projetos). Veja o `PLANO.md`.

Os dados ficam **no seu Google Drive**, numa planilha que você pode abrir a qualquer hora. A base é a **mordomia cristã**: Deus é o dono, nós administramos.

| | |
|---|---|
| 📱 App | PWA (React + Vite + TypeScript + Tailwind + lucide-react) — pasta [`app/`](app) |
| ⚙️ API | Google Apps Script publicado como App da Web — pasta [`apps-script/`](apps-script) |
| 🗄️ Banco | Google Planilha `BD_Financas_Familia` dentro de uma pasta no seu Drive |
| 🧠 IA | API do Claude: leitura de cupons/faturas/SMS e **Assistente** com tool use; fallback: OCR do Drive + regras locais |
| 🤖 Telegram | Bot gratuito da família para lançar por mensagem/foto e receber avisos (opcional) |
| 📄 Documentos | [`PLANO.md`](PLANO.md) · [`GUIA_DA_FAMILIA.md`](GUIA_DA_FAMILIA.md) · [`GUIA_CAPTURA_SMS.md`](GUIA_CAPTURA_SMS.md) · [`docs/API.md`](docs/API.md) |

---

## Experimentar em 1 minuto (sem instalar nada)

```bash
cd app
npm install
npm run dev
```

Abra o endereço que aparecer (ex.: `http://localhost:5173`) e toque em **"Experimentar com dados de exemplo"**. É o **modo demonstração**: 12 meses de lançamentos fictícios da Família Reis (Luiz, Nina e dois dependentes), 2 cartões, 4 projetos, assistente por regras locais. Tudo funciona, só não grava no Drive.

Para ver em tamanho de celular no computador: pressione `F12` → ícone de celular → escolha "iPhone 14" (390×844).

---

## Instalação curta — 3 passos, uns 10 minutos

Você precisa só de uma **conta Google** (Gmail). O app já está publicado em **https://luizmeloreis.github.io/Finan-as-familiares/**; falta criar o "cérebro" (planilha + API) dentro da sua conta Google. Não precisa de cartão de crédito, servidor, Propriedades do script nem variáveis no GitHub.

**Passo 1 — Colar o código.** Abra [script.google.com/home/projects/create](https://script.google.com/home/projects/create) (já entra num projeto novo). Apague o que está em `Código.gs` e cole o conteúdo inteiro deste arquivo: [FinancasDaFamilia.gs — versão para copiar](https://raw.githubusercontent.com/LUIZMELOREIS/Finan-as-familiares/main/apps-script/dist/FinancasDaFamilia.gs). (Abra o link, `Ctrl+A`, `Ctrl+C`; no editor, `Ctrl+V`, depois `Ctrl+S`.) Se quiser, renomeie o projeto para "Finanças da Família" clicando em "Projeto sem título".

**Passo 2 — Instalar.** Na barra acima do código, na lista de funções ao lado de "Depurar", escolha **`instalar`** e clique em **▶ Executar**. O Google pede autorização: **Revisar permissões → sua conta → Avançado → Acessar Finanças da Família (não seguro) → Permitir** (é "não seguro" só porque o app é seu, não foi publicado na loja do Google). Espere o registro embaixo dizer **"Instalação concluída"**: a pasta e a planilha foram criadas no seu Drive.

**Passo 3 — Publicar e pegar o link.** Clique em **Implantar → Nova implantação → ⚙️ → App da Web**. Preencha **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa** → **Implantar** (autorize de novo se pedir) → **Concluído**. Volte ao editor, escolha a função **`linkDeAcesso`** e clique em **▶ Executar**. O registro mostra um **link**: mande-o para o seu celular (WhatsApp para você mesmo, e-mail) e **abra no navegador do celular**. Escolha nome, foto e PIN. Pronto: você é o Administrador.

Para os outros da família: no app, **Configurações → Membros → Convidar**. Leitura de cupons com IA (chave do Claude), e-mails, SMS e Telegram são opcionais e estão nas Partes 5 a 7 abaixo.

> Para atualizar o código no futuro: cole o arquivo novo por cima, depois **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar**. O link da API continua o mesmo.

---

## Instalação detalhada (referência)

A versão passo a passo de tudo, inclusive o que é opcional. Se já fez a instalação curta, pule para a Parte 5.

### Parte 1 — Criar o "cérebro" no Google (Apps Script)

1. Entre em **[script.google.com](https://script.google.com)** com a sua conta Google.
2. Clique em **"Novo projeto"**. Dê o nome **"Finanças da Família"** (clique em "Projeto sem título" no topo para renomear).
3. Abra o arquivo `Código.gs` que já vem no projeto, apague o conteúdo e **cole o conteúdo inteiro de [`apps-script/dist/FinancasDaFamilia.gs`](apps-script/dist/FinancasDaFamilia.gs)** (é um arquivo único com todo o back-end; no GitHub, clique em "Raw", selecione tudo e copie).
   - Alternativa para quem usa terminal: ["Publicar com o clasp"](apps-script/README.md#publicar-com-o-clasp) envia os 17 arquivos separados com um comando.
   - Para atualizar no futuro, basta colar o arquivo novo por cima e criar uma nova versão da implantação (Parte 2, nota ao fim).
4. **Opcional.** Clique na **engrenagem ⚙️ "Configurações do projeto"** (barra lateral):
   - Para o OCR de reserva do Google: marque **"Mostrar o arquivo de manifesto appsscript.json no editor"** e cole nele o conteúdo de `apps-script/appsscript.json`.
   - Em **"Propriedades do script"** → "Adicionar propriedade do script", pode criar:
     | Propriedade | Valor |
     |---|---|
     | `SOBRENOME` | o sobrenome da família (ex.: `Melo Reis`). Sem ela, o nome da família é editado depois em Configurações. |
     | `CHAVE_API_CLAUDE` | sua chave da API do Claude (começa com `sk-ant-…`; crie em [console.anthropic.com](https://console.anthropic.com)). Sem ela, a leitura de cupons usa o OCR do Google (menos preciso) e o Assistente responde por regras locais. |
     | `URL_APP` | só se publicar o app em outro endereço que não `https://luizmeloreis.github.io/Finan-as-familiares/`. |
     | `TOKEN_TELEGRAM` | token do bot criado no @BotFather, para lançar e receber avisos pelo Telegram (Parte 7). |
5. **Opcional** (OCR de reserva): ative o serviço **Drive**: barra lateral → **"Serviços" +** → escolha **"Drive API"** → **Adicionar**.
6. Volte ao editor, abra o arquivo **`setup`**, escolha a função **`instalar`** na lista ao lado de "Depurar" e clique em **▶ Executar**.
7. O Google vai pedir **autorização**: clique em "Revisar permissões" → escolha sua conta → "Avançado" → "Acessar Finanças da Família (não seguro)" → "Permitir". (É "não seguro" só porque o app é seu, não foi publicado na loja do Google.)
8. Ao terminar, abra o **"Registro de execução"** (embaixo). Ele mostra:
   - o link da **pasta no Drive** `Finanças da Família <Sobrenome>` e da **planilha** `BD_Financas_Familia`;
   - o **`token_familia`** (guarde-o; também está na aba `Config` da planilha);
   - o **PIN inicial do Administrador: `1234`** (troque depois em Configurações → Membros).

### Parte 2 — Publicar como App da Web (a "API")

1. No editor do Apps Script, clique em **"Implantar" → "Nova implantação"**.
2. Clique na **engrenagem ⚙️** ao lado de "Selecionar tipo" → **"App da Web"**.
3. Preencha:
   - **Descrição**: `Finanças da Família v1`
   - **Executar como**: **Eu** (seu e-mail)
   - **Quem pode acessar**: **Qualquer pessoa**
4. Clique em **"Implantar"** e autorize novamente se pedir.
5. **Copie a URL do App da Web** (termina em `/exec`). Essa é a **URL da API**.
6. Teste no navegador: abra `SUA_URL?acao=ping` → deve aparecer `{"ok":true,...}`.

> Cada vez que você atualizar o código no futuro: **Implantar → Gerenciar implantações → ✏️ Editar → Versão: Nova versão → Implantar**. A URL continua a mesma.

### Parte 3 — Publicar o app (grátis)

**Opção A — GitHub Pages (recomendada):**
1. No GitHub, abra este repositório → **Settings → Pages**. Em "Build and deployment", escolha **uma** das duas formas (as duas funcionam com o workflow deste repositório):
   - **Source: "GitHub Actions"** — mais simples; ou
   - **Source: "Deploy from a branch"**, **Branch: `gh-pages`**, pasta **`/ (root)`** — a branch `gh-pages` aparece depois da primeira execução do workflow (passo 3).

   > Se o job `publicar` falhar em um segundo com a mensagem *"Branch main is not allowed to deploy to github-pages due to environment protection rules"*, não é preciso mexer em nada: o workflow já publica sem passar por esse ambiente. Se quiser destravar na hora, rode **Actions → "Configurar GitHub Pages" → Run workflow**.
2. Em **Settings → Secrets and variables → Actions → Variables → New repository variable**, crie:
   - `VITE_API_URL` = a URL da API (Parte 2)
   - `VITE_TOKEN_FAMILIA` = o token da família (Parte 1, passo 8)
3. Faça qualquer push na branch `main` (ou rode o workflow "Publicar app no GitHub Pages" em **Actions → Run workflow**).
4. O app ficará em `https://<seu-usuario>.github.io/<nome-do-repositorio>/`. Coloque esse endereço em `URL_APP` nas Propriedades do script (Parte 1, passo 4).

**Opção B — Vercel:** importe o repositório em [vercel.com](https://vercel.com), *Root Directory* = `app`, e crie as mesmas variáveis de ambiente. Para um subdomínio próprio (ex.: `familia.seudominio.com.br`), adicione o domínio em *Settings → Domains*.

### Parte 4 — Instalar no celular de cada um

1. O administrador entra pelo link que `linkDeAcesso()` imprimiu (Passo 3 da instalação curta) e vai em **Configurações → Membros → Convidar**. Escolha o perfil (Administrador / Adulto / Dependente) e **envie o link ou mostre o QR Code**.
2. A pessoa abre o link **no navegador do celular** (Safari no iPhone, Chrome no Android) e segue as instruções na tela:
   - **iPhone (Safari)**: toque no botão **Compartilhar** (quadrado com seta ⬆️, embaixo) → role e toque em **"Adicionar à Tela de Início"** → **Adicionar**.
   - **Android (Chrome)**: toque no menu **⋮** (canto superior direito) → **"Instalar app"** ou **"Adicionar à tela inicial"** → **Instalar**.
3. Abra o app pelo ícone novo na tela inicial, informe **nome**, **apelido**, foto (opcional) e crie um **PIN de 4 dígitos**. Pronto — o celular fica lembrado; a **capa** com a foto da família e o brasão é a tela de bloqueio.

### Parte 5 — Contas por e-mail (opcional, mas vale muito a pena)

Para as faturas de luz, água, gás, internet, plano de saúde e escola entrarem sozinhas:

1. No Gmail (computador), clique na **engrenagem → Ver todas as configurações → Filtros e endereços bloqueados → Criar novo filtro**.
2. Em **"De"**, coloque os remetentes separados por `OR`, por exemplo:
   `@copel.com OR @sanepar.com.br OR @compagas.com.br OR @vivo.com.br OR @unimed.coop.br`
3. Clique em **"Criar filtro"** → marque **"Aplicar o marcador"** → **"Novo marcador…"** → nome **`Contas da Casa`** → Criar filtro.
4. Repita para os **alertas de compra do cartão** (ative-os no app do seu banco): crie um filtro com os remetentes do banco e o marcador **`Alertas Cartão`**.
5. O Apps Script lê esses e-mails **a cada hora**, salva os PDFs no Drive em `Contas da Casa/AAAA/MM/`, extrai valor, vencimento e código de barras e marca a conversa como `Processado`.

Também existe a pasta **`Contas da Casa/_Entrada`** no Drive: qualquer PDF que você jogar lá é processado e movido para a pasta do mês.

### Parte 6 — Captura dos SMS do cartão

Veja o [**GUIA_CAPTURA_SMS.md**](GUIA_CAPTURA_SMS.md) (iPhone com o app Atalhos, Android com o MacroDroid). O próprio app tem a tela **Configurações → Captura automática** com a URL e o seu token já preenchidos.

### Parte 7 — Assistente e bot do Telegram (opcional)

- O **Assistente** (aba do app) responde perguntas como "Quanto gastamos com delivery este mês?", "Quais assinaturas temos?", "Dá para fechar a viagem de julho?" e lança despesas por texto ("gastei 45 na padaria no pix"). Com a `CHAVE_API_CLAUDE` configurada, a conversa é livre; sem ela, responde às perguntas mais comuns por regras.
- **Rotinas automáticas** (ligue/desligue em Configurações → Rotinas e alertas): **vigia diário** às 20h (gasto fora do padrão, cobrança duplicada, assinatura nova, conta a vencer, gastos sem categoria), **análise quinzenal** (dias 1 e 16) e **fechamento do mês** (dia 1º: relatório, projeção de 3 meses e pauta da reunião, por e-mail aos administradores).
- **Telegram:** no app Telegram, fale com **@BotFather** → `/newbot` → copie o token → cole em `TOKEN_TELEGRAM` nas Propriedades do script → rode `configurarTelegram()` no Apps Script. Cada membro vincula o próprio chat em **Configurações → Rotinas e alertas → Vincular meu Telegram** (envia `/start CÓDIGO` ao bot). Depois é só mandar "gastei 30 na padaria" ou a foto do cupom.

---

## Estrutura do repositório

```
app/                 PWA (React). `npm run dev`, `npm test`, `npm run build`, `npm run capturas`
apps-script/         Back-end Google Apps Script (.gs) + README de publicação + testes das funções puras
dados/               Dados iniciais: grupos/categorias e versículos (fonte única para app e Apps Script)
docs/API.md          Contrato da API
docs/referencia/     Contrato visual (HTML de referência, prompt v2, renders 1440/390)
PLANO.md             Fases, decisões técnicas, pendências e ideias para depois
GUIA_DA_FAMILIA.md   Manual de 1 página para os integrantes
GUIA_CAPTURA_SMS.md  Passo a passo iPhone/Android para captura de SMS
```

## Segurança e privacidade

- A **chave do Claude** fica só nas Propriedades do script (nunca no app nem no Git).
- Toda chamada exige o **token da família + token do usuário**; o perfil é validado **no servidor** (um Dependente não lê salários nem chamando a API direto).
- **Nunca** guardamos número completo de cartão, CVV, senha ou códigos recebidos por SMS. Os SMS que não são de compra (códigos, propaganda) são descartados.
- Tudo é **soft delete**: nada some de verdade da planilha. Há **log de auditoria** (aba `Log`) e **backup semanal** automático em `Backups/`.

## Perguntas frequentes

**O app funciona sem internet?** Sim para lançar: os lançamentos ficam numa fila no celular e sobem quando a conexão voltar.

**Preciso pagar algo?** Não. Apps Script, Drive, GitHub Pages e Vercel têm planos gratuitos suficientes para uma família. A API do Claude é opcional e custa centavos por cupom lido.

**Por que o iPhone não lê os SMS sozinho?** A Apple não permite que nenhum app leia SMS. Por isso usamos uma **automação do app Atalhos**, que encaminha a mensagem para a API (veja o guia).

**Como atualizo o app?** Dê push na branch `main`; o GitHub Pages republica. O celular atualiza sozinho na próxima abertura.

---

Feito com carinho para a nossa casa. *Soli Deo Gloria.*
