
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RetroGameType, GAME_CONFIGS, filterQuestionsByMode } from './retroUtils'; // Import Utils
import { useQuestionState, useQuestionDispatch } from '../../contexts/QuestionContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Question } from '../../types';
import * as srs from '../../services/srsService';
import { detectTrapFailure } from '../../services/trapscanService';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '../icons';
import { ensureQuestionOptions } from '../../services/questionParser';
import { retroAudio } from '../../services/retroAudioService'; // Import Audio Service
import { validateAnswer } from '../../services/answerValidationService'; // NEW

interface RetroGameRunnerProps {
    gameType: RetroGameType;
    onExit: () => void;
    crtEffect: boolean;
}

const RetroGameRunner: React.FC<RetroGameRunnerProps> = ({ gameType, onExit, crtEffect }) => {
    const allQuestions = useQuestionState();
    const { updateQuestion } = useQuestionDispatch();
    const { settings, addXp } = useSettings();
    
    // Find config
    const config = GAME_CONFIGS.find(c => c.id === gameType)!;
    const theme = { bg: 'bg-[#000510]', accent: config.color, border: config.border, button: config.button }; // Use config colors
    
    // Override BG specific per game if needed, or unify in config
    if (gameType === 'brick_break') theme.bg = 'bg-[#050510]';
    if (gameType === 'snake_sprint') theme.bg = 'bg-[#100505]';

    // Game State
    const [queue, setQueue] = useState<Question[]>([]);
    const [currentQIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [lives, setLives] = useState(3);
    const [gameState, setGameState] = useState<'loading' | 'playing' | 'feedback' | 'gameover'>('loading');
    
    // Feedback State
    const [feedback, setFeedback] = useState<{ isCorrect: boolean, correctKey: string, trapCode?: string } | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Initial Load with Filter
    useEffect(() => {
        const selected = filterQuestionsByMode(allQuestions, config.mode);
        const ready = selected.map(q => ensureQuestionOptions(q));
        setQueue(ready);
        setGameState('playing');
        retroAudio.play('START'); // Audio Feedback
    }, [allQuestions, config.mode]);

    const handleAnswer = (key: string) => {
        if (gameState !== 'playing') return;
        
        const currentQ = queue[currentQIndex];
        
        // Use Central Validator
        const { isCorrect } = validateAnswer(currentQ, key, 'RETRO_ARCADE');
        
        setSelectedOption(key);
        
        // Audio Feedback
        if (isCorrect) retroAudio.play('CORRECT');
        else retroAudio.play('WRONG');

        // SRS Calculation
        const timeTaken = 10; 
        let selfEval = isCorrect ? 3 : 0;
        const srsResult = srs.calculateNewSrsState(currentQ, isCorrect, selfEval, timeTaken, settings);

        // Trap Detection
        let trapCode: string | undefined;
        if (!isCorrect) {
            trapCode = detectTrapFailure(currentQ, key) || undefined;
        }

        // Update Question
        const updatedQ: Question = {
            ...currentQ,
            ...srsResult,
            yourAnswer: key,
            attemptHistory: [...(currentQ.attemptHistory || []), {
                date: srsResult.lastReviewedAt!,
                wasCorrect: isCorrect,
                masteryAfter: srsResult.masteryScore!,
                stabilityAfter: srsResult.stability,
                timeSec: timeTaken,
                selfEvalLevel: selfEval,
                trapCode
            }]
        };
        updateQuestion(updatedQ);

        // Game Logic
        if (isCorrect) {
            setScore(s => s + 100 + (streak * 10));
            setStreak(s => s + 1);
            if ((streak + 1) % 3 === 0) retroAudio.play('COMBO'); // Combo sound
        } else {
            setLives(l => l - 1);
            setStreak(0);
            retroAudio.play('DAMAGE');
        }

        setFeedback({ isCorrect, correctKey: currentQ.correctAnswer, trapCode });
        setGameState('feedback');
    };

    const handleNext = () => {
        if (lives <= 0) {
            setGameState('gameover');
            return;
        }
        
        if (currentQIndex < queue.length - 1) {
            setCurrentIndex(i => i + 1);
            setGameState('playing');
            setFeedback(null);
            setSelectedOption(null);
        } else {
            setGameState('gameover');
        }
    };

    if (gameState === 'loading') return <div className="bg-black text-green-500 font-mono p-10 h-full flex items-center justify-center">LOADING ROM...</div>;

    if (gameState === 'gameover') {
        return (
            <div className={`fixed inset-0 z-[200] bg-black font-mono text-white flex flex-col items-center justify-center ${crtEffect ? 'contrast-125' : ''}`}>
                <h1 className="text-6xl font-black text-red-500 mb-4 animate-pulse">GAME OVER</h1>
                <p className="text-xl mb-8 uppercase">Score: {score}</p>
                <div className="flex gap-4">
                    <button onClick={onExit} className="px-8 py-3 border-4 border-white hover:bg-white hover:text-black font-bold uppercase transition-colors">
                        Exit
                    </button>
                </div>
            </div>
        );
    }

    const currentQ = queue[currentQIndex];
    const qText = currentQ.questionText || "Erro no texto";
    
    // Determine visual elements based on GameType
    const TopVisual = () => {
        if (gameType === 'space_quiz') {
            return (
                <div className="flex justify-center gap-4 mb-4 opacity-50">
                    {[1,2,3].map(i => <div key={i} className="w-8 h-6 bg-green-500 clip-invader animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />)}
                </div>
            );
        }
        if (gameType === 'brick_break') {
            return (
                <div className="flex flex-wrap gap-1 mb-4 justify-center w-full max-w-md mx-auto opacity-50">
                    {Array.from({length: 12}).map((_, i) => (
                        <div key={i} className={`w-8 h-4 ${i < streak ? 'bg-transparent border border-cyan-500' : 'bg-cyan-500'}`} />
                    ))}
                </div>
            );
        }
        if (gameType === 'snake_sprint') {
            return (
                 <div className="w-full h-4 border-2 border-pink-500 mb-4 relative rounded-full overflow-hidden">
                     <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${Math.min(100, (streak * 10))}%` }}></div>
                 </div>
            );
        }
        return null;
    };

    return (
        <div className={`fixed inset-0 z-[150] flex flex-col ${theme.bg} text-white font-mono overflow-hidden ${crtEffect ? 'contrast-125' : ''}`}>
            
            {/* CRT Overlay */}
            {crtEffect && <div className="fixed inset-0 pointer-events-none z-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAuLDAsMCwwLjEpIi8+CjxwYXRoIGQ9Ik0wIDNMNCAzIiBzdHJva2U9InJnYmEoMCwwLDAsMC4yKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-30"></div>}

            {/* Header */}
            <div className={`p-4 border-b-4 ${theme.border} flex justify-between items-center bg-black/50 z-10`}>
                <div className="flex flex-col">
                    <span className={`block text-xs font-bold ${theme.accent} uppercase`}>Score</span>
                    <span className="text-2xl font-black leading-none">{score.toString().padStart(6, '0')}</span>
                </div>
                <div className="text-center">
                     <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">MODE</span>
                     <span className={`text-xs font-bold ${theme.accent} border ${theme.border} px-2 py-0.5 rounded`}>{config.label}</span>
                </div>
                <div className="flex gap-2">
                    {Array.from({length: lives}).map((_, i) => (
                        <div key={i} className={`w-4 h-4 ${theme.bg === 'bg-[#100505]' ? 'bg-pink-500' : theme.bg === 'bg-[#000510]' ? 'bg-green-500' : 'bg-cyan-500'} rounded-sm`}></div>
                    ))}
                </div>
                <button onClick={onExit}><XMarkIcon className={`w-8 h-8 ${theme.accent}`} /></button>
            </div>

            {/* Game Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col max-w-3xl mx-auto w-full relative z-10 custom-scrollbar">
                <TopVisual />
                
                <div className={`border-4 ${theme.border} p-6 rounded-xl bg-black/40 shadow-[0_0_20px_rgba(0,0,0,0.5)] mb-6`}>
                    <p className={`text-lg md:text-xl font-bold leading-relaxed ${theme.accent} whitespace-pre-wrap`}>
                        {qText}
                    </p>
                </div>

                {/* Options */}
                {!feedback && (
                    <div className="grid grid-cols-1 gap-4">
                        {Object.entries(currentQ.options).map(([key, val]) => val && (
                            <button
                                key={key}
                                onClick={() => handleAnswer(key)}
                                onMouseEnter={() => retroAudio.play('SELECT')}
                                className={`
                                    w-full text-left p-4 border-2 ${theme.border} rounded-lg 
                                    hover:bg-white/10 hover:translate-x-1 transition-transform
                                    flex gap-4 items-center group
                                `}
                            >
                                <span className={`font-black text-xl bg-white/10 w-8 h-8 flex items-center justify-center rounded ${theme.accent}`}>
                                    {key}
                                </span>
                                <span className="text-sm md:text-base font-bold uppercase">{val}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Feedback Mode */}
                {feedback && (
                    <div className="animate-fade-in space-y-6">
                        <div className={`p-4 border-4 ${feedback.isCorrect ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'} rounded-xl text-center`}>
                            <h2 className={`text-3xl font-black uppercase ${feedback.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                                {feedback.isCorrect ? 'CORRECT!' : 'MISS!'}
                            </h2>
                            {!feedback.isCorrect && (
                                <p className="mt-2 text-sm uppercase">Correct Answer: {feedback.correctKey}</p>
                            )}
                            {feedback.trapCode && (
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-black/40 rounded border border-red-500/50 text-red-400 font-bold text-xs uppercase">
                                    <ExclamationTriangleIcon className="w-3 h-3"/> Trap: {feedback.trapCode}
                                </div>
                            )}
                        </div>

                        {currentQ.explanation && (
                            <div className="border-2 border-white/20 p-4 rounded-xl bg-black/40 text-sm leading-relaxed text-gray-300">
                                <strong className={`${theme.accent} block mb-1 uppercase`}>INFO:</strong>
                                {currentQ.explanation}
                            </div>
                        )}

                        <button 
                            onClick={handleNext}
                            className={`w-full py-4 ${theme.accent} border-4 ${theme.border} font-black text-xl uppercase tracking-widest hover:bg-white/10 transition-colors rounded-xl`}
                        >
                            NEXT LEVEL &gt;&gt;
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .clip-invader {
                    clip-path: polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%);
                }
            `}</style>
        </div>
    );
};

export default RetroGameRunner;
