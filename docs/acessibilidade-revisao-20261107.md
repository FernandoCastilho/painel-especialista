# Revisão complementar de acessibilidade — 7 de novembro de 2026

## Escopo e identificação

- Publicado: https://fernandocastilho.github.io/painel-especialista/
- Base: `d05170db6ed7d93911ce0c5981e8105bdbecbcb1`.
- Deploy dessa base confirmado como concluído: https://github.com/FernandoCastilho/painel-especialista/actions/runs/42345401634.
- CI anterior das pastas concluído: https://github.com/FernandoCastilho/painel-especialista/actions/runs/42329281705, candidato `9ecc3bb43ea9d80471e8c74531986aa1614a570d`.
- Auditoria da versão publicada em Chromium, 1180 px, por teclado, controles acessíveis e árvore de acessibilidade. Não é certificação WCAG nem teste auditivo com leitor de tela.

## Resultado observado na versão publicada

1. Aviso inicial e conceito diário: nome do diálogo e botões expostos; foco inicial em Entendi e Fechar, respectivamente; fechamento libera o conteúdo principal.
2. Documento com idioma `pt-BR`; navegação e conteúdo principal possuem landmarks.
3. Calculadoras → Capital de Giro por Enter: campos Valor, Prazo, Taxa, datas e enquadramento com nomes; amortização/período expõem seleção; tabela expõe cabeçalhos de linha e coluna.
4. Valor `abc`: campo fica `aria-invalid=true`, `aria-describedby=cx-value-err`, explicação em alerta. Resultado anterior é substituído por traços. Restabelecer `100.000,00` recupera o resultado.
5. Aparência: Enter abre o grupo e coloca foco em Automático, que expõe `aria-pressed=true`. Escape fecha e restaura foco ao botão Tema, com `aria-expanded=false`.
6. Setores → Base florestal e madeira → Móveis: nomes das pastas, contagem, caminho, seletor e capítulos expostos. Foco termina na superfície da pasta/estudo. Voltar retorna à pasta e ao catálogo.
7. Busca setorial: `zzzxxyy` retorna status “0 subsetores encontrados” e orientação para corrigir; `moveis` retorna “1 subsetor encontrado” e Móveis, sem exigir acentos; campo mantém foco.
8. No catálogo em 1180 px, `scrollWidth=1180` e `innerWidth=1180`, sem transbordamento horizontal nesse estado.

A saída de console consultada continha avisos de uma extensão do ambiente, não uma exceção identificada no código do painel. Esta amostra não é prova de ausência global de erros.

## Defeito corrigido neste lote

O menu móvel **Mais** já se anunciava como `menu/menuitem`, porém não tinha foco inicial, navegação por setas/Home/End, relação entre acionador e menu ou restauração de foco ao fechar. Escape podia remover o item focado e perder a posição de navegação.

A correção limita-se à interação de `Nav.jsx`: nomes e destinos preservados, foco no primeiro/último item ao abrir, setas com retorno nas extremidades, Home/End, Escape com retorno ao acionador, Tab/Shift+Tab mantendo percurso nativo e fechamento ao foco/clique externo sem roubá-lo. O item da seção atual expõe `aria-current`.

Três testes de comportamento falham no código anterior e passam no corrigido. O smoke existente de pastas foi estendido para verificar o menu em 320/390/768 px, em claro/escuro. O relatório identifica `moreKeyboard`; 1440 px é marcado como não aplicável porque usa a barra completa.

## Validação do candidato

- `npm run lint`: zero erros, cinco avisos preexistentes em Calendario, Curves e SeriesHistory.
- `npm test`: 1.249 aprovados, zero falhas.
- `npm run build`: aprovado; aviso de bundle setorial acima de 500 kB já existente.
- Testes focados de navegação e verificador de pastas: aprovados.
- Novo smoke de teclado móvel: preparado para CI, **não executado localmente nesta revisão**. Deve passar no candidato integrado antes da publicação.

## Limites e pendências reais

- Não houve teste em telefone físico, gestos de toque, teclado virtual, Safari iOS ou Chrome Android.
- Não houve teste real com VoiceOver, TalkBack, NVDA ou outro leitor de tela. A inspeção da árvore acessível não substitui ouvir anúncios, testar navegação virtual/rotor ou gestos com esses leitores.
- O browser disponível não oferece redimensionamento/emulação por sua interface de controle; o navegador nativo do executor não pôde ser operado por indisponibilidade da ponte de acessibilidade. Por isso, não se deve apresentar esta execução como aprovação manual em celular.
- A matriz responsiva automatizada anterior permanece como evidência anterior, não como execução nova. O CI deste candidato precisa confirmar novamente as larguras e a correção do menu.
- Para encerrar a frente manual: repetir Mais → Calculadoras → erro/resultado, tema/Escape e Setores → pasta/estudo/busca/Voltar em um telefone com leitor ativo; conferir anúncios, foco, rolagem e alvo de toque.
