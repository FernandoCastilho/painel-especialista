# Verificações

## Conceito diário

`node --test test/conceito-diario.test.mjs` verifica conteúdo real, ciclo diário e persistência separada. `node scripts/smoke-conceito-diario.cjs` testa o build na origem `SMOKE_BASE_URL` (padrão 8768): entrada após o aviso, retorno no mesmo dia, virada de São Paulo com navegador em outro fuso, aviso aberto durante a virada, navegação para o conceito completo, foco, teclado, Escape e fila com Recado, em 390 e 1280 px com reduced motion. Capturas em `CONCEITO_QA_OUTPUT` (padrão `conceito-qa`). Sem armazenamento persistente, a deduplicação vale apenas para a sessão montada; outro navegador ou perfil possui histórico próprio.

- `npm ci`, `npm test`, `npm run build` executam a suíte de lógica e o build.
- Os testes unitários não certificam fórmulas financeiras nem substituem revisão das convenções e das fontes.

## Smoke de navegador (opcional)

O arquivo `scripts/smoke-ui.cjs` exige Playwright instalado no executor e Chromium disponível. Os cinco roteiros abaixo rodam no CI (job `smoke` de `cotacoes-ci.yml`, com Chromium do Playwright 1.63.0); o de petróleo (`smoke-oil-eia`) fica de fora porque depende do arquivo `public/oil.json`, gerado só no deploy.

1. Execute o build com a base de dados apontando para a própria origem (`VITE_DATA_BASE=http://127.0.0.1:8768 npm run build`; sem isso o histórico central não carrega e Mês/Ano ficam em "—") e sirva `dist` em `http://127.0.0.1:8768` (por exemplo, `python -m http.server 8768 --bind 127.0.0.1 --directory dist`).
2. Execute `node scripts/smoke-ui.cjs` no mesmo executor. `SMOKE_BASE_URL` permite mudar a origem e `CHROMIUM_PATH` selecionar um executável já instalado.

O smoke intercepta dados financeiros com fixtures sintéticas, bloqueia chamadas externas, e verifica abas, carregamento tardio, teclado em gráficos, modal/Escape, Voltar/Avançar e link direto do calendário (#cenarios/calendario). Ele não confere cotações reais nem resultados financeiros. Somente um resultado completo de sucesso conta como teste executado.

Roteiros disponíveis: `smoke-ui`, `smoke-market-table`, `smoke-market-workspace`, `smoke-market-followup` e `smoke-ux`. Os cinco passam contra a interface atual (terminal). Os roteiros usam o canal `msedge` do Playwright por padrão; `SMOKE_CHANNEL=chromium` usa o Chromium do Playwright (é o que o CI faz).


## Proteção das cotações atuais

A coleta e o navegador compartilham `src/quoteSafety.js`. Antes de aceitar um preço, verificam campos numéricos obrigatórios, máxima/mínima, compra/venda, horário futuro e faixas amplas de segurança: USD/BRL 2–12, EUR/BRL 2–14, JPY/BRL 0,01–0,10 e CNH/BRL 0,30–2,50. USD/CNH é validado como a ponta do cruzamento, não como uma taxa em reais. Essas faixas são barreiras de integridade; não certificam a exatidão de um preço dentro delas.

Uma atualização rejeitada mantém apenas a última referência que também passe nas verificações, com horário original e aviso. Sem referência anterior válida, o par fica indisponível. Outras moedas continuam atualizando. O cruzamento CNH é preservado separadamente: uma ponta rejeitada não pode ser misturada com uma ponta nova. Valores retidos não acrescentam pontos ao intraday. Fontes, fórmula do CNH, defasagem entre as pontas e histórico diário não são alterados por esta proteção.

Execute `node --test test/quote-safety.test.mjs` para reproduzir os cenários de 5,40 → 54, falhas repetidas, primeira coleta, recuperação, rejeição da ponta USD/CNH, migração de arquivo antigo e campos inválidos. Os testes usam dados sintéticos e não consultam cotações reais.


## Estado da coleta e horário das referências

`dataHealth.js` separa a tentativa de leitura no navegador (`checkedAt`), a última leitura com dados válidos (`lastSuccessAt`), a geração do arquivo e o horário original das cotações. O cabeçalho e Configurações usam a mesma avaliação do câmbio. Ler um arquivo novo não torna recente uma cotação antiga. Retenção e falhas parciais prevalecem sobre a geração recente do arquivo. Os detalhes de Configurações mostram as datas; uma consulta direta não é rotulada como arquivo gerado.

Nas coletas de dias úteis, o relógio de atraso exclui sábado e domingo de Brasília, mantendo o atraso já existente e retomando a contagem na segunda. Os limites e os agendamentos não mudam. Não são presumidos feriados ou calendários de publicação específicos de cada país. A idade factual das cotações continua usando o limite existente de dez minutos, inclusive no fim de semana, sem declarar mercado aberto ou fechado.

Para indicadores periódicos ou taxas em vigor (por exemplo, Selic e IPCA), o estado da coleta considera os metadados do arquivo e suas falhas, sem inferir atraso apenas porque a última observação é antiga. “Sem alerta” significa ausência de falha informada e arquivo dentro do prazo; a referência permanece indicada no painel correspondente.

Regressão: `node --test test/data-health.test.mjs test/terminal.test.mjs`; testes de leitura em `test/health-refresh.test.mjs`. O smoke `smoke-data-health.cjs` confere os estados e as datas no build, com dados sintéticos.

## Alertas de câmbio e permissão

`node --test test/alerta-variacao.test.mjs test/alerta-notificacao.test.mjs test/quote-freshness.test.mjs` verifica, sem navegador ou rede, o cálculo e o componente React com APIs de notificação simuladas. Cobre convite mesmo sem alerta, clique explícito, escolha adiada, bloqueio, liberação externa ao retornar ao app, ausência de suporte, falha e nova tentativa, envio pendente, cliques repetidos, dispensa concorrente, deduplicação por moeda/sentido/dia e migração do estado antigo. Não abre prompts nem envia notificações reais. Regressões de envelhecimento verificam revalidação na autorização tardia, no retry e após aguardar o service worker: a cotação pode passar de 9m59s para 10m01s ou mudar de dia em Brasília sem gerar envio ou consumo da deduplicação. Uma atualização mais recente substitui o texto pendente; reversão, dispensa e desmontagem bloqueiam o despacho ainda não iniciado.

O limiar permanece estritamente maior que ±0,30%, agora contra o fechamento anterior da fonte e usando o mesmo percentual do Δ dia da tabela. A base é `bid - varBid`, validada contra `pctChange` com tolerância de 0,005 ponto percentual para arredondamento. Sem campos coerentes, não há alerta. Não depende do intraday; mantém o início às 9h de Brasília. Usa a base da própria fonte após feriados e fins de semana, sem inventar data/hora para esse fechamento. Dados com mais de dez minutos, retidos ou de reserva não disparam alertas atuais. O navegador lê os dados enquanto o app está visível; não existe push de servidor para segundo plano/app fechado e movimentos revertidos durante a ausência não são reconstruídos.

`notificado` do formato anterior não comprovava envio e não bloqueia uma nova tentativa. `sistemaEnviadoEm` só é gravado após a API do navegador aceitar o envio; isso não comprova exibição pelo sistema operacional nem leitura. Dispensas existentes são mantidas. A primeira abertura após esta correção pode reenviar uma vez um alerta antigo ainda ativo e não dispensado. Sem armazenamento, a deduplicação vale só para a montagem atual; outras abas/perfis não possuem garantia de exclusão mútua.

O roteiro `scripts/smoke-alerta.cjs` preserva a verificação de dispensa separada do convite de permissão. Em 07/11/2026, a tentativa local parou no lançamento do Chromium por restrição de sockets do executor, antes de abrir uma página. O CI precisa executar o smoke e produzir capturas do candidato final; não há aprovação visual local nem teste de entrega real em dispositivos.

## Conta Garantida

`node --test test/conta-garantida*.test.mjs` verifica utilização única e lançamentos por data, amortização, reutilização, dias reais e úteis, feriados informados, meses, IOF sobre saldos e acréscimos, referências e bloqueios tributários, erros e fluxo React sem navegador. Juros e IOF são pagos à parte, nunca capitalizados; o motor rejeita encargos incorporados. O caso R$ 100 mil, dez dias, 3% a.m. proporcional/30 e IOF padrão resulta em R$ 1.000 de juros + R$ 462 de IOF.

Os testes de interface cobrem troca de modos, repetição de edição/adição/remoção, resultado inválido sem dados antigos, Simples, feriados, paginação, labels/IDs e rota de busca. São testes React em memória, não smoke visual. Não foi usado servidor/socket/preview/fixture Python nem feita publicação. Convenções e limites: `../docs/conta-garantida.md`.

## Aparência manual e automática

`node --test test/system-theme.test.mjs test/theme-control.test.mjs` cobre escolha Claro/Escuro/Automático, persistência, prioridade sobre o sistema, retorno ao automático, sincronia entre abas, armazenamento bloqueado, limpeza de listeners, primeiro paint, foco, Escape e dispensa do seletor. Sem armazenamento disponível, a escolha vale apenas na visita atual.

No preview de desenvolvimento, `test/fixtures/theme-responsive.html` renderiza o app real em um iframe com larguras selecionáveis de 320, 390, 768, 1024 e 1440 px. É um ensaio de layout, não emulação de toque ou dispositivo. Verifique o botão em Mercado e nas demais seções, troca de tema com entrada de calculadora preservada, reabertura/reload, opção Automático, teclado e ausência de corte no menu e nas abas. O arquivo não faz parte do build publicado.

## Pastas e navegação setorial

`node --test test/central-history.test.mjs test/central-ui.test.mjs test/sector-folders-ci.test.mjs` confere a estrutura das pastas, o contexto independente de cada entrada do histórico e o verificador de evidências. Os testes do verificador usam arquivos sintéticos e não certificam navegação real.

No CI, `FOLDERS_QA_OUTPUT="$RUNNER_TEMP/qa-universal/folders" node scripts/smoke-sector-folders.cjs` testa 320/390/768/1440 px nos temas claro/escuro. Cobre pasta, estudo, seletor, busca sem acentos, estado vazio, limpeza, caminho, Voltar/Avançar, recarga do estudo e da busca restaurada, foco, transbordamento, redução de movimento, insumos e rota inválida. As chamadas para outras origens são bloqueadas; não há publicação ou alteração de fontes.

`node scripts/verify-sector-folders.cjs "$RUNNER_TEMP/qa-universal/folders"` exige oito resultados completos, ausência de erros de página e 24 capturas não vazias. Ausência de relatório, combinação duplicada, recarga não comprovada ou captura ausente bloqueia o job. Os smokes de estudos e navegação continuam ativos. A matriz existente de 40 cenários de calculadoras e dois cabeçalhos Setores320 não foi substituída. O CI e a revisão independente das capturas do candidato integrado precisam concluir antes da publicação; testes unitários e build locais não substituem esses gates.
