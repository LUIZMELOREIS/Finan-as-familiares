# PLANO.md — Finanças da Família

> App de controle financeiro da família, de uso diário pelo celular e com painel completo no computador. Base cristã de mordomia.
> Este arquivo acompanha as fases, as decisões técnicas e o que ficou para depois.
> Legenda: ✅ concluído · 🔄 em andamento · ⬜ a fazer · ⏸️ precisa do Luiz

## Versão 2 (17/10/2026) — padrão visual obrigatório

O prompt v2 (`docs/referencia/PROMPT_v2.md`) trouxe um **contrato visual**: `docs/referencia/referencia_visual.html`.
O que mudou em relação à versão 1:

| Versão 1 | Versão 2 |
|---|---|
| Emojis como ícones, confete, capa com foto na tela inicial | **Sem emojis nem confete.** Ícones de linha **Lucide** (traço 1,75) em quadrado de 34 px com a cor do grupo a 16 % |
| Tela inicial própria + Painel separado | **Painel é a tela inicial**, idêntico à referência (barra lateral 240 px com brasão, lema, ano, meses, visão e navegação) |
| 5 cards (Entradas, Contas da Casa, Dia a Dia, Dízimo, Sonhos) | **4 cards de tipo**: Receitas · Despesas fixas · Despesas variáveis · Projetos (nunca aumentam) |
| Categorias em 5 grupos | **Cardápio** em 3 tipos → grupos → itens, com cores fixas por grupo de análise e aprendizado por loja (`RegrasLoja`) |
| Perfil Júnior | Perfil **Dependente** |
| Sem assistente | **Assistente financeiro** (conversa com tool use, rotinas vigia/quinzenal/fechamento, alertas personalizados, previsão de saídas, patrimônio) |
| Sonhos com termômetro e confete | **Projetos** sóbrios: No ritmo / Atrasado R$ X / Em votação |
| — | Tela de **capa** (foto + véu + brasão + PIN), bot do **Telegram**, brasão **heráldico** sóbrio |

Fases da v2 (seção 12 do prompt):

| Fase | Entrega | Estado |
|---|---|---|
| 1 | `setup.gs` (Tipos, cardápio, versículos), API, PWA, tokens visuais, barra lateral/cabeçalho, 4 cards, lançamento por cardápio, convites e PIN | ✅ código · ⏸️ aceite real (instalar no iPhone/Android) |
| 2 | Painel completo no padrão da referência, filtros ano/mês/membro, orçado × realizado, `seed_exemplo()` | ✅ (capturas 1440/390 comparadas com `docs/referencia/ref_*.png`) |
| 3 | Foto do cupom (+ NFC-e), voz, upload de faturas, Gmail e `_Entrada`, contas a pagar com avisos | ✅ código · ⏸️ aceite com cupom real e PDF da Copel (precisa da chave do Claude) |
| 4 | Cartões, webhook de SMS, Atalho iPhone, macro Android, alertas por e-mail, conciliação, Caixa de Entrada | ✅ código · ⏸️ aceite com SMS real no iPhone |
| 5 | Assistente (conversa, lançar pelo chat, tool use), rotinas, alertas personalizados, previsão de saídas | ✅ (sem chave: regras locais; com chave: tool use no Apps Script) |
| 6 | Projetos, votação, reunião mensal, patrimônio, construtor de brasão, capa, bot Telegram, tema claro, offline, backup | ✅ código · ⏸️ bot do Telegram depende do token do @BotFather |

Verificação da v2: `npm test` 45 testes · `node apps-script/testes/executar.mjs` 128 testes · build limpo · nenhum emoji em `app/src` · capturas em `app/capturas/` (`npm run capturas` e `TAMANHO=desktop npm run capturas`).

Simplificações conhecidas da v2:
- **Ícones do brasão**: o Apps Script não rasteriza SVG; os PNGs 192/512 são baixados na tela Brasão e substituem `app/public/icones/` + `brasao.svg` antes de republicar (ou `npm run icones`).
- **Push nativo**: continua via serviço externo opcional; sem ele os avisos vão por e-mail e Telegram.
- **Avisos do vigia**: vencimentos e "sem categoria" são recalculados a cada chamada; tendências e fechamento vivem na aba `Avisos`.
- **Webhook do Telegram** valida uma chave na URL (o Apps Script não expõe cabeçalhos); foto pendente fica 30 min no CacheService.
- **Categorias desativadas** só reaparecem na planilha (o `bootstrap` devolve só as ativas).
- **E-mail do resumo** vai como chave extra em `salvar_config` (`email_resumo`), que o servidor aceita.

Decisões da v2:
1. **Tokens e classes CSS copiados da referência** para `app/src/index.css` (`.side`, `.gcard`, `.dash`, `.chip`, `.tabs`, `.msg`, `.bottom`…). As telas usam essas classes, não inventam outras.
2. **Ícones por nome** (kebab-case Lucide) na planilha; o componente `Icone` mapeia só os ícones usados (tree-shaking).
3. **Grupos de análise fixos** (Moradia, Contas de consumo, Saúde e educação, Transporte, Alimentação, Lazer, Dízimo e ofertas, Outros) com cores fixas, calculados a partir do grupo da categoria (`grupo_analise`), para donuts, anéis e detalhamento ficarem iguais à referência.
4. **Aportes em projetos não contam como despesa** (o card Projetos mostra o total guardado; Despesas fixas + variáveis = Despesas do mês).
5. **Assistente sem chave do Claude** responde por regras locais às perguntas comuns e lança por texto; com a chave, conversa livre com tool use no servidor.
6. **Filtros globais** (ano, mês, membro) vivem na barra lateral/cabeçalho e valem para todas as telas.

---

## Versão 1 (histórico)


> App de celular (PWA) da família para controle de despesas, com o Evangelho como base.
> Este arquivo acompanha as fases, as decisões técnicas e o que ficou para depois.
> Legenda: ✅ concluído · 🔄 em andamento · ⬜ a fazer · ⏸️ precisa do Luiz

## Arquitetura (decidida)

| Camada | Tecnologia |
|---|---|
| App | PWA — React 19 + Vite 8 + TypeScript + Tailwind 4 + Recharts (pasta `/app`) |
| Hospedagem | GitHub Pages (workflow pronto em `.github/workflows/publicar-app.yml`) ou Vercel |
| API | Google Apps Script como App da Web (pasta `/apps-script`, publicável com `clasp`) |
| Banco | Google Planilha `BD_Financas_Familia` dentro de `Finanças da Família <Sobrenome>/` no Drive |
| Arquivos | Subpastas do Drive (Cupons, Contas da Casa, Faturas de Cartão, Projetos, Identidade, Backups) |
| Leitura inteligente | API do Claude (visão + PDF) chamada pelo Apps Script; fallback OCR do Drive + regex |
| E-mail | Gatilho de tempo lendo o Gmail (marcadores "Contas da Casa" e "Alertas Cartão") |

## Fases

### Fase 1 — Fundação ✅
- ✅ Tipos compartilhados (`app/src/tipos`) e contrato da API (`docs/API.md`)
- ✅ Dados iniciais: 5 grupos/cards, 42 categorias com palavras-chave, 68 versículos (ARC, domínio público) em `/dados`
- ✅ `setup.gs` com `instalar()` — pasta, subpastas, planilha com todas as abas, dados iniciais, gatilhos
- ✅ API Apps Script (`doGet`/`doPost`): todas as ações do contrato, validação de perfil no servidor
- ✅ PWA instalável: manifest, service worker, ícones gerados do brasão, tema escuro/claro
- ✅ Tela inicial: capa (foto/brasão, lema, versículo do dia, saudação) + faixa Entrou/Saiu/Sobrou + 5 cards + botão "+"
- ✅ Lançamento por digitação (teclado numérico → grade de categorias → confirmação), parcelado
- ✅ Convite por link/QR, escolha de avatar, PIN de 4 dígitos, celular lembrado
- ✅ Modo demonstração (sem Apps Script) com 12 meses de dados de exemplo
- ⏸️ Aceite real: instalar no iPhone/Android e ver o lançamento na planilha — depende de o Luiz rodar `instalar()` e publicar

### Fase 2 — Painel ✅
- ✅ Dashboard no formato da referência: seletor ano/mês/membro, KPIs com sparkline, donuts mês/ano, Análise Mensal (salários × outras), anéis de participação anual, detalhamento por subcategoria, Receitas × Despesas
- ✅ Orçado × realizado, gastos por membro, evolução da poupança dos projetos
- ✅ `seed_exemplo()` no Apps Script (12 meses) e o mesmo gerador no modo demonstração
- ✅ Tudo clicável: toca na fatia/barra → lista de lançamentos

### Fase 3 — Leitura inteligente ✅ (código) / ⏸️ (aceite real)
- ✅ Foto do cupom: câmera traseira, compressão no celular, leitura pelo Claude, QR da NFC-e (jsQR) e consulta à SEFAZ
- ✅ Voz: Web Speech API pt-BR com fallback para ditado do teclado; frase → extrator local → Claude
- ✅ Upload de fatura (foto/PDF) → `ContasAPagar` casada com a conta fixa
- ✅ Gmail (marcador "Contas da Casa") e pasta `Contas da Casa/_Entrada` processados por gatilho horário
- ✅ Calendário de vencimentos, aviso 3 dias antes e no dia, copiar código de barras/Pix, marcar como paga, gráfico de consumo com alerta de +20%
- ⏸️ Aceite: foto de cupom real e PDF da Copel — precisa da chave da API do Claude nas Script Properties

### Fase 4 — Cartões ✅ (código) / ⏸️ (aceite real)
- ✅ Cadastro de cartões (só 4 últimos dígitos), webhook `?webhook=1`, token por usuário revogável
- ✅ Parser por banco (Itaú, Bradesco, Santander, BB, Caixa, Nubank, Inter, C6, genérico) + Claude como fallback
- ✅ Guia iPhone (Atalhos) e Android (MacroDroid) com modelo pronto e URL/token preenchidos (tela "Captura automática")
- ✅ Alertas por e-mail (marcador "Alertas Cartão"), importação de fatura (PDF/OFX/CSV) com conciliação (`hash_dedup`, ±2 dias)
- ✅ Caixa de Entrada: "Você gastou R$ X em Y — de que é isso?" com botões de categoria; badge de pendentes

### Fase 5 — Família ✅
- ✅ Sonhos: meta, data-alvo, foto, versículo, "quanto guardar por mês", no ritmo/atrasado, termômetro, confete a 25/50/75/100%, aportes por membro, simulador de corte
- ✅ Conselho: propostas, votação Sim/Não/Abstenção com comentário, prazo, regra (maioria ou maioria + pais)
- ✅ Reunião mensal: pauta automática com versículo, registro do decidido e oração/gratidão, exportar/imprimir
- ✅ Mesada Júnior com cofrinho
- ✅ Construtor de brasão em SVG (escudo, cores, divisão, símbolo, iniciais, mote, ano) → capa + ícones 192/512
- ✅ Lembrete diário (Web Push) e aviso de vencimentos (push + e-mail de resumo)

### Fase 6 — Acabamento ✅
- ✅ Acessibilidade: botões ≥ 48 px, letra 16–18 px base com 3 tamanhos, ícone + texto, alto contraste, foco visível
- ✅ Tema claro, modo offline (fila IndexedDB + service worker), desfazer de 5 s, tutorial de 4 telas
- ✅ Backup semanal automático, exportar CSV/Excel, abrir a planilha
- ✅ README para leigos, GUIA_DA_FAMILIA.md, GUIA_CAPTURA_SMS.md

## Decisões técnicas (escolhidas pela simplicidade para a família)

1. **HashRouter** (`#/painel`) em vez de rotas "limpas": funciona no GitHub Pages sem configuração de servidor e sobrevive ao "Adicionar à Tela de Início".
2. **POST como `text/plain`** para o Apps Script: evita o *preflight* CORS, que o Apps Script não responde.
3. **Sessão lembrada no celular** (token do usuário em `localStorage`); PIN só na primeira entrada, em ações sensíveis e a cada 30 dias.
4. **PIN com hash SHA-256 + sal** no servidor (Apps Script `Utilities.computeDigest`). Nunca em texto puro.
5. **Chave do Claude só em Script Properties** (`CHAVE_API_CLAUDE`). Sem chave, o sistema cai no OCR do Drive + regex automaticamente.
6. **Modelo do Claude**: `claude-sonnet-4-5` para leitura de cupons/faturas (visão + PDF, bom custo); configurável em Script Properties (`MODELO_CLAUDE`).
7. **Soft delete** em tudo (`excluido = S`), com "Desfazer" por 5 s no app e `desfazer_exclusao` na API.
8. **Competência** = mês da data do lançamento; crédito parcelado usa a data de fechamento do cartão para distribuir.
9. **Modo demonstração** embutido: abre sem back-end, com 12 meses gerados de forma determinística (mesmos números sempre). Útil para testar e para mostrar à família.
10. **Notificações push**: usam o padrão Web Push (VAPID) com chaves geradas no `instalar()`; no iPhone exigem iOS 16.4+ e app instalado na Tela de Início. Como alternativa sempre funciona o **e-mail diário de resumo** aos administradores.
11. **Versículos**: Almeida Revista e Corrigida (domínio público). Tudo da seção "Fé" pode ser desligado em Configurações.
12. **Imagens de capa/brasão** ficam no Drive em `Identidade da Família/` com link público de visualização (só a imagem); o SVG do brasão também é salvo.
13. **Hospedagem padrão: GitHub Pages** (workflow pronto). Para subdomínio próprio, basta apontar um CNAME.

## Simplificações conhecidas (registradas na integração)

- **Push nativo**: o Apps Script não assina Web Push (VAPID/ES256). O envio usa um serviço externo opcional (`URL_SERVICO_PUSH`); sem ele, os lembretes e avisos de vencimento vão por **e-mail** aos administradores.
- **Ícones 192/512 do brasão**: o Apps Script não rasteriza SVG; `salvar_brasao_svg` devolve o próprio SVG nas três URLs. Os PNGs do manifest são gerados no build (`npm run icones`) a partir de `app/public/brasao.svg` — para usar o brasão criado no app como ícone, baixe o SVG na tela Brasão, substitua esse arquivo e republique.
- **QR Code do convite** usa um serviço público de imagem (`api.qrserver.com`); sem internet a tela mostra o link para copiar.
- **Arquivo .macro do MacroDroid** é ilustrativo; a tela orienta a criar a macro à mão se a importação falhar.
- **Histórico de reuniões** fica no aparelho (não há ação `listar_reunioes` no contrato); a ata de cada mês é salva na planilha.
- **Caixa de Entrada** não tem "desfazer" ao lançar (o lançamento criado pode ser apagado na lista do grupo).
- **Modo demonstração** não filtra o resumo do mês por membro para o Júnior (a API real faz).
- **Paleta obrigatória** índigo × magenta tem pouca separação para daltonismo protan; mitigado com legendas sempre com nome + valor, rótulos diretos e as duas cores nunca vizinhas nos donuts.

## Como testar visualmente
```bash
cd app && npm install && npm run dev        # abre em modo demonstração
npm test                                     # testes unitários (formatação, extrator de SMS/voz)
npm run capturas                             # abre o app em 390×844 e salva prints em app/capturas/
```

## O que precisa do Luiz (⏸️)
1. Criar o projeto Apps Script, colar os arquivos de `/apps-script` (ou `clasp push`), rodar `instalar()` e autorizar.
2. Implantar como App da Web (Executar como: eu · Acesso: qualquer pessoa) e colar a URL em `VITE_API_URL`.
3. Colocar a chave da API do Claude em Script Properties (`CHAVE_API_CLAUDE`).
4. Criar os filtros do Gmail ("Contas da Casa" e "Alertas Cartão") — passo a passo no README.
5. Publicar o app (GitHub Pages: ativar Pages com fonte "GitHub Actions").

## Ideias para depois (não fazer agora)
- Open Finance (Pluggy/Belvo) para ler extratos e cartões direto dos bancos — caro para uso familiar hoje; reavaliar.
- Integração com o assistente do celular ("Ei Siri, lança 30 reais de padaria") via Atalhos + API.
- Relatório anual para o Imposto de Renda (saúde e educação dedutíveis, com comprovantes já no Drive).
- Comparativo de preços de mercado a partir dos itens dos cupons.
- Entrar com a conta Google para os adultos (hoje: convite + PIN).
