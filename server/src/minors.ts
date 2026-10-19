// Protección de menores (14-17 años) y adulto responsable vinculado.
// - Edad mínima para registrarse: 14 (en España, por debajo hace falta consentimiento de madre/padre/tutor).
// - Menores: perfil privado por defecto; chat solo con seguidores mutuos; comprar/vender solo si un adulto
//   vinculado (con cuenta propia, verificada y mayor de edad) lo autoriza. Se puede retirar en cualquier momento.
import type { PrismaClient } from '@prisma/client';

export const MIN_AGE = 14;
export const ADULT_AGE = 18;

export function ageFrom(birthDate: Date | string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/** Valida una fecha de nacimiento de registro. Devuelve el mensaje de error o null si es válida. */
export function birthDateError(birthDate: unknown, now = new Date()): string | null {
  if (!birthDate || typeof birthDate !== 'string') return 'Indica tu fecha de nacimiento.';
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return 'Fecha de nacimiento no válida.';
  if (d > now) return 'La fecha de nacimiento no puede ser futura.';
  const age = ageFrom(d, now)!;
  if (age > 120) return 'Fecha de nacimiento no válida.';
  if (age < MIN_AGE) return `Debes tener al menos ${MIN_AGE} años para usar Estilo Vivo.`;
  return null;
}

export const isMinorDate = (birthDate: Date | string | null | undefined) => {
  const age = ageFrom(birthDate);
  return age !== null && age < ADULT_AGE;
};
export const isAdultDate = (birthDate: Date | string | null | undefined) => {
  const age = ageFrom(birthDate);
  return age !== null && age >= ADULT_AGE;
};

export const MARKETPLACE_ERRORS = {
  birthDateRequired: 'Para comprar o vender indica primero tu fecha de nacimiento en tu perfil.',
  guardianRequired: 'Como eres menor de edad, para comprar o vender necesitas que un adulto vinculado lo autorice (Ajustes > Adulto responsable).',
  minorChat: 'Por seguridad, las personas menores de edad solo pueden chatear con quien se siguen mutuamente.',
};

type Db = Pick<PrismaClient, 'user' | 'follow' | 'guardianLink'>;

/** ¿Puede este usuario comprar y vender? (adulto con fecha indicada, o menor autorizado por su adulto vinculado) */
export async function marketplaceStatus(db: Db, userId: string): Promise<{ allowed: boolean; reason?: keyof typeof MARKETPLACE_ERRORS }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { birthDate: true } });
  if (!user?.birthDate) return { allowed: false, reason: 'birthDateRequired' };
  if (!isMinorDate(user.birthDate)) return { allowed: true };
  const link = await db.guardianLink.findUnique({ where: { minorId: userId }, select: { status: true, marketplaceAllowed: true } });
  return link?.status === 'APPROVED' && link.marketplaceAllowed ? { allowed: true } : { allowed: false, reason: 'guardianRequired' };
}

/**
 * ¿Pueden hablar estas dos personas? Sin menores: sí. Con algún menor: si se siguen mutuamente, o si la
 * conversación es sobre una prenda en venta y cada menor implicado tiene la compraventa autorizada.
 */
export async function chatAllowed(db: Db, aId: string, bId: string, aboutItem: boolean): Promise<boolean> {
  const users = await db.user.findMany({ where: { id: { in: [aId, bId] } }, select: { id: true, birthDate: true } });
  const minors = users.filter((u) => isMinorDate(u.birthDate));
  if (minors.length === 0) return true;
  const mutual = await db.follow.count({
    where: { OR: [{ followerId: aId, followingId: bId }, { followerId: bId, followingId: aId }] },
  });
  if (mutual === 2) return true;
  if (!aboutItem) return false;
  for (const m of minors) {
    if (!(await marketplaceStatus(db, m.id)).allowed) return false;
  }
  return true;
}

/** Campos calculados que reciben las apps junto al usuario. */
export async function accountFlags(db: Db, user: { id: string; birthDate: Date | null }) {
  const minor = isMinorDate(user.birthDate);
  const market = await marketplaceStatus(db, user.id);
  return {
    isMinor: minor,
    needsBirthDate: !user.birthDate,
    marketplaceAllowed: market.allowed,
  };
}
