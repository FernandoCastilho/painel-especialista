# Simplificação da cotação Finame

Pedido do usuário em 10/11/2026, sobre a versão publicada pela PR 386.

## Entrega

- Premissas da tela: SAC, composição capitalizada, liberação em até 90 dias para TFC e TFB, recursos FINAME elegíveis e IOF zero. Removidos controles redundantes; ressalvas de elegibilidade permanecem nos avisos e na apresentação.
- ECG do FGI sempre à vista. Não aumenta principal, juros ou parcelas; entra uma vez no pagamento total e na liberação. Fórmulas compartilhadas permanecem disponíveis aos demais consumidores, sem mudanças em TLP/LCD.
- Taxas TFC e TFB editáveis individualmente. A cotação publicada conserva valor, código e data; taxa manual é identificada nos resultados e nos slides. Botão "Usar cotação" restaura a referência. Trocar prazo ou porte/região limpa a edição para não reutilizar proposta incompatível.
- Comparação com cabeçalhos simples TFC/TFB, sem repetir taxas no cabeçalho. Mantidos os bloqueios por data ou faixa não equivalentes, mesmo com taxa manual.
- Taxa manual válida pode gerar simulação simples sem cotação. Fonte indisponível não vira zero; apresentação deixa a ausência explícita. Valores vazios, negativos ou acima de 100% são inválidos; zero explícito é aceito.

## Verificação

- Auditoria financeira independente: sem bloqueador no fluxo esperado. Endurecimento recomendado para fonte incompleta implementado: cotação inválida normalizada para ausente, sem perder taxa manual.
- Suíte completa, build e lint executados localmente. Sem erro de lint; cinco avisos já existentes fora do escopo.
- Smokes atualizados para premissas, taxas manuais/reset, ECG à vista, navegação e apresentação, mantendo matriz móvel/desktop e dois temas. Navegador local não iniciou (restrição de socket); validação de interface deve passar no CI e capturas antes de publicar.
- Não foram alteradas rotinas de publicação nem gates de aprovação.
