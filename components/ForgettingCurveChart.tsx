
import React, { useState, useMemo } from 'react';
import { InfoIcon, ClockIcon } from './icons';

export interface SeriesData {
  name: 'Média' | 'P25' | 'P75';
  data: [number, number][]; // [day, value]
}

interface ForgettingCurveChartProps {
  series: SeriesData[];
  meta: {
      N: number;
  };
  goldContext?: {
      avgNextReviewDays: number;
      timingState: 'FAST' | 'OK' | 'SLOW';
  };
}

interface TooltipData {
  x: number;
  y: number;
  day: number;
  mean: number;
  p25: number;
  p75: number;
}

const TARGET_DOMAIN = 93;

const ForgettingCurveChart: React.FC<ForgettingCurveChartProps> = ({ series, meta, goldContext }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const width = 500;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  // Use a unique ID for the gradient to avoid conflicts if multiple charts exist
  const gradientId = useMemo(() => `fc-gradient-${Math.random().toString(36).substr(2, 9)}`, []);

  const { xScale, yScale, areaPath, linePath, meanSeries, p25Series, p75Series, goldPoint } = useMemo(() => {
    const mean = series.find(s => s.name === 'Média');
    const p25 = series.find(s => s.name === 'P25');
    const p75 = series.find(s => s.name === 'P75');

    if (!mean || !p25 || !p75 || mean.data.length === 0) {
        return { xScale: () => 0, yScale: () => 0, areaPath: '', linePath: '', meanSeries: null, p25Series: null, p75Series: null, goldPoint: null };
    }
    
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const allData = mean.data;
    const xDom = [0, allData.length > 1 ? allData[allData.length - 1][0] : 30];
    const yDom = [0, 100];

    const xScaleFn = (value: number) => padding.left + (value / xDom[1]) * innerWidth;
    const yScaleFn = (value: number) => padding.top + innerHeight - ((value - yDom[0]) / yDom[1]) * innerHeight;

    const linePoints = mean.data.map(([day, value]) => `${xScaleFn(day)},${yScaleFn(value)}`).join(' L ');
    const p25Points = p25.data.map(([day, value]) => `${xScaleFn(day)},${yScaleFn(value)}`).join(' L ');
    const p75PointsReversed = [...p75.data].reverse().map(([day, value]) => `${xScaleFn(day)},${yScaleFn(value)}`).join(' L ');
        
    const areaPathData = `M${p25Points} L ${p75PointsReversed} Z`;

    // Find Gold Point Intersection (Where Mean crosses 93%)
    let goldDay = 0;
    // Find index where value drops below TARGET
    const dropIndex = mean.data.findIndex(p => p[1] <= TARGET_DOMAIN);
    
    if (dropIndex === -1) {
        // Doesn't drop in current view (very strong memory)
        goldDay = mean.data[mean.data.length-1][0]; 
    } else if (dropIndex === 0) {
        // Already below target
        goldDay = 0;
    } else {
        // Interpolate between dropIndex-1 and dropIndex
        const p1 = mean.data[dropIndex-1];
        const p2 = mean.data[dropIndex];
        const ratio = (p1[1] - TARGET_DOMAIN) / (p1[1] - p2[1]);
        goldDay = p1[0] + ratio * (p2[0] - p1[0]);
    }
    
    const goldPoint = {
        day: goldDay,
        x: xScaleFn(goldDay),
        y: yScaleFn(TARGET_DOMAIN)
    };

    return {
      xScale: xScaleFn,
      yScale: yScaleFn,
      areaPath: areaPathData,
      linePath: `M${linePoints}`,
      meanSeries: mean,
      p25Series: p25,
      p75Series: p75,
      goldPoint
    };
  }, [series]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    const cursorPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    if (!meanSeries || meanSeries.data.length < 1) return;
    const dayRatio = (cursorPoint.x - padding.left) / (width - padding.left - padding.right);
    const dayIndex = Math.round(dayRatio * (meanSeries.data.length - 1));

    if (dayIndex >= 0 && dayIndex < meanSeries.data.length) {
      const meanDataPoint = meanSeries.data[dayIndex];
      const p25DataPoint = p25Series!.data[dayIndex];
      const p75DataPoint = p75Series!.data[dayIndex];
      setTooltip({
        x: xScale(meanDataPoint[0]),
        y: yScale(meanDataPoint[1]),
        day: meanDataPoint[0],
        mean: meanDataPoint[1],
        p25: p25DataPoint[1],
        p75: p75DataPoint[1],
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };
  
  const getGoldStatus = () => {
      if (!goldContext || !goldPoint) return 'UNKNOWN';
      const delta = goldContext.avgNextReviewDays - goldPoint.day;
      const tolerance = Math.max(0.5, goldPoint.day * 0.1); // 10% or half day

      if (Math.abs(delta) <= tolerance) return 'IDEAL';
      if (delta < -tolerance) return 'EARLY'; // Scheduled before optimum
      return 'LATE'; // Scheduled after optimum
  };

  const goldStatus = getGoldStatus();
  const statusColor = goldStatus === 'IDEAL' ? 'text-emerald-400' : goldStatus === 'EARLY' ? 'text-amber-400' : 'text-rose-400';
  const statusLabel = goldStatus === 'IDEAL' ? 'Ideal' : goldStatus === 'EARLY' ? 'Cedo' : 'Tarde';

  if (meta.N === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-bunker-500 dark:text-bunker-400">
        Nenhuma questão nos filtros selecionados para projetar a curva.
      </div>
    );
  }
  
  const yLabels = [0, 25, 50, 75, 100];
  const xLabels = meanSeries?.data.filter(([day]) => day % 5 === 0) || [];
  
  // Is user hovering near the Gold Point?
  const isHoveringGold = tooltip && goldPoint && Math.abs(tooltip.day - goldPoint.day) < 1;

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 p-1 flex items-center gap-1 text-xs text-bunker-500 dark:text-bunker-400 group z-10">
        <InfoIcon />
        <div className="absolute bottom-full mb-2 w-72 p-3 bg-slate-800 dark:bg-bunker-900 text-slate-100 font-normal rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-10 text-left whitespace-normal border border-slate-700">
            <h4 className="font-bold mb-1 text-sky-400">Modelo Exponencial</h4>
            <p className="mb-2">A curva usa o modelo de esquecimento exponencial. Após cada acerto, o domínio volta a 100% e decai com velocidade determinada pela sua Estabilidade (S).</p>
            <h4 className="font-bold mb-1 text-amber-400">Ponto Ouro (93%)</h4>
            <p>Indica o momento matematicamente ótimo para revisão. Revisar neste ponto maximiza a retenção com o mínimo esforço (Desirable Difficulty).</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="w-full h-auto">
        <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="0"/>
            </linearGradient>
        </defs>
        {/* Grid lines and labels */}
        {yLabels.map(label => (
          <g key={`y-grid-${label}`}>
            <line x1={padding.left} y1={yScale(label)} x2={width - padding.right} y2={yScale(label)} className="stroke-bunker-200 dark:stroke-bunker-800" strokeWidth="1" strokeDasharray="2,2" />
            <text x={padding.left - 8} y={yScale(label) + 4} textAnchor="end" className="text-xs fill-bunker-400">{label}%</text>
          </g>
        ))}
         {xLabels.map(([day]) => (
             <text key={`x-label-${day}`} x={xScale(day)} y={height - padding.bottom + 15} textAnchor="middle" className="text-xs fill-bunker-400">
                +{day}d
            </text>
         ))}

        {/* Gold Point Line */}
        {goldPoint && (
             <line 
                x1={padding.left} y1={goldPoint.y} 
                x2={width - padding.right} y2={goldPoint.y} 
                className="stroke-amber-500/50" 
                strokeWidth="1" 
                strokeDasharray="4,4" 
             />
        )}

        {/* Area and Line */}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" className="stroke-sky-400" strokeWidth="2" />

        {/* Gold Point Marker */}
        {goldPoint && (
            <g>
                <circle cx={goldPoint.x} cy={goldPoint.y} r="4" className="fill-amber-500 stroke-2 stroke-bunker-900 animate-pulse" />
                {/* Static Label if not hovering */}
                {!tooltip && (
                    <text x={goldPoint.x + 8} y={goldPoint.y - 8} className="text-[10px] fill-amber-500 font-bold" style={{textShadow: '0 1px 2px rgba(0,0,0,0.8)'}}>
                        93%
                    </text>
                )}
            </g>
        )}

        {/* Hover indicator */}
        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} className="stroke-bunker-400 dark:stroke-bunker-500" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={tooltip.x} cy={tooltip.y} r="4" className="fill-sky-300 stroke-2 stroke-bunker-900" />
          </g>
        )}
      </svg>
      
      {/* Tooltip */}
      {tooltip && (
          <div className="absolute p-3 text-xs text-white bg-bunker-900/95 dark:bg-bunker-950/95 border border-slate-700 rounded-xl shadow-xl pointer-events-none z-20 backdrop-blur-sm"
             style={{ left: tooltip.x, top: tooltip.y, transform: `translate(-50%, -115%)` }}
          >
              <div className="flex justify-between items-end gap-4 mb-1">
                  <span className="font-bold text-slate-300">Em +{tooltip.day} dias</span>
                  <span className="font-mono text-sky-400 font-bold text-sm">{tooltip.mean.toFixed(1)}%</span>
              </div>
              <div className="h-px bg-slate-700 my-1.5"></div>
              
              {isHoveringGold && goldPoint && goldContext ? (
                  <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wide text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          Zona Ouro (Alvo)
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                          <span>Revisar em:</span>
                          <span className="text-right text-slate-200 font-mono">
                              {(goldPoint.day * 24).toFixed(0)}h <span className="opacity-50">({goldPoint.day.toFixed(1)}d)</span>
                          </span>
                          
                          <span>Status:</span>
                          <span className={`text-right font-bold ${statusColor}`}>{statusLabel}</span>
                          
                          <span>Tempo:</span>
                          <span className={`text-right font-bold ${goldContext.timingState === 'FAST' ? 'text-amber-400' : goldContext.timingState === 'SLOW' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {goldContext.timingState === 'FAST' ? 'Rápido' : goldContext.timingState === 'SLOW' ? 'Lento' : 'Ok'}
                          </span>
                      </div>
                  </div>
              ) : (
                  <p className="text-slate-400">Faixa (P25-P75): <span className="text-slate-200">{tooltip.p25.toFixed(1)}% - {tooltip.p75.toFixed(1)}%</span></p>
              )}
          </div>
      )}
    </div>
  );
};

export default ForgettingCurveChart;
