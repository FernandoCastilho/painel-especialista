const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504])
// Never retry access denials, invalid payloads or other permanent failures.
export async function fetchBankText(url, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 3 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(45000), redirect: 'error' })
      if (response.ok) return await response.text()
    } catch (error) {
      const code = error.cause?.code || error.code
      const transient = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(code) || error.name === 'TimeoutError'
      if (!transient || attempt === attempts) throw error
      await sleep(attempt * 1000)
      continue
    }
    const error = new Error(`HTTP ${response.status}`)
    if (!TRANSIENT_STATUS.has(response.status) || attempt === attempts) throw error
    const retryHeader = response.headers?.get('retry-after')
    const retryAfter = retryHeader ? Number(retryHeader) : 0
    // A long server cooldown must not be shortened by a retry.
    if (!Number.isFinite(retryAfter) || retryAfter > 30) throw error
    await sleep(Math.max(attempt, Number.isFinite(retryAfter) ? retryAfter : 0) * 1000)
  }
}
