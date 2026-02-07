
import React from 'react';
import { SessionResult } from '../types';
import { CheckCircleIcon, XCircleIcon, ClockIcon, ChartBarIcon, ArrowRightIcon, TrendingUpIcon, ExclamationTriangleIcon, CalendarIcon } from './icons';

interface StudyReportModalProps {
    result: SessionResult;
    onClose: () => void;
}

const StatBox: React.FC<{ label: string; value: string | number; colorClass: string; icon?: React.ReactNode }> = ({ label, value, colorClass, icon }) => (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900/50 border border-white/5 rounded-2xl relative overflow-hidden group">
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${colorClass.replace('text-', 'bg-')}`}></div>
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 z-10">{label}</span>
        <div className="flex items-center gap-2 z-10">
            {icon && <span className={`${colorClass} opacity-80`}>{icon}</span>}
            <span className={`text-2xl font-black ${colorClass}`}>{value}</span>
        </div>
    </div>
);

const StudyReportModal: React.FC<StudyReportModalProps> = ({ result, onClose }) => {
    const accuracyColor = result.accuracy >= 80 ? 'text-emerald-400' : result.accuracy >= 60 ? 'text-sky-400' : 'text-rose-400';
    const accuracyBg = result.accuracy >= 80 ? 'from-emerald-500/20 to-emerald-900/5' : result.accuracy >= 60 ? 'from-sky-500/20 to-sky-900/5' : 'from-rose-500/20 to-rose-900/5';
    const accuracyBorder = result.accuracy >= 80 ? 'border-emerald-500/30' : result.accuracy >= 60 ? 'border-sky-500/30' : 'border-rose-500/30';

    const formattedDate = new Date(result.endedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#020617]">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center animate-fade-in space-y-8 max-w-lg mx-auto p-6 pb-12">
                    
                    {/* NEW HEADER LAYOUT */}
                    <header className="text-center w-full mt-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-6 shadow-sm">
                            <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                            Sessão Finalizada
                        </div>
                        
                        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 tracking-tighter leading-tight mb-2 break-words">
                            {result.title}
                        </h1>
                        
                        <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
                            <CalendarIcon className="w-3 h-3" />
                            {formattedDate}
                        </div>
                    </header>

                    {/* Main Accuracy Card */}
                    <div className={`w-full p-8 rounded-[2.5rem] bg-gradient-to-br ${accuracyBg} border ${accuracyBorder} relative overflow-hidden shadow-2xl group`}>
                        <div className="absolute top-0 right-0 p-6 opacity-20 transform group-hover:scale-110 transition-transform duration-700">
                             <ChartBarIcon className="w-32 h-32 text-white" />
                        </div>
                        
                        <div className="relative z-10 flex flex-col items-center">
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-white/60 mb-2">Performance Global</span>
                            <span className={`text-6xl md:text-7xl font-black tracking-tighter ${accuracyColor} drop-shadow-lg`}>
                                {Math.round(result.accuracy)}%
                            </span>
                            <div className="flex gap-4 mt-4">
                                <span className="text-[10px] font-bold bg-black/20 px-3 py-1 rounded-lg text-white/80 border border-white/5">
                                    {result.correctCount} Acertos
                                </span>
                                <span className="text-[10px] font-bold bg-black/20 px-3 py-1 rounded-lg text-white/80 border border-white/5">
                                    {result.wrongCount} Erros
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Funnel Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <StatBox 
                            label="Total Respondido" 
                            value={result.answeredCount} 
                            colorClass="text-white" 
                        />
                        <StatBox 
                            label="Tempo Focado" 
                            value={`${Math.floor(result.totalTimeSec / 60)}m ${result.totalTimeSec % 60}s`} 
                            colorClass="text-amber-400"
                            icon={<ClockIcon className="w-4 h-4" />}
                        />
                    </div>

                    {/* Evolution Stats */}
                    <div className="w-full bg-slate-900/40 border border-white/5 rounded-3xl p-6">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <TrendingUpIcon className="w-4 h-4" /> Evolução SRS
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-bold text-slate-400">Ganho de Maestria</span>
                                    <span className="text-sm font-black text-emerald-400">+{result.masteryGain.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(5, result.masteryGain))}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-bold text-slate-400">Retenção (Domínio)</span>
                                    <span className="text-sm font-black text-sky-400">+{result.domainGain.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, Math.max(5, result.domainGain))}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!result.isCompleted && (
                        <div className="w-full p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-5 h-5 text-rose-500" />
                            <p className="text-[10px] text-rose-200 font-bold uppercase tracking-widest leading-snug">
                                Sessão Parcial. Apenas questões respondidas foram salvas.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-slate-900/80 backdrop-blur-xl shrink-0 z-20">
                <button 
                    onClick={onClose}
                    className="w-full max-w-md mx-auto bg-white hover:bg-slate-200 text-slate-950 font-black py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs"
                >
                    Concluir e Voltar <ArrowRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default StudyReportModal;
