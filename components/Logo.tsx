import React from 'react';

interface LogoProps {
    className?: string;
    variant?: 'horizontal' | 'icon';
    mode?: 'light' | 'dark';
    size?: number | string;
}

const FULL_LOGO_SRC = '/estilo-vivo-logo-full.png';
const ICON_LOGO_SRC = '/estilo-vivo-logo-icon.png';

/** Evita logos borrosos en pantallas retina / WebView Android */
const logoImgStyle: React.CSSProperties = {
    imageRendering: 'auto',
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
};

const Logo: React.FC<LogoProps> = ({
    className = '',
    variant = 'horizontal',
    mode = 'light',
    size,
}) => {
    const [imageFailed, setImageFailed] = React.useState(false);
    const isDark = mode === 'dark';
    const textColor = isDark ? '#F8FAFC' : '#0F172A';
    const accentColor = isDark ? '#F43F5E' : '#A78BFA';

    const symbol = (
        <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: '100%' }}
        >
            <defs>
                <linearGradient id="hangerGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FF006E" />
                    <stop offset="35%" stopColor="#FF4365" />
                    <stop offset="65%" stopColor="#FFA700" />
                    <stop offset="100%" stopColor="#0066FF" />
                </linearGradient>
            </defs>

            {/* Hanger hook */}
            <path d="M40 20 Q40 20 40 30 M80 20 Q80 20 80 30" stroke="url(#hangerGradient)" strokeWidth="5" strokeLinecap="round" />
            
            {/* Hanger bar */}
            <path d="M40 30 L80 30" stroke="url(#hangerGradient)" strokeWidth="6" strokeLinecap="round" />
            
            {/* Left side of hanger */}
            <path d="M45 30 Q35 50 30 80" stroke="url(#hangerGradient)" strokeWidth="8" strokeLinecap="round" fill="none" />
            
            {/* Right side of hanger */}
            <path d="M75 30 Q85 50 90 80" stroke="url(#hangerGradient)" strokeWidth="8" strokeLinecap="round" fill="none" />
            
            {/* Letter E shape - left vertical */}
            <rect x="25" y="45" width="6" height="35" fill="url(#hangerGradient)" rx="2" />
            
            {/* Letter E shape - horizontal bars */}
            <rect x="25" y="45" width="12" height="5" fill="url(#hangerGradient)" rx="2" />
            <rect x="25" y="61" width="12" height="5" fill="url(#hangerGradient)" rx="2" />
            <rect x="25" y="77" width="12" height="5" fill="url(#hangerGradient)" rx="2" />
            
            {/* Checkmark */}
            <path d="M65 70 L75 82 L95 50" stroke="url(#hangerGradient)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            
            {/* Sparkle/Star */}
            <g transform="translate(70, 50)">
                <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#FFD700" />
            </g>
        </svg>
    );

    if (variant === 'icon') {
        const hasWidth = className.includes('w-') || className.includes('max-w-');
        const hasHeight = className.includes('h-') || className.includes('max-h-');
        const sizeStyle = size ? { width: size, height: size } : {};
        
        return (
            <div 
                style={sizeStyle}
                className={`flex items-center justify-center p-1 rounded-3xl shadow-xl transition-all ${
                    isDark ? 'bg-slate-950 border border-slate-800' : 'bg-white'
                } ${!hasWidth && !size ? 'w-20' : ''} ${!hasHeight && !size ? 'h-20' : ''} ${className}`}
            >
                <div className="w-full h-full flex items-center justify-center min-w-0 min-h-0">
                    {!imageFailed ? (
                        <img
                            src={ICON_LOGO_SRC}
                            alt="Estilo Vivo"
                            className="w-full h-full object-contain max-w-full max-h-full"
                            style={logoImgStyle}
                            width={120}
                            height={120}
                            loading="eager"
                            decoding="async"
                            draggable={false}
                            onError={() => setImageFailed(true)}
                        />
                    ) : symbol}
                </div>
            </div>
        );
    }

    const horizontalSize = size || '164px';

    return (
        <div className={`flex items-center transition-opacity hover:opacity-90 ${className}`}>
            {!imageFailed ? (
                <img
                    src={FULL_LOGO_SRC}
                    alt="Estilo Vivo"
                    className="block h-auto object-contain max-w-full"
                    style={{ width: horizontalSize, maxWidth: '100%', ...logoImgStyle }}
                    width={typeof horizontalSize === 'number' ? horizontalSize : 440}
                    height={120}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <div className="flex items-center gap-3">
                    <div
                        className="flex-shrink-0"
                        style={{ width: '48px', height: '48px' }}
                    >
                        {symbol}
                    </div>
                    <span className="font-sans font-black text-2xl tracking-tighter uppercase italic" style={{ color: textColor }}>
                        Estilo <span style={{ color: accentColor }}>Vivo</span>
                    </span>
                </div>
            )}
        </div>
    );
};

export default Logo;
