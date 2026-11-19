# Finame Materiais: correção de textos e fontes (18/11/2026)

Só texto e fonte. Nenhuma conta, taxa, limite usado em cálculo ou bloqueio mudou.

## O que mudou na ficha

1. **Teto de R$ 20 milhões por operação.** Antes, o Painel dizia que o teto vinha de terceiros (Observatório da Indústria RS, Fomento Paraná, CNI) e "não consta na página oficial". Agora cita a norma: Circular BNDES 14/2022, item 6.2.2, com a redação da Circular SUP/ADIG 64/2023. A página do produto continua sem repetir o teto (conferido hoje), e a ficha diz isso. O aviso acima de R$ 20 milhões segue como aviso: não bloqueia o resultado.
2. **"Novos" saiu.** A norma fala em "bens industrializados, de fabricação nacional" (itens 2.3 e 5.5.1). A palavra "novos" aparece na Circular para máquinas e equipamentos, não para materiais. Corrigido em `REGRAS.itens` e na dica do campo "Valor dos materiais". "Usados na atividade" virou "empregados na atividade econômica", como na norma, para não confundir com bem usado.
3. **Nota fiscal no reembolso.** Novo item na ficha (`REGRAS.notaReembolso`, só texto): nota eletrônica ativa, de saída, emitida para o CNPJ do cliente (raiz do CNPJ: matriz e filiais), nunca usada em outro financiamento do BNDES; venda ou entrega de bem vendido (venda para entrega futura não serve; vale a nota de remessa); itens com NCM e CST/CSOSN aceitos. Valor financiável = produto + IPI + ICMS-ST − descontos. A regra dos 12 meses antes do protocolo já estava certa e não mudou.
4. **Fontes.** A entrada antiga (teto + itens + nacionalização, com link do Observatório) virou quatro: Circular 14 (teto e itens), página do produto e Circular 14, item 5.5.2 (nacionalização), validações de notas 2026, e Anexo I da Circular 13, versão de 21/08/2026 (chaves das notas, inclusive de remessa; dinheiro ao cliente ou, por ordem dele, ao fornecedor).
5. **Novidades** de 18/11/2026 registram a mudança, sem resumo na semana (ajuste de texto).

Arquivos: `cotacoes/src/finameMateriais.js`, `cotacoes/src/FinameMateriais.jsx`, `cotacoes/src/Novidades.jsx` e o índice de busca gerado no build (`cotacoes/src/searchContent.generated.json`).

## Fontes reabertas em 18/11/2026

- [Circular BNDES 14/2022 consolidada](https://www.bndes.gov.br/wps/wcm/connect/site/0992576f-dd8a-46e3-bcd0-b1ca9a007a01/22Cir14+BNDES+Finame.pdf?MOD=AJPERES&CVID=pR0sh1Y): item 6.2.2 (R$ 20 milhões por operação e R$ 150 milhões por cliente em 12 meses, redação da Circular 64/2023, de 27/10/2023); itens 2.3, 5.5.1 e 5.5.2.
- [Validações na Consulta NFe e no PL, versão 2026](https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/Validacoes-na-Consulta-e-PL-FINAME-Materiais-Industrializados-v2026.pdf): itens 1.a (12 meses, raiz do CNPJ, nota ativa e de saída, nota não usada antes), 1.b (NCM/CST; CFOP de venda; venda para entrega futura recusada, nota de remessa aceita), 2.a.ii (valor financiável) e Anexo I (lista de CFOPs).
- [Anexo I da Circular 13, versão de 21/08/2026](https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/01-22Cir13-Anexo-I-Procedimentos-Operacionais20260821.pdf): itens 9.1.3 e 6.16.1.2.
- [Página do produto](https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados): reembolso de 12 meses antes do protocolo; R$ 150 milhões por cliente; não mostra o teto por operação.

Pesquisa de origem: `docs/arvore-credito-regras-produtos.md`, seções 3.10 a 3.13, que está no ramo `ccr-11f656ed-o4xxgz` e ainda não chegou ao ramo principal.

## Conferências

- `npm test`: 2.100 testes passando.
- `npm run build`: concluído.
- `npm run lint`: 0 erros; 5 avisos antigos em `Calendario.jsx`, `Curves.jsx` e `SeriesHistory.jsx`, fora desta mudança.
- Tela aberta no navegador: a ficha mostra a Circular 14, o item da nota fiscal e a dica sem "novos"; não aparece mais "não consta na página" nem "Observatório"; sem erro na página.

## Escolhas e ressalvas

- A data "Regras do produto conferidas em 04/11/2026" ficou como está: hoje só foram reconferidos teto, itens, reembolso e nota fiscal, não taxas e prazos. Cada fonte nova traz a data de leitura (18/11/2026).
- O registro de mudanças de 04/11 (Novidades) que fala do teto "de terceiros" ficou como histórico; a entrada de 18/11 corrige.
- A nota de "venda para entrega futura" foi escrita com a ressalva da fonte: a nota de remessa da mercadoria é aceita no lugar.
