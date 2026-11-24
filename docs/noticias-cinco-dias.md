# Notícias: janela móvel de cinco dias

Implementação candidata de 05/11/2026, ainda sem publicação. Derivada do candidato setorial `5bca2965430916fa2842e96e9fb76150e0dccf4a`, em cópia isolada. A referência de produção disponível localmente é `eeecfc9d8d9560e010a3584e812ba74a95c6d9f5`; não houve consulta à produção nem afirmação de que continua sendo o HEAD remoto. Os caminhos gerais de notícias examinados eram iguais nessa referência e na base candidata.

## Regra

- Teto único de **120 horas corridas desde a publicação**, com extremos inclusivos: `agora − 120 h ≤ publicação ≤ agora`. Um milissegundo antes do início ou depois de agora é rejeitado. Não são cinco dias civis nem dias úteis.
- `src/newsWindow.js` centraliza a janela. No RSS legado, `t` corresponde ao `pubDate` original. Em notícias institucionais, `publishedAt` é obrigatório e prevalece sobre qualquer `t` recebido.
- Data de coleta, geração do arquivo, revisão editorial, atualização da página e data do fato mencionado não renovam a publicação. Uma notícia publicada agora sobre dados de setembro pode aparecer, com o período do dado preservado.
- Publicação sem data válida é excluída. A precisão apenas de dia nas fontes institucionais mantém o intervalo conservador anterior, sem inventar hora/fuso: todo o intervalo possível deve caber nas 120 horas.
- Filtro aplicado antes de deduplicação, seleção e limites de quantidade. Fallback conserva somente matérias ainda elegíveis. Sem mínimo artificial de notícias.
- Os componentes reavaliam dados em cache a cada minuto visível e na retomada pelo mecanismo de polling existente, sem requisição extra para a fonte. As comparações têm precisão de milissegundo; a remoção visual em tela já aberta ocorre no próximo ciclo do relógio, não há promessa de temporização de navegador em tempo real.

## Abrangência

| Caminho | Proteção |
|---|---|
| Aba Notícias, por moeda e mercado | `feed.js`, `News.jsx`, relógio e avisos de atualização |
| Mercado → Manchetes | `Resumo.jsx`, feed comum e `NoticiasPorDia.jsx` |
| Moedas, Reforma tributária (Eleições EUA e Veículos pesados saíram de Mercado hoje em 24/11/2026) | `reforma.js`, `ReformaTributaria.jsx`, `NoticiasPorDia.jsx` |
| Temas e insumos legados | Mesmos normalizadores, merge e componente comum |
| 37 setores + 5 insumos institucionais | `sectorNews.js`, `SectorNews.jsx`, `sector-news-lib.mjs` |
| Apresentações | Seleção em `apresentacao.js` e nova filtragem no slide aberto, em `Apresentacao.jsx` |
| Busca global | Poda dos dados antes de indexar, inclusive corpos agregados; snapshots reindexados pelo relógio, sem nova coleta; resultado selecionado também revalidado, inclusive ao retornar à rota |
| Destaques auxiliares | `snapshot.topHeadlines`, mesmo teto |
| RSS moedas/mercado | Filtro local de publicação antes de selecionar; parâmetro padrão de busca de 5 dias |
| Reforma e temas | Merge de novos/anteriores com 5 dias, sem tolerância de uma hora futura |
| Retenção após coleta vazia/falha | `fillNewsFromPrevious` filtra tanto os novos quanto o fallback, mantendo o aviso mesmo se tudo expirar |
| Protótipo setorial offline | Atualização do motivo de expiração; artigo de 6 dias é descarte normal, não suspensão por parser |

A busca de “Mercado hoje” continua mais curta: parâmetro de busca de dois dias e teto de três dias na seleção da coleta, já existentes. Não foi ampliada para preencher cinco dias. O teto geral de exibição/retencão é cinco dias.

## Estados vazios, falhas e suspensão

- Sem item elegível: “Nenhuma publicação válida nas últimas 120 horas”, sem alegar que não existem notícias no mundo.
- Coleta parcial, falha, data ausente/futura ou arquivo atrasado geram aviso. O estado vazio distingue arquivo sem cobertura atual confirmada de resultado vazio nas fontes consultadas.
- Dados legados não possuem último sucesso por fonte em todos os casos. A interface não inventa esse horário. Geração do arquivo não é apresentada como prova de publicação nova.
- O aviso geral de notícias considera também falhas parciais registradas e idade do arquivo superior a três horas. Não concede dispensa de envelhecimento às notícias em fins de semana; isso não altera agendamentos.
- Fontes setoriais mantêm `accessSuspended`, motivo, tentativa e último sucesso. A indicação de atraso é acrescentada ao motivo, não o apaga. Suspensão explícita não pode ser exibida como consulta bem-sucedida.
- A coleta setorial real continua desabilitada localmente e no CI. Nenhum acesso negado foi repetido, nenhuma fonte nova foi acessada e não houve tentativa de contorno.

## O que não muda

- Séries históricas, taxas em vigor, indicadores mensais, ANFAVEA, calendários, datas econômicas e histórico de novidades do aplicativo.
- Workflows, cron, rotinas externas, credenciais, permissões e infraestrutura.
- Arquivos em `public/`, inclusive o snapshot setorial original: preservados byte a byte. O JSON histórico pode indicar sete dias porque registra a coleta anterior; normalização no cliente e geração futura usam a regra atual. Não há nova data de coleta simulada.
- Histórico e mecanismos de persistência do protótipo seguro. Somente o identificador de descarte por idade foi alinhado à nova janela.

## Verificação

- **700 testes elegíveis passaram**, sem falhas/skips dentro da execução. O arquivo `test/commodities.test.mjs` foi excluído antes da execução por conter a fixture XLSX em Python anteriormente negada. Não se declara a suíte integral.
- **126 testes focais passaram**: janela comum, busca, renderização de componentes, camada setorial, UI setorial e protótipo offline.
- Limites testados: 120h exatas, ±1 ms, futuro, data inválida/ausente, cache antigo de sete dias, expiração com tela aberta, seleção de dia órfã, filtros de moeda, precisão de dia, fallback, busca agregada e apresentação.
- Teste explícito confirma que a geração/coleta/data do fato não rejuvenescem matéria e que indicadores históricos continuam aceitos.
- A auditoria identificou um cartão de resultado selecionado que congelava manchetes antigas. O escape foi reproduzido contra `dcbf66e` e corrigido: o cartão conserva metadados de publicação estruturados, poda os agregados novamente e mostra ausência explícita quando expira. Há regressões de limite exato, +1 ms, saída/retorno à rota e seleção antiga sem metadados (não usa geração do arquivo como publicação).
- Slides sem tema de notícias configurado mostram essa ausência, em vez de alegar falha de coleta. Foram testados também atraso verdadeiro, snapshot vazio atual e expiração no slide aberto.
- Teste explícito confirma que a causa da suspensão sobrevive à expiração e que o protótipo não suspende fonte por artigo simplesmente antigo.
- Build aprovado. ESLint: zero erros e sete avisos preexistentes em arquivos de gráficos fora desta alteração.
- Não houve preview, socket local, smoke de navegador ou consulta live. Os testes de UI usam React renderizado em memória, esbuild e relógio controlado; não equivalem a revisão visual no navegador.

## Efeito sobre o snapshot disponível

Revalidação local em **05/11/2026 às 11h30 UTC**, sem coleta externa: de 26 manchetes únicas no snapshot original, 20 permanecem elegíveis. Há itens em 20/42 temas: 19/37 setores e 1/5 insumos. Os demais temas mantêm lacunas e estado de fonte; não foram fabricadas matérias para preenchê-los. Essas contagens envelhecem e não são fixadas na UI.

Snapshot original: geração `2026-11-05T10:14:30.807Z`, SHA256 `faebb26116428d55861c248a8a3ef1620c146e624665c054f0de24bb15df7f91`.

## Limites e próxima etapa

Requer auditoria independente do commit congelado antes de qualquer publicação. Não foi publicada esta mudança, nem habilitada coleta contínua. As limitações de licença/acesso e de persistência operacional da coleta setorial continuam válidas, conforme os documentos próprios. Não houve validação visual nem confirmação live de produção nesta etapa.
