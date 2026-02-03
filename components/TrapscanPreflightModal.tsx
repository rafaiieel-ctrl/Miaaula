
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { RadarIcon, LockClosedIcon, CheckCircleIcon, XMarkIcon } from './icons';
import { AppSettings, TrapscanMode, TrapscanLockLevel, TrapscanSessionConfig } from '../types';
import { useSettings } from '../contexts/SettingsContext';

interface TrapscanPreflightModalProps {
    isOpen: boolean;
    onConfirm: (config: TrapscanSessionConfig) => void;
    onCancel: () => void; // Should probably just be confirm with defaults
}

const TrapscanPreflightModal: React.FC<TrapscanPreflightModalProps> = ({ isOpen, onConfirm }) => {
    const { settings, updateSettings } = useSettings();
    
    // Local state for the form
    const [assistMode, setAssistMode] = useState(true);
    const [mode, setMode] = useState<TrapscanMode>('TREINO');
    const [lockLevel, setLockLevel] = useState<TrapscanLockLevel>('SOFT');
    const [saveAsDefault, setSaveAsDefault] = useState(false);
    
    // Sync with global settings on open
    useEffect(() => {
        if (isOpen && settings.trapscan) {
            setAssistMode(settings.trapscan.assistMode);
            setMode(settings.trapscan.defaultMode);
            setLockLevel(settings.trapscan.lockLevel || 'SOFT');
        }
    }, [isOpen, settings.trapscan]);

    const handleStart = () => {
        const config: TrapscanSessionConfig = {
            enabled: true,
            assistMode,
            defaultMode: mode,
            lockLevel
        };

        if (saveAsDefault) {
            updateSettings({
                trapscan: {
                    ...settings.trapscan,
                    assistMode,
                    defaultMode: mode,
                    lockLevel
                }
            });
        }

        onConfirm(config);
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[11000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border-2 border-indigo-500/30 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative">
                
                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                            <RadarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Trapscan Pre-Flight</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Configuração da Sessão</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    
                    {/* 1. Main Switch */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-white uppercase tracking-wide">Assistente IA</span>
                            <span className="text-[10px] text-slate-400">Ativar análise em tempo real?</span>
                        </div>
                        <button 
                            onClick={() => setAssistMode(!assistMode)}
                            className={`w-14 h-7 rounded-full relative transition-all duration-300 ${assistMode ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${assistMode ? 'left-8' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className={`space-y-6 transition-all duration-300 ${!assistMode ? 'opacity-30 pointer-events-none blur-[1px]' : 'opacity-100'}`}>
                        {/* 2. Mode Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Modo de Operação</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setMode('GUIA')}
                                    className={`p-3 rounded-xl border-2 transition-all text-left ${mode === 'GUIA' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
                                >
                                    <span className="block text-xs font-black uppercase mb-1">Guia Visual</span>
                                    <span className="block text-[9px] opacity-70">Sem bloqueios, apenas sugestões.</span>
                                </button>
                                <button 
                                    onClick={() => setMode('TREINO')}
                                    className={`p-3 rounded-xl border-2 transition-all text-left ${mode === 'TREINO' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
                                >
                                    <span className="block text-xs font-black uppercase mb-1">Treino Ativo</span>
                                    <span className="block text-[9px] opacity-70">Bloqueia alternativas até analisar.</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Lock Level (Only for Treino) */}
                        {mode === 'TREINO' && (
                            <div className="space-y-2 animate-fade-in-up">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nível de Travamento</label>
                                <div className="grid grid-cols-2 gap-3">
                                     <button 
                                        onClick={() => setLockLevel('SOFT')}
                                        className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${lockLevel === 'SOFT' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-white/5 border-transparent text-slate-500'}`}
                                     >
                                         <div className="w-4 h-4 rounded-full border-2 border-current"></div>
                                         <div>
                                             <span className="block text-xs font-black uppercase">Soft Lock</span>
                                             <span className="block text-[9px] opacity-70">Libera em P1+P2</span>
                                         </div>
                                     </button>
                                     <button 
                                        onClick={() => setLockLevel('HARD')}
                                        className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${lockLevel === 'HARD' ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-white/5 border-transparent text-slate-500'}`}
                                     >
                                         <LockClosedIcon className="w-4 h-4" />
                                         <div>
                                             <span className="block text-xs font-black uppercase">Hard Lock</span>
                                             <span className="block text-[9px] opacity-70">Libera em P4</span>
                                         </div>
                                     </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Options */}
                    <label className="flex items-center gap-3 p-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={saveAsDefault} 
                            onChange={(e) => setSaveAsDefault(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
                        />
                        <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">Salvar como padrão para próximas sessões</span>
                    </label>

                </div>

                <div className="p-6 border-t border-white/5 bg-slate-900/80 backdrop-blur flex gap-3">
                    <button 
                        onClick={handleStart} 
                        className="w-full py-4 bg-white text-slate-950 font-black uppercase tracking-widest text-sm rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-5 h-5" />
                        Começar Sessão
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TrapscanPreflightModal;