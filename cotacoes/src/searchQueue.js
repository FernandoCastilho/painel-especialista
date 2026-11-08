// Cancelar a busca impede novas leituras e descarta resultados já em trânsito.
export async function runSearchQueue(sources, { signal, load, accept, fail, concurrency = 4 }) {
  let cursor = 0
  const work = async () => {
    while (!signal.aborted && cursor < sources.length) {
      const source = sources[cursor++]
      try {
        const result = await load(source, signal)
        if (!signal.aborted) accept(source, result)
      } catch (error) {
        if (!signal.aborted) fail(source, error)
      }
    }
  }
  await Promise.allSettled(Array.from({ length: concurrency }, work))
}
