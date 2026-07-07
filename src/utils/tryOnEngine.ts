export interface GarmentTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

export function autoPlace(type: string, bodyW: number, bodyH: number): GarmentTransform {
  const t = type.toLowerCase()
  let w: number, h: number, x: number, y: number
  if (/dress|vestido|enterizo/.test(t)) {
    w = bodyW * 0.55; h = bodyH * 0.48; x = (bodyW - w) / 2; y = bodyH * 0.14
  } else if (/bottom|pantal|falda|short|jean|trouser/.test(t)) {
    w = bodyW * 0.42; h = bodyH * 0.28; x = (bodyW - w) / 2; y = bodyH * 0.44
  } else if (/outer|chaqueta|abrigo|saco|jacket|coat/.test(t)) {
    w = bodyW * 0.6; h = bodyH * 0.36; x = (bodyW - w) / 2; y = bodyH * 0.12
  } else if (/shoe|zapat|bota|sandal|boot/.test(t)) {
    w = bodyW * 0.2; h = bodyH * 0.08; x = (bodyW - w) / 2; y = bodyH * 0.9
  } else if (/accesorio|sombrero|gorra|bolso|gafas|collar/.test(t)) {
    w = bodyW * 0.25; h = bodyH * 0.15; x = (bodyW - w) / 2; y = bodyH * 0.01
  } else {
    w = bodyW * 0.48; h = bodyH * 0.3; x = (bodyW - w) / 2; y = bodyH * 0.14
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

export async function drawCanvas(
  canvas: HTMLCanvasElement,
  bodyUrl: string,
  garments: Array<{ url: string; t: GarmentTransform }>,
  activeIdx: number,
): Promise<void> {
  const body = await loadImg(bodyUrl)
  if (canvas.width !== body.naturalWidth || canvas.height !== body.naturalHeight) {
    canvas.width = body.naturalWidth
    canvas.height = body.naturalHeight
  }
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(body, 0, 0)

  const scale = canvas.width / (canvas.clientWidth || canvas.width)
  const shadowSize = Math.max(6, canvas.width * 0.008)

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
        ctx.lineWidth = Math.max(2, canvas.width * 0.003)
        ctx.setLineDash([Math.max(4, canvas.width * 0.004), Math.max(3, canvas.width * 0.003)])
        ctx.strokeRect(-hw - 4, -hh - 4, g.t.width + 8, g.t.height + 8)
        ctx.setLineDash([])
        const corner = Math.max(4, canvas.width * 0.005)
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        const corners = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]
        for (const [cx, cy] of corners) {
          ctx.beginPath()
          ctx.arc(cx, cy, corner, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.strokeStyle = '#ff4d94'
        ctx.lineWidth = Math.max(1, canvas.width * 0.001)
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
): Promise<string> {
  const body = await loadImg(bodyUrl)
  const c = document.createElement('canvas')
  c.width = body.naturalWidth
  c.height = body.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(body, 0, 0)
  const shadowSize = Math.max(6, c.width * 0.008)
  for (const g of garments) {
    try {
      const img = await loadImg(g.url)
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = shadowSize
      ctx.shadowOffsetX = shadowSize * 0.3
      ctx.shadowOffsetY = shadowSize * 0.5
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

export function getImageNaturalSize(url: string): Promise<{ w: number; h: number }> {
  return loadImg(url).then(img => ({ w: img.naturalWidth, h: img.naturalHeight }))
}
