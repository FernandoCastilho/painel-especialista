# BNDES executivo — implementação e verificação
data_criacao: 2026-11-22

## Entrega
Implementação da reorganização executiva da seção BNDES sobre 3ed91b3, incluindo Simular, comparação, apresentação, taxas/históricos, custos por produto, TLP exigível, Selic + LCD e conferência histórica. O roteiro Demanda, Encargos, Resultado da versão atual foi preservado.

O resultado possui duas colunas em desktop: resultado financeiro e condições da operação. CET, total, parcelas e despesas têm um único lugar no resumo. Referência exibe série, taxa, fonte, data e estados manual/retido. CDI-base e data aparecem na equivalência. Dados comuns continuam presentes na comparação e no diálogo.

Detalhamentos usam abertura local em vez de múltiplos maximizadores. Cronogramas próprios têm grade e opção de texto, conservando os parsers originais, inclusive recusas de texto inválido. Em celular, linhas do cronograma viram cartões com todos os controles visíveis. Taxas mostram data completa junto à série. Busca de praça reutiliza o componente existente; há pesquisa de séries e produtos.

## Limites preservados
Nenhum arquivo de motor financeiro, taxa, CET, IOF, FGI, calendário ou projeção foi alterado. E-mail, fluxo de pagamentos, curvas, rotas e temas continuam disponíveis. TLP/LCD não herdam dados do Finame. Veículos e Giro continuam variantes de apresentação do estado atual, sem regras inventadas.

## Evidências locais
- 354 testes BNDES/Finame/painel expansível/layout/praça: aprovados.
- Lint: zero erros; cinco avisos preexistentes em Calendario.jsx, Curves.jsx e SeriesHistory.jsx.
- Build: aprovado; aviso preexistente de tamanho de bundle.
- smoke-bndes-executivo: oito combinações de 320/390/768/1440 px × claro/escuro; referências, não duplicação, apresentação, foco, preservação de estado, buscas, cronogramas e ausência de transbordamento da página.
- smoke-bndes-workspace: oito combinações de largura/tema, incluindo comparação, FGI, parcelas, foco, ajuda e alternância de áreas.
- smoke-bndes-profiles: dez cenários (TFB histórico e TLP × 320/390/768/1024/1440), incluindo 34 parcelas, caixa, projeção negativa e bloqueios.
- Capturas e relatórios locais em docs/bndes-executivo-qa. Imagens integrais podem registrar a barra fixa no meio da captura; viewports reais TLP 320/390 mostram a posição normal do rodapé.
- A suíte integral também foi executada no Windows e apresentou casos incompatíveis com caminhos POSIX/ambiente e fixtures. Não é relatada como aprovada localmente. A aprovação integral requer o CI Linux da candidata; consultar o SHA e os checks do PR.

## Revisões separadas
Revisor de código independente: achados sobre condições ausentes no comparativo e preservação de linhas vazias foram corrigidos com regressões RED/GREEN; parecer final sem impedimentos, 347 testes conferidos pelo revisor. Simplificação/ponytail: sem excesso estrutural relevante. Foi usado o revisor de código da sessão como alternativa ao Simplificador central, não disponível.
Diretor de Arte: inspecionou 30 capturas reais e aprovou o escopo visual após correções de contraste, data móvel, grade móvel e recuo. Parecer em bndes-executivo-revisao-arte.md. O parecer não certifica cálculos, CI, acessibilidade integral ou publicação.

## Publicação
Somente via PR no ramo canônico, CI e fluxo GitHub Actions do projeto. Esta nota não comprova instalação. A conclusão exige marcador público do SHA certo e navegação verificada na versão publicada, depois da autorização aplicável.
