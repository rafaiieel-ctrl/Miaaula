
import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import { ChevronLeftIcon, ChartBarIcon, FilterIcon, XMarkIcon } from './icons';

interface ErrorParetoChartProps {
  questions: Question[];
  onBarClick?: (subject: string) => void;
}

interface ChartDataPoint {
  label: string;
  count: number;
  cumulativePct: number;
  percentageOfTotal: number;
}

const ErrorParetoChart: React.FC<ErrorParetoChartProps> = ({ questions, onBarClick }) => {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: ChartDataPoint; align: 'left' | 'center' | 'right' } | null>(null);

  // Get list of subjects that have errors for the dropdown
  const availableSubjects = useMemo(() => {
      const subs = new Set<string>();
      questions.forEach(q => {
          if (q.totalAttempts > 0 && !q.lastWasCorrect) {
              subs.add(q.subject);
          }
      });
      return Array.from(subs).sort();
  }, [questions]);

  const chartData = useMemo(() => {
    // 1. Filter only incorrect attempts
    const incorrectQuestions = questions.filter(q => q.totalAttempts > 0 && !q.lastWasCorrect);

    if (incorrectQuestions.length === 0) return [];

    // 2. Group Data
    const groups: Record<string, number> = {};
    
    incorrectQuestions.forEach(q => {
        // If viewing specific subject, group by TOPIC, otherwise group by SUBJECT
        if (selectedSubject) {
            if (q.subject === selectedSubject) {
                const key = q.topic || 'Geral';
                groups[key] = (groups[key] || 0) + 1;
            }
        } else {
            const key = q.subject || 'Outros';
            groups[key] = (groups[key] || 0) + 1;
        }
    });

    // 3. Sort Descending
    const sortedEntries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    const totalErrors = sortedEntries.reduce((acc, curr) => acc + curr[1], 0);

    // 4. Calculate Cumulative
    let accumulated = 0;
    const data: ChartDataPoint[] = sortedEntries.slice(0, 15).map(([label, count]) => {
        accumulated += count;
        return {
            label,
            count,
            percentageOfTotal: (count / totalErrors) * 100,
            cumulativePct: (accumulated / totalErrors) * 100
        };
    });

    return data;
  }, [questions, selectedSubject]);

  // Chart Dimensions
  const width = 600;
  const height = 320;
  const padding = { top: 40, right: 40, bottom: 80, left: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  if (chartData.length === 0) {
      return (
          <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-bunker-200 dark:border-bunker-800 rounded-xl bg-bunker-50 dark:bg-bunker-900/30">
              <div className="w-12 h-12 bg-bunker-100 dark:bg-bunker-800 rounded-full flex items-center justify-center mb-3">
                <ChartBarIcon className="w-6 h-6 text-bunker-400" />
              </div>
              <p className="text-bunker-500 dark:text-bunker-400 font-medium">Nenhum erro registrado {selectedSubject ? `em ${selectedSubject}` : ''} para análise.</p>
              {selectedSubject && (
                  <button onClick={() => setSelectedSubject(null)} className="mt-4 text-sky-500 text-sm hover:underline">Voltar para Visão Geral</button>
              )}
          </div>
      );
  }

  const maxCount = Math.max(...chartData.map(d => d.count));
  
  // Scales
  const xScale = (index: number) => padding.left + (index / chartData.length) * innerWidth;
  const yScaleCount = (val: number) => padding.top + innerHeight - (val / maxCount) * innerHeight;
  const yScalePct = (val: number) => padding.top + innerHeight - (val / 100) * innerHeight;
  const barWidth = (innerWidth / chartData.length) * 0.7;

  // Pareto Line Points
  const linePoints = chartData.map((d, i) => 
      `${xScale(i) + barWidth / 2 + (innerWidth / chartData.length - barWidth) / 2},${yScalePct(d.cumulativePct)}`
  ).join(' ');

  const handleMouseMove = (data: ChartDataPoint, x: number, y: number) => {
      // Smart tooltip positioning
      let align: 'left' | 'center' | 'right' = 'center';
      if (x < width * 0.3) align = 'left';
      else if (x > width * 0.7) align = 'right';
      
      setTooltip({ x, y, data, align });
  };

  const handleBarClick = (label: string) => {
      if (onBarClick) {
          onBarClick(label);
      } else if (!selectedSubject) {
          setSelectedSubject(label);
      }
  };

  return (
    <div className="relative w-full">
        {/* Controls */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
            <div className="flex items-center gap-2">
                {selectedSubject ? (
                    <button 
                        onClick={() => setSelectedSubject(null)} 
                        className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-sky-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <ChevronLeftIcon className="w-4 h-4" /> Voltar
                    </button>
                ) : (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                        <ChartBarIcon className="w-4 h-4" />
                        <span>Visão Geral</span>
                    </div>
                )}
            </div>

            <div className="relative group">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Filtrar Disciplina:</span>
                    <select 
                        value={selectedSubject || ''} 
                        onChange={(e) => setSelectedSubject(e.target.value || null)}
                        className="bg-white dark:bg-bunker-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2 pr-8 outline-none shadow-sm cursor-pointer hover:border-sky-400 transition-colors"
                    >
                        <option value="">Todas (Geral)</option>
                        {availableSubjects.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>

        {/* Chart */}
        <div className="w-full overflow-hidden" onMouseLeave={() => setTooltip(null)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#e11d48" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="barGradientBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
                    </linearGradient>
                </defs>

                {/* Grid Lines (Pct) */}
                {[0, 20, 40, 60, 80, 100].map(pct => (
                    <g key={pct}>
                        <line 
                            x1={padding.left} y1={yScalePct(pct)} 
                            x2={width - padding.right} y2={yScalePct(pct)} 
                            className="stroke-bunker-100 dark:stroke-bunker-800" strokeWidth="1" strokeDasharray="4,4" 
                        />
                        {/* Right Axis Labels */}
                        <text x={width - padding.right + 5} y={yScalePct(pct) + 3} className="text-[9px] fill-amber-500 font-bold" textAnchor="start">{pct}%</text>
                    </g>
                ))}

                {/* Left Axis Labels (Count) */}
                <text x={15} y={height / 2} className="text-[10px] fill-bunker-400 font-bold" transform={`rotate(-90 15, ${height/2})`} textAnchor="middle">ERROS</text>

                {/* Bars */}
                {chartData.map((d, i) => {
                    const barHeight = innerHeight - (yScaleCount(d.count) - padding.top);
                    const x = xScale(i) + (innerWidth / chartData.length - barWidth) / 2;
                    const isImportant = d.cumulativePct <= 80;

                    return (
                        <g 
                            key={i} 
                            className="group cursor-pointer"
                            onClick={() => handleBarClick(d.label)}
                            onMouseMove={() => handleMouseMove(d, x + barWidth/2, yScaleCount(d.count))}
                        >
                            <rect
                                x={x}
                                y={yScaleCount(d.count)}
                                width={barWidth}
                                height={barHeight}
                                rx={4}
                                fill={isImportant ? "url(#barGradient)" : "url(#barGradientBlue)"}
                                className={`transition-all duration-300 opacity-90 hover:opacity-100 ${!selectedSubject ? 'hover:stroke-2 hover:stroke-white/20' : ''}`}
                            />
                            {/* X Labels */}
                            <text 
                                x={x + barWidth / 2 + 5} 
                                y={height - padding.bottom + 15} 
                                textAnchor="end"
                                transform={`rotate(-45 ${x + barWidth / 2}, ${height - padding.bottom + 15})`}
                                className={`text-[10px] font-medium ${d.label === selectedSubject ? 'fill-sky-500 font-bold' : 'fill-bunker-500 dark:fill-bunker-400'}`}
                            >
                                {d.label.length > 18 ? d.label.substring(0, 16) + '...' : d.label}
                            </text>
                        </g>
                    );
                })}

                {/* Pareto Line */}
                <polyline 
                    points={linePoints} 
                    fill="none" 
                    className="stroke-amber-400 stroke-[2px] drop-shadow-md pointer-events-none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {chartData.map((d, i) => (
                    <circle 
                        key={`dot-${i}`}
                        cx={xScale(i) + (innerWidth/chartData.length)/2}
                        cy={yScalePct(d.cumulativePct)}
                        r={4}
                        className="fill-bunker-900 stroke-amber-400 stroke-2 pointer-events-none"
                    />
                ))}
                
                {/* 80% Threshold Line */}
                <line 
                    x1={padding.left} y1={yScalePct(80)} 
                    x2={width - padding.right} y2={yScalePct(80)} 
                    className="stroke-amber-500/80 stroke-[1px] stroke-dasharray-6" 
                />
                <text x={padding.left + 5} y={yScalePct(80) - 5} className="text-[10px] fill-amber-500 font-bold">Corte 80%</text>
            </svg>
        </div>

        {/* Improved Tooltip */}
        {tooltip && (
            <div 
                className="absolute pointer-events-none z-50 filter drop-shadow-xl"
                style={{ 
                    left: `${(tooltip.x / width) * 100}%`,
                    top: `${(tooltip.y / height) * 100}%`,
                    transform: `translate(${tooltip.align === 'left' ? '5%' : tooltip.align === 'right' ? '-105%' : '-50%'}, -120%)`
                }}
            >
                <div className="bg-slate-800/95 dark:bg-bunker-950/95 backdrop-blur text-white text-xs p-3 rounded-xl border border-slate-700 w-48">
                    <p className="font-bold text-sm mb-1 leading-tight text-white">{tooltip.data.label}</p>
                    
                    <div className="flex justify-between items-center my-1.5">
                        <span className="text-rose-400 font-bold text-lg">{tooltip.data.count} <span className="text-xs font-normal text-rose-300/80">Erros</span></span>
                        <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{(tooltip.data.percentageOfTotal).toFixed(1)}% do total</span>
                    </div>
                    
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
                        <div className="bg-amber-500 h-full" style={{ width: `${tooltip.data.cumulativePct}%` }}></div>
                    </div>
                    <p className="text-[10px] text-amber-400 text-right font-medium">Acumulado: {tooltip.data.cumulativePct.toFixed(1)}%</p>
                    
                    {!selectedSubject && (
                        <p className="mt-2 text-[10px] text-center text-slate-400 border-t border-slate-700 pt-1">
                            Clique para recuperar
                        </p>
                    )}
                </div>
                {/* Tooltip Triangle */}
                <div 
                    className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800/95 absolute left-1/2 -translate-x-1/2 bottom-[-6px]"
                    style={{ 
                         left: tooltip.align === 'left' ? '10px' : tooltip.align === 'right' ? 'calc(100% - 10px)' : '50%',
                         transform: 'translateX(-50%)'
                    }}
                ></div>
            </div>
        )}
    </div>
  );
};

export default ErrorParetoChart;
