// "Lo que se lleva en Estilo Vivo": tendencias calculadas con los looks PÚBLICOS de la comunidad (perfiles públicos
// y cuentas no suspendidas). Solo se muestran cifras agregadas (colores, prendas) y los looks públicos más queridos.
import type { PrismaClient } from '@prisma/client';

const DAY = 24 * 3600 * 1000;

// Muestra de color para los nombres habituales (los colores se guardan como texto libre en español)
const COLOR_HEX: Record<string, string> = {
  negro: '#111111', blanco: '#F5F5F5', gris: '#9A9AA0', 'gris claro': '#C9C9CE', 'gris oscuro': '#4A4A50', beige: '#D8C3A5',
  crema: '#F1E6CF', 'marrón': '#7A4E2D', marron: '#7A4E2D', camel: '#C19A6B', caqui: '#8A8752', azul: '#2F6FD6',
  'azul marino': '#1F2A44', 'azul claro': '#8EC5FF', celeste: '#8EC5FF', turquesa: '#2BB5B0', verde: '#3A9D5D',
  'verde oliva': '#6B7B3A', 'verde botella': '#1E4D2B', rojo: '#D62828', burdeos: '#7B1E2B', granate: '#7B1E2B',
  rosa: '#F28AB2', fucsia: '#E0218A', morado: '#7B4FB8', lila: '#B79CE0', amarillo: '#F2C230', mostaza: '#D4A017',
  naranja: '#F07B26', dorado: '#C9A227', plateado: '#C0C0C8',
};

const CATEGORY_LABEL: [RegExp, string][] = [
  [/^(top|tops|camiseta|camisetas|camisa|camisas|blusa|jersey|jerséis|sudadera|parte de arriba)/i, 'Partes de arriba'],
  [/^(bottom|bottoms|pantal|falda|faldas|vaquero|short|parte de abajo)/i, 'Partes de abajo'],
  [/^(dress|dresses|vestido|mono)/i, 'Vestidos y monos'],
  [/^(outer|outerwear|abrigo|abrigos|chaqueta|chaquetas|cazadora)/i, 'Abrigos y chaquetas'],
  [/^(shoe|shoes|zapat|calzado|bota|deportiva)/i, 'Calzado'],
  [/^(acc|accesorio|accesorios|bolso|bolsos|joya|gorra|bufanda)/i, 'Accesorios'],
];

const MOOD_LABEL: Record<string, string> = { confident: 'Segura', sport: 'Sport', creative: 'Creativa', relaxed: 'Relajada', elegant: 'Elegante', happy: 'Alegre' };

export const colorHex = (name: string) => COLOR_HEX[name.trim().toLowerCase()] ?? null;
export const categoryLabel = (raw: string) => CATEGORY_LABEL.find(([re]) => re.test(raw.trim()))?.[1] ?? 'Otras prendas';

export interface CommunityTrends {
  period: 'week' | 'month';
  looks: number;
  people: number;
  colors: { name: string; hex: string | null; share: number }[];
  categories: { name: string; share: number }[];
  moods: { name: string; share: number }[];
  topLooks: { id: string; title: string; image: string | null; likes: number; userId: string; userName: string; userAvatar: string | null }[];
  challenge: { id: string; title: string; description: string; endDate: string; participants: number } | null;
}

/** Cuenta y devuelve los [n] más frecuentes con su porcentaje. */
export function topShares(values: string[], n: number): { name: string; share: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  const total = values.filter(Boolean).length || 1;
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, c]) => ({ name, share: Math.round((c / total) * 100) }));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function communityTrends(prisma: PrismaClient, hiddenUserIds: string[] = []): Promise<CommunityTrends> {
  const load = (since: Date) => prisma.look.findMany({
    where: {
      isPublic: true, createdAt: { gte: since },
      user: { isProfilePublic: true, suspendedAt: null },
      ...(hiddenUserIds.length ? { userId: { notIn: hiddenUserIds } } : {}),
    },
    select: {
      id: true, title: true, mood: true, userId: true,
      user: { select: { name: true, avatar: true } },
      images: { take: 1, select: { url: true } },
      products: { select: { color: true, category: true } },
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  let period: CommunityTrends['period'] = 'week';
  let looks = await load(new Date(Date.now() - 7 * DAY));
  if (looks.length < 3) { period = 'month'; looks = await load(new Date(Date.now() - 30 * DAY)); }

  const products = looks.flatMap((l) => l.products);
  const colors = topShares(products.map((p) => (p.color || '').trim().toLowerCase()), 5).map((c) => ({ ...c, name: cap(c.name), hex: colorHex(c.name) }));
  const categories = topShares(products.map((p) => (p.category ? categoryLabel(p.category) : '')), 4);
  const moods = topShares(looks.map((l) => (l.mood ? MOOD_LABEL[l.mood] || cap(l.mood) : '')), 3);

  const topLooks = looks
    .filter((l) => l.images.length > 0)
    .sort((a, b) => b._count.likes - a._count.likes)
    .slice(0, 6)
    .map((l) => ({ id: l.id, title: l.title, image: l.images[0].url, likes: l._count.likes, userId: l.userId, userName: l.user.name, userAvatar: l.user.avatar }));

  const ch = await prisma.weeklyChallenge.findFirst({ where: { active: true, endDate: { gte: new Date() } }, orderBy: { startDate: 'desc' }, include: { _count: { select: { submissions: true } } } });

  return {
    period,
    looks: looks.length,
    people: new Set(looks.map((l) => l.userId)).size,
    colors, categories, moods, topLooks,
    challenge: ch ? { id: ch.id, title: ch.title, description: ch.description, endDate: ch.endDate.toISOString(), participants: ch._count.submissions } : null,
  };
}
