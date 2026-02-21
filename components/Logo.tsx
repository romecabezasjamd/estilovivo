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
    const textColor = isDark ? '#FFFFFF' : '#2E2E2E';
    const mintGreen = '#7FC8A9';
    const coralSoft = '#F27A6A';

    const symbol = (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: size || (variant === 'icon' ? '120px' : '48px'), height: 'auto' }}
        >
            {/* Percha minimalista - Trazo fino y curvo */}
            <path
                d="M20 45 C20 35, 80 35, 80 45"
                stroke={isDark ? "#E5E7EB" : "#4B5563"}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M50 35 V28 C50 22, 60 22, 60 28"
                stroke={isDark ? "#E5E7EB" : "#4B5563"}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />

            {/* Ola orgánica tipo ola - Color Coral */}
            <path
                d="M15 65 Q 50 85, 85 65"
                stroke={coralSoft}
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
            />

            {/* Hoja superpuesta - Verde Menta, inclinada a la derecha */}
            <path
                d="M50 62 C 60 52, 80 67, 60 77 C 50 82, 40 72, 50 62"
                fill={mintGreen}
                transform="rotate(15, 60, 70)"
            />
        </svg>
    );

    if (variant === 'icon') {
        return (
            <div className={`flex items-center justify-center p-6 rounded-[2rem] shadow-sm ${isDark ? 'bg-[#1A1A1A]' : 'bg-white'} ${className}`}>
                {symbol}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-4 ${className}`}>
            {symbol}
            <span
                className="font-serif font-bold text-3xl tracking-tight"
                style={{ color: textColor }}
            >
                Estilo Vivo
            </span>
        </div>
    );
};

export default Logo;
