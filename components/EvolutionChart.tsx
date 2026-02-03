
import React, { useState, useMemo } from 'react';

interface ChartDataPoint {
  date: string;
  reviewed: number;
  added: number;
}

interface EvolutionChartProps {
  data: ChartDataPoint[];
  period: '7d' | '30d' | 'month' | 'year';
}

interface TooltipData {
  x: number;
  y: number;
  date: string;
  reviewed: number;
  added: number;
}

const EvolutionChart: React.FC<EvolutionChartProps> = ({ data, period }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const width = 500;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 30 };

  const { xScale, yScale, xLabels, yLabels, reviewedPath, addedPath } = useMemo(() => {
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const maxYValue = Math.max(1, ...data.map(d => Math.max(d.reviewed, d.added)));
    const roundedMaxY = Math.ceil(maxYValue / 5) * 5 || 5;

    const xScaleFn = (index: number) => padding.left + (index / (data.length - 1)) * innerWidth;
    const yScaleFn = (value: number) => padding.top + innerHeight - (value / roundedMaxY) * innerHeight;
    
    const yLabelsData = Array.from({ length: 6 }, (_, i) => Math.round((roundedMaxY / 5) * i));
    
    const maxLabels = period === 'year' ? 12 : 7;
    const xLabelsData = data
        .filter((_, i) => data.length <= maxLabels || i % Math.ceil(data.length / maxLabels) === 0 || i === data.length - 1)
        .map(d => {
            const dateObj = new Date(`${d.date}T12:00:00Z`);
            let label = '';
            if (period === 'year') {
                label = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            } else {
                label = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }
            return {
                x: xScaleFn(data.indexOf(d)),
                label
            }
    });

    const createPath = (key: 'reviewed' | 'added') => data.map((d, i) => `${xScaleFn(i)},${yScaleFn(d[key])}`).join(' ');

    return {
      xScale: xScaleFn,
      yScale: yScaleFn,
      xLabels: xLabelsData,
      yLabels: yLabelsData,
      reviewedPath: createPath('reviewed'),
      addedPath: createPath('added'),
    };
  }, [data, period, width, height, padding]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    const cursorPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    if (data.length < 1) return;
    const indexRatio = (cursorPoint.x - padding.left) / (width - padding.left - padding.right);
    const index = Math.round(indexRatio * (data.length - 1));

    if (index >= 0 && index < data.length) {
      const d = data[index];
      const dateObj = new Date(`${d.date}T12:00:00Z`);
      let dateLabel = '';
        if (period === 'year') {
            dateLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        } else {
            dateLabel = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        }

      setTooltip({
        x: xScale(index),
        y: Math.min(yScale(d.reviewed), yScale(d.added)),
        date: dateLabel,
        reviewed: d.reviewed,
        added: d.added,
      });
      setHoveredDate(d.date);
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
    setHoveredDate(null);
  };
  
  if (!data || data.length < 2) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-bunker-500 dark:text-bunker-400">
        Dados insuficientes para exibir o gráfico de evolução.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="w-full h-auto">
        {/* Grid lines */}
        {yLabels.map(label => (
          <line
            key={`grid-y-${label}`}
            x1={padding.left} y1={yScale(label)}
            x2={width - padding.right} y2={yScale(label)}
            className="stroke-bunker-200 dark:stroke-bunker-800"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}
        {xLabels.map(({ x, label }) => (
            <line
                key={`grid-x-${label}`}
                x1={x} y1={padding.top}
                x2={x} y2={height - padding.bottom}
                className="stroke-bunker-200 dark:stroke-bunker-800"
                strokeWidth="1"
                strokeDasharray="2,2"
            />
        ))}

        {/* Axes */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="stroke-bunker-300 dark:stroke-bunker-700" strokeWidth="1" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="stroke-bunker-300 dark:stroke-bunker-700" strokeWidth="1" />
        
        {/* Labels */}
        {yLabels.map(label => (
          <text key={`label-y-${label}`} x={padding.left - 8} y={yScale(label) + 3} textAnchor="end" className="text-xs fill-bunker-400">{label}</text>
        ))}
        {xLabels.map(({ x, label }) => (
          <text key={`label-x-${label}`} x={x} y={height - padding.bottom + 15} textAnchor="middle" className="text-xs fill-bunker-400">{label}</text>
        ))}

        {/* Data lines */}
        <polyline points={reviewedPath} fill="none" className="stroke-sky-500" strokeWidth="2" />
        <polyline points={addedPath} fill="none" className="stroke-emerald-500" strokeWidth="2" />
        
        {/* Hover indicator */}
        {tooltip && (
          <line 
            x1={tooltip.x} y1={padding.top}
            x2={tooltip.x} y2={height - padding.bottom}
            className="stroke-bunker-400 dark:stroke-bunker-500"
            strokeWidth="1"
            strokeDasharray="3,3"
            pointerEvents="none"
          />
        )}
        
        {/* Data points */}
        {data.map((d, i) => (
            <React.Fragment key={d.date}>
                <circle cx={xScale(i)} cy={yScale(d.reviewed)} r={hoveredDate === d.date ? 5 : 3} className={`transition-all ${hoveredDate === d.date ? 'fill-sky-400' : 'fill-sky-500'}`} />
                <circle cx={xScale(i)} cy={yScale(d.added)} r={hoveredDate === d.date ? 5 : 3} className={`transition-all ${hoveredDate === d.date ? 'fill-emerald-400' : 'fill-emerald-500'}`} />
            </React.Fragment>
        ))}
      </svg>
      
      {/* Tooltip */}
      {tooltip && (
          <div className="absolute p-2 text-xs text-white bg-bunker-900/80 dark:bg-bunker-950/80 rounded-md shadow-lg pointer-events-none"
             style={{ left: tooltip.x + 10, top: tooltip.y - 30, transform: 'translateX(-50%)' }}
          >
              <p className="font-bold mb-1">{tooltip.date}</p>
              <p><span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1"></span>Revisadas: {tooltip.reviewed}</p>
              <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>Registradas: {tooltip.added}</p>
          </div>
      )}

      {/* Legend */}
      <div className="flex justify-center items-center gap-4 text-xs mt-2">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-sky-500"></div> Questões Revisadas</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Questões Registradas</div>
      </div>
    </div>
  );
};

export default EvolutionChart;
