
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Flashcard, StudyRef } from '../types';
import { useFlashcardDispatch } from '../contexts/FlashcardContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon, RefreshIcon, LightBulbIcon, PencilIcon, CheckCircleIcon, ClipboardDocumentCheckIcon } from './icons';
import StudyRefLink from './StudyRefLink';

interface FlashcardStudySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  cards: Flashcard[];
  onSessionFinished?: (updatedCards?: Flashcard[]) => void;
  onStudyRefNavigate?: (ref: StudyRef) => void;
}

const FlashcardStudySessionModal: React.FC<FlashcardStudySessionModalProps> = ({ isOpen, onClose, title, cards, onSessionFinished, onStudyRefNavigate }) => {
    const { updateFlashcard, updateBatchFlashcards } = useFlashcardDispatch();
    const { settings, addXp } = useSettings();
    
    const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [cardStartTime, setCardStartTime] = useState<number>(0);
    const [finished, setFinished] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    
    const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
    const [sessionUpdates, setSessionUpdates] = useState<Flashcard[]>([]);

    useEffect(() => {
        if (isOpen && !isInitialized) {
            // FIX: Removida a verificação cards.length > 0 para garantir que o estado always inicialize
            // Se cards vier vazio, sessionQueue será vazio e trataremos na renderização
            setSessionQueue(cards);
            setCurrentIndex(0);
            setFinished(false);
            setIsFlipped(false);
            setAnsweredIds(new Set());
            setSessionUpdates([]);
            setCardStartTime(Date.now());
            setIsInitialized(true);
        } else if (!isOpen) {
            setIsInitialized(false);
            setSessionQueue([]);
        }
    }, [isOpen, cards, isInitialized]);

    const handleFinish = useCallback(() => {
        // Commit batch to Context
        if (sessionUpdates.length > 0) {
            updateBatchFlashcards(sessionUpdates.map(fc => ({ id: fc.id, ...fc })));
        }
        
        // Signal Parent
        if (onSessionFinished) {
            onSessionFinished(sessionUpdates);
        }
        
        onClose();
    }, [sessionUpdates, updateBatchFlashcards, onSessionFinished, onClose]);

    useEffect(() => {
        if (finished && isOpen) {
            const timer = setTimeout(() => {
                handleFinish();
            }, 1500); 
            return () => clearTimeout(timer);
        }
    }, [finished, isOpen, handleFinish]);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleNext = useCallback(() => {
        if (currentIndex < sessionQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
            setCardStartTime(Date.now());
        } else if (answeredIds.size === sessionQueue.length) {
            setFinished(true);
        }
    }, [currentIndex, sessionQueue.length, answeredIds]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
            setCardStartTime(Date.now());
        }
    }, [currentIndex]);

    const handleRate = (rating: 'again' | 'hard' | 'good' | 'easy') => {
        if (!isFlipped || finished) return;
        
        const currentCard = sessionQueue[currentIndex];
        
        if (answeredIds.has(currentCard.id)) {
            handleNext();
            return;
        }

        const timeTaken = (Date.now() - cardStartTime) / 1000;
        
        let evalLevel: 0 | 1 | 2 | 3 = 1;
        let isCorrect = true;

        switch (rating) {
            case 'again': evalLevel = 0; isCorrect = false; break;
            case 'hard': evalLevel = 1; break;
            case 'good': evalLevel = 2; break;
            case 'easy': evalLevel = 3; break;
        }

        if (settings.enableSoundEffects) {
            isCorrect ? srs.playCorrectSound() : srs.playIncorrectSound();
        }

        if (isCorrect) addXp(5, "Flashcard");

        const srsResult = srs.calculateNewSrsState(currentCard, isCorrect, evalLevel, timeTaken, settings);

        const updatedCard: Flashcard = {
            ...currentCard,
            ...srsResult,
            totalAttempts: (currentCard.totalAttempts || 0) + 1,
            correctStreak: isCorrect ? (currentCard.correctStreak || 0) + 1 : 0,
            attemptHistory: [
                ...(currentCard.attemptHistory || []),
                {
                    date: srsResult.lastReviewedAt!,
                    wasCorrect: isCorrect,
                    masteryAfter: srsResult.masteryScore!,
                    stabilityAfter: srsResult.stability,
                    timeSec: Math.round(timeTaken),
                    selfEvalLevel: evalLevel,
                    timingClass: srsResult.timingClass,
                    targetSec: srsResult.targetSec
                }
            ]
        };

        // Add to batch
        setSessionUpdates(prev => [...prev, updatedCard]);
        
        // Update context immediately (for safety/persistence), 
        // but rely on batch for parent notification
        updateFlashcard(updatedCard);
        
        setAnsweredIds(prev => new Set(prev).add(currentCard.id));

        if (currentIndex < sessionQueue.length - 1) {
            handleNext();
        } else {
            setFinished(true);
        }
    };
    
    if (!isOpen) return null;

    // FIX: Se inicializou mas a fila está vazia, mostra mensagem amigável ao invés de travar
    if (isInitialized && sessionQueue.length === 0) {
         return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                 <div className="bg-slate-900 p-8 rounded-2xl border border-white/10 text-center max-w-sm w-full">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardDocumentCheckIcon className="w-8 h-8 text-slate-500"/>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Sem Cartas</h3>
                    <p className="text-slate-400 mb-6 text-sm">Não há flashcards disponíveis para esta sessão no momento.</p>
                    <button onClick={onClose} className="w-full px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">Voltar</button>
                 </div>
            </div>,
            document.body
        );
    }

    const currentCard = sessionQueue[currentIndex];
    const isAnswered = currentCard && answeredIds.has(currentCard.id);

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            {finished ? (
                <div className="text-center animate-success-pop">
                    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30">
                        <CheckCircleIcon className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2">Sessão Concluída!</h2>
                    <p className="text-slate-400">Flashcards atualizados.</p>
                </div>
            ) : currentCard ? (
                <div className="w-full max-w-2xl h-full max-h-[85vh] flex flex-col" key={currentCard.id}>
                    <header className="flex justify-between items-center mb-4 shrink-0">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-white font-black text-xl">{currentIndex + 1} <span className="text-slate-600">/ {sessionQueue.length}</span></p>
                                {isAnswered && (
                                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                                        <CheckCircleIcon className="w-3 h-3"/> Respondido
                                    </span>
                                )}
                                {(currentCard.studyRefs || []).length > 0 && onStudyRefNavigate && (
                                    <StudyRefLink refs={currentCard.studyRefs || []} onNavigate={onStudyRefNavigate} />
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </header>

                    <div className="flex gap-2 mb-6">
                        <button 
                            onClick={handlePrev} 
                            disabled={currentIndex === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            <ChevronLeftIcon className="w-4 h-4" /> Anterior
                        </button>
                        <button 
                            onClick={handleFlip} 
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            <RefreshIcon className="w-4 h-4" /> {isFlipped ? 'Ver Frente' : 'Ver Verso'}
                        </button>
                        <button 
                            onClick={handleNext} 
                            disabled={currentIndex === sessionQueue.length - 1 && !isAnswered}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            Próximo <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 relative perspective-1000 group cursor-pointer" onClick={handleFlip}>
                        <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
                            
                            <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-900 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl border-2 border-slate-200 dark:border-white/10">
                                <span className="absolute top-6 left-6 text-xs font-black text-sky-500 uppercase tracking-widest bg-sky-500/10 px-3 py-1 rounded-lg">Frente</span>
                                {currentCard.frontImage && (
                                    <img src={currentCard.frontImage} alt="Front" className="max-h-40 mb-6 rounded-lg object-contain" />
                                )}
                                <p className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                                    {currentCard.front}
                                </p>
                                {currentCard.frontAudio && currentCard.frontAudio.trim() && (
                                    <audio controls src={currentCard.frontAudio} className="mt-6 w-full max-w-xs h-8 opacity-70 hover:opacity-100" />
                                )}
                                <div className="absolute bottom-6 text-xs text-slate-400 font-medium animate-pulse">
                                    Toque ou Espaço para virar
                                </div>
                            </div>

                            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-50 dark:bg-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl border-2 border-emerald-500/30">
                                <span className="absolute top-6 left-6 text-xs font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg">Verso</span>
                                {currentCard.backImage && (
                                    <img src={currentCard.backImage} alt="Back" className="max-h-40 mb-6 rounded-lg object-contain" />
                                )}
                                <p className="text-xl md:text-2xl font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                                    {currentCard.back}
                                </p>
                                {currentCard.backAudio && currentCard.backAudio.trim() && (
                                    <audio controls src={currentCard.backAudio} className="mt-6 w-full max-w-xs h-8 opacity-70 hover:opacity-100" />
                                )}
                                {currentCard.comments && (
                                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10 w-full text-left">
                                        <div className="flex items-center gap-2 mb-2 text-amber-500">
                                            <PencilIcon className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Notas</span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">{currentCard.comments}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`mt-8 h-24 transition-all duration-500 ${isFlipped && !isAnswered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                        <div className="grid grid-cols-4 gap-3 h-full">
                            <button onClick={() => handleRate('again')} className="rounded-2xl bg-rose-500/10 border-2 border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1">
                                <span>Errei</span>
                                <span className="text-[10px] opacity-60 font-mono">&lt; 1min</span>
                            </button>
                            <button onClick={() => handleRate('hard')} className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1">
                                <span>Difícil</span>
                                <span className="text-[10px] opacity-60 font-mono">~2d</span>
                            </button>
                            <button onClick={() => handleRate('good')} className="rounded-2xl bg-sky-500/10 border-2 border-sky-500/50 text-sky-500 hover:bg-sky-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1">
                                <span>Bom</span>
                                <span className="text-[10px] opacity-60 font-mono">~4d</span>
                            </button>
                            <button onClick={() => handleRate('easy')} className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1">
                                <span>Fácil</span>
                                <span className="text-[10px] opacity-60 font-mono">~7d</span>
                            </button>
                        </div>
                    </div>
                    
                    {isAnswered && (
                         <div className="mt-8 h-24 flex items-center justify-center animate-fade-in">
                            <button 
                                onClick={handleNext}
                                className="px-10 py-4 bg-white text-slate-950 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest text-sm"
                            >
                                {currentIndex === sessionQueue.length - 1 ? 'Finalizar Sessão' : 'Próximo Card'}
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                         </div>
                    )}
                </div>
            ) : (
                // Fallback de carregamento melhorado
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <div className="w-12 h-12 border-4 border-slate-700 border-t-white rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Preparando Cards...</p>
                </div>
            )}
        </div>,
        document.getElementById('modal-root') || document.body
    );
};

export default FlashcardStudySessionModal;
