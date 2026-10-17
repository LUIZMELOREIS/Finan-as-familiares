/**
 * dados_iniciais.gs — Dados iniciais gravados por instalar(): grupos, categorias e versículos.
 *
 * ARQUIVO GERADO AUTOMATICAMENTE por apps-script/testes/gerar_dados_iniciais.mjs
 * a partir de dados/grupos_categorias.json e dados/versiculos.json. Não edite à mão:
 * altere os JSON e rode o script de novo.
 *
 * Versículos: Almeida Revista e Corrigida (domínio público).
 */

/** Grupos (os 5 "cards" da tela inicial). */
function dadosIniciaisGrupos() {
  return [
  {"id":"g_entradas","nome":"Entradas","icone":"💰","cor":"#4CB963","ordem":1,"tipo":"receita"},
  {"id":"g_casa","nome":"Contas da Casa","icone":"🏠","cor":"#5B5BE0","ordem":2,"tipo":"despesa"},
  {"id":"g_diaadia","nome":"Dia a Dia","icone":"🛒","cor":"#BD55C7","ordem":3,"tipo":"despesa"},
  {"id":"g_dizimo","nome":"Dízimo e Ofertas","icone":"🙏","cor":"#F2C552","ordem":4,"tipo":"despesa"},
  {"id":"g_sonhos","nome":"Sonhos da Família","icone":"✈️","cor":"#E0852F","ordem":5,"tipo":"projeto"}
  ]
}

/** Categorias com palavras-chave para sugestão automática. */
function dadosIniciaisCategorias() {
  return [
  {"id":"c_salario","grupo_id":"g_entradas","subgrupo":"Salários","nome":"Salário","icone":"💼","cor":"#4CB963","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"SALARIO;PAGAMENTO;FOLHA;PROVENTOS","sensivel":true,"ativa":true},
  {"id":"c_aposentadoria","grupo_id":"g_entradas","subgrupo":"Salários","nome":"Aposentadoria","icone":"👴","cor":"#4CB963","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"INSS;APOSENTADORIA;BENEFICIO","sensivel":true,"ativa":true},
  {"id":"c_renda_extra","grupo_id":"g_entradas","subgrupo":"Outras receitas","nome":"Renda extra","icone":"🛠️","cor":"#6FCF83","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"FREELA;BICO;EXTRA;COMISSAO","ativa":true,"sensivel":false},
  {"id":"c_aluguel_recebido","grupo_id":"g_entradas","subgrupo":"Outras receitas","nome":"Aluguel recebido","icone":"🏘️","cor":"#6FCF83","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"ALUGUEL RECEBIDO;LOCACAO","ativa":true,"sensivel":false},
  {"id":"c_mesada_recebida","grupo_id":"g_entradas","subgrupo":"Outras receitas","nome":"Mesada","icone":"🐷","cor":"#6FCF83","tipo":"receita","fixa":true,"orcamento_mensal":0,"palavras_chave":"MESADA","ativa":true,"sensivel":false},
  {"id":"c_outras_receitas","grupo_id":"g_entradas","subgrupo":"Outras receitas","nome":"Outras entradas","icone":"✨","cor":"#6FCF83","tipo":"receita","fixa":false,"orcamento_mensal":0,"palavras_chave":"RESTITUICAO;PRESENTE;REEMBOLSO;RENDIMENTO","ativa":true,"sensivel":false},
  {"id":"c_aluguel","grupo_id":"g_casa","subgrupo":"Moradia","nome":"Aluguel / Prestação","icone":"🏠","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":2000,"palavras_chave":"ALUGUEL;IMOBILIARIA;FINANCIAMENTO IMOB;CAIXA HABITACAO","ativa":true,"sensivel":false},
  {"id":"c_iptu","grupo_id":"g_casa","subgrupo":"Moradia","nome":"IPTU","icone":"🏛️","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":150,"palavras_chave":"IPTU;PREFEITURA","ativa":true,"sensivel":false},
  {"id":"c_condominio","grupo_id":"g_casa","subgrupo":"Moradia","nome":"Condomínio","icone":"🏢","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":500,"palavras_chave":"CONDOMINIO","ativa":true,"sensivel":false},
  {"id":"c_agua","grupo_id":"g_casa","subgrupo":"Consumo","nome":"Água","icone":"💧","cor":"#4FA3E0","tipo":"despesa","fixa":true,"orcamento_mensal":120,"palavras_chave":"SANEPAR;SABESP;COPASA;CEDAE;AGUA;SANEAMENTO","ativa":true,"sensivel":false},
  {"id":"c_luz","grupo_id":"g_casa","subgrupo":"Consumo","nome":"Luz","icone":"💡","cor":"#F2C552","tipo":"despesa","fixa":true,"orcamento_mensal":300,"palavras_chave":"COPEL;ENEL;CEMIG;LIGHT;CPFL;ENERGIA;ELETRICA","ativa":true,"sensivel":false},
  {"id":"c_gas","grupo_id":"g_casa","subgrupo":"Consumo","nome":"Gás","icone":"🔥","cor":"#E0852F","tipo":"despesa","fixa":true,"orcamento_mensal":120,"palavras_chave":"COMPAGAS;COMGAS;ULTRAGAZ;LIQUIGAS;GAS","ativa":true,"sensivel":false},
  {"id":"c_internet","grupo_id":"g_casa","subgrupo":"Consumo","nome":"Internet","icone":"🌐","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":130,"palavras_chave":"VIVO FIBRA;CLARO NET;OI FIBRA;INTERNET;BANDA LARGA;TIM LIVE","ativa":true,"sensivel":false},
  {"id":"c_telefone","grupo_id":"g_casa","subgrupo":"Consumo","nome":"Telefone / Celular","icone":"📱","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":150,"palavras_chave":"VIVO;CLARO;TIM;OI;CELULAR;TELEFONE","ativa":true,"sensivel":false},
  {"id":"c_plano_saude","grupo_id":"g_casa","subgrupo":"Saúde e Educação","nome":"Plano de saúde","icone":"🏥","cor":"#E5535B","tipo":"despesa","fixa":true,"orcamento_mensal":900,"palavras_chave":"UNIMED;AMIL;BRADESCO SAUDE;SULAMERICA;HAPVIDA;PLANO DE SAUDE","ativa":true,"sensivel":false},
  {"id":"c_escola","grupo_id":"g_casa","subgrupo":"Saúde e Educação","nome":"Escola / Faculdade","icone":"🎓","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":1200,"palavras_chave":"ESCOLA;COLEGIO;FACULDADE;UNIVERSIDADE;MENSALIDADE;CURSO","ativa":true,"sensivel":false},
  {"id":"c_financiamento_carro","grupo_id":"g_casa","subgrupo":"Transporte","nome":"Financiamento do carro","icone":"🚗","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":900,"palavras_chave":"FINANCIAMENTO VEICULO;CONSORCIO;BV FINANCEIRA;SANTANDER FINANC","ativa":true,"sensivel":false},
  {"id":"c_seguro_carro","grupo_id":"g_casa","subgrupo":"Transporte","nome":"Seguro do carro","icone":"🛡️","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":200,"palavras_chave":"PORTO SEGURO;AZUL SEGUROS;SEGURO AUTO;TOKIO MARINE","ativa":true,"sensivel":false},
  {"id":"c_ipva","grupo_id":"g_casa","subgrupo":"Transporte","nome":"IPVA / Licenciamento","icone":"📄","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":150,"palavras_chave":"IPVA;DETRAN;LICENCIAMENTO","ativa":true,"sensivel":false},
  {"id":"c_seguros","grupo_id":"g_casa","subgrupo":"Seguros e assinaturas","nome":"Seguros","icone":"☂️","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":100,"palavras_chave":"SEGURO VIDA;SEGURO RESIDENCIAL;PREVIDENCIA","ativa":true,"sensivel":false},
  {"id":"c_assinaturas","grupo_id":"g_casa","subgrupo":"Seguros e assinaturas","nome":"Assinaturas fixas","icone":"🔁","cor":"#5B5BE0","tipo":"despesa","fixa":true,"orcamento_mensal":100,"palavras_chave":"ASSINATURA;ANUIDADE;MENSALIDADE","ativa":true,"sensivel":false},
  {"id":"c_mercado","grupo_id":"g_diaadia","subgrupo":"Alimentação","nome":"Mercado","icone":"🛒","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":1500,"palavras_chave":"SUPERMERCADO;MERCADO;CONDOR;MUFFATO;CARREFOUR;ASSAI;ATACADAO;ANGELONI;FESTVAL;BIG;PAO DE ACUCAR;EXTRA","ativa":true,"sensivel":false},
  {"id":"c_feira","grupo_id":"g_diaadia","subgrupo":"Alimentação","nome":"Feira / Hortifruti","icone":"🥦","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":250,"palavras_chave":"FEIRA;HORTIFRUTI;SACOLAO;VERDURAS;FRUTAS","ativa":true,"sensivel":false},
  {"id":"c_padaria","grupo_id":"g_diaadia","subgrupo":"Alimentação","nome":"Padaria","icone":"🥖","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":200,"palavras_chave":"PADARIA;PANIFICADORA;CONFEITARIA;PAES","ativa":true,"sensivel":false},
  {"id":"c_delivery","grupo_id":"g_diaadia","subgrupo":"Alimentação","nome":"Delivery / Lanches","icone":"🍕","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":300,"palavras_chave":"IFOOD;RAPPI;UBER EATS;LANCHE;PIZZA;HAMBURGUER;MC DONALDS;BURGER","ativa":true,"sensivel":false},
  {"id":"c_farmacia","grupo_id":"g_diaadia","subgrupo":"Farmácia e cuidados","nome":"Farmácia","icone":"💊","cor":"#E5535B","tipo":"despesa","fixa":false,"orcamento_mensal":200,"palavras_chave":"FARMACIA;DROGARIA;DROGASIL;PANVEL;NISSEI;PAGUE MENOS;RAIA;REMEDIO","ativa":true,"sensivel":false},
  {"id":"c_cuidados","grupo_id":"g_diaadia","subgrupo":"Farmácia e cuidados","nome":"Cuidados pessoais","icone":"💇","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"SALAO;BARBEARIA;CABELEIREIRO;MANICURE;PERFUMARIA;BOTICARIO;NATURA","ativa":true,"sensivel":false},
  {"id":"c_combustivel","grupo_id":"g_diaadia","subgrupo":"Transporte do dia","nome":"Combustível","icone":"⛽","cor":"#E0852F","tipo":"despesa","fixa":false,"orcamento_mensal":500,"palavras_chave":"POSTO;COMBUSTIVEL;GASOLINA;ETANOL;SHELL;IPIRANGA;PETROBRAS;BR MANIA","ativa":true,"sensivel":false},
  {"id":"c_transporte","grupo_id":"g_diaadia","subgrupo":"Transporte do dia","nome":"Uber / Ônibus / Estacionamento","icone":"🚌","cor":"#E0852F","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"UBER;99;ONIBUS;ESTACIONAMENTO;PEDAGIO;URBS;METRO","ativa":true,"sensivel":false},
  {"id":"c_passeios","grupo_id":"g_diaadia","subgrupo":"Lazer","nome":"Passeios e restaurantes","icone":"🍽️","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":400,"palavras_chave":"RESTAURANTE;CHURRASCARIA;CINEMA;PARQUE;PASSEIO;SORVETERIA;CAFE","ativa":true,"sensivel":false},
  {"id":"c_streaming","grupo_id":"g_diaadia","subgrupo":"Lazer","nome":"Streaming e apps","icone":"📺","cor":"#BD55C7","tipo":"despesa","fixa":true,"orcamento_mensal":120,"palavras_chave":"NETFLIX;SPOTIFY;DISNEY;AMAZON PRIME;GLOBOPLAY;HBO;YOUTUBE;APPLE.COM;GOOGLE PLAY","ativa":true,"sensivel":false},
  {"id":"c_hobbies","grupo_id":"g_diaadia","subgrupo":"Lazer","nome":"Hobbies e esportes","icone":"⚽","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"ACADEMIA;SMARTFIT;LIVRARIA;ESPORTE;JOGO;HOBBY","ativa":true,"sensivel":false},
  {"id":"c_roupas","grupo_id":"g_diaadia","subgrupo":"Roupas e presentes","nome":"Roupas e calçados","icone":"👕","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":250,"palavras_chave":"RENNER;C&A;RIACHUELO;ZARA;HERING;CALCADOS;ROUPA;SHEIN;CENTAURO","ativa":true,"sensivel":false},
  {"id":"c_presentes","grupo_id":"g_diaadia","subgrupo":"Roupas e presentes","nome":"Presentes","icone":"🎁","cor":"#BD55C7","tipo":"despesa","fixa":false,"orcamento_mensal":100,"palavras_chave":"PRESENTE;ANIVERSARIO;FLORICULTURA","ativa":true,"sensivel":false},
  {"id":"c_casa_manutencao","grupo_id":"g_diaadia","subgrupo":"Imprevistos","nome":"Manutenção da casa","icone":"🔧","cor":"#A9AAB8","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"LEROY MERLIN;MATERIAL DE CONSTRUCAO;ENCANADOR;ELETRICISTA;CONSERTO;BALAROTI;TELHANORTE","ativa":true,"sensivel":false},
  {"id":"c_pet","grupo_id":"g_diaadia","subgrupo":"Imprevistos","nome":"Pet","icone":"🐶","cor":"#A9AAB8","tipo":"despesa","fixa":false,"orcamento_mensal":150,"palavras_chave":"PET;PETZ;COBASI;VETERINARIO;RACAO","ativa":true,"sensivel":false},
  {"id":"c_imprevistos","grupo_id":"g_diaadia","subgrupo":"Imprevistos","nome":"Imprevistos","icone":"⚠️","cor":"#A9AAB8","tipo":"despesa","fixa":false,"orcamento_mensal":200,"palavras_chave":"MULTA;TAXA;JUROS;TARIFA","ativa":true,"sensivel":false},
  {"id":"c_dizimo","grupo_id":"g_dizimo","subgrupo":"Dízimo e Ofertas","nome":"Dízimo","icone":"🙏","cor":"#F2C552","tipo":"despesa","fixa":true,"orcamento_mensal":0,"palavras_chave":"DIZIMO;IGREJA","ativa":true,"sensivel":false},
  {"id":"c_ofertas","grupo_id":"g_dizimo","subgrupo":"Dízimo e Ofertas","nome":"Ofertas","icone":"💛","cor":"#F2C552","tipo":"despesa","fixa":false,"orcamento_mensal":0,"palavras_chave":"OFERTA","ativa":true,"sensivel":false},
  {"id":"c_missoes","grupo_id":"g_dizimo","subgrupo":"Dízimo e Ofertas","nome":"Missões","icone":"🌍","cor":"#F2C552","tipo":"despesa","fixa":false,"orcamento_mensal":0,"palavras_chave":"MISSOES;MISSIONARIO","ativa":true,"sensivel":false},
  {"id":"c_ajuda","grupo_id":"g_dizimo","subgrupo":"Dízimo e Ofertas","nome":"Ajuda ao próximo","icone":"🤝","cor":"#F2C552","tipo":"despesa","fixa":false,"orcamento_mensal":0,"palavras_chave":"DOACAO;AJUDA;CARIDADE","ativa":true,"sensivel":false},
  {"id":"c_aporte_sonho","grupo_id":"g_sonhos","subgrupo":"Sonhos da Família","nome":"Aporte em sonho","icone":"✈️","cor":"#E0852F","tipo":"despesa","fixa":false,"orcamento_mensal":0,"palavras_chave":"POUPANCA;APORTE;RESERVA;CDB;TESOURO","ativa":true,"sensivel":false}
  ]
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
  ]
}
