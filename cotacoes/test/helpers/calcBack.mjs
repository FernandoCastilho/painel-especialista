// As calculadoras importam o ícone de voltar (CalcBack.jsx); nos testes de tela ele vira um componente vazio.
export const withCalcBack = (req) => (name) => (name === './CalcBack.jsx' ? { __esModule: true, default: () => null } : req(name))
