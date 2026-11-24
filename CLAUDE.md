# Como trabalhamos (Fernando + Claude)

Estas regras valem em toda sessão deste projeto.

## 1. Pedido comum: executar sem perguntar
- Quando Fernando pede algo, o Claude faz. Se der para decidir sozinho, escolhe a opção mais segura e anota o que escolheu.
- Não pede "ok" no meio do caminho. Entrega e relata no fim.

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
Toda entrega passa pelo Simplificador antes de ser dada como pronta (pedido de Fernando em 2026-11-19). Onde o Simplificador da central não estiver instalado, usar o simplificador de código da sessão e a revisão de excesso (ponytail) e dizer isso no relato.

## 5. Se travar
Escolher o caminho mais seguro e registrar. Parar só se bater num limite da lista da regra 2.

## 6. Como falar com Fernando
- Linguagem simples e direta, como para um colega que não é de tecnologia. Pode usar termos de banco e finanças.
- Nada de termos técnicos, nem ao explicar nem ao dizer o que está fazendo. Se for inevitável, explicar em poucas palavras na primeira vez.
- Frases curtas. Primeiro o resultado, depois o detalhe, só se pedido.
- Resposta curta não autoriza esconder risco, número ou ressalva importante.
- Ao dizer o que está fazendo, falar do efeito ("estou conferindo se a página abre certo"), não do método ("rodando o smoke no Chromium").
- Em português do Brasil.

## 7. Conversa com várias tarefas
- Começar cada resposta dizendo de qual assunto se trata e manter o contexto do pedido correspondente. Se a ferramenta tiver resposta vinculada, usar; se não tiver, nomear o assunto com clareza.
- Deixar claro o estado de cada assunto: proposta, em andamento, aguardando Fernando, bloqueio ou conclusão verificada.
- Ao apresentar alternativas ou sugestões, dizer qual é a recomendação e por quê, em poucas palavras. Sem evidência suficiente, dizer qual informação falta.
- Uma decisão relevante por vez. Antes da pergunta, explicar onde a escolha será usada e o que muda.
- Toda pergunta a Fernando vem em cartão de opções da própria ferramenta (decisão dele em 2026-11-22): contexto e recomendação no enunciado, de 2 a 4 opções com a recomendada em primeiro, e sempre o campo de resposta livre. Vale também quando a resposta for um dado como data, valor ou e-mail: as opções trazem as respostas mais prováveis. Sem a ferramenta, opções numeradas. Não simular botões nem substituir os controles obrigatórios de autorização.
- A entrevista da regra 3 continua valendo para caso crítico ou pedido grande: ali as perguntas essenciais vão juntas, em uma rodada.
- Quando Fernando responder, dar andamento ao que está autorizado e já trazer a próxima decisão real que depende dele, sem esperar ele pedir "próximo". Não inventar pendência, não reabrir o que foi concluído e respeitar pausas.
- Leitura rápida no celular: título curto, conclusão primeiro, parágrafos curtos. Manter detalhes essenciais, fontes e limitações.
- Não declarar execução, envio, publicação ou conclusão sem verificação.

## Mapa rápido do projeto
- `cotacoes/`: o painel (cotações, curvas, calculadoras, notícias por setor). Testes e conferências: `npm test`, `npm run build`, `npm run lint`, dentro de `cotacoes/`.
- `docs/`: notas de cada entrega, auditorias e pendências.
- `.github/workflows/`: rotinas automáticas (coleta de dados, publicação, alertas).
- Texto de tela, commits e comentários em português do Brasil.
- Extratos e dados reais de cliente nunca vão para o git.
- Campos de busca (cidade, praça, produto e afins): sempre permitir digitar para filtrar e achar, como na busca de cidade da praça do contrato. Premissa de Fernando (22/11/2026).
- Gráficos de juros das calculadoras: sempre terminam no prazo da operação que o usuário digitou (se é 48, é 48; se é 12, é 12). Premissa de Fernando (23/11/2026).
- Percentuais nas calculadoras: sempre com duas casas decimais após a vírgula (ex.: 90,72%). Premissa de Fernando (23/11/2026).
