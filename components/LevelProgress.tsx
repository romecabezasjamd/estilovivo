import React from 'react';
import { UserState } from '../types';
import { xpProgress } from '../src/utils/xp';

interface LevelProgressProps {
    user: UserState;
}

// Returns a label for the level tier
function getLevelTitle(level: number): string {
    if (level < 3) return 'Principiante';
    if (level < 6) return 'Estilista';
    if (level < 10) return 'Fashionista';
    if (level < 15) return 'Icono';
    return 'Leyenda';
}

// Mismo diseño que la tarjeta de nivel de la app: panel oscuro, número grande y barra cálida
const LevelProgress: React.FC<LevelProgressProps> = ({ user }) => {
    const xp = user.experiencePoints ?? 0;
    const level = user.level ?? 1;
    const { current: xpInCurrentLevel, needed: xpNeeded, percentage: progressPct, toNext: xpToNext } = xpProgress(xp, level);

    return (
        <div className="ev-panel rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center" style={{ background: 'color-mix(in srgb, currentColor 12%, transparent)' }}>
                    <span className="text-[11px] font-semibold opacity-70 leading-none">NV.</span>
                    <span className="text-2xl font-bold leading-tight">{level}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xl font-bold leading-tight">{getLevelTitle(level)}</p>
                    <p className="text-sm opacity-70 mt-0.5">
                        {xp === 0 ? '¡Sube una prenda para ganar tus primeros XP!' : `${xpToNext} XP para el siguiente nivel`}
                    </p>
                </div>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden mt-5" style={{ background: 'color-mix(in srgb, currentColor 18%, transparent)' }}>
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #FF3B5C, #FFB45C)' }}
                />
            </div>
            <p className="text-sm font-medium opacity-70 mt-2">{xpInCurrentLevel} / {xpNeeded} XP</p>
        </div>
    );
};

export default LevelProgress;
