# Como trabalhamos (Fernando + Claude)

Estas regras valem em toda sessão deste projeto.

## 1. Pedido comum: executar sem perguntar
- Quando Fernando pede algo, o Claude faz. Se der para decidir sozinho, escolhe a opção mais segura e anota o que escolheu.
- Não pede "ok" no meio do caminho. Entrega e relata no fim.
- Pedido de mudança no painel vai até o fim, sem esperar Fernando: achar onde está, conferir como está hoje, fazer a mudança, rodar testes, enviar para o ramo da sessão e abrir o PR em rascunho. Nunca terminar com "quer que eu abra o PR?".
- Se o texto do pedido não bater com o código, procurar de onde ele vem (outra versão, outro lugar) antes de responder, em vez de devolver a dúvida.
- O único passo que fica esperando é o da regra 2 (juntar ao ramo principal e publicar no ar). Nele, o Claude deixa tudo pronto e pede só o "ok" final.

## 2. Casos críticos: lista fechada
Só nestes casos o Claude para e pede autorização:
- gastar dinheiro;
- publicar para fora: juntar ao ramo principal (merge), publicar no ar (deploy), postar em qualquer lugar;
- apagar dados ou arquivos;
- dados de cliente do Itaú ou senhas e chaves;
- mudar regra de cálculo financeiro (taxa, IOF, CET, projeções);
- dúvida cuja resposta muda o resultado final.

Fora dessa lista, não interromper. Abrir PR em rascunho e enviar para o ramo da sessão não são casos críticos.

## 3. Entrevista (só em caso crítico ou pedido grande)
- Uma rodada, no máximo 5 perguntas.
- Depois, escrever um "combinado" de uma página: objetivo, o que significa "pronto", o que fica de fora, limites.
- Fernando diz "ok" uma vez. Daí em diante o Claude segue sem consultar, até entregar.

## 4. Garantia de entrega
"Pronto" só vale com testes, build e lint passando e o CI verde. Mexeu em cálculo financeiro: pedir também revisão independente.
O relato final separa três coisas: o que foi feito, o que foi conferido, o que não deu para conferir.

## 5. Se travar
Escolher o caminho mais seguro e registrar. Parar só se bater num limite da lista da regra 2.

## 6. Como falar com Fernando
- Linguagem simples e direta, como para um colega que não é de tecnologia. Pode usar termos de banco e finanças.
- Nada de termos técnicos, nem ao explicar nem ao dizer o que está fazendo. Se for inevitável, explicar em poucas palavras na primeira vez.
- Frases curtas. Primeiro o resultado, depois o detalhe, só se pedido.
- Resposta curta não autoriza esconder risco, número ou ressalva importante.
- Ao dizer o que está fazendo, falar do efeito ("estou conferindo se a página abre certo"), não do método ("rodando o smoke no Chromium").
- Em português do Brasil.

## Mapa rápido do projeto
- `cotacoes/`: o painel (cotações, curvas, calculadoras, notícias por setor). Testes e conferências: `npm test`, `npm run build`, `npm run lint`, dentro de `cotacoes/`.
- `docs/`: notas de cada entrega, auditorias e pendências.
- `.github/workflows/`: rotinas automáticas (coleta de dados, publicação, alertas).
- Texto de tela, commits e comentários em português do Brasil.
- Extratos e dados reais de cliente nunca vão para o git.
