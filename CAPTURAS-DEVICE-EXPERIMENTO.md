# Experimento de referência em device pixels
Base #523 6961e2d. Nenhum produto ou workflow alterado. O caminho normal do smoke continua intacto.

Acionamento exclusivo no runner existente: `CAPTURE_REFERENCE_MODE=device node scripts/smoke-capture-image.cjs` com os mesmos SMOKE_BASE_URL/SMOKE_CHANNEL/CHROMIUM_PATH/CAPTURE_QA_OUTPUT já aprovados. Não executar em produção ou notebook.

O comparador experimental calcula a escala exata usada pelo PNG por `captureSize`, ajusta temporariamente deviceScaleFactor no contexto Chromium descartável e fotografa o DOM ORIGINAL com `scale:'device'` e recorte geométrico. Verifica que a mudança de DPR não mudou posição ou dimensões CSS; caso mude, interrompe. Restaura DPR em finally. Não captura o clone nem reamostra o PNG. Divergência de dimensões físicas interrompe com imagens salvas. Controles excluídos ficam apenas invisíveis no DOM de referência, sem remover espaço, como no teste anterior.

Gate RGB mantido: meanError<.08, contraste45, ink>20, inkRecall>.7, sem tolerância espacial. Mantém todas as regiões originais e acrescenta curva sem eixos (máscara de cor da série) e glifos separados do sinal/primeiro dígito via DOM Range. Inclui negativos derivados da mesma screenshot real dentro do mesmo comparador: curva apagada, curva de cor incorreta, sinal/dígito apagados, título ausente e deslocamento. Falha se algum negativo for aceito. Artefatos `device-N-{reference,actual}.png` e report.json.

Validação local: dois testes unitários RGB passam; sete negativos dos PNGs reais V3 foram rejeitados usando este MESMO módulo JS (relatório anexo). Não confundir com execução de browser: esta ainda depende do runner. Não há aprovação de fidelidade nem promessa de sucesso. O experimento deve permanecer separado da publicação.
