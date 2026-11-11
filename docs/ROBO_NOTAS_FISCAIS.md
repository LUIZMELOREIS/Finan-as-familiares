# Robô de Notas Fiscais: Nota Paraná + Nota Curitibana

> **Objetivo:** toda compra feita com CPF na nota entra sozinha no app da família, com loja, valor, data e itens, sem ninguém digitar nada.
> E o comando de voz "Comprei no Condor" passa a buscar a nota de verdade e lançar.
>
> Especificação escrita em 11/11/2026, a partir de um teste real nos dois portais, com o Luiz logado.
> Encaixa no código atual (`apps-script/` + `app/`) e reaproveita a Caixa de Entrada, as RegrasLoja, o `compraJaExiste`, os gatilhos e o Assistente.

---

## 0. Prompt para colar no Claude Code

```
Leia docs/ROBO_NOTAS_FISCAIS.md e implemente o "Robô de Notas Fiscais" seguindo as fases
na ordem. Comece pela Fase 0 (prova de conceito do login pelo UrlFetchApp) e me mostre o
resultado antes de seguir. Regras: nunca registrar CPF, senha, cookies ou tokens em log,
planilha, Git ou mensagem; funções de parse puras e testadas em
apps-script/testes/executar.mjs com amostras anonimizadas; não quebrar nenhum teste atual;
atualizar PLANO.md, docs/API.md e README (Parte 8) ao final.
```

---

## 1. O que o teste real mostrou (11/11/2026)

### Nota Paraná (produtos, NFC-e, qualquer cidade do PR)

| Item | Achado |
|---|---|
| Login | Identidade Digital Sefa/PR (`authz-sefa.identidadedigital.pr.gov.br/cidadao_authz/authentication.jsp`), OAuth *authorization code* com PKCE gerado pelo próprio Nota Paraná. Formulário `POST api/v1/authorize` com campos ocultos (`step=2`, `response_type`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method`, `federacao`…) + `attribute` (CPF) + `password`. |
| Captcha | **Não há** (nenhum reCAPTCHA/hCaptcha na página). Existe opção de passkey (WebAuthn) e de gov.br, mas CPF + senha funciona. |
| Sessão | **Expira em cerca de 30 minutos.** O robô precisa logar a cada execução. |
| Lista do mês | Página `/nfprweb/Extrato` carrega por AJAX: `GET /nfprweb/NotasFiscaisAjax?periodo=01/MM/AAAA&situacao=1`. Colunas: CNPJ · Estabelecimento · Nota (link) · Data de emissão · Valor · Crédito · Situação. Checkbox "Exibir documentos rejeitados ou cancelados". |
| Detalhe da nota | `GET /nfprweb/NotaFiscalHtml?tpDoc={1\|2}&idDocFiscal={id}` devolve o DANFE completo: emitente, CNPJ, endereço, **itens (descrição, código, qtde, unidade, valor unitário e total)**, total, frete, valor a pagar, forma de pagamento, data/hora, **chave de acesso (44 dígitos)** e protocolo. `tpDoc=2` = NFC-e; `tpDoc=1` = NF-e. Atenção: o HTML vem em ISO-8859-1. |
| Exportar | Link "Salvar em CSV" (`#lnkExportarCSV`) na lista do mês. |
| Prazo | Uma compra das 20h22 já estava no portal no dia seguinte. |
| Resumo | Painel "Minhas Notas" com totais por mês (permite detectar meses fora do padrão). |

### Nota Curitibana (serviços, NFS-e, só em Curitiba)

| Item | Achado |
|---|---|
| Login | Site `notacuritibana.curitiba.pr.gov.br`, com login pelo **e-Cidadão** da Prefeitura (ou CPF + senha antigos do programa). **Mapear na Fase 0**, porque não foi inspecionado. |
| Lista | `/Nfse` com tabela DataTables por mês (Mês emissão · Quant. notas · Valor total · Total créditos) e lupa `data-action="detalhe"`. |
| Detalhe do mês | Tabela com Número · Cód. verificação / **Chave de Acesso (50 dígitos)** · Razão Social do prestador · Data de emissão · Situação · Valor da nota · Valor do crédito · Validade. Não traz itens; para serviço, isso basta. |
| Prazo | Mais lento: em 11/11, outubro já estava lá, mas novembro ainda não. |

### Cuidado encontrado nos dados reais
- **Compras da empresa no CPF:** há mês com valor total muito acima do padrão da casa, o que indica notas da First no CPF do Luiz. Sem regra de separação, o painel da família fica distorcido (ver seção 6).
- **A mesma compra vai chegar por dois caminhos:** o SMS/e-mail do cartão (Caixa de Entrada) e depois a nota fiscal. A nota deve **enriquecer** o lançamento existente, e não duplicar (ver seção 5).

---

## 2. Arquitetura

```
 Gatilho (a cada 6 h + 21h)          Comando de voz / Assistente
            │                                   │
            ▼                                   ▼
   sincronizarNotasFiscais()  ◄──────  acao 'sincronizar_notas' (sob demanda)
            │
   ┌────────┴─────────┐
   ▼                  ▼
 notaParana.gs     notaCuritibana.gs      (login → lista → detalhe; só leitura)
   │                  │
   └──────┬───────────┘
          ▼
   aba NotasFiscais (uma linha por nota, chave de acesso = chave única)
          │
          ▼
   conciliar com Lancamentos / CaixaEntrada  ──►  enriquecer OU criar item "pendente" na Caixa
          │
          ▼
   regra Família × Empresa  ──►  notificar (Telegram / e-mail) com resumo
```

### Plano A: tudo no Apps Script (preferido)
`UrlFetchApp` com `followRedirects: false`, guardando os cookies à mão (`Set-Cookie` → cabeçalho `Cookie`) em cada salto do OAuth. Fica tudo num lugar só, sem servidor novo.

### Plano B: se o portal bloquear o IP do Google
Workflow agendado no **GitHub Actions** com Playwright (o repositório já usa Actions), com as credenciais em *Actions secrets*. Ele faz login com navegador de verdade, extrai as notas e envia por `POST` ao Apps Script (`?webhook=notas`, com `token_familia` + token do usuário, como o webhook de SMS).
**Atenção: o repositório é público.** Nada de `console.log` com dados, `::add-mask::` em tudo o que for sensível, e não subir artefatos.

**A Fase 0 decide entre A e B.**

---

## 3. Credenciais: regra de ouro

- Ficam **só nas Propriedades do script**, nunca na planilha, no Git, no app ou em log:
  - `NOTAPR_<usuario_id>` = `{"cpf":"...","senha":"..."}`
  - `NOTACWB_<usuario_id>` = `{"usuario":"...","senha":"..."}`
- **Uma credencial por membro adulto:** cada CPF puxa as próprias notas, e o lançamento sai com o `usuario_id` certo (Luiz, Nina…).
- Tela **Configurações → Notas fiscais** (só Administrador): campo "conectar Nota Paraná / Nota Curitibana" que **grava e nunca devolve** a senha (ação `salvar_credencial_fiscal`, somente escrita). Mostra só "Conectado em 11/11 · última leitura 21:00 · 3 notas novas".
- Botão **Testar conexão**: faz login e lê só o resumo do mês.
- Botão **Desconectar**: apaga a propriedade.
- Se o login falhar 2 vezes seguidas (senha trocada), o robô suspende aquele CPF e avisa o administrador. Não fica tentando, para não bloquear a conta.

---

## 4. Dados

### Nova aba `NotasFiscais` (incluir no esquema de `bd.gs` e no `instalar()`/`migrar…`)

| coluna | conteúdo |
|---|---|
| `id` | `nf_…` |
| `fonte` | `nota_parana` · `nota_curitibana` |
| `chave_acesso` | 44 dígitos (NFC-e/NF-e) ou 50 (NFS-e). **Chave única.** |
| `id_portal` | `idDocFiscal` / número da NFS-e |
| `tp_doc` | 1 (NF-e) · 2 (NFC-e) · `nfse` |
| `usuario_id` | dono do CPF |
| `cnpj`, `emitente` | prestador/estabelecimento |
| `data_emissao` | aaaa-mm-dd hh:mm |
| `valor`, `frete`, `desconto` | números |
| `forma_pgto` | quando o DANFE informar |
| `itens` | JSON curto: `[{d:"TAT - HOT FILA 8UND", q:2, un:"Un", vu:24, vt:48}]` |
| `situacao` | normal · cancelada · rejeitada |
| `destino` | `familia` · `empresa` · `ignorar` · `a_confirmar` |
| `lancamento_id` | lançamento criado ou enriquecido |
| `caixa_id` | item da Caixa de Entrada, se foi para lá |
| `lida_em`, `atualizada_em` | datas de controle |

### Ajustes nas abas existentes
- `Lancamentos.origem`: novos valores `nota_parana` e `nota_curitibana` (atualizar `OrigemLancamento` em `app/src/tipos/index.ts`).
- `CaixaEntrada.canal`: novos canais `nota_parana` e `nota_curitibana` (atualizar `CANAIS_VALIDOS`).
- `RegrasLoja`: nova coluna `destino` (`familia`/`empresa`/`ignorar`) e coluna `cnpj`. A regra por CNPJ vale mais que a regra por nome.

---

## 5. Conciliação (não duplicar nada)

Para cada nota nova, na ordem:
1. **Já existe pela chave?** (`NotasFiscais.chave_acesso`, ou lançamento lido pelo QR da NFC-e com a mesma chave): só atualiza a situação. Se a nota foi **cancelada**, marca o lançamento `a_confirmar` e avisa.
2. **Já existe pelo jeito antigo?** Reusar `compraJaExiste(...)`: mesmo valor (±0,01), data ±2 dias e mesma primeira palavra do estabelecimento **ou** mesmo CNPJ. Se achou em `Lancamentos`: **enriquecer** com estabelecimento oficial, CNPJ, itens no `anexo_url` ou descrição e `chave_acesso`, sem mexer em valor, categoria ou forma de pagamento já confirmados. Se achou na `CaixaEntrada` pendente: anexar a nota ao item, para a pessoa confirmar uma vez só.
3. **Não existe:** criar item na **Caixa de Entrada** com status `pendente` e categoria sugerida (`aplicarRegraLoja` + `sugerirCategoria`; com a chave do Claude, sugerir a partir dos **itens**).
4. **Lançar direto, sem passar pela Caixa**, só quando: a loja/CNPJ tem RegrasLoja com `acertos ≥ 3`, o destino é `familia` e o valor ≤ limite configurável (padrão R$ 500). Vai como `confirmado`, `origem = nota_parana`, com "Desfazer" no aviso.

---

## 6. Regra Família × Empresa (First)

A nota vai para `destino = a_confirmar`, e nunca direto para o painel da casa, quando:
- o CNPJ ou a loja está marcado como `empresa` nas RegrasLoja;
- o valor é maior que o limite "compra grande" (padrão **R$ 1.500**, configurável);
- é **NF-e (`tpDoc=1`)** com valor alto (costuma ser compra de empresa);
- o total do mês daquele CPF passa de 3× a média dos 6 meses anteriores (alerta único: "Mês com notas fora do padrão, parece haver compras da empresa").

Na Caixa de Entrada, o item mostra três botões: **Família** · **Empresa** · **Ignorar**. A escolha aprende para o CNPJ: depois de 2 escolhas iguais, vira regra.
Notas `empresa` ficam guardadas em `NotasFiscais` (útil para a First depois), mas **não viram lançamento da família**.

---

## 7. Agendamento

- `sincronizarNotasFiscais()` com gatilho **a cada 6 horas** e uma passada fixa às **21h**, antes do vigia diário das 20h do dia seguinte. Incluir em `instalarGatilhos()` e no liga/desliga de Configurações → Rotinas.
- Janela: **mês atual + mês anterior** no Nota Paraná (pega cancelamentos e notas atrasadas) e **últimos 2 meses** no Nota Curitibana.
- Respeitar o limite de 6 minutos do Apps Script: buscar os detalhes só das notas **novas**, no máximo 40 por execução, e guardar um cursor em `Config` (`notas_cursor_<fonte>_<uid>`).
- Intervalo de 1 a 2 s entre requisições. Nada de varrer anos para trás. A importação do histórico é uma ação manual separada (`importar_historico_notas`, até 12 meses, em lotes).
- Fim da passada: resumo pelo Telegram/e-mail (`notificacoes.gs`): *"3 notas novas · R$ 2.531,48 · 1 para confirmar (Filtros Curitiba, R$ 2.104,69: Família ou Empresa?)"*.

---

## 8. Voz e Assistente: "Comprei no Condor"

Nova ferramenta no `assistente.gs` (e regra local equivalente para quem não tem a chave do Claude):

```js
{ name: 'buscar_nota_fiscal',
  description: 'Procura no Nota Paraná/Nota Curitibana do usuário uma compra recente pela loja (e opcionalmente data/valor) e lança ou enriquece o lançamento. Use quando a pessoa disser que comprou em algum lugar e pediu CPF na nota.',
  input_schema: { loja: string, data?: 'aaaa-mm-dd', valor?: number } }
```

Fluxo:
1. Olha primeiro a aba `NotasFiscais` (rápido). Se não achar, chama `sincronizar_notas` só para aquele usuário e o mês atual.
2. A comparação de nome é aproximada: "Condor" casa com "CONDOR SUPER CENTER LTDA". Também procura pelo CNPJ nas RegrasLoja.
3. **Achou 1:** lança (ou enriquece) e responde: *"Condor, hoje 18:42, R$ 287,40, 23 itens. Lancei em Mercado. Era da família toda?"*
4. **Achou várias:** lista para escolher.
5. **Não achou:** *"A nota ainda não apareceu no Nota Paraná. Vou procurar de novo às 21h e te aviso. Se quiser, me diga o valor que eu lanço agora e junto com a nota depois."* Isso cria uma "espera" na `CaixaEntrada` (status `aguardando_nota`), que a próxima sincronização resolve.

No app (`Lancar.tsx`), o fluxo de voz que já existe só precisa reconhecer a intenção "comprei/gastei no X" **sem valor** e chamar `buscar_nota_fiscal`, em vez de pedir o valor.

---

## 9. Novas ações da API (`api.gs` + `docs/API.md`)

| ação | perfil | o que faz |
|---|---|---|
| `status_notas_fiscais` | Adulto | conexões, última leitura, contagens, erros |
| `salvar_credencial_fiscal` | Admin | grava a credencial (somente escrita) para um usuário/fonte |
| `remover_credencial_fiscal` | Admin | apaga a credencial |
| `testar_credencial_fiscal` | Admin | login + leitura do resumo do mês |
| `sincronizar_notas` | Adulto | roda a sincronização agora (do próprio usuário; o Admin pode rodar para todos) |
| `buscar_nota_fiscal` | Adulto | busca por loja/data/valor (usada pelo Assistente e pela voz) |
| `definir_destino_nota` | Adulto | família/empresa/ignorar + aprendizado |
| `importar_historico_notas` | Admin | importação em lotes, até 12 meses |
| `?webhook=notas` | token | **só no Plano B**: recebe as notas do GitHub Actions |

Dependente não vê notas de outros membros, como já acontece na Caixa de Entrada.

---

## 10. Fases de entrega

| Fase | Entrega | Aceite |
|---|---|---|
| **0. Prova de conceito** | Função `testeLoginNotaParana()` que faz o OAuth pelo `UrlFetchApp` e imprime **só** "login ok · N notas em NOV/2026". Mesma prova para o Nota Curitibana/e-Cidadão. | Funciona → Plano A. Bloqueado (403, desafio, timeout) → Plano B, com a mesma prova no GitHub Actions. |
| **1. Leitura** | `notaParana.gs` / `notaCuritibana.gs`: login, lista do mês, detalhe. Parsers puros `extrairListaNotasPr(html)`, `extrairDanfePr(html)`, `extrairNotasCwb(json/html)` com testes e amostras **anonimizadas** em `apps-script/testes/amostras/`. | Os testes passam; a passada real grava a aba `NotasFiscais` sem duplicar ao rodar 2 vezes. |
| **2. Conciliação e Caixa** | Seções 5 e 6, canais novos na Caixa, botões Família/Empresa/Ignorar, aprendizado por CNPJ. | Uma compra que já veio por SMS **não** duplica; a nota alta cai em "a confirmar". |
| **3. Automação** | Gatilhos, cursor, limite por execução, resumo no Telegram/e-mail, suspensão após 2 falhas de login. | 3 dias seguidos rodando sozinho sem erro. |
| **4. Voz e Assistente** | `buscar_nota_fiscal`, espera `aguardando_nota`, ajuste no `Lancar.tsx`. | Falar "Comprei no Condor" lança a compra real. |
| **5. Tela de configurações** | Configurações → Notas fiscais (conectar por membro, testar, desconectar, status, limites). Modo demonstração com notas fictícias no `mock.ts`. | O Luiz conecta o próprio CPF pelo celular, sem abrir o Apps Script. |
| **6. Documentação** | README Parte 8, `GUIA_DA_FAMILIA.md` ("peça CPF na nota"), `PLANO.md`, `docs/API.md`. | — |

---

## 11. Riscos e como tratar

| Risco | Tratamento |
|---|---|
| O portal muda o HTML | Parsers isolados e testados; se a leitura vier vazia em mais de 50% das notas, suspende e avisa "o Nota Paraná mudou, o robô precisa de ajuste". |
| O IP do Google é bloqueado | Plano B (GitHub Actions + Playwright). |
| Captcha ou 2º fator no futuro | Detectar a página de desafio, suspender e avisar. O QR Code da NFC-e (já existe) continua funcionando. |
| Senha trocada ou conta bloqueada | Máximo de 2 tentativas, depois suspende e avisa. |
| Atraso das notas | Janela de 2 meses + espera `aguardando_nota`. |
| Nota sem CPF ou fora do PR | Continua valendo o QR Code / foto do cupom (Fase 3 atual). Outros estados ficam para depois (Nota Fiscal Paulista etc.), com o mesmo desenho, um módulo por portal. |
| LGPD / termos de uso | Só leitura dos dados do próprio titular, com a credencial dele, em baixa frequência. Nada é compartilhado fora da planilha da família. |

---

## 12. Fora do escopo (ideias para depois)
- Dividir uma nota de mercado em várias categorias pelos itens (limpeza × alimentação).
- Histórico de preço por item ("o café subiu 18% em 3 meses").
- Resgatar créditos do Nota Paraná e do Nota Curitibana como receita no app.
- Outros estados (Nota Fiscal Paulista, Nota Legal DF…) com o mesmo desenho.
