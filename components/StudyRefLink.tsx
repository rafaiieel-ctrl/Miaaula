
import React, { useState } from 'react';
import { StudyRef } from '../types';
import { BookOpenIcon, ChevronDownIcon, XMarkIcon } from './icons';

interface StudyRefLinkProps {
    refs: StudyRef[];
    onNavigate: (ref: StudyRef) => void;
    className?: string;
}

const StudyRefLink: React.FC<StudyRefLinkProps> = ({ refs, onNavigate, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!refs || refs.length === 0) return null;

    const handleAction = () => {
        if (refs.length === 1) {
            onNavigate(refs[0]);
        } else {
            setIsOpen(true);
        }
    };

    return (
        <div className={`relative ${className}`}>
            <button 
                onClick={handleAction}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            >
                <BookOpenIcon className="w-3.5 h-3.5" />
                <span>Ver Material</span>
                {refs.length > 1 && <ChevronDownIcon className="w-3 h-3 ml-0.5 opacity-50" />}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
                    <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <header className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-white uppercase tracking-widest text-sm">Abrir Referência</h3>
                            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white"><XMarkIcon className="w-5 h-5"/></button>
                        </header>
                        <div className="p-4 space-y-2">
                            {refs.map((ref, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => { onNavigate(ref); setIsOpen(false); }}
                                    className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-sky-500/30 transition-all flex items-center justify-between group"
                                >
                                    <div>
                                        <p className="text-xs font-black text-white uppercase tracking-tight">{ref.label || `Material ${idx + 1}`}</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">{ref.sourceType}</p>
                                    </div>
                                    <BookOpenIcon className="w-5 h-5 text-slate-700 group-hover:text-sky-500 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudyRefLink;
