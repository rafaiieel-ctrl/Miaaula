import React, { useState, useMemo } from 'react';

interface ChartDataPoint {
  date: string;
  avgMastery: number | null;
}

interface EvolutionChartProps {
  data: ChartDataPoint[];
  period: '7d' | '30d' | 'month' | 'year';
}

interface TooltipData {
  x: number;
  y: number;
  date: string;
  avgMastery: number;
}

const AverageMasteryEvolutionChart: React.FC<EvolutionChartProps> = ({ data, period }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const width = 500;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  const { xScale, yScale, xLabels, yLabels, lineSegments, points } = useMemo(() => {
    if (data.length < 2) return { xScale: () => 0, yScale: () => 0, xLabels: [], yLabels: [], lineSegments: [], points: [] };
    
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    
    const roundedMaxY = 100;

    const xScaleFn = (index: number) => padding.left + (index / (data.length - 1)) * innerWidth;
    const yScaleFn = (value: number) => padding.top + innerHeight - (value / roundedMaxY) * innerHeight;
    
    const yLabelsData = Array.from({ length: 5 }, (_, i) => Math.round((roundedMaxY / 4) * i));
    
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

    const segments: string[] = [];
    let currentSegment: string[] = [];
    const pts: { x: number; y: number; value: number }[] = [];

    data.forEach((d, i) => {
      if (d.avgMastery !== null) {
        const x = xScaleFn(i);
        const y = yScaleFn(d.avgMastery);
        currentSegment.push(`${x},${y}`);
        pts.push({ x, y, value: d.avgMastery });
      } else {
        if (currentSegment.length > 1) {
          segments.push(currentSegment.join(' '));
        }
        currentSegment = [];
      }
    });
    if (currentSegment.length > 1) {
      segments.push(currentSegment.join(' '));
    }

    return {
      xScale: xScaleFn,
      yScale: yScaleFn,
      xLabels: xLabelsData,
      yLabels: yLabelsData,
      lineSegments: segments,
      points: pts
    };
  }, [data, period]);

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
      if (d.avgMastery === null) {
        setTooltip(null);
        return;
      }
      const dateObj = new Date(`${d.date}T12:00:00Z`);
      let dateLabel = '';
        if (period === 'year') {
            dateLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        } else {
            dateLabel = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        }

      setTooltip({
        x: xScale(index),
        y: yScale(d.avgMastery),
        date: dateLabel,
        avgMastery: d.avgMastery,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };
  
  if (data.every(d => d.avgMastery === null)) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-bunker-500 dark:text-bunker-400">
        Nenhuma revisão no período para exibir o gráfico.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="w-full h-auto">
        {yLabels.map(label => (
          <g key={`y-grid-${label}`}>
            <line x1={padding.left} y1={yScale(label)} x2={width - padding.right} y2={yScale(label)} className="stroke-bunker-200 dark:stroke-bunker-800" strokeWidth="1" strokeDasharray="2,2" />
            <text x={padding.left - 8} y={yScale(label) + 3} textAnchor="end" className="text-xs fill-bunker-400">{label}%</text>
          </g>
        ))}
        {xLabels.map(({ x, label }) => (
          <text key={`label-x-${label}`} x={x} y={height - padding.bottom + 15} textAnchor="middle" className="text-xs fill-bunker-400">{label}</text>
        ))}

        {lineSegments.map((segment, i) => (
          <polyline key={i} points={segment} fill="none" className="stroke-sky-500" strokeWidth="2" />
        ))}

        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={tooltip?.x === p.x ? 5 : 3} className="transition-all fill-sky-500" />
        ))}

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
      </svg>
      
      {tooltip && (
          <div className="absolute p-2 text-xs text-white bg-bunker-900/80 dark:bg-bunker-950/80 rounded-md shadow-lg pointer-events-none"
             style={{ left: tooltip.x, top: tooltip.y - 10, transform: 'translate(-50%, -100%)' }}
          >
              <p className="font-bold mb-1">{tooltip.date}</p>
              <p>Domínio Médio: {tooltip.avgMastery.toFixed(0)}%</p>
          </div>
      )}
    </div>
  );
};

export default AverageMasteryEvolutionChart;
