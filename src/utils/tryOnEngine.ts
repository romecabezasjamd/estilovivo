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

export type ExportResolution = 'hd' | '2k' | 'full'

function getExportSize(displayW: number, displayH: number, res: ExportResolution): { ew: number; eh: number } {
  const maxDim = Math.max(displayW, displayH)
  let target: number
  if (res === '2k') target = 2400
  else if (res === 'full') target = maxDim
  else target = 1200
  const scale = Math.max(1, target / maxDim)
  return { ew: Math.round(displayW * scale), eh: Math.round(displayH * scale) }
}

function drawContactShadow(ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, rotation: number) {
  ctx.save()
  ctx.translate(sx + sw / 2, sy + sh / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  const shadowH = sh * 0.12
  const grad = ctx.createLinearGradient(0, sh / 2, 0, sh / 2 + shadowH)
  grad.addColorStop(0, 'rgba(0,0,0,0.18)')
  grad.addColorStop(0.5, 'rgba(0,0,0,0.08)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(0, sh / 2 + shadowH / 2, sw * 0.42, shadowH / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export async function exportCanvas(
  bodyUrl: string,
  garments: Array<{ url: string; t: GarmentTransform }>,
  displayW: number,
  displayH: number,
  options?: { transparent?: boolean; mirror?: boolean; resolution?: ExportResolution },
): Promise<string> {
  const body = await loadImg(bodyUrl)
  const res = options?.resolution || 'hd'
  const { ew, eh } = getExportSize(displayW, displayH, res)

  const c = document.createElement('canvas')
  c.width = ew
  c.height = eh
  const ctx = c.getContext('2d')!

  if (!options?.transparent) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ew, eh)
  }

  const sx = ew / displayW
  const sy = eh / displayH

  ctx.save()
  if (options?.mirror) {
    ctx.translate(ew, 0)
    ctx.scale(-sx, sy)
  } else {
    ctx.scale(sx, sy)
  }

  ctx.drawImage(body, 0, 0, displayW, displayH)

  if (!options?.transparent) {
    for (const g of garments) {
      try {
        const img = await loadImg(g.url)
        drawContactShadow(ctx, g.t.x, g.t.y, g.t.width, g.t.height, g.t.rotation)
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.15)'
        ctx.shadowBlur = Math.max(3, g.t.width * 0.02)
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = Math.max(2, g.t.height * 0.015)
        ctx.translate(g.t.x + g.t.width / 2, g.t.y + g.t.height / 2)
        ctx.rotate((g.t.rotation * Math.PI) / 180)
        ctx.scale(g.t.flipX ? -1 : 1, g.t.flipY ? -1 : 1)
        ctx.globalAlpha = g.t.opacity
        ctx.drawImage(img, -g.t.width / 2, -g.t.height / 2, g.t.width, g.t.height)
        ctx.restore()
      } catch {}
    }
  } else {
    for (const g of garments) {
      try {
        const img = await loadImg(g.url)
        ctx.save()
        ctx.translate(g.t.x + g.t.width / 2, g.t.y + g.t.height / 2)
        ctx.rotate((g.t.rotation * Math.PI) / 180)
        ctx.scale(g.t.flipX ? -1 : 1, g.t.flipY ? -1 : 1)
        ctx.globalAlpha = g.t.opacity
        ctx.drawImage(img, -g.t.width / 2, -g.t.height / 2, g.t.width, g.t.height)
        ctx.restore()
      } catch {}
    }
  }

  ctx.restore()
  return c.toDataURL('image/png')
}

export async function removeBg(url: string): Promise<string> {
  const { removeBackground } = await import('./garmentProcessor')
  return removeBackground(url)
}

export function getImageNaturalSize(url: string): Promise<{ w: number; h: number }> {
  return loadImg(url).then(img => ({ w: img.naturalWidth, h: img.naturalHeight }))
}
