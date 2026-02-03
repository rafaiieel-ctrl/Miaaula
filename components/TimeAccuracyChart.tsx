import React, { useState } from 'react';

interface BandData {
  name: string;
  accuracy: number;
  count: number;
}

interface TimeAccuracyChartProps {
  data: BandData[];
}

interface TooltipData {
  x: number;
  y: number;
  data: BandData;
}

const TimeAccuracyChart: React.FC<TimeAccuracyChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const width = 500;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  
  const bandWidth = data.length > 0 ? innerWidth / data.length : 0;
  const barWidth = bandWidth * 0.6;

  const xScale = (index: number) => padding.left + index * bandWidth;
  const yScale = (value: number) => padding.top + innerHeight - (value / 100) * innerHeight;

  const getAccuracyColor = (score: number) => {
    if (score < 60) return 'fill-red-500';
    if (score < 85) return 'fill-amber-500';
    return 'fill-emerald-500';
  };
  
  const handleMouseMove = (chartData: BandData, index: number) => {
    const barX = xScale(index) + (bandWidth - barWidth) / 2;
    const x = barX + barWidth / 2;
    const y = yScale(chartData.accuracy);
    setTooltip({ x, y, data: chartData });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };
  
  if (!data || data.length === 0 || data.every(d => d.count === 0)) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-bunker-500 dark:text-bunker-400">
        Dados insuficientes para exibir o gráfico de tempo vs. acurácia.
      </div>
    );
  }
  
  const yLabels = [0, 25, 50, 75, 100];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Y-Axis and Grid */}
        {yLabels.map(label => (
          <g key={`y-grid-${label}`}>
            <line
              x1={padding.left} y1={yScale(label)}
              x2={width - padding.right} y2={yScale(label)}
              className="stroke-bunker-200 dark:stroke-bunker-800" strokeWidth="1" strokeDasharray="2,2" />
            <text x={padding.left - 8} y={yScale(label) + 4} textAnchor="end" className="text-xs fill-bunker-400">{label}%</text>
          </g>
        ))}

        {/* Bars and X-Axis labels */}
        {data.map((d, i) => {
          const x = xScale(i) + (bandWidth - barWidth) / 2;
          const y = yScale(d.accuracy);
          const barHeight = Math.max(1, (d.accuracy / 100) * innerHeight);
          
          return (
            <g 
                key={d.name}
                onMouseMove={() => handleMouseMove(d, i)}
                onMouseLeave={handleMouseLeave}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                className={`${getAccuracyColor(d.accuracy)} transition-opacity duration-200 cursor-pointer`}
                opacity={tooltip && tooltip.data.name !== d.name ? 0.5 : 1}
                rx="2"
              />
               <text 
                 x={x + barWidth / 2} 
                 y={height - padding.bottom + 15}
                 textAnchor="middle"
                 className="text-xs fill-bunker-400 dark:fill-bunker-500 pointer-events-none"
               >
                 {d.name}
               </text>
            </g>
          )
        })}
        <text x={width / 2} y={height-5} textAnchor="middle" className="text-xs font-semibold fill-bunker-500 dark:fill-bunker-400">Faixa de Tempo (vs Alvo)</text>
      </svg>
      
      {tooltip && (
          <div className="absolute p-2 text-xs text-white bg-bunker-900/80 dark:bg-bunker-950/80 rounded-md shadow-lg pointer-events-none"
             style={{ 
                 left: `${(tooltip.x / width) * 100}%`, 
                 top: `${(tooltip.y / height) * 100}%`, 
                 transform: `translate(-50%, -110%)` 
             }}
          >
              <p className="font-bold mb-1">{tooltip.data.name}</p>
              <p>Acurácia: <strong>{tooltip.data.accuracy.toFixed(0)}%</strong></p>
              <p>Questões: <strong>{tooltip.data.count}</strong></p>
          </div>
      )}
    </div>
  );
};

export default TimeAccuracyChart;
