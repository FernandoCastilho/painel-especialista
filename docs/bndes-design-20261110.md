# Cotação BNDES: implementação visual aprovada

Base: claude/obsidian-plugin-analysis-bagjz3 859cfa78497b9e392d04b389efd93fb740e66d6f, 10/11/2026. Escopo: apresentação do workspace e formulário Finame. Nenhum motor financeiro, fonte, regra ou valor padrão foi alterado.

## Critérios e evidências

- Cabeçalho marinho, abas claras/laranja, grupos Operação/Custos/Pagamento, perfil e apresentação no topo: implementados; revisão de pixels pendente das capturas do CI.
- Tabela simples com referência, taxa final, primeira parcela após carência, juros, IOF e total. Comparação TFC/TFB somente quando solicitada e validada. Sem resultado, traços e instrução bloqueante, nunca valores inventados.
- Campos livres de valor, participação, prazo e carência preservados. Seletores de porte, amortização, periodicidade e composição conservam todas as opções e callbacks anteriores.
- FGI abre percentual e financiamento do ECG; IOF exige confirmação. Liberação 30/90, datas/fontes, CDI+, alertas e perfis TLP/LCD preservados.
- Revisão de direção e simplificação feita com a referência e componentes reais; revisão visual final ainda pendente.
- `npm test`: 1.725 aprovados; `npm run lint`: zero erros, cinco avisos preexistentes; `npm run build`: aprovado.
- Navegador local não iniciou por restrição de socket do ambiente; navegador conectado não alcançou o servidor local. Testes reais de interface e capturas devem ser concluídos no CI antes de aceitar a mudança.

Análise de impacto: reutiliza diagnóstico amplo registrado em `analise-completa-2026-11-10.md`; inspecionados workspace, Finame, apresentação, CSS, testes e pipeline. Não foi refeita leitura integral de toda a base. Sem dependências novas, migrações ou alteração de segurança. Publicação continua sujeita ao workflow e gates existentes, conforme `publicacao-e-calendario.md`; draft PR não é implantação.

## Revisão das primeiras capturas reais

CI 42880241916 aprovou os oito cenários do workspace (quatro larguras, dois temas), apresentação, navegação e preservação do estado. A inspeção dos pixels identificou herança de cores inadequada no tema escuro e quebra de centavos em celular. Corrigidos tokens de cor no workspace e nos perfis filhos, valores indivisíveis com rolagem local e Pagamento em uma coluna a 320 px. Removido título duplicado do resultado, alinhada a base dos campos de Operação e a ordem de teclado de Custos. Atualizados seletores antigos dos testes e abertura explícita do cronograma recolhido. Auditoria independente não encontrou alteração do motor, mas condicionou a aprovação às novas capturas. Reforçados testes de alvo de ajuda 44 px e total com ECG financiado/à vista. Ainda aguarda CI da versão corrigida; não é liberação de produção.

## Conferência final e campo monetário móvel

CI 42881291973 aprovou os cinco trabalhos no head d2e5be4625439002106d78c86c2d6923d89e9d34. A revisão adicional identificou que o campo Valor, em duas colunas a 320 px, ocultava visualmente os centavos mesmo preservando o valor e os cálculos. A auditoria reviu a aprovação para exigir correção antes da publicação. O campo passa a ocupar a linha inteira até 600 px, sem mudança no motor ou nos dados. O smoke agora confere valor padrão e R$ 1.234.567,89 com campo desfocado em 320/390 px nos dois temas, mede a largura disponível e salva capturas próprias. Esta correção aguarda novo CI e revisão visual; nenhum gate foi alterado.
