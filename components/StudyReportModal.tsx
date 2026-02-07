
import React, { useState, useMemo } from 'react';
import { SessionResult, Question } from '../types';
import { 
    CheckCircleIcon, XCircleIcon, ClockIcon, ChartBarIcon, 
    ArrowRightIcon, TrendingUpIcon, ExclamationTriangleIcon, 
    CalendarIcon, ChevronDownIcon, ChevronRightIcon, ListBulletIcon 
} from './icons';

interface StudyReportModalProps {
    result: SessionResult;
    questions?: Question[];
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

const DetailItem: React.FC<{ q: Question }> = ({ q }) => {
    const isCorrect = q.lastWasCorrect;
    return (
        <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {isCorrect ? 'Acerto' : 'Erro'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{q.questionRef}</span>
                </div>
                {isCorrect ? <CheckCircleIcon className="w-4 h-4 text-emerald-500"/> : <XCircleIcon className="w-4 h-4 text-rose-500"/>}
            </div>
            
            <p className="text-xs text-slate-300 line-clamp-2 font-medium">{q.questionText}</p>
            
            <div className="flex gap-4 text-[10px] uppercase font-bold pt-2 border-t border-white/5">
                {!isCorrect && q.yourAnswer && (
                    <span className="text-rose-400">Você: {q.yourAnswer}</span>
                )}
                <span className="text-emerald-400">Gabarito: {q.correctAnswer}</span>
            </div>
        </div>
    );
};

const StudyReportModal: React.FC<StudyReportModalProps> = ({ result, questions = [], onClose }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [detailFilter, setDetailFilter] = useState<'ALL' | 'ERRORS' | 'CORRECT'>('ALL');

    const accuracyColor = result.accuracy >= 80 ? 'text-emerald-400' : result.accuracy >= 60 ? 'text-sky-400' : 'text-rose-400';
    const accuracyBg = result.accuracy >= 80 ? 'from-emerald-500/20 to-emerald-900/5' : result.accuracy >= 60 ? 'from-sky-500/20 to-sky-900/5' : 'from-rose-500/20 to-rose-900/5';
    const accuracyBorder = result.accuracy >= 80 ? 'border-emerald-500/30' : result.accuracy >= 60 ? 'border-sky-500/30' : 'border-rose-500/30';

    const formattedDate = new Date(result.endedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    const filteredQuestions = useMemo(() => {
        if (detailFilter === 'ERRORS') return questions.filter(q => !q.lastWasCorrect);
        if (detailFilter === 'CORRECT') return questions.filter(q => q.lastWasCorrect);
        return questions;
    }, [questions, detailFilter]);

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
                    
                    {/* DETAILS SECTION (NEW) */}
                    {questions.length > 0 && (
                        <div className="w-full">
                            <button 
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                                        <ListBulletIcon className="w-5 h-5"/>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm font-bold text-white group-hover:text-sky-400 transition-colors">Detalhamento da Sessão</span>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Ver lista de respostas</span>
                                    </div>
                                </div>
                                <div className={`text-slate-500 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}>
                                    <ChevronDownIcon className="w-5 h-5" />
                                </div>
                            </button>
                            
                            {showDetails && (
                                <div className="mt-4 animate-fade-in space-y-4">
                                    {/* Filters */}
                                    <div className="flex p-1 bg-black/20 rounded-xl border border-white/5">
                                        <button onClick={() => setDetailFilter('ALL')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${detailFilter === 'ALL' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Todos</button>
                                        <button onClick={() => setDetailFilter('ERRORS')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${detailFilter === 'ERRORS' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500 hover:text-slate-300'}`}>Erros</button>
                                        <button onClick={() => setDetailFilter('CORRECT')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${detailFilter === 'CORRECT' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>Acertos</button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {filteredQuestions.length === 0 ? (
                                            <div className="text-center py-6 text-slate-500 text-xs italic">Nenhum item neste filtro.</div>
                                        ) : (
                                            filteredQuestions.map((q, idx) => (
                                                <DetailItem key={`${q.id}_${idx}`} q={q} />
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
