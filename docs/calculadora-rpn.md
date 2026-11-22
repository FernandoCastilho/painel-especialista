# Calculadora RPN

Aba principal `#rpn`, separada de Calculadoras. No celular aparece como RPN, fora de Mais, com o nome completo acessível. Os atalhos do Painel não mudam. Digitação, pilha e rascunho de taxas ficam apenas na sessão desta tela; sair da seção encerra o quadro.

## Interface e contrato

Em telas largas, a matriz segue a HP 12C clássica: quatro linhas, dez posições, ENTER vertical ocupando duas linhas, função direta em branco e prefixos f (dourado) e g (azul). No retrato estreito, o mesmo conjunto de 39 teclas é distribuído em duas partes com alvos de pelo menos 44 pixels. A rota oferece só uma grade por largura, com ordem de foco correspondente à ordem visual. A identidade é do Painel, sem logotipo HP ou afirmação de endosso.

`rpnClassicLayout.mjs` modela a posição e a legenda. A interface envia os mesmos IDs físicos ao controlador `createClassicRpnController()`: `press(id)` e `snapshot()` retornam o visor, feedback e estado; `isSupported(id)` determina a disponibilidade no estado atual. A UI não calcula nem interpreta os comandos da calculadora. A assinatura ao controlador atualiza pausa e retomada; ao sair, a interface cancela o temporizador da sessão e remove a assinatura. Quando o controlador falha inesperadamente, a interface limpa o visor e desativa a operação.

A região recebe atalhos físicos só enquanto o foco está dentro do quadro; campos do conversor, links e controles nativos não disparam contas. O painel de leitura recolhido mostra pilha, registros financeiros e fluxos sem criar uma segunda interface de cálculo.

## Conversor separado

**Taxas** abre um conversor sem escrever na calculadora. Escolha dia, mês ou ano nos campos **De** e **Para**; a seta troca as unidades. Se houver dia, escolha 365 dias corridos ou 252 úteis por ano; o mês médio usa a base anual dividida por 12. A conversão efetiva correspondente é executada pelo módulo independente `rpnRateConversion.mjs`. Só **Usar no visor** envia o valor ao controlador por `setDisplay(value)`, sem gravar em `i`. Fechar e reabrir preserva o rascunho desta sessão.

## Validação necessária

Rodar smoke nas larguras 320, 390, 820, 1024 e 1440, nos dois temas: geometria, teclado, toque, fluxo, efeitos do conversor, foco e retorno. A disposição física não prova equivalência de cálculo ou programação. Qualquer função indisponível deve ser identificada; para afirmar paridade, cadastre casos independentes por função e compare sequências e resultados com o modelo clássico.

[Manual oficial da HP 12C](https://h10032.www1.hp.com/ctg/Manual/c00363319.pdf) · [Vista frontal da HP 12C clássica, fabricante licenciado](https://hpcalcs.com/product/hp-12c-financial-calculator/)
