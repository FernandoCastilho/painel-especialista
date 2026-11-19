# Correção localizada: decoração do mascote
Base d9da4ba003f000b17bca13bf399a82afafb71cf9.
Asset estático: src/FeedbackMascot.css37, .mascot-mini-face, url('./assets/mascot-owl.webp'),24.640bytes. MascotDock usa createPortal(miniEl,slot); App coloca MascotSlot em main/header móvel. captureImage recusa backgroundImage comurl durante a recursão.

Candidato marca somente mini botão do mascote data-capture-ignore="mascot". O clone descarta backgroundImage APENAS de.mascot-mini-face sob essa marca. Mantém caixa, elementos e ocultação visibility:hidden existente. Não remove/edita DOM original. Demais backgrounds continuam recusados; política de img externo e iframe inalterada. Nenhum gateRGB mudou.

Evidência:12 testes unitários/contratos passaram,lint direcionado limpo. Teste específico de DOM incluído no smoke existente paraJuros390claro/escuro: exige face dentro de main comassetmascot-owl.webp e compara geometria antes/depois do clique. Ainda NÃO executado em navegador. Relação portal/asset foi verificada estaticamente, não se inventa provaDOMruntime. Sem novoCI/commitremoto.

Texto: tecnicamente é possível copiar rótulo/valor/data/fonte via clipboard.writeText, mas seria função diferente da imagem solicitada. Não implementar como fallback silencioso nem declarar equivalente à captura. Sem mudanças nesta entrega.

Fontes:
https://github.com/FernandoCastilho/painel-especialista/blob/d9da4ba003f000b17bca13bf399a82afafb71cf9/cotacoes/src/FeedbackMascot.css
https://github.com/FernandoCastilho/painel-especialista/blob/d9da4ba003f000b17bca13bf399a82afafb71cf9/cotacoes/src/MascotDock.jsx
https://github.com/FernandoCastilho/painel-especialista/actions/runs/44554406246
