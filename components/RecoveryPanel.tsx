
import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import { AppSettings } from '../types';
import { calculateCurrentDomain } from '../services/srsService';
import { XMarkIcon, BoltIcon, ExclamationTriangleIcon, CheckCircleIcon } from './icons';
import MasteryBadge from './MasteryBadge';

interface RecoveryPanelProps {
    subject: string;
    questions: Question[];
    settings: AppSettings;
    onStartRecovery: (queue: Question[]) => void;
    onClose: () => void;
}

type FilterType = 'all' | 'errors' | 'critical';

const RecoveryPanel: React.FC<RecoveryPanelProps> = ({ subject, questions, settings, onStartRecovery, onClose }) => {
    const [filter, setFilter] = useState<FilterType>('errors');

    // Filter items based on the active filter type
    const filteredItems = useMemo(() => {
        let base = questions.filter(q => q.subject === subject && q.totalAttempts > 0);

        if (filter === 'errors') {
            return base.filter(q => !q.lastWasCorrect).sort((a, b) => {
                // Sort by recent errors first, then lowest mastery
                if (a.lastWasCorrect !== b.lastWasCorrect) return a.lastWasCorrect ? 1 : -1;
                return calculateCurrentDomain(a, settings) - calculateCurrentDomain(b, settings);
            });
        }
        
        if (filter === 'critical') {
            return base.filter(q => calculateCurrentDomain(q, settings) < 40).sort((a, b) => calculateCurrentDomain(a, settings) - calculateCurrentDomain(b, settings));
        }

        // 'all' - still sort by lowest mastery
        return base.sort((a, b) => calculateCurrentDomain(a, settings) - calculateCurrentDomain(b, settings));
    }, [questions, subject, filter, settings]);

    const handleStart = () => {
        onStartRecovery(filteredItems);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-bunker-950 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] border border-bunker-200 dark:border-bunker-800" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-bunker-200 dark:border-bunker-800 flex justify-between items-start bg-slate-50 dark:bg-slate-900/50 rounded-t-2xl">
                    <div>
                        <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <ExclamationTriangleIcon className="text-rose-500 w-6 h-6" />
                            Recuperação
                        </h3>
                        <p className="text-sm font-bold text-sky-500 mt-1">{subject}</p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-rose-500 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-2 flex gap-1 bg-bunker-100 dark:bg-bunker-900 border-b border-bunker-200 dark:border-bunker-800">
                    <button 
                        onClick={() => setFilter('errors')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === 'errors' ? 'bg-white dark:bg-bunker-800 text-rose-500 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        Erros ({questions.filter(q => q.subject === subject && !q.lastWasCorrect && q.totalAttempts > 0).length})
                    </button>
                    <button 
                        onClick={() => setFilter('critical')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === 'critical' ? 'bg-white dark:bg-bunker-800 text-amber-500 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        Críticos ({questions.filter(q => q.subject === subject && calculateCurrentDomain(q, settings) < 40 && q.totalAttempts > 0).length})
                    </button>
                    <button 
                        onClick={() => setFilter('all')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === 'all' ? 'bg-white dark:bg-bunker-800 text-sky-500 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        Todos ({questions.filter(q => q.subject === subject && q.totalAttempts > 0).length})
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3 bg-white dark:bg-bunker-950">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-12 opacity-50">
                            <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                            <p className="text-sm font-bold">Tudo limpo nesta categoria!</p>
                        </div>
                    ) : (
                        filteredItems.map(q => {
                            const mastery = calculateCurrentDomain(q, settings);
                            const isError = !q.lastWasCorrect;
                            
                            return (
                                <div key={q.id} className="p-3 rounded-xl border border-bunker-100 dark:border-bunker-800 bg-bunker-50 dark:bg-bunker-900/40 flex items-center justify-between group hover:border-sky-500/30 transition-all">
                                    <div className="min-w-0 pr-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isError ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                {isError ? 'Erro' : 'OK'}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">{q.questionRef}</span>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">{q.questionText}</p>
                                    </div>
                                    <MasteryBadge score={mastery} size="sm" />
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-bunker-200 dark:border-bunker-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                    <button 
                        onClick={handleStart}
                        disabled={filteredItems.length === 0}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-rose-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <BoltIcon className="w-5 h-5" /> Iniciar Recuperação ({filteredItems.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecoveryPanel;
