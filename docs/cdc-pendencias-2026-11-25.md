# CDC · pendências (25/11/2026)

Calculadora CDC (`#calculadora/cdc`) reconstruída da planilha de CDC de Fernando. Estado: primeira versão.

## 1. Diferença no IOF sobre parcelas
Decisão de Fernando (25/11/2026): vale a regra legal (Decreto 6.306/2007, art. 7º), conferida na compilação da Câmara; IOF sempre financiado; taxa digitada. Entrou também o Simples/MEI até R$ 30 mil (0,00274% ao dia). A isenção do art. 9º, VI (automóvel até 127 HP) ficou de fora: vale só para táxi e pessoa com deficiência (art. 72 da Lei 8.383/1991).
- Base do IOF adicional (decisão de Fernando, 25/11/2026): 0,38% sobre o valor financiado já com o próprio IOF. No exemplo: R$ 1.971,21 (a planilha, sem o IOF, dá R$ 1.909,59). Resultado do exemplo: IOF total R$ 16.216,55, parcela R$ 15.472,03 (planilha: R$ 16.250,94 e R$ 15.473,20).
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

## 4. Tabela FUNDING (decisão de Fernando, 25/11/2026)
- Não fica no código nem no repositório. O usuário cola as células do Excel no "!" ao lado do "?" da calculadora; a tabela fica só na aba do navegador (sessionStorage) e some ao fechar.
- Formato: prazo em meses | taxas a.a. por vigência ("dd/mm até dd/mm") | taxas a.m. | linha SELIC (ignorada). Só as colunas ao ano entram na conta.
- Spread composto: (1 + taxa a.a.) = (1 + funding a.a.) × (1 + spread a.a.). Entre prazos, interpolação linear; fora da tabela, a ponta. A tela aceita a taxa (mostra o spread) ou o spread (mostra a taxa); a conta se inverte exatamente.
- O spread não vai para o e-mail nem para a imagem do WhatsApp.

## 5. Ajustes de 25/11/2026 (pedido de Fernando)
- Saíram: ano modelo, zero km, perfil de IOF (sempre PJ geral), liberação (agora "Data da simulação", sempre hoje), tarifa de avaliação, registro de contrato e os três seguros.
- Resultado: "Resultado Simulação", só com o IOF total.
- E-mail em arquivo do Outlook (.eml) e imagem para o WhatsApp, os dois com avisos de cotação indicativa.
