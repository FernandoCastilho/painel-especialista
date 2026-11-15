// Números que abrem o "Resultado estimado" do Finame, sempre à vista. São quadros que já existem em
// "Composição do resultado": aqui só se escolhe quais sobem e em que ordem. Nenhuma conta é feita neste arquivo.
export const FINAME_DESTAQUES = ['taxa', 'parcelas', 'juros', 'total']

// Recebe os quadros da composição ({ id, ... }) e devolve os destaques, na ordem acima. Quadro ausente fica de fora.
export function destaquesFiname(quadros) {
  const lista = Array.isArray(quadros) ? quadros : []
  return FINAME_DESTAQUES.map((id) => lista.find((q) => q?.id === id)).filter(Boolean)
}
