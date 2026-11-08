# Imagens dos setores

Fotografias ilustrativas geradas por IA para este painel em 08/11/2026, sem identificação de empresas ou instalações reais. Representam atividades e produtos; não são evidência de instalações ou operações específicas.

Cada JPG tem 1536 × 1024 pixels e nove células em grade 3 × 3, lidas da esquerda para a direita e de cima para baixo. A célula 0 representa o setor; as células 1 a N correspondem aos subsetores, na ordem de `src/centralSetorial.js`. Células extras não são usadas.

Os nomes dos arquivos correspondem aos IDs dos onze setores. O componente `SectorImage` recorta cada célula em 16:9 sem deformar a imagem. As fotos são decorativas: nome, contagem e ação permanecem no texto acessível do cartão. O carregamento é adiado até perto da área visível; falhas de imagem preservam o cartão e sua navegação.

Origem e ordem dos ativos revisadas pelo Diretor de Arte. Somente os JPGs são publicados; PNGs e dados intermediários da geração ficam fora do aplicativo.
