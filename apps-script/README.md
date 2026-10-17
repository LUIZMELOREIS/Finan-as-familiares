# Back-end — Google Apps Script

Esta pasta é o "servidor" do app **Finanças da Família**. Ele roda de graça dentro da sua conta Google:

- **Banco de dados**: a planilha `BD_Financas_Familia` (uma aba por tipo de informação).
- **Arquivos**: a pasta `Finanças da Família <Sobrenome>` no Drive (cupons, contas, faturas, backups).
- **API**: um "App da Web" que o aplicativo do celular chama.
- **Rotinas automáticas**: ler e-mails de contas, avisar vencimentos, lembrete diário, backup semanal.

Tudo está em português e comentado. Você não precisa saber programar para instalar — siga os passos.

## O que tem em cada arquivo

| Arquivo | O que faz |
|---|---|
| `appsscript.json` | Configuração do projeto (fuso, permissões, App da Web). |
| `setup.gs` | `instalar()` cria pasta, planilha, dados iniciais, primeiro administrador e gatilhos. Também `seed_exemplo()`, `limpar_exemplo()`, `desinstalar_gatilhos()`. |
| `bd.gs` | Leitura e gravação na planilha (cache, trava, conversão de tipos). |
| `api.gs` | `doGet`/`doPost`: autenticação, perfis, tabela de ações, envelope JSON, log. |
| `auth.gs` | Convites, PIN (SHA-256 + sal), tokens. |
| `lancamentos.gs` | Lançamentos, parcelas, resumo do mês, painel, orçamento, categorias, previstos, mesada, exportar, log. |
| `leitura.gs` | Leitura de cupom/conta/fatura com o Claude; OCR do Drive + regex como reserva; voz; NFC-e. |
| `contas.gs` | Contas fixas, contas a pagar, marcar como paga, consumo, aviso de vencimentos. |
| `email.gs` | Lê o Gmail (marcadores "Contas da Casa" e "Alertas Cartão") e a pasta `_Entrada`. |
| `sms.gs` | Webhook de SMS/alerta do banco, Caixa de Entrada, importação de fatura, cartões. |
| `familia.gs` | Sonhos, aportes, Conselho (votação), reunião mensal, versículo do dia, configurações, brasão. |
| `notificacoes.gs` | Push (via serviço externo opcional), lembrete diário, e-mail de resumo. |
| `backup.gs` | Backup semanal (mantém os 12 últimos) e `backup_agora`. |
| `dados_iniciais.gs` | Grupos, categorias e versículos (gerado a partir de `/dados`, não edite à mão). |
| `util.gs` | Funções puras (datas, hash, parcelas, regra de votação, sugestão de categoria). |
| `testes/` | Testes que rodam no seu computador com `node apps-script/testes/executar.mjs`. |

## Passo a passo da instalação

### 1. Criar o projeto no Apps Script

**Opção A — pelo navegador (mais simples)**

1. Entre em <https://script.google.com> com a conta Google da família e clique em **Novo projeto**.
2. Dê um nome ao projeto (ex.: `Finanças da Família`).
3. Clique na engrenagem **Configurações do projeto** e marque **Mostrar o arquivo de manifesto "appsscript.json" no editor**.
4. Para cada arquivo desta pasta (`*.gs` e `appsscript.json`): no editor, **+ → Script**, dê o mesmo nome (sem a extensão) e cole o conteúdo. No `appsscript.json`, substitua tudo pelo conteúdo do arquivo daqui.

**Opção B — com o `clasp` (para quem usa terminal)**

```bash
npm i -g @google/clasp
clasp login                                   # abre o navegador para autorizar
cd apps-script
clasp create --type standalone --title "Finanças da Família"
cp .clasp.json.example .clasp.json            # se o clasp não criou; cole o scriptId que ele mostrou
clasp push                                    # envia todos os arquivos (aceite sobrescrever o manifesto)
clasp open                                    # abre o projeto no navegador
```

### 2. Ativar o serviço avançado Drive (para o OCR de reserva)

No editor do Apps Script: menu lateral **Serviços (+)** → procure **Drive API** → versão **v2** → **Adicionar**.
(Se você usou o `clasp push`, o `appsscript.json` já pede isso; confira se aparece na lista de serviços.)

### 3. Propriedades do script (onde ficam as chaves)

Engrenagem **Configurações do projeto** → role até **Propriedades do script** → **Adicionar propriedade**:

| Propriedade | Para quê | Obrigatória? |
|---|---|---|
| `SOBRENOME` | Nome da família (ex.: `Melo Reis`). Se não definir, usa o padrão do `setup.gs`. | Não |
| `URL_APP` | Endereço do app publicado (ex.: `https://seunome.github.io/Finan-as-familiares/`). Usado no link de convite. | Sim, para convites |
| `CHAVE_API_CLAUDE` | Chave da API do Claude (console.anthropic.com → API Keys). Sem ela, a leitura cai no OCR do Drive + regex. | Não |
| `MODELO_CLAUDE` | Modelo usado na leitura. Padrão `claude-sonnet-4-5`. Pode trocar por um mais novo. | Não |
| `EMAILS_ADMIN` | E-mails (separados por vírgula) que recebem os resumos. Padrão: o dono do script. | Não |
| `URL_SERVICO_PUSH` / `TOKEN_SERVICO_PUSH` | Serviço externo de push (veja "Notificações"). | Não |

A chave do Claude **nunca** vai para o código nem para a planilha — só fica aqui. O custo é de centavos por cupom lido.

### 4. Rodar `instalar()` e autorizar

1. No editor, escolha a função **`instalar`** na lista ao lado de ▶ **Executar** e clique em Executar.
2. O Google vai pedir autorização. Clique em **Revisar permissões** → escolha a conta → se aparecer "O Google não verificou este app", clique em **Avançado → Acessar Finanças da Família (não seguro)** → **Permitir**. (É o seu próprio script; o aviso aparece para qualquer projeto pessoal.)
3. Veja o **Registro de execução** no fim da tela. Ele mostra o link da pasta, da planilha e o `token_familia`.
4. Foi criado o usuário **Administrador** com PIN **1234**. Troque o PIN no primeiro acesso.

Pode rodar `instalar()` de novo quando quiser: ele não duplica nada, só completa o que faltar (por exemplo, uma aba nova depois de uma atualização).

### 5. Publicar como App da Web

1. Canto superior direito: **Implantar → Nova implantação**.
2. Engrenagem **Selecionar tipo → App da Web**.
3. Preencha: **Executar como: Eu** · **Quem pode acessar: Qualquer pessoa**.
4. **Implantar** → copie a **URL do app da Web** (termina em `/exec`).
5. Essa URL é a `VITE_API_URL` do aplicativo (ver README da pasta `/app`). O `token_familia` está na aba `Config` da planilha (ou no registro do `instalar()`).

> Sempre que você alterar o código, faça **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar**. A URL continua a mesma.

### 6. Testar com `curl`

```bash
curl -L -H 'Content-Type: text/plain' -d '{"acao":"ping"}' 'https://script.google.com/macros/s/SEU_ID/exec'
# → {"ok":true,"dados":{"versao":"1.0.0","nome_familia":""},"versao":"1.0.0"}

curl -L -H 'Content-Type: text/plain' -d '{"acao":"ping","token_familia":"SEU_TOKEN"}' 'https://script.google.com/macros/s/SEU_ID/exec'
# → nome_familia preenchido quando o token confere
```

O `-L` é importante: o Apps Script redireciona o POST e a resposta vem no segundo endereço.

### 7. Entrar no app pela primeira vez

1. No app, informe a URL da API e o `token_familia`, escolha **Administrador** e digite o PIN `1234`.
2. Em **Mais → Família → Redefinir PIN**, troque o PIN.
3. Gere convites para os outros membros (**Mais → Família → Convidar**). O link já leva a URL da API e o token da família; o convite vale 7 dias e só pode ser usado uma vez.

### 8. Filtros do Gmail (contas por e-mail e alertas do cartão)

Os marcadores **Contas da Casa**, **Alertas Cartão** e **Processado** são criados sozinhos na primeira execução de `processarEmails()`. O que você precisa criar são os **filtros** que colocam os e-mails certos nesses marcadores:

1. No Gmail, clique na engrenagem → **Ver todas as configurações → Filtros e endereços bloqueados → Criar um novo filtro**.
2. Em **De**, coloque o remetente da conta (ex.: `copel.com` ou `fatura@sanepar.com.br`). Para vários, separe com `OR`: `copel.com OR sanepar.com.br OR compagas.com.br`.
3. **Criar filtro** → marque **Aplicar o marcador: Contas da Casa** → **Criar filtro**.
4. Repita para os alertas de compra do banco (ex.: `De: alertas@itau.com.br OR nubank.com.br`) com o marcador **Alertas Cartão**.

Dica: no cadastro de cada conta fixa (aba `ContasFixas` ou pela tela de Contas), preencha `remetente_email` com o domínio (ex.: `copel.com`) — é assim que o PDF é casado com a conta certa.

Também dá para **arrastar um PDF** para a pasta `Contas da Casa/_Entrada` no Drive: a cada hora ele é lido e movido para a pasta do mês.

### 9. Captura automática de compras (SMS)

O endereço do webhook é a URL do App da Web com `?webhook=1`. O app mostra, na tela **Captura automática**, o modelo pronto para o Atalhos (iPhone) e para o MacroDroid (Android), já com o token de cada pessoa. Formato:

```
POST https://script.google.com/macros/s/SEU_ID/exec?webhook=1
{"token_familia":"...","token":"token_do_usuario","canal":"sms_ios","texto":"<SMS do banco>"}
```

Ou por GET (`?webhook=1&token_familia=...&token=...&canal=sms_ios&texto=...`). O servidor descarta códigos de verificação e propaganda, nunca guarda OTP nem número completo de cartão, e identifica o membro pelo final do cartão cadastrado.

## Dados de exemplo

- `seed_exemplo()`: cria 12 meses de movimentação de uma família fictícia (4 pessoas, 2 cartões, 8 contas, sonhos, votações, caixa de entrada). Os usuários de exemplo entram com PIN `1234`.
- `limpar_exemplo()`: remove tudo o que o seed criou (os ids começam com `seed_`).

## Rotinas automáticas (gatilhos)

| Função | Quando | O que faz |
|---|---|---|
| `processarEmails` | a cada hora | Lê os marcadores do Gmail. |
| `processarPastaEntrada` | a cada hora | Lê os arquivos de `Contas da Casa/_Entrada`. |
| `gerarPrevistosDoMes` | todo dia às 6h | Cria os lançamentos "a confirmar" das contas fixas. |
| `avisarVencimentos` | todo dia às 8h | E-mail + push: contas que vencem em 3 dias, hoje, atrasadas e as que subiram +20%. |
| `lembreteDiario` | na hora configurada (padrão 20h) | "Você lançou os gastos de hoje?" |
| `backupSemanal` | domingo às 3h | Cópia da planilha em `Backups/` (mantém 12). |

`desinstalar_gatilhos()` remove todos; `instalar()` recria.

## Notificações push

O padrão Web Push exige assinar cada envio com uma chave VAPID (algoritmo ES256). O Apps Script **não** consegue fazer essa assinatura, então o envio é delegado a um serviço pequeno e opcional:

- Hospede uma função (Cloud Functions, Vercel, Deno Deploy…) que use a biblioteca `web-push`, guarde as chaves VAPID geradas por `webpush.generateVAPIDKeys()` e aceite `POST { chave, titulo, corpo, url, assinaturas: [...] }`, devolvendo `{ ok: true, invalidas: [endpoints expirados] }`.
- Coloque o endereço em `URL_SERVICO_PUSH` (e um segredo em `TOKEN_SERVICO_PUSH`, conferido pelo serviço).

**Sem esse serviço tudo continua funcionando**: o lembrete diário e os avisos de vencimento chegam por **e-mail** aos administradores. As assinaturas dos navegadores ficam guardadas na aba `Push` para quando o serviço for ligado.

## Segurança — o que foi decidido

- PIN guardado como SHA-256 com sal por usuário; 5 erros bloqueiam por 10 minutos.
- Token por usuário, revogável (`renovar_token`); token da família na aba `Config`.
- Júnior nunca recebe categorias/lançamentos sensíveis (salários), só vê os próprios lançamentos e nunca recebe tokens de outros.
- Cartões: só os 4 últimos dígitos, sempre truncados antes de gravar.
- Imagens (brasão, capa, anexos) são compartilhadas como "qualquer pessoa com o link pode ver", porque o app precisa mostrá-las sem login Google. Os links são longos e não aparecem em buscas, mas não coloque documentos sigilosos pelo app.
- Ícones 192/512 do PWA: o Apps Script não converte SVG em PNG, então `salvar_brasao_svg` devolve o mesmo SVG nas três URLs; o app usa SVG no manifest.

## Testes no computador

```bash
node apps-script/testes/executar.mjs              # sintaxe de todos os .gs + funções puras + contrato da API
node apps-script/testes/verificar_referencias.mjs  # toda função chamada existe?
node apps-script/testes/gerar_dados_iniciais.mjs   # regenera dados_iniciais.gs a partir de /dados
```

## Problemas comuns

- **"Família não encontrada"**: o `token_familia` enviado não é o da aba `Config`.
- **"Sessão expirada"**: token do usuário inválido (foi renovado ou o usuário foi desativado). O app pede o PIN de novo.
- **"Sem permissão"**: a ação exige um perfil maior.
- **Leitura de cupom devolve confiança 0**: sem `CHAVE_API_CLAUDE` e sem o serviço Drive ativado. Ative o Drive (passo 2) ou configure a chave (passo 3).
- **O POST do celular não chega**: confira se a implantação está como "Qualquer pessoa" e se você criou uma **nova versão** após alterar o código.
