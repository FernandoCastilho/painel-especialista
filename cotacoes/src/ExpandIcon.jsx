// Ícone único de "ampliar" (duas setas em diagonal), usado em todos os gráficos e quadros que abrem maiores.
// Desenhado pelo CSS (máscara na cor do texto, em Direcao.css), e não como <svg>: assim o ícone não se mistura
// aos desenhos do próprio gráfico. Decorativo: o nome do botão vem do aria-label de quem usa.
export default function ExpandIcon() {
  return <span className="icon-expand" aria-hidden="true" />
}
