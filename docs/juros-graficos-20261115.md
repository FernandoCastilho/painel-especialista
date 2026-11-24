> **Reconciliação posterior de 15/11/2026:** a composição principal foi restaurada para tabelas Brasil/exterior, CDI futuro e curvas; gráficos seguem acessíveis pelas linhas. A documentação abaixo descreve a proposta anterior, não o estado final aprovado. A busca não recuperou revogação do pedido literal de 22/10/2026: “coloque [...] antes dos gráficos [...] num formato de tabela, e que apareça na tela”. Mantidas melhorias compatíveis no detalhe: leitura descritiva, tabelas e fontes. Testes de interface antigos não foram enfraquecidos para aceitar remoção das tabelas. Validação de navegador da reconciliação ainda depende da nova execução do CI.

# Juros: gráficos prioritários — 15/11/2026

Implementação local, não publicada. Pedido: gráficos na tela principal, detalhe com tendência e tabelas, preservando indicadores, fontes e cálculos.

- Brasil: Selic, CDI, CDI futuro, DI x pré, cupom cambial.
- Exterior: SOFR, €STR, Fed, BCE, Japão, Treasuries e curva soberana euro AAA.
- Reutiliza gráficos e modelos existentes. Grade responsiva e botões acessíveis de detalhe; clique no gráfico também abre, sem interceptar controles.
- Detalhe de referências: leitura descritiva (variação entre observações, sem previsão), filtros e tabela histórica do indicador escolhido.
- Detalhe das curvas: gráfico e tabela por prazo; cupom mantém leitura existente. CDI futuro mantém tabela por horizonte e ressalva de precificação implícita, não previsão garantida.
- Falhas e dados defasados continuam explícitos; ausência não vira zero.
- Sem mudanças em motores financeiros ou fontes.

Verificação: 28 testes focados e suíte integrada com 1.982 testes passaram. Build aprovado. Lint sem erros, 2 avisos preexistentes em Curves.jsx. Revisão visual/interação real em navegador ainda pendente; não afirmar responsividade renderizada ou publicação.
