# Contrato da API — Finanças da Família

A API é um **Google Apps Script publicado como App da Web**. O app (PWA) conversa com ela
por `fetch`. Este documento é o contrato: o front-end (`/app`) e o back-end (`/apps-script`)
seguem exatamente o que está aqui. Os tipos dos objetos estão em `app/src/tipos/index.ts`.

## Transporte

- **URL**: a URL de implantação do App da Web (`https://script.google.com/macros/s/.../exec`).
- **Sempre POST** com `Content-Type: text/plain;charset=utf-8` e corpo JSON (texto simples evita o
  *preflight* CORS, que o Apps Script não responde). O Apps Script redireciona o POST (302) —
  o `fetch` segue o redirecionamento sozinho (`redirect: 'follow'`).
- **GET** só para `ping` e para o **webhook** de SMS (ver abaixo), que também aceita POST.
- Resposta: sempre JSON no envelope `{ ok: boolean, dados?: any, erro?: string, versao?: string }`.

### Corpo padrão de toda chamada

```json
{
  "acao": "nome_da_acao",
  "token_familia": "xxxxxxxx",       // obrigatório (aba Config)
  "token": "token_do_usuario",       // obrigatório, exceto em entrar_convite / ping
  "usuario_id": "u_xxx",             // quem está fazendo a chamada
  "...": "parâmetros da ação"
}
```

O servidor valida `token_familia`, depois carrega o usuário pelo `token` e **aplica o perfil**:
- `Dependente` (chamado `Júnior` na versão 1) nunca recebe lançamentos/categorias marcadas como `sensivel` (salários) nem a aba `Usuarios`
  com tokens; só vê os próprios lançamentos, a mesada e os Projetos.
- `Adulto` vê tudo, mas não altera Config, Usuarios, Cartoes de outros.
- `Administrador` tudo.

Datas trafegam em **ISO** (`aaaa-mm-dd`); valores em **número** (reais, com centavos em ponto).
Competência é `AAAA-MM`.

## Ações

| acao | perfil mínimo | parâmetros | devolve |
|---|---|---|---|
| `ping` | — | — | `{ versao, nome_familia }` |
| `entrar_convite` | — | `codigo_convite`, `nome`, `apelido`, `avatar`, `cor`, `pin` (o perfil vem do convite) | `Usuario` com `token` (cria ou ativa o usuário) |
| `entrar_pin` | — | `usuario_id`, `pin` | `Usuario` com `token` |
| `bootstrap` | Júnior | — | `Bootstrap` |
| `resumo_mes` | Júnior | `competencia` | `ResumoMes` |
| `listar_lancamentos` | Dependente | `competencia?`, `categoria_id?`, `grupo_id?`, `tipo_id?`, `grupo_analise?`, `usuario_id_filtro?`, `status?` | `Lancamento[]` |
| `salvar_lancamento` | Júnior | `lancamento: Lancamento` (sem id = novo; `parcelas?: number` distribui) | `Lancamento[]` criados/atualizados |
| `excluir_lancamento` | Júnior (só os próprios) | `id` | `{ id }` (soft delete) |
| `desfazer_exclusao` | Júnior | `id` | `Lancamento` |
| `painel` | Adulto | `ano`, `usuario_id_filtro?` | `DadosPainel` |
| `listar_categorias` | Júnior | — | `Categoria[]` |
| `salvar_categoria` | Administrador | `categoria` | `Categoria` |
| `salvar_grupo` | Administrador | `grupo` | `Grupo` |
| `listar_orcamento` | Adulto | `competencia` | `Orcamento[]` |
| `salvar_orcamento` | Administrador | `competencia`, `itens: Orcamento[]` | `Orcamento[]` |
| `copiar_orcamento` | Administrador | `de`, `para` | `Orcamento[]` |
| `ler_imagem` | Júnior | `imagem_base64`, `mime`, `tipo: 'cupom'\|'conta'\|'fatura_cartao'`, `nome_arquivo?`, `texto_extraido?` (texto que o app já tirou do PDF no aparelho; sem chave do Claude dispensa o OCR do Drive) | `LeituraExtraida` (salva o arquivo no Drive e devolve `anexo_url`) |
| `ler_texto` | Júnior | `texto`, `tipo: 'voz'\|'sms'` | `LeituraExtraida` |
| `consultar_nfce` | Júnior | `url_qr` | `LeituraExtraida` |
| `listar_contas_fixas` | Adulto | — | `ContaFixa[]` |
| `salvar_conta_fixa` | Administrador | `conta_fixa` | `ContaFixa` |
| `listar_contas_a_pagar` | Adulto | `competencia?`, `status?` | `ContaAPagar[]` |
| `salvar_conta_a_pagar` | Adulto | `conta` | `ContaAPagar` |
| `marcar_conta_paga` | Adulto | `id`, `forma_pgto` | `ContaAPagar` + cria `Lancamento` |
| `consumo_historico` | Adulto | `conta_fixa_id` | `Array<{competencia, consumo_valor, consumo_unidade, valor}>` |
| `listar_cartoes` | Adulto | — | `Cartao[]` |
| `salvar_cartao` | Administrador | `cartao` | `Cartao` |
| `listar_caixa_entrada` | Júnior (só os próprios) | `status?` | `ItemCaixaEntrada[]` |
| `resolver_caixa_entrada` | Júnior | `id`, `acao_caixa: 'lancar'\|'ignorar'`, `categoria_id?`, `descricao?`, `valor?` (obrigatório para um item `aguardando_nota`), `destino?: 'familia'\|'empresa'\|'ignorar'` (item vindo de nota fiscal: delega a `definir_destino_nota`) | `ItemCaixaEntrada` (+ `Lancamento`) |
| `importar_fatura` | Adulto | `imagem_base64` ou `texto` (OFX/CSV), `cartao_id` | `LeituraExtraida` com `compras[]` e `ja_lancada` |
| `confirmar_importacao` | Adulto | `cartao_id`, `compras[]` | `ItemCaixaEntrada[]` criados |
| `listar_projetos` | Júnior | — | `Projeto[]` (com `valor_atual`) |
| `salvar_projeto` | Júnior (só o próprio sonho) / Adulto | `projeto` | `Projeto` |
| `aportar` | Júnior | `projeto_id`, `valor`, `observacao?` | `Aporte` |
| `listar_aportes` | Júnior | `projeto_id` | `Aporte[]` |
| `listar_decisoes` | Júnior | `status?` | `Decisao[]` (com `votos`) |
| `salvar_decisao` | Júnior | `decisao` | `Decisao` |
| `votar` | Júnior | `decisao_id`, `voto`, `comentario?` | `Decisao` |
| `encerrar_decisao` | Administrador | `decisao_id` | `Decisao` (aplica regra de votação) |
| `pauta_reuniao` | Adulto | `competencia` | `Reuniao` (gera pauta em markdown) |
| `listar_reunioes` | Adulto | — | `Reuniao[]` (atas salvas) |
| `salvar_reuniao` | Adulto | `reuniao` | `Reuniao` |
| `listar_usuarios` | Adulto | — | `Usuario[]` (tokens só para Administrador) |
| `salvar_usuario` | Administrador | `usuario` | `Usuario` |
| `gerar_convite` | Administrador | `perfil` | `{ codigo_convite, url, expira_em }` |
| `renovar_token` | Júnior (o próprio) / Administrador | `usuario_id` | `{ token }` |
| `redefinir_pin` | Administrador | `usuario_id`, `pin` | `{ ok }` |
| `salvar_config` | Administrador | `config: Partial<Config>` | `Config` |
| `enviar_arquivo` | Adulto | `imagem_base64`, `mime`, `pasta: 'Identidade da Família'\|'Projetos e Sonhos'`, `nome_arquivo` | `{ url, id }` |
| `salvar_brasao_svg` | Administrador | `svg` | `{ url_brasao, url_icone_192, url_icone_512 }` |
| `versiculo_do_dia` | Júnior | `tema?` | `Versiculo` |
| `mesada` | Júnior | `usuario_id?`, `competencia` | `{ mesada_mensal, gasto, saldo, cofrinho }` |
| `exportar` | Administrador | `formato: 'csv'\|'xlsx'`, `competencia?` | `{ url }` |
| `backup_agora` | Administrador | — | `{ url }` |
| `registrar_push` | Júnior | `assinatura` (PushSubscription JSON) | `{ ok }` |
| `log` | Administrador | `limite?` | `RegistroLog[]` |

## Webhook de captura (SMS / notificação do banco)

```
POST <URL>?webhook=1
{ "token_familia": "...", "token": "token_do_usuario", "canal": "sms_ios"|"sms_android"|"email", "texto": "<conteúdo do SMS>" }
```
Também aceita **GET** `?webhook=1&token_familia=...&token=...&canal=sms_ios&texto=...` (para o app Atalhos do iPhone
nos casos em que o POST falha). Devolve `{ ok, dados: { status: 'pendente'|'duplicado'|'ignorado', item } }`.

O servidor: identifica o membro pelo **token** (e confirma pelo `final_cartao` contra a aba `Cartoes`),
descarta mensagens que não são de compra (códigos de verificação, propaganda), **nunca guarda OTP**,
calcula `hash_dedup` e grava em `CaixaEntrada`.

## Erros

`{ ok: false, erro: "mensagem em português para mostrar ao usuário" }`. Códigos usuais nas mensagens:
`"Sessão expirada"` (token inválido → o app pede PIN), `"Sem permissão"` (perfil), `"Família não encontrada"`.

## Modo demonstração

Quando `VITE_API_URL` não está definido (ou o usuário escolhe "Experimentar com dados de exemplo"),
o app usa `src/api/mock.ts`, que implementa as mesmas ações em cima de dados locais (IndexedDB),
com 12 meses de exemplo. Serve para testes visuais, para a Fase 2 e para quem quer conhecer o app
antes de instalar o Apps Script.

---

## Versão 2 — acréscimos

Mudanças da versão 2 (referência visual `referencia_visual.html`):

- Perfil **`Júnior` passou a se chamar `Dependente`** (mesmas regras).
- Nova aba **`Tipos`** (Receitas / Despesas fixas / Despesas variáveis / Projetos). `Grupos` ganhou `tipo_id`, `cor` (nome da paleta) e `grupo_analise`; `Categorias` ganhou `tipo_id`, `grupo_analise`, `oculta_cardapio` e usa **nome de ícone Lucide** em `icone`.
- `bootstrap` devolve também `tipos` e `regras_loja`. `resumo_mes` devolve `por_tipo` e `projetos`. `painel` devolve `por_tipo` e `por_grupo_analise` por mês e marca meses futuros como `previsto`.
- Config ganhou `dependente_ve_salarios` (antes `junior_ve_salarios`), `rotina_vigia`, `rotina_quinzenal`, `rotina_fechamento`, `telegram_ativo`.
- Novas abas: `RegrasLoja`, `Alertas`, `Patrimonio`, `Avisos`, `Conversas` (histórico do assistente), `Telegram` (chat_id ↔ usuário).

| acao | perfil mínimo | parâmetros | devolve |
|---|---|---|---|
| `listar_regras_loja` | Dependente | — | `RegraLoja[]` |
| `salvar_regra_loja` | Dependente | `loja`, `categoria_id` (chamado automaticamente quando o usuário corrige a categoria sugerida) | `RegraLoja` |
| `proximas_saidas` | Adulto | `dias: 30\|60\|90` | `SaidaPrevista[]` (contas fixas, parcelas, assinaturas, faturas de cartão) |
| `listar_avisos` | Adulto | `limite?` | `Aviso[]` (vigia diário, quinzenal, fechamento, alertas personalizados) |
| `marcar_aviso_lido` | Adulto | `id` | `Aviso` |
| `listar_alertas` | Adulto | — | `Alerta[]` (com `status_atual` e `percentual_atual` calculados) |
| `salvar_alerta` | Adulto | `alerta` | `Alerta` |
| `excluir_alerta` | Adulto | `id` | `{ id }` |
| `assistente` | Dependente | `mensagem`, `historico?: MensagemAssistente[]`, `imagem_base64?`, `mime?` | `MensagemAssistente` (resposta; se a mensagem for um lançamento, devolve `lancamento` já gravado e `etiqueta: 'lançado'`) |
| `assistente_sugestoes` | Dependente | — | `string[]` (chips de perguntas sugeridas para o momento) |
| `listar_conversa` | Dependente | `limite?` | `MensagemAssistente[]` (histórico do usuário) |
| `listar_patrimonio` | Adulto | — | `Patrimonio[]` |
| `salvar_patrimonio` | Administrador | `patrimonio` | `Patrimonio` |
| `registrar_saldo_patrimonio` | Adulto | `id`, `competencia`, `valor` | `Patrimonio` |
| `relatorio_mensal` | Adulto | `competencia` | `{ markdown, projecao: Array<{competencia, receitas, despesas, saldo}> }` |
| `perfis_familia` | — (só token da família) | `{}` | `{ nome_familia, url_foto_capa, perfis: [{ id, apelido, nome, cor, avatar, perfil }] }` — para entrar em outro aparelho com PIN, sem convite |
| `vincular_telegram` | Dependente | — | `{ codigo, url_bot }` (código de 6 dígitos para enviar ao bot) |

### Assistente — como funciona no servidor

1. O Apps Script monta um **resumo agregado** (totais por categoria/grupo/mês dos últimos 12 meses, médias de 3 meses, contas a vencer, projetos com ritmo, assinaturas detectadas). Nada de dados pessoais além do apelido dos membros.
2. Envia ao Claude (Messages API) com **tool use**: `buscar_lancamentos(filtros)`, `total_por_categoria(competencia, categoria_id|grupo_id)`, `projetar_meta(projeto_id, corte_mensal?)`, `lancar_despesa(valor, categoria_id, descricao, forma_pgto, data)`, `proximas_saidas(dias)`, `buscar_nota_fiscal(loja, data?, valor?)`. O servidor executa cada ferramenta na planilha e devolve o resultado ao modelo até a resposta final.
3. Resposta em português, curta, com números em `R$ 1.234,56`; quando houver comparação, devolve `barras[]` para a mini-barra.
4. Sem chave do Claude: o assistente responde às perguntas mais comuns por **regras locais** (gasto por categoria, assinaturas, contas da semana, fechamento do mês, lançar por texto via `extrairDeTexto`) e avisa que a conversa livre precisa da chave.

### Robô de Notas Fiscais (Nota Paraná + Nota Curitibana)

Especificação em [`ROBO_NOTAS_FISCAIS.md`](ROBO_NOTAS_FISCAIS.md). Toda compra com o CPF de um membro na nota entra sozinha: o robô lê o portal a cada 6 h e às 21h, grava na aba **`NotasFiscais`** (`id, fonte, chave_acesso, id_portal, tp_doc, usuario_id, cnpj, emitente, data_emissao, valor, frete, desconto, forma_pgto, itens (JSON), situacao, destino, lancamento_id, caixa_id, lida_em, atualizada_em`) e concilia: enriquece um lançamento já existente (valor ±0,01, data ±2 dias, mesma loja), anexa a um item da Caixa de Entrada (inclusive os `aguardando_nota` criados por voz), lança direto (loja com 3 acertos em `RegrasLoja` e valor até `notas_limite_direto`) ou cria um item na Caixa — com a pergunta **"Família ou Empresa?"** quando a loja é nova, o valor passa de `notas_limite_grande`, é NF-e acima do limite direto ou o mês está 3× acima da média. `RegrasLoja` ganhou `destino` e `cnpj` (o robô aprende por CNPJ). `Config` ganhou `rotina_notas`, `notas_limite_direto` (500) e `notas_limite_grande` (1500). `CaixaEntrada.canal` aceita `nota_parana` e `nota_curitibana`, `status` aceita `aguardando_nota`, e o item devolve `nota: NotaFiscalResumo` (nunca a chave inteira — só `chave_final`, 8 dígitos). `Lancamento.origem` aceita `nota_parana` e `nota_curitibana`.

**Credenciais** (CPF + senha do portal) ficam **só** nas Propriedades do script (`NOTAPR_<usuario_id>`, `NOTACWB_<usuario_id>`), nunca na planilha nem em resposta da API; os parâmetros `cpf`, `senha`, `usuario`, `credencial` e `notas` não vão para o log.

| acao | perfil mínimo | parâmetros | devolve |
|---|---|---|---|
| `status_notas_fiscais` | Adulto | — | `{ conexoes: ConexaoNotas[], contagens: { total, mes, valor_mes, a_confirmar, empresa }, limites: { direto, grande }, rotina_ativa }` — uma conexão por adulto × fonte (`conectado`, `ultima_leitura`, `ultimo_ok`, `suspenso`, `motivo`, `total_notas`, `restantes`) |
| `listar_notas_fiscais` | Adulto | `competencia?`, `usuario_id_filtro?`, `destino?`, `limite?` | `NotaFiscalResumo[]` |
| `salvar_credencial_fiscal` | Administrador | `fonte: 'nota_parana'\|'nota_curitibana'`, `usuario_id_alvo` (membro adulto), `credencial: { cpf, senha }` ou `{ usuario, senha }` | `{ ok, fonte, usuario_id, conectado_em }` (a senha não volta) |
| `remover_credencial_fiscal` | Administrador | `fonte`, `usuario_id_alvo` | `{ ok, fonte, usuario_id }` |
| `testar_credencial_fiscal` | Administrador | `fonte`, `usuario_id_alvo` | `{ ok, motivo, quantidade?, competencia?, texto?, etapa?, dica?, caminho? }` — `motivo`: `ok`, `senha_invalida`, `bloqueado` (Plano B), `conexao_recusada`, `desafio` (captcha), `formulario_login` |
| `sincronizar_notas` | Adulto | `todos?` (só Admin: todos os membros), `fonte?`, `notificar?` | `Array<{ fonte, usuario_id, ok, motivo, novas, lancadas, caixa, a_confirmar, enriquecidas, canceladas, restantes, resumo }>` |
| `buscar_nota_fiscal` | Adulto | `loja`, `data?`, `valor?`, `sincronizar?` (padrão `true`: lê o portal se não achar) | `{ status: 'lancado'\|'varias'\|'aguardando', texto, lancamento?, nota?, notas?, item? }` — "comprei no Condor": lança com o valor real da nota ou deixa um item `aguardando_nota` na Caixa |
| `definir_destino_nota` | Adulto | `nota_id` ou `caixa_id`, `destino: 'familia'\|'empresa'\|'ignorar'`, `categoria_id?`, `descricao?` | `{ nota: NotaFiscalResumo, item?: ItemCaixaEntrada }` — `familia` lança (ou mantém) o lançamento; `empresa`/`ignorar` tiram do painel da casa; sempre aprende para o CNPJ |
| `importar_historico_notas` | Administrador | `usuario_id_alvo`, `fonte?`, `meses_atras` (1–12; um mês por chamada), `max_detalhes?` | `{ competencia, ok, motivo, novas, restantes, proximo_meses_atras, concluido, resumo }` |

**Assistente:** ganhou a ferramenta `buscar_nota_fiscal(loja, data?, valor?)`; sem a chave do Claude, "comprei no Condor" (sem valor) também dispara a busca pelas regras locais. **Voz** (Lançar › Falar): frase de compra sem valor chama `buscar_nota_fiscal` antes de montar o rascunho.

### Webhook de notas (coletor externo — Plano B)

```
POST <URL>?webhook=notas   { token_familia, token, notas: [{ fonte?, id_portal|chave_acesso, tp_doc?, cnpj, emitente, data_emissao, valor, situacao?, forma_pgto?, frete?, desconto?, itens?: [{ d, c?, q, un?, vu, vt }] }] }
```
Para quando o portal recusa o IP do Google: um coletor rodando no Brasil lê as notas e as entrega aqui; o servidor concilia do mesmo jeito que a rotina. Devolve `{ recebidas, processadas, resumo }`. Exige token da família + token de um adulto; até 100 notas por chamada.

### Webhook do Telegram

```
POST <URL>?telegram=1   (corpo: update do Bot API)
```
`/start CODIGO` vincula o chat ao usuário (código de `vincular_telegram`). Texto → `assistente`; foto → `ler_imagem` tipo cupom → confirmação por botões inline. Avisos das rotinas são enviados ao chat vinculado quando `telegram_ativo`. Token do bot em Script Properties `TOKEN_TELEGRAM`; o `setWebhook` é feito por `configurarTelegram()` em `telegram.gs`.
