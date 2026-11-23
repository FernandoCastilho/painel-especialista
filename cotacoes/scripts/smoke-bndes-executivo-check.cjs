const { spawnSync } = require('node:child_process')
const path = require('node:path')

// A entrada BNDES já usada pelo CI inclui a conferência executiva, sem alterar o workflow.
module.exports = output => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'smoke-bndes-executivo.cjs')], {
    stdio: 'inherit', env: { ...process.env, BNDES_EXECUTIVE_QA_OUTPUT: output },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Conferência executiva BNDES falhou: ' + result.status)
}
