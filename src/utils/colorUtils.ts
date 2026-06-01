/** Utilidades para generar variantes de un color hex (sin dependencias externas). */

export const normalizeHex = (hex: string): string | null => {
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
    const r = h[1];
    const g = h[2];
    const b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h.toLowerCase();
  return null;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
};

export const mixHex = (hex: string, target: '#ffffff' | '#000000', amount: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = target === '#ffffff' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const a = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    rgb.r + (t.r - rgb.r) * a,
    rgb.g + (t.g - rgb.g) * a,
    rgb.b + (t.b - rgb.b) * a
  );
};

export const deriveThemeFromPrimary = (primary: string) => ({
  primary,
  light: mixHex(primary, '#ffffff', 0.35),
  dark: mixHex(primary, '#000000', 0.22),
  accent: mixHex(primary, '#ffffff', 0.15),
  secondary: mixHex(primary, '#000000', 0.08),
});
