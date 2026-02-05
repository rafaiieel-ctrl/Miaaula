
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { LiteralnessCard } from '../../types';
import { ArrowsRightLeftIcon, XMarkIcon } from '../icons';

interface MoveArticleModalProps {
    isOpen: boolean;
    onClose: () => void;
    card: LiteralnessCard;
    availableLaws: string[];
    onConfirm: (cardId: string, newLawId: string) => void;
}

const MoveArticleModal: React.FC<MoveArticleModalProps> = ({ isOpen, onClose, card, availableLaws, onConfirm }) => {
    const [selectedTarget, setSelectedTarget] = useState(card.lawId);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedTarget && selectedTarget !== card.lawId) {
            onConfirm(card.id, selectedTarget);
            onClose();
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                <header className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                            <ArrowsRightLeftIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg leading-tight">Mover Artigo</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{card.article}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors"><XMarkIcon className="w-5 h-5"/></button>
                </header>

                <div className="p-6 space-y-6">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-wider">Origem Atual</p>
                        <p className="text-white font-bold text-sm">{card.lawId}</p>
                    </div>

                    <div className="flex justify-center">
                        <ArrowsRightLeftIcon className="w-6 h-6 text-slate-600 rotate-90" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Selecione o Destino</label>
                        <select 
                            value={selectedTarget} 
                            onChange={(e) => setSelectedTarget(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                        >
                            {availableLaws.map(lawId => (
                                <option key={lawId} value={lawId} disabled={lawId === card.lawId}>
                                    {lawId}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <footer className="p-6 border-t border-white/5 bg-slate-950/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-white hover:bg-white/5 transition-colors">Cancelar</button>
                    <button 
                        onClick={handleConfirm}
                        disabled={selectedTarget === card.lawId}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirmar
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default MoveArticleModal;
