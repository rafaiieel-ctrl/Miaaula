
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Question, Attempt } from '../types';
import * as srs from '../services/srsService';
import { useSettings } from '../contexts/SettingsContext';
import { 
    XMarkIcon, CheckCircleIcon, XCircleIcon, 
    ArrowRightIcon, ExclamationTriangleIcon, 
    TrendingUpIcon 
} from './icons';
import { getText } from '../utils/i18nText';

interface ReviewHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  onContinue?: () => void;
  masteryBefore?: number;
}

const Sparkline: React.FC<{ 
    data: number[]; 
    color: string;
    width?: number;
    height?: number;
}> = ({ data, color, width = 300, height = 50 }) => {
    const padding = 5;
    const innerW = width - (padding * 2);
    const innerH = height - (padding * 2);
    
    if (data.length < 2) {
        return <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center h-full">Dados Insuficientes</div>;
    }

    const minVal = 0;
    const maxVal = 100;
    const range = 100;

    const points = data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * innerW;
        const y = padding + innerH - ((val - minVal) / range) * innerH;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className="drop-shadow-sm"
            />
            {data.map((val, i) => {
                const x = padding + (i / (data.length - 1)) * innerW;
                const y = padding + innerH - ((val - minVal) / range) * innerH;
                return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
            })}
        </svg>
    );
};

const ReviewHistoryModal: React.FC<ReviewHistoryModalProps> = ({ isOpen, onClose, question, onContinue, masteryBefore }) => {
    const { settings } = useSettings();
    const [viewMode, setViewMode] = useState<'domain' | 'mastery'>('mastery');

    if (!isOpen || !question) return null;
    
    const history = question.attemptHistory || [];
    const lastAttempt = history[history.length - 1];
    
    const longTermM = Number((question.masteryScore || 0).toFixed(1));
    const currentDomain = Number((srs.calculateCurrentDomain(question, settings)).toFixed(1));

    const decayData = useMemo(() => {
        const points = [];
        const S = Math.max(0.5, question.stability || 1);
        const M = question.masteryScore || 0;
        const nextReviewDate = new Date(question.nextReviewDate);
        const now = new Date();
        const intervalDays = Math.max(1, (nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        for (let i = 0; i <= 10; i++) {
            const t = (i / 10) * intervalDays;
            const r = Math.exp(-t / S);
            const d = (M * 0.7) + (r * 100 * 0.3);
            points.push(d);
        }
        return points;
    }, [question.stability, question.masteryScore, question.nextReviewDate]);

    const masteryTrend = useMemo(() => {
        const historyData = question.masteryHistory || [];
        if (historyData.length > 0) return historyData.map(h => h.mastery);
        return history.slice(-10).map(a => a.masteryAfter);
    }, [question.masteryHistory, history]);
    
    const errorDiagnosis = useMemo(() => {
        if (lastAttempt?.wasCorrect) return null;
        const markedOption = question.yourAnswer || '';
        if (!markedOption) return null;

        if (question.wrongDiagnosisMap && question.wrongDiagnosisMap[markedOption]) {
            const rawDiag = getText(question.wrongDiagnosisMap[markedOption]);
            const parts = rawDiag.split('|');
            return {
                code: parts.length > 1 ? parts[0].trim() : 'ERRO',
                message: parts.length > 1 ? parts.slice(1).join('|').trim() : parts[0].trim()
            };
        }
        return question.wrongDiagnosis ? { code: 'GERAL', message: getText(question.wrongDiagnosis) } : null;
    }, [question, lastAttempt]);

    const timeClass = useMemo(() => {
        if (!lastAttempt || !lastAttempt.timeSec) return null;
        const t = lastAttempt.timeSec;
        if (t <= 7) return { label: 'Rápido', color: 'text-emerald-400' };
        if (t <= 25) return { label: 'Normal', color: 'text-sky-400' };
        return { label: 'Lento', color: 'text-amber-400' };
    }, [lastAttempt]);

    const handleAction = () => {
        if (onContinue) onContinue();
        else onClose();
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-[#0f172a] w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col border border-white/5 overflow-hidden max-h-[95dvh]" onClick={(e) => e.stopPropagation()}>
                
                <header className="px-8 pt-8 pb-4 flex justify-between items-start shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">RELATÓRIO TÉCNICO</h2>
                        <p className="text-white font-black mt-1 text-2xl truncate tracking-tight">{question.questionRef}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-6 custom-scrollbar">
                    {/* Feedback Header Card */}
                    <div className={`p-8 rounded-[2rem] text-center border-2 ${lastAttempt?.wasCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                        <div className="flex justify-center mb-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${lastAttempt?.wasCorrect ? 'border-emerald-500/30 text-emerald-500' : 'border-rose-500/30 text-rose-500'}`}>
                                {lastAttempt?.wasCorrect ? <CheckCircleIcon className="w-10 h-10" /> : <XCircleIcon className="w-10 h-10" />}
                            </div>
                        </div>
                        <h3 className={`text-5xl font-black ${lastAttempt?.wasCorrect ? 'text-emerald-400' : 'text-rose-400'} italic tracking-tight`}>
                            {lastAttempt?.wasCorrect ? 'Acertou!' : 'Errou!'}
                        </h3>
                        {timeClass && (
                            <p className="text-[11px] font-bold mt-4 uppercase tracking-[0.2em] text-slate-500">
                                Tempo: <span className="text-white">{lastAttempt?.timeSec}s</span> (<span className={timeClass.color}>{timeClass.label}</span>)
                            </p>
                        )}
                    </div>

                    {!lastAttempt?.wasCorrect && errorDiagnosis && (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-[2rem] space-y-2">
                            <div className="flex items-center gap-2 text-rose-400 border-b border-rose-500/10 pb-2 mb-3">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest">Diagnóstico de Erro</h4>
                            </div>
                            <p className="text-sm text-slate-200 font-bold leading-relaxed italic">
                                {errorDiagnosis.message}
                            </p>
                        </div>
                    )}
                    
                    {/* Retention and Mastery Cards */}
                    <div className="grid grid-cols-2 gap-4">
                         <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-400 mb-2 leading-tight">RETENÇÃO<br/>(AGORA)</p>
                            <span className="text-4xl font-black text-white leading-none">{currentDomain.toFixed(1)}%</span>
                            <div className="w-full h-2 bg-white/5 rounded-full mt-5 overflow-hidden">
                                <div className="h-full bg-sky-500 transition-all duration-1000" style={{ width: `${currentDomain}%` }}></div>
                            </div>
                         </div>
                         <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2 leading-tight">MAESTRIA<br/>(LONGO PRAZO)</p>
                            <span className="text-4xl font-black text-white leading-none">{longTermM.toFixed(1)}%</span>
                            <div className="w-full h-2 bg-white/5 rounded-full mt-5 overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${longTermM}%` }}></div>
                            </div>
                         </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex justify-center">
                        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                            <button 
                                onClick={() => setViewMode('domain')}
                                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'domain' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Domínio
                            </button>
                            <button 
                                onClick={() => setViewMode('mastery')}
                                className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'mastery' ? 'bg-[#6366f1] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Maestria
                            </button>
                        </div>
                    </div>

                    {/* Evolution Graph Section */}
                    <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div className="flex items-center gap-2">
                                <TrendingUpIcon className={`w-4 h-4 ${viewMode === 'domain' ? 'text-sky-500' : 'text-indigo-400'}`} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                                    EVOLUÇÃO {viewMode === 'domain' ? 'DOMÍNIO' : 'MAESTRIA'}
                                </span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Histórico</span>
                        </div>
                        <div className="flex justify-center items-center h-20 w-full pt-2">
                            <Sparkline 
                                data={viewMode === 'domain' ? decayData : masteryTrend} 
                                color={viewMode === 'domain' ? "#0ea5e9" : "#818cf8"} 
                                width={320}
                                height={60}
                            />
                        </div>
                    </div>
                </div>

                <footer className="p-8 pt-4 border-t border-white/5 shrink-0 bg-[#0f172a] z-20">
                    <button 
                        onClick={handleAction}
                        className="w-full bg-[#0EA5E9] hover:bg-sky-400 text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 text-lg uppercase tracking-tight"
                    >
                        Próxima Questão <ArrowRightIcon className="w-6 h-6" />
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default ReviewHistoryModal;
