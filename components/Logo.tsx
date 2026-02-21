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
            style={{ width: size || (variant === 'icon' ? '80px' : '40px'), height: 'auto' }}
        >
            {/* Estructura del armario - Diseño Limpio */}
            <rect
                x="20" y="15" width="60" height="70" rx="3"
                stroke={isDark ? lavender : petrolBlue}
                strokeWidth="3"
            />
            {/* Divisor central */}
            <line
                x1="50" y1="15" x2="50" y2="85"
                stroke={isDark ? lavender : petrolBlue}
                strokeWidth="1.5"
                strokeOpacity="0.4"
            />
            {/* Barra y Perchas Minimalistas */}
            <path
                d="M28 32 H72"
                stroke={isDark ? vibrantCoral : lavender}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <circle cx="38" cy="32" r="4" stroke={isDark ? vibrantCoral : lavender} strokeWidth="1.5" fill="none" />
            <circle cx="62" cy="32" r="4" stroke={isDark ? vibrantCoral : lavender} strokeWidth="1.5" fill="none" />
            {/* Tiradores Coral/Oro */}
            <circle cx="44" cy="50" r="2" fill={isDark ? goldSoft : vibrantCoral} />
            <circle cx="56" cy="50" r="2" fill={isDark ? goldSoft : vibrantCoral} />
            {/* Base */}
            <path
                d="M30 85 H70"
                stroke={isDark ? lavender : petrolBlue}
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );

    if (variant === 'icon') {
        return (
            <div className={`flex items-center justify-center p-4 rounded-3xl shadow-lg transition-all ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'} ${className}`}>
                {symbol}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 transition-opacity hover:opacity-90 ${className}`}>
            <div className="flex-shrink-0">
                {symbol}
            </div>
            <span
                className="font-sans font-black text-2xl tracking-tighter uppercase italic"
                style={{ color: textColor }}
            >
                Estilo <span style={{ color: isDark ? lavender : vibrantCoral }}>Vivo</span>
            </span>
        </div>
    );
};

export default Logo;
