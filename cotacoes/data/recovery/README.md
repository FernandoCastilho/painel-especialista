# Recuperação TFC — 15/11/2026

Snapshot pontual dos 24 arquivos oficiais `https://www.bndes.gov.br/Moedas/umCxx.txt`, capturados em 15/11/2026. Contém os textos originais, URLs e SHA-256 individuais; o SHA-256 do JSON inteiro está fixado em `scripts/recover-tfc.mjs`.

Motivo: o site publicado ficou com `moedas.json` contendo somente LD1 e `csv/tfc.csv` somente com o cabeçalho. Isso impede preservação de dados nos ciclos de Trends.

O passo de recuperação roda após o coletor de moedas e antes da exportação de CSV, somente nas execuções regulares. Nunca sobrescreve séries TFC existentes com pontos válidos. Séries ausentes recebem o snapshot e marca `stale` com a captura original. LD1, outras moedas, erros originais e `generatedAt` são preservados. Arquivo local ausente é recuperado da publicação anterior antes de complementar TFC; arquivo malformado bloqueia a operação.

O snapshot contém 4.970 pontos, com última referência em 13/11/2026 para todas as 24 séries. Não contém as moedas 604/143 nem faz coleta LD1. A atualização automática posterior continua responsabilidade do coletor regular.

Segurança: snapshot alterado, origem divergente, série não permitida ou falta de base válida interrompem a recuperação. Não há opção de ambiente para ignorar o hash. A publicação não deve passar se recuperação ou exportação falharem.

Integração: revisar diff sobre HEAD atual, executar testes e build, passar gates de CI e publicar pelo fluxo normal. Depois conferir JSON e CSV públicos e uma rodada de preservação de Trends. Não alterar cron nem desabilitar os gates para recuperar dados.
