# Google Trends em Mercado hoje

Subaba de Notícias após Eleições EUA. Feed oficial https://trends.google.com/trending/rss?geo=BR, separado dos termos selecionados no Explore. Até três destaques classificados pelo título; a ausência de correspondência aparece como ausência, sem completar com assuntos aleatórios. Classificação por palavras pode exigir revisão contextual.

## Atualização

`pages.yml`: `0 11,18 * * *`, diariamente às 08h e 15h America/Sao_Paulo (UTC−3). GitHub Actions pode atrasar o início e a publicação. A coleta não garante atualização exatamente nesses horários.

As execuções exclusivas de Trends primeiro baixam e validam as demais bases publicadas; abortam se não puderem preservá-las. Os demais coletores são pulados. O hash de cada arquivo preservado é conferido após o build. Nos deploys horários o snapshot Trends anterior é reaproveitado. Pushes e execuções manuais também consultam o RSS para permitir publicação inicial. Erros conservam os itens e `generatedAt` original; `checkedAt` registra só a tentativa. Nunca existe data de coleta válida fabricada.

## Histórico incorporado e limite da automação

A API oficial segue em alpha com acesso restrito, reconferido em 07/11/2026: https://developers.google.com/search/apis/trends . Não foi criado acesso nem usada API não documentada, scraping de endpoints internos, proxy ou chave de terceiros. A coleta estruturada e o armazenamento automático das séries continuam pendentes de aprovação no programa oficial; o RSS não fornece esses dados.

Como entrega parcial, os cinco grupos agora exibem o gráfico oficial incorporado do Explore, com os três termos de cada grupo comparados em conjunto e períodos móveis de 3 ou 12 meses. O recurso oficial é documentado em https://support.google.com/trends/answer/4365538?hl=pt-BR . Em 07/11/2026 foi conferida na interface a opção **Incorporar > Manter os dados atualizados**, seu código `renderExploreWidget("TIMESERIES", ...)` e o endereço do iframe gerado `/trends/embed/explore/TIMESERIES`. A URL mantém país BR, todas as categorias, Pesquisa na Web e fuso de Brasília. Apenas o grupo selecionado carrega, em um iframe de origem Google isolado do código do painel; trocar grupo ou período substitui o gráfico anterior. O código do painel não lê os dados do gráfico nem os cookies do Google; o iframe pode usar os próprios cookies conforme as políticas do navegador.

O próprio Google consulta a série quando o gráfico é aberto. Isso não constitui coleta às 8h/15h, banco de dados local ou garantia de atualização. O painel mantém o link Explore sempre disponível e informa que não consegue validar conteúdo de outra origem: o evento `load` não é tratado como comprovação de dados. Bloqueios de rede, verificações, cookies ou indisponibilidade podem impedir a exibição. Não há repetição automática de consultas nem contorno de restrições.

O gráfico comparativo de Crédito e caixa foi aberto e inspecionado no navegador, com capital de giro, crédito empresarial e inadimplência, Brasil e últimos 90 dias. O Google solicitou uma verificação interativa, concluída, antes de mostrar o gráfico; isso reforça que disponibilidade não é garantida. Essa observação não certifica todas as dez combinações ao vivo. O Explore clássico já exibe aviso de substituição pela nova interface: se o Google alterar a incorporação, o link oficial continua sendo a alternativa, e a integração deve ser revista.

O Google documenta o RSS de Em alta em https://support.google.com/trends/answer/3076011?hl=pt-BR . A agenda existente desse feed não foi alterada.

## Arquivo local preservado

Três snapshots vieram da PR268, commit `613e2137aff8ef32cb2bc9f25db913256934c175`, cuja transcrição foi registrada como leitura do navegador da sessão autorizada em 03/11/2026 13h32–13h33 BRT: capital de giro, BNDES e taxa Selic, separadamente, Brasil, Pesquisa na Web, todas as categorias, últimos três meses. Não houve nova captura histórica nesta integração. `src/trendsSnapshot.js` conserva os valores diários de 03/08 a 02/11/2026 UTC; o dia 03/11 parcial foi excluído. As escalas são independentes e os gráficos não devem ser usados para comparar volumes absolutos. Os zeros originais são preservados; não representam necessariamente ausência de buscas. O arquivo fica recolhido, com sua data e período fixo explícitos, independente do seletor do gráfico incorporado.

Custos e reforma não têm arquivo local. Todos os grupos incluem termos sugeridos e uma pergunta comercial marcada como hipótese. Os índices dos gráficos incorporados são relativos ao recorte, não volumes absolutos; zero pode indicar volume insuficiente e o último período pode ser parcial.

## Integração e testes

A integração preserva as atuais subabas Moedas e Veículos pesados. A busca local indexa a descrição estática e abre Notícias › Google Trends; o RSS não é tratado como manchete jornalística da janela de 120 horas. Configurações registra o estado e a data do RSS, inclusive nos fins de semana. O painel considera a coleta atrasada após 25 horas e distingue a ausência de assuntos relacionados da ausência de coleta válida.

`node --test test/trends.test.mjs test/trends-ui.test.mjs test/weekly-data.test.mjs` cobre classificação, datas, retenção, ausência de dados inventados, preservação integral e falha isolada de outra fonte antes de qualquer escrita. Confere as dez combinações de grupo/período, os termos codificados, a substituição de um único iframe, cliques repetidos e fallback visível mesmo sem RSS. `scripts/smoke-trends.cjs` usa RSS e iframe simulados somente no teste, em 390, 1280 e 1440 px, cobrindo grupos, períodos, arquivo recolhido, estados vazio/atrasado/indisponível e largura. Seu sucesso não comprova disponibilidade ao vivo do Google.

A tentativa de consulta real ao RSS durante esta integração não foi concluída: o ambiente local retornou `ENOTFOUND` (DNS) e o leitor web não renderiza XML. Isso não é evidência de falha do RSS. O coletor deverá ser conferido na primeira execução autorizada em ambiente com rede, mantendo a mensagem de indisponibilidade se não houver coleta válida.

Na conferência local de 06/11/2026, os testes próprios de Trends e a verificação de lint passaram. O ensaio visual não foi concluído: o Edge de teste encerrou durante o lançamento, antes de abrir a página. Não foram obtidas capturas válidas. O smoke está preparado para execução no CI; a execução e a inspeção visual ainda precisam ser confirmadas antes de atestar o layout.

Em 07/11/2026, `npm ci`, os 1.249 testes, lint (sem erros, cinco avisos preexistentes) e build passaram. O navegador disponível não alcançou o servidor local (`ERR_CONNECTION_REFUSED`); não foi apresentada essa tentativa como aprovação visual do painel. A inspeção do gráfico oficial foi separada da validação de layout, ainda a confirmar nas capturas do CI.

Na sequência, o [CI do candidato `974bbef`](https://github.com/FernandoCastilho/painel-especialista/actions/runs/42367197348), já integrado à revisão de acessibilidade `eb5319c`, concluiu testes/build e todos os smokes com sucesso. Foram 1.252 testes locais nessa composição. Capturas de integração do Trends e do arquivo local, em celular e desktop, foram inspecionadas; o iframe dos smokes é simulado e não certifica a disponibilidade real do Google. Qualquer composição posterior precisa passar novamente no CI antes do merge.
