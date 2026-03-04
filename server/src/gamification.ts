import { PrismaClient } from '@prisma/client';

// XP awarded per action
const POINTS: Record<string, number> = {
    garment: 10,
    look: 20,
    planner: 5,
};

// XP required to reach next level (simple linear: 100 XP per level)
const XP_PER_LEVEL = 100;

/**
 * Awards experience points to a user and recalculates their level.
 * Uses a single DB update, safe to call fire-and-forget.
 */
export async function awardPoints(
    prisma: PrismaClient,
    userId: string,
    action: 'garment' | 'look' | 'planner',
): Promise<{ experiencePoints: number; level: number }> {
    const pts = POINTS[action] ?? 0;
    if (pts === 0) return { experiencePoints: 0, level: 1 };

    // Increment XP atomically and read the new value
    const updated = await prisma.user.update({
        where: { id: userId },
        data: { experiencePoints: { increment: pts } },
        select: { experiencePoints: true },
    });

    const newXp = updated.experiencePoints;
    const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;

    // Update level only if it changed (avoids a redundant write most of the time)
    await prisma.user.update({
        where: { id: userId },
        data: { level: newLevel },
    });

    return { experiencePoints: newXp, level: newLevel };
}
