# Fredix, o agente do painel

Data: 24/11/2026. Pedido de Fernando: transformar o mascote Fredix (coruja) em um agente de pesquisa que conversa com o usuário dentro do painel.

## Combinado aprovado

- O chat fica aberto a qualquer visitante, no botão "💬 Pergunte" da coruja.
- Fredix responde **só com os dados que o painel publica** e cita a fonte e a data. Ele não pesquisa na internet.
- Ele não faz contas de taxa, CET, IOF, parcelas ou projeções: indica a calculadora do painel.
- Ele recusa CPF, CNPJ, telefone e e-mail. A checagem acontece no navegador e outra vez no servidor.
- Nenhuma conversa fica gravada. O servidor guarda só contagens de uso e gasto.
- O teto é de R$ 50 por mês. Ver "Limites".

## Como funciona

```
Navegador (painel)  →  Servidor Fredix (Cloudflare Workers)  →  IA (Anthropic, modelo claude-haiku-5-5)
                              ↓ lê só arquivos da lista
                       site do painel (GitHub Pages) e cotações (ramo data)
```

- O **painel** está em `cotacoes/src/FredixChat.jsx`, `fredix.js` e `fredixSeguranca.js`. O endereço do servidor e a chave pública do anti-robô ficam em `cotacoes/src/fredixConfig.json`. Enquanto o endereço estiver vazio, a janela mostra "em configuração" e não envia nada.
- O **servidor** está em `cotacoes/worker/`:
  - `fredix.mjs` cuida de origem permitida, anti-robô, limites e chamada à IA.
  - `fredix-core.mjs` traz as regras, o laço do agente, a leitura dos dados e as contagens.
  - `wrangler.toml` guarda a configuração da Cloudflare.
- O **agente** usa uma única ferramenta, `ler_dados_do_painel`, que só aceita os arquivos de `ARQUIVOS`. As séries longas vêm resumidas, com os primeiros e os últimos pontos. Cada pergunta tem no máximo 4 rodadas de consulta. Se o gasto de uma pergunta passar de US$ 0,03, ele encerra e responde.

## Limites (em `wrangler.toml`, ajustáveis sem mexer no código)

| Limite | Valor | Efeito |
|---|---|---|
| Teto mensal no servidor | US$ 8 (cerca de R$ 47 com o dólar a R$ 5,93) | O Fredix pausa até o mês virar |
| Teto diário | US$ 0,27 | Pausa até o dia seguinte, para o mês não acabar num dia |
| Perguntas por dia (todos) | 300 | Proteção extra |
| Por visitante | 10 por hora e 30 por dia | Contra abuso |
| Teto na conta da Anthropic | US$ 8 por mês (Fernando define no console) | Trava final, fora do nosso código |

O gasto é estimado pelo preço do modelo, de US$ 0,10 por milhão de tokens de entrada e US$ 0,50 por milhão de saída, arredondando para cima. Ressalva: duas perguntas ao mesmo tempo podem passar um pouco do teto, porque o caderno de contagens da Cloudflare não trava a gravação. A trava da conta da Anthropic cobre essa folga.

O visitante é identificado por um resumo criptográfico do IP, que muda todo dia. O IP não é gravado.

## Publicação (cada passo depende do Sim de Fernando)

1. Fernando cria, na Cloudflare, o caderno KV `fredix-limites` e o anti-robô (Turnstile). Na Anthropic, cria a conta, coloca o teto e cria a chave. No GitHub, cadastra os segredos `CLOUDFLARE_API_TOKEN`, `ANTHROPIC_API_KEY` e `TURNSTILE_SECRET_KEY`.
2. Em `cotacoes/worker/wrangler.toml`, preencher `account_id` e o `id` do KV. Esses dados não são segredo.
3. Rodar à mão a rotina **"Fredix — publicar servidor"** (`.github/workflows/fredix-publicar.yml`). Ela confere o código, publica o servidor e grava as chaves nele.
4. Em `cotacoes/src/fredixConfig.json`, colocar o endereço do servidor (`https://fredix.<conta>.workers.dev`) e a Site Key do anti-robô. Depois, juntar ao ramo principal, o que coloca o botão no ar.
5. Testar no site com 3 perguntas e conferir o gasto no console da Anthropic.

Para desligar: apagar o endereço em `fredixConfig.json`, ou reduzir `TETO_MENSAL_USD` para um valor mínimo e publicar de novo.

## Conferências

- `cotacoes/test/fredix.test.mjs` cobre:
  - dado sensível;
  - formato da conversa;
  - limites por visitante, por dia e por mês, inclusive a virada;
  - leitura e filtro dos dados;
  - laço do agente, recusa da IA e fim do laço;
  - servidor: origem, anti-robô, configuração faltando, limite estourado, 11ª pergunta na hora e nada de conversa gravada.
- `cotacoes/test/fredix-ui.test.mjs` cobre a janela: envio, bloqueio de CPF, falha que preserva a pergunta, clique duplo e servidor não configurado.
- Ainda não foi testado com a IA de verdade, porque depende da chave. A primeira pergunta real fica para o passo 5.
