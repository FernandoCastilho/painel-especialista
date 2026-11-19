// Incorpora somente fontes do próprio aplicativo. Nenhum endpoint externo ou credencial.
const fontData = new Map()
async function inlineFont(url) {
  const resolved = new URL(url, document.baseURI)
  if (resolved.protocol === 'data:') return resolved.href
  if (resolved.origin !== location.origin) throw new Error('Fonte externa não pode ser incluída na imagem.')
  if (!fontData.has(resolved.href)) {
    const pending = fetch(resolved.href, { credentials: 'omit', cache: 'force-cache', redirect: 'error' }).then(async response => {
      if (!response.ok) throw new Error('Não foi possível carregar a fonte local para a imagem.')
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Não foi possível preparar a fonte local.'))
        reader.readAsDataURL(blob)
      })
    }).catch(error => { fontData.delete(resolved.href); throw error })
    fontData.set(resolved.href, pending)
  }
  return fontData.get(resolved.href)
}
export async function captureFontCss() {
  const rules = []
  for (const sheet of document.styleSheets) {
    if (sheet.href && new URL(sheet.href).origin !== location.origin) continue
    for (const rule of sheet.cssRules) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue
      let text = rule.cssText
      for (const match of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const url = new URL(match[1], sheet.href || document.baseURI).href
        text = text.replace(match[0], `url("${await inlineFont(url)}")`)
      }
      rules.push(text)
    }
  }
  return rules.join('\n')
}
