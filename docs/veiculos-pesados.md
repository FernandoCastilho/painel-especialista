# Veículos pesados no Painel Especialista

## Escopo e posição

Setores > Produção e consumo > Veículos pesados. A aba em Mercado hoje > Notícias foi retirada em 24/11/2026, a pedido de Fernando, junto com Eleições EUA. O setor inclui todos os caminhões das classes ANFAVEA e ônibus; caminhões pesados são apenas uma subcategoria. Não inclui comerciais leves, máquinas nem implementos. Não modifica o conceito Boletim Focus publicado na PR 288.

## Indicadores e fonte

Publicação primária: https://anfavea.com.br/site/conteudos/carta-da-anfavea/ . Conferência de 04/11/2026: a última edição indicada é outubro/2026, Carta 485, resultados de setembro/2026. PDF https://www.anfavea.com.br/cartas/carta485.pdf , página 3. A fonte é uma associação setorial, não um órgão governamental. A Central de Dados identifica Renavam/Senatran como fonte de emplacamento e ANFAVEA para produção e exportação em unidades: https://anfavea.com.br/site/central-de-dados/ .

Seis indicadores: emplacamento, exportação e produção, separados entre caminhões e ônibus. Valores mensais, mês anterior, mesmo mês do ano anterior, acumulados do ano e variações publicadas. Contagens exibidas em milhares na Carta são aproximadas (símbolo ≈); o painel não simula precisão nem recalcula percentuais sobre números arredondados. Exemplo verificado: produção de caminhões, setembro/2026, aproximadamente 11,6 mil; -1,3% no mês, +15,0% contra setembro/2025 e -6,4% no acumulado do ano. Ônibus exportados no mês: 354 unidades, número não arredondado na fonte.

Notas: dados sujeitos a revisão. A Central informa inclusão de estimativas para produção de empresas não associadas a partir de 2026. Não se mistura a série com números da Fenabrave ou de jornais. Indicadores têm periodicidade mensal; as notícias são da janela móvel de sete dias e não constituem indicador estatístico.

## Coleta e preservação

Coletor lê a página pública da Carta e o PDF publicamente vinculado, com identificação do projeto; não usa autenticação, API privada nem o formulário interno da Central. A tentativa de consulta ao formulário foi abandonada após resposta não aceitável; não houve contorno. A consulta HTTP identificada ao PDF e à página funcionou. O servidor compara hash do PDF e confere diariamente nos dias úteis, reaproveitando a última consulta por 24 horas. Usa a dependência pypdf 6.1.3 já declarada pelo projeto. Não redistribui o PDF, imagens, marca ou layout; somente indicadores numéricos agregados, com atribuição e referências no catálogo existente. Não foi localizada licença de API nem alegada autorização para acesso a áreas restritas.

A extração valida seis grupos, referência, edição, integridade do PDF, contagens não negativas, precisão de arredondamento e coerência das variações com os intervalos dos números arredondados. Percentuais de produção têm ordem diferente no fluxo textual do PDF; o mapeamento foi conferido visualmente na página 3. Mudança incompatível de formato, falta de biblioteca, HTTP não OK ou referência anterior preserva os números e a data de extração válida, com aviso. Última conferência é um relógio separado e não muda o mês de referência. Se não existir histórico válido, não exibe zeros fictícios. O processo não garante que todo futuro layout seja reconhecido: falha fechada e exige revisão.

O arquivo heavy-vehicles.json entra no inventário de retenção semanal, na Base de dados, governança e busca global. A consulta semanal exclusiva do Focus preserva o arquivo inteiro; não executa a coleta. A instalação da biblioteca de leitura não autoriza novas fontes de juros nem altera as condições do BoJ.

## Validação

Testes unitários cobrem extração conferida, ordem dos percentuais, arredondamento, falhas, TTL, hash, origem, referência futura, duplicidade e notícias econômicas versus acidentes. Smoke de navegador cobre as duas posições, último item da aba Notícias, busca, seis cartões, retenção, indisponibilidade e ausência de transbordamento em 390, 820 e 1280 px. Os títulos fictícios dos smokes são marcados QA; não são publicados. Em coleta real separada, três consultas RSS responderam e cinco matérias foram selecionadas; a coleta normal de temas alimentará a nova chave.

O conteúdo foi preparado para revisão antes de publicação. Nenhuma disponibilidade na versão pública é alegada por este documento sem deploy confirmado.
