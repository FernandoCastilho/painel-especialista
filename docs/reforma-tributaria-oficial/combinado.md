# Combinado: nova calculadora da reforma tributária

Estado: aprovado por Fernando ("Ok") em 2026-11-19. Entrega descrita em `docs/cbs-caixa.md`, seção "Reforma oficial (2026-11-19)". Data: 2026-11-19.
Base: escolhas de Fernando nesta data e a captura em `captura-2026-11-19.md`.

## Objetivo
Reformular a calculadora "Reforma tributária · caixa" para mostrar o efeito da reforma no caixa e no capital de giro do cliente, com CBS, IBS e Imposto Seletivo, seguindo as regras da calculadora oficial da Receita Federal (repositório `ReceitaFederal/calculadora-rtc-regime-regular`, licença MIT) e incluindo empresas do Simples Nacional.

## O que muda no cálculo (precisa do ok)
1. Entram IBS estadual, IBS municipal e Imposto Seletivo, além da CBS.
2. A base passa a ser "por fora", como na oficial: o preço sem ICMS, ISS, PIS, Cofins e IPI. Hoje a conta tira a CBS de dentro do faturamento bruto.
3. Seletor de ano de 2026 a 2033.
   - 2026: alíquotas oficiais do banco da Receita (CBS 0,9%, IBS 0,1%).
   - 2027 em diante: a Receita não publicou alíquotas. O usuário vê um valor inicial editável, marcado como "hipótese". A tela sai do 11,2% fixo de hoje.
4. Reduções legais (30% a 100%) vindas da tabela oficial de classificação, com a mesma regra da oficial: alíquota × (1 − redução).
5. Simples Nacional: o usuário informa a alíquota do DAS e a calculadora reparte CBS e IBS como a oficial. A oficial não calcula a alíquota do DAS.
6. O motor de caixa atual (prazos, split, crédito com espera e reserva) continua. Só recebe os novos impostos.

## O que significa "pronto"
- As contas batem com a oficial em pelo menos 10 casos de teste copiados dos exemplos da Receita.
- A tela mostra a fonte, a versão da tabela e o rótulo "hipótese" quando for o caso.
- Uma rotina semanal compara a versão da tabela da Receita com a nossa e avisa quando houver versão nova. Não troca nada sozinha.
- Testes, build e lint passando, CI verde e capturas de tela em celular e computador.
- Revisões: Simplificador (ou o substituto, como está nas regras do projeto), Diretor de Arte na tela e revisão independente do cálculo.

## O que fica de fora
- Cálculo por item de nota fiscal (a ferramenta oficial já faz isso de graça).
- Valor do crédito presumido (a oficial também não calcula).
- Cálculo da alíquota do DAS do Simples.
- Gerador do PDF da nota de serviço.
- Usar como oficiais os números de 2027–2033 que a Receita apagou.

## Limites
- Nada vai ao ramo principal nem ao ar sem seu "ok" (PR em rascunho).
- Nenhum dado de cliente.
- Pendências que não bloqueiam: a notícia oficial, a portaria dos códigos de verificação e o artigo do Machado Meyer estão bloqueados na rede desta sessão. Por isso, a autenticidade da cópia ainda não foi conferida contra a portaria.
