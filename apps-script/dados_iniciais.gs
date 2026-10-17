/**
 * dados_iniciais.gs — Dados iniciais gravados por instalar(): tipos, grupos, categorias (cardápio),
 * grupos de análise, paleta de cores e versículos.
 *
 * ARQUIVO GERADO AUTOMATICAMENTE por apps-script/testes/gerar_dados_iniciais.mjs
 * a partir de dados/grupos_categorias.json e dados/versiculos.json. Não edite à mão:
 * altere os JSON e rode o script de novo.
 *
 * Versículos: Almeida Revista e Corrigida (domínio público).
 */

/** Os 4 tipos (cards da tela inicial): Receitas, Despesas fixas, Despesas variáveis, Projetos. Nunca aumentam. */
function dadosIniciaisTipos() {
  return [
  {"id":"t_receitas","nome":"Receitas","icone":"wallet","cor":"green","ordem":1},
  {"id":"t_fixas","nome":"Despesas fixas","icone":"house","cor":"indigo","ordem":2},
  {"id":"t_variaveis","nome":"Despesas variáveis","icone":"shopping-cart","cor":"magenta","ordem":3},
  {"id":"t_projetos","nome":"Projetos","icone":"target","cor":"gold","ordem":4}
  ];
}

/** Grupos do cardápio (cada um dentro de um tipo; cor da paleta; grupo de análise dos gráficos). */
function dadosIniciaisGrupos() {
  return [
  {"id":"g_dizimo","tipo_id":"t_fixas","nome":"Dízimo e ofertas","cor":"green","grupo_analise":"Dízimo e ofertas","ordem":1,"ativo":true},
  {"id":"g_moradia","tipo_id":"t_fixas","nome":"Moradia","cor":"indigo","grupo_analise":"Moradia","ordem":2,"ativo":true},
  {"id":"g_consumo","tipo_id":"t_fixas","nome":"Contas de consumo","cor":"lilac","grupo_analise":"Contas de consumo","ordem":3,"ativo":true},
  {"id":"g_saude_edu","tipo_id":"t_fixas","nome":"Saúde e educação","cor":"gold","grupo_analise":"Saúde e educação","ordem":4,"ativo":true},
  {"id":"g_transporte_fixo","tipo_id":"t_fixas","nome":"Transporte","cor":"orange","grupo_analise":"Transporte","ordem":5,"ativo":true},
  {"id":"g_assinaturas","tipo_id":"t_fixas","nome":"Assinaturas","cor":"rose","grupo_analise":"Lazer","ordem":6,"ativo":true},
  {"id":"g_alimentacao","tipo_id":"t_variaveis","nome":"Alimentação","cor":"magenta","grupo_analise":"Alimentação","ordem":7,"ativo":true},
  {"id":"g_transporte_dia","tipo_id":"t_variaveis","nome":"Transporte do dia a dia","cor":"orange","grupo_analise":"Transporte","ordem":8,"ativo":true},
  {"id":"g_saude_cuidados","tipo_id":"t_variaveis","nome":"Saúde e cuidados","cor":"gold","grupo_analise":"Saúde e educação","ordem":9,"ativo":true},
  {"id":"g_casa","tipo_id":"t_variaveis","nome":"Casa","cor":"indigo","grupo_analise":"Moradia","ordem":10,"ativo":true},
  {"id":"g_lazer","tipo_id":"t_variaveis","nome":"Lazer","cor":"rose","grupo_analise":"Lazer","ordem":11,"ativo":true},
  {"id":"g_outros","tipo_id":"t_variaveis","nome":"Outros","cor":"slate","grupo_analise":"Outros","ordem":12,"ativo":true},
  {"id":"g_entradas","tipo_id":"t_receitas","nome":"Entradas","cor":"green","grupo_analise":"Receitas","ordem":13,"ativo":true},
  {"id":"g_projetos","tipo_id":"t_projetos","nome":"Projetos","cor":"gold","grupo_analise":"Projetos","ordem":14,"ativo":true}
  ];
}

/** Categorias (cardápio) com ícone Lucide, palavras-chave para classificação automática e orçamento. */
function dadosIniciaisCategorias() {
  return [
  {"id":"c_dizimo","tipo_id":"t_fixas","grupo_id":"g_dizimo","nome":"Dízimo","icone":"church","cor":"green","tipo":"despesa","fixa":true,"orcamento_mensal":1530,"palavras_chave":"DIZIMO;IGREJA","grupo_analise":"Dízimo e ofertas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_ofertas","tipo_id":"t_fixas","grupo_id":"g_dizimo","nome":"Ofertas","icone":"hand-heart","cor":"green","tipo":"despesa","fixa":false,"orcamento_mensal":100,"palavras_chave":"OFERTA","grupo_analise":"Dízimo e ofertas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_missoes","tipo_id":"t_fixas","grupo_id":"g_dizimo","nome":"Missões e ajuda","icone":"hand-coins","cor":"green","tipo":"despesa","fixa":false,"orcamento_mensal":80,"palavras_chave":"MISSOES;MISSIONARIO;DOACAO;AJUDA;CARIDADE","grupo_analise":"Dízimo e ofertas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_aluguel","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"Aluguel","icone":"key-round","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":0,"palavras_chave":"ALUGUEL;IMOBILIARIA;LOCACAO","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_prestacao_casa","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"Prestação da casa","icone":"house","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":2450,"palavras_chave":"FINANCIAMENTO IMOB;CAIXA HABITACAO;PRESTACAO;SFH","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_condominio","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"Condomínio","icone":"building-2","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":610,"palavras_chave":"CONDOMINIO","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_iptu","tipo_id":"t_fixas","grupo_id":"g_moradia","nome":"IPTU","icone":"landmark","cor":"indigo","tipo":"despesa","fixa":true,"orcamento_mensal":140,"palavras_chave":"IPTU;PREFEITURA","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_luz","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Luz","icone":"zap","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":412,"palavras_chave":"COPEL;ENEL;CEMIG;LIGHT;CPFL;ENERGIA;ELETRICA;ELETROPAULO","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_agua","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Água","icone":"droplet","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":168,"palavras_chave":"SANEPAR;SABESP;COPASA;CEDAE;AGUA;SANEAMENTO","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_gas","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Gás","icone":"flame","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":72,"palavras_chave":"COMPAGAS;COMGAS;ULTRAGAZ;LIQUIGAS;GAS","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_internet","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Internet","icone":"wifi","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":139,"palavras_chave":"VIVO FIBRA;CLARO NET;OI FIBRA;INTERNET;BANDA LARGA;TIM LIVE;FIBRA","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_telefone","tipo_id":"t_fixas","grupo_id":"g_consumo","nome":"Telefone e celular","icone":"smartphone","cor":"lilac","tipo":"despesa","fixa":true,"orcamento_mensal":189,"palavras_chave":"VIVO;CLARO;TIM;OI;CELULAR;TELEFONE","grupo_analise":"Contas de consumo","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_plano_saude","tipo_id":"t_fixas","grupo_id":"g_saude_edu","nome":"Plano de saúde","icone":"heart-pulse","cor":"gold","tipo":"despesa","fixa":true,"orcamento_mensal":2120,"palavras_chave":"UNIMED;AMIL;BRADESCO SAUDE;SULAMERICA;HAPVIDA;PLANO DE SAUDE","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_escola","tipo_id":"t_fixas","grupo_id":"g_saude_edu","nome":"Escola e faculdade","icone":"graduation-cap","cor":"gold","tipo":"despesa","fixa":true,"orcamento_mensal":1480,"palavras_chave":"ESCOLA;COLEGIO;FACULDADE;UNIVERSIDADE;MENSALIDADE;PUC;UP;UNICURITIBA","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_cursos","tipo_id":"t_fixas","grupo_id":"g_saude_edu","nome":"Cursos e livros","icone":"book-open","cor":"gold","tipo":"despesa","fixa":true,"orcamento_mensal":250,"palavras_chave":"CURSO;LIVRARIA;LIVRO;UDEMY;ALURA;KUMON;INGLES","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_financiamento_carro","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"Financiamento do carro","icone":"car","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":0,"palavras_chave":"FINANCIAMENTO VEICULO;CONSORCIO;BV FINANCEIRA;SANTANDER FINANC","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_seguro_carro","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"Seguro do carro","icone":"shield-check","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":310,"palavras_chave":"PORTO SEGURO;AZUL SEGUROS;SEGURO AUTO;TOKIO MARINE;HDI;ALLIANZ","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_ipva","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"IPVA e licenciamento","icone":"landmark","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":150,"palavras_chave":"IPVA;DETRAN;LICENCIAMENTO","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_vale_transporte","tipo_id":"t_fixas","grupo_id":"g_transporte_fixo","nome":"Vale-transporte","icone":"bus","cor":"orange","tipo":"despesa","fixa":true,"orcamento_mensal":0,"palavras_chave":"VALE TRANSPORTE;CARTAO TRANSPORTE;URBS","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_streaming","tipo_id":"t_fixas","grupo_id":"g_assinaturas","nome":"Streaming","icone":"tv","cor":"rose","tipo":"despesa","fixa":true,"orcamento_mensal":121,"palavras_chave":"NETFLIX;SPOTIFY;DISNEY;AMAZON PRIME;GLOBOPLAY;HBO;MAX;YOUTUBE PREMIUM;DEEZER;PARAMOUNT","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_apps","tipo_id":"t_fixas","grupo_id":"g_assinaturas","nome":"Aplicativos","icone":"smartphone","cor":"rose","tipo":"despesa","fixa":true,"orcamento_mensal":60,"palavras_chave":"APPLE.COM;GOOGLE PLAY;ICLOUD;GOOGLE ONE;MICROSOFT;ADOBE;CANVA;CHATGPT;CLAUDE.AI","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_seguros","tipo_id":"t_fixas","grupo_id":"g_assinaturas","nome":"Seguros diversos","icone":"shield-check","cor":"rose","tipo":"despesa","fixa":true,"orcamento_mensal":100,"palavras_chave":"SEGURO VIDA;SEGURO RESIDENCIAL;PREVIDENCIA;PRUDENTIAL;METLIFE","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_mercado","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Supermercado","icone":"shopping-cart","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":1620,"palavras_chave":"SUPERMERCADO;MERCADO;CONDOR;MUFFATO;CARREFOUR;ASSAI;ATACADAO;ANGELONI;FESTVAL;BIG;PAO DE ACUCAR;EXTRA;SAMS;TAUSTE","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_feira","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Feira e hortifrúti","icone":"apple","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":100,"palavras_chave":"FEIRA;HORTIFRUTI;SACOLAO;VERDURAS;FRUTAS;HORTI","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_padaria","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Padaria","icone":"croissant","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":214,"palavras_chave":"PADARIA;PANIFICADORA;CONFEITARIA;PAES;PAO","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_acougue","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Açougue","icone":"beef","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":180,"palavras_chave":"ACOUGUE;CARNES;FRIGORIFICO;CASA DE CARNES","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_delivery","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Delivery","icone":"bike","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":352,"palavras_chave":"IFOOD;RAPPI;UBER EATS;LANCHE;PIZZA;HAMBURGUER;MC DONALDS;BURGER;DELIVERY;AIQFOME","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_restaurantes","tipo_id":"t_variaveis","grupo_id":"g_alimentacao","nome":"Restaurantes","icone":"utensils","cor":"magenta","tipo":"despesa","fixa":false,"orcamento_mensal":260,"palavras_chave":"RESTAURANTE;CHURRASCARIA;CAFE;LANCHONETE;BAR;SORVETERIA;OUTBACK;MADERO","grupo_analise":"Alimentação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_combustivel","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"Combustível","icone":"fuel","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":820,"palavras_chave":"POSTO;COMBUSTIVEL;GASOLINA;ETANOL;SHELL;IPIRANGA;PETROBRAS;BR MANIA;AUTO POSTO","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_estacionamento","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"Estacionamento e pedágio","icone":"parking-meter","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":140,"palavras_chave":"ESTACIONAMENTO;PEDAGIO;ESTAPAR;SEM PARAR;CONECTCAR;VELOE;ZONA AZUL;ESTAR","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_app_transporte","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"App de transporte","icone":"car","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":120,"palavras_chave":"UBER;99;CABIFY;99POP;INDRIVE;ONIBUS;METRO","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_manutencao_carro","tipo_id":"t_variaveis","grupo_id":"g_transporte_dia","nome":"Manutenção do carro","icone":"wrench","cor":"orange","tipo":"despesa","fixa":false,"orcamento_mensal":180,"palavras_chave":"OFICINA;MECANICA;PNEU;AUTO CENTER;LAVA CAR;LAVAGEM;TROCA DE OLEO;BORRACHARIA","grupo_analise":"Transporte","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_farmacia","tipo_id":"t_variaveis","grupo_id":"g_saude_cuidados","nome":"Farmácia","icone":"pill","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":260,"palavras_chave":"FARMACIA;DROGARIA;DROGASIL;PANVEL;NISSEI;PAGUE MENOS;RAIA;REMEDIO;ULTRAFARMA","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_consultas","tipo_id":"t_variaveis","grupo_id":"g_saude_cuidados","nome":"Consultas e exames","icone":"stethoscope","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":200,"palavras_chave":"CLINICA;LABORATORIO;CONSULTA;EXAME;DENTISTA;ODONTO;HOSPITAL;FISIOTERAPIA;PSICOLOG","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_cabelo","tipo_id":"t_variaveis","grupo_id":"g_saude_cuidados","nome":"Cabelo e estética","icone":"scissors","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"SALAO;BARBEARIA;CABELEIREIRO;MANICURE;ESTETICA;PERFUMARIA;BOTICARIO;NATURA","grupo_analise":"Saúde e educação","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_reparos","tipo_id":"t_variaveis","grupo_id":"g_casa","nome":"Reparos e manutenção","icone":"hammer","cor":"indigo","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"LEROY MERLIN;MATERIAL DE CONSTRUCAO;ENCANADOR;ELETRICISTA;CONSERTO;BALAROTI;TELHANORTE;CASSOL;FERRAGENS","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_moveis","tipo_id":"t_variaveis","grupo_id":"g_casa","nome":"Móveis e utensílios","icone":"sofa","cor":"indigo","tipo":"despesa","fixa":false,"orcamento_mensal":100,"palavras_chave":"MOVEIS;TOK STOK;MAGAZINE LUIZA;CASAS BAHIA;HAVAN;UTENSILIOS;ELETRODOMESTICO;AMERICANAS","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_limpeza","tipo_id":"t_variaveis","grupo_id":"g_casa","nome":"Limpeza","icone":"spray-can","cor":"indigo","tipo":"despesa","fixa":false,"orcamento_mensal":80,"palavras_chave":"LIMPEZA;DIARISTA;LAVANDERIA;PRODUTOS DE LIMPEZA","grupo_analise":"Moradia","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_passeios","tipo_id":"t_variaveis","grupo_id":"g_lazer","nome":"Passeios e eventos","icone":"ticket","cor":"rose","tipo":"despesa","fixa":false,"orcamento_mensal":310,"palavras_chave":"CINEMA;CINEMARK;TEATRO;PARQUE;INGRESSO;SHOW;PASSEIO;ZOOLOGICO;MUSEU;SYMPLA","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_viagens","tipo_id":"t_variaveis","grupo_id":"g_lazer","nome":"Viagens curtas","icone":"plane","cor":"rose","tipo":"despesa","fixa":false,"orcamento_mensal":280,"palavras_chave":"HOTEL;POUSADA;AIRBNB;BOOKING;PASSAGEM;LATAM;GOL;AZUL;RODOVIARIA","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_hobbies","tipo_id":"t_variaveis","grupo_id":"g_lazer","nome":"Hobbies","icone":"palette","cor":"rose","tipo":"despesa","fixa":false,"orcamento_mensal":209,"palavras_chave":"ACADEMIA;SMARTFIT;ESPORTE;JOGO;HOBBY;STEAM;PLAYSTATION;XBOX;INSTRUMENTO;ARTESANATO","grupo_analise":"Lazer","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_roupas","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Vestuário","icone":"shirt","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":190,"palavras_chave":"RENNER;C&A;RIACHUELO;ZARA;HERING;CALCADOS;ROUPA;SHEIN;CENTAURO;MARISA;NIKE;ADIDAS","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_presentes","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Presentes","icone":"gift","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":90,"palavras_chave":"PRESENTE;ANIVERSARIO;FLORICULTURA;FLORES","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_pet","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Pets","icone":"paw-print","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":120,"palavras_chave":"PET;PETZ;COBASI;VETERINARIO;RACAO;PETSHOP","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_imprevistos","tipo_id":"t_variaveis","grupo_id":"g_outros","nome":"Imprevistos","icone":"triangle-alert","cor":"slate","tipo":"despesa","fixa":false,"orcamento_mensal":70,"palavras_chave":"MULTA;TAXA;JUROS;TARIFA;CARTORIO;DESPACHANTE","grupo_analise":"Outros","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_salario","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Salário","icone":"briefcase","cor":"green","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"SALARIO;PAGAMENTO;FOLHA;PROVENTOS;INSS;APOSENTADORIA","grupo_analise":"Receitas","sensivel":true,"oculta_cardapio":false,"ativa":true},
  {"id":"c_renda_extra","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Renda extra","icone":"banknote","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"FREELA;BICO;EXTRA;COMISSAO;CONSULTORIA;13","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_aluguel_recebido","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Aluguel recebido","icone":"house","cor":"green","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"ALUGUEL RECEBIDO;LOCACAO","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_rendimentos","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Rendimentos","icone":"piggy-bank","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"RENDIMENTO;JUROS RECEBIDOS;DIVIDENDO;CDB;TESOURO","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_reembolsos","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Reembolsos","icone":"circle-dollar-sign","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"REEMBOLSO;RESTITUICAO;ESTORNO","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_mesada_recebida","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Mesada","icone":"hand-coins","cor":"green","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"MESADA","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_outras_receitas","tipo_id":"t_receitas","grupo_id":"g_entradas","nome":"Outras entradas","icone":"wallet","cor":"green","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"PRESENTE RECEBIDO;VENDA;OUTRA","grupo_analise":"Receitas","sensivel":false,"oculta_cardapio":false,"ativa":true},
  {"id":"c_aporte_projeto","tipo_id":"t_projetos","grupo_id":"g_projetos","nome":"Aporte em projeto","icone":"target","cor":"gold","tipo":"despesa","fixa":false,"orcamento_mensal":0,"palavras_chave":"POUPANCA;APORTE;RESERVA;APLICACAO","grupo_analise":"Projetos","sensivel":false,"oculta_cardapio":true,"ativa":true}
  ];
}

/** Agrupamento fixo usado nos gráficos (nome → cor da paleta). */
function dadosIniciaisGruposAnalise() {
  return [
  {"nome":"Moradia","cor":"indigo"},
  {"nome":"Contas de consumo","cor":"lilac"},
  {"nome":"Saúde e educação","cor":"gold"},
  {"nome":"Transporte","cor":"orange"},
  {"nome":"Alimentação","cor":"magenta"},
  {"nome":"Lazer","cor":"rose"},
  {"nome":"Dízimo e ofertas","cor":"green"},
  {"nome":"Outros","cor":"slate"}
  ];
}

/** Paleta de cores do padrão visual (nome → hexadecimal). */
function dadosIniciaisCores() {
  return {"side":"#0D0E23","panel":"#141519","card":"#1E1F26","card2":"#24252E","line":"#2C2E3A","text":"#ECECF2","muted":"#8E90A2","faint":"#5E6072","indigo":"#5B5BE0","sel":"#7776E6","magenta":"#BD55C7","gold":"#F2C552","orange":"#E0852F","green":"#4CB963","red":"#E5535B","lilac":"#9A99F0","rose":"#E58FD9","slate":"#6B6E80"};
}

/** Versículos sobre mordomia, generosidade, planejamento, família etc. */
function dadosIniciaisVersiculos() {
  return [
  {"id":"v01","referencia":"Josué 24:15","tema":"família","texto":"Porém, se vos parece mal aos vossos olhos servir ao Senhor, escolhei hoje a quem sirvais; porém eu e a minha casa serviremos ao Senhor."},
  {"id":"v02","referencia":"Provérbios 3:9-10","tema":"generosidade","texto":"Honra ao Senhor com a tua fazenda e com as primícias de toda a tua renda; e se encherão os teus celeiros, e transbordarão de mosto os teus lagares."},
  {"id":"v03","referencia":"Provérbios 21:5","tema":"planejamento","texto":"Os pensamentos do diligente tendem só à abundância, porém os de todo apressado, tão-somente à pobreza."},
  {"id":"v04","referencia":"Provérbios 22:7","tema":"dívida","texto":"O rico domina sobre os pobres, e o que toma emprestado é servo do que empresta."},
  {"id":"v05","referencia":"Provérbios 6:6-8","tema":"planejamento","texto":"Vai ter com a formiga, ó preguiçoso; olha para os seus caminhos e sê sábio. Pois ela, não tendo superior, nem oficial, nem dominador, prepara no verão o seu pão; na sega ajunta o seu mantimento."},
  {"id":"v06","referencia":"Provérbios 13:11","tema":"planejamento","texto":"A fazenda que procede da vaidade diminuirá, mas quem a ajunta pelo trabalho terá aumento."},
  {"id":"v07","referencia":"Provérbios 24:27","tema":"planejamento","texto":"Prepara de fora a tua obra, e aparelha-a no campo, e então edifica a tua casa."},
  {"id":"v08","referencia":"Malaquias 3:10","tema":"generosidade","texto":"Trazei todos os dízimos à casa do tesouro, para que haja mantimento na minha casa, e depois fazei prova de mim, diz o Senhor dos Exércitos, se eu não vos abrir as janelas do céu e não derramar sobre vós uma bênção tal, que dela vos advenha a maior abastança."},
  {"id":"v09","referencia":"Mateus 6:19-21","tema":"mordomia","texto":"Não ajunteis tesouros na terra, onde a traça e a ferrugem tudo consomem, e onde os ladrões minam e roubam; mas ajuntai tesouros no céu. Porque onde estiver o vosso tesouro, aí estará também o vosso coração."},
  {"id":"v10","referencia":"Mateus 6:33","tema":"provisão","texto":"Mas buscai primeiro o Reino de Deus, e a sua justiça, e todas essas coisas vos serão acrescentadas."},
  {"id":"v11","referencia":"Lucas 14:28","tema":"planejamento","texto":"Pois qual de vós, querendo edificar uma torre, não se assenta primeiro a fazer as contas dos gastos, para ver se tem com que a acabar?"},
  {"id":"v12","referencia":"Lucas 16:10","tema":"mordomia","texto":"Quem é fiel no mínimo também é fiel no muito; quem é injusto no mínimo também é injusto no muito."},
  {"id":"v13","referencia":"2 Coríntios 9:7","tema":"generosidade","texto":"Cada um contribua segundo propôs no seu coração, não com tristeza ou por necessidade; porque Deus ama ao que dá com alegria."},
  {"id":"v14","referencia":"Filipenses 4:11-13","tema":"contentamento","texto":"Aprendi a contentar-me com o que tenho. Sei estar abatido e sei também ter abundância; em toda a maneira e em todas as coisas estou instruído, tanto a ter fartura como a ter fome, tanto a ter abundância como a padecer necessidade. Posso todas as coisas naquele que me fortalece."},
  {"id":"v15","referencia":"Filipenses 4:19","tema":"provisão","texto":"O meu Deus, segundo as suas riquezas, suprirá todas as vossas necessidades em glória, por Cristo Jesus."},
  {"id":"v16","referencia":"1 Timóteo 6:6-8","tema":"contentamento","texto":"Mas é grande ganho a piedade com contentamento. Porque nada trouxemos para este mundo e manifesto é que nada podemos levar dele. Tendo, porém, sustento e com que nos cobrirmos, estejamos com isso contentes."},
  {"id":"v17","referencia":"1 Timóteo 6:10","tema":"contentamento","texto":"Porque o amor do dinheiro é a raiz de toda espécie de males; e nessa cobiça alguns se desviaram da fé e se traspassaram a si mesmos com muitas dores."},
  {"id":"v18","referencia":"Hebreus 13:5","tema":"contentamento","texto":"Sejam vossos costumes sem avareza, contentando-vos com o que tendes; porque ele disse: Não te deixarei, nem te desampararei."},
  {"id":"v19","referencia":"Salmos 24:1","tema":"mordomia","texto":"Do Senhor é a terra e a sua plenitude, o mundo e aqueles que nele habitam."},
  {"id":"v20","referencia":"Salmos 37:21","tema":"dívida","texto":"O ímpio toma emprestado e não paga; mas o justo se compadece e dá."},
  {"id":"v21","referencia":"Eclesiastes 5:10","tema":"contentamento","texto":"O que amar o dinheiro nunca se fartará de dinheiro; e quem amar a abundância nunca se fartará da renda; também isso é vaidade."},
  {"id":"v22","referencia":"1 Crônicas 29:14","tema":"mordomia","texto":"Porque quem sou eu, e quem é o meu povo, que tivéssemos poder para tão voluntariamente dar semelhantes coisas? Porque tudo vem de ti, e da tua mão to damos."},
  {"id":"v23","referencia":"Deuteronômio 8:18","tema":"provisão","texto":"Antes te lembrarás do Senhor teu Deus, que ele é o que te dá força para adquirires riqueza, para confirmar o seu concerto, que jurou a teus pais, como se vê neste dia."},
  {"id":"v24","referencia":"Provérbios 10:4","tema":"planejamento","texto":"O que trabalha com mão enganosa empobrece, mas a mão dos diligentes enriquece."},
  {"id":"v25","referencia":"Provérbios 11:24-25","tema":"generosidade","texto":"Alguns há que espalham, e ainda se lhes acrescenta mais; e outros, que retêm mais do que é justo, mas é para a sua perda. A alma generosa engordará, e o que regar também será regado."},
  {"id":"v26","referencia":"Provérbios 13:22","tema":"família","texto":"O homem de bem deixa uma herança aos filhos de seus filhos, mas a fazenda do pecador é depositada para o justo."},
  {"id":"v27","referencia":"Provérbios 15:16","tema":"contentamento","texto":"Melhor é o pouco com o temor do Senhor do que um grande tesouro onde há inquietação."},
  {"id":"v28","referencia":"Provérbios 15:22","tema":"família","texto":"Sem conselho os projetos saem vãos, mas, com a multidão de conselheiros, se confirmarão."},
  {"id":"v29","referencia":"Provérbios 16:3","tema":"planejamento","texto":"Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos."},
  {"id":"v30","referencia":"Provérbios 16:9","tema":"planejamento","texto":"O coração do homem considera o seu caminho, mas o Senhor lhe dirige os passos."},
  {"id":"v31","referencia":"Provérbios 19:17","tema":"generosidade","texto":"Ao Senhor empresta o que se compadece do pobre, e ele lhe pagará o seu benefício."},
  {"id":"v32","referencia":"Provérbios 21:20","tema":"planejamento","texto":"Tesouro desejável e azeite há na casa do sábio, mas o homem insensato os devora."},
  {"id":"v33","referencia":"Provérbios 22:1","tema":"contentamento","texto":"Mais digno de ser escolhido é o bom nome do que as muitas riquezas; e a graça é melhor do que a riqueza e o ouro."},
  {"id":"v34","referencia":"Provérbios 22:26-27","tema":"dívida","texto":"Não estejas entre os que se comprometem e entre os que ficam por fiadores de dívidas. Se não tens com que pagar, por que tirariam a tua cama de debaixo de ti?"},
  {"id":"v35","referencia":"Provérbios 23:4-5","tema":"contentamento","texto":"Não te canses para enriqueceres; dá de mão à tua prudência. Porventura, fitarás os olhos naquilo que não é nada? Porque, certamente, isso se fará asas e voará ao céu como a águia."},
  {"id":"v36","referencia":"Provérbios 27:23-24","tema":"mordomia","texto":"Procura conhecer o estado das tuas ovelhas; põe o teu coração sobre os teus rebanhos, porque o tesouro não dura para sempre, nem a coroa de geração em geração."},
  {"id":"v37","referencia":"Provérbios 28:20","tema":"planejamento","texto":"O homem fiel abundará em bênçãos, mas o que se apressa a enriquecer não ficará sem castigo."},
  {"id":"v38","referencia":"Provérbios 30:8-9","tema":"contentamento","texto":"Não me dês nem a pobreza nem a riqueza; mantém-me do pão da minha porção acostumada; para que, porventura, de farto te não negue e diga: Quem é o Senhor? Ou que, empobrecendo, venha a furtar e lance mão do nome de Deus."},
  {"id":"v39","referencia":"Provérbios 31:16","tema":"planejamento","texto":"Considera uma herdade e adquire-a; planta uma vinha com o fruto de suas mãos."},
  {"id":"v40","referencia":"Eclesiastes 11:2","tema":"planejamento","texto":"Reparte com sete e ainda até com oito, porque não sabes que mal haverá sobre a terra."},
  {"id":"v41","referencia":"Salmos 37:25","tema":"provisão","texto":"Fui moço e agora sou velho; mas nunca vi desamparado o justo, nem a sua semente a mendigar o pão."},
  {"id":"v42","referencia":"Salmos 112:5","tema":"generosidade","texto":"Bem irá ao homem que se compadece e empresta; disporá as suas coisas com juízo."},
  {"id":"v43","referencia":"Salmos 127:1","tema":"família","texto":"Se o Senhor não edificar a casa, em vão trabalham os que a edificam; se o Senhor não guardar a cidade, em vão vigia a sentinela."},
  {"id":"v44","referencia":"Salmos 128:1-2","tema":"família","texto":"Bem-aventurado aquele que teme ao Senhor e anda nos seus caminhos! Pois comerás do trabalho das tuas mãos; feliz serás, e te irá bem."},
  {"id":"v45","referencia":"Ageu 1:6","tema":"mordomia","texto":"Semeais muito e recolheis pouco; comeis, porém não vos fartais; bebeis, porém não vos saciais; vestis-vos, porém ninguém se aquece; e o que recebe salário, recebe salário num saquitel furado."},
  {"id":"v46","referencia":"Mateus 6:24","tema":"mordomia","texto":"Ninguém pode servir a dois senhores, porque ou há de odiar um e amar o outro ou se dedicará a um e desprezará o outro. Não podeis servir a Deus e a Mamom."},
  {"id":"v47","referencia":"Mateus 6:26","tema":"provisão","texto":"Olhai para as aves do céu, que nem semeiam, nem segam, nem ajuntam em celeiros; e vosso Pai celestial as alimenta. Não tendes vós muito mais valor do que elas?"},
  {"id":"v48","referencia":"Mateus 25:21","tema":"mordomia","texto":"Bem está, servo bom e fiel. Sobre o pouco foste fiel, sobre muito te colocarei; entra no gozo do teu senhor."},
  {"id":"v49","referencia":"Lucas 6:38","tema":"generosidade","texto":"Dai, e ser-vos-á dado; boa medida, recalcada, sacudida e transbordando vos darão; porque com a mesma medida com que medirdes também vos medirão de novo."},
  {"id":"v50","referencia":"Lucas 12:15","tema":"contentamento","texto":"Acautelai-vos e guardai-vos da avareza, porque a vida de qualquer não consiste na abundância do que possui."},
  {"id":"v51","referencia":"Lucas 12:34","tema":"mordomia","texto":"Porque, onde estiver o vosso tesouro, ali estará também o vosso coração."},
  {"id":"v52","referencia":"Lucas 16:11","tema":"mordomia","texto":"Pois, se nas riquezas injustas não fostes fiéis, quem vos confiará as verdadeiras?"},
  {"id":"v53","referencia":"Atos 20:35","tema":"generosidade","texto":"Tenho-vos mostrado em tudo que, trabalhando assim, é necessário auxiliar os enfermos e recordar as palavras do Senhor Jesus, que disse: Mais bem-aventurada coisa é dar do que receber."},
  {"id":"v54","referencia":"Romanos 13:8","tema":"dívida","texto":"A ninguém devais coisa alguma, a não ser o amor com que vos ameis uns aos outros; porque quem ama aos outros cumpriu a lei."},
  {"id":"v55","referencia":"1 Coríntios 4:2","tema":"mordomia","texto":"Além disso, requer-se nos despenseiros que cada um se ache fiel."},
  {"id":"v56","referencia":"1 Coríntios 16:2","tema":"planejamento","texto":"No primeiro dia da semana, cada um de vós ponha de parte o que puder ajuntar, conforme a sua prosperidade, para que se não façam as coletas quando eu chegar."},
  {"id":"v57","referencia":"2 Coríntios 9:6","tema":"generosidade","texto":"E digo isto: Que o que semeia pouco pouco também ceifará; e o que semeia em abundância em abundância também ceifará."},
  {"id":"v58","referencia":"2 Coríntios 9:8","tema":"provisão","texto":"E Deus é poderoso para fazer abundar em vós toda graça, a fim de que, tendo sempre, em tudo, toda suficiência, abundeis em toda boa obra."},
  {"id":"v59","referencia":"Colossenses 3:23","tema":"mordomia","texto":"E, tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens."},
  {"id":"v60","referencia":"1 Tessalonicenses 4:11-12","tema":"planejamento","texto":"E procureis viver quietos, e tratar dos vossos próprios negócios, e trabalhar com vossas próprias mãos, como já vo-lo temos mandado; para que andeis honestamente para com os que estão de fora e não necessiteis de coisa alguma."},
  {"id":"v61","referencia":"1 Timóteo 5:8","tema":"família","texto":"Mas, se alguém não tem cuidado dos seus e principalmente dos da sua família, negou a fé e é pior do que o infiel."},
  {"id":"v62","referencia":"1 Timóteo 6:17-18","tema":"generosidade","texto":"Manda aos ricos deste mundo que não sejam altivos, nem ponham a esperança na incerteza das riquezas, mas em Deus, que abundantemente nos dá todas as coisas para delas gozarmos; que façam o bem, enriqueçam em boas obras, repartam de boa mente e sejam comunicáveis."},
  {"id":"v63","referencia":"Tiago 1:17","tema":"provisão","texto":"Toda boa dádiva e todo dom perfeito vêm do alto, descendo do Pai das luzes, em quem não há mudança, nem sombra de variação."},
  {"id":"v64","referencia":"Tiago 4:13-15","tema":"planejamento","texto":"Eia, agora, vós que dizeis: Hoje ou amanhã iremos a tal cidade, e lá passaremos um ano, e contrataremos, e ganharemos; digo-vos que não sabeis o que acontecerá amanhã. Em lugar do que devíeis dizer: Se o Senhor quiser, e se vivermos, faremos isto ou aquilo."},
  {"id":"v65","referencia":"3 João 1:2","tema":"provisão","texto":"Amado, desejo que te vá bem em todas as coisas e que tenhas saúde, assim como bem vai a tua alma."},
  {"id":"v66","referencia":"Deuteronômio 15:10","tema":"generosidade","texto":"Livremente lhe darás, e que o teu coração não seja maligno, quando lhe deres; pois, por esta causa, te abençoará o Senhor, teu Deus, em toda a tua obra e em tudo no que puseres a tua mão."},
  {"id":"v67","referencia":"Salmos 23:1","tema":"provisão","texto":"O Senhor é o meu pastor; nada me faltará."},
  {"id":"v68","referencia":"Provérbios 3:27","tema":"generosidade","texto":"Não detenhas dos seus donos o bem, estando na tua mão poder fazê-lo."}
  ];
}
