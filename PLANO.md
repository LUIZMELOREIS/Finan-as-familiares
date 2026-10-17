# PLANO.md — Finanças da Família

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
