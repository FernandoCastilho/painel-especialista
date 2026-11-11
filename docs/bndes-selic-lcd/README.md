> Nota de integração (05/11/2026): este documento preserva o relatório do candidato isolado. No Painel integrado, os caminhos de código partem da raiz do repositório. O teste de auditoria foi relocado para cotacoes/test/bndes-lcd-cap-independent.test.mjs, mudando apenas o import relativo. Os comandos e caminhos de logs originais abaixo são históricos; a verificação consolidada está em docs/INTEGRACAO-2026-11-05.md. Não foi executada coleta externa nem publicado o candidato.

# BNDES Selic capitalizada + LCD

Candidato isolado em 05/11/2026. Não publicado. Não altera Finame/TFC nem incorpora o motor TFB de reconciliação anterior.

## Entrega

- Nova rota `#calculadora/bndes-selic-lcd` na lista de calculadoras.
- Selic capitalizada no saldo; remunerações e LD1 exigíveis nos vencimentos, com base 252 dias úteis.
- Amortização = principal atualizado / número de amortizações ainda não vencidas. Não presume prestações em reais constantes.
- Fluxo completo e gráfico do saldo, somente com cenário de Selic constante explicitamente fornecido pelo usuário, cronograma completo e entradas confirmadas.
- LD1 no catálogo, CSV e gráficos; atalhos para 143, LD1 e comparação, com unidades distintas.
- Ausência não se converte em zero. Taxas zero só entram quando fornecidas explicitamente.

## Fontes e distinções

Fonte: Anexo IV da Circular SUP/ADIG 13/2022, versão consultada de 24/06/2026, seção 5 (LCDCAP) e seção 8 (amortização):
https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/04-22Cir13-Anexo-IV-Condicoes-a-Serem-Observadas-na-Contratacao.pdf

143 é o código BNDES da moeda contratual SELIC ACUM. D-2. É índice acumulado, não 143% nem código SGS do BCB. D-2 corresponde a dois dias úteis.

LD1 é a sobretaxa LCD para operações indiretas, fixada na contratação. Atualizações trimestrais valem para novas contratações; não mudam o contrato simulado. O endpoint oficial foi confirmado pela consulta BNDES e o arquivo de nove registros foi lido em 05/11/2026 às 14:52 UTC. A última vigência, 01/10/2026, tem valor **−0,110000% a.a.** O sinal negativo é preservado. O código incorpora somente esse snapshot público datado. A consulta automática continua deliberadamente desabilitada (`automaticCollectionEnabled = false`), pendente de revisão de segurança e termos, mesmo com a URL validada; não há tentativa de rede LD1 no fluxo padrão. A calculadora requer percentual contratado, data de vigência, fonte e confirmação. O snapshot oferece a última vigência não posterior à contratação, mas nunca para datas anteriores à primeira observação ou posteriores à cobertura de 05/11/2026. A referência não reprecifica contratos. Metadados explícitos de fonte validada, data de captura e cobertura acompanham os pontos.

O fator de Selic contratual usa o produto das taxas diárias anuais D-2, base 252. A razão simples entre índices 143 não é implementada: além da precisão de seis casas, a comparação do pesquisador identificou possível deslocamento da data de aplicação. Histórico contratual exige calendário completo e série diária própria. O modo histórico permanece bloqueado.

TLP exigível tem método distinto (seção 1 do Anexo IV) e não é implementada ou alterada por este pacote. O componente deixa essa diferença explícita. Finame, TFC e os candidatos TFB anteriores permanecem separados.

## Contrato de entrada

O motor `src/bndesLcdCap.js` aceita exclusivamente `mode: 'projection'`. Principal em centavos inteiros; percentuais como strings, até 12 casas; origem e confirmação para LD1 e cronograma. LD1 negativa é permitida. Soma líquida exigível negativa continua bloqueada como caso não suportado, sem presumir como seria seu tratamento contratual. Não há taxas comerciais padrão.

A tela recebe um evento por linha: `AAAA-MM-DD; dias úteis; C ou A`. C indica carência com cobrança de juros fixos; A também amortiza o saldo corrigido pelo número de amortizações restantes. As datas já devem estar ajustadas pelo contrato. O motor rejeita datas inválidas, sábados/domingos, ordem incorreta, DU superiores aos dias de segunda a sexta possíveis, retorno à carência, horizonte sem quitação e entradas ausentes. Não certifica feriados locais/bancários ou a elegibilidade e os limites do produto.

O cenário explícito de Selic constante implica fator `(1 + Selic/100)^(DU/252)`. A soma BNDES + intermediação + agente + LD1 entra no fator fixo. O componente fixo é cobrado; não é capitalizado silenciosamente.

IOF (11/11/2026, lacuna apontada pela revisão independente): escolha na tela entre **Zero (recursos BNDES/FINAME elegíveis)**, padrão; **PJ geral** (0,0082% ao dia); e **Simples/MEI** (0,00274% ao dia até R$ 30 mil, com confirmação do enquadramento), mais 0,38% de adicional sobre o valor, pelas regras compartilhadas de `iofRules.js`. O IOF diário incide sobre o principal de cada amortização (sem a Selic capitalizada no saldo), pelos dias corridos da liberação até o vencimento, com teto de 365 dias. Tudo é cobrado na liberação e sai do valor líquido do CET, nas duas linhas (parte fixa e custo projetado). Juros e parcelas não mudam e seguem em dias úteis/252. Cálculo em `src/bndesProfileIof.js`, arredondado uma vez em centavos.

A alíquota zero cita o Decreto 6.306/2007, art. 8º, IX, que o painel usa para recursos FINAME. **Não foi conferido se esse inciso alcança a linha Selic + LCD fora do FINAME**; o enquadramento depende da origem dos recursos e o painel não o verifica. A tela avisa isso no campo, na ajuda e nos avisos do resultado.

Não há seguros, liberações múltiplas ou Price. Tarifa na liberação e CET (Res. CMN 4.881/2020) foram acrescentados depois; IOF conforme acima. Campos não suportados são recusados pelo motor, em vez de ignorados. A tela avisa as exclusões.

## Precisão

Trata-se de projeção, não certificação contratual. O saldo corrigido e os juros exigíveis são arredondados por evento a centavos. No caso exato de 252 DU, o cálculo de saldo e juros usa BigInt racional, com arredondamento para cima no empate. Amortizações usam divisão racional inteira. Em expoentes fracionários usa-se aritmética Number, `log1p`/`expm1` para juros e bloqueio conservador perto do meio centavo escalado pelo saldo. Isso evita casos identificados na auditoria; não é uma prova universal de arredondamento da memória do BNDES.

A auditoria identificou e foi corrigido um caso de erro de 1 centavo em valores próximos do limite técnico, uma data inválida em referência LD1 e contagens DU impossíveis/fim de semana. Consulte o parecer independente.

## Verificações

Resultados finais e cobertura estão em `focused-tests.log`, `audit/` e no relatório de integração. ESLint focado e build Vite offline foram executados.

Comando focado, sem rede, Python, servidor, socket ou navegador:

```
node --test test/bndes-lcd-cap.test.mjs test/lcd-series.test.mjs test/moedas.test.mjs test/bndes.test.mjs test/bndes-view.test.mjs test/bndes-route.test.mjs test/validate-bndes.test.mjs test/csv-spread.test.mjs test/multi-series.test.mjs test/finame-materiais.test.mjs test/global-search.test.mjs ../audit/independent-lcdcap.test.mjs
```

A suíte global não foi executada: há fixture Python previamente fora do escopo autorizado. Não foi executado teste visual; não houve preview, servidor, socket ou publicação. Build aprovado não é validação visual nem validação contratual.

## Integração

O arquivo `selic-lcd.patch` é relativo à raiz que contém `cotacoes/`, sobre o snapshot de produção em `painel-reconcile-cloud-20261105/production-snapshot`. As cópias individuais alteradas estão em `changes/`. Não substitua o aplicativo inteiro quando consolidar outras entregas.

Sem dependências novas. Use Node.js 24 e dependências já presentes. Preserve alterações independentes em `Calculadora.jsx`, `Bndes.jsx`, `build-search-index.mjs` e os catálogos ao aplicar o patch. Refaça o índice gerado com o build final consolidado; `searchContent.generated.json` não acompanha o patch para não sobrescrever entradas de outros trabalhos.

A URL, o esquema e os nove pontos históricos foram validados. O mecanismo automático LD1 só deve ser ativado após revisão das permissões, segurança e termos e testes próprios. Não basta trocar a flag para verdadeiro: a política do snapshot também precisa ser revisada para não mascarar novas referências. Nenhuma taxa de teste deve entrar em `public/moedas.json`.
