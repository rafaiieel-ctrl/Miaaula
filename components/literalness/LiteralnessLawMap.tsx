
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { LiteralnessCard, Question, Flashcard } from '../../types';
import { useQuestionState } from '../../contexts/QuestionContext';
import { useFlashcardState, useFlashcardDispatch } from '../../contexts/FlashcardContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useLiteralnessDispatch } from '../../contexts/LiteralnessContext';
import { 
    ChevronLeftIcon, ExclamationTriangleIcon, 
    PencilIcon, TrashIcon, ArrowRightIcon, ClockIcon,
    BoltIcon, CheckCircleIcon, BrainIcon, MapIcon, 
    ClipboardDocumentCheckIcon, PuzzlePieceIcon, ScaleIcon,
    PaintBrushIcon
} from '../icons';
import * as engine from '../../services/activityEngine';
import * as srs from '../../services/srsService';
import ConfirmationModal from '../ConfirmationModal';
import LiteralnessEditorModal from './LiteralnessEditorModal';
import StudySessionModal from '../StudySessionModal';
import FlashcardStudySessionModal from '../FlashcardStudySessionModal';
import PairMatchGame from '../pairmatch/PairMatchGame'; 

interface LiteralnessLawMapProps {
    cards: LiteralnessCard[];
    onStudyArticle: (cards: LiteralnessCard[], mode: any) => void;
    onViewArticle: (card: LiteralnessCard) => void;
    onViewDiagnostic: (cards: LiteralnessCard[], title: string) => void;
    activeLawId?: string | null;
    onSelectLaw?: (id: string | null) => void;
}

// Helper Colors Map
const COLOR_MAP: Record<string, { border: string; bg: string; text: string; glow: string }> = {
    default: { border: 'border-white/5', bg: 'bg-slate-900/60', text: 'text-white', glow: '' },
    yellow: { border: 'border-yellow-500/50', bg: 'bg-yellow-500/5', text: 'text-yellow-100', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.1)]' },
    orange: { border: 'border-orange-500/50', bg: 'bg-orange-500/5', text: 'text-orange-100', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.1)]' },
    red: { border: 'border-red-500/50', bg: 'bg-red-500/5', text: 'text-red-100', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.1)]' },
    gray: { border: 'border-slate-700', bg: 'bg-slate-900/30', text: 'text-slate-500', glow: '' },
};

const VisualMenu: React.FC<{ 
    card: LiteralnessCard; 
    onClose: () => void;
    onUpdate: (updates: Partial<LiteralnessCard>) => void;
}> = ({ card, onClose, onUpdate }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const colors = [
        { id: 'default', color: 'bg-slate-700 border-slate-500' },
        { id: 'yellow', color: 'bg-yellow-500 border-yellow-300' },
        { id: 'orange', color: 'bg-orange-500 border-orange-300' },
        { id: 'red', color: 'bg-red-500 border-red-300' },
        { id: 'gray', color: 'bg-slate-800 border-slate-600' },
    ];

    return (
        <div ref={menuRef} className="absolute right-0 top-10 z-50 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-3 w-48 animate-fade-in" onClick={e => e.stopPropagation()}>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cor do Card</p>
            <div className="flex gap-2 mb-4">
                {colors.map(c => (
                    <button
                        key={c.id}
                        onClick={() => onUpdate({ visualColor: c.id as any })}
                        className={`w-6 h-6 rounded-full border-2 ${c.color} ${card.visualColor === c.id ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100 hover:scale-110'} transition-all`}
                    />
                ))}
            </div>
            <div className="h-px bg-white/10 mb-3"></div>
            <button 
                onClick={() => onUpdate({ isCritical: !card.isCritical })}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${card.isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-slate-400 hover:text-white'}`}
            >
                <ExclamationTriangleIcon className="w-4 h-4" />
                {card.isCritical ? 'Marcado Crítico' : 'Marcar Crítico'}
            </button>
        </div>
    );
};

const ProgressBar: React.FC<{ value: number, label: string, color: string }> = ({ value, label, color }) => (
    <div className="flex-1">
        <div className="flex justify-between items-end mb-1.5 px-1">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className={`text-[10px] font-bold ${color}`}>{Math.round(value)}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-700 ${color.replace('text-', 'bg-')}`} style={{ width: `${value}%` }}></div>
        </div>
    </div>
);

const LiteralnessLawMap: React.FC<LiteralnessLawMapProps> = ({ cards, onViewArticle, activeLawId, onSelectLaw }) => {
    const { deleteCards, updateCard } = useLiteralnessDispatch();
    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    const { updateBatchFlashcards } = useFlashcardDispatch();
    const { settings, updateGameRecord, addPairMatchHistory, logDailyActivity } = useSettings();
    
    const [internalLawId, setInternalLawId] = useState<string | null>(null);
    const selectedLawId = activeLawId !== undefined ? activeLawId : internalLawId;
    const [cardToDelete, setCardToDelete] = useState<LiteralnessCard | null>(null);
    const [cardToEdit, setCardToEdit] = useState<LiteralnessCard | null>(null);
    
    // Visual Menu State
    const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);

    // Active Review Sessions
    const [activeQuestionSession, setActiveQuestionSession] = useState<{ title: string, questions: Question[] } | null>(null);
    const [activeFlashcardSession, setActiveFlashcardSession] = useState<{ title: string, cards: Flashcard[] } | null>(null);
    const [activePairSession, setActivePairSession] = useState<{ title: string, cards: Flashcard[] } | null>(null);

    const cardSmartStats = useMemo(() => {
        const map = new Map<string, srs.LitRefSmartStatus>();
        cards.forEach(card => {
             map.set(card.id, srs.getLitRefSmartStatus(card.id, allQuestions, allFlashcards, settings));
        });
        return map;
    }, [cards, allQuestions, allFlashcards, settings]);

    const lawGroups = useMemo(() => {
        const groups: Record<string, any> = {};
        cards.forEach(card => {
            if (!card.lawId) return;

            const lawKey = card.lawId;
            if (!groups[lawKey]) groups[lawKey] = { id: lawKey, count: 0, critical: 0 };
            groups[lawKey].count++;
            const stats = cardSmartStats.get(card.id);
            if (stats && stats.overdueItems > 0) groups[lawKey].critical++;
        });
        return Object.entries(groups).sort((a, b) => b[1].critical - a[1].critical);
    }, [cards, cardSmartStats]);

    const filteredArticles = useMemo(() => {
        if (!selectedLawId) return [];
        return cards
            .filter(c => c.lawId === selectedLawId)
            .map(card => ({ card, stats: cardSmartStats.get(card.id)! }));
    }, [cards, selectedLawId, cardSmartStats]);

    const handleSmartAction = (card: LiteralnessCard, stats: srs.LitRefSmartStatus) => {
        const hasPending = stats.overdueItems > 0;
        
        if (hasPending) {
            // PRIORITY: Questions -> Gaps -> Flashcards -> Pairs
            if (stats.counts.pending.questions > 0) {
                setActiveQuestionSession({ 
                    title: `Revisão: ${card.article}`, 
                    questions: stats.lists.pendingQuestions 
                });
            } else if (stats.counts.pending.gaps > 0) {
                setActiveQuestionSession({ 
                    title: `Lacunas: ${card.article}`, 
                    questions: stats.lists.pendingGaps 
                });
            } else if (stats.counts.pending.flashcards > 0) {
                setActiveFlashcardSession({ 
                    title: `Cards: ${card.article}`, 
                    cards: stats.lists.pendingFlashcards 
                });
            } else if (stats.counts.pending.pairs > 0) {
                 setActivePairSession({
                    title: `Pares: ${card.article}`,
                    cards: stats.lists.pendingPairs
                 });
            }
        } else {
            // Case D: Not Started
            if (stats.totalItems > 0 && stats.reviewedItems === 0) {
                onViewArticle(card);
            }
        }
    };
    
    const handleVisualUpdate = (card: LiteralnessCard, updates: Partial<LiteralnessCard>) => {
        updateCard({ ...card, ...updates });
        setOpenMenuCardId(null);
    };

    if (!selectedLawId) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                {lawGroups.map(([id, data]) => (
                    <div key={id} onClick={() => onSelectLaw ? onSelectLaw(id) : setInternalLawId(id)} className="bg-slate-900/40 border border-white/5 p-6 rounded-[2.5rem] hover:bg-slate-900/60 transition-all cursor-pointer group">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-sky-500/10 rounded-full text-sky-500"><ScaleIcon className="w-5 h-5"/></div>
                            <h4 className="text-xl font-black text-white uppercase italic tracking-tighter group-hover:text-sky-400 transition-colors truncate">{id}</h4>
                        </div>
                        <div className="flex gap-6">
                            <div className="flex flex-col"><span className="text-[8px] font-bold text-slate-500 uppercase">Núcleos</span><span className="text-xl font-black text-white">{data.count}</span></div>
                            {data.critical > 0 && <div className="flex flex-col"><span className="text-[8px] font-bold text-rose-500 uppercase">Pendentes</span><span className="text-xl font-black text-rose-500">{data.critical}</span></div>}
                        </div>
                    </div>
                ))}
                {lawGroups.length === 0 && (
                    <div className="col-span-full text-center py-20 text-slate-500">
                        <p className="font-bold text-lg">Nenhum núcleo de lei encontrado.</p>
                        <p className="text-sm">Importe conteúdo na aba "Importar".</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in max-w-4xl mx-auto w-full px-2 md:px-0">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => onSelectLaw ? onSelectLaw(null) : setInternalLawId(null)} className="p-2.5 bg-white/5 rounded-2xl text-slate-400 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95"><ChevronLeftIcon className="w-4 h-4" /> Voltar</button>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter truncate max-w-md">{selectedLawId}</h3>
            </div>

            <div className="flex flex-col gap-4">
                {filteredArticles.map(({ card, stats }) => {
                    const hasPending = stats.overdueItems > 0;
                    const isFuture = !hasPending && stats.nextDueAtFuture && stats.nextDueAtFuture > Date.now();
                    const isNew = stats.totalItems > 0 && stats.reviewedItems === 0;
                    
                    const visualStyle = COLOR_MAP[card.visualColor || 'default'];
                    const isGray = card.visualColor === 'gray';

                    let buttonLabel = "INICIAR";
                    let buttonColor = "bg-white text-slate-950 hover:bg-slate-200";
                    let buttonIcon = <ArrowRightIcon className="w-4 h-4" />;
                    let disabled = false;
                    let tooltip = "";

                    if (hasPending) {
                        buttonLabel = "PENDÊNCIAS";
                        buttonColor = "bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/20";
                        buttonIcon = <BoltIcon className="w-4 h-4" />;
                    } else if (isFuture) {
                        buttonLabel = "REVISÃO";
                        buttonColor = "bg-white/5 text-slate-500 border border-white/5";
                        buttonIcon = <ClockIcon className="w-4 h-4" />;
                        disabled = true;
                        
                        const diffMs = (stats.nextDueAtFuture || 0) - Date.now();
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        tooltip = `Disponível em ${hours}h ${mins}m`;
                    } else if (!isNew) {
                         buttonLabel = "REVISÃO";
                         buttonColor = "bg-emerald-600 text-white hover:bg-emerald-500";
                         buttonIcon = <CheckCircleIcon className="w-4 h-4" />;
                    }

                    return (
                        <div 
                            key={card.id} 
                            onClick={() => onViewArticle(card)}
                            className={`group relative rounded-[2.5rem] border p-6 md:p-8 hover:border-white/20 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-visible 
                                ${visualStyle.bg} ${visualStyle.border} ${visualStyle.glow} ${isGray ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    {card.isCritical && (
                                        <div title="Conteúdo Crítico" className="p-1 bg-rose-500 text-white rounded-full animate-pulse shadow-lg shadow-rose-500/40">
                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                    <h4 className={`text-2xl font-black tracking-tighter uppercase italic leading-tight ${isGray ? 'text-slate-400' : 'text-white'}`}>{card.article}</h4>
                                    {hasPending && !card.isCritical && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>}
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate mb-6">{card.topic || 'Geral'}</p>
                                
                                <div className="flex flex-col sm:flex-row gap-6 max-w-lg mb-4">
                                    <ProgressBar value={stats.domain || 0} label="Retenção (Foco)" color={isGray ? "text-slate-500" : "text-sky-400"} />
                                    <ProgressBar value={stats.mastery || 0} label="Domínio (Longo Prazo)" color={isGray ? "text-slate-500" : "text-emerald-400"} />
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    {hasPending ? (
                                        <div className="flex items-center gap-3 text-rose-400">
                                            <span className="flex items-center gap-1"><BoltIcon className="w-3 h-3"/> Pendências:</span>
                                            {stats.counts.pending.questions > 0 && <span>Q: {stats.counts.pending.questions}</span>}
                                            {stats.counts.pending.gaps > 0 && <span>L: {stats.counts.pending.gaps}</span>}
                                            {stats.counts.pending.flashcards > 0 && <span>FC: {stats.counts.pending.flashcards}</span>}
                                            {stats.counts.pending.pairs > 0 && <span>P: {stats.counts.pending.pairs}</span>}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-emerald-500">
                                            <CheckCircleIcon className="w-3 h-3"/> Sem Pendências
                                        </div>
                                    )}

                                    {(stats.counts.notStarted.questions + stats.counts.notStarted.gaps + stats.counts.notStarted.flashcards) > 0 && (
                                        <div className="flex items-center gap-2 text-slate-600 border-l border-white/10 pl-4">
                                            <span>Não Iniciados: {stats.counts.notStarted.questions + stats.counts.notStarted.gaps + stats.counts.notStarted.flashcards + stats.counts.notStarted.pairs}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                                <div className="flex flex-col items-end gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSmartAction(card, stats); }}
                                        disabled={disabled}
                                        className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
                                    >
                                        {buttonIcon} {buttonLabel}
                                    </button>
                                    {tooltip && <span className="text-[9px] font-mono text-slate-500">{tooltip}</span>}
                                    {!hasPending && !isNew && !isFuture && stats.nextReviewLabel && (
                                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                             <ClockIcon className="w-3 h-3"/> {stats.nextReviewLabel}
                                         </span>
                                    )}
                                </div>
                                
                                <div className="flex flex-col gap-2 border-l border-white/5 pl-4 ml-2 relative">
                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuCardId(openMenuCardId === card.id ? null : card.id); }} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all relative">
                                        <PaintBrushIcon className="w-4 h-4" />
                                        {/* Visual Menu Dropdown */}
                                        {openMenuCardId === card.id && (
                                            <VisualMenu 
                                                card={card} 
                                                onClose={() => setOpenMenuCardId(null)} 
                                                onUpdate={(updates) => handleVisualUpdate(card, updates)} 
                                            />
                                        )}
                                    </button>
                                    
                                    <button onClick={(e) => { e.stopPropagation(); setCardToEdit(card); }} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"><PencilIcon className="w-4 h-4" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setCardToDelete(card); }} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <ConfirmationModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={() => deleteCards([cardToDelete!.id])} title="Excluir Artigo?"><p>Deseja remover permanentemente <strong>{cardToDelete?.article}</strong>?</p></ConfirmationModal>
            {cardToEdit && <LiteralnessEditorModal isOpen={true} onClose={() => setCardToEdit(null)} card={cardToEdit} />}
            
            {/* Action Modals */}
            {activeQuestionSession && (
                <StudySessionModal 
                    isOpen={!!activeQuestionSession}
                    onClose={() => setActiveQuestionSession(null)}
                    title={activeQuestionSession.title}
                    questions={activeQuestionSession.questions}
                    context="session"
                    onSessionFinished={() => logDailyActivity('COMPLETE_QUESTIONS')}
                />
            )}
            
            {activeFlashcardSession && (
                <FlashcardStudySessionModal 
                    isOpen={!!activeFlashcardSession}
                    onClose={() => setActiveFlashcardSession(null)}
                    title={activeFlashcardSession.title}
                    cards={activeFlashcardSession.cards}
                    onSessionFinished={() => logDailyActivity('COMPLETE_FLASHCARDS')}
                />
            )}

            {activePairSession && (
                 <div className="fixed inset-0 z-[100] bg-[#020617]">
                     <PairMatchGame 
                        items={activePairSession.cards}
                        topicTitle={activePairSession.title}
                        pairCount={activePairSession.cards.length}
                        onRoundFinished={(result, updatedItems) => {
                            if (updatedItems.length > 0) {
                                updateBatchFlashcards(updatedItems.map(f => ({ id: f.id, ...f })));
                            }
                            logDailyActivity('PLAY_PAIR_MATCH');
                        }}
                        onExit={() => setActivePairSession(null)}
                        settings={settings}
                        cycleStats={{ total: activePairSession.cards.length, completed: 0 }}
                        isStudyMode={false}
                     />
                 </div>
            )}
        </div>
    );
};

export default LiteralnessLawMap;
