# ICMS-ST no Aprender

## Escopo

Pedido: incluir explicação detalhada de substituição tributária e diagrama animado no estilo motion graphics. Rota: `#aprender/substituicao-tributaria`. Usa a identidade atual do Painel e não altera as calculadoras, os coletores, a política de publicação ou os outros trabalhos em andamento.

## Evidência fiscal

Conteúdo revisto em 08/11/2026. Fontes oficiais exibidas no próprio conceito:

- [SRE 34/2026](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-SRE-34-de-2026.aspx): art. 1º revoga Anexos VII, VIII, XIV, XVIII e XXI e itens 2 a 10 e 15 do XXII da CAT 68/2019. Art. 2º remete o estoque à CAT 28/2020. Art. 3º determina efeitos em 01/10/2026.
- [CAT 28/2020, redação vigente](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-CAT-28-de-2020.aspx): art. 2º, estoque no final do dia anterior, relatório por mercadoria e inventário; art. 3º e anexos IV/V, cálculo conforme regime e operação; art. 3º, §2º, 12 parcelas mensais iguais e sucessivas no RPA, pela redação da SRE 07/2026; §3º, dedução própria do Simples no PGDAS-D e transporte do saldo; art. 4º, informação de base de retenção e nota complementar; art. 6º, saídas sob normas comuns desde a exclusão, incluindo estoque anterior. A redação antiga de 24 parcelas está superada.
- [CAT 68/2019](https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-CAT-68-de-2019.aspx): mercadoria, descrição e NCM devem ser cotejadas com o item vigente e a operação. CNAE não define sozinho o enquadramento.
- [RC 40205/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC40205_2026.aspx): instrumentos de medição da subposição 9030.3 permanecem na ST nas hipóteses consultadas; operações para outro estado exigem verificar a legislação do destino.

Não se afirma isenção, redução de alíquota, ganho garantido de margem, fim nacional da ST ou crédito em dinheiro imediato. Efeitos de caixa são condicionais. O crédito do estoque de 30/09/2026 é separado do efeito recorrente nas novas compras. O fluxo normal ilustrado é RPA, com ressalva explícita do Simples/DAS.

## Direção visual e interação

Dois regimes e quatro cenas por regime. A mercadoria é representada horizontalmente no desktop e verticalmente no celular; o recolhimento tem rótulo e direção próprios para o Fisco. Estados ativos têm texto e borda, não somente cor. O usuário inicia a reprodução, pode pausar, avançar, voltar ou reiniciar; a reprodução termina e não faz loop. Mudança de regime, preferência de movimento e ocultação da página pausam. Timers/listeners são removidos na desmontagem. Preferência de movimento reduzido remove animações e mantém controles manuais. Todas as etapas podem ser lidas juntas em uma transcrição.

O exemplo é hipotético: bases 100/150/200, alíquota 18%, base presumida 200, sem créditos anteriores ao fabricante e sem ajustes. Débitos 18/27/36, créditos 0/18/27, recolhimentos 18/9/9. Em ST, próprio 18 + antecipação 18. Os dois totais 36 são consequência das hipóteses, não previsão fiscal.

## Verificação

- Lógica e integração: `node --test test/icms-st.test.mjs test/educacao.test.mjs test/aprender-navigation.test.mjs test/knowledge-map-ui.test.mjs`.
- Suíte: `npm run lint`, `npm test`, `npm run build`.
- Navegador: `scripts/smoke-icms-st.cjs`, incluído no CI. Matriz 390/820/1280 × claro/escuro; modos, oito etapas, controles, teclado, voltar, reload, busca, movimento, reduced motion, fim automático, overflow e erros. Capturas e relatório no artefato `icms-st-design`.
- Limite local: o Chromium não abriu por `socket() failed: Operation not permitted`. Nenhuma alteração na restrição. Evidência visual e navegador dependem do CI; não declarar validação local.
- Celular físico e leitor de tela real não estão cobertos pelos testes automatizados.

## Checklist de UX do escopo

1 Hick: dois modos, controles por tarefa. 2 Fitts: alvos 44 px, foco visível; verificar capturas e teclado. 3 Jakob: preserva Aprender e controles familiares. 4 Proximidade: regime, cena e legenda agrupados. 5 Miller: quatro etapas com transcrição, sem depender de memorização. 6 Doherty: resposta de estado imediata por projeto; latência não medida. 7 Von Restorff: um destaque da cena, aviso fiscal explícito. 8 Fitts/distância: controles ao lado da legenda. 9 Posição serial: abre com cadeia e encerra com caixa. 10 Pico-fim: fim não reinicia e deixa resultado legível. 11 Zeigarnik: pausa mantém etapa; navegação reinicia de forma explícita e não persiste progresso. 12 Occam: CSS/React existentes, sem biblioteca nova. 13 Tesler: complexidade fiscal em texto e fontes; não simula enquadramento. 14 Postel: não aplicável a entrada numérica, pois não há formulário fiscal. 15 Murphy: troca de modo, ocultação, unmount e preferência limpam reprodução. 16 Semelhança: controles iguais têm função igual. 17 Conectividade: cadeia e Fisco rotulados. 18 Parkinson: nenhuma urgência; avanço manual disponível. 19 Carga cognitiva: uma cena por vez, transcrição e regras detalhadas separadas. 20 Gradiente: etapa real 1 a 4, sem progresso inventado. Estados documentais e testes de lógica não substituem inspeção das capturas finais.

## Revisão editorial de 08/11/2026

Fernando rejeitou o primeiro visual por parecer uma animação com instruções de player e pediu uma página HTML incorporada, refeita pelo Diretor de Arte. Ideação recomendou reportagem contínua; o Diretor de Arte inspecionou as capturas anteriores e definiu duas cenas completas empilhadas com ilustrações vetoriais próprias, conexões ao Fisco e leitura possível sem interação. Esta revisão substitui a interface de etapas descrita acima; os registros anteriores ficam como histórico, não como descrição vigente.

O artigo ICMS passa a ocupar a área de explicação, preservando busca, lista, rota, histórico e conexões de Aprender. Não há iframe, rolagem interna, player, alternância de modos ou instruções de reprodução. As cenas ST e RPA ficam disponíveis juntas. SVGs decorativos representam os agentes; nomes, papéis, regras e valores são HTML. Abaixo de 620 px de largura útil, a cadeia fica vertical e o canal tributário chega ao Fisco no rodapé. Há uma única passagem de até 2,7 segundos por cena, ao entrar em viewport. Sem observador, tudo continua legível e estático. Redução de movimento ou ocultação da página interrompe o efeito; a volta à cena não o repete.

O conteúdo fiscal continua baseado nas mesmas fontes. O exemplo permanece hipotético e distingue imposto próprio, ST e débitos/créditos admitidos no RPA. A transição paulista preserva produto/descrição/NCM/operação, estoque em 30/09, saídas desde 01/10, 12 parcelas no RPA, regra própria do Simples e limites de caixa. O detalhamento numérico, fontes, teste de compreensão e conexões continuam acessíveis sem duplicar toda a narrativa.

Validação prevista no candidato: oito cenários reais de navegador (320/390/820/1280 px, claro/escuro), fotos do contexto, cenas, comparação e transição; conectores por geometria; contraste calculado em amostras de texto; navegação por teclado, busca, Voltar e recarga; movimento finito e redução de movimento. Capturas não substituem revisão do Diretor de Arte, e os testes não certificam acessibilidade integral nem teste em telefone físico ou leitor de tela real. Aprovação visual final e auditoria ficam condicionadas às evidências do candidato, não à aprovação da direção.

Checklist de 20 itens UX no contrato do Diretor de Arte: 1 Hick, 4 proximidade, 5 Miller, 7 destaque, 12 Occam, 16 semelhança, 17 conectividade e 19 carga cognitiva corrigidos na direção, pendentes de inspeção final; 2 Fitts e 8 distância aplicáveis aos links remanescentes; 3 Jakob preserva navegação do Painel; 6 Doherty sem alegação de latência medida; 9 posição serial e 10 pico-fim organizam a narrativa; 11 Zeigarnik e 20 gradiente de meta não aplicáveis à leitura sem tarefa pendente; 13 Tesler mantém cálculo e condições; 14 Postel não aplicável sem entradas; 15 Murphy coberto por alternativas estáticas e interrupção, a conferir no navegador; 18 Parkinson remove etapas obrigatórias e prazos artificiais.
