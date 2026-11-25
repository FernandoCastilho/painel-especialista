# CDC · pendências (25/11/2026)

Calculadora CDC (`#calculadora/cdc`) reconstruída da planilha de CDC de Fernando. Estado: primeira versão.

## 1. Diferença no IOF sobre parcelas (em aberto)
- Caso da planilha: 500.000,00 liberado, tarifa de cadastro 2.523,00, 48x, carência 30 dias, 1,55% a.m., liberação 25/11/2026.
- Planilha: IOF sobre PMT R$ 14.341,35 · IOF total R$ 16.250,94 · parcela R$ 15.473,20.
- Painel (regra legal já usada no Capital de Giro: 0,0082% ao dia sobre a amortização, limite 365 dias):
  IOF sobre parcelas R$ 14.243,60 · IOF total R$ 16.153,19 · parcela R$ 15.470,14.
- O IOF adicional (0,38% sobre liberado + tarifas = R$ 1.909,59) e o cronograma batem com a planilha.
- Para fechar: a fórmula da célula "IOF Sobre PMT" da planilha.

## 2. Taxa com casas escondidas
- A planilha mostra 1,55%, mas os juros dela fecham com 1,550042% a.m. A taxa deve vir de outra conta (ver item 4).

## 3. Fora desta versão
- Retorno, Vl Retorno, Spread, Taxa net, Score revenda, Plataforma, F5 (dependem de tabelas do sistema).
- Nº proposta, CNPJ raiz, gerente (dado de cliente: não entram no painel).

## 4. Tabela FUNDING (guardada para depois, ainda sem uso na conta)
Estrutura: prazo em meses (linhas) × taxa a.a. e taxa a.m. (colunas), por semana de vigência. Mais a linha SELIC.

| Prazo | a.a. 11/11–18/11 | a.a. 19/11–25/11 | a.m. 11/11–18/11 | a.m. 19/11–25/11 |
|---|---|---|---|---|
| 6 | 13,68% (célula: 13,6779%) | 13,80% | 1,07% | 1,08% |
| 9 | 13,96% | 14,12% | 1,09% | 1,11% |
| 12 | 14,20% | 14,37% | 1,11% | 1,13% |
| 18 | 14,58% | 14,77% | 1,14% | 1,15% |
| 24 | 14,85% | 15,04% | 1,16% | 1,17% |
| 36 | 15,19% | 15,35% | 1,19% | 1,20% |
| 42 | 15,28% | 15,44% | 1,19% | 1,20% |
| 48 | 15,44% | 15,58% | 1,20% | 1,21% |
| 60 | 15,60% | 15,73% | 1,22% | 1,22% |
| 72 | 15,72% | 15,84% | 1,22% | 1,23% |
| SELIC | 14,75% | 14,75% | 1,15% | 1,15% |

- Taxa a.m. = taxa a.a. convertida por juros compostos (13,68% a.a. → 1,07% a.m.).
- Hipótese a confirmar: taxa do cliente = funding do prazo + spread (o campo "Spread 4,00" da planilha). Não aplicada.
- Fernando vai mandar outras partes à medida que a calculadora for evoluindo.
