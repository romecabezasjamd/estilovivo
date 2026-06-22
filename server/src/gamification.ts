import { PrismaClient } from '@prisma/client';

const POINTS: Record<string, number> = {
    garment: 10,
    look: 20,
    planner: 5,
};

export async function awardPoints(
    prisma: PrismaClient,
    userId: string,
    action: 'garment' | 'look' | 'planner',
): Promise<{ experiencePoints: number; level: number }> {
    const { awardXp } = await import('./gamificationSystem.js');
    const pts = POINTS[action] ?? 0;
    if (pts === 0) return { experiencePoints: 0, level: 1 };
    const result = await awardXp(prisma, userId, pts);
    return { experiencePoints: result.experiencePoints, level: result.level };
}
