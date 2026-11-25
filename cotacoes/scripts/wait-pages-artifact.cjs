const { setTimeout: pause } = require('node:timers/promises')

async function waitForPagesArtifact({
  id, name, list, sleep = pause, delays = [5000, 5000, 8000, 10000, 12000, 15000],
}) {
  if (!/^[1-9][0-9]*$/.test(String(id))) throw new Error('ID inválido no envio do pacote de Pages.')
  if (!name) throw new Error('Nome ausente no envio do pacote de Pages.')

  let consecutive = 0
  for (const delay of [0, ...delays]) {
    if (delay) await sleep(delay)
    try {
      const matches = (await list(name)).filter(artifact => artifact.name === name)
      const valid = matches.length === 1 && String(matches[0].id) === String(id) && matches[0].expired === false && (matches[0].size_in_bytes ?? 1) > 0
      consecutive = valid ? consecutive + 1 : 0
      if (consecutive === 2) return matches[0]
    } catch (error) {
      consecutive = 0
      const status = Number(error.status)
      if (!(status === 404 || status === 429 || (status >= 500 && status < 600))) throw error
    }
  }

  throw new Error('Pacote desta tentativa não confirmado; a publicação não foi iniciada.')
}

module.exports = { waitForPagesArtifact }
