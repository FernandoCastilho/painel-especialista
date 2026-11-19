# Candidato combinado, somente local

Base PR #523: 6961e2dec5f742cb0862d018a2522208b28a168f.
Produção conciliada: 3ed790252a118a68d9b7bd322c1eebad1ef6f070 (#522).

Conflito único: imports de App.jsx. União preserva CaptureButton e EconomiaContexto. Comparado com produção, App.jsx acrescenta somente import/câmera. EconomiaContexto.jsx/.css, economiaContexto.js e teste são idênticos à produção. smoke-outros preserva integralmente bloco Economia e capturas; altera apenas três assertivas antigas de controles e import do helper.

Controles: nomes acessíveis; câmera única visível/habilitada/focável; fechar comprovado, sem confundir câmera com maximizar. Busca protegida durante modal, Escape e aria-pressed mantidos.

DPR: passo diagnóstico separado no job clipboard-capture, mesmo servidor, captura do DOM original e gate RGB intacto. Executa mesmo após falha da fidelidade normal. Salva em subpasta device-reference do artefato existente; resultado de falha continua visível, sem continue-on-error, conforme contrato existente do CI. Não substitui a validação normal. Job20min acomoda diagnóstico6min sem retirar tempo da colagem real. Demais jobs, Podcast e etapas existentes preservados.

Dois patches: `capturas-combinado.patch` traz o candidato completo desde head6961e2d; `capturas-controles-dpr-pos-merge.patch` é apenas delta após integrar3ed7902 e resolver import de App com ambas linhas. Não aplicar os dois juntos. Nada publicado, nenhum Actions acionado. Browser/CI seguem necessários.
