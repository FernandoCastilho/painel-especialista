# Bancos — escopo e operação

## Produto e fluxo
Fernando mantém nove bancos (Itaú, BB, Bradesco, Santander, Caixa, Safra, BTG, ABC e Daycoval); Votorantim/BV foi removido em 2026-11-08, em seção imediatamente após Setores. Objetivo: comparar capital, porte, carteiras PJ/PF e qualidade do crédito. Último período disponível por banco, sem misturar um saldo antigo em trimestre novo. Acrescentam-se ativos, lucro líquido trimestral e ROE. Provisão e inadimplência com total/PJ/PF quando disponíveis, e PJ por porte nos detalhes. Evolução trimestral ou contra o mesmo trimestre do ano anterior, em linha própria por banco; sem nota geral de saúde.

Fluxo: Bancos → escolher base (última divulgação/BC), segmento e referência da evolução → comparar → Detalhes e fontes (painel próprio com fechar/Escape no computador, mantendo a tabela compacta). Bancos nas colunas e indicadores nas linhas, no celular e no computador, com rolagem própria e indicadores fixos à esquerda. Busca limita a lista. Carregamento, erro de rede, falha parcial, dado ausente e busca sem resultados têm mensagens distintas. Nenhum cadastro ou dado pessoal.

## Implementação, dados e design
React/Vite existentes, sem dependências novas. `Bancos.jsx` reaproveita `useDataFile` e atualização do painel; `bancos.js` contém catálogo e comparações. Sem novo banco de dados, login ou serviço pago. Tokens do tema atual preservados; não se trata de template oficial Itaú.

`public/bancos.json` é o snapshot servido ao navegador, versionado como base recuperável. Contém por banco observações BC, transcrições RI, período, origem, métricas com valor/basis/source/note/page e abertura de porte. Valores monetários em reais; apresentação em R$ bi. Índices em percentual, não fração. `bancos-ri.json` guarda somente transcrições verificadas dos documentos identificados, com data de revisão. Relatório Bradesco: documento do emissor em repositório público, explicitamente identificado; não chamar o hospedeiro de site oficial do banco.

O coletor `fetch-bancos.mjs` usa API pública IF.data, tipo 1 (conglomerados prudenciais), relatórios 1, 2, 11, 13, 14 e 16. Descobre a última base com dados para bancos do catálogo; preserva períodos e campos anteriores se uma fonte falhar. Consulta os períodos exatos necessários e retém histórico existente. Falha global sem snapshot anterior impede a escrita. Paginação fora da origem oficial é rejeitada. Não há segredo ou dado privado no coletor.

O fluxo existente do Pages coleta bancos nas execuções regulares. Nas atualizações exclusivas de Focus/Trends, `bancos.json` entra no inventário preservado e verificado. Nenhum cron novo. As transcrições RI **não** se atualizam com a coleta do BC: a interface informa a data da conferência documental e esse limite. Novas divulgações exigem ler o documento e atualizar transcrições, páginas e bases de comparação. Nunca renovar a data de revisão só por executar o coletor.

## Regras e limites
- Comparar somente mesmo indicador, mesma `basis`, origem equivalente e períodos exatos. Não substituir comparação anual por outro trimestre próximo.
- Variação de volume: percentual; variação de índice: pontos percentuais. Base zero/negativa não gera crescimento percentual convencional. Valores que arredondam para zero ficam estáveis.
- Crescimento de carteira ou provisão não recebe classificação automática de melhora. Queda de inadimplência é sinal de melhora daquele indicador; aumento de ROE também. Basileia sobe/cai sem emitir nota geral nem inferir insolvência.
- Carteiras ampliadas, operações contábeis líquidas, valores brutos e SCR são conceitos distintos. Os períodos e critérios de cada indicador ficam explícitos. Segmentos gerenciais podem incluir crédito rural PF ou separar financeira; não são apresentados como classificação CPF/CNPJ pura quando o emissor não o faz.
- Lucro Cosif acumula no semestre: junho/dezembro menos março/setembro isolam o trimestre. Não comparar lucro semestral com trimestral. Lucro contábil difere de recorrente; ROE informado pode ser recorrente/ajustado/excluir ágio. Suplementos de ROE dos cinco bancos com base BC são incorporados somente ao período exato e preservam sua fonte/critério. Safra: IFRS semestral anualizado; Caixa/BV: janela não detalhada no extrato consultado, explicitamente sinalizada, sem comparação de evolução presumida. Não chamar todas as janelas de ROE trimestral.
- Perda esperada é saldo; despesa de PDD é fluxo. Razão de perda esperada contábil usa o bruto das mesmas categorias, não a carteira SCR. A inadimplência arrastada SCR é identificada e não presumida equivalente a toda métrica gerencial >90 dias.
- Ausente não vira zero, nem prova que o banco deixou de divulgar. A tela usa “Não disponível nesta base”. Porte conserva a classificação original. Não estima PF/PJ a partir de mix sem classificação comprovada.

## Matriz de aceitação e verificações
| Requisito | Verificação | Evidência |
|---|---|---|
| Nove bancos e navegação após Setores | Catálogo, rotas e ordem dos menus | `test/bancos.test.mjs`, `nav-order`, `educacao`, `nav-accessibility` |
| Última divulgação sem completar com dados antigos | Seleção por banco e teste de campo ausente em trimestre novo | `test/bancos.test.mjs` |
| Evolução exata e critérios iguais | Trimestre/ano, mudança de perímetro, zero e arredondamento | `test/bancos.test.mjs` |
| Lucro trimestral e provisão com denominador correto | Massa sintética com semestral, primeiro trimestre e categorias brutas/perdas | `test/bancos.test.mjs` |
| Dados reais rastreáveis | Nove códigos únicos, valores finitos, períodos trimestrais e fontes em cada valor | `test/bancos.test.mjs` + documentos citados nos snapshots |
| Interface responsiva e funcional | 390/820/1440 px, claro/escuro, busca, segmento, anual, BC, teclado e vazio | `scripts/smoke-bancos.cjs`; artefato CI `bancos-design` |
| Sem regressão e pacote preservado | Suíte, lint, build e ensaio de preservação semanal | CI `test-build`; `weekly-data.test.mjs` |

Testes locais iniciais: 1.368 passaram; lint sem erros e com cinco avisos anteriores; build concluído. A execução final e as capturas devem ser verificadas no commit efetivamente publicado. Browser local impedido por socket; a primeira captura CI mostrou densidade móvel excessiva, corrigida por blocos responsivos. Isto documenta a revisão e não declara aprovação de capturas posteriores ainda não observadas.

## Publicação e recuperação
Destino existente: GitHub Pages do próprio repositório, pelo fluxo Pages. Não criar Site paralelo. Publicar após verificações relevantes e revisão visual. Snapshot de fonte recuperável pelo histórico Git; em falha de coleta, manter valores/datas anteriores e mostrar aviso. Reverter a alteração por commit de reversão, preservando mudanças posteriores de outras tarefas. Não excluir bases nem recriar o painel.


## Histórico por indicador e destaques (2026-11-08)
A tabela usa ↑ verde para alta, ↓ vermelha para queda e traço neutro para estabilidade. As cores significam direção, não melhora/piora. O bloco final de evolução e botões foi removido; fontes gerais ficam no cabeçalho de cada banco. Clique na linha, célula ou botão acessível do indicador abre histórico, gráfico trimestral, análise e fontes por banco. A série segue a origem e o critério do ponto atual, sem completar lacunas nem unir trimestres ausentes. O seletor troca o banco sem misturar séries. A análise usa o trimestre/ano de referência escolhido e não infere causalidade.

Troféus seguem a opção aprovada por Fernando: menor inadimplência, maior Basileia/retorno/resultado; volumes identificam porte, sem nota geral. Só concorrem valores efetivamente exibidos na maior coorte com ao menos dois bancos de mesmo trimestre, origem e `basis`. O destaque mostra BC/RI, trimestre e X/Y bancos ao lado do troféu; o histórico lista participantes e exclusões. Empates na precisão exibida recebem o mesmo destaque. Sem equivalência documental (inclusive ROE de janelas diferentes), não há troféu; provisão não recebe avaliação artificial. A base BC permite comparar as instituições de mesma metodologia no mesmo período. Buscar um único banco não cria vencedor automático.

Verificações adicionadas: `test/bancos-history.test.mjs` cobre lacunas, origem, critério, período, ausência, empates, provisões, porte, ROE e interpretação de risco. O smoke Bancos verifica setas, retirada do bloco final, troféus com universo explícito, histórico por teclado/célula, fontes, retorno de foco e seis cenários de tela.


## Compactação e identificação (2026-11-08)
A identificação do banco usa logotipo local e botão «i» ao lado do nome, com alvo44px; trimestre na segunda linha. Origem, fontes e porte continuam no painel aberto pelo botão. O cabeçalho dispensa texto de origem e o link «Fontes» separado. Troféu aparece junto do valor; período, grupo e participantes ficam exclusivamente no histórico. A regra de comparabilidade permanece inalterada. Catálogo/coleta, snapshot, seletores e contagens ativos passam a nove bancos, sem BV.

Compactação por espaçamentos e larguras, preservando o tamanho das letras e os alvos44px. Indicadores/unidades no mesmo botão e seta de abertura inline. Logotipos obtidos dos sites oficiais/RI, hospedados no próprio painel; fontes documentadas em `public/bank-logos/README.md`. Não dependem de serviço externo de logos no navegador.
