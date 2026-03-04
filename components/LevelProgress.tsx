import React from 'react';
import { UserState } from '../types';

interface LevelProgressProps {
    user: UserState;
}

const XP_PER_LEVEL = 100;

// Returns a label for the level tier
function getLevelTitle(level: number): string {
    if (level < 3) return 'Principiante';
    if (level < 6) return 'Estilista';
    if (level < 10) return 'Fashionista';
    if (level < 15) return 'Icono';
    return 'Leyenda';
}

const LevelProgress: React.FC<LevelProgressProps> = ({ user }) => {
    const xp = user.experiencePoints ?? 0;
    const level = user.level ?? 1;
    const xpInCurrentLevel = xp % XP_PER_LEVEL;
    const progressPct = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
    const xpToNext = XP_PER_LEVEL - xpInCurrentLevel;

    return (
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            {/* Level Badge */}
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-teal-400 flex flex-col items-center justify-center shadow-md shadow-primary/20">
                <span className="text-[10px] text-white/80 font-bold leading-none">Nv.</span>
                <span className="text-base font-extrabold text-white leading-none">{level}</span>
            </div>

            {/* Progress info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{getLevelTitle(level)}</span>
                    <span className="text-[10px] text-gray-400">{xpInCurrentLevel} / {XP_PER_LEVEL} XP</span>
                </div>

                {/* Bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all duration-700 ease-out"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                <p className="text-[10px] text-gray-400 mt-0.5">
                    {xp === 0 ? '¡Sube una prenda para ganar tus primeros XP!' : `${xpToNext} XP para el siguiente nivel`}
                </p>
            </div>
        </div>
    );
};

export default LevelProgress;
