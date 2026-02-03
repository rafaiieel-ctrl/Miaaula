
import React, { useMemo, useEffect, useState } from 'react';
import { LiteralnessCard, Question, Flashcard } from '../../types';
import { ExclamationTriangleIcon, BoltIcon, XMarkIcon, CheckCircleIcon, BrainIcon, MapIcon, PuzzlePieceIcon, ClipboardDocumentCheckIcon, ChartBarIcon, ClockIcon } from '../icons';
import { useQuestionState } from '../../contexts/QuestionContext';
import { useFlashcardState } from '../../contexts/FlashcardContext';
import * as srs from '../../services/srsService';
import * as engine from '../../services/activityEngine';
import { useSettings } from '../../contexts/SettingsContext';

type DiagnosticItem = LiteralnessCard | Question | Flashcard;

interface LiteralnessDiagnosticProps {
    items: DiagnosticItem[];
    onRetry?: (items: any[]) => void;
    onStartRecovery?: (items: any[]) => void;
    onStartActivity?: (type: string, items: any[], card: LiteralnessCard) => void;
    onClose?: () => void;
    scope: 'session' | 'global';
    customTitle?: string;
}

const ProgressBar: React.FC<{ value: number, colorClass: string }> = ({ value, colorClass }) => (
    <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-500 ${colorClass}`} style={{ width: `${value}%` }}></div>
    </div>
);

const PendingChecklist: React.FC<{
    card: LiteralnessCard;
    allQuestions: Question[];
    allFlashcards: Flashcard[];
    onStart: (type: 'questions' | 'gaps' | 'flash' | 'pairs' | 'onemin') => void;
}> = ({ card, allQuestions, allFlashcards, onStart }) => {
    const { settings } = useSettings();
    
    // Use engine for consistent status
    const analysis = useMemo(() => engine.analyzeCardActivity(card, allQuestions, allFlashcards, settings), [card, allQuestions, allFlashcards, settings]);

    // Define targets visually
    const items = [
        { id: 'questions', label: 'Questões', icon: <BrainIcon />, ...analysis.activities.QUESTIONS, targetDesc: ">= 85% Acerto" },
        { id: 'gaps', label: 'Lacunas', icon: <MapIcon />, ...analysis.activities.GAPS, targetDesc: "100% Acerto" },
        { id: 'flash', label: 'Flashcards', icon: <ClipboardDocumentCheckIcon />, ...analysis.activities.FLASHCARDS, targetDesc: "100% Bom/Fácil" },
        { id: 'pairs', label: 'Pares', icon: <PuzzlePieceIcon />, ...analysis.activities.PAIRS, targetDesc: "Max 6 Erros" },
        { id: 'onemin', label: 'Minuto Porrada', icon: <BoltIcon />, ...analysis.activities.ONEMIN, targetDesc: "Score > 0" },
    ];

    const getStatusColor = (status: string) => {
        if (status === 'OK') return 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20';
        if (status === 'DUE_NOW') return 'text-rose-500 bg-rose-500/5 border-rose-500/20'; // REVISAR
        if (status === 'NEVER_DONE') return 'text-sky-500 bg-sky-500/5 border-sky-500/20'; // NOVO
        if (status === 'TRAIN') return 'text-amber-500 bg-amber-500/5 border-amber-500/20'; // META FAIL
        return 'text-slate-400 bg-white/5 border-white/10'; // EMPTY
    };

    const getActionButton = (item: any) => {
        if (item.status === 'EMPTY') return null;

        if (item.status === 'OK') {
             return (
                 <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> OK
                </div>
             );
        }
        
        let label = 'Iniciar';
        let bg = 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/20';
        
        if (item.status === 'DUE_NOW') { 
            label = `Revisar (${item.dueCount})`; 
            bg = 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'; 
        }
        else if (item.status === 'TRAIN') { 
            label = 'Treinar Meta'; 
            bg = 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'; 
        }
        else if (item.status === 'NEVER_DONE') {
            label = `Iniciar (${item.newCount})`;
            bg = 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/20';
        }

        return (
            <button 
                onClick={() => onStart(item.id === 'flash' ? 'flash' : item.id === 'onemin' ? 'onemin' : item.id)}
                className={`px-4 py-2 rounded-lg text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-1.5 shadow-lg ${bg}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="space-y-3 w-full">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 px-1">Checklist de Domínio</h4>
            {items.map(item => {
                const style = getStatusColor(item.status);
                
                return (
                    <div 
                        key={item.id}
                        className={`flex flex-col p-4 rounded-2xl border transition-all ${style}`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${item.status === 'EMPTY' ? 'bg-white/5' : 'bg-current opacity-10'}`}>
                                    {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5 text-current' })}
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest">{item.label}</p>
                                    <div className="flex gap-2 text-[9px] font-medium opacity-70 mt-0.5">
                                         <span>{item.targetDesc}</span>
                                         <span>•</span>
                                         <span>{item.totalItems} itens</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                {getActionButton(item)}
                            </div>
                        </div>

                        {/* Detailed Metrics - Added Mastery/Domain Bars */}
                        {item.status !== 'EMPTY' && item.type !== 'ONEMIN' && (
                            <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-black/5 dark:border-white/5">
                                <div>
                                    <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest opacity-60 mb-1">
                                        <span>Domínio</span>
                                        <span>{Math.round(item.avgDomain)}%</span>
                                    </div>
                                    <ProgressBar value={item.avgDomain} colorClass="bg-sky-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest opacity-60 mb-1">
                                        <span>Maestria</span>
                                        <span>{Math.round(item.avgMastery)}%</span>
                                    </div>
                                    <ProgressBar value={item.avgMastery} colorClass="bg-emerald-500" />
                                </div>
                            </div>
                        )}
                        
                        {/* Status Footer */}
                        {item.status !== 'EMPTY' && (
                            <div className="flex justify-between mt-3 text-[9px] font-mono font-bold opacity-60">
                                <span>Acurácia Atual: {(item.accuracy * 100).toFixed(0)}%</span>
                                <span>
                                    {item.status === 'OK' ? 'Meta Atingida' : 
                                     item.status === 'DUE_NOW' ? 'Revisão Necessária' : 
                                     item.status === 'TRAIN' ? 'Abaixo da Meta' : 'Novo Conteúdo'}
                                </span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ... (LiteralnessDiagnostic main component mostly same, simplified to wrap Checklist) ...
const LiteralnessDiagnostic: React.FC<LiteralnessDiagnosticProps> = ({ items, onClose, customTitle, onStartRecovery, onStartActivity, scope }) => {
    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    const { settings } = useSettings();
    const [recoveryCard, setRecoveryCard] = useState<LiteralnessCard | null>(null);

    // Calculate Global Averages for Header
    const globalStats = useMemo(() => {
        if (!recoveryCard) return { domain: 0, mastery: 0 };
        const analysis = engine.analyzeCardActivity(recoveryCard, allQuestions, allFlashcards, settings);
        
        // Average of the 5 modes averages
        const modes = ['QUESTIONS', 'GAPS', 'FLASHCARDS', 'PAIRS', 'ONEMIN'] as const;
        let sumD = 0, sumM = 0, count = 0;
        
        modes.forEach(m => {
             const act = analysis.activities[m];
             if (act.totalItems > 0) {
                 sumD += act.avgDomain;
                 sumM += act.avgMastery;
                 count++;
             }
        });
        
        if (count === 0) return { domain: 0, mastery: 0 };
        return { domain: sumD / count, mastery: sumM / count };
    }, [recoveryCard, allQuestions, allFlashcards, settings]);

    useEffect(() => {
        if (items.length === 1 && 'article' in items[0]) {
             const card = items[0] as LiteralnessCard;
             setRecoveryCard(card);
        }
    }, [items]);

    const handleStartRecoverySession = (type: 'questions' | 'gaps' | 'flash' | 'pairs' | 'onemin') => {
        if (!recoveryCard) return;
        
        const rawErrors = srs.getArticleOpenErrors(recoveryCard.id);
        const queue: any[] = [];

        if (type === 'questions') {
             // 1. Prioritize Errors
             const errs = rawErrors.questions.map((e: any) => e.itemId);
             allQuestions.filter(q => errs.includes(q.id)).forEach(q => queue.push({...q, sourceType: 'questoes', parentCard: recoveryCard}));
             // 2. If no errors but not passed, review all
             if (queue.length === 0) {
                  const allQ = srs.getQuestionsForCard(recoveryCard, allQuestions);
                  queue.push(...allQ);
             }
        } else if (type === 'gaps') {
             if (recoveryCard.phase2Lacuna) queue.push({ id: `gap_main`, questionText: recoveryCard.phase2Lacuna, isGapType: true, parentCard: recoveryCard });
             (recoveryCard.extraGaps || []).forEach((g, i) => queue.push({ id: `gap_${i}`, questionText: g.text, isGapType: true, parentCard: recoveryCard }));
        } else if (type === 'flash') {
             allFlashcards.filter(fc => fc.tags.includes(recoveryCard.id) && !fc.tags.includes('pair-match')).forEach(f => queue.push(f));
        } else if (type === 'pairs') {
             allFlashcards.filter(fc => fc.tags.includes(recoveryCard.id) && fc.tags.includes('pair-match')).forEach(f => queue.push(f));
        } else if (type === 'onemin') {
             // Mix for lightning
             const q = srs.getQuestionsForCard(recoveryCard, allQuestions);
             const g = (recoveryCard.extraGaps || []).map((g, i) => ({ id: `gap_${i}`, questionText: g.text, isGapType: true, parentCard: recoveryCard }));
             queue.push(...q, ...g);
        }

        if (queue.length > 0) {
            if (onStartActivity) {
                onStartActivity(type, queue, recoveryCard);
            } else if (onStartRecovery) {
                onStartRecovery(queue.sort(() => Math.random() - 0.5));
            }
        } else {
            alert("Nenhum item encontrado para esta atividade.");
        }
    };

    return (
        <div className="bg-[#020617] text-slate-100 w-full h-full flex flex-col animate-fade-in font-sans overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center bg-slate-900/60 backdrop-blur-3xl border-b border-white/5 shrink-0 z-30">
                <div className="flex items-center gap-4">
                    {onClose && (
                        <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all active:scale-90">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-sm font-black text-white tracking-tighter uppercase italic">{customTitle || 'Diagnóstico de Pendências'}</h2>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 pb-48">
               {recoveryCard ? (
                   <div className="max-w-xl mx-auto space-y-8 animate-fade-in-up">
                       <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <ChartBarIcon className="w-24 h-24" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-6 text-center">{recoveryCard.article}</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                     <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">Domínio Médio</span>
                                     <p className="text-2xl font-black text-sky-500">{globalStats.domain.toFixed(0)}%</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                     <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">Maestria Média</span>
                                     <p className="text-2xl font-black text-emerald-500">{globalStats.mastery.toFixed(0)}%</p>
                                </div>
                            </div>
                       </div>

                       <PendingChecklist card={recoveryCard} allQuestions={allQuestions} allFlashcards={allFlashcards} onStart={handleStartRecoverySession} />
                   </div>
               ) : (
                   <div className="text-center py-20">
                       <p className="text-slate-500">Nenhum card selecionado para diagnóstico.</p>
                   </div>
               )}
            </div>

            <footer className="shrink-0 p-8 bg-slate-950/90 backdrop-blur-xl border-t border-white/5 flex flex-col items-center gap-4 z-50 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <button onClick={onClose} className="w-full max-w-md py-4 rounded-[2rem] bg-white/5 border border-white/10 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] transition-all hover:text-white hover:bg-white/10 active:scale-95">
                    Fechar Diagnóstico
                </button>
            </footer>
        </div>
    );
};

export default LiteralnessDiagnostic;
