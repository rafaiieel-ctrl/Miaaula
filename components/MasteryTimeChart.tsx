import React, { useState, useMemo } from 'react';
import { Question } from '../types';

interface ChartDataPoint {
  x: number; // timestamp
  y: number; // mastery score
  question: Question;
}

interface MasteryTimeChartProps {
  data: ChartDataPoint[];
}

interface TooltipData {
  x: number; // screen x
  y: number; // screen y
  data: ChartDataPoint;
}

const MasteryTimeChart: React.FC<MasteryTimeChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const width = 500;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };

  const { xScale, yScale, xLabels } = useMemo(() => {
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const xVals = data.map(d => d.x);
    const minDate = xVals.length > 0 ? Math.min(...xVals) : new Date().getTime();
    const maxDate = xVals.length > 0 ? Math.max(...xVals) : new Date().getTime();
    
    const xDom = [minDate, maxDate];
    const yDom = [0, 100];

    const xScaleFn = (value: number) => {
      if (xDom[1] === xDom[0]) return padding.left + innerWidth / 2;
      return padding.left + ((value - xDom[0]) / (xDom[1] - xDom[0])) * innerWidth;
    }
    const yScaleFn = (value: number) => padding.top + innerHeight - ((value - yDom[0]) / (yDom[1] - yDom[0])) * innerHeight;
    
    const numXLabels = 5;
    const xLabelData = [];
    if (xDom[1] > xDom[0]) {
        const interval = (xDom[1] - xDom[0]) / (numXLabels - 1);
        for (let i = 0; i < numXLabels; i++) {
            const dateVal = xDom[0] + (i * interval);
            xLabelData.push(new Date(dateVal));
        }
    } else if (data.length > 0) {
        xLabelData.push(new Date(xDom[0]));
    }
    
    return {
      xScale: xScaleFn,
      yScale: yScaleFn,
      xLabels: xLabelData.map(d => ({
          x: xScaleFn(d.getTime()),
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      }))
    };
  }, [data]);
  
  if (!data || data.length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-sm text-slate-500">
        Dados insuficientes para o gráfico.
      </div>
    );
  }

  return (
    <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Y-Axis labels and grid */}
            {[0, 25, 50, 75, 100].map(label => (
                <g key={label}>
                    <line x1={padding.left} y1={yScale(label)} x2={width - padding.right} y2={yScale(label)} className="stroke-bunker-200 dark:stroke-bunker-800" strokeWidth="0.5" strokeDasharray="2,2" />
                    <text x={padding.left - 8} y={yScale(label) + 4} textAnchor="end" className="text-[10px] fill-bunker-400">{label}%</text>
                </g>
            ))}
            {/* X-Axis labels */}
            {xLabels.map(({ x, label }) => (
                <text key={label} x={x} y={height - padding.bottom + 15} textAnchor="middle" className="text-[10px] fill-bunker-400">{label}</text>
            ))}
            <text x={width / 2} y={height-5} textAnchor="middle" className="text-xs font-semibold fill-bunker-500 dark:fill-bunker-400">Data da Tentativa</text>


            {/* Data Points */}
            {data.map((point, i) => (
                <circle
                    key={i}
                    cx={xScale(point.x)}
                    cy={yScale(point.y)}
                    r="3"
                    className="fill-sky-400 opacity-70"
                />
            ))}
        </svg>
    </div>
  );
};

export default MasteryTimeChart;