# Recuperação judicial no painel

A tela compara menções empresariais em pedidos de recuperação judicial por data de publicação. O mapa agrupa pela UF empresarial e o treemap pelo setor informado. A participação usa o total do período, incluindo as menções sem UF ou setor.

As comparações usam os mesmos meses. Se o último mês estiver parcial, a janela do ano anterior termina no mesmo dia. A quantidade de edições disponíveis fica visível para avaliar a diferença de cobertura. Uma menção empresarial é a unidade da base e pode fazer parte de um processo com outras empresas.

## Atualização dos dados

O arquivo `cotacoes/public/recuperacao-historico.json` tem esquema 1 com `generatedAt`, datas ISO em `editions` e menções em `records`. Cada menção tem apenas `id`, `date`, `uf`, `sector` e `name`. Campos de classificação desconhecidos ficam nulos. A denominação só aparece quando a entrada identifica um CNPJ e expressa o tipo societário. A interface mantém a contagem mesmo quando a identificação empresarial fica oculta.

Prepare a entrada normalizada e as datas adicionais em arquivos privados. A execução abaixo parte de `cotacoes/`.

```powershell
node scripts/export-recovery-public.mjs caminho/normalizado.json caminho/datas-adicionais.json 2026-11-09T12:00:00Z
```

O exportador mantém edições e menções anteriores, recusa entradas duplicadas, datas inválidas e mudanças silenciosas de menções existentes, e grava o arquivo final por substituição. Uma revisão documental da edição é necessária antes de acrescentar datas ou ocorrências. A conferência semanal de referências é separada do carregamento histórico.

A geometria deriva da malha de UFs do IBGE, em resolução simplificada para visualização. Ela pode ser reprocessada com `node scripts/export-recovery-geography.mjs caminho/malha-UF.geojson`. [Malhas territoriais do IBGE](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais.html)

## Verificação

```powershell
node --test test/recovery-history.test.mjs test/recuperacao.test.mjs test/base-dados.test.mjs
npm run lint
npm run build
node scripts/smoke-recuperacao.cjs
```

O teste de navegador usa o preview do Vite. Com `SMOKE_LOCAL_DIST=1`, o navegador lê os arquivos produzidos pelo build por meio das rotas de teste. `SMOKE_CHANNEL` e `CHROMIUM_PATH` podem selecionar o executável instalado.

## Lote de 23/11/2026

Cinco edições do **Movimento Falimentar** foram abertas e conferidas no Valor Econômico. Entraram somente as duas menções sob o título editorial “Recuperação Judicial Requerida”. As demais etapas não entram neste painel. Sem atividade econômica validada, o setor ficou sem classificação.

| Edição | Menções adicionadas | Fonte |
| --- | ---: | --- |
| 16/11/2026 | 1 (UF do endereço não indicada; o juízo não foi usado como sede) | [Valor Econômico](https://valor.globo.com/empresas/noticia/2026/11/16/a5b6b414-movimento-falimentar.ghtml) |
| 17/11/2026 | 0; nota de ausência de registros | [Valor Econômico](https://valor.globo.com/empresas/noticia/2026/11/17/33ccd570-movimento-falimentar.ghtml) |
| 18/11/2026 | 0; nota de ausência de registros | [Valor Econômico](https://valor.globo.com/empresas/noticia/2026/11/18/ffcdf97b-movimento-falimentar.ghtml) |
| 19/11/2026 | 0 pedidos de recuperação judicial na edição | [Valor Econômico](https://valor.globo.com/empresas/noticia/2026/11/19/39ff00ea-movimento-falimentar.ghtml) |
| 23/11/2026 | 1 (PA) | [Valor Econômico](https://valor.globo.com/empresas/noticia/2026/11/23/4f6fcba0-movimento-falimentar.ghtml) |

20 a 22/11: não localizados na busca do jornal; datas não acrescentadas. O recorte anual até a última edição agora inclui 218 edições. O filtro inicial de meses completos foi mantido para preservar a comparação. A última edição disponível ficou visível acima dos filtros.
