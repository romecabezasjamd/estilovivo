import React, { useEffect, useState } from 'react';

interface ConfettiOverlayProps {
  active: boolean;
  color?: string;
  onFinish?: () => void;
}

const COLORS = ['#ff4d94', '#14b8a6', '#a78bfa', '#f59e0b', '#22c55e', '#3b82f6'];

const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({ active, color, onFinish }) => {
  const [pieces, setPieces] = useState<{ id: number; x: number; delay: number; color: string; size: number }[]>([]);

  useEffect(() => {
    if (!active) { setPieces([]); return; }
    const mainColor = color || COLORS[0];
    const newPieces = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      delay: Math.random() * 0.3,
      color: i < 5 ? mainColor : COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 6,
    }));
    setPieces(newPieces);
    const timer = setTimeout(() => { setPieces([]); onFinish?.(); }, 1800);
    return () => clearTimeout(timer);
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[90] overflow-hidden" aria-hidden="true">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute animate-confetti-piece"
          style={{
            left: `${p.x}%`,
            top: '30%',
            width: p.size,
            height: p.size * 1.5,
            backgroundColor: p.color,
            borderRadius: p.id % 2 === 0 ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default ConfettiOverlay;
