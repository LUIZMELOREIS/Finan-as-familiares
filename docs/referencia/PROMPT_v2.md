# PROMPT PARA O CLAUDE CODE — "Finanças da Família" (versão 2)

> **Como usar:** crie uma pasta nova no Claude Code (ex.: `financas-familia`), coloque nela os 3 arquivos do pacote e cole este prompt:
> - `referencia_visual.html` — **o padrão visual obrigatório** (abra no navegador para ver);
> - `Referencia_Dashboard.png` — o print do dashboard que deu origem ao padrão;
> - `Planilha_Meu_Bolso_em_Dia.xlsx` — só referência de categorias.

---

## 0. Regras de trabalho

1. Trabalhe de forma **autônoma**: planeje, crie, teste e só me chame para o que só eu posso fazer (login Google, chave de API, autorizar o Apps Script, publicar).
2. Crie um `PLANO.md` com as fases da seção 12 e atualize a cada etapa.
3. Tudo em **português do Brasil**.
4. **O arquivo `referencia_visual.html` é o contrato visual.** Abra, leia o código e reproduza as telas Painel, Lançar, Assistente e Projetos com a mesma grade, as mesmas cores, a mesma tipografia, os mesmos ícones e os mesmos espaçamentos. Os dados de exemplo dele devem virar dados reais. Não invente outro layout.
5. Ao fim de cada fase, tire **screenshots em 1440×900 e 390×844** das telas e compare lado a lado com o `referencia_visual.html`. Corrija tudo o que divergir antes de seguir.

---

## 1. O produto

App de **controle financeiro da família**, de uso diário pelo celular (instalável na tela inicial como app) e com painel completo no computador. Cada membro lança as despesas do dia a dia em segundos (foto do cupom, voz, texto ou digitação). As contas da casa são lidas de PDFs e e-mails. Os gastos de cartão esquecidos são capturados pelos SMS e alertas do banco. A família acompanha o painel junto, decide onde alocar recursos e acompanha a poupança de cada projeto. Base cristã de mordomia: Deus é o dono, nós administramos.

**Tom:** sério e adulto, como um app de banco ou de gestão financeira. É um produto para a família toda, de qualquer idade, mas **não é infantil**.

---

## 2. Padrão visual (obrigatório)

### 2.1 Proibido
- Emojis em qualquer lugar da interface (cards, botões, categorias, mensagens).
- Confete, mascote, ilustração cartunesca, avatar de bichinho, animações comemorativas.
- Cores fora da paleta, gradientes decorativos de fundo, cantos exageradamente arredondados.
- Mais de 4 cards de tipo na tela inicial.

### 2.2 Obrigatório
- **Tema escuro** idêntico à referência (tema claro opcional em Configurações, com os mesmos componentes).
- **Ícones de linha da biblioteca Lucide** (`lucide-react`), traço 1.75. Nos cards: ícone dentro de um quadrado de 34 px com fundo da cor do grupo a 16% de opacidade.
- **Fonte Poppins** (400/500/600/700). Números com `font-variant-numeric: tabular-nums`.
- Valores sempre em `R$ 1.234,56`, datas em `dd/mm/aaaa`.
- Áreas de toque de no mínimo 44 px, texto base de 14 px no desktop e 15 px no celular, contraste WCAG AA.

### 2.3 Tokens de cor (copiar exatamente)
```css
--side:#0D0E23;  --panel:#141519; --card:#1E1F26; --card-2:#24252E; --line:#2C2E3A;
--text:#ECECF2;  --muted:#8E90A2; --faint:#5E6072;
--indigo:#5B5BE0; --sel:#7776E6;  --magenta:#BD55C7; --gold:#F2C552;
--orange:#E0852F; --green:#4CB963; --red:#E5535B; --lilac:#9A99F0; --rose:#E58FD9; --slate:#6B6E80;
raio: cards 14px · campos 9–10px · chips 9px
```
Cores fixas por grupo, nos gráficos e nos cards: Moradia = índigo · Consumo = lilás · Saúde e educação = ouro · Transporte = laranja · Alimentação = magenta · Lazer = rosa · Dízimo e ofertas = verde · Outros = ardósia.

### 2.4 Estrutura do Painel (igual à referência)
- **Barra lateral azul-noite (240 px):** brasão ou foto da família em círculo com borda dourada, nome da família, versículo-lema com filete dourado, seletor de **Ano**, lista de **Meses** (item ativo em `--sel`), seletor **Visão** (Toda a família / cada membro) e navegação (Painel, Lançar despesa, Contas a pagar com contador, Projetos, Assistente, Configurações).
- **Linha 1:** os **4 cards de tipo** (seção 3).
- **Linha 2:** *Saldo do mês* e *Despesas do mês* (valor e sparkline em área com gradiente à direita), donut *Despesas no mês* e donut *Despesas no ano* (% da receita no centro, legenda à direita).
- **Linha 3:** *Análise mensal* (barras agrupadas jan–dez: Salários em índigo × Outras receitas em magenta; meses futuros como previsão com 35% de opacidade) e *Participação na base anual* (anéis com o % de cada grupo sobre a receita do ano).
- **Linha 4:** *Detalhamento de despesas* (barras horizontais das subcategorias, com a lista de grupos clicável à direita) e *Receitas e despesas* (linhas jan–dez; previsão tracejada).
- **Linha 5:** *Próximas saídas* (30 dias) e *Avisos do assistente* (seção 7).
- **Celular (≤ 760 px):** a barra lateral vira um cabeçalho com brasão, nome, seletor de ano e meses em faixa horizontal rolável. Cards em 2 colunas, gráficos em largura total e **barra inferior fixa** com Painel · Contas · **[+] Lançar** (botão central destacado) · Projetos · Assistente.
- Todo gráfico é clicável: tocar numa fatia ou barra abre a lista de lançamentos correspondente, com a foto do comprovante.

### 2.5 Capa da família
- **Tela de entrada / bloqueio:** foto da família em tela cheia com véu escuro, brasão centralizado, "Família <Sobrenome>", o lema e o campo de PIN. É a "capa" do app.
- No uso diário, o brasão (ou a foto recortada em círculo) fica na barra lateral ou no cabeçalho, como na referência.
- **Configurações › Identidade:**
  - enviar foto de capa;
  - enviar um brasão próprio (PNG/SVG);
  - ou montar um brasão no **construtor em estilo heráldico clássico**: escudo, até 2 esmaltes, partição, um móvel (cruz, âncora, livro aberto, araucária, leão, ramo de oliveira), iniciais e listel com mote. O resultado é um SVG em traço dourado sobre azul-noite, sóbrio, que também gera os ícones 192/512 px do app.

---

## 3. Os 4 cards de tipo (únicos atalhos de categoria)

| Card | Ícone Lucide | Cor | Mostra |
|---|---|---|---|
| **Receitas** | `wallet` | verde | Total do mês, barra contra o previsto, % |
| **Despesas fixas** | `house` | índigo | Total do mês, barra contra o orçado (fica vermelha acima de 100%), % |
| **Despesas variáveis** | `shopping-cart` | magenta | Idem |
| **Projetos** | `target` | ouro | Total guardado, % médio das metas, nº de projetos ativos |

Tocar num card abre a lista do tipo, agrupada por subcategoria, com total, orçado, variação contra o mês anterior e os lançamentos.

---

## 4. Cardápio de despesas (lista pronta para escolher)

Ao lançar, a pessoa **escolhe a despesa num cardápio pronto**, sem digitar nome de categoria. Layout igual à tela Lançar da referência:
- abas **Despesas fixas | Despesas variáveis | Receitas**;
- linha **"Mais usados por você"** no topo (as 5 mais frequentes do usuário, aprendidas com o uso);
- grupos com título e filete na cor do grupo;
- chips com ícone Lucide e nome;
- a **sugestão automática** (pela loja, pelas palavras-chave ou pela IA) já vem marcada; a pessoa só confirma.

**Cardápio inicial (editável em Configurações):**

**Despesas fixas**
- *Dízimo e ofertas* (primeiro grupo): Dízimo `church` · Ofertas `hand-heart` · Missões e ajuda `hand-coins`
- *Moradia:* Aluguel `key-round` · Prestação da casa `house` · Condomínio `building-2` · IPTU `landmark`
- *Contas de consumo:* Luz `zap` · Água `droplet` · Gás `flame` · Internet `wifi` · Telefone e celular `smartphone`
- *Saúde e educação:* Plano de saúde `heart-pulse` · Escola e faculdade `graduation-cap` · Cursos e livros `book-open`
- *Transporte:* Financiamento do carro `car` · Seguro do carro `shield-check` · IPVA e licenciamento `landmark` · Vale-transporte `bus`
- *Assinaturas:* Streaming `tv` · Aplicativos `smartphone` · Seguros diversos `shield-check`

**Despesas variáveis**
- *Alimentação:* Supermercado `shopping-cart` · Feira e hortifrúti `apple` · Padaria `croissant` · Açougue `beef` · Delivery `bike` · Restaurantes `utensils`
- *Transporte do dia a dia:* Combustível `fuel` · Estacionamento e pedágio `parking-meter` · App de transporte `car` · Manutenção do carro `wrench`
- *Saúde e cuidados:* Farmácia `pill` · Consultas e exames `stethoscope` · Cabelo e estética `scissors`
- *Casa:* Reparos e manutenção `hammer` · Móveis e utensílios `sofa` · Limpeza `spray-can`
- *Lazer:* Passeios e eventos `ticket` · Viagens curtas `plane` · Hobbies `palette`
- *Outros:* Vestuário `shirt` · Presentes `gift` · Pets `paw-print` · Imprevistos `triangle-alert`

**Receitas:** Salário (por membro) `briefcase` · Renda extra `banknote` · Aluguel recebido `house` · Rendimentos `piggy-bank` · Reembolsos `circle-dollar-sign` · Outras entradas `wallet`

**Regras do cardápio:**
- Cada item tem `palavras_chave` (ex.: Luz → "COPEL"; Água → "SANEPAR"; Combustível → "POSTO;SHELL;IPIRANGA;BR") para a classificação automática.
- A classificação **aprende**: quando o usuário corrige uma loja, essa loja passa a cair sempre na categoria escolhida (tabela `RegrasLoja`).
- Em **Configurações › Cardápio**: incluir, renomear, mudar ícone (seletor com a biblioteca Lucide), mover de grupo, ocultar e definir orçamento mensal. Novos grupos só dentro dos 3 tipos; os 4 cards nunca aumentam.

---

## 5. Arquitetura (manter)

| Camada | Tecnologia |
|---|---|
| App | **PWA** — React + Vite + TypeScript + Tailwind (tokens da seção 2.3 no `tailwind.config`) + `lucide-react` + gráficos em **SVG próprio ou Recharts estilizado** para ficar idêntico à referência |
| Hospedagem | GitHub Pages ou Vercel (HTTPS); opcionalmente um subdomínio próprio |
| API | **Google Apps Script** publicado como Web App (`doGet`/`doPost`, POST com `Content-Type: text/plain` para evitar CORS) |
| Banco de dados | **Google Planilhas** numa pasta do meu **Google Drive** |
| Arquivos | Subpastas no mesmo Drive |
| IA (leitura e assistente) | **API do Claude** (visão + PDF + texto) chamada só pelo Apps Script; chave nas *Script Properties*. Fallback gratuito para OCR: conversão de imagem/PDF pelo Google Drive + regex |

**Pastas no Drive** (criadas por `instalar()` em `setup.gs`):
```
Finanças da Família <Sobrenome>/
  BD_Financas_Familia            (planilha-banco)
  Comprovantes/AAAA/MM/          (cupons e recibos)
  Contas da Casa/AAAA/MM/  e  Contas da Casa/_Entrada/
  Faturas de Cartão/AAAA/MM/
  Identidade/                    (brasão, foto de capa)
  Backups/                       (cópia semanal automática)
```

**Abas da planilha:** `Config` · `Usuarios` · `Tipos` (Receitas / Fixas / Variáveis) · `Grupos` · `Categorias` (cardápio: grupo, nome, ícone, cor, palavras_chave, orçamento, ativa) · `RegrasLoja` · `Lancamentos` (id, data, competência, valor, categoria, descrição, loja, forma_pgto, cartão, parcela, usuário, origem `manual|foto|voz|chat|sms|email|fatura|recorrente`, anexo_url, status `confirmado|a_confirmar`, hash_dedup) · `ContasFixas` · `ContasAPagar` (valor, vencimento, linha digitável, Pix copia-e-cola, consumo kWh/m³, anexo, status, pago_por) · `Cartoes` (apelido, banco, **só os 4 últimos dígitos**, titular, fechamento, vencimento) · `CaixaEntrada` · `Orcamento` · `Projetos` · `Aportes` · `Decisoes` · `Votos` · `Alertas` · `Patrimonio` · `Versiculos` · `Log`.

Regras: soft delete; `hash_dedup` = valor + data + final do cartão + loja normalizada; backup semanal; log de auditoria.

---

## 6. Formas de lançar

1. **Fotografar cupom:** câmera traseira, compressão no celular (1600 px, JPEG 80%), salva em `Comprovantes/`. O Claude extrai valor, data, loja, CNPJ, forma de pagamento e categoria sugerida. Se o cupom tiver QR Code de NFC-e, ler o QR e tentar a consulta na SEFAZ. Abre a tela de conferência (como na referência) e um toque em **Confirmar lançamento** encerra.
2. **Enviar fatura** (luz, água, gás, internet, telefone, plano de saúde, escola ou fatura de cartão), em PDF ou foto. Ver seções 8 e 9.
3. **Digitar:** valor em teclado numérico grande, depois o cardápio, depois confirmar. No máximo 3 toques.
4. **Falar** e **escrever no Assistente:** "gastei 45 na padaria no Pix" → o Claude devolve `{valor, categoria, forma_pgto, data}` e o assistente confirma o lançamento na conversa.
5. **Recorrentes e parcelados:** as contas fixas geram o lançamento previsto do mês. Compras em "6x" se distribuem nas competências certas, conforme o fechamento do cartão.

---

## 7. Assistente financeiro (inspirado na Pierre, sem conexão com bancos)

A Pierre (pierre.finance) é uma IA de finanças com que se conversa pelo app e pelo WhatsApp: responde perguntas sobre gastos, prevê parcelas e assinaturas, avisa de cobranças fora do padrão ou duplicadas, acompanha metas, envia relatórios e usa "agentes" que trabalham sozinhos. Trazer isso para o nosso app, **usando os dados da nossa planilha**, sem Open Finance:

**7.1 Conversa (tela Assistente — ver referência)**
- Perguntas em linguagem natural respondidas com números e, quando fizer sentido, uma mini-barra comparativa: "Quanto gastamos com delivery este mês?", "Onde podemos economizar?", "Quais assinaturas temos?", "Como fechamos setembro?", "Dá para fechar a viagem de julho?".
- Lançar pela conversa, por texto, voz ou foto anexada.
- Sugestões de pergunta em chips acima do campo.
- Implementação: o Apps Script monta um resumo agregado dos dados (totais por categoria e mês, médias, contas, projetos) e envia ao Claude com *tool use* para consultas específicas (`buscar_lancamentos`, `total_por_categoria`, `projetar_meta`, `lancar_despesa`). Nunca enviar dados pessoais desnecessários.

**7.2 Rotinas automáticas** (gatilhos do Apps Script, cada uma liga/desliga em Configurações)
- **Vigia diário** (todo dia às 20h): gasto fora do padrão (acima de 1,5× a média da categoria), **cobrança duplicada**, **assinatura nova ou esquecida** (recorrência detectada que ninguém cadastrou), conta a vencer em 3 dias, gastos de cartão sem categoria e lembrete "lance os gastos de hoje".
- **Análise quinzenal** (dias 1 e 16): tendências por categoria contra a média de 3 meses, com uma recomendação objetiva.
- **Fechamento do mês** (dia 1º): relatório do mês, **projeção dos próximos 3 meses** e **pauta da reunião de família** (ver 10.2), enviados por e-mail aos administradores e disponíveis no app.

**7.3 Alertas personalizados:** o usuário cria regras simples, por exemplo "Delivery acima de R$ 400/mês → avisar Luiz e Nina" ou "Supermercado acima de R$ 2.000/mês → avisar todos".

**7.4 Previsão de saídas:** o card *Próximas saídas* e a tela Contas mostram, para 30/60/90 dias, contas fixas, parcelas de cartão, assinaturas e faturas, com status: lida do e-mail, prevista, estimada ou parcela.

**7.5 Patrimônio (manual):** saldos de contas e investimentos informados pela família, com gráfico de evolução mensal.

**7.6 Canal de mensagens (fase 6):** um **bot de Telegram** gratuito da família, para lançar por mensagem ou foto e receber os avisos. WhatsApp fica para depois, porque a API oficial é paga.

**7.7 Futuro (não fazer agora):** conexão com bancos via Open Finance (Pluggy, Belvo), que hoje é caro para uso familiar.

---

## 8. Contas da casa lidas automaticamente

1. **Upload** (PDF ou foto) pelo app. O Claude extrai empresa, competência, valor, vencimento, linha digitável, Pix e consumo, e associa à conta fixa.
2. **Gmail:** marcador "Contas da Casa" (filtro para Copel, Sanepar, Compagas, operadoras, plano de saúde, escola). Um gatilho de hora em hora salva o PDF, extrai os dados e marca o e-mail como processado.
3. **Pasta `_Entrada` no Drive:** o PDF que cair ali é processado e movido para a pasta do mês.

Funções: calendário de vencimentos, aviso 3 dias antes e no dia, botões **Copiar código de barras / Pix** e **Marcar como paga** (registra quem pagou), gráfico de consumo (kWh, m³) com alerta de alta acima de 20%.

---

## 9. Cartão: gastos esquecidos (SMS, alertas e fatura)

Nenhum app pode ler sozinho os SMS do celular. A captura é feita por automações do aparelho, que encaminham a mensagem para a API. Criar a tela **Configurações › Captura automática** com guia passo a passo e token por usuário:
1. **iPhone (app Atalhos):** Automação › Mensagem › contém "compra" ou remetente do banco › *Obter conteúdo do URL* (POST JSON `{token, canal:"sms_ios", texto}`). Desde o iOS 17 a automação roda sozinha.
2. **Android (MacroDroid):** gatilhos *SMS recebido* e *Notificação do app do banco* › *Requisição HTTP*. Fornecer a macro pronta para importar.
3. **E-mail de alerta do banco:** marcador "Alertas Cartão", lido pelo mesmo gatilho.
4. **Fatura do cartão** (PDF, OFX ou CSV): concilia com o que já foi lançado (mesmo valor e ±2 dias) e só traz o que ninguém lançou.

Parser: regex por banco (Itaú, Bradesco, Santander, BB, Caixa, Nubank, Inter, C6, BV, Ailos/cooperativas), em tabela fácil de ampliar, com o Claude como fallback. O membro é identificado pelo final do cartão. Os gastos capturados caem na **Caixa de Entrada**, cada um com a pergunta "R$ 87,40 · Padaria X — qual é a despesa?" e os chips do cardápio com a sugestão marcada. Nunca armazenar número completo do cartão nem códigos de SMS.

---

## 10. Família: usuários, decisões e projetos

**10.1 Usuários**
- Perfis: **Administrador**, que configura tudo e aprova; **Adulto**, que lança, vê o painel e vota; **Dependente**, que lança os próprios gastos, vê a mesada e os projetos, vota e, por padrão, não vê salários.
- Entrada: o administrador gera um **link ou QR Code de convite**. A pessoa abre no celular, segue as instruções de "Adicionar à Tela de Início" (iPhone/Safari e Android/Chrome), define nome, foto e PIN de 4 dígitos. O aparelho fica lembrado; o PIN é pedido para ações sensíveis ou após 30 dias. Login Google opcional para adultos.
- Lembrete diário (web push no Android e no iPhone 16.4+ com o app instalado; e-mail como reserva).

**10.2 Decisões em família**
- Propostas de novo projeto, gasto acima de um valor definido ou ajuste de orçamento.
- Votação Sim / Não / Abstenção com comentário e prazo. Regra configurável: maioria, ou maioria com aprovação dos administradores.
- **Reunião mensal:** pauta automática com o fechamento do mês, o que passou do orçamento, contas que subiram, situação dos projetos e decisões abertas. Inclui um versículo para reflexão, campo de decisões e um motivo de gratidão. Exporta em PDF.

**10.3 Projetos** (tela Projetos — ver referência)
- Nome, meta, data-alvo e versículo (padrão: Lc 14.28).
- O app calcula **quanto guardar por mês** e mostra **No ritmo / Atrasado R$ X / Em votação**.
- Aportes por membro e simulador: "reduzindo delivery em R$ 130/mês, a meta fecha em junho".
- **Divisão da renda** configurável (Dar → Poupar → Viver), com o painel mostrando o planejado contra o realizado.

---

## 11. Base no Evangelho (sóbria)

- Versículo-lema na barra lateral (padrão: Js 24.15) e versículo do dia no relatório e na pauta da reunião. Pré-carregar pelo menos 60 versículos de versão em domínio público (Almeida), por exemplo: Pv 3.9; Pv 21.5; Pv 22.7; Pv 6.6-8; Ml 3.10; Mt 6.19-21; Mt 6.33; Lc 14.28; Lc 16.10; 2Co 9.7; Fp 4.11-13; Fp 4.19; 1Tm 6.6-10; Hb 13.5; Sl 24.1; Sl 37.21.
- "Dízimo e ofertas" é o primeiro grupo das despesas fixas.
- Mensagens contextuais curtas e respeitosas, nunca de culpa.
- Tudo pode ser desligado em Configurações.

---

## 12. Fases de entrega

| Fase | Entrega | Aceite |
|---|---|---|
| 1 | `setup.gs` (pasta, planilha, abas, cardápio, versículos), API, PWA instalável, tokens visuais, barra lateral/cabeçalho, 4 cards, lançamento por digitação com cardápio, convites e PIN | Instalo no iPhone e no Android, lanço pelo cardápio e o lançamento aparece na planilha |
| 2 | Painel completo no padrão da referência, filtros ano/mês/membro, orçado × realizado, `seed_exemplo()` com 12 meses | Screenshot do painel idêntico ao `referencia_visual.html` em 1440 e 390 px |
| 3 | Foto do cupom (+ NFC-e), voz, upload de faturas, Gmail e `_Entrada`, contas a pagar com avisos | Cupom real e fatura da Copel em PDF lidos corretamente |
| 4 | Cartões, webhook de SMS, Atalho iPhone, macro Android, alertas por e-mail, conciliação de fatura, Caixa de Entrada | SMS de compra aparece em até 1 min; importar a fatura não duplica nada |
| 5 | Assistente (conversa, lançar pelo chat, tool use), rotinas vigia/quinzenal/mensal, alertas personalizados, previsão de saídas | As perguntas da referência respondidas com os números corretos da planilha |
| 6 | Projetos, votação, reunião mensal, patrimônio, construtor de brasão, tela de capa, bot Telegram, tema claro, offline (IndexedDB + service worker), backup | Fluxo completo de um projeto: propor, votar, aprovar, aportar, acompanhar |

---

## 13. Entregáveis

- Repositório com `/app` (PWA) e `/apps-script` (com `clasp` configurado).
- `README.md` com instalação passo a passo para leigo, incluindo como publicar o Apps Script e criar os filtros do Gmail.
- `GUIA_DA_FAMILIA.md` (1 página): instalar, lançar, responder a Caixa de Entrada, votar.
- `GUIA_CAPTURA_SMS.md`: iPhone e Android, com os modelos prontos.
- `PLANO.md` atualizado.
