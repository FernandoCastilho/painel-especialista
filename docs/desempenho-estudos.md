# Carregamento dos estudos setoriais

Os 67 recortes revisados continuam em `cotacoes/src/sectorStudies/studies.json`, fonte editorial única. O preparo de desenvolvimento e de build gera cópias integrais por recorte em `public/sector-studies/`, ignoradas pelo Git, e um catálogo leve de identidades. A tela lê somente o recorte escolhido e permite tentar novamente em falha.

Medição do mesmo build Vite, sem mudança de dependências: o JavaScript da seção Setores passou de 1.587,70 kB (219,51 kB gzip) para 67,13 kB (20,66 kB gzip), reduções de 95,8% e 90,6%. A medição compara o pacote principal da seção; cada estudo passa a ser uma transferência JSON adicional quando aberto. Não representa medição de latência em dispositivos reais.

O teste `sector-content-loading.test.mjs` compara cada arquivo gerado à fonte completa, impede duplicidade de identidade e verifica limpeza de arquivos gerados antigos. Os testes de navegador de recortes e navegação precisam passar no CI antes da publicação.

Sem rede, um recorte ainda não visitado pode não estar disponível. Estudos já visitados podem usar a última cópia retida pelo cache; a tela preserva suas datas originais. O conteúdo editorial não foi reescrito nem submetido a nova auditoria factual nesta manutenção.
