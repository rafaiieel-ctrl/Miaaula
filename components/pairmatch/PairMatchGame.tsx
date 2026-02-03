
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flashcard, GameResult, ItemGameStats, AppSettings } from '../../types';
import { ClockIcon, HeartSolidIcon, ChevronLeftIcon, BoltIcon, XMarkIcon } from '../icons';
import * as srs from '../../services/srsService';
import * as progressEngine from '../../services/progressEngine';
import { classifyPerformanceSrs } from '../../services/pairMatchService';

interface GameCard {
    id: string;
    pairId: string;
    text: string;
    type: 'front' | 'back';
    isFaceUp: boolean;
    isMatched: boolean;
    isPendingFlipBack: boolean;
    originalItem: Flashcard;
}

interface PairMatchGameProps {
    items: Flashcard[];
    topicTitle: string;
    onRoundFinished: (result: GameResult, updatedItems: Flashcard[]) => void;
    onExit: () => void;
    pairCount: number;
    settings: AppSettings;
    cycleStats: { total: number, completed: number };
    mode?: 'FRONT_BACK';
    isStudyMode?: boolean;
}

type GameState = 'playing' | 'gameover' | 'empty';

const PairMatchGame: React.FC<PairMatchGameProps> = ({ 
    items, 
    topicTitle, 
    onRoundFinished, 
    onExit, 
    settings,
    isStudyMode = false
}) => {
    const [gameState, setGameState] = useState<GameState>(items.length > 0 ? 'playing' : 'empty');
    const [board, setBoard] = useState<GameCard[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [livesLeft, setLivesLeft] = useState(isStudyMode ? 99 : 5);
    const [matchedPairsCount, setMatchedPairsCount] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [totalClicks, setTotalClicks] = useState(0);

    const itemStats = useRef<Map<string, { attempts: number, errors: number }>>(new Map());
    const startTimeRef = useRef(Date.now());
    const timerIntervalRef = useRef<number | null>(null);

    const handleReset = useCallback(() => {
        if (items.length === 0) return;
        setBoard([]);
        setMatchedPairsCount(0);
        setSelectedIds([]);
        setLivesLeft(isStudyMode ? 99 : 5);
        setElapsedTime(0);
        setTotalClicks(0);
        setGameState('playing');
        startTimeRef.current = Date.now();
    }, [isStudyMode, items.length]);

    useEffect(() => {
        if (items.length === 0) {
            setGameState('empty');
            return;
        }

        if (board.length > 0) return;

        itemStats.current.clear();
        items.forEach(item => itemStats.current.set(item.id, { attempts: 0, errors: 0 }));

        const gameCards: GameCard[] = [];
        items.forEach(item => {
            gameCards.push({ 
                id: `${item.id}-front`, 
                pairId: item.id, 
                text: item.front, 
                isFaceUp: isStudyMode,
                isMatched: false, 
                isPendingFlipBack: false,
                type: 'front',
                originalItem: item
            });
            gameCards.push({ 
                id: `${item.id}-back`, 
                pairId: item.id, 
                text: item.back, 
                isFaceUp: isStudyMode,
                isMatched: false, 
                isPendingFlipBack: false,
                type: 'back',
                originalItem: item
            });
        });

        for (let i = gameCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gameCards[i], gameCards[j]] = [gameCards[j], gameCards[i]];
        }

        setBoard(gameCards);
        timerIntervalRef.current = window.setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    }, [items, isStudyMode, board.length]);

    const finishGame = useCallback(() => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        
        const totalTime = (Date.now() - startTimeRef.current) / 1000;
        const avgTimePerPair = totalTime / Math.max(items.length, 1);
        const answers: { itemId: string; wasCorrect: boolean; rating: 0 | 1 | 2 | 3; timeSec: number }[] = [];

        items.forEach(item => {
            const rawStats = itemStats.current.get(item.id) || { attempts: 0, errors: 0 };
            const stats: ItemGameStats = {
                itemId: item.id,
                attempts: rawStats.attempts,
                errors: rawStats.errors,
                timeToMatchSec: avgTimePerPair + (rawStats.errors * 2)
            };
            
            const level = classifyPerformanceSrs(stats);
            const isCorrect = level > 0;
            
            answers.push({
                itemId: item.id,
                wasCorrect: isCorrect,
                rating: level,
                timeSec: stats.timeToMatchSec
            });
        });

        // Use Progress Engine to calculate new states
        const { updatedFlashcards } = progressEngine.processSessionResult(items, answers, null, settings);

        onRoundFinished({
            statsByItem: [], // Legacy field
            totalPairs: items.length,
            foundPairs: items.length,
            totalClicks: totalClicks,
            totalTimeSec: totalTime
        }, updatedFlashcards);
        
        onExit();
    }, [items, settings, onRoundFinished, totalClicks, onExit]);

    const checkPair = (id1: string, id2: string) => {
        setBoard(currentBoard => {
            const cardA = currentBoard.find(c => c.id === id1);
            const cardB = currentBoard.find(c => c.id === id2);
            if (!cardA || !cardB) return currentBoard;

            const isMatch = cardA.pairId === cardB.pairId;
            const stats = itemStats.current.get(cardA.pairId);
            if (stats) {
                stats.attempts++;
                if (!isMatch) stats.errors++;
            }

            if (isMatch) {
                if (settings.enableSoundEffects) srs.playCorrectSound();
                setMatchedPairsCount(prev => {
                    const newCount = prev + 1;
                    if (newCount === items.length) finishGame();
                    return newCount;
                });
                return currentBoard.map(c => (c.id === id1 || c.id === id2) ? { ...c, isMatched: true } : c);
            } else {
                if (settings.enableSoundEffects) srs.playIncorrectSound();
                if (!isStudyMode) {
                    setLivesLeft(prev => {
                        const next = prev - 1;
                        if (next <= 0) setGameState('gameover');
                        return next;
                    });
                    setTimeout(() => {
                        setBoard(prev => prev.map(c => (c.id === id1 || c.id === id2) && !c.isMatched ? { ...c, isFaceUp: false, isPendingFlipBack: false } : c));
                    }, 1000);
                    return currentBoard.map(c => (c.id === id1 || c.id === id2) ? { ...c, isPendingFlipBack: true, isFaceUp: true } : c);
                }
                return currentBoard;
            }
        });
    };

    const onCardClick = (cardId: string) => {
        if (gameState !== 'playing') return;
        const card = board.find(c => c.id === cardId);
        if (!card || card.isMatched || card.isPendingFlipBack) return;
        if (!isStudyMode && card.isFaceUp) return;

        setTotalClicks(tc => tc + 1);
        if (!isStudyMode) setBoard(prev => prev.map(c => c.id === cardId ? { ...c, isFaceUp: true } : c));

        setSelectedIds(prev => {
            if (prev.includes(cardId)) return prev;
            const next = [...prev, cardId];
            if (next.length === 2) {
                setTimeout(() => checkPair(next[0], next[1]), 250);
                return [];
            }
            return next;
        });
    };

    if (gameState === 'empty') {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617] text-white p-8">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <XMarkIcon className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Nenhum Par Encontrado</h3>
                <p className="text-slate-400 text-center max-w-xs mb-8">Esta aula não possui pares vinculados para o jogo de associação.</p>
                <button onClick={onExit} className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold">Voltar</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex flex-col h-full overflow-hidden bg-[#020617] font-sans text-slate-100">
            <div className="shrink-0 px-6 py-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl border-b border-white/10">
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <span className="text-[10px] font-black uppercase text-sky-500 tracking-widest block">Lei Seca • Fixação Ativa</span>
                        <h3 className="text-sm font-bold text-slate-200 truncate max-w-[200px]">{topicTitle}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-6 font-mono">
                    <div className="flex items-center gap-2 text-sky-400">
                        <ClockIcon className="w-5 h-5" />
                        <span className="text-lg font-bold">{elapsedTime}s</span>
                    </div>
                    {!isStudyMode && (
                        <div className="flex items-center gap-2 text-rose-500">
                            <HeartSolidIcon className="w-5 h-5" />
                            <span className="text-lg font-bold">{livesLeft}</span>
                        </div>
                    )}
                </div>
            </div>

            {gameState === 'playing' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 pb-40">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
                        {board.map((card) => {
                            const isSelected = selectedIds.includes(card.id);
                            const isFront = card.type === 'front';
                            
                            return (
                                <div 
                                    key={card.id}
                                    onClick={() => onCardClick(card.id)}
                                    className={`relative cursor-pointer group transition-all duration-300 rounded-[2rem] border-2 h-36 md:h-44 overflow-hidden
                                        ${card.isMatched ? 'opacity-20 grayscale scale-90 cursor-default' : 'hover:scale-[1.03] active:scale-95 shadow-2xl'}
                                        ${isSelected ? 'ring-4 ring-sky-500 border-sky-400 scale-105 z-20 shadow-sky-500/40' : ''}
                                        ${card.isPendingFlipBack ? 'border-rose-500 animate-error-shake' : ''}
                                        ${!isSelected && !card.isMatched ? (isFront ? 'bg-slate-900/60 border-sky-500/20' : 'bg-slate-900/60 border-emerald-500/20') : ''}
                                        ${isSelected ? (isFront ? 'bg-sky-500/20' : 'bg-emerald-500/20') : ''}
                                    `}
                                >
                                    <div className="absolute inset-0 backdrop-blur-sm bg-slate-900/40 group-hover:bg-transparent transition-colors"></div>
                                    
                                    <div className="relative z-10 h-full flex flex-col p-4 md:p-6 text-center justify-center items-center gap-1.5">
                                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${isFront ? 'text-sky-400 border-sky-400/30 bg-sky-400/5' : 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5'}`}>
                                            {isFront ? 'Pergunta' : 'Resposta'}
                                        </span>
                                        <p className="text-[11px] md:text-sm font-medium leading-tight text-slate-100 overflow-y-auto custom-scrollbar max-h-full">
                                            {card.text}
                                        </p>
                                    </div>
                                    <div className={`absolute -bottom-4 -right-4 w-12 h-12 rounded-full blur-xl opacity-20 ${isFront ? 'bg-sky-500' : 'bg-emerald-500'}`}></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {gameState === 'gameover' && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#020617] text-center animate-fade-in">
                    <div className="w-32 h-32 bg-rose-500/10 rounded-full flex items-center justify-center mb-8 border border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.2)]">
                        <span className="text-6xl animate-pulse">💔</span>
                    </div>
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">CICLO INTERROMPIDO</h2>
                    <p className="text-slate-400 max-w-sm mb-12">Suas tentativas esgotaram. Foque na leitura do artigo e tente novamente.</p>
                    <button onClick={onExit} className="bg-white text-slate-950 font-black py-4 px-12 rounded-2xl shadow-2xl hover:scale-105 active:scale-100 transition-all uppercase tracking-widest text-sm">
                        Voltar e Revisar
                    </button>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="shrink-0 p-6 pb-safe bg-slate-900/80 backdrop-blur-2xl border-t border-white/5 z-20">
                     <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
                        <button 
                            onClick={handleReset} 
                            className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest border border-white/5"
                        >
                            Resetar
                        </button>
                        <button 
                            onClick={onExit}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest shadow-xl shadow-sky-500/20"
                        >
                            Finalizar
                        </button>
                     </div>
                </div>
            )}
        </div>
    );
};

export default PairMatchGame;
