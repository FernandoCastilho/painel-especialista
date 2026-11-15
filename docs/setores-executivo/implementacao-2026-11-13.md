# Setores: leitura executiva e ampliação de catálogo

## Escopo implementado
- Resumo executivo, indicadores a acompanhar e ponto de atenção antes dos subsetores, para todos os 15 grupos.
- Preservados os 11 grupos anteriores e a posição dos tópicos (inclusive TIC/NEC e válvulas).
- Novos grupos: Turismo (4 recortes), Varejo (alimentos, bebidas, vestuário), Saúde (3 recortes) e Pet (3 recortes).
- Distinção entre indústria de alimentos/confecção e varejo, sem recriar estudos industriais.
- Novos cards usam ícones editoriais vetoriais, não fotografias atribuídas a negócios reais.
- Novos recortes entram no grafo e na busca; fontes associativas reaproveitadas quando pertinentes, sem inventar players.
- A data mostrada pelo estudo deixa de ser fixa e passa a usar sua data documental.

## Verificação e limites
- Testes locais de navegação/catálogo: 16 aprovados. Build passou.
- Lint inicial: zero erros e cinco avisos preexistentes.
- Suíte completa identificou ausência de diagrama nos novos estudos; mantido teste exigindo esse conteúdo, sem afrouxá-lo.
- Chromium local, mesmo após tentativa autorizada fora do sandbox padrão, falhou com `socket() failed: Operation not permitted`; não houve inspeção visual local. CI precisa executar smokes em 320/390/768/1440 px, claro/escuro.
- Pesquisa nova permanece pendente de aprofundamento e revisão documental. Não foi marcada `approved`.
- Nenhum merge, publicação ou aviso externo realizado por esta entrega.

## Atualização após aprofundamento e auditoria
- Acrescentados diagramas específicos, ciclos, gráficos de contexto e fontes verificáveis nos 13 novos estudos, transcrições textuais ampliadas e registro de pesquisa recente.
- Auditoria documental independente conferiu ANS (10 pontos), série Pet (12 pontos), PMC/PMS e fontes regulatórias. Correção obrigatória aplicada: “Volume doméstico” passou a “Volume de atividades turísticas”, pois a PMS não separa a origem do viajante.
- Estudos aprovados documentalmente com ressalvas explícitas: indicadores agregados não medem cada subsetor, séries curtas não equivalem a histórico longo e pesquisa de notícias/M&A não é exaustiva. Não há áudio gerado.
- Build e 1.892 testes passaram antes do último refinamento documental; nova verificação final e CI necessários.
- Publicação autorizada pelo usuário após conclusão das verificações.

## QA visual e correção de regressão do teste
- CI do commit `4c4304e`, execução `43407352225`: estudos, pastas em oito cenários, grafo, build e testes passaram. Um smoke geral falhou porque sua expectativa ainda era 11 pastas; atualizado para conferir o catálogo vigente, que tem 15, mantendo a asserção de contagem.
- Artefato `pastas-setoriais-design` (ID 14028376258), relatório `passed: true`. Inspecionadas capturas reais: Varejo 390 px claro, Turismo 320 px escuro, Saúde 1440 px claro, Pet 390 px escuro. Destaque precede os cards, texto legível sem corte horizontal. A barra fixa de navegação atravessa a captura de página inteira na posição da viewport; não foi interpretada como conteúdo duplicado.
- A mudança de expectativa é do teste, não relaxa o número de setores nem remove verificação. Nova rodada integral de CI exigida antes da integração.
