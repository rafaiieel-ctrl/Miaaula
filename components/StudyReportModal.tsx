
import React from 'react';
import { SessionResult } from '../types';
import { CheckCircleIcon, XCircleIcon, ClockIcon, ChartBarIcon, ArrowRightIcon, TrendingUpIcon, ExclamationTriangleIcon } from './icons';

interface StudyReportModalProps {
    result: SessionResult;
    onClose: () => void;
}

const StudyReportModal: React.FC<StudyReportModalProps> = ({ result, onClose }) => {
    const accuracyColor = result.accuracy >= 80 ? 'text-emerald-500' : result.accuracy >= 60 ? 'text-sky-500' : 'text-rose-500';
    
    return (
        <div className="flex flex-col items-center animate-fade-in py-6 space-y-8">
            <header className="text-center space-y-2">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-xl">
                    <CheckCircleIcon className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Sessão Finalizada</h2>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{result.title}</p>
            </header>

            {/* Funnel Stats */}
            <div className="grid grid-cols-3 gap-3 w-full">
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center">
                    <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Questões</span>
                    <span className="text-2xl font-black text-white">{result.answeredCount}</span>
                </div>
                <div className="bg-emerald-500/5 p-4 rounded-3xl border border-emerald-500/10 text-center">
                    <span className="block text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Acertos</span>
                    <span className="text-2xl font-black text-emerald-500">{result.correctCount}</span>
                </div>
                <div className="bg-rose-500/5 p-4 rounded-3xl border border-rose-500/10 text-center">
                    <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Erros</span>
                    <span className="text-2xl font-black text-rose-500">{result.wrongCount}</span>
                </div>
            </div>

            {/* Mastery & Domain Gain Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/10 p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-sky-500/20 rounded-xl text-sky-400">
                            <TrendingUpIcon className="w-5 h-5" />
                        </div>
                        <span className={`text-2xl font-black ${accuracyColor}`}>{Math.round(result.accuracy)}%</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Acurácia Global</p>
                    <h3 className="text-white font-bold text-lg leading-tight mt-1">Eficiência de Resposta</h3>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                            <ChartBarIcon className="w-5 h-5" />
                        </div>
                        <span className="text-2xl font-black text-emerald-500">+{result.masteryGain.toFixed(1)}%</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Evolução SRS</p>
                    <h3 className="text-white font-bold text-lg leading-tight mt-1">Ganho de Maestria</h3>
                </div>
            </div>

            {/* Time & Summary */}
            <div className="w-full bg-white/5 border border-white/5 rounded-[2rem] p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl text-slate-500">
                        <ClockIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tempo Focado</p>
                        <p className="text-xl font-black text-white">{Math.floor(result.totalTimeSec / 60)}m {result.totalTimeSec % 60}s</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ritmo Médio</p>
                    <p className="text-xl font-black text-sky-400">{Math.round(result.totalTimeSec / (result.answeredCount || 1))}s/q</p>
                </div>
            </div>

            {!result.isCompleted && (
                <div className="w-full p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest leading-snug">Sessão Interrompida: Dados salvos parcialmente.</p>
                </div>
            )}

            <button 
                onClick={onClose}
                className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs"
            >
                Concluir e Voltar <ArrowRightIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

export default StudyReportModal;
