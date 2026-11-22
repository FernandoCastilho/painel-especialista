# Painel do Especialista

As orientações de `CLAUDE.md` valem também para quem desenvolve via Hermes, Codex ou outro ambiente. As permissões da sessão e do GitHub continuam valendo.

## Caminho de publicação

1. Abra um ramo de trabalho a partir do ramo padrão atual. Entregue por pull request. Não envie direto ao ramo de publicação para apressar o fluxo.
2. Rode lint, testes e build em `cotacoes/`. Aguarde os checks da revisão candidata no GitHub e a auditoria independente antes de publicar. Se a revisão mudar, reconfira a aprovação e os checks.
3. Integre só com autorização válida. O GitHub Actions conduz a publicação e a conferência no site. Não trate o merge como entrega: confirme a execução e que a versão certa está no ar.
4. Não use coleta agendada, reexecução de versão antiga ou novo pacote para contornar um bloqueio. Veja [Publicação e calendário de coleta](docs/publicacao-e-calendario.md).
