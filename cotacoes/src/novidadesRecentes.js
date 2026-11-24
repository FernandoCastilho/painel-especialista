// Uma entrada por dia de entrega. Agrupe no mesmo item as mudan�as de um mesmo fluxo.
// destaques: o que � estruturante (se��o nova, calculadora nova ou atualizada), em frases curtas. � o que aparece
// na tela Novidades da semana e no aviso de entrada. items: o detalhe, que fica recolhido em "Ver detalhes".
export const NOVIDADES_RECENTES = [
  {
    date: '24/11/2026',
    destaques: [
      'An�lise de desconto calcula por prazo m�dio e ticket m�dio',
      'Aviso inicial compacto, com cinco destaques',
      'Not�cias do Mercado sem Google Trends, Ve�culos pesados e Elei��es EUA',
    ],
    items: [
      'O �cone de tela cheia na barra superior oculta a navega��o, as cota��es do topo e os controles flutuantes. O mesmo �cone restaura a visualiza��o normal, sem trocar de p�gina. Esc n�o encerra o modo.',
      'Na An�lise de desconto, informe valor total, prazo m�dio e ticket m�dio por boleto. A calculadora monta um border� hipot�tico, com boletos de valores e vencimentos diferentes, e calcula juros e IOF boleto a boleto; o CET continua na regra de 30 dias da norma. A tela mostra o prazo m�dio j� ajustado para dias �teis e a lista dos boletos. � uma estimativa: o IOF real depende da data de cada boleto. A entrada t�tulo a t�tulo continua dispon�vel para o border� real, e as regras de juros, IOF e CET n�o mudaram.',
      'O aviso inicial mostra at� cinco destaques da semana. O hist�rico completo e a frequ�ncia das fontes ficam a um clique.',
      'Mercado hoje > Not�cias: Google Trends saiu da tela; a fonte continua identificada em Configura��es.',
      'Mercado hoje > Not�cias: sa�ram as abas Ve�culos pesados e Elei��es EUA. Ve�culos pesados continua em Setores > Produ��o e consumo, com os indicadores da ANFAVEA e as not�cias; as duas seguem dispon�veis em Apresentar. A busca do Painel deixa de trazer mat�rias de Elei��es EUA. As abas de Not�cias ficam sempre todas � vista, sem barra de rolagem.',
    ],
  },
  {
    date: '23/11/2026',
    destaques: [
      'Nova se��o M&A, com mapa do Brasil e opera��es com fonte',
      'HP 12C calcula o CET a partir do fluxo colado do Excel',
      'C�mbio Futuro reorganizado: opera��o, mesa e resultado por vencimento',
      'Cart�es de Setores carregam fotos adaptadas � largura da tela',
      'Painel mais leve: not�cias e calculadoras carregam ao abrir',
    ],
    items: [
      'A se��o M&A traz mapa do Brasil, filtros e detalhes com fontes de cinco opera��es de dezembro de 2025. A cobertura � hist�rica e parcial. No computador, fica depois de Setores. No celular, fica em Mais.',
      'A tela Novidades da semana voltou ao menu Mais e re�ne as mudan�as do Painel por dia. O menu continua aberto quando Setores termina de carregar.',
      'Mercado reaproveita o c�lculo do c�mbio acumulado. As not�cias por tema e cada calculadora carregam quando voc� as abre.',
      'A busca reaproveita as fontes j� consultadas ao reabrir. Em Configura��es, o bot�o Consultar estado das fontes abre o diagn�stico e mostra os hor�rios de cada coleta.',
      'Os cart�es de Setores carregam fotos adaptadas � largura da tela.',
      'Na HP 12C, d� para colar o fluxo do Excel para calcular o CET, consultar o guia e copiar a fita em formato brasileiro. O teclado tamb�m aproveita a largura da tela na horizontal.',
      'O C�mbio Futuro separa dados da opera��o, taxas da mesa e resultado por vencimento. Cote em Bullet ou Parcelado e veja os pagamentos em reais sem redigitar os dados.',
      'No C�mbio Futuro, a TIR em reais passou a contemplar opera��es de prazo curto em que o c�lculo anterior deixava o resultado em branco.',
      'Quando as duas cota��es usadas para converter yuan em reais chegam defasadas, o Painel tenta busc�-las separadamente. A �ltima refer�ncia v�lida continua na tela at� haver dados compat�veis.',
      'O resultado executivo do BNDES mostra a data correspondente � taxa CDI usada na compara��o.',
      'Em Recupera��o Judicial, a data da �ltima edi��o fica vis�vel acima do filtro e o recorte de novembro inclui as edi��es conferidas at� 23/11.',
    ],
  },
  {
    date: '22/11/2026',
    destaques: [
      'Seis calculadoras de cr�dito no mesmo roteiro: Demanda, Encargos e Resultado',
      'Central BNDES com nova apresenta��o do resultado',
      'Gr�fico de pagamentos soma as parcelas selecionadas',
      'Capital de Giro com busca de pra�a, car�ncia e parcelas flex�veis',
    ],
    items: [
      'Comparador de Cr�dito, Conta Garantida, An�lise de Desconto, Finame Materiais, FINIMP e Empr�stimo Externo (4131) passaram a seguir tr�s etapas. Demanda re�ne o que o cliente precisa, Encargos detalha o custo e Resultado mostra quanto entra e quanto se paga.',
      'Na central BNDES, o resumo separa resultado financeiro e condi��es da opera��o. � poss�vel pesquisar produtos, s�ries e pra�as, editar o cronograma em grade ou texto e consultar as parcelas em cart�es no celular.',
      'O Finame ganhou gr�fico de pagamentos, resumo para e-mail e refer�ncia de mercado. No gr�fico de fluxo, arrastar sobre as parcelas soma o principal, os juros e o total do trecho. O �ltimo m�s tamb�m fica vis�vel no celular.',
      'No Capital de Giro, o prazo inicial passou a 36 meses e o gr�fico de juros acompanha o prazo informado. D� para buscar a pra�a pela cidade, escolher a frequ�ncia dos pagamentos, pagar juros na car�ncia, usar parcelas flex�veis e informar o fee em reais ou em percentual. O envelope no resultado abre o resumo curto para e-mail.',
      'A HP 12C continua acess�vel pelo menu. O bot�o flutuante permanente saiu da tela.',
    ],
  },
  {
    date: '21/11/2026',
    destaques: [
      'HP 12C com fita de opera��es e tela cheia',
      'C�mbio Futuro com resumo da trava cambial para copiar',
      'Novos programas no Podcast',
    ],
    items: [
      'A calculadora RPN ganhou fita de opera��es ao vivo, janela flutuante e modo de tela cheia. No computador, o hist�rico aparece ao lado do teclado.',
      'No C�mbio Futuro, a trava cruzada separa as cota��es de cada moeda. Os valores das parcelas ficaram formatados para leitura e o resumo da opera��o pode ser copiado.',
      'O Capital de Giro passou a mostrar a demanda, os encargos e a composi��o do custo no resultado. Ao fim da simula��o, o gr�fico da curva DI serve de refer�ncia de mercado.',
      'O cat�logo de podcasts recebeu Daily Fin e the news, capas oficiais e ordena��o pelo epis�dio mais recente.',
      'Os rel�gios no computador ganharam bandeiras. No modo Apresentar, voltar de Dados para Resultado leva o slide de volta ao topo.',
    ],
  },
  {
    date: '20/11/2026',
    destaques: [
      'Calculadora financeira HP 12C (RPN) no menu',
      'C�mbio Futuro compara at� cinco parcelas',
    ],
    items: [
      'O menu ganhou a calculadora financeira RPN, com teclado cl�ssico, conversor de taxas e disposi��o horizontal para o celular deitado.',
      'No C�mbio Futuro, d� para comparar at� cinco parcelas, consultar a refer�ncia � vista junto � cota��o da mesa e abrir um exemplo para apresenta��o. A opera��o em d�lar fica separada da escolha de trava em euro ou yuan. Quando muda a data em S�o Paulo, � preciso informar as cota��es da mesa para o novo dia.',
      'Bandeiras passaram a identificar moedas na p�gina inicial e pares no Mapa de Varia��o. O C�mbio Futuro tamb�m passou a exibir a refer�ncia indicativa em d�lar.',
      'Ao entrar uma nova vers�o do app, a publica��o preserva os dados j� coletados no site. A coleta segue nos hor�rios habituais.',
    ],
  },
  {
    date: '19/11/2026',
    destaques: [
      'Nova calculadora C�mbio Futuro: d�lar, euro e yuan',
      'Simulador de caixa da Reforma Tribut�ria',
      'Calculadoras agrupadas por finalidade; Comparador com at� cinco opera��es',
      'Menu reorganizado em Acompanhar, Consultar e Aprender',
    ],
    items: [
      'A calculadora C�mbio Futuro passou a comparar d�lar, euro e yuan por vencimento, mostrar o fluxo de caixa e calcular a TIR em reais e o c�mbio necess�rio para uma meta.',
      'Em Reforma Tribut�ria, o simulador estima o efeito de CBS, IBS e Imposto Seletivo no caixa. H� exemplo completo para o Simples, reserva m�s a m�s e hip�teses edit�veis para os anos seguintes.',
      'As calculadoras foram agrupadas por finalidade. Os dados da necessidade do cliente podem ser reaproveitados entre telas, e o Comparador aceita de uma a cinco opera��es, inclusive uma cota��o individual para enviar por e-mail.',
      'O Comparador organiza opera��es por categoria, ajusta o CDI autom�tico ao prazo na curva DI e coloca a aplica��o financeira ao lado das alternativas de cr�dito.',
      'Dividendos via Empr�stimo passou a comparar a efici�ncia de quatro formas de pagamento e a destacar a mais favor�vel para os par�metros da simula��o.',
      'No Finame Materiais, custos, cota��o e parcelas ficaram agrupados. Na �rvore de Cr�dito, a triagem de alongamento passou a reavaliar a capacidade de pagamento ao mudar prazo ou valor e a distinguir as op��es de reembolso.',
      'A consulta autom�tica de c�mbio acompanha o preg�o brasileiro, inclusive os feriados da B3. A se��o Not�cias ganhou curadoria de economia e Aprender passou a explicar ambidestria em gest�o.',
      'O menu passou a manter Juros ao lado de Cen�rios e a organizar Mais em tr�s grupos: Acompanhar, Consultar e Aprender. Mercado Hoje se adapta � largura da tela e o gr�fico de Faturamento preserva os r�tulos da borda direita.',
      'Ao reabrir o app com a sess�o lembrada, o acesso por e-mail volta a conferir a situa��o atual do usu�rio.',
    ],
  },
  {
    date: '18/11/2026',
    destaques: [
      'Nova se��o Podcast',
      'Novas calculadoras: Dividendos via Empr�stimo e CDI x D�lar',
      'Faturamento compara receita e endividamento',
      'Visual �nico nos temas claro e escuro',
    ],
    items: [
      'A se��o Podcast ganhou cat�logo e reprodutor para ouvir os programas dentro do Painel.',
      'Entraram as calculadoras Dividendos via Empr�stimo, para empresas no lucro real, e CDI x D�lar, com CDI preenchido pelo Painel, gr�fico comparativo e aviso quando uma taxa parece ter sido digitada como fra��o.',
      'No BNDES, Finame Ve�culos e BNDES Giro ganharam op��es de apresenta��o. A calculadora Finame reuniu TLP, Taxa LCD e TFBD, passou a mostrar taxas mensais e organizou a cota��o e a lista de parcelas. Tamb�m � poss�vel consultar os custos admitidos por produto e programa.',
      'Faturamento passou a comparar receita e endividamento no per�odo, mostrar 12 meses e alavancagem e gerar uma an�lise autom�tica. A imagem exportada re�ne gr�fico e quadros de 12 meses em 1920 � 1080.',
      'Na �rvore de Cr�dito, o endere�o direto abre a triagem por necessidade do cliente e oferece at� tr�s possibilidades. O bot�o do CNPJ leva ao comprovante oficial da Receita.',
      'Mercado, Juros, Cen�rios, BNDES, Setores, Bancos, Aprender, Not�cias, Feriados e calculadoras ganharam um padr�o visual comum nos temas claro e escuro. O cabe�alho concentra navega��o, pessoas online e situa��o dos dados. As calculadoras ganharam seta para voltar e as proje��es identificam os bancos pelos logotipos.',
      'A p�gina inicial abre pelos indicadores de mercado, com destaques para a maior e a menor alta mensal. Nas not�cias, os filtros passaram a reconhecer mais termos de setores e insumos, ampliar a cobertura de madeira e eliminar repeti��es.',
      'O modo Apresentar saiu do menu principal. A fila de publica��o tamb�m mudou para evitar que uma coleta agendada cancele a chegada de uma nova vers�o.',
    ],
  },
  {
    date: '17/11/2026',
    destaques: [
      'Nova se��o Faturamento',
      'Manchetes nos gr�ficos de c�mbio',
      'Celulose entra em commodities',
      'Capital de Giro com IOF autom�tico, CET e Bullet',
    ],
    items: [
      'A nova se��o Faturamento aceita a tabela do DAC, inclusive com barras, e marca os meses do per�odo com total e varia��o.',
      'Nos gr�ficos de d�lar, euro, iene e yuan, os marcadores das maiores altas e baixas mostram manchetes do dia. No d�lar, o filtro elimina mat�rias que apenas mencionam a moeda. Uma fonte lenta de manchetes deixou de travar a atualiza��o do Painel.',
      'Juros passou a abrir pelos gr�ficos, com o detalhe no centro da tela. Os gr�ficos ganharam op��o de ampliar e as proje��es passaram a incluir Banco do Brasil e Bradesco. O Focus passou a mostrar a data de publica��o do boletim.',
      'Setores ganhou explica��es e imagens por atividade. Celulose entrou na lista de commodities com dados de exporta��o do Comex Stat.',
      'No modo Apresentar, � poss�vel montar slides por sele��o e incluir Faturamento e not�cias sobre madeira.',
      'Capital de Giro ganhou IOF autom�tico, CET e opera��o Bullet, com pagamento �nico no vencimento. A p�gina inicial das calculadoras passou a exibir o aviso de que a �rea est� em constru��o.',
    ],
  },
  {
    date: '16/11/2026',
    destaques: [
      'Compara��o executiva do Finame abre pela conclus�o',
      'Focus volta a ser buscado se a coleta falhar',
    ],
    items: [
      'A compara��o executiva do Finame passou a abrir pela conclus�o e a caber na tela sem barra de rolagem interna.',
      'Se a coleta semanal do Focus deixar de disparar, o Painel volta a procurar o boletim automaticamente.',
    ],
  },
]
