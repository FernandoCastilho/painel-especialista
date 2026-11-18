# Ajuste dos gráficos e logos das Projeções (18/11/2026)

Pedidos do Fernando em 18/11/2026, depois da etapa 1 da direção de arte:

1. Trocar o botão "Ampliar" dos gráficos por um ícone pequeno ao lado do sol (modo claro do gráfico), para ganhar espaço e deixar tudo harmônico.
2. Deixar todos os gráficos do mesmo tamanho de quadro.
3. Pôr a marca de cada instituição na tabela de Projeções (Cenários › Projeções).

Nenhuma regra de cálculo, dado ou fonte de dado mudou.

Fotos: pasta `docs/ajuste-graficos-20261118/` (Juros no computador e no celular, Projeções no computador).

## O que mudou

| Pedido | O que foi feito |
|---|---|
| Ícone de ampliar | Um ícone só (duas setas em diagonal), 32 × 32 px no computador e 44 × 44 px no celular, no canto de cima à direita. Substitui o "Ampliar ⤢" e o "Maximizar gráfico" em Juros, o "Maximizar gráfico" em Projeções (histórico do Focus), Inadimplência, Recuperação judicial e BNDES, o "Tela cheia" do quadro Mercado hoje e o "Ampliar ↗" do Comparador de Crédito. O nome falado por leitores de tela não mudou. |
| Juros: um ícone por quadro | Cada quadro de Juros tinha dois botões ("Ampliar", acima do quadro, e "Maximizar gráfico", dentro). Ficou só o ícone, no cabeçalho do quadro, depois do atualizar e do sol. Ele abre o detalhe com período e tabelas, como o clique no quadro. Dentro do detalhe, o gráfico continua podendo ir para tela cheia. |
| Mesmo tamanho | No computador, os 11 quadros de Juros têm o mesmo tamanho (medido: 706 × 530 px a 1440 px de largura), nos dois blocos (Brasil e Outros países). O gráfico fica no pé de cada quadro, então os eixos de dois quadros lado a lado ficam na mesma altura. No celular (uma coluna), cada quadro mantém a altura do próprio conteúdo. |
| Marcas nas Projeções | Bandeira do Brasil no Focus (boletim do Banco Central) e o logotipo oficial de cada banco (Itaú BBA, Bradesco, Santander, BB e BTG), das cópias locais já usadas na aba Bancos (`public/bank-logos`, origem no README da pasta). |
| Balão do "?" | Correção encontrada nos testes: o balão de explicação dos gráficos fechava com qualquer rolagem da tela, mesmo sem o "?" sair do lugar. Agora só fecha se o "?" se mover. Isso também resolve uma falha intermitente na conferência automática do Cupom cambial, que já acontecia na versão publicada. |

## Decisões tomadas sem consulta (reversíveis)

- **Focus com a bandeira do Brasil.** O símbolo do Banco Central disponível no site oficial tem 32 px e 16 cores, e ficaria borrado.
- **"Mesmo tamanho" valeu para Juros**, que é a tela com grade de gráficos lado a lado. As outras telas têm um gráfico por linha ou quadros de outro tipo.
- **No celular, os quadros não foram igualados.** Com uma coluna só, igualar pela altura do maior criaria espaços vazios grandes.
- **Calculadoras:** receberam só o ícone novo; as cores continuam as delas.
- **Panorama do dia:** mantém o próprio desenho do ícone (no canto de baixo do minigráfico).

## O que foi conferido

- Testes do painel: 2.108 passando (1 novo: cada banco das Projeções tem logotipo no projeto). Conferência de código: sem erros.
- Juros medido: 11 quadros iguais, ícone no mesmo lugar em todos (12 px das bordas).
- Ícone visto no computador e no celular em Juros, Projeções, Inadimplência, Recuperação judicial, BNDES e Mercado. Abrir e fechar a tela cheia pelo ícone e pela tecla Esc: ok.
- Cupom cambial: a conferência passou 5 de 5 vezes depois da correção do balão. Antes, falhava às vezes também na versão publicada (1 de 3).

## O que não deu para conferir

- Aparelho físico (iPhone, Android) e Windows.
- A conferência automática de Inadimplência pede outro navegador (Edge), que não existe neste ambiente nem na rotina automática do GitHub.
