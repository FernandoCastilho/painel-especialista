# Candidato local: teclado inspirado na HP 12C clássica
Integração focada em teclado. Motor RPN anterior não foi editado; TVM nos períodos inteiros e VPL/TIR usam o motor existente. O adaptador exclusivo do teclado clássico cobre a política de n e o primeiro período fracionário. O módulo auxiliar independente implementa funções adicionais; não mexe nas outras calculadoras. Não homologado como emulação integral.

## Interface do controlador
createClassicRpnController() → press(id), snapshot(), isSupported(id, camada?), setDisplay(número), subscribe(listener) e dispose(). subscribe devolve unsubscribe; dispose cancela PSE e deixa o controlador reutilizável para novo subscribe. setDisplay altera X, sem armazenar i nem enviar dados. Esc envia cancel; Backspace envia backspace somente enquanto digitando; Delete envia clx. O snapshot inclui display, shift, indicators.begin/program/on/dmy, message, X/stack, pc, registradores e fluxos. ON ao desligar esconde visor e mantém memória apenas da sessão.

## Mapa de funções
| Tecla | Primária | f | g |
|---|---|---|---|
| n / i | Guardar/calcular conforme contexto | AMORT / INT | 12× / 12÷ |
| PV / PMT / FV | Guardar/calcular conforme contexto | VPL / RND / TIR | CF0 / CFj / Nj |
| CHS / EEX | Sinal / expoente | — | DATE / ΔDYS |
| yˣ / 1/x | Potência / recíproco | PRICE / YTM | √ / eˣ |
| %T / Δ% / % | Percentual total, variação e percentual | SL / SOYD / DB | LN / FRAC / INTG |
| 4 / 5 / 6 | Dígitos | casas decimais | D.MY / M.DY / média ponderada |
| 7 / 8 / 9 | Dígitos | casas decimais | BEGIN / END / MEM |
| 1 / 2 / 3 | Dígitos | casas decimais | projeção x / projeção y / fatorial |
| R/S | Rodar ou parar em marcador gravado | P/R | PSE (1 s, retomada automática) |
| SST / R↓ | Passo / rotação | CLEAR Σ / CLEAR PRGM | BST / GTO |
| x↔y / CLx | Trocar / limpar X | CLEAR FIN / CLEAR REG | x≤y / x=0 |
| ENTER | Empilhar | PREFIX (leitura auxiliar, não gesto de pressão longa) | LAST X |
| ON / f / g | Estado e camada | — | — |
| STO / RCL | Guardar/lembrar com endereço 0–9 ou .0–.9; suporte aos registros financeiros. STO EEX alterna C | — | — |
| 0 / decimal / Σ+ | Zero, separador, amostra | casas / notação científica / — | média / desvio / Σ− |
| + / − / × / ÷ | Aritmética | — | — |

## Provas e limites
Testes oficiais de TVM, fluxos, INT, AMORT, PRICE/YTM e DB; testes derivados de memória, programação, PSE/retomada/parada/limites com relógio de teste, ordem X/Y, atualização n/PV/i, regressão de preservação de estado financeiro/pilha em erro, datas e estatística. Diferenças a revisar contra hardware: edição/execução de programas e keycodes exatos no visor, aliases conforme a revisão física, formatação de datas e expoentes, duração de prefixo, limites de memória, dados estatísticos registrados em memória física, convenções e fronteiras dos cálculos. O adaptador clássico aceita n fracionário informado, distinto de n calculado (inteiro conforme limiar 0,005). Indicador C ligado aplica juros compostos ao período inicial irregular; desligado aplica simples. O solver dessa taxa aceita perfil de sinais sem ambiguidade e rejeita os demais; não afirmar paridade de extremos. Falta validação UI/teclado/touch e Auditoria do pacote combinado. Não publicar a promessa “todas as funções” enquanto houver funções físicas não implementadas ou sem evidência.

[Manual oficial HP 12C](https://h10032.www1.hp.com/ctg/Manual/c00363319.pdf) · [Foto frontal oficial HP](https://hpcalcs.com/wp-content/uploads/2021/11/HP12c_front.jpg)

### Evidências V4
- Regressão oficial: g 1 inverte a única reta de y sobre x; 48 → 28.818,93; g 2 volta para 48 e Y guarda r. 
- R0 a R19 (0–9 e .0–.9) são a fonte dos CFs. O 20º CF após CF0 usa FV. STO, aritmética de memória, RCL e cálculo veem a mesma fonte. RCL g CFj usa n e retrocede até CF0; RCL g Nj só exibe a repetição. Nj edita o valor indicado em n. Depois de revisar os fluxos, restaure a contagem em n antes de VPL/TIR.
- DATE aceita somente 15/10/1582 a 25/11/4046 e exibe o dia da semana (1 segunda a 7 domingo). No programa, pausa um segundo antes de retomar.
- Não declarar prova de todas as teclas apenas pelo número de testes; além destes vetores, o pacote combinado precisa de inventário teste por tecla/camada, estado de erro e testes de navegador/auditoria externa.

### Evidências V5
- Σ+ e Σ− modificam R1–R6, compartilhados com STO/RCL/CF. Média, desvio, média ponderada e regressão leem os próprios registradores. CLEAR Σ zera apenas R1–R6 e pilha, deixando R0 e R7+.
- STO aritmético aceita R0–R4; fora dessa faixa informa erro e preserva os dados.
- Alteração de programa com GTO ponto sobrescreve a linha seguinte. MEM inicia P-08 r-20; ao gravar a 9ª linha a memória vira P-15 r-19 e R.9 passa a ser memória do programa. No limite, P-99 r-07. CLEAR PRGM restaura disponibilidade, não restaura o dado que foi substituído. Há códigos numéricos por posição, incluindo comandos agrupados STO/RCL, e linhas vazias com GTO 00. CF máximo acompanha a memória livre, usando FV para o último valor.
- Não declarar paridade completa: formato e alguns gestos da memória/visor ainda requerem comparação por revisão física; em particular esta aplicação tem limite defensivo de 1.000 instruções por execução local. A prova de navegador do conjunto continua obrigatória antes de publicar.

### Evidências V6
- Exemplo controlado: 100.000.000, 100.000.001 e 100.000.002 têm desvio amostral 1. Os momentos binários exatos cancelam a parcela grande antes de arredondar ao visor; STO/RCL continuam sobre R1–R6, e STO explícito redefine a precisão daquele registro.
- Quando PRGM ocupar ou liberar memória e a posição de um CF registrado for afetada, o controlador informa a perda, mantém o FV anterior e pede revisão de n/reentrada dos CFs afetados; não promove automaticamente o FV ao CF. Até revisar n, o cálculo rejeita o fluxo incompleto. Esta proteção explícita contra perda silenciosa é uma escolha do app; não alegar equivalência de estado após a colisão sem verificação física.
