# Análise completa do Painel do Especialista (10/11/2026)

Revisão só de leitura, feita por quatro frentes em paralelo: código, dados e conexões, design e usabilidade, gráficos. Nada no painel foi alterado. Este documento junta os achados e propõe a ordem de ataque.

## Resumo

| Frente | Nota | Em uma frase |
|---|---|---|
| Código | 7,5 | Base sólida e bem testada; organização e "validade" de regras fixas pedem cuidado |
| Dados e conexões | 7,0 | Coleta cuidadosa e honesta na tela; histórico sem cópia e alertas com buracos |
| Design | 6,5 | Identidade "terminal" boa, mas três estilos visuais convivendo |
| Usabilidade | 6,0 | Base acessível; excesso de interrupções e resultado das calculadoras escondido |
| Gráficos | 6,5 | Bom componente central; erros de leitura no celular e nos eixos |

Saúde conferida hoje: o painel monta, 1.654 testes passam, conferência de estilo sem erro (5 avisos), nenhuma falha de segurança conhecida nas dependências.

## O que já é bom (manter)

- Cotações com régua de segurança: nunca troca dado novo por velho, marca "Dado antigo" e "Último válido".
- Cálculo separado da tela, com muitos testes; nenhuma chave ou senha no código que vai ao navegador.
- Contraste, teclado e toque bem cuidados; nenhuma tela com rolagem lateral no celular.
- Comparação de moedas em variação %, seleção de trecho contra o mesmo trecho do ano anterior, tabela embaixo de cada gráfico.
- Tela Bancos, estudos setoriais ("Perguntas para a empresa", "Roteiro de visita") e modo apresentação do Finame.

## Prioridade 1: erros que enganam ou travam o uso (horas a poucos dias)

1. **Celular: tocar no gráfico mostra o dia errado.** O balão mostra o primeiro ponto, não o tocado, e sai cortado na borda (`HistoryChart.jsx:205, 285`). Conferido em captura.
2. **Eixo corta o sinal negativo.** Emprego formal mostra "500.000" onde é −500.000 (`HistoryChart.jsx:19, 228`). Conferido em captura.
3. **Calendário da B3 só existe para 2026.** Em 01/01/2027 as curvas de juros param de atualizar e as contas de dias úteis da praça B3 ficam sem cobertura (`src/holidays.js:67, 245`; `scripts/data-schedules.mjs:3-17`). É de propósito (não inventa feriado), mas não há lembrete.
4. **Cotação parada no pregão só avisa o dono depois de 6 horas** (`quotes.yml:56`, `validate-lib.mjs:27`). A tela avisa o usuário, mas o responsável demora a saber.
5. **Não está confirmado se os alertas chegam a alguém.** Dependem de um endereço do Teams guardado nas configurações do GitHub; o envio ignora falha. Precisa de um teste real.
6. **Uma oscilação de rede pode publicar o painel sem o Focus** e zerar o histórico de 52 semanas até a segunda seguinte (`scripts/prev-lib.mjs:8-19`).
7. **Versão nova com o painel aberto.** Quem deixa aberto o dia todo e clica numa aba não visitada depois de uma publicação cai em "Não foi possível exibir esta tela"; só recarregar resolve (`main.jsx:19-23`, `sw.js:3`).
8. **Finame trava se a taxa do BNDES não carregar.** Botão apagado, motivo longe e nenhum campo para digitar a taxa (`FinameMateriais.jsx:166, 202`). Mexe em entrada de taxa: precisa de autorização.
9. **Resultado do Finame nasce escondido.** Depois de calcular aparece uma caixa "Cotação comparativa" vazia; taxa final, parcela e total ficam dentro de um bloco fechado (`FinameMateriais.jsx:213, 223`). Conferido em captura.
10. **Três pop-ups antes do primeiro dado e mais um por hora** (Aviso, Conceito do dia, Panorama). Risco de cobrir a tela no meio de uma reunião.

## Prioridade 2: melhora clara de uso (dias)

- **Busca só dentro do mascote.** No celular fica no fim da página; quem oculta a coruja perde a busca. Colocar lupa fixa no topo.
- **Cabeçalho quebra em duas linhas** justamente quando as cotações estão em dia (selo largo empurra a aba "Aprender").
- **Primeira tela do Mercado empilha avisos**; a tabela de câmbio começa quase fora da tela. No celular, a variação do mês exige rolar e deslizar.
- **Calculadoras com formulário longo**: botão principal a cerca de 2.000 px do topo; no Comparador o resultado aparece abaixo e a tela não se move. Resumo fixo com 4 números resolve.
- **Gráfico do Comparador de Crédito não informa nada** (linhas sobrepostas, sem eixo de valores). Trocar por barras do custo total por modalidade.
- **Comparador: números alinhados à esquerda** e opção mais barata sem destaque; mensagem de erro com contraste baixo (2,7 para mínimo de 4,5).
- **Eixos dos gráficos**: Selic "Desde 1999" com eixo até −20; marcas sem números redondos; datas mensais com dia inventado; SOFR sem ano; buraco no intraday vira reta inclinada; projeção com a mesma cara de dado realizado.
- **Curvas de juros**: 7 cores, duas quase iguais. Usar uma cor forte para hoje e degradê para datas antigas.
- **Minigráficos do topo**: cor da linha contradiz a seta de alta/queda.
- **Mapa do conhecimento e mapa de recuperação judicial**: bonitos, mas ilegíveis (236 pontos e 582 ligações; 74 blocos). Abrir em lista ou já focado.
- **Notícias espalhadas em três lugares** e ausentes na página do setor. Buscar "agro" não acha o setor; "Apresentar" e "Setores" têm catálogos diferentes.
- **Mascote ocupa 174 px de largura** em todas as telas do notebook.
- **Tela "Base de dados" diz fonte errada** para o intradiário (Yahoo; o código usa AwesomeAPI) e a documentação de horários está desatualizada.
- **Alerta de dado velho olha 6 de cerca de 35 arquivos**; petróleo, commodities, IPCA e outros podem ficar dias parados sem aviso ao dono. Projeções manuais (09/10 e 21/10) aparecem sem aviso de idade.
- **Navegador de cada usuário consulta a AwesomeAPI direto a cada 10 min.** Muitos colegas na mesma rede do banco dividem a cota gratuita (bloqueio já registrado). Manter só o botão "Atualizar agora".
- **Uma única proteção de erro para o app inteiro**: defeito num quadro secundário derruba a tela toda, inclusive calculadora preenchida.

## Prioridade 3: modernização (semanas)

| Proposta | Ganho | Custo e risco | Recomendação |
|---|---|---|---|
| Separar "atualizar dados" de "publicar o site" (dados num ramo próprio, com cópia do histórico) | Histórico das curvas com cópia; falha num coletor ou num teste de tela não congela os dados | Sem custo em dinheiro; 1 a 2 semanas; mexe no caminho de todos os arquivos | **Fazer. Maior retorno** |
| Um único componente de gráfico próprio | Corrige toque, eixos e datas em todas as telas de uma vez | 1 a 2 semanas; sem peso extra | **Fazer** |
| Sistema visual único (tamanhos, espaços, 5 componentes-base) e duas "roupas" com regra: mesa (terminal) e cliente (claro) | Acaba a sensação de três aplicativos; hoje há 120 tamanhos de letra e 265 cores soltas | Semanas, tela a tela | **Fazer aos poucos** |
| Navegação em 5 grupos (Mercado, Cenários, Crédito, Setores, Aprender) | Menos escolhas; hoje são 10 abas mais 10 sub-abas | Dias; muda hábito dos usuários | Fazer com teste antes |
| Conferência de faixa para CDI, Selic, PTAX, SOFR e curvas antes de publicar | Número absurdo da fonte não chega à tela nem às calculadoras | Dias; faixa apertada demais barra dado bom | Fazer com faixas largas |
| Painel de saúde das fontes | Um lugar que mostra o que está em dia e o que atrasou | Dias | Fazer |
| Lista única de taxas e alíquotas com fonte, "conferido em" e aviso de vencimento | Decreto novo não passa despercebido | Dias; só organiza, não muda regra | Fazer |
| Primeira abertura mais leve (hoje 778 kB; cerca de 250 kB dá para adiar) e calculadoras carregadas uma a uma | Abre mais rápido no celular | Dias | Fazer |
| Camada própria para servir cotações (ex.: Cloudflare Worker) | Cotação em 1 a 2 min, sem depender da cota por navegador | Conta nova e possível gasto; a rede do banco pode bloquear | Só com autorização e teste na rede do banco |
| Biblioteca de gráficos pronta (TradingView, ECharts etc.) | Zoom e arrasto | Perde teclado, leitura por voz e a comparação com ano anterior; TradingView exige logotipo | **Não fazer** |
| Reescrever tudo em TypeScript, trocar roteador, banco de dados próprio, armazenamento pago | Pequeno para este porte | Semanas e risco em cálculo | **Não fazer** |
| React 19 | Pequeno | 33 testes dependem de um detalhe interno que mudou | Adiar; antes, modernizar os testes de tela |

## Pontos que pedem decisão do Fernando

- **Regra de cálculo.** Há dois jeitos de fazer conta com dinheiro (centavos inteiros nas calculadoras novas do BNDES; valores quebrados nas antigas) e o IOF está repetido em três arquivos. Pode haver diferença de centavos entre calculadoras; não foi medida. Unificar muda regra: exige autorização e revisão independente.
- **Termos de uso das fontes, a confirmar com jurídico**: Banco do Japão (declarado "uso não comercial"), Yahoo Finance, Google Tradutor, manchetes via Google Notícias, Forex Factory, taxas da B3 pelo site, quadro da TradingView, redistribuição da AwesomeAPI.
- **Dados que saem para terceiros**: nenhum dado de cliente sai sozinho, mas o endereço de rede de cada usuário vai a cerca de 8 serviços; link colado em "Apresentar" vai ao microlink.io; o contador de audiência é público.
- **Custo**: as rotinas são gratuitas enquanto o repositório for público. Se virar privado, a estimativa é de mais de 15 mil minutos por mês, o que passa a custar.
- **Nome do ramo principal**: o ramo principal do repositório chama-se `claude/obsidian-plugin-analysis-bagjz3` (não existe `main`), embora `pages.yml:5` cite os dois. Funciona, mas o nome confunde; renomear é decisão do Fernando.
- **Dado a conferir na fonte**: histórico do dólar com pontos em domingos (18/10 e 08/11) e salto de 4,96 para 5,37 entre 23/10 e 26/10.

## O que foi conferido

- Montagem, testes, conferência de estilo e dependências rodados nesta data.
- Capturas de tela em notebook, tablet e celular, temas claro e escuro (cerca de 600 imagens), olhadas pelos revisores; os defeitos 1, 2 e 9 e a pilha de avisos foram conferidos de novo na consolidação.
- Trechos de código citados nos itens 3 e 7 e o gatilho da conferência automática foram relidos na consolidação.

## O que não deu para conferir

- **Dados reais de juros, curvas, notícias e BNDES**: o ambiente de análise não acessa as fontes. Essas telas foram vistas vazias ou com números de teste; os achados valem para o desenho, não para os valores.
- Se os alertas do Teams chegam e a quem; histórico real de falhas e minutos gastos nas rotinas.
- Aparelho físico (iPhone, Android), leitor de tela real, projetor e tempo de resposta.
- Diferença real de centavos entre calculadoras; se os valores de referência dos testes batem com fontes oficiais.
- Termos de uso lidos nos sites das fontes (só o que o repositório documenta).
- Calculadoras FINIMP, Conta Garantida, Capital de Giro, Desconto e CBS não foram percorridas como tarefa; parte dos 165 coletores foi lida só em parte.
