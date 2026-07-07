export interface GarmentTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export function autoPlaceGarment(
  garmentType: string,
  containerW: number,
  containerH: number,
): GarmentTransform {
  const t = garmentType.toLowerCase()
  let w: number, h: number, x: number, y: number

  if (t.includes('dress') || t.includes('vestido')) {
    w = containerW * 0.6; h = containerH * 0.55
    x = (containerW - w) / 2; y = containerH * 0.15
  } else if (t.includes('bottom') || t.includes('pantal') || t.includes('falda') || t.includes('short') || t.includes('jean')) {
    w = containerW * 0.5; h = containerH * 0.35
    x = (containerW - w) / 2; y = containerH * 0.45
  } else if (t.includes('outer') || t.includes('chaqueta') || t.includes('abrigo') || t.includes('saco') || t.includes('jacket')) {
    w = containerW * 0.65; h = containerH * 0.4
    x = (containerW - w) / 2; y = containerH * 0.12
  } else if (t.includes('shoe') || t.includes('zapat') || t.includes('bota')) {
    w = containerW * 0.25; h = containerH * 0.12
    x = (containerW - w) / 2; y = containerH * 0.85
  } else if (t.includes('accesorio') || t.includes('sombrero') || t.includes('gorra') || t.includes('bolso')) {
    w = containerW * 0.3; h = containerH * 0.2
    x = (containerW - w) / 2; y = containerH * 0.02
  } else {
    w = containerW * 0.55; h = containerH * 0.35
    x = (containerW - w) / 2; y = containerH * 0.15
  }

  return { x, y, width: w, height: h, rotation: 0 }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

export async function renderToCanvas(
  bodyPhotoUrl: string,
  garments: Array<{ url: string; transform: GarmentTransform; opacity: number }>,
  containerW: number,
  containerH: number,
): Promise<string> {
  const bodyImg = await loadImg(bodyPhotoUrl)
  const imgW = bodyImg.naturalWidth
  const imgH = bodyImg.naturalHeight

  const scaleX = imgW / containerW
  const scaleY = imgH / containerH

  const canvas = document.createElement('canvas')
  canvas.width = imgW
  canvas.height = imgH
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, imgW, imgH)
  ctx.drawImage(bodyImg, 0, 0, imgW, imgH)

  for (const g of garments) {
    try {
      const gImg = await loadImg(g.url)
      const gx = g.transform.x * scaleX
      const gy = g.transform.y * scaleY
      const gw = g.transform.width * scaleX
      const gh = g.transform.height * scaleY
      const cx = gx + gw / 2
      const cy = gy + gh / 2

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((g.transform.rotation * Math.PI) / 180)
      ctx.globalAlpha = g.opacity
      ctx.drawImage(gImg, -gw / 2, -gh / 2, gw, gh)
      ctx.restore()
    } catch {}
  }

  return canvas.toDataURL('image/png')
}

export async function removeGarmentBackground(imageUrl: string): Promise<string> {
  const { removeBackground } = await import('./garmentProcessor')
  return removeBackground(imageUrl)
}
