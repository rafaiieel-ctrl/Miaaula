
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { XMarkIcon, BoltIcon, ArrowRightIcon } from './icons';

interface MergeDisciplinesModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceA: string;
    sourceB: string;
    onConfirm: (targetName: string, normalize: boolean) => void;
}

const MergeDisciplinesModal: React.FC<MergeDisciplinesModalProps> = ({ isOpen, onClose, sourceA, sourceB, onConfirm }) => {
    const [targetName, setTargetName] = useState(sourceA);
    const [normalize, setNormalize] = useState(true);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col border border-white/10" onClick={e => e.stopPropagation()}>
                
                <header className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <BoltIcon className="w-5 h-5 text-amber-500" />
                        Fusão de Disciplinas
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><XMarkIcon /></button>
                </header>

                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex-1 text-center font-mono text-slate-300 truncate">
                            {sourceA}
                        </div>
                        <div className="text-slate-500">+</div>
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex-1 text-center font-mono text-slate-300 truncate">
                            {sourceB}
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <ArrowRightIcon className="w-6 h-6 text-slate-500 rotate-90" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome da Disciplina Destino</label>
                        <input 
                            value={targetName}
                            onChange={(e) => setTargetName(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-sky-500 transition-all"
                            placeholder="Nome Final..."
                        />
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => setTargetName(sourceA)} className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-slate-400">Usar "{sourceA}"</button>
                            <button onClick={() => setTargetName(sourceB)} className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-slate-400">Usar "{sourceB}"</button>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/5 border border-white/5">
                        <input 
                            type="checkbox" 
                            checked={normalize} 
                            onChange={e => setNormalize(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-600 text-sky-500 focus:ring-sky-500 bg-slate-900" 
                        />
                        <div>
                            <span className="block text-sm font-bold text-slate-200">Aplicar Normalização</span>
                            <span className="block text-xs text-slate-500">Remove acentos, espaços extras e converte para maiúsculas automaticamente.</span>
                        </div>
                    </label>

                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-500 font-medium">
                        ⚠️ Atenção: Esta ação moverá todas as questões, flashcards e histórico de ambas as disciplinas para o novo nome. Não pode ser desfeita facilmente.
                    </div>
                </div>

                <footer className="p-6 border-t border-white/5 bg-slate-900/50 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">Cancelar</button>
                    <button 
                        onClick={() => onConfirm(targetName, normalize)} 
                        disabled={!targetName.trim()}
                        className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirmar Fusão
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default MergeDisciplinesModal;
