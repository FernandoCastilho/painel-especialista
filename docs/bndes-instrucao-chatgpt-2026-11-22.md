# Instrução para o ChatGPT/Codex: BNDES Finame com as peças do Capital de Giro

Cole este texto inteiro no ChatGPT (Codex), com acesso ao repositório `FernandoCastilho/painel-especialista`.

---

Você vai trabalhar no repositório `FernandoCastilho/painel-especialista`, no painel em `cotacoes/` (React + Vite).
Leia antes o arquivo `CLAUDE.md` da raiz e siga as regras dele. Responda e escreva textos de tela, comentários e commits em português do Brasil.

## Objetivo

Levar para a calculadora **BNDES Finame Materiais** (`cotacoes/src/FinameMateriais.jsx`, rota `#calculadora/finame-materiais`) três peças que já existem e estão publicadas no **Capital de Giro** (`cotacoes/src/CapitalDeGiro.jsx`):

1. Quadro **Fluxo de pagamentos**: barras mês a mês, com seleção por arrasto que soma os valores.
2. **Envelope de e-mail**: abre um rascunho no Outlook com o endereço curto.
3. **Referência de mercado** conforme o custo escolhido, com a curva terminando no prazo da operação.

Não mude nenhuma regra de cálculo. Taxa, IOF, CET, cronograma, carência e TAC ficam exatamente como estão. As peças novas só **mostram** o que a conta do BNDES já calcula.

## Como trabalhar (obrigatório)

- Faça esta tarefa **depois** da instrução das seis calculadoras (`docs/seis-calculadoras-instrucao-chatgpt-2026-11-22.md`).
- Parta do ramo dela, `codex/seis-calculadoras-roteiro`, que já traz o roteiro novo do BNDES Finame, e crie `codex/bndes-pecas-do-giro`.
- Abra o pedido (PR) **em rascunho** contra `codex/seis-calculadoras-roteiro`, para a revisão mostrar só as peças do BNDES.
- Se a tarefa das seis não existir, parta da versão publicada `claude/obsidian-plugin-analysis-bagjz3` e abra o PR contra ela.
- **NÃO junte e NÃO publique.** A conferência será feita por outro agente às 6h02 de 23/11/2026, e a publicação depende do Fernando.
- Mude o mínimo em `FinameMateriais.jsx`: acrescente blocos e não reorganize o que já existe. Amanhã cedo outra entrega mexe no roteiro visual (blocos 1 · 2 · 3) das calculadoras, inclusive dessa. Mudanças pequenas e localizadas evitam conflito.
- Antes de abrir o PR, rode dentro de `cotacoes/` e deixe tudo passando:
  - `npm test`
  - `npm run lint`, com 0 erros
  - `npm run build`
- As conferências de tela ficam em `cotacoes/scripts/smoke-*.cjs`. Rode pelo menos `smoke-bndes.cjs`, `smoke-bndes-workspace.cjs`, `smoke-bndes-profiles.cjs` e `smoke-calculadora.cjs`. Para montar o painel para essas conferências, use `VITE_DATA_BASE=http://127.0.0.1:<porta> npm run build` e sirva a pasta `dist` nessa porta; sem isso, as conferências de câmbio falham.
- Não apague testes nem conferências. Não mude números esperados de testes existentes. Se um teste antigo quebrar só por causa de texto ou posição de tela, ajuste o seletor e explique no PR.

## Peça 1 · Fluxo de pagamentos (barras + arrasto)

Reaproveite sem copiar:
- `cotacoes/src/FluxoPagamentos.jsx`: o componente `FluxoPagamentos`, com as propriedades `rows` e `inicio`.
- `cotacoes/src/fluxoPagamentos.js`: `fluxoMensal` e `somaDoTrecho`.
- `cotacoes/src/FluxoPagamentos.css`.

O componente espera `rows` no formato do Capital de Giro:
`{ number, date: 'AAAA-MM-DD', payment, interest, amortization, juros: boolean (pagamento só de juros), fixed: false }`,
e `inicio` = data da liberação em `'AAAA-MM-DD'`.

O cronograma do BNDES (`res.parcelas`, de `finameMateriais.js` → `cronograma` e do motor pós-fixado `finamePosFixado.js`) tem outro formato:
`{ mes, vencimento: 'AAAA-MM-DD', parcela, juros, amortizacao, correcao, carencia: boolean, saldo }`.
Na carência sem pagamento no mês, `parcela` é 0.

Crie um adaptador puro e testável, por exemplo `cotacoes/src/bndesFluxo.js`:
```js
// Converte as parcelas do BNDES para o formato do quadro Fluxo de pagamentos. Só apresentação.
export const linhasDoFluxoBndes = parcelas => parcelas
  .filter(p => p.parcela > 0 && p.vencimento)
  .map((p, i) => ({ number: i + 1, date: p.vencimento, payment: p.parcela, interest: p.juros,
    amortization: p.parcela - p.juros, juros: !!p.carencia, fixed: false }))
```
- `amortization` = `parcela − juros`. Nos custos pós-fixados (TLP, LCD, TFBD), isso inclui a correção do saldo. Diga isso no "?" do quadro.
- A data de `inicio` é a data da liberação da tela (`liberacaoText` / `hoje` em `FinameMateriais.jsx`), em ISO.

Onde mostrar:
- Logo **depois** do painel "Cotação da operação" / "Cotação comparativa" (o `ExpandablePanel` com `className="fm-result-workspace"`) e **antes** de "Parcelas da operação".
- Com o roteiro novo, vindo do ramo das seis, o lugar é logo depois do bloco "3 Resultado". A ordem fica: Resultado → Fluxo de pagamentos → parcelas e detalhes → Referência de mercado por último.
- Só quando houver resultado (`res`).
- Com "Comparar com outro custo" ligado (`comparar`), mostre acima do gráfico uma escolha simples entre as alternativas (Opção A · TFC, Opção B · TLP etc.). Use `alternatives[i].result.parcelas`. Abre na opção A.

Explicações só dentro do "?". Isso já vem no componente; acrescente uma frase sobre a correção nos pós-fixados.

## Peça 2 · Envelope de e-mail

Padrão: `cotacoes/src/giroEmail.js` (`giroEmailText`, `giroEmailLink`, `LIMITE_LINK = 2000`) e o componente `EmailEnvelope` em `cotacoes/src/CapitalDeGiro.jsx`. Ele copia o cronograma completo para a área de transferência quando o endereço passaria do limite e mostra um aviso se a cópia falhar.

Crie `cotacoes/src/bndesEmail.js` no mesmo modelo:
- **Assunto:** `BNDES Finame · simulação de R$ X`.
- **Corpo** em três blocos:
  1. RESUMO: linha, valor financiado, prazo, carência, juros na carência (periodicidade), amortização, liberação, CET estimado, custo total.
  2. TAXAS E ENCARGOS: custo financeiro com a taxa, taxa BNDES, spread do agente, taxa final, TAC, IOF. Com comparação ligada, as duas alternativas lado a lado em linhas.
  3. PARCELAS.
- **Endereço:** em até 2.000 caracteres. Se não couber, o corpo leva o resumo das parcelas e o clique copia o cronograma completo, igual ao Giro.
- O motivo do limite: o login da Microsoft recusa endereços longos ("AADSTS90015: Requested query string is too long").
- Coloque o envelope no cabeçalho do painel da cotação, com o mesmo visual do Giro (`a.credit-email`).
  - Ele precisa ser visível no tema claro e no escuro: contraste de pelo menos 3:1 com o fundo debaixo dele.
  - Antes, no Giro, saiu branco sobre fundo claro e foi corrigido usando `var(--bw-link)`.
- No final do corpo: "Estimativas sujeitas à confirmação das condições contratuais. A proposta do agente financeiro prevalece."

## Peça 3 · Referência de mercado conforme o custo

Use `cotacoes/src/ReferenciaMercado.jsx`, com as propriedades `tipos` e `prazoMeses`; a faixa vem de `cotacoes/src/faixaCurva.js`. A regra:
- **TFC ou TFB** (prefixadas): `tipos={['pre']}` e `prazoMeses={prazo}`. A curva DI x pré vai de 12 meses até o prazo da operação.
- **TLP, LCD ou TFBD** (pós-fixadas): `tipos={['pos']}`, o CDI futuro. O painel não tem curva de juro real (IPCA); o `curves.json` só tem `br`, `cc` e `us`. Não invente esse dado.
- **Com comparação entre um pré e um pós:** `tipos={['pre', 'pos']}`.
- Coloque como **último bloco** da tela. O "Histórico dos indexadores" continua onde está.

## Testes que você deve acrescentar

- `cotacoes/test/bndes-fluxo.test.mjs`: o adaptador `linhasDoFluxoBndes`.
  - Meses de carência sem pagamento ficam de fora.
  - Pagamentos só de juros na carência saem com `juros: true`.
  - A soma de `payment` é igual à soma de `parcela` do cronograma.
  - Num caso TLP, `payment − interest` é igual a `parcela − juros`.
- `cotacoes/test/bndes-email.test.mjs`:
  - os três blocos na ordem;
  - endereço com 2.000 caracteres ou menos com 48 e com 120 meses;
  - o cronograma copiado tem todas as parcelas;
  - com comparação, aparecem as duas alternativas.
- Na conferência de tela do BNDES:
  - o quadro "Fluxo de pagamentos" aparece depois da cotação;
  - arrastar no gráfico mostra o balão com "Parcelas", "Juros" e "Principal";
  - o envelope tem endereço com 2.000 caracteres ou menos;
  - a referência de mercado é o último bloco.

## O que NÃO fazer

- Não mexer em `finameMateriais.js`, `finamePosFixado.js`, `iofRules.js`, `giroConta.js` nem em nenhuma regra de cálculo.
- Não mudar o prazo padrão do BNDES (48 meses, 3 de carência). É uma decisão pendente do Fernando.
- Não trazer as parcelas flex do Giro: o BNDES segue o cronograma do contrato.
- Não colocar explicações soltas na tela. Explicação vai sempre no "?".
- Não usar dados reais de cliente.
- Campos de busca, se você criar algum, aceitam digitar para filtrar (premissa do Fernando).

## Entrega

PR em rascunho com:
- o que mudou;
- os testes e conferências rodados, com o resultado;
- 2 fotos da tela do BNDES (computador e celular): a cotação, o fluxo com um trecho arrastado e a referência de mercado.
