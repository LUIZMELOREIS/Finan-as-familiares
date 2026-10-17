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
- `Júnior` nunca recebe lançamentos/categorias marcadas como `sensivel` (salários) nem a aba `Usuarios`
  com tokens; só vê os próprios lançamentos, a mesada e os Projetos.
- `Adulto` vê tudo, mas não altera Config, Usuarios, Cartoes de outros.
- `Administrador` tudo.

Datas trafegam em **ISO** (`aaaa-mm-dd`); valores em **número** (reais, com centavos em ponto).
Competência é `AAAA-MM`.

## Ações

| acao | perfil mínimo | parâmetros | devolve |
|---|---|---|---|
| `ping` | — | — | `{ versao, nome_familia }` |
| `entrar_convite` | — | `codigo_convite`, `apelido`, `avatar`, `cor`, `pin` | `Usuario` com `token` (cria ou ativa o usuário) |
| `entrar_pin` | — | `usuario_id`, `pin` | `Usuario` com `token` |
| `bootstrap` | Júnior | — | `Bootstrap` |
| `resumo_mes` | Júnior | `competencia` | `ResumoMes` |
| `listar_lancamentos` | Júnior | `competencia?`, `categoria_id?`, `grupo_id?`, `usuario_id_filtro?`, `status?` | `Lancamento[]` |
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
| `ler_imagem` | Júnior | `imagem_base64`, `mime`, `tipo: 'cupom'\|'conta'\|'fatura_cartao'`, `nome_arquivo?` | `LeituraExtraida` (salva o arquivo no Drive e devolve `anexo_url`) |
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
| `resolver_caixa_entrada` | Júnior | `id`, `acao_caixa: 'lancar'\|'ignorar'`, `categoria_id?`, `descricao?` | `ItemCaixaEntrada` (+ `Lancamento`) |
| `importar_fatura` | Adulto | `imagem_base64` ou `texto` (OFX/CSV), `cartao_id` | `LeituraExtraida` com `compras[]` e `ja_lancada` |
| `confirmar_importacao` | Adulto | `cartao_id`, `compras[]` | `ItemCaixaEntrada[]` criados |
| `listar_projetos` | Júnior | — | `Projeto[]` (com `valor_atual`) |
| `salvar_projeto` | Adulto | `projeto` | `Projeto` |
| `aportar` | Júnior | `projeto_id`, `valor`, `observacao?` | `Aporte` |
| `listar_aportes` | Júnior | `projeto_id` | `Aporte[]` |
| `listar_decisoes` | Júnior | `status?` | `Decisao[]` (com `votos`) |
| `salvar_decisao` | Júnior | `decisao` | `Decisao` |
| `votar` | Júnior | `decisao_id`, `voto`, `comentario?` | `Decisao` |
| `encerrar_decisao` | Administrador | `decisao_id` | `Decisao` (aplica regra de votação) |
| `pauta_reuniao` | Adulto | `competencia` | `Reuniao` (gera pauta em markdown) |
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
