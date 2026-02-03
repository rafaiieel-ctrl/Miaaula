
import React, { useState, useMemo } from 'react';
import { Question, Flashcard, BattleHistoryEntry, PairMatchHistoryEntry } from '../types';

interface StudyTimeChartProps {
    questions: Question[];
    flashcards: Flashcard[];
    battleHistory?: BattleHistoryEntry[];
    pairMatchHistory?: PairMatchHistoryEntry[];
}

type ViewMode = 'day' | 'week' | 'subject' | 'pareto';

interface ChartDataPoint {
    label: string;
    value: number; // in minutes
    fullDate?: string;
    cumulativePct?: number; // 0-100 for Pareto
    percentageOfTotal?: number;
}

const StudyTimeChart: React.FC<StudyTimeChartProps> = ({ questions, flashcards, battleHistory = [], pairMatchHistory = [] }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [tooltip, setTooltip] = useState<{ x: number, y: number, data: ChartDataPoint } | null>(null);

    const chartData = useMemo(() => {
        // 1. Build a unified list of effort entries
        const entries: { date: Date; minutes: number; subject: string }[] = [];

        // Question Map for efficient subject lookup by ID (for battle/history)
        const qMap = new Map<string, string>();
        questions.forEach(q => qMap.set(q.questionRef, q.subject));

        // Questions
        questions.forEach(q => {
            q.attemptHistory.forEach(a => {
                if (a.timeSec) {
                    entries.push({
                        date: new Date(a.date),
                        minutes: a.timeSec / 60,
                        subject: q.subject
                    });
                }
            });
        });

        // Flashcards
        flashcards.forEach(fc => {
            fc.attemptHistory.forEach(a => {
                if (a.timeSec) {
                    entries.push({
                        date: new Date(a.date),
                        minutes: a.timeSec / 60,
                        subject: fc.discipline
                    });
                }
            });
        });

        // Battle
        battleHistory.forEach(b => {
            if (b.timeSec) {
                const subject = qMap.get(b.questionRef) || 'Batalha / Geral';
                entries.push({
                    date: new Date(b.date),
                    minutes: b.timeSec / 60,
                    subject
                });
            }
        });

        // Pair Match
        pairMatchHistory.forEach(p => {
            if (p.totalTimeSec) {
                entries.push({
                    date: new Date(p.date),
                    minutes: p.totalTimeSec / 60,
                    subject: p.topicTitle // Usually Discipline in Pair Match context
                });
            }
        });

        // 2. Aggregate based on View Mode
        const groupedMap = new Map<string, number>();
        const now = new Date();
        const cutoffDate = new Date();
        
        if (viewMode === 'day') {
            cutoffDate.setDate(now.getDate() - 14); // Last 14 days
        } else if (viewMode === 'week') {
            cutoffDate.setDate(now.getDate() - 90); // Last ~3 months
        } else {
            // For subject and pareto, we look at all time or last year to get meaningful distribution
            cutoffDate.setFullYear(now.getFullYear() - 1); 
        }

        // Filter old entries first
        const recentEntries = entries.filter(e => e.date >= cutoffDate);

        recentEntries.forEach(e => {
            let key = '';
            if (viewMode === 'day') {
                key = e.date.toISOString().split('T')[0];
            } else if (viewMode === 'week') {
                // Get start of week (Sunday)
                const d = new Date(e.date);
                const day = d.getDay();
                const diff = d.getDate() - day;
                const weekStart = new Date(d.setDate(diff));
                key = weekStart.toISOString().split('T')[0];
            } else {
                key = e.subject;
            }

            groupedMap.set(key, (groupedMap.get(key) || 0) + e.minutes);
        });

        // 3. Format for Chart
        let data: ChartDataPoint[] = [];
        
        if (viewMode === 'day') {
            for (let i = 0; i < 14; i++) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const key = d.toISOString().split('T')[0];
                data.push({
                    label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    value: groupedMap.get(key) || 0,
                    fullDate: key
                });
            }
            data.reverse();
        } else if (viewMode === 'week') {
            data = Array.from(groupedMap.entries()).map(([dateStr, val]) => ({
                label: new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                value: val,
                fullDate: dateStr
            })).sort((a, b) => a.fullDate!.localeCompare(b.fullDate!));
        } else if (viewMode === 'subject') {
            data = Array.from(groupedMap.entries()).map(([subj, val]) => ({
                label: subj,
                value: val
            })).sort((a, b) => b.value - a.value).slice(0, 10);
        } else if (viewMode === 'pareto') {
            // Pareto Logic: Sort descending, calculate cumulative
            const allSubjects = Array.from(groupedMap.entries()).map(([subj, val]) => ({
                label: subj,
                value: val
            })).sort((a, b) => b.value - a.value);

            const totalTime = allSubjects.reduce((acc, curr) => acc + curr.value, 0);
            let accumulated = 0;

            data = allSubjects.map(item => {
                accumulated += item.value;
                return {
                    ...item,
                    cumulativePct: (accumulated / totalTime) * 100,
                    percentageOfTotal: (item.value / totalTime) * 100
                };
            }).slice(0, 12); // Limit to top 12 for readability
        }

        return data;
    }, [questions, flashcards, battleHistory, pairMatchHistory, viewMode]);

    // Chart Dimensions
    const width = 600;
    const height = 300;
    // Right padding increased for Pareto secondary axis
    const padding = { top: 30, right: viewMode === 'pareto' ? 50 : 20, bottom: 60, left: 50 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(1, ...chartData.map(d => d.value));
    
    // Scales
    const xScale = (index: number) => padding.left + (index / Math.max(1, chartData.length)) * innerWidth;
    const barWidth = (innerWidth / Math.max(1, chartData.length)) * (viewMode === 'pareto' ? 0.8 : 0.6);
    const yScale = (val: number) => padding.top + innerHeight - (val / maxValue) * innerHeight;

    // Pareto Secondary Axis (0 to 100%)
    const yScalePct = (pct: number) => padding.top + innerHeight - (pct / 100) * innerHeight;

    // For horizontal bar chart (Subject mode)
    const yScaleSubject = (index: number) => padding.top + (index / Math.max(1, chartData.length)) * innerHeight;
    const barHeightSubject = (innerHeight / Math.max(1, chartData.length)) * 0.7;
    const xScaleSubject = (val: number) => padding.left + (val / maxValue) * innerWidth;

    const formatTime = (minutes: number) => {
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    };

    const handleMouseMove = (e: React.MouseEvent<SVGElement>, d: ChartDataPoint, x: number, y: number) => {
        setTooltip({ x, y, data: d });
    };

    // Calculate Pareto Line Points
    const paretoPoints = viewMode === 'pareto' 
        ? chartData.map((d, i) => `${xScale(i) + barWidth/2},${yScalePct(d.cumulativePct || 0)}`).join(' ')
        : '';

    return (
        <div className="bg-white dark:bg-bunker-900 rounded-2xl border border-bunker-100 dark:border-bunker-800 shadow-sm p-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Tempo de Estudo</h3>
                    <p className="text-xs text-bunker-500 dark:text-bunker-400">
                        {viewMode === 'pareto' ? 'Análise 80/20: Onde seu tempo está concentrado.' : 'Total acumulado de todas as atividades.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-1 bg-bunker-100 dark:bg-bunker-800 p-1 rounded-lg">
                    {(['day', 'week', 'subject', 'pareto'] as ViewMode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => setViewMode(m)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all capitalize ${
                                viewMode === m 
                                ? 'bg-white dark:bg-bunker-700 text-sky-600 dark:text-sky-400 shadow-sm' 
                                : 'text-bunker-500 hover:text-bunker-700 dark:text-bunker-400 dark:hover:text-bunker-200'
                            }`}
                        >
                            {m === 'day' ? 'Dia' : m === 'week' ? 'Semana' : m === 'subject' ? 'Disciplina' : 'Pareto'}
                        </button>
                    ))}
                </div>
            </div>

            {chartData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-sm text-bunker-400">
                    Sem dados de estudo registrados para este período.
                </div>
            ) : (
                <div className="relative w-full overflow-hidden">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" onMouseLeave={() => setTooltip(null)}>
                        {viewMode === 'subject' ? (
                            // Horizontal Bars for Subjects
                            <>
                                {chartData.map((d, i) => (
                                    <g key={i} onMouseMove={(e) => handleMouseMove(e, d, xScaleSubject(d.value), yScaleSubject(i))}>
                                        <rect 
                                            x={padding.left} 
                                            y={yScaleSubject(i)} 
                                            width={xScaleSubject(d.value) - padding.left} 
                                            height={barHeightSubject} 
                                            rx={4}
                                            className="fill-sky-500 dark:fill-sky-600 transition-all hover:opacity-80 cursor-pointer" 
                                        />
                                        <text 
                                            x={padding.left + 5} 
                                            y={yScaleSubject(i) + barHeightSubject / 2 + 4} 
                                            className="text-[10px] fill-white font-bold pointer-events-none"
                                        >
                                            {formatTime(d.value)}
                                        </text>
                                        <text 
                                            x={padding.left - 5} 
                                            y={yScaleSubject(i) + barHeightSubject / 2 + 4} 
                                            textAnchor="end"
                                            className="text-[10px] fill-bunker-500 dark:fill-bunker-400 font-medium"
                                        >
                                            {d.label.substring(0, 15)}{d.label.length>15?'...':''}
                                        </text>
                                    </g>
                                ))}
                                {/* Axis Line */}
                                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="stroke-bunker-200 dark:stroke-bunker-700" strokeWidth={1} />
                            </>
                        ) : (
                            // Vertical Bars (Day, Week, Pareto)
                            <>
                                {/* Grid Lines (Left Axis - Time) */}
                                {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                                    const y = yScale(maxValue * pct);
                                    return (
                                        <g key={`grid-${pct}`}>
                                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="stroke-bunker-100 dark:stroke-bunker-800" strokeWidth={1} strokeDasharray="4,4" />
                                            <text x={padding.left - 5} y={y + 3} textAnchor="end" className="text-[9px] fill-bunker-400">{formatTime(maxValue * pct)}</text>
                                        </g>
                                    );
                                })}

                                {/* Right Axis (Percentage for Pareto) */}
                                {viewMode === 'pareto' && [0, 25, 50, 75, 100].map(pct => {
                                    const y = yScalePct(pct);
                                    return (
                                        <text key={`pct-${pct}`} x={width - padding.right + 5} y={y + 3} textAnchor="start" className="text-[9px] fill-amber-500 font-bold">{pct}%</text>
                                    );
                                })}

                                {chartData.map((d, i) => {
                                    const x = xScale(i);
                                    const h = innerHeight - (yScale(d.value) - padding.top);
                                    const barCenterX = x + (innerWidth/chartData.length - barWidth)/2 + barWidth/2;
                                    
                                    return (
                                        <g key={i} onMouseMove={(e) => handleMouseMove(e, d, barCenterX, yScale(d.value))}>
                                            <rect 
                                                x={x + (innerWidth/chartData.length - barWidth)/2} 
                                                y={yScale(d.value)} 
                                                width={barWidth} 
                                                height={h} 
                                                rx={4}
                                                className={`transition-all hover:opacity-80 cursor-pointer ${viewMode === 'pareto' ? 'fill-sky-500/80 dark:fill-sky-600/80' : 'fill-emerald-500 dark:fill-emerald-600'}`} 
                                            />
                                            {/* X Axis Labels */}
                                            <text 
                                                x={x + (innerWidth/chartData.length)/2} 
                                                y={height - padding.bottom + 15} 
                                                textAnchor={viewMode === 'pareto' ? "end" : "middle"}
                                                transform={viewMode === 'pareto' ? `rotate(-45 ${x + (innerWidth/chartData.length)/2}, ${height - padding.bottom + 15})` : undefined}
                                                className="text-[9px] fill-bunker-500 dark:fill-bunker-400"
                                            >
                                                {d.label.substring(0, 12)}{d.label.length>12?'...':''}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* Pareto Cumulative Line */}
                                {viewMode === 'pareto' && (
                                    <>
                                        <polyline 
                                            points={paretoPoints} 
                                            fill="none" 
                                            className="stroke-amber-500 stroke-2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        {chartData.map((d, i) => (
                                            <circle 
                                                key={`pt-${i}`}
                                                cx={xScale(i) + (innerWidth/chartData.length)/2}
                                                cy={yScalePct(d.cumulativePct || 0)}
                                                r={3}
                                                className="fill-white stroke-amber-500 stroke-2"
                                            />
                                        ))}
                                        {/* 80% Threshold Line */}
                                        <line 
                                            x1={padding.left} 
                                            y1={yScalePct(80)} 
                                            x2={width - padding.right} 
                                            y2={yScalePct(80)} 
                                            className="stroke-amber-500/50 stroke-1 stroke-dasharray-2" 
                                        />
                                        <text x={padding.left + 5} y={yScalePct(80) - 5} className="text-[9px] fill-amber-500 font-bold">80%</text>
                                    </>
                                )}
                            </>
                        )}
                    </svg>

                    {/* Tooltip */}
                    {tooltip && (
                        <div 
                            className="absolute pointer-events-none bg-slate-800 dark:bg-bunker-950 text-white text-xs p-3 rounded-lg shadow-xl z-20 whitespace-nowrap border border-slate-700"
                            style={{ 
                                left: viewMode === 'subject' ? '50%' : `${(tooltip.x / width) * 100}%`,
                                top: `${(tooltip.y / height) * 100}%`,
                                transform: 'translate(-50%, -120%)'
                            }}
                        >
                            <p className="font-bold text-sky-300 mb-1">{tooltip.data.label}</p>
                            <p className="text-lg font-bold">{formatTime(tooltip.data.value)}</p>
                            {viewMode === 'pareto' && tooltip.data.cumulativePct && (
                                <div className="mt-2 pt-2 border-t border-slate-600">
                                    <p>Acumulado: <span className="text-amber-400 font-bold">{tooltip.data.cumulativePct.toFixed(1)}%</span></p>
                                    <p className="text-[10px] text-slate-400">Representa {tooltip.data.percentageOfTotal?.toFixed(1)}% do total</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudyTimeChart;
