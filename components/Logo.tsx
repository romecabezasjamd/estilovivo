import React from 'react';

interface LogoProps {
    className?: string;
    variant?: 'horizontal' | 'icon';
    mode?: 'light' | 'dark';
    size?: number | string;
}

const Logo: React.FC<LogoProps> = ({
    className = "",
    variant = 'horizontal',
    mode = 'light',
    size
}) => {
    const isDark = mode === 'dark';
    const textColor = isDark ? '#F8FAFC' : '#0F172A';

    // Nueva Paleta de Colores
    const petrolBlue = '#083344';
    const lavender = '#A78BFA';
    const vibrantCoral = '#F43F5E';
    const goldSoft = '#FACC15';

    const symbol = (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: size || (variant === 'icon' ? '80px' : '48px'), height: 'auto' }}
        >
            {/* Cuerpo del Armario - Líneas finas y elegantes */}
            <path
                d="M30 20 H70 V82 H30 Z"
                stroke={isDark ? lavender : petrolBlue}
                strokeWidth="2.5"
                strokeLinejoin="round"
            />
            {/* Divisor de puertas */}
            <line x1="50" y1="20" x2="50" y2="82" stroke={isDark ? lavender : petrolBlue} strokeWidth="1" strokeOpacity="0.3" />

            {/* Patas minimalistas */}
            <line x1="36" y1="82" x2="36" y2="88" stroke={isDark ? lavender : petrolBlue} strokeWidth="2" strokeLinecap="round" />
            <line x1="64" y1="82" x2="64" y2="88" stroke={isDark ? lavender : petrolBlue} strokeWidth="2" strokeLinecap="round" />

            {/* Perchas abstractas - Toque de color */}
            <path d="M38 35 C38 28, 44 28, 44 35" stroke={isDark ? vibrantCoral : lavender} strokeWidth="1.5" fill="none" />
            <path d="M56 35 C56 28, 62 28, 62 35" stroke={isDark ? vibrantCoral : lavender} strokeWidth="1.5" fill="none" />
            <line x1="30" y1="35" x2="70" y2="35" stroke={isDark ? vibrantCoral : lavender} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />

            {/* Tiradores - Detalle en Oro */}
            <circle cx="45" cy="55" r="2" fill={goldSoft} />
            <circle cx="55" cy="55" r="2" fill={goldSoft} />
        </svg>
    );

    if (variant === 'icon') {
        return (
            <div className={`flex items-center justify-center p-4 rounded-[2rem] shadow-xl transition-all ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'} ${className}`}>
                {symbol}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-4 transition-all hover:scale-[1.02] ${className}`}>
            <div className="flex-shrink-0">
                {symbol}
            </div>
            <div className="flex flex-col -space-y-1">
                <span
                    className="font-black text-3xl tracking-[ -0.05em] uppercase italic leading-none"
                    style={{ color: textColor }}
                >
                    ESTILO
                </span>
                <span
                    className="font-bold text-xl tracking-[0.2em] uppercase opacity-90 leading-none pl-1"
                    style={{ color: isDark ? lavender : vibrantCoral }}
                >
                    VIVO
                </span>
            </div>
        </div>
    );
};

export default Logo;
