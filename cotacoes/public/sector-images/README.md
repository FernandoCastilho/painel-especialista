# Imagens dos setores

Fotografias ilustrativas geradas por IA para este painel em 08/11/2026 (onze setores originais) e 17/11/2026 (Turismo, Varejo, Saúde e Pet), sem identificação de empresas ou instalações reais. Representam atividades e produtos; não são evidência de instalações ou operações específicas.

Cada JPG tem 1536 × 1024 pixels e nove células em grade 3 × 3, lidas da esquerda para a direita e de cima para baixo. A célula 0 representa o setor; as células 1 a N correspondem aos subsetores pelo vínculo explícito em `src/sectorImages.js`, independente da ordem do catálogo. Células extras não são usadas.

Os nomes dos arquivos correspondem aos IDs dos quinze setores. O componente `SectorImage` recorta cada célula em 16:9 sem deformar a imagem. As fotos são decorativas: nome, contagem e ação permanecem no texto acessível do cartão. O carregamento é adiado até perto da área visível; falhas de imagem ou tópicos ainda sem vínculo mostram um símbolo neutro e preservam o cartão e sua navegação.

Origem e ordem dos ativos revisadas pelo Diretor de Arte. Somente os JPGs são publicados; PNGs e dados intermediários da geração ficam fora do aplicativo.
