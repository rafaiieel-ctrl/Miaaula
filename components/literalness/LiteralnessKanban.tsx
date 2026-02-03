import React, { useMemo, useState } from 'react';
import { LiteralnessCard } from '../../types';
import { useLiteralnessDispatch } from '../../contexts/LiteralnessContext';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, ClockIcon, TrashIcon, PencilIcon } from '../icons';
import ConfirmationModal from '../ConfirmationModal';

interface LiteralnessKanbanProps {
    cards: LiteralnessCard[];
    onEditCard: (card: LiteralnessCard) => void;
}

const KanbanColumn: React.FC<{ 
    title: string; 
    cards: LiteralnessCard[]; 
    color: string;
    onMoveCard: (card: LiteralnessCard, newDomain: number) => void;
    onDeleteCard: (card: LiteralnessCard) => void;
    onEditCard: (card: LiteralnessCard) => void;
    targetDomain: number;
}> = ({ title, cards, color, onMoveCard, onDeleteCard, onEditCard, targetDomain }) => {
    
    const handleDragStart = (e: React.DragEvent, cardId: string) => {
        e.dataTransfer.setData("cardId", cardId);
    };

    const getResultIcon = (result: number | null | undefined) => {
        if (result === 2) return <CheckCircleIcon className="w-4 h-4 text-emerald-500" />;
        if (result === 1) return <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />;
        if (result === 0) return <XCircleIcon className="w-4 h-4 text-red-500" />;
        return <span className="w-4 h-4 block rounded-full bg-slate-200 dark:bg-slate-700" />;
    };

    return (
        <div 
            className="flex-1 min-w-[280px] bg-slate-900/20 backdrop-blur-md rounded-[2rem] border border-white/5 flex flex-col h-full max-h-[80vh] overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                const cardId = e.dataTransfer.getData("cardId");
                if (cardId) {
                    const event = new CustomEvent('kanban-drop', { detail: { cardId, newDomain: targetDomain } });
                    window.dispatchEvent(event);
                }
            }}
        >
            <div className={`p-5 border-b border-white/5 font-black text-[10px] uppercase tracking-[0.3em] flex justify-between items-center ${color}`}>
                <span>{title}</span>
                <span className="bg-white/5 px-3 py-1 rounded-full text-[9px] border border-white/5">{cards.length}</span>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                {cards.map(card => (
                    <div 
                        key={card.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        className="bg-slate-900/60 p-4 rounded-2xl shadow-lg border border-white/5 cursor-grab active:cursor-grabbing hover:border-sky-500/30 transition-all group relative"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-black text-sky-400 bg-sky-400/5 border border-sky-400/10 px-2 py-1 rounded-lg truncate max-w-[160px] uppercase tracking-wider">{card.article}</span>
                            <div className="flex gap-1">
                                {getResultIcon(card.lastResult)}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4 font-serif">{card.phase1Full}</p>
                        
                        <div className="flex justify-between items-center pt-3 border-t border-white/5">
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <ClockIcon className="w-3 h-3" /> 
                                {new Date(card.nextReviewDate).toLocaleDateString()}
                            </span>
                            
                            <div className="flex gap-1 items-center">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onEditCard(card); }}
                                    className="p-1.5 text-slate-500 hover:text-white bg-white/5 rounded-lg transition-colors"
                                >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteCard(card); }}
                                    className="p-1.5 text-slate-500 hover:text-rose-500 bg-white/5 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex bg-white/5 rounded-lg ml-1 overflow-hidden border border-white/5">
                                    {targetDomain > 0 && (
                                        <button onClick={(e) => { e.stopPropagation(); onMoveCard(card, targetDomain - 1); }} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5">&larr;</button>
                                    )}
                                    {targetDomain < 3 && ( 
                                        <button onClick={(e) => { e.stopPropagation(); onMoveCard(card, targetDomain + 1); }} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5">&rarr;</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LiteralnessKanban: React.FC<LiteralnessKanbanProps> = ({ cards, onEditCard }) => {
    const { updateCard, deleteCards } = useLiteralnessDispatch();
    const [cardToDelete, setCardToDelete] = useState<LiteralnessCard | null>(null);

    React.useEffect(() => {
        const handleDrop = (e: any) => {
            const { cardId, newDomain } = e.detail;
            const card = cards.find(c => c.id === cardId);
            if (card && card.dominio !== newDomain) {
                handleMoveCard(card, newDomain);
            }
        };
        window.addEventListener('kanban-drop', handleDrop);
        return () => window.removeEventListener('kanban-drop', handleDrop);
    }, [cards]);

    const cols = useMemo(() => {
        const backlog = cards.filter(c => (c.dominio || 0) === 0);
        const study = cards.filter(c => (c.dominio || 0) === 1);
        const consolidation = cards.filter(c => (c.dominio || 0) === 2);
        const mastered = cards.filter(c => (c.dominio || 0) >= 3);
        return { backlog, study, consolidation, mastered };
    }, [cards]);

    const handleMoveCard = (card: LiteralnessCard, newDomain: number) => {
        const safeDomain = Math.max(0, Math.min(3, newDomain));
        let nextDate = card.nextReviewDate;
        const now = new Date();
        
        if (safeDomain <= 1) { nextDate = now.toISOString(); }
        else if (safeDomain === 3 && card.dominio! < 3) {
            const d = new Date(); d.setDate(d.getDate() + 7);
            nextDate = d.toISOString();
        }

        updateCard({ ...card, dominio: safeDomain, nextReviewDate: nextDate });
    };

    const handleDeleteClick = (card: LiteralnessCard) => setCardToDelete(card);

    const handleConfirmDelete = () => {
        if (cardToDelete) {
            deleteCards([cardToDelete.id]);
            setCardToDelete(null);
        }
    };

    return (
        <>
            <div className="flex gap-6 overflow-x-auto pb-8 h-full min-h-[600px] px-2 custom-scrollbar">
                <KanbanColumn title="Não Visto" cards={cols.backlog} color="text-slate-500" targetDomain={0} onMoveCard={handleMoveCard} onDeleteCard={handleDeleteClick} onEditCard={onEditCard} />
                <KanbanColumn title="Em Estudo" cards={cols.study} color="text-rose-500" targetDomain={1} onMoveCard={handleMoveCard} onDeleteCard={handleDeleteClick} onEditCard={onEditCard} />
                <KanbanColumn title="Consolidação" cards={cols.consolidation} color="text-amber-500" targetDomain={2} onMoveCard={handleMoveCard} onDeleteCard={handleDeleteClick} onEditCard={onEditCard} />
                <KanbanColumn title="Dominado" cards={cols.mastered} color="text-emerald-500" targetDomain={3} onMoveCard={handleMoveCard} onDeleteCard={handleDeleteClick} onEditCard={onEditCard} />
            </div>

            <ConfirmationModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={handleConfirmDelete} title="Excluir Card?">
                <div className="space-y-3">
                    <p>Você removerá permanentemente <strong>{cardToDelete?.article}</strong>.</p>
                    <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Esta ação é irreversível.</p>
                </div>
            </ConfirmationModal>
        </>
    );
};

export default LiteralnessKanban;