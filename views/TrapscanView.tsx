
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import { useLiteralnessState } from '../contexts/LiteralnessContext';
import { useSettings } from '../contexts/SettingsContext';
import { analyzeTrapscan, TrapType, TRAP_REQ_DEFS } from '../services/trapscanService';
import * as srs from '../services/srsService';
import { RadarIcon, TargetIcon, BoltIcon, ExclamationTriangleIcon, ChartBarIcon, MapIcon, ChevronRightIcon, FilterIcon, CheckCircleIcon, ClockIcon, PlayIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, FireIcon, LightBulbIcon, TrashIcon, SearchIcon } from '../components/icons';
import StudySessionModal from '../components/StudySessionModal';
import { Question, NucleusStats, TrapSignal, TrapscanPlan, TrapscanGuide, VulnerabilityStats } from '../types';
import InfoTooltip from '../components/InfoTooltip';
import { filterExecutableItems } from '../services/contentGate';
import { attemptService } from '../services/attemptService';

// --- Types ---
type RadarScope = 'GLOBAL' | 'DISCIPLINE' | 'NUCLEUS';

// --- SUB-COMPONENTS ---

const KpiCard: React.FC<{ label: string; value: number | null; sub?: string; color?: string; tooltip?: string; icon?: React.ReactNode }> = ({ label, value, sub, color, tooltip, icon }) => {
    const displayValue = value !== null ? `${value.toFixed(0)}%` : '—';
    const finalTooltip = value === null ? (tooltip ? `${tooltip} (Sem dados suficientes)` : 'Amostra < 5 tentativas') : tooltip;
    
    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center shadow-sm hover:bg-white/5 transition-colors relative group">
            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                 {icon}
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                 {finalTooltip && <InfoTooltip text={finalTooltip} />}
            </div>
            <span className={`text-2xl font-black ${value !== null ? (color || 'text-white') : 'text-slate-600'}`}>{displayValue}</span>
            {sub && <span className="text-[9px] font-bold text-slate-600 mt-1">{sub}</span>}
        </div>
    );
};

const PlanCard: React.FC<{ plan: TrapscanPlan; onStart: () => void }> = ({ plan, onStart }) => {
    return (
        <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border-l-4 border-indigo-500 rounded-r-2xl p-6 shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <FireIcon className="w-16 h-16 text-indigo-400" />
             </div>
             
             <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                     <div>
                         <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 uppercase tracking-widest mb-2 inline-block">
                             PLANO RECOMENDADO
                         </span>
                         <h3 className="text-xl font-black text-white italic tracking-tight uppercase">
                             FOCO: {plan.label} ({plan.axis})
                         </h3>
                     </div>
                 </div>
                 
                 <p className="text-sm text-slate-300 mb-4 font-medium max-w-lg">
                     {plan.cause}
                 </p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                     <div className="space-y-2">
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">ESTRATÉGIA</span>
                         <ul className="text-xs text-slate-400 space-y-1">
                             {plan.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="text-indigo-500">•</span> {s}</li>)}
                         </ul>
                     </div>
                     <div className="space-y-2">
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">METAS</span>
                         <div className="flex gap-4">
                             <div><span className="block text-white font-bold">{plan.targetCount}</span><span className="text-[9px] text-slate-500">Questões</span></div>
                             <div><span className="block text-white font-bold">{plan.objective.split(' ').pop()}</span><span className="text-[9px] text-slate-500">Score Alvo</span></div>
                         </div>
                     </div>
                 </div>
                 
                 <button 
                    onClick={onStart}
                    className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                     <PlayIcon className="w-4 h-4 fill-current" /> INICIAR PLANO ({plan.estimatedTime})
                 </button>
             </div>
        </div>
    );
};

const EvidencePanel: React.FC<{ 
    signal: TrapSignal; 
    questions: Question[]; 
    onClose: () => void;
    onTrainQuestion: (q: Question) => void;
}> = ({ signal, questions, onClose, onTrainQuestion }) => {
    return (
        <div className="absolute top-0 right-0 z-50 w-full md:w-96 h-full bg-slate-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl p-6 flex flex-col animate-slide-left">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">EVIDÊNCIAS: {signal.code}</h4>
                    <p className="text-[10px] text-slate-500 font-bold">{signal.label}</p>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-slate-400"><XMarkIcon className="w-5 h-5"/></button>
            </div>
            
            <div className="bg-slate-800/50 p-3 rounded-xl mb-4 border border-white/5">
                 <div className="grid grid-cols-2 gap-2 text-center">
                     <div>
                         <span className="block text-xs font-bold text-white">{signal.riskScore}</span>
                         <span className="text-[8px] text-slate-500 uppercase">Score Risco</span>
                     </div>
                     <div>
                         <span className="block text-xs font-bold text-white">{signal.totalAttempts}</span>
                         <span className="text-[8px] text-slate-500 uppercase">Amostra</span>
                     </div>
                 </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {questions.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs">Nenhum erro recente registrado para este eixo.</div>
                ) : (
                    questions.map((q, i) => (
                        <div key={q.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                             <div className="flex justify-between items-start mb-2">
                                 <span className="text-[9px] font-black text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded uppercase">{q.questionRef}</span>
                                 <button onClick={() => onTrainQuestion(q)} className="text-slate-400 hover:text-white"><PlayIcon className="w-3 h-3"/></button>
                             </div>
                             <p className="text-xs text-slate-300 line-clamp-3 mb-3 italic">"{q.questionText}"</p>
                             <div className="pt-2 border-t border-white/5">
                                 <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Motivo do Erro (Tech):</p>
                                 <p className="text-[10px] text-rose-300 font-mono line-clamp-4 leading-relaxed">
                                     {q.explanationTech || q.explanation || "Sem explicação técnica."}
                                 </p>
                             </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10">
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                    <p className="text-[10px] font-black text-amber-500 uppercase mb-1">Dica de Correção</p>
                    <p className="text-xs text-slate-300">{signal.advice}</p>
                </div>
            </div>
        </div>
    );
};

const RadarChart: React.FC<{ 
    signals: TrapSignal[]; 
    onHoverAxis: (signal: TrapSignal | null, x: number, y: number) => void;
    onClickAxis: (signal: TrapSignal) => void;
    selectedCode: string | null;
    showComparison: boolean;
}> = ({ signals, onHoverAxis, onClickAxis, selectedCode, showComparison }) => {
    const size = 300;
    const center = size / 2;
    const radius = 100;
    
    const chartSignals = signals.filter(s => s.code !== 'SEM_DADO' as any);
    const angleStep = (Math.PI * 2) / chartSignals.length;
    
    // Calculate coordinates
    const points = useMemo(() => chartSignals.map((sig, i) => {
        const angle = i * angleStep - Math.PI / 2;
        // Invert score: 0 risk = 100 performance (outer edge), 100 risk = 0 performance (center)
        const performance = Math.max(0, 100 - sig.riskScore);
        const prevPerformance = Math.max(0, 100 - (sig.riskScore - sig.riskTrend)); // Approx previous

        const r = radius * (performance / 100);
        const rPrev = radius * (prevPerformance / 100);
        
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        
        const xPrev = center + Math.cos(angle) * rPrev;
        const yPrev = center + Math.sin(angle) * rPrev;

        const labelR = radius + 25;
        const labelX = center + Math.cos(angle) * labelR;
        const labelY = center + Math.sin(angle) * labelR;

        return { x, y, xPrev, yPrev, signal: sig, labelX, labelY, angle };
    }), [chartSignals]);

    // Build Paths
    const pathCurrent = points.map(p => `${p.x},${p.y}`).join(' ');
    const pathPrev = points.map(p => `${p.xPrev},${p.yPrev}`).join(' ');

    // Interaction
    const activePointRef = useRef<{ code: string } | null>(null);

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
         const rect = e.currentTarget.getBoundingClientRect();
         const mouseX = e.clientX - rect.left;
         const mouseY = e.clientY - rect.top;
         
         // Find nearest point
         let nearest = null;
         let minDist = 30; // Hit radius

         points.forEach(p => {
             const dist = Math.hypot(p.x - mouseX, p.y - mouseY);
             if (dist < minDist) {
                 minDist = dist;
                 nearest = p;
             }
         });

         if (nearest) {
             onHoverAxis(nearest.signal, rect.left + nearest.x, rect.top + nearest.y);
             activePointRef.current = { code: nearest.signal.code };
         } else {
             onHoverAxis(null, 0, 0);
             activePointRef.current = null;
         }
    };

    return (
        <div className="relative flex justify-center py-6">
            <svg 
                width={size} height={size} 
                viewBox={`0 0 ${size} ${size}`} 
                className="overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => onHoverAxis(null, 0, 0)}
            >
                {/* Background Grid */}
                {[0.2, 0.4, 0.6, 0.8, 1].map(r => (
                    <circle key={r} cx={center} cy={center} r={radius * r} fill="none" stroke="#334155" strokeWidth="1" opacity="0.3" strokeDasharray="4 4" />
                ))}
                {points.map((p, i) => (
                    <line key={i} x1={center} y1={center} x2={p.labelX} y2={p.labelY} stroke="#334155" strokeWidth="1" opacity="0.2" />
                ))}

                {/* Previous Period (Overlay) */}
                {showComparison && (
                    <polygon points={pathPrev} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
                )}

                {/* Current Period */}
                <polygon points={pathCurrent} fill="rgba(14, 165, 233, 0.2)" stroke="#0ea5e9" strokeWidth="2" />
                
                {/* Points & Labels */}
                {points.map((p, i) => {
                    const isSelected = selectedCode === p.signal.code;
                    const isWorst = p.signal.riskScore > 60; // High risk
                    
                    return (
                        <g key={i} onClick={(e) => { e.stopPropagation(); onClickAxis(p.signal); }} className="cursor-pointer group">
                             {/* Label */}
                             <text x={p.labelX} y={p.labelY} textAnchor="middle" dominantBaseline="middle" fill={isSelected ? '#fff' : '#94a3b8'} fontSize="10" fontWeight="900" className="transition-all group-hover:fill-white">{p.signal.code}</text>
                             
                             {/* Dot */}
                             <circle 
                                cx={p.x} cy={p.y} r={isSelected ? 6 : 4} 
                                fill={isWorst ? '#f43f5e' : '#0ea5e9'} 
                                stroke={isSelected ? '#fff' : 'none'} 
                                strokeWidth="2"
                                className="transition-all duration-300"
                             />
                             {/* Interaction Hit Area */}
                             <circle cx={p.x} cy={p.y} r="20" fill="transparent" />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// --- NEW V3.1 COMPONENTS ---

const DiagnosisSummary: React.FC<{ situation: string; cause: string; impact: string }> = ({ situation, cause, impact }) => (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
        <h4 className="text-sm font-black text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <SearchIcon className="w-4 h-4"/> Diagnóstico Atual (Auto)
        </h4>
        <div className="space-y-3 text-sm text-slate-300">
            <p><strong className="text-white block text-xs uppercase tracking-wide opacity-70 mb-1">Situação:</strong> {situation}</p>
            <p><strong className="text-white block text-xs uppercase tracking-wide opacity-70 mb-1">Causa Provável:</strong> {cause}</p>
            <p><strong className="text-white block text-xs uppercase tracking-wide opacity-70 mb-1">Impacto na Prova:</strong> {impact}</p>
        </div>
    </div>
);

const TechnicalReport: React.FC<{ 
    vulnerabilities: VulnerabilityStats[]; 
    failureType: 'OPERATIONAL' | 'CONCEPTUAL';
    dataConsistency: number;
}> = ({ vulnerabilities, failureType, dataConsistency }) => {
    return (
        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Relatório Técnico Trapscan</h4>
            
            {/* Top 3 Vulnerabilities */}
            <div className="space-y-6 mb-8">
                {vulnerabilities.map((vul, idx) => (
                    <div key={vul.code} className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">#{idx + 1} VULNERABILIDADE</span>
                            <span className="text-xs font-black text-white">Score {vul.riskScore}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                             <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center font-black text-white text-lg">{vul.code}</div>
                             <div>
                                 <p className="text-sm font-bold text-white">{vul.label}</p>
                                 <p className="text-[10px] text-slate-500">{(vul.errorRate * 100).toFixed(0)}% de erro • Amostra: {vul.sampleSize}</p>
                             </div>
                        </div>

                        {/* Real Error Sample */}
                        {vul.realError && (
                            <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-3 text-xs space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-rose-300">Você fez: <strong className="text-white">P2={vul.realError.userChoice.p2}</strong></span>
                                    <span className="text-emerald-400">Era: <strong>P2={vul.realError.correctChoice.p2}</strong></span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Âncora</span>
                                    <span className="font-mono text-slate-300 bg-black/30 px-1 rounded">{vul.realError.anchor}</span>
                                </div>
                                <p className="text-slate-400 italic">"{vul.realError.why}"</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Analysis Footer */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Falha Dominante</span>
                    <p className={`text-sm font-bold ${failureType === 'OPERATIONAL' ? 'text-amber-400' : 'text-purple-400'}`}>
                        {failureType === 'OPERATIONAL' ? 'Operacional (Técnica)' : 'Conceitual (Conteúdo)'}
                    </p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Consistência de Dados</span>
                    {dataConsistency < 50 ? (
                        <p className="text-sm font-bold text-rose-500 flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-3 h-3" /> Baixa ({dataConsistency.toFixed(0)}%)
                        </p>
                    ) : (
                        <p className="text-sm font-bold text-emerald-500">Alta ({dataConsistency.toFixed(0)}%)</p>
                    )}
                </div>
            </div>
            
            {dataConsistency < 50 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">
                        <strong>Alerta:</strong> Dados insuficientes. Ative o TRAPSCAN Assist antes de iniciar a sessão para capturar P1/P2.
                    </p>
                </div>
            )}
        </div>
    );
};

const DevelopmentGuide: React.FC<{ 
    guides: Record<string, TrapscanGuide>;
    vulnerabilities: VulnerabilityStats[];
}> = ({ guides, vulnerabilities }) => {
    const [openItem, setOpenItem] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Guia de Desenvolvimento (Top 3)</h4>
            
            {vulnerabilities.map(vul => {
                const guide = guides[vul.code];
                if (!guide) return null;
                const isOpen = openItem === vul.code;

                return (
                    <div key={vul.code} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden transition-all">
                        <button 
                            onClick={() => setOpenItem(isOpen ? null : vul.code)}
                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white">{vul.code}</span>
                                <div>
                                    <span className="block text-sm font-bold text-white">{guide.kpi}</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Como dominar {vul.label}</span>
                                </div>
                            </div>
                            <div className={`transition-transform duration-300 text-slate-500 ${isOpen ? 'rotate-180' : ''}`}>
                                <ChevronDownIcon className="w-5 h-5" />
                            </div>
                        </button>

                        {isOpen && (
                            <div className="p-4 border-t border-white/5 space-y-6 bg-black/20 animate-fade-in">
                                <div>
                                    <h5 className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1">(A) Conceito</h5>
                                    <p className="text-sm text-slate-300 leading-relaxed">{guide.concept}</p>
                                </div>
                                <div>
                                    <h5 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">(B) Seu Padrão de Erro</h5>
                                    <p className="text-sm text-slate-300 leading-relaxed bg-rose-500/10 p-2 rounded border border-rose-500/20">{guide.pattern}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">(C) Gatilhos</h5>
                                        <div className="flex flex-wrap gap-1">
                                            {guide.triggers.map(t => <span key={t} className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-[10px] rounded border border-amber-500/20">{t}</span>)}
                                        </div>
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">(D) Método (20-40s)</h5>
                                        <ul className="text-[10px] text-emerald-300 space-y-1">
                                            {guide.method.map((m, i) => <li key={i}>• {m}</li>)}
                                        </ul>
                                    </div>
                                </div>
                                <div>
                                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">(E) Treino Recomendado</h5>
                                    <div className="space-y-2">
                                        {guide.training.map((t, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-indigo-200 bg-indigo-500/10 p-2 rounded">
                                                <span className="font-bold">{t.split(':')[0]}:</span>
                                                <span>{t.split(':')[1]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// --- MAIN VIEW ---

const TrapscanView: React.FC = () => {
    const rawQuestions = useQuestionState();
    const cards = useLiteralnessState();
    const { settings } = useSettings();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // Core State
    const [period, setPeriod] = useState<7 | 30 | 90>(30);
    const [scope, setScope] = useState<RadarScope>('DISCIPLINE');
    const [selectedKey, setSelectedKey] = useState<string>(''); // Holds ID of Discipline or Nucleus
    const [selectedSignal, setSelectedSignal] = useState<TrapSignal | null>(null);
    const [showComparison, setShowComparison] = useState(false);

    // Apply Gate: Only consider active questions
    const questions = useMemo(() => filterExecutableItems(rawQuestions), [rawQuestions, refreshTrigger]);

    // Live Update Hook
    useEffect(() => {
        const unsubscribe = attemptService.subscribe(() => {
             setRefreshTrigger(prev => prev + 1);
        });
        return unsubscribe;
    }, []);
    
    // Derived Options
    const availableDisciplines = useMemo(() => {
        const counts: Record<string, number> = {};
        questions.forEach(q => {
            const subj = q.subject || 'Geral';
            counts[subj] = (counts[subj] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a,b) => b[1] - a[1]) // Sort by volume
            .map(([name, count]) => ({ id: name, label: `${name} (${count})` }));
    }, [questions]);

    // Initial Selection
    useEffect(() => {
        if (scope === 'DISCIPLINE' && !selectedKey && availableDisciplines.length > 0) {
            setSelectedKey(availableDisciplines[0].id);
        }
    }, [scope, selectedKey, availableDisciplines]);

    // --- DATA ANALYSIS ---
    const filteredData = useMemo(() => {
        let qs = questions;
        let cs = cards;

        if (scope === 'DISCIPLINE' && selectedKey) {
            qs = questions.filter(q => q.subject === selectedKey);
            cs = cards.filter(c => c.lawId === selectedKey);
        } 
        return { qs, cs };
    }, [questions, cards, scope, selectedKey]);

    const report = useMemo(() => {
        return analyzeTrapscan(filteredData.qs, filteredData.cs, settings, period);
    }, [filteredData, settings, period]);

    // --- SESSION HANDLER ---
    const [activeSession, setActiveSession] = useState<{ title: string; questions: Question[] } | null>(null);
    const [tooltip, setTooltip] = useState<{ signal: TrapSignal, x: number, y: number } | null>(null);

    const handleStartPlan = () => {
        if (!report.recommendedPlan) return;
        const plan = report.recommendedPlan;
        
        let pool = filteredData.qs.filter(q => {
             // Logic based on Plan Axis
             if (plan.axis === 'T') return q.questionType?.includes('Literalidade') || q.questionText.includes('apenas');
             if (plan.axis === 'R') return q.questionText.includes('Exceto') || q.questionText.includes('Salvo');
             if (plan.axis === 'N') return q.questionText.includes('INCORRETA');
             // Fallback to random if complex
             return true;
        });
        
        // Ensure pool size
        if (pool.length < 10) pool = filteredData.qs;

        const sessionQ = pool.sort(() => Math.random() - 0.5).slice(0, plan.targetCount);
        setActiveSession({ title: `Plano: ${plan.label}`, questions: sessionQ });
    };
    
    const handleTrainNucleus = (nuc: NucleusStats) => {
        const pool = filteredData.qs.filter(q => srs.canonicalizeLitRef(q.lawRef) === nuc.litRef);
        if (pool.length === 0) return alert("Sem questões para este núcleo.");
        setActiveSession({ title: `Treino: ${nuc.topic}`, questions: pool.slice(0, 15) });
    };

    return (
        <div className="w-full text-slate-100 pb-20 animate-fade-in space-y-8 relative overflow-hidden">
            {tooltip && (
                <div className="fixed z-50 pointer-events-none bg-slate-900 border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-2 w-64 animate-fade-in" style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -120%)' }}>
                    <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                        <span className="text-sm font-black text-white uppercase tracking-tight">{tooltip.signal.label} ({tooltip.signal.code})</span>
                        <div className="text-right">
                             <span className="text-[10px] text-slate-400 block">Score</span>
                             <span className="font-bold text-white">{100 - tooltip.signal.riskScore}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                        <div>Amostra: {tooltip.signal.totalAttempts}</div>
                        <div>Tendência: <span className={tooltip.signal.riskTrend > 0 ? 'text-rose-400' : 'text-emerald-400'}>{tooltip.signal.riskTrend > 0 ? 'Piorando' : 'Melhorando'}</span></div>
                    </div>
                    {tooltip.signal.confidence < 50 && <p className="text-[9px] text-amber-500 italic mt-1">Baixa confiabilidade (poucos dados).</p>}
                </div>
            )}

            <header className="p-6 border border-white/5 bg-slate-900/40 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-500"><RadarIcon className="w-8 h-8" /></div>
                    <div>
                        <div className="flex items-center gap-2"><h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Radar TRAPSCAN</h1></div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Diagnóstico & Planos</p>
                    </div>
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-4 bg-black/20 p-2 rounded-xl">
                    <div className="flex bg-slate-800 rounded-lg p-1">
                         <button onClick={() => setScope('GLOBAL')} className={`px-3 py-1 text-[10px] font-bold rounded uppercase ${scope === 'GLOBAL' ? 'bg-white text-black' : 'text-slate-500'}`}>Global</button>
                         <button onClick={() => setScope('DISCIPLINE')} className={`px-3 py-1 text-[10px] font-bold rounded uppercase ${scope === 'DISCIPLINE' ? 'bg-white text-black' : 'text-slate-500'}`}>Disciplina</button>
                    </div>
                    
                    {scope === 'DISCIPLINE' && (
                        <select 
                            value={selectedKey} 
                            onChange={e => setSelectedKey(e.target.value)}
                            className="bg-slate-900 text-white text-xs font-bold p-1.5 rounded border border-white/10 outline-none max-w-[150px]"
                        >
                            {availableDisciplines.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                    )}
                </div>
            </header>
            
            {/* Period Selector */}
            <div className="flex justify-center gap-2">
                 {[7, 30, 90].map(d => (
                     <button
                        key={d}
                        onClick={() => setPeriod(d as any)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${period === d ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white/5 text-slate-500 border-white/5'}`}
                     >
                         {d} Dias
                     </button>
                 ))}
            </div>

            {/* Deep KPIs Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                <KpiCard label="ACURÁCIA GERAL" value={report.kpis.accuracyQuestions} icon={<CheckCircleIcon className="w-4 h-4"/>} color={(report.kpis.accuracyQuestions ?? 0) > 80 ? 'text-emerald-400' : 'text-white'} />
                <KpiCard label="DIAGNÓSTICO (P2)" value={report.kpis.p2Accuracy} icon={<RadarIcon className="w-4 h-4"/>} tooltip="Acerto na identificação do tipo de armadilha" />
                <KpiCard label="COMANDO (P1)" value={report.kpis.p1Accuracy} icon={<BoltIcon className="w-4 h-4"/>} tooltip="Acerto na identificação do comando (Correta/Incorreta)" />
                <KpiCard label="ELIMINAÇÃO (P4)" value={report.kpis.eliminationRate} icon={<TrashIcon className="w-4 h-4"/>} tooltip="Taxa de uso do recurso de corte de alternativas" />
            </div>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
                {/* Evidence Panel */}
                {selectedSignal && (
                    <EvidencePanel 
                        signal={selectedSignal}
                        questions={report.evidence[selectedSignal.code] || []}
                        onClose={() => setSelectedSignal(null)}
                        onTrainQuestion={(q) => setActiveSession({ title: `Treino: ${q.questionRef}`, questions: [q] })}
                    />
                )}

                {/* Radar Section */}
                <section className="lg:col-span-1 bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 flex flex-col items-center relative">
                    <div className="w-full flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Performance por Eixo</h3>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Comparar</span>
                            <input type="checkbox" checked={showComparison} onChange={e => setShowComparison(e.target.checked)} className="toggle" />
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${showComparison ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showComparison ? 'left-4.5' : 'left-0.5'}`}></div>
                            </div>
                        </label>
                    </div>

                    <RadarChart 
                        signals={report.signals}
                        onHoverAxis={(s, x, y) => setTooltip(s ? { signal: s, x, y } : null)}
                        onClickAxis={setSelectedSignal}
                        selectedCode={selectedSignal?.code || null}
                        showComparison={showComparison}
                    />
                    
                    {report.kpis.riskSubject !== '—' && (
                        <div className="mt-4 text-center">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Maior Risco Atual</p>
                            <p className="text-sm font-black text-rose-400 uppercase">{report.kpis.riskSubject}</p>
                        </div>
                    )}
                </section>

                {/* Plan & Critical Nuclei Section */}
                <section className="lg:col-span-2 space-y-6">
                    {/* Action Plan */}
                    {report.recommendedPlan ? (
                        <PlanCard plan={report.recommendedPlan} onStart={handleStartPlan} />
                    ) : (
                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-6 rounded-2xl text-center">
                            <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                            <h3 className="text-lg font-black text-white uppercase">Sem Pontos Fracos Críticos</h3>
                            <p className="text-sm text-slate-400">Seu desempenho está equilibrado nos eixos cognitivos.</p>
                        </div>
                    )}
                    
                    {/* NEW SECTION 3.1: Diagnosis Summary */}
                    <DiagnosisSummary {...report.diagnostic} />
                    
                    {/* NEW SECTION 3.1: Technical Report */}
                    <TechnicalReport 
                        vulnerabilities={report.vulnerabilities}
                        failureType={report.kpis.failureDominance}
                        dataConsistency={report.kpis.dataConsistency}
                    />
                    
                    {/* NEW SECTION 3.1: Development Guide */}
                    <DevelopmentGuide 
                        guides={report.guides}
                        vulnerabilities={report.vulnerabilities}
                    />

                    {/* Critical Nuclei List */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Núcleos Críticos</h3>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Top Vulnerabilidades</span>
                        </div>
                        
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                             {report.weakestNuclei.slice(0, 10).map(nuc => (
                                 <div key={nuc.litRef} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors group">
                                     <div className="min-w-0 pr-4">
                                         <div className="flex items-center gap-2 mb-0.5">
                                             <span className="text-xs font-bold text-white truncate">{nuc.topic}</span>
                                             <span className="text-[8px] font-mono text-rose-400 bg-rose-500/10 px-1.5 rounded">{nuc.topSignal}</span>
                                         </div>
                                         <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">
                                             {nuc.errorCount} Erros • Risco {nuc.riskScore}
                                         </div>
                                     </div>
                                     
                                     <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                            onClick={() => handleTrainNucleus(nuc)}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm"
                                         >
                                             Treinar
                                         </button>
                                     </div>
                                 </div>
                             ))}
                             {report.weakestNuclei.length === 0 && (
                                 <p className="text-center text-slate-500 text-xs py-4">Nenhum núcleo crítico identificado.</p>
                             )}
                        </div>
                    </div>
                </section>
            </main>

            {/* Study Session Integration */}
            {activeSession && (
                <StudySessionModal 
                    isOpen={true} 
                    questions={activeSession.questions} 
                    title={activeSession.title} 
                    onClose={() => setActiveSession(null)} 
                    context="session"
                />
            )}
        </div>
    );
};

export default TrapscanView;