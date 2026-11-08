export function createLatestRequest() {
  let current
  return {
    cancel() { current?.abort(); current = undefined },
    start() {
      current?.abort()
      const request = new AbortController()
      current = request
      return { signal: request.signal, isCurrent: () => current === request && !request.signal.aborted }
    },
  }
}
