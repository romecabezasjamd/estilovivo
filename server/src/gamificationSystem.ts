import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

export const XP_VALUES = {
  publishLook: 20,
  publishStory: 15,
  receiveLike: 2,
  comment: 3,
  storyReaction: 1,
  challengeBase: 50,
  dailyLogin: 5,
  achievementBonus: 0,
} as const;

export function cumulativeXpForLevel(level: number): number {
  return 100 * level * (level + 1) / 2;
}

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor((Math.sqrt(1 + 8 * xp / 100) - 1) / 2) + 1);
}

export function xpProgress(xp: number, level: number): { current: number; needed: number; percentage: number } {
  const currentLevelXp = level <= 1 ? 0 : cumulativeXpForLevel(level - 1);
  const nextLevelXp = cumulativeXpForLevel(level);
  const current = xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  return {
    current: Math.max(0, current),
    needed: Math.max(1, needed),
    percentage: Math.min(100, Math.max(0, (current / Math.max(1, needed)) * 100)),
  };
}

export const ACHIEVEMENTS = [
  { key: 'first_look', title: 'Primer Look', description: 'Sube tu primer look al feed', icon: '📸', xpReward: 50 },
  { key: 'first_challenge', title: 'Primer Reto', description: 'Completa tu primer reto semanal', icon: '🏆', xpReward: 100 },
  { key: 'five_looks', title: 'Creadora de Estilo', description: 'Sube 5 looks al feed', icon: '👗', xpReward: 150 },
  { key: 'ten_likes_total', title: 'Popular', description: 'Acumula 10 likes en total', icon: '❤️', xpReward: 100 },
  { key: 'fifty_likes_total', title: 'Influencer', description: 'Acumula 50 likes en total', icon: '⭐', xpReward: 200 },
  { key: 'three_challenges', title: 'Retadora', description: 'Completa 3 retos semanales', icon: '🎯', xpReward: 150 },
  { key: 'five_challenges', title: 'Veterana de Retos', description: 'Completa 5 retos semanales', icon: '💎', xpReward: 250 },
  { key: 'level_5', title: 'Novata Avanzada', description: 'Alcanza el nivel 5', icon: '🌟', xpReward: 100 },
  { key: 'level_10', title: 'Experta', description: 'Alcanza el nivel 10', icon: '👑', xpReward: 200 },
  { key: 'level_20', title: 'Leyenda', description: 'Alcanza el nivel 20', icon: '🔥', xpReward: 500 },
  { key: 'first_story', title: 'Primera Historia', description: 'Publica tu primera historia', icon: '📖', xpReward: 30 },
  { key: 'first_comment', title: 'Comunicativa', description: 'Escribe tu primer comentario', icon: '💬', xpReward: 20 },
  { key: 'streak_3', title: 'Racha de 3 Días', description: 'Mantén una racha de 3 días', icon: '🔗', xpReward: 50 },
  { key: 'streak_7', title: 'Racha de 7 Días', description: 'Mantén una racha de 7 días', icon: '🔥', xpReward: 100 },
  { key: 'streak_30', title: 'Racha de 30 Días', description: 'Mantén una racha de 30 días', icon: '💪', xpReward: 300 },
  { key: 'first_like_received', title: 'Reconocida', description: 'Recibe tu primer like', icon: '👍', xpReward: 20 },
  { key: 'first_reaction', title: 'Empática', description: 'Reacciona a una historia', icon: '💛', xpReward: 15 },
];

export const BADGES = [
  { key: 'first_challenge', title: 'Primer Reto', description: 'Completaste tu primer reto semanal', icon: '🏅', category: 'retos' },
  { key: 'challenge_master', title: 'Maestra de Retos', description: 'Completaste 5 retos semanales', icon: '🏆', category: 'retos' },
  { key: 'level_5', title: 'Nivel 5', description: 'Alcanzaste el nivel 5', icon: '⭐', category: 'nivel' },
  { key: 'level_10', title: 'Nivel 10', description: 'Alcanzaste el nivel 10', icon: '👑', category: 'nivel' },
  { key: 'level_20', title: 'Nivel 20', description: 'Alcanzaste el nivel 20', icon: '💎', category: 'nivel' },
  { key: 'social_butterfly', title: 'Mariposa Social', description: 'Recibiste 50 likes en total', icon: '🦋', category: 'social' },
  { key: 'storyteller', title: 'Cuentacuentos', description: 'Publicaste 5 historias', icon: '📖', category: 'social' },
  { key: 'streak_7', title: 'Racha de 7 Días', description: 'Mantuviste una racha de 7 días', icon: '🔥', category: 'rachas' },
  { key: 'streak_30', title: 'Racha de 30 Días', description: 'Mantuviste una racha de 30 días', icon: '💪', category: 'rachas' },
  { key: 'first_look', title: 'Primer Look', description: 'Subiste tu primer look', icon: '👗', category: 'social' },
];

export async function awardXp(
  prisma: PrismaClient,
  userId: string,
  amount: number,
): Promise<{ experiencePoints: number; level: number; leveledUp: boolean }> {
  if (amount <= 0) return { experiencePoints: 0, level: 1, leveledUp: false };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { experiencePoints: true, level: true } });
  if (!user) return { experiencePoints: 0, level: 1, leveledUp: false };
  const oldLevel = user.level;
  const newXp = (user.experiencePoints || 0) + amount;
  const newLevel = levelFromXp(newXp);
  await prisma.user.update({
    where: { id: userId },
    data: { experiencePoints: newXp, level: newLevel },
  });
  return { experiencePoints: newXp, level: newLevel, leveledUp: newLevel > oldLevel };
}

export async function removeXp(
  prisma: PrismaClient,
  userId: string,
  amount: number,
): Promise<{ experiencePoints: number; level: number }> {
  if (amount <= 0) return { experiencePoints: 0, level: 1 };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { experiencePoints: true } });
  if (!user) return { experiencePoints: 0, level: 1 };
  const newXp = Math.max(0, (user.experiencePoints || 0) - amount);
  const newLevel = levelFromXp(newXp);
  await prisma.user.update({
    where: { id: userId },
    data: { experiencePoints: newXp, level: newLevel },
  });
  return { experiencePoints: newXp, level: newLevel };
}

export async function checkAndUnlockAchievements(
  prisma: PrismaClient,
  userId: string,
  io?: any,
): Promise<any[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      looks: true,
      challengeSubmissions: true,
      stories: true,
      comments: true,
      achievements: true,
    },
  });
  if (!user) return [];

  const totalLikesReceived = await prisma.like.count({
    where: { look: { userId } },
  });

  const streak = await prisma.userStreak.findUnique({ where: { userId } });

  const unlocked: any[] = [];
  const u = user as any;
  const existingKeys = new Set(u.achievements.map((a: any) => a.achievementKey));

  const streakCount = streak?.loginCount || 0;

  const checks: Record<string, () => boolean> = {
    first_look: () => u.looks?.length >= 1,
    first_story: () => u.stories?.length >= 1,
    first_comment: () => u.comments?.length >= 1,
    first_challenge: () => u.challengeSubmissions?.length >= 1,
    three_challenges: () => u.challengeSubmissions?.length >= 3,
    five_challenges: () => u.challengeSubmissions?.length >= 5,
    five_looks: () => u.looks?.length >= 5,
    level_5: () => (u.level || 1) >= 5,
    level_10: () => (u.level || 1) >= 10,
    level_20: () => (u.level || 1) >= 20,
    first_like_received: () => totalLikesReceived > 0,
    streak_3: () => streakCount >= 3,
    streak_7: () => streakCount >= 7,
    streak_30: () => streakCount >= 30,
    ten_likes_total: () => totalLikesReceived >= 10,
    fifty_likes_total: () => totalLikesReceived >= 50,
    first_reaction: () => false,
  };

  for (const ach of ACHIEVEMENTS) {
    if (existingKeys.has(ach.key)) continue;
    const checkFn = checks[ach.key];
    if (checkFn && checkFn()) {
      try {
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementKey: ach.key,
            title: ach.title,
            description: ach.description,
            icon: ach.icon,
            xpReward: ach.xpReward,
          },
        });
        if (ach.xpReward > 0) {
          await awardXp(prisma, userId, ach.xpReward);
        }
        unlocked.push(ach);
      } catch (e: any) {
        if (!e.message?.includes('Unique constraint')) {
          logger.warn('Failed to unlock achievement', { key: ach.key, error: e.message });
        }
      }
    }
  }

  return unlocked;
}

export async function updateStreak(prisma: PrismaClient, userId: string): Promise<{ count: number; updated: boolean }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = await prisma.userStreak.findUnique({ where: { userId } });
  if (!streak) {
    streak = await prisma.userStreak.create({
      data: { userId, loginCount: 1, lastDate: today },
    });
    return { count: 1, updated: true };
  }
  const lastDate = streak.lastDate ? new Date(streak.lastDate) : null;
  if (!lastDate) {
    await prisma.userStreak.update({
      where: { userId },
      data: { loginCount: 1, lastDate: today },
    });
    return { count: 1, updated: true };
  }
  lastDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return { count: streak.loginCount, updated: false };
  }
  if (diffDays === 1) {
    const newCount = streak.loginCount + 1;
    await prisma.userStreak.update({
      where: { userId },
      data: { loginCount: newCount, lastDate: today },
    });
    return { count: newCount, updated: true };
  }
  await prisma.userStreak.update({
    where: { userId },
    data: { loginCount: 1, lastDate: today },
  });
  return { count: 1, updated: true };
}

export async function checkAndUnlockBadges(
  prisma: PrismaClient,
  userId: string,
  streakCount?: number,
  challengeCount?: number,
  level?: number,
): Promise<any[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { badges: true, challengeSubmissions: true, stories: true, looks: true },
  });
  if (!user) return [];

  const totalLikesReceived = await prisma.like.count({
    where: { look: { userId } },
  });

  const unlocked: any[] = [];
  const existingKeys = new Set(user.badges.map((b: any) => b.badgeKey));
  const cCount = challengeCount ?? user.challengeSubmissions.length;
  const lvl = level ?? user.level ?? 1;
  const streak = streakCount ?? 0;
  const storiesCount = user.stories.length;

  const badgeChecks: Record<string, boolean> = {
    first_challenge: cCount >= 1,
    challenge_master: cCount >= 5,
    level_5: lvl >= 5,
    level_10: lvl >= 10,
    level_20: lvl >= 20,
    social_butterfly: totalLikesReceived >= 50,
    storyteller: storiesCount >= 5,
    streak_7: streak >= 7,
    streak_30: streak >= 30,
    first_look: (user as any).looks?.length >= 1,
  };

  for (const badge of BADGES) {
    if (existingKeys.has(badge.key)) continue;
    if (badgeChecks[badge.key]) {
      try {
        await prisma.userBadge.create({
          data: {
            userId,
            badgeKey: badge.key,
            title: badge.title,
            description: badge.description,
            icon: badge.icon,
          },
        });
        unlocked.push(badge);
      } catch (e: any) {
        if (!e.message?.includes('Unique constraint')) {
          logger.warn('Failed to unlock badge', { key: badge.key, error: e.message });
        }
      }
    }
  }
  return unlocked;
}
