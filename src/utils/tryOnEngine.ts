export interface GarmentTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

export function autoPlace(type: string, cw: number, ch: number): GarmentTransform {
  const t = type.toLowerCase()
  let w: number, h: number, x: number, y: number
  if (/dress|vestido/.test(t)) { w = cw * 0.55; h = ch * 0.5; x = (cw - w) / 2; y = ch * 0.15 }
  else if (/bottom|pantal|falda|short|jean/.test(t)) { w = cw * 0.45; h = ch * 0.3; x = (cw - w) / 2; y = ch * 0.45 }
  else if (/outer|chaqueta|abrigo|saco|jacket/.test(t)) { w = cw * 0.6; h = ch * 0.38; x = (cw - w) / 2; y = ch * 0.12 }
  else if (/shoe|zapat|bota/.test(t)) { w = cw * 0.22; h = ch * 0.1; x = (cw - w) / 2; y = ch * 0.88 }
  else if (/accesorio|sombrero|gorra|bolso/.test(t)) { w = cw * 0.28; h = ch * 0.18; x = (cw - w) / 2; y = ch * 0.02 }
  else { w = cw * 0.5; h = ch * 0.32; x = (cw - w) / 2; y = ch * 0.15 }
  return { x, y, width: w, height: h, rotation: 0, opacity: 1 }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Error cargando imagen'))
    img.src = src
  })
}

export async function drawCanvas(
  canvas: HTMLCanvasElement,
  bodyUrl: string,
  garments: Array<{ url: string; t: GarmentTransform }>,
  activeIdx: number,
): Promise<void> {
  const body = await loadImg(bodyUrl)
  canvas.width = body.naturalWidth
  canvas.height = body.naturalHeight
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(body, 0, 0)

  const sx = canvas.width / canvas.clientWidth
  const sy = canvas.height / canvas.clientHeight

  for (let i = 0; i < garments.length; i++) {
    const g = garments[i]
    try {
      const img = await loadImg(g.url)
      const x = g.t.x * sx
      const y = g.t.y * sy
      const w = g.t.width * sx
      const h = g.t.height * sy
      ctx.save()
      ctx.translate(x + w / 2, y + h / 2)
      ctx.rotate((g.t.rotation * Math.PI) / 180)
      ctx.globalAlpha = g.t.opacity
      ctx.drawImage(img, -w / 2, -h / 2, w, h)
      ctx.restore()
      if (i === activeIdx) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3 * sx
        ctx.setLineDash([6 * sx, 4 * sx])
        ctx.strokeRect(x - 4 * sx, y - 4 * sy, w + 8 * sx, h + 8 * sy)
        ctx.setLineDash([])
      }
    } catch {}
  }
}

export async function exportCanvas(
  bodyUrl: string,
  garments: Array<{ url: string; t: GarmentTransform }>,
): Promise<string> {
  const body = await loadImg(bodyUrl)
  const c = document.createElement('canvas')
  c.width = body.naturalWidth
  c.height = body.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(body, 0, 0)
  for (const g of garments) {
    try {
      const img = await loadImg(g.url)
      ctx.save()
      ctx.translate(g.t.x + g.t.width / 2, g.t.y + g.t.height / 2)
      ctx.rotate((g.t.rotation * Math.PI) / 180)
      ctx.globalAlpha = g.t.opacity
      ctx.drawImage(img, -g.t.width / 2, -g.t.height / 2, g.t.width, g.t.height)
      ctx.restore()
    } catch {}
  }
  return c.toDataURL('image/png')
}

export async function removeBg(url: string): Promise<string> {
  const { removeBackground } = await import('./garmentProcessor')
  return removeBackground(url)
}
