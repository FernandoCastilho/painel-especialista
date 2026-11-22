# Instrução para o ChatGPT/Codex: roteiro 1 · 2 · 3 nas seis calculadoras de crédito

Cole este texto inteiro no ChatGPT (Codex), com acesso ao repositório `FernandoCastilho/painel-especialista`.
Faça **esta** tarefa primeiro e, depois, a do BNDES (`docs/bndes-instrucao-chatgpt-2026-11-22.md`).

---

Você vai trabalhar no repositório `FernandoCastilho/painel-especialista`, no painel em `cotacoes/` (React + Vite).
Leia antes o arquivo `CLAUDE.md` da raiz e siga as regras dele. Escreva textos de tela, comentários e commits em português do Brasil.

## Objetivo

Publicar, num PR em rascunho, o novo visual ("roteiro") de seis calculadoras de crédito.
**O trabalho já está feito e conferido** no ramo `claude/lucid-keller-3uwb0d`, até o commit `166d773`. A sua tarefa é **trazê-lo para cima da versão publicada atual**, resolvendo conflitos, sem refazer nem reinventar nada.

As seis calculadoras:
1. Conta Garantida (`ContaGarantida.jsx`)
2. Análise de desconto (`AnaliseDesconto.jsx`)
3. FINIMP (`FinimpComparacao.jsx`)
4. BNDES Finame Materiais (`FinameMateriais.jsx`, `BndesWorkspace.jsx`)
5. Necessidade do Cliente / comparador de crédito (`CreditComparison.jsx`, `comparadorRoteiro.js`)
6. Empréstimo 4131 (`Emprestimo4131.jsx`)

O padrão, já aprovado por Fernando em 21/11/2026:
- **Roteiro em três blocos:** 1 Demanda, 2 Encargos, 3 Resultado. Não há linha do tempo.
- **Valor padrão:** R$ 3 milhões. Já está publicado; não mexa nisso.
- **Tela limpa:** toda explicação fica dentro do "?". Erros, alertas de dados e a linha de arredondamento ficam visíveis.
- **Composição do custo:** o percentual de cada parte.
- **Referência de mercado:** o gráfico vai como último bloco. Pré = curva DI x pré; pós = CDI futuro; câmbio = moeda da tela.

## Como trabalhar (obrigatório)

1. **Ramo:** parta da versão publicada `claude/obsidian-plugin-analysis-bagjz3` e crie `codex/seis-calculadoras-roteiro`.
2. **Arquivos:** traga do ramo `claude/lucid-keller-3uwb0d` (commit `166d773`) **somente** estes:
   - telas e estilos:
     - `cotacoes/src/ContaGarantida.jsx`, `AnaliseDesconto.jsx`, `AnaliseDesconto.css`, `FinimpComparacao.jsx`
     - `FinameMateriais.jsx`, `BndesWorkspace.jsx`
     - `CreditComparison.jsx`, `CreditComparison.css`, `comparadorRoteiro.js`
     - `Emprestimo4131.jsx`, `Emprestimo4131.css`, `ExpandablePanel.jsx`, `Calculadora.jsx`
     - `CalcPattern-4131.css`, `CalcPattern-analise-desconto.css`, `CalcPattern-comparador.css`, `CalcPattern-conta-garantida.css`, `CalcPattern-finimp.css`
     - `CalculatorPattern.css`, `CalculatorTheme.css`
   - testes: `cotacoes/test/` `analise-desconto-roteiro`, `analise-desconto-view`, `comparador-roteiro`, `conta-garantida-roteiro`, `conta-garantida-ui`, `credit-comparison-ui`, `emprestimo-4131-roteiro`, `finame-iof-ui`, `finame-roteiro`, `finimp-presentation` e `finimp-roteiro` (`.test.mjs`)
   - conferências de tela: `cotacoes/scripts/` `smoke-bndes-workspace`, `smoke-credit-comparison`, `smoke-discount-iof`, `smoke-emprestimo-4131`, `smoke-finimp-help`, `smoke-finimp` e `smoke-published` (`.cjs`)
   - notas: `docs/calculadoras-roteiro-2026-11-21.md`, `docs/analise-desconto.md`, `docs/comparador-credito.md`, `docs/emprestimo-4131.md`, `docs/finimp-comparacao.md` e as fotos `docs/calculadoras-roteiro/*-antes-depois-*.png`, menos as `giro-*`
3. **NÃO traga e NÃO altere** o que já foi publicado depois:
   - Capital de Giro e peças comuns: `CapitalDeGiro.jsx`/`.css`, `giroConta.js`, `giroEmail.js`, `Roteiro.jsx`/`.css`, `LinhaMestra.jsx`/`.css`, `linhaMestra.js`, `ReferenciaMercado.jsx`/`.css`, `Curves.jsx`, `faixaCurva.js`, `centavosDaTela.js`, `FluxoPagamentos.jsx`/`.css`, `fluxoPagamentos.js`
   - a busca de praça por cidade (PR #564) e os testes `giro-*`
   - **Mantenha sempre a versão publicada desses arquivos.** As seis telas usam essas peças; se alguma chamada não bater, ajuste a **tela**, nunca a peça.
4. **Conferências com trechos do Giro:** `smoke-calculadora.cjs`, `smoke-calculator-layout.cjs` e `smoke-apresentar.cjs` têm trechos do Giro, que já mudaram na versão publicada. **Mescle à mão:**
   - nos trechos do Giro, fique com a versão publicada;
   - nos trechos das outras telas, traga do ramo `claude/lucid-keller-3uwb0d`.
5. **Diferenças de interface:** a peça `ReferenciaMercado` publicada aceita `prazoMeses` (opcional; sem ele, a curva pré vai de 12 a 48 meses) e a ajuda virou função da faixa. As seis telas devem chamar `<ReferenciaMercado tipos={[...]} />` **sem** `prazoMeses`, para ficar 12 a 48 meses, como combinado.
6. **Regenere o índice de busca:** o `npm run build` regenera `cotacoes/src/searchContent.generated.json`; inclua no commit.
7. **Rode e deixe tudo passando, dentro de `cotacoes/`:**
   - `npm test`
   - `npm run lint` (0 erros)
   - `VITE_DATA_BASE=http://127.0.0.1:<porta> npm run build`, servindo `dist` nessa porta. Sem o `VITE_DATA_BASE`, as conferências de câmbio falham por falta das cotações de teste.
   - todas as conferências: `smoke-calculadora`, `smoke-credit-comparison`, `smoke-emprestimo-4131`, `smoke-finimp`, `smoke-finimp-help`, `smoke-bndes`, `smoke-bndes-profiles`, `smoke-bndes-workspace`, `smoke-discount-iof`, `smoke-apresentar`, `smoke-global-search`, `smoke-published`, `smoke-theme`, `smoke-calculator-layout`
   - Variáveis: `SMOKE_BASE_URL=http://127.0.0.1:<porta>`, `SMOKE_CHANNEL=chromium` e, se precisar, `CHROMIUM_PATH`.
8. **Testes:** não mude números esperados. Se um teste quebrar só por seletor ou texto de tela, ajuste o seletor e explique no PR.
9. **PR em rascunho** contra `claude/obsidian-plugin-analysis-bagjz3`. **NÃO junte e NÃO publique**: outro agente confere às 6h02 de 23/11/2026, e a publicação depende do Fernando.

## O que NÃO fazer

- Não mudar regra de cálculo (taxa, IOF, CET, cronograma).
- Não mudar o Capital de Giro.
- Não trazer as peças do Giro (fluxo de pagamentos, e-mail curto, flex) para as seis telas. Só o BNDES ganha o fluxo e o e-mail, na outra instrução.
- Não colocar explicação solta na tela; vai no "?".
- Não usar dado real de cliente.
- Campos de busca, se aparecerem, aceitam digitar para filtrar (premissa do Fernando).

## Entrega

PR em rascunho com:
- a lista do que veio do ramo e de cada conflito resolvido, com o porquê;
- o resultado de testes, lint, montagem e das 14 conferências de tela;
- fotos de cada uma das seis telas (computador e celular).
