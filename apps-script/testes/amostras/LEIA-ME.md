# Amostras anonimizadas (robô de notas fiscais)

Arquivos usados por `executar.mjs` para testar as funções de parse de `notasFiscais.gs`.
Todos os dados são **fictícios**: CPF, CNPJ, chaves, ids, tokens e nomes foram trocados por
valores inventados com o mesmo formato. Nunca copie aqui uma página real sem anonimizar.

| Arquivo | O que representa |
|---|---|
| `sefa_authentication_url.txt` | URL final dos redirecionamentos do Nota Paraná: a página de login da Identidade Digital Sefa/PR com os parâmetros do OAuth (PKCE) na query string. |
| `sefa_authentication.html` | Trecho do formulário `authForm` dessa página (campos ocultos preenchidos por JavaScript a partir da URL). |
| `notapr_lista_mes.html` | Resposta de `GET /nfprweb/NotasFiscaisAjax?periodo=01/11/2026&situacao=1` com 3 notas (estrutura reconstruída a partir das colunas vistas no teste real). |
| `notacwb_home.html` | Trecho da home do Nota Curitibana com o formulário "Acessar" (`POST /Home/CheckLogin` + token antifalsificação). |
| `ecidadao_login.html` | Trecho da página de login do e-Cidadão com os scripts do ALTCHA (prova de trabalho). |
