import React from 'react';

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ slices, size = 120, strokeWidth = 18 }) => {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        {slices.map((slice, i) => {
          const sliceLen = (slice.value / total) * circumference;
          const offset = cumulative;
          cumulative += sliceLen;
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${sliceLen} ${circumference - sliceLen}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-2 justify-center">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="text-[10px] text-gray-500">{slice.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
