// Captura local: nenhum upload, envio, consulta externa ou mudança de dados.
export function captureSize(width, height) {
  if (!(width > 0 && height > 0) || width > 12000 || height > 16000) throw new Error('Área muito grande. Abra um gráfico ou quadro menor para copiar.')
  const scale = Math.min(2, 1920 / width, Math.sqrt(16000000 / (width * height)))
  if (scale < 0.6) throw new Error('Tela muito longa para uma imagem legível. Copie um quadro menor.')
  return { width: Math.ceil(width * scale), height: Math.ceil(height * scale), scale }
}
// Área rolável conserva o mesmo recorte no topo e depois da rolagem.
export function captureUsesViewport(target, css = getComputedStyle(target)) {
  return !!(target.scrollTop || target.scrollLeft) ||
    (/(auto|scroll|hidden|clip)/.test(css.overflowY) && target.scrollHeight > target.clientHeight) ||
    (/(auto|scroll|hidden|clip)/.test(css.overflowX) && target.scrollWidth > target.clientWidth)
}
function cloneStyled(node) {
  if (node.nodeType !== 1) return node.cloneNode()
  if (node.matches('script')) return document.createTextNode('')
  const css = getComputedStyle(node)
  if (css.display === 'none' || css.visibility === 'hidden') return document.createTextNode('')
  if (node.matches('iframe,video')) {
    const placeholder = document.createElement('div')
    const rect = node.getBoundingClientRect()
    placeholder.style.cssText = `box-sizing:border-box;width:${rect.width}px;height:${rect.height}px;min-height:70px;padding:16px;border:2px dashed #64748b;background:#f1f5f9;color:#0f172a;font:16px/1.5 system-ui;overflow:hidden`
    placeholder.textContent = `Conteúdo externo não incluído na imagem: ${node.title || 'mídia incorporada'}. Consulte a fonte no painel.`
    return placeholder
  }
  let imageData = null
  if (node.matches('img') && !node.src.startsWith('data:')) {
    if (new URL(node.currentSrc || node.src, location.href).origin !== location.origin) throw new Error('Esta área contém imagem externa. Copie um quadro sem essa imagem.')
    if (!node.complete || !node.naturalWidth) throw new Error('A imagem local ainda não carregou. Aguarde e tente novamente.')
    const imageCanvas = document.createElement('canvas')
    imageCanvas.width = node.naturalWidth; imageCanvas.height = node.naturalHeight
    imageCanvas.getContext('2d').drawImage(node, 0, 0)
    imageData = imageCanvas.toDataURL('image/png')
  }
  let copy = node.cloneNode(false)
  if (imageData) { copy.removeAttribute('srcset'); copy.removeAttribute('sizes'); copy.src = imageData }
  if (node.matches('canvas')) {
    copy = document.createElement('img')
    copy.src = node.toDataURL('image/png')
  }
  for (const key of css) copy.style.setProperty(key, css.getPropertyValue(key))
  copy.style.setProperty('animation', 'none')
  copy.style.setProperty('transition', 'none')
  copy.style.setProperty('position', css.position === 'fixed' || css.position === 'sticky' ? 'static' : css.position)
  if (/url\(/i.test(css.backgroundImage)) throw new Error('Esta área contém fundo com imagem. Copie um quadro menor.')
  if (node.matches('input')) copy.setAttribute('value', node.value)
  if (node.matches('textarea')) copy.textContent = node.value
  else if (!node.matches('canvas')) for (const child of node.childNodes) copy.append(cloneStyled(child))
  if (node.matches('[data-capture-ignore]')) {
    // Invisível, mas conserva filhos, baseline e caixa flex/grid para não deslocar o título.
    for (const element of [copy, ...copy.querySelectorAll('*')]) element.style.visibility = 'hidden'
    copy.style.pointerEvents = 'none'
  }
  if (node.matches('select')) [...copy.options].forEach((option, index) => option.selected = node.options[index].selected)
  if ((node.scrollTop || node.scrollLeft) && node.namespaceURI === 'http://www.w3.org/1999/xhtml') {
    // SVG has a serializable viewport; unlike scrollTop, its translation survives rasterization.
    const rect = node.getBoundingClientRect()
    const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    viewport.setAttribute('width', String(rect.width))
    viewport.setAttribute('height', String(rect.height))
    viewport.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
    viewport.style.cssText = copy.style.cssText
    viewport.style.padding = '0'; viewport.style.border = '0'; viewport.style.overflow = 'hidden'
    viewport.style.width = rect.width + 'px'; viewport.style.height = rect.height + 'px'
    const content = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
    content.setAttribute('x', String(-node.scrollLeft)); content.setAttribute('y', String(-node.scrollTop))
    content.setAttribute('width', String(Math.max(node.scrollWidth, rect.width)))
    content.setAttribute('height', String(Math.max(node.scrollHeight, rect.height)))
    copy.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    copy.style.margin = '0'; copy.style.width = rect.width + 'px'; copy.style.height = rect.height + 'px'
    copy.style.overflow = 'visible'; copy.style.maxHeight = 'none'
    content.append(copy); viewport.append(content)
    return viewport
  }
  return copy
}
export async function capturePng(target) {
  if (!target) throw new Error('Área de captura não encontrada.')
  await document.fonts.ready
  const { captureFontCss } = await import('./captureFonts.js')
  const fontCss = await captureFontCss()
  const viewport = captureUsesViewport(target)
  const width = Math.ceil(target.getBoundingClientRect().width)
  const height = Math.ceil(viewport ? target.getBoundingClientRect().height : Math.max(target.scrollHeight, target.getBoundingClientRect().height))
  const size = captureSize(width, height)
  const copy = cloneStyled(target)
  copy.style.width = width + 'px'; copy.style.height = height + 'px'
  copy.style.margin = '0'; copy.style.maxHeight = 'none'; copy.style.overflow = viewport ? 'hidden' : 'visible'
  const root = document.createElement('div')
  root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  root.style.cssText = `width:${width}px;height:${height}px;background:${getComputedStyle(document.body).backgroundColor};`
  const fonts = document.createElement('style')
  fonts.textContent = fontCss
  root.append(fonts, copy)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(root)}</foreignObject></svg>`
  const image = new Image()
  await new Promise((resolve,reject) => {
    image.onload=resolve; image.onerror=()=>reject(new Error('O navegador não conseguiu gerar esta imagem.'))
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)
  })
  const canvas=document.createElement('canvas')
  canvas.width=size.width; canvas.height=size.height
  canvas.getContext('2d').drawImage(image,0,0,size.width,size.height)
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível gerar o PNG.')),'image/png'))
}
export async function copyCapture(target, { clipboard = globalThis.navigator?.clipboard, Item = globalThis.ClipboardItem, render = capturePng } = {}) {
  if (!clipboard?.write || !Item) throw new Error('Este navegador não permite copiar imagens. Use Chrome ou Edge em conexão segura.')
  // A escrita começa no gesto do usuário; a imagem é resolvida depois, sem perder a ativação.
  const png = render(target)
  png.catch(() => {}) // Uma recusa imediata de clipboard não deixa a renderização sem observador.
  const item = new Item({ 'image/png': png })
  await clipboard.write([item])
}
