# Calculadora RPN

Aba principal `#rpn`, junto de Calculadoras, com o nome completo no computador e para leitores de tela. No celular/tablet, aparece como RPN, fora de Mais. Os atalhos Alt+1 a Alt+0 continuam iguais. Não há dependência externa, transmissão de digitação nem persistência nesta tela; sair da seção encerra o quadro atual.

## Contrato com o motor (implementação separada)

`src/rpnEngine.mjs` exporta `createRpnEngine()`. Cada instância começa com seu estado próprio e implementa `snapshot()` e `press(key)`. Ambas devolvem a visão atual:

- `display` (string já formatada em pt-BR) e `message` (string opcional em pt-BR);
- `stack` (X, Y, Z, T), `settings.paymentTiming` (`end` ou `begin`);
- `finance` (registros `n`, `i`, `pv`, `pmt`, `fv`, número ou nulo) e `cashFlows` (valores numéricos por período, começando no período zero).

Chaves: dígitos, `decimal`, `enter`, `add`, `subtract`, `multiply`, `divide`, `swap`, `drop`, `clearEntry`, `backspace`, `clearAll`, `changeSign`, `lastX`, `percent`, `power`, `sqrt`. Finanças: `store:<registro>`, `solve:<registro>`, `timing:begin`, `timing:end`, `clearFinance`, `cash:add`, `cash:repeat`, `cash:clear`, `cash:npv`, `cash:irr`.

O motor é responsável por número inteiro de períodos, taxa em % por período, início/fim do período, validação dos fluxos e diferenças entre TIR ambígua e sem solução. Em `cash:repeat` o inteiro em X indica o total de ocorrências do último fluxo; não aplica ao CF0. A interface não faz contas nem converte taxas. Erros de operação são informados no retorno; exceção inesperada desativa a sessão para não reutilizar um visor antigo.

## Conferência

- Rota direta e clique nas larguras 320, 390, 820, 1024 e 1440, nos dois temas: entrada principal sem corte, área de toque, navegação e captura visual.
- Teclado: atua apenas dentro do quadro e não modifica atalhos do Painel; Enter em botão mantém ativação nativa. Teste browser com 2 ENTER 3 + e teste unitário do contrato com motor simulado.
- Referência de fluxo RPN: [Guia rápido oficial da HP 12c](https://h10032.www1.hp.com/ctg/Manual/c01798099.pdf). Não é reprodução do aparelho nem alegação de equivalência integral; funções implementadas precisam de vetores independentes e conferência antes de publicação.
