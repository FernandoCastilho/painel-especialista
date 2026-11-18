// Premissas de custo da calculadora do BNDES: quais custos financeiros cada produto ou programa aceita.
// Fonte: tabela "Produtos / Programas × Custo Prefixado / Custo Pós-Fixado" da calculadora BNDES usada por Fernando,
// registrada em 18/11/2026 (foto da tela). É regra de enquadramento, não taxa: não muda nenhuma conta do painel.
// Bases de cálculo conforme a mesma tabela; o agente financeiro confirma as condições de cada operação.

export const CUSTOS_PREMISSAS_FONTE = Object.freeze({
  registradoEm: '2026-11-18',
  origem: 'Tabela de premissas de custo da calculadora BNDES (Produtos / Programas × custos), enviada por Fernando em 18/11/2026.',
})

// Ordem das colunas da tabela original.
export const CUSTOS_BNDES = Object.freeze([
  { id: 'custoFixo', sigla: 'Custo Fixo', grupo: 'pre', base: '365/366', descricao: 'Amparado pelo PAAR (Plano Anual de Aplicação de Recursos).' },
  { id: 'tfb', sigla: 'TFB', grupo: 'pre', base: '365/366', carenciaMaxMeses: 12, descricao: 'Taxa Fixa BNDES, determinada pelo prazo da operação e pelo prazo para liberação dos recursos. Carência de até 12 meses com este custo.' },
  { id: 'tfbTr', sigla: 'TFB TR', grupo: 'pre', base: '365/366', descricao: 'Taxa Fixa baseada em TR, determinada pelo prazo da operação e pelo prazo para liberação dos recursos.' },
  { id: 'pre5', sigla: 'Pré 5', grupo: 'pre', base: '365/366', descricao: 'Taxa Prefixada FAT (Fundo de Amparo ao Trabalhador).' },
  { id: 'pre3', sigla: 'Pré 3', grupo: 'pre', base: '365/366', soMpme: true, descricao: 'Taxa Prefixada FAT (Fundo de Amparo ao Trabalhador), aplicada apenas para MPME.' },
  { id: 'tfc', sigla: 'TFC', grupo: 'pre', base: '365/366', descricao: 'Taxa Fixa Composta: blended, combina a Taxa Prefixada FAT com a TFB; determinada pelo prazo da operação.' },
  { id: 'tfcMpme', sigla: 'TFC MPME', grupo: 'pre', base: '365/366', soMpme: true, descricao: 'Taxa Fixa Composta: blended, combina a Taxa Prefixada FAT com a TFB; determinada pelo prazo da operação, aplicada apenas para MPME.' },
  { id: 'tfcTr', sigla: 'TFC TR', grupo: 'pre', base: '365/366', descricao: 'Taxa Fixa Composta: blended, combina recurso do FAT TR (60%) com a TFB Selic (40%).' },
  { id: 'tfbd', sigla: 'TFBD', grupo: 'pos', base: '360', foraDoItau: true, descricao: 'Taxa Fixa BNDES atualizada pelo índice de variação da taxa de câmbio. Não disponível no Itaú.' },
  { id: 'tlp', sigla: 'TLP', grupo: 'pos', base: '252', descricao: 'Taxa de Longo Prazo exigível: (i) taxa de juros prefixada e (ii) variação acumulada do IPCA.' },
  { id: 'selicLcd', sigla: 'SELIC_LCD', grupo: 'pos', base: '252', descricao: 'Taxas médias diárias da Selic capitalizadas ao saldo devedor, acrescidas da sobretaxa fixa LD1.' },
  { id: 'sofr', sigla: 'SOFR', grupo: 'pos', base: '360', descricao: 'Taxa de juros americana, publicada pelo Federal Reserve Bank de Nova York e divulgada pela Bloomberg, determinada pelo prazo da operação; a conversão do dólar ocorre no vencimento de cada parcela.' },
])

const PADRAO_FINAME = Object.freeze(['tfb', 'pre5', 'pre3', 'tfbd', 'tlp', 'selicLcd'])
const PADRAO_TFC = Object.freeze(['tfb', 'tfc', 'tfcMpme', 'tfbd', 'tlp', 'selicLcd'])

// Linhas na ordem da tabela original. `custos` = colunas marcadas com X.
export const PRODUTOS_BNDES = Object.freeze([
  { id: 'finame-demais-bks', tipo: 'Produto', nome: 'Finame - Demais BKs', custos: PADRAO_FINAME },
  { id: 'finame-materiais', tipo: 'Produto', nome: 'Finame - Materiais Industrializados', custos: PADRAO_TFC },
  { id: 'finame-baixo-carbono', tipo: 'Produto', nome: 'Finame - Baixo Carbono', custos: PADRAO_FINAME },
  { id: 'finame-maquinas-40', tipo: 'Produto', nome: 'Finame - Máquinas 4.0', custos: PADRAO_FINAME },
  { id: 'credito-pme', tipo: 'Produto', nome: 'BNDES - Crédito Pequenas e Médias Empresas', custos: PADRAO_TFC },
  { id: 'automatico-projetos', tipo: 'Produto', nome: 'BNDES - Automático Projetos de Investimentos', custos: PADRAO_FINAME },
  { id: 'automatico-emergencial', tipo: 'Produto', nome: 'BNDES - Automático Emergencial', custos: PADRAO_TFC },
  { id: 'fundo-clima-automatico', tipo: 'Programa', nome: 'BNDES - Fundo Clima Automático', custos: Object.freeze(['custoFixo']) },
  { id: 'mais-inovacao-difusao', tipo: 'Programa', nome: 'BNDES - Mais Inovação - Difusão Tecnológica', custos: Object.freeze(['tfcTr']) },
  { id: 'mais-inovacao-investimento', tipo: 'Programa', nome: 'BNDES - Mais Inovação - Investimento', custos: Object.freeze(['tfbTr']) },
  { id: 'finame-funttel', tipo: 'Programa', nome: 'BNDES - Finame Funttel', custos: Object.freeze(['tfbTr']) },
  { id: 'finame-fust-automatico', tipo: 'Programa', nome: 'BNDES - Finame FUST Automático', custos: Object.freeze(['tfbTr']) },
  { id: 'exim-pre-embarque', tipo: 'Programa', nome: 'BNDES - EXIM Pré-Embarque', custos: Object.freeze(['tlp', 'sofr']) },
])

export const custoBndes = id => CUSTOS_BNDES.find(custo => custo.id === id) ?? null
export const produtoBndes = id => PRODUTOS_BNDES.find(produto => produto.id === id) ?? null

// Custos que o produto aceita. Com `mpme: false`, tira os custos exclusivos de MPME (Pré 3 e TFC MPME).
export function custosPermitidos(produtoId, { mpme = null } = {}) {
  const produto = produtoBndes(produtoId)
  if (!produto) return []
  return produto.custos.map(custoBndes).filter(custo => mpme !== false || !custo.soMpme)
}

// Diz se o custo pode ser usado no produto e, se não puder, por quê.
export function avaliarCusto(produtoId, custoId, { mpme = null } = {}) {
  const produto = produtoBndes(produtoId), custo = custoBndes(custoId)
  if (!produto) return { permitido: false, motivo: 'Produto ou programa fora da tabela de premissas.' }
  if (!custo) return { permitido: false, motivo: 'Custo financeiro fora da tabela de premissas.' }
  if (!produto.custos.includes(custoId)) return { permitido: false, motivo: `${custo.sigla} não é aceito em ${produto.nome}.` }
  if (custo.soMpme && mpme === false) return { permitido: false, motivo: `${custo.sigla} vale apenas para MPME.` }
  return { permitido: true, motivo: null }
}

// Como cada calculadora do painel se encaixa na tabela: produto de referência e custos que a tela oferece.
// Os custos oferecidos precisam estar entre os permitidos (conferido nos testes).
export const PERFIS_PAINEL = Object.freeze([
  { perfil: 'finame-materiais', produtos: ['finame-materiais'], custos: ['tfc', 'tfcMpme', 'tfb', 'tlp'], nota: 'A TFC usa a série MPME quando o porte é MPME; TLPCAP é o perfil capitalizado da TLP.' },
  { perfil: 'bndes-tlp-exigivel', produtos: PRODUTOS_BNDES.filter(p => p.custos.includes('tlp')).map(p => p.id), custos: ['tlp'], nota: 'Vale para os produtos que aceitam TLP.' },
  { perfil: 'bndes-selic-lcd', produtos: PRODUTOS_BNDES.filter(p => p.custos.includes('selicLcd')).map(p => p.id), custos: ['selicLcd'], nota: 'Vale para os produtos que aceitam SELIC_LCD.' },
  { perfil: 'bndes-credito-tfb', produtos: ['credito-pme'], custos: ['tfb'], nota: 'Cenário de conferência com TFB.' },
])
