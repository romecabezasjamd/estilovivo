export interface GarmentTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  flipX?: boolean
  flipY?: boolean
}

export function autoPlace(type: string, canvasW: number, canvasH: number): GarmentTransform {
  const t = type.toLowerCase()
  let w: number, h: number, x: number, y: number
  if (/dress|vestido|enterizo/.test(t)) {
    w = canvasW * 0.55; h = canvasH * 0.48; x = (canvasW - w) / 2; y = canvasH * 0.14
  } else if (/bottom|pantal|falda|short|jean|trouser/.test(t)) {
    w = canvasW * 0.42; h = canvasH * 0.28; x = (canvasW - w) / 2; y = canvasH * 0.44
  } else if (/outer|chaqueta|abrigo|saco|jacket|coat/.test(t)) {
    w = canvasW * 0.6; h = canvasH * 0.36; x = (canvasW - w) / 2; y = canvasH * 0.12
  } else if (/shoe|zapat|bota|sandal|boot/.test(t)) {
    w = canvasW * 0.2; h = canvasH * 0.08; x = (canvasW - w) / 2; y = canvasH * 0.9
  } else if (/accesorio|sombrero|gorra|bolso|gafas|collar/.test(t)) {
    w = canvasW * 0.25; h = canvasH * 0.15; x = (canvasW - w) / 2; y = canvasH * 0.01
  } else {
    w = canvasW * 0.48; h = canvasH * 0.3; x = (canvasW - w) / 2; y = canvasH * 0.14
  }
  return { x, y, width: w, height: h, rotation: 0, opacity: 1 }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Failed to load image'))
    img.src = src
  })
}

function fitDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number) {
  const ratio = Math.min(cw / img.naturalWidth, ch / img.naturalHeight)
  const w = img.naturalWidth * ratio
  const h = img.naturalHeight * ratio
  const x = (cw - w) / 2
  const y = (ch - h) / 2
  ctx.drawImage(img, x, y, w, h)
  return { x, y, w, h, ratio }
}

export async function exportCanvas(
  bodyUrl: string,
  garments: Array<{ url: string; t: GarmentTransform }>,
  displayW: number,
  displayH: number,
  options?: { transparent?: boolean; mirror?: boolean },
): Promise<string> {
  const body = await loadImg(bodyUrl)
  const exportScale = Math.max(1, 1200 / Math.max(displayW, displayH))
  const ew = Math.round(displayW * exportScale)
  const eh = Math.round(displayH * exportScale)

  const c = document.createElement('canvas')
  c.width = ew
  c.height = eh
  const ctx = c.getContext('2d')!

  if (!options?.transparent) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ew, eh)
  }

  ctx.save()
  if (options?.mirror) {
    ctx.translate(ew, 0)
    ctx.scale(-1, 1)
  }
  fitDraw(ctx, body, ew, eh)
  ctx.restore()

  const shadowSize = Math.max(4, ew * 0.01)
  for (const g of garments) {
    try {
      const img = await loadImg(g.url)
      ctx.save()
      if (!options?.transparent) {
        ctx.shadowColor = 'rgba(0,0,0,0.2)'
        ctx.shadowBlur = shadowSize
        ctx.shadowOffsetX = shadowSize * 0.3
        ctx.shadowOffsetY = shadowSize * 0.5
      }
      const sx = g.t.x * exportScale
      const sy = g.t.y * exportScale
      const sw = g.t.width * exportScale
      const sh = g.t.height * exportScale
      ctx.translate(sx + sw / 2, sy + sh / 2)
      ctx.rotate((g.t.rotation * Math.PI) / 180)
      ctx.scale(g.t.flipX ? -1 : 1, g.t.flipY ? -1 : 1)
      ctx.globalAlpha = g.t.opacity
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh)
      ctx.restore()
    } catch {}
  }
  return c.toDataURL('image/png')
}

export async function removeBg(url: string): Promise<string> {
  const { removeBackground } = await import('./garmentProcessor')
  return removeBackground(url)
}

export function getImageNaturalSize(url: string): Promise<{ w: number; h: number }> {
  return loadImg(url).then(img => ({ w: img.naturalWidth, h: img.naturalHeight }))
}
