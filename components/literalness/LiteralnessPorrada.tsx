
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { LiteralnessCard } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import * as srs from '../../services/srsService';
import { LightningIcon, FireIcon, TrophyIcon, XMarkIcon } from '../icons';

interface LiteralnessPorradaProps {
    cards: LiteralnessCard[];
    onExit: () => void;
}

type GameState = 'playing' | 'gameover';

const INITIAL_TIME = 60;
const BONUS_TIME = 5;
const PENALTY_TIME = 5;
const SCORE_PER_CORRECT = 100;

// Helper to shuffle array
const shuffle = <T,>(array: T[]) => array.sort(() => Math.random() - 0.5);

const LiteralnessPorrada: React.FC<LiteralnessPorradaProps> = ({ cards, onExit }) => {
    const { settings, updateSettings, addXp } = useSettings();
    const [gameState, setGameState] = useState<GameState>('playing');
    
    // Game State
    const [queue, setQueue] = useState<LiteralnessCard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    
    // UI State
    const [showVariant, setShowVariant] = useState(false);
    const [lastFeedback, setLastFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [animating, setAnimating] = useState(false);

    // Refs
    const timerRef = useRef<number | null>(null);

    // Init
    useEffect(() => {
        // Prepare queue: Use cards that have content.
        // Shuffle them initially.
        // If queue runs out, we will reshuffle and reset index (Infinite mode).
        const validCards = cards.filter(c => c.phase1Full);
        if (validCards.length > 0) {
            setQueue(shuffle([...validCards]));
        } else {
            alert("Sem cartas suficientes para o Modo Porrada.");
            onExit();
        }
    }, [cards, onExit]);

    // Setup first card
    useEffect(() => {
        if (queue.length > 0) {
            prepareCardRound();
        }
    }, [currentIndex, queue]); // Depend on queue changes (reshuffle) too

    // Timer
    useEffect(() => {
        if (gameState === 'playing') {
            timerRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleGameOver();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState]);

    const prepareCardRound = () => {
        // Decide if we show original or variant
        // Only show variant if it exists and has content
        const currentCard = queue[currentIndex];
        const hasVariant = currentCard.phase3Variant && currentCard.phase3Variant.trim().length > 0;
        
        // 50/50 chance if variant exists, otherwise always original (easy points, but keeps flow)
        const showVar = hasVariant && Math.random() < 0.5;
        setShowVariant(showVar);
        setAnimating(false);
    };

    const handleGameOver = () => {
        setGameState('gameover');
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Check High Score
        const currentHigh = settings.literalnessHighScore || 0;
        if (score > currentHigh) {
            updateSettings({ literalnessHighScore: score });
            addXp(50, "Novo Recorde!");
            srs.playAchievementSound();
        } else {
            addXp(10, "Fim de Jogo");
        }
    };

    const handleAnswer = (userSaysModified: boolean) => {
        if (gameState !== 'playing' || animating) return;

        // "Original" means isVariantDisplayed is FALSE
        // "Alterado" means isVariantDisplayed is TRUE
        // Correct if User Choice matches Reality
        const isCorrect = userSaysModified === showVariant;

        if (isCorrect) {
            // Correct
            if (settings.enableSoundEffects) srs.playCorrectSound();
            setScore(s => s + SCORE_PER_CORRECT + (combo * 10));
            setTimeLeft(t => t + BONUS_TIME);
            setCombo(c => c + 1);
            setLastFeedback('correct');
        } else {
            // Wrong
            if (settings.enableSoundEffects) srs.playIncorrectSound();
            setTimeLeft(t => Math.max(0, t - PENALTY_TIME));
            setCombo(0);
            setLastFeedback('wrong');
        }

        setAnimating(true);
        setTimeout(() => {
            setLastFeedback(null);
            advanceQueue();
        }, 300); // Quick transition
    };

    const advanceQueue = () => {
        // If next index is out of bounds, reshuffle queue and reset index
        if (currentIndex + 1 >= queue.length) {
            setQueue(prev => shuffle([...prev]));
            setCurrentIndex(0);
        } else {
            setCurrentIndex(i => i + 1);
        }
    };

    const currentCard = queue[currentIndex];
    const displayText = currentCard ? (showVariant ? currentCard.phase3Variant : currentCard.phase3Original || currentCard.phase1Full) : "";

    // --- Render ---

    if (gameState === 'gameover') {
        return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[120] bg-slate-900 flex flex-col items-center justify-center p-6 animate-fade-in text-white">
                <div className="text-center max-w-sm w-full">
                    <div className="mb-8 relative inline-block">
                        <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
                        <div className="w-24 h-24 bg-gradient-to-br from-red-600 to-orange-600 rounded-3xl flex items-center justify-center relative z-10 shadow-2xl transform -rotate-6">
                            <LightningIcon className="w-12 h-12 text-white" />
                        </div>
                    </div>
                    
                    <h2 className="text-4xl font-black mb-2 uppercase italic tracking-tighter">Fim de Jogo!</h2>
                    <p className="text-slate-400 mb-8 font-medium">O tempo acabou.</p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sua Pontuação</span>
                            <span className="text-3xl font-black text-orange-500">{score}</span>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recorde</span>
                            <span className="text-3xl font-black text-yellow-500">{Math.max(score, settings.literalnessHighScore || 0)}</span>
                        </div>
                    </div>

                    <button 
                        onClick={onExit} 
                        className="w-full bg-white text-slate-900 font-black py-4 rounded-xl hover:scale-105 transition-transform shadow-xl"
                    >
                        Voltar
                    </button>
                </div>
            </div>,
            document.body
        );
    }

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[110] bg-slate-100 dark:bg-slate-950 flex flex-col h-[100dvh]">
            
            {/* Header / HUD */}
            <div className="shrink-0 px-6 py-4 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm relative z-10">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pontos</span>
                        <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{score}</span>
                    </div>
                    {combo > 1 && (
                        <div className="bg-orange-500 text-white text-xs font-black px-2 py-1 rounded rotate-2 shadow-sm animate-bounce-subtle">
                            {combo}x COMBO
                        </div>
                    )}
                </div>

                <div className={`text-4xl font-mono font-black tracking-tighter ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-white'}`}>
                    {timeLeft}<span className="text-sm opacity-50">s</span>
                </div>

                <button onClick={onExit} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors">
                    <XMarkIcon />
                </button>
            </div>

            {/* Time Bar */}
            <div className="shrink-0 w-full h-1.5 bg-slate-200 dark:bg-slate-800">
                <div 
                    className="h-full bg-orange-500 transition-all duration-1000 ease-linear" 
                    style={{ width: `${(timeLeft / INITIAL_TIME) * 100}%` }}
                ></div>
            </div>

            {/* Game Area - Center */}
            <div className="flex-1 flex flex-col justify-center items-center p-4 relative overflow-hidden">
                {/* Feedback Overlay */}
                {lastFeedback && (
                    <div className={`absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-20 ${lastFeedback === 'correct' ? 'bg-emerald-500' : 'bg-red-500 animate-error-shake'}`}></div>
                )}
                
                {lastFeedback === 'correct' && (
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 font-black text-6xl animate-success-pop z-20 pointer-events-none">
                        +5s
                    </div>
                )}
                {lastFeedback === 'wrong' && (
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 font-black text-6xl animate-error-shake z-20 pointer-events-none">
                        -5s
                    </div>
                )}

                {/* Card */}
                {currentCard && (
                    <div className={`w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-4 relative z-10 transition-transform duration-200 flex flex-col max-h-[65vh] ${lastFeedback === 'correct' ? 'border-emerald-500 scale-105' : lastFeedback === 'wrong' ? 'border-red-500 scale-95' : 'border-transparent'}`}>
                        <div className="shrink-0 p-6 pb-2 text-center border-b border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{currentCard.lawId} • {currentCard.article}</span>
                        </div>
                        
                        {/* Scrollable Text Area */}
                        <div className="overflow-y-auto custom-scrollbar flex-1 p-6 md:p-8">
                            <p className="text-lg md:text-2xl font-serif text-slate-800 dark:text-slate-100 leading-relaxed text-center font-medium">
                                {displayText}
                            </p>
                        </div>
                        
                        {/* Fade indicator for scrolling */}
                        <div className="shrink-0 h-4 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none rounded-b-3xl"></div>
                    </div>
                )}
            </div>

            {/* Controls - Bottom */}
            <div className="shrink-0 grid grid-cols-2 gap-4 p-4 pb-safe bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-20">
                <button 
                    onClick={() => handleAnswer(false)}
                    disabled={animating}
                    className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-lg font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95 flex flex-col items-center justify-center gap-1 touch-manipulation"
                >
                    <span>TEXTO ORIGINAL</span>
                    <span className="text-xs font-normal opacity-80 uppercase tracking-wide">Correto</span>
                </button>
                <button 
                    onClick={() => handleAnswer(true)}
                    disabled={animating}
                    className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-lg font-black py-4 rounded-2xl shadow-lg shadow-red-500/30 transition-all transform active:scale-95 flex flex-col items-center justify-center gap-1 touch-manipulation"
                >
                    <span>TEXTO ALTERADO</span>
                    <span className="text-xs font-normal opacity-80 uppercase tracking-wide">Incorreto / Armadilha</span>
                </button>
            </div>

        </div>,
        document.body
    );
};

export default LiteralnessPorrada;
