export interface GarmentTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
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

export function syncCanvasSize(canvas: HTMLCanvasElement): { displayW: number; displayH: number } {
  const displayW = canvas.clientWidth || 300
  const displayH = canvas.clientHeight || 400
  if (canvas.width !== displayW || canvas.height !== displayH) {
    canvas.width = displayW
    canvas.height = displayH
  }
  return { displayW, displayH }
}

export async function drawCanvas(
  canvas: HTMLCanvasElement,
  bodyUrl: string,
  garments: Array<{ url: string; t: GarmentTransform }>,
  activeIdx: number,
): Promise<void> {
  const body = await loadImg(bodyUrl)
  const { displayW, displayH } = syncCanvasSize(canvas)
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, displayW, displayH)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, displayW, displayH)

  const bodyFit = fitDraw(ctx, body, displayW, displayH)

  const shadowSize = Math.max(4, displayW * 0.01)

  for (let i = 0; i < garments.length; i++) {
    const g = garments[i]
    try {
      const img = await loadImg(g.url)

      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = shadowSize
      ctx.shadowOffsetX = shadowSize * 0.3
      ctx.shadowOffsetY = shadowSize * 0.5
      ctx.translate(g.t.x + g.t.width / 2, g.t.y + g.t.height / 2)
      ctx.rotate((g.t.rotation * Math.PI) / 180)
      ctx.globalAlpha = g.t.opacity
      ctx.drawImage(img, -g.t.width / 2, -g.t.height / 2, g.t.width, g.t.height)
      ctx.restore()

      if (i === activeIdx) {
        ctx.save()
        ctx.translate(g.t.x + g.t.width / 2, g.t.y + g.t.height / 2)
        ctx.rotate((g.t.rotation * Math.PI) / 180)
        const hw = g.t.width / 2
        const hh = g.t.height / 2
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = Math.max(2, displayW * 0.004)
        ctx.setLineDash([Math.max(4, displayW * 0.005), Math.max(3, displayW * 0.004)])
        ctx.strokeRect(-hw - 4, -hh - 4, g.t.width + 8, g.t.height + 8)
        ctx.setLineDash([])
        const corner = Math.max(3, displayW * 0.006)
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        const corners = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]
        for (const [cx, cy] of corners) {
          ctx.beginPath()
          ctx.arc(cx, cy, corner, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.strokeStyle = '#ff4d94'
        ctx.lineWidth = Math.max(1, displayW * 0.002)
        for (const [cx, cy] of corners) {
          ctx.beginPath()
          ctx.arc(cx, cy, corner, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }
    } catch {}
  }
}

export async function exportCanvas(
  bodyUrl: string,
  garments: Array<{ url: string; t: GarmentTransform }>,
  displayW: number,
  displayH: number,
): Promise<string> {
  const body = await loadImg(bodyUrl)
  const exportScale = Math.max(1, 1200 / Math.max(displayW, displayH))
  const ew = Math.round(displayW * exportScale)
  const eh = Math.round(displayH * exportScale)

  const c = document.createElement('canvas')
  c.width = ew
  c.height = eh
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ew, eh)
  fitDraw(ctx, body, ew, eh)

  const shadowSize = Math.max(4, ew * 0.01)
  for (const g of garments) {
    try {
      const img = await loadImg(g.url)
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = shadowSize
      ctx.shadowOffsetX = shadowSize * 0.3
      ctx.shadowOffsetY = shadowSize * 0.5
      const sx = g.t.x * exportScale
      const sy = g.t.y * exportScale
      const sw = g.t.width * exportScale
      const sh = g.t.height * exportScale
      ctx.translate(sx + sw / 2, sy + sh / 2)
      ctx.rotate((g.t.rotation * Math.PI) / 180)
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
