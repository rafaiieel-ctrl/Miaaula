
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useSettings } from '../contexts/SettingsContext';
import { RadarIcon, LockClosedIcon, XMarkIcon } from './icons';
import { TrapscanLockLevel, TrapscanMode } from '../types';

interface TrapscanMenuProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRect?: DOMRect | null;
}

const TrapscanMenu: React.FC<TrapscanMenuProps> = ({ isOpen, onClose, anchorRect }) => {
    const { settings, updateSettings } = useSettings();
    const config = settings.trapscan || { enabled: true, assistMode: true, defaultMode: 'TREINO', lockLevel: 'SOFT' };
    const [localAssist, setLocalAssist] = useState(config.assistMode);

    // Sync local state when settings change or menu opens
    useEffect(() => {
        if (isOpen) {
            setLocalAssist(config.assistMode);
        }
    }, [isOpen, config.assistMode]);

    if (!isOpen) return null;

    const handleToggleAssist = () => {
        const newState = !localAssist;
        setLocalAssist(newState);
        // Direct update to context
        updateSettings({ 
            trapscan: { 
                ...config, 
                assistMode: newState,
                enabled: true // Ensure enabled is true if we are interacting
            } 
        });
    };

    const handleSetMode = (mode: TrapscanMode) => {
        updateSettings({ trapscan: { ...config, defaultMode: mode } });
    };

    const handleSetLockLevel = (level: TrapscanLockLevel) => {
        updateSettings({ trapscan: { ...config, lockLevel: level } });
    };

    // Responsive positioning logic
    const style: any = {
        position: 'fixed',
        zIndex: 11000,
    };

    if (typeof window !== 'undefined' && window.innerWidth >= 768 && anchorRect) {
        style.top = anchorRect.bottom + 10;
        style.left = anchorRect.left - 100; // Shift left to align
    } else {
        // Mobile Drawer
        style.bottom = 0;
        style.left = 0;
        style.width = '100%';
    }

    const ModalContent = (
        <>
            <div 
                className="fixed inset-0 z-[10999] bg-black/40 backdrop-blur-sm" 
                onClick={onClose}
            ></div>
            <div 
                className="bg-slate-900 border border-white/10 rounded-2xl md:rounded-xl shadow-2xl p-5 w-full md:w-80 flex flex-col gap-4 animate-fade-in-up md:animate-fade-in"
                style={style}
            >
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <RadarIcon className="w-5 h-5" />
                        <h3 className="font-black text-sm uppercase tracking-widest text-white">Trapscan Control</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Master Switch */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Assistente</span>
                    <button 
                        onClick={handleToggleAssist}
                        className={`w-12 h-6 rounded-full relative transition-colors ${localAssist ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${localAssist ? 'left-7' : 'left-1'}`}></div>
                    </button>
                </div>

                {/* Mode Selector */}
                <div className={`space-y-2 transition-opacity ${!localAssist ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Modo de Operação</p>
                    <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
                        <button 
                            onClick={() => handleSetMode('GUIA')}
                            className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${config.defaultMode === 'GUIA' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                        >
                            Guia (Visual)
                        </button>
                        <button 
                            onClick={() => handleSetMode('TREINO')}
                            className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${config.defaultMode === 'TREINO' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                        >
                            Treino (Lock)
                        </button>
                    </div>
                </div>

                {/* Lock Level (Only if Treino) */}
                {config.defaultMode === 'TREINO' && (
                    <div className={`space-y-2 transition-opacity ${!localAssist ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Nível de Bloqueio</p>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => handleSetLockLevel('SOFT')}
                                className={`flex-1 p-2 rounded-lg border text-left transition-all ${config.lockLevel === 'SOFT' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}
                             >
                                 <span className="block text-[10px] font-black uppercase mb-0.5">Soft Lock</span>
                                 <span className="text-[9px] opacity-70 leading-tight">Libera após P1+P2</span>
                             </button>
                             <button 
                                onClick={() => handleSetLockLevel('HARD')}
                                className={`flex-1 p-2 rounded-lg border text-left transition-all ${config.lockLevel === 'HARD' ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}
                             >
                                 <div className="flex items-center gap-1 mb-0.5">
                                     <LockClosedIcon className="w-3 h-3" />
                                     <span className="block text-[10px] font-black uppercase">Hard Lock</span>
                                 </div>
                                 <span className="text-[9px] opacity-70 leading-tight">Libera após P4</span>
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    return ReactDOM.createPortal(ModalContent, document.body);
};

export default TrapscanMenu;
