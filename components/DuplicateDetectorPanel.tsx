
import React, { useState } from 'react';
import { Question, Flashcard } from '../types';
import { EyeIcon, TrashIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon, XMarkIcon } from './icons';

interface DuplicateDetectorPanelProps<T extends Question | Flashcard> {
    duplicates: { id: string; reason: 'EXACT' | 'NEAR'; item: T }[];
    isDetecting: boolean;
    onOpen: (item: T) => void;
    onRemove: (id: string) => void;
    onIgnore: (id: string) => void;
    entityType: 'question' | 'flashcard' | 'pair';
}

function DuplicateDetectorPanel<T extends Question | Flashcard>({ 
    duplicates, 
    isDetecting, 
    onOpen, 
    onRemove, 
    onIgnore,
    entityType
}: DuplicateDetectorPanelProps<T>) {
    const [expanded, setExpanded] = useState(false);
    
    // Helper to get preview text based on type
    const getPreview = (item: T) => {
        if (entityType === 'question') {
            const q = item as unknown as Question;
            return (
                <div>
                    <span className="font-mono text-[9px] text-slate-400 mr-2">{q.questionRef}</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2">{q.questionText}</span>
                    <div className="flex gap-2 mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        <span>Gabarito: <span className="text-emerald-500">{q.correctAnswer}</span></span>
                        {q.studyRefs && q.studyRefs.length > 0 && <span>Origem: {q.studyRefs[0].sourceType}</span>}
                    </div>
                </div>
            );
        } else {
            const f = item as unknown as Flashcard;
            return (
                <div>
                    <div className="flex justify-between">
                        <span className="font-mono text-[9px] text-slate-400">{entityType === 'pair' ? 'Par' : 'Card'}</span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                        <span className="font-bold text-sky-500">F:</span> {f.front.substring(0, 60)}...
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-emerald-500">V:</span> {f.back.substring(0, 60)}...
                    </div>
                </div>
            );
        }
    };

    if (isDetecting) {
        return (
            <div className="p-4 rounded-xl border border-bunker-200 dark:border-bunker-800 bg-white dark:bg-bunker-950 shadow-inner flex items-center gap-2 text-xs text-slate-400 italic">
                <ArrowPathIcon className="w-3 h-3 animate-spin"/> Verificando duplicidade...
            </div>
        );
    }

    if (duplicates.length === 0) {
        return (
            <div className="p-4 rounded-xl border border-emerald-200/30 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold transition-all">
                <CheckCircleIcon className="w-4 h-4"/> Sem duplicados detectados.
            </div>
        );
    }

    const displayLimit = expanded ? duplicates.length : 3;
    const hiddenCount = duplicates.length - displayLimit;

    return (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 overflow-hidden transition-all shadow-sm">
            <div className="p-3 bg-rose-100/50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-900/30 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                        {duplicates.length} Duplicado(s) Encontrado(s)
                    </span>
                </div>
                <button className="text-[10px] font-bold text-rose-500 hover:underline">
                    {expanded ? 'Ocultar' : 'Ver Todos'}
                </button>
            </div>
            
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar bg-white/50 dark:bg-bunker-950/50">
                {duplicates.slice(0, displayLimit).map((d) => (
                    <div key={d.id} className="p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-bunker-900 shadow-sm flex flex-col gap-2 group relative">
                        <div className="absolute top-2 right-2">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${d.reason === 'EXACT' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}`}>
                                {d.reason === 'EXACT' ? 'Exato' : 'Similar'}
                            </span>
                        </div>
                        
                        {getPreview(d.item)}
                        
                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                            <button 
                                type="button" 
                                onClick={() => onOpen(d.item)} 
                                className="flex items-center gap-1 text-[10px] font-bold text-sky-600 hover:text-sky-500 bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded transition-colors"
                            >
                                <EyeIcon className="w-3 h-3"/> Abrir
                            </button>
                            <button 
                                type="button" 
                                onClick={() => onIgnore(d.id)} 
                                className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded transition-colors ml-auto"
                            >
                                <XMarkIcon className="w-3 h-3"/> Ignorar
                            </button>
                            <button 
                                type="button" 
                                onClick={() => onRemove(d.id)} 
                                className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded transition-colors"
                            >
                                <TrashIcon className="w-3 h-3"/> Remover
                            </button>
                        </div>
                    </div>
                ))}
                
                {!expanded && hiddenCount > 0 && (
                    <button onClick={() => setExpanded(true)} className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1 font-medium">
                        + {hiddenCount} outros...
                    </button>
                )}
            </div>
        </div>
    );
}

export default DuplicateDetectorPanel;