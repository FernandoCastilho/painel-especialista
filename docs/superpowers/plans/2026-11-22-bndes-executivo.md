# BNDES executivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Instalar e verificar a seção BNDES reorganizada conforme a proposta visual.
**Architecture:** Componentes de apresentação reutilizam os resultados dos motores existentes. Painéis de detalhe usam revelação progressiva; um único diálogo do resultado mantém foco e restauração de rolagem.
**Tech Stack:** React 18, CSS, Node test, Vite, Playwright.
**Spec:** docs/superpowers/specs/2026-11-22-bndes-executivo.md

## Global Constraints
Sem alteração financeira; manter temas, rotas, e-mail, acessibilidade e dados reais. Preservar três blocos do roteiro atual. Sem publicação direta.

## Review Focus
- Pós-fixadas distinguem custo projetado de parte fixa, inclusive LD1 negativa.
- Referência manual e dado retido conservam taxa e data corretas.
- Diálogos aninhados não perdem estado nem foco.
- Tabelas e valores grandes cabem em 320/390/768/1440 px.
- Alternância das áreas mantém formulário e referências da simulação.

### Task 1: Resultado executivo e apresentação
Files: FinameMateriais.jsx, novo BndesExecutiveResult.jsx/CSS se necessário, BndesWorkspace.jsx, ExpandablePanel.jsx.
- [x] Executar linha de base (limites do Windows registrados).
- [x] Testar comportamento de apresentação, unicidade dos resultados e referências.
- [x] Implementar resumo financeiro/condições com dados reais e detalhe único.
- [x] Verificar TFC, comparação e pós-fixadas; preservação de e-mail/fluxo.

### Task 2: Coesão de todas as áreas e cronogramas
Files: BndesWorkspace.css, BndesCustosProdutos.jsx/CSS, Bndes.jsx/CSS, BndesTlpExigivel.jsx, BndesLcdCap.jsx; grade de cronograma se necessária.
- [x] Organizar família/tabela/gráfico e consulta por produto em duas colunas responsivas.
- [x] Reduzir expansões redundantes em TLP/LCD/histórico e preservar toda a informação.
- [x] Implementar grade de cronograma sem alterar parser e opção de colagem.
- [x] Testar preservação dos formulários e entradas inválidas.

### Task 3: Verificação e entrega instalada
- [x] Executar suíte completa, lint, build e testes de navegador pertinentes (suíte local integral com limites de portabilidade; CI Linux obrigatório).
- [x] Inspecionar capturas reais com Diretor de Arte independente.
- [x] Revisão independente de código e simplificação; corrigir achados.
- [ ] Criar candidata PR, aguardar CI, integrar apenas com autorização válida e verificar marcador público mais navegação.
- [ ] Registrar evidências e pendências reais, sem reduzir o objetivo a um resultado local.

## Registro
- 2026-11-22: ferramenta nativa de worktree não devolveu resultado; execução encerrada e criada worktree Git no espaço autorizado, mantendo a cópia original intacta.
- Mapa de Agentes do vault não acessível nesta sessão; não inferir executores indisponíveis.
