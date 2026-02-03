import React, { useState, useMemo } from 'react';

interface ChartData {
  name: string;
  avgMastery: number;
  count: number;
}

interface TopicMasteryChartProps {
  data: ChartData[];
}

interface TooltipData {
  x: number;
  y: number;
  data: ChartData;
}

const TopicMasteryChart: React.FC<TopicMasteryChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const width = 500;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 80, left: 40 };

  const displayedData = useMemo(() => data.slice(0, 20), [data]);

  const { xScale, yScale, innerWidth, innerHeight, barWidth } = useMemo(() => {
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    
    const bandWidth = displayedData.length > 0 ? innerW / displayedData.length : 0;
    const barW = bandWidth * 0.7;

    const xScaleFn = (index: number) => padding.left + index * bandWidth;
    const yScaleFn = (value: number) => padding.top + innerH - (value / 100) * innerH;
    
    return {
      xScale: xScaleFn,
      yScale: yScaleFn,
      innerWidth: innerW,
      innerHeight: innerH,
      barWidth: barW,
    };
  }, [displayedData.length]);
  

  const getMasteryColor = (score: number) => {
    if (score < 40) return 'rgb(239, 68, 68)'; // red-500
    if (score < 80) return 'rgb(245, 158, 11)'; // amber-500
    return 'rgb(16, 185, 129)'; // emerald-500
  };
  
  const handleMouseMove = (chartData: ChartData, index: number) => {
    const bandWidth = innerWidth / displayedData.length;
    const barX = xScale(index) + (bandWidth - barWidth) / 2;
    const x = barX + barWidth / 2;
    const y = yScale(chartData.avgMastery);
    setTooltip({ x, y, data: chartData });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };
  
  if (!displayedData || displayedData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-bunker-500 dark:text-bunker-400">
        Nenhum dado de tema para exibir.
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
        {displayedData.map((d, i) => {
          const bandWidth = innerWidth / displayedData.length;
          const x = xScale(i) + (bandWidth - barWidth) / 2;
          const y = yScale(d.avgMastery);
          const barHeight = Math.max(1, (d.avgMastery / 100) * innerHeight); // Min height of 1px
          
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
                fill={getMasteryColor(d.avgMastery)}
                className="transition-opacity duration-200 cursor-pointer"
                opacity={tooltip && tooltip.data.name !== d.name ? 0.5 : 1}
                rx="2"
              />
               <text 
                 x={x + barWidth / 2} 
                 y={height - padding.bottom + 15}
                 textAnchor="end"
                 className="text-[10px] fill-bunker-400 dark:fill-bunker-500 pointer-events-none"
                 transform={`rotate(-45 ${x + barWidth / 2},${height - padding.bottom + 15})`}
               >
                 {d.name.length > 15 ? `${d.name.substring(0, 13)}...` : d.name}
               </text>
            </g>
          )
        })}
      </svg>
      
      {/* Tooltip */}
      {tooltip && (
          <div className="absolute p-2 text-xs text-white bg-bunker-900/80 dark:bg-bunker-950/80 rounded-md shadow-lg pointer-events-none"
             style={{ 
                 left: `${(tooltip.x / width) * 100}%`, 
                 top: `${(tooltip.y / height) * 100}%`, 
                 transform: `translate(-50%, -110%)` 
             }}
          >
              <p className="font-bold mb-1 max-w-[200px] truncate">{tooltip.data.name}</p>
              <p>Domínio Médio: <strong>{tooltip.data.avgMastery.toFixed(0)}%</strong></p>
              <p>Questões: <strong>{tooltip.data.count}</strong></p>
          </div>
      )}
    </div>
  );
};

export default TopicMasteryChart;
