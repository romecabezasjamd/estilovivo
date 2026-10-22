// Reglas de la compraventa de segunda mano. Estilo Vivo solo pone en contacto a particulares (no cobra ni gestiona
// pagos). Por eso:
//  - Quien vende declara una vez que vende como PARTICULAR (las condiciones prohíben vender como profesional) y el
//    comprador ve que compra a un particular (LGDCU art. 97 bis / Directiva Ómnibus 2019/2161).
//  - Todo anuncio necesita un precio entre 0 y 10.000 €.

export const MAX_PRICE = 10000;

export const SELLER_DECLARATION_REQUIRED = {
  code: 'SELLER_DECLARATION_REQUIRED',
  error: 'Antes de poner algo a la venta, confirma que vendes como particular.',
} as const;

/** Precio de un anuncio: null si no es válido para vender. */
export function salePrice(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

export const PRICE_ERROR = `Pon un precio entre 0 y ${MAX_PRICE.toLocaleString('es-ES')} € para vender la prenda.`;
