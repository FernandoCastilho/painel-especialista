# M&A — implementação de 2026-11-23

## Entrega
Menu M&A após Setores no computador e em Mais no celular, preservando atalhos. Visão geral com filtros digitáveis, totais, mapa IBGE com bolhas por UF e ranking setorial. Bolhas e setores abrem a lista filtrada. Busca sem acentos, paginação, detalhes, fontes e histórico por operação. Links entre M&A e os setores. Temas claro e escuro e laranja de contraste adequado.

O mapa localiza a adquirida/ativo, não o comprador. Área das bolhas proporcional à contagem; localização ausente permanece no total e fora do mapa. Estado, setor, ano, mês, busca e seleção têm endereço próprio; voltar/avançar preservam o recorte. Selecionar transação traz seu detalhe à vista.

## Acervo e histórico
Cinco operações reais publicadas em dezembro de 2025: Dasa/São Domingos, Bionexo/Tasy, V.tal/Um Telecom, Savencia/Quatá e Hindiana/Neogrid. Cobertura **inicial e parcial**, indicada nas telas. Não foi importado todo o portal. 2026 permanece consultável com estado vazio explicativo; atualização de notícia antiga não é nova transação. Situação preserva a informação da notícia datada, sem afirmar que continua atual.

Seis notas salvas e conferidas no Obsidian em `30. Recursos/LLM Wiki`: panorama em `concepts/ma-panorama.md`, operações em `queries/ma/2025/`. Índice e log atualizados. Manifesto e recibo em `ma-obsidian-manifest.json` e `ma-obsidian-receipt.json`. Script recusa divergências, usa trava e permite retomar execuções incompletas; testes usam pasta temporária separada.

O código versiona uma cópia das notas. O recibo registra a gravação inicial. Quatro fichas foram revisadas no repositório após a auditoria; o manifesto contém os hashes novos e diverge do recibo histórico. Essas correções não foram gravadas no vault. `build-ma-content.mjs` prepara o catálogo do painel a partir dessas notas. Alterações futuras no vault precisam ser reconciliadas com a cópia versionada antes do build; não existe sincronização automática nem coleta agendada nova. O painel não mostra detalhes de armazenamento.

## Verificações
- 69 testes direcionados de M&A, menu, comandos e Setores: passaram.
- Lint: sem erros, cinco avisos anteriores fora do módulo.
- Build: passou; aviso anterior de tamanho do pacote de Calculadoras permanece.
- Conferência visual/funcional: 320, 390, 820, 1024, 1440 e 1920 px, claro/escuro; 12 casos passaram. Inclui alvos do menu, mapa via teclado, busca, detalhe visível no celular, volta por Setores, filtros, vazio de 2026 e histórico de navegação.
- Regressão das pastas de Setores: oito cenários de teclado, histórico, recarga e estudos passaram localmente. Os roteiros antigos foram atualizados para incluir M&A no menu, sem mudar o comportamento das pastas.
- Sincronização do histórico: retomada parcial, segunda aplicação sem duplicações e preservação de divergências passaram em diretório temporário. Gravação real conferida por SHA-256.
- Suíte geral no Windows: 2.527 testes, 2.496 passaram e 31 falharam. Referência anterior à implementação: 2.516 testes, 2.484 passaram e 32 falharam. Comparação de nomes não encontrou falhas novas; não chamar a suíte local de verde. Ver `ma-qa/verification.json`. A maioria envolve suporte anterior de caminhos/Python/Git no Windows.

## Revisão independente e simplificação
Revisor em contexto separado identificou retomada de gravação, rolagem/detalhes no celular e proporção das bolhas. Ajustes aplicados e verificados. Reaproveitados mapa e rotas existentes; resumo calculado uma vez, sem dependências novas. Revisão de excesso feita diretamente; não foi acionado um agente Simplificador instalado.

## Publicação
Entrega em ramo separado para PR e CI. Não houve merge nem publicação. Os checks remotos da revisão candidata devem passar antes de solicitar autorização final de publicação, conforme AGENTS.md e CLAUDE.md.

# Atualização de 2026-11-23: transações de 2026

## Entrega
305 transações anunciadas entre 01/01 e 23/11/2026, uma nota por operação em `wiki/queries/ma/2026/` e o catálogo do painel refeito por `build-ma-content.mjs` (310 registros com o acervo de 2025). Mapa e barras do M&A passaram a ser legíveis no tema escuro (#583). Setores sem pasta em Setores (energia, financeiro, saneamento, educação, petróleo, mineração, imobiliário, agronegócio, serviços) entram sem o botão "Ver em Setores".

## Regra de inclusão
Empresa ou ativo operacional adquirido no Brasil; anúncio (ou, sem anúncio, publicação) entre 01/01 e 23/11/2026; negócio assinado. Ficam de fora: anúncios de 2025 concluídos em 2026, rumores e memorandos, reorganizações do mesmo grupo, recompras, OPA do controlador para fechar capital, compra de imóveis ou frações de imóveis/shoppings/galpões sem compra de empresa, empresa nova criada em sociedade, adquirida no exterior.

## Fontes da base (ordem de uso)
1. Descobrir operações: [CVM — Dados Abertos, fatos relevantes e comunicados (IPE)](https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe); [Cade](https://www.gov.br/cade/pt-br) e despachos da Superintendência-Geral no [Diário Oficial](https://pesquisa.in.gov.br).
2. Confirmar termos e fechamento: comunicados das empresas (RI e documento na CVM) e [B3 — Empresas Listadas](https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage/?language=pt-br). Aprovação do Cade não prova conclusão.
3. Completar a cobertura: NeoFeed, Brazil Journal, Money Times, InfoMoney, Forbes Brasil, Finance News; por setor Baguete (TI), Teletime (telecom), Mercado & Consumo (varejo). [Pesquisa trimestral da KPMG](https://kpmg.com/br/pt/insights/2026/08/pesquisa-trimestral-m-a-2-trimestre-2026.html) só para comparar o tamanho do mercado.
4. Acervo histórico: [Portal Fusões & Aquisições](https://fusoesaquisicoes.com/transacoes-no-brasil/) até dez/2025; [pausa anunciada em 31/12/2025](https://fusoesaquisicoes.com/hr/um-legado-de-transparencia-o-encerramento-de-um-ciclo-e-a-perenidade-da-informacao-missao-cumprida/). Conferir em cada atualização se voltou a publicar.

Descartadas: acionista.com.br (textos gerados por IA, bloqueia robôs), Visno Invest (recusa acesso), M&A Community (bloqueia leitura automática).

## Verificações
- Levantamento em duas rodadas (por bimestre a partir da CVM; por setor na imprensa) e varredura parcial do Cade: 364 registros brutos, 9 duplicatas.
- Conferência registro a registro das 350 operações contra a fonte (6 lotes + amostra independente de 45): 48 removidas, 242 campos corrigidos, situação atualizada até 23/11/2026.
- Comparação: KPMG contou 610 transações no 1º semestre de 2026; a base tem 170 (cerca de 28%).

## Limites
- Cobertura parcial, indicada no painel. O Cade foi lido só em parte: o SEI bloqueia acesso automático e o Diário Oficial recusa consultas em sequência (cerca de 1.480 despachos da Superintendência-Geral em 2026). Próxima etapa: varredura do Diário Oficial com leitura lenta ou pelo navegador de Fernando.
- Vários registros foram conferidos por resumo de busca quando a página da fonte não abria nesta sessão; a fonte gravada é a que foi vista.
- Situação conforme a fonte mais recente encontrada; não garante o estado atual. Sem rotina de atualização automática.
- As notas de 2026 estão no repositório; a gravação no vault do Obsidian fica pendente (script `ma-obsidian-sync.ps1`).
