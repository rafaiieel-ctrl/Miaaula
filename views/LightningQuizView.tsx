
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Question, LiteralnessCard } from '../types';
import { useQuestionDispatch, useQuestionState } from '../contexts/QuestionContext';
import { useLiteralnessDispatch } from '../contexts/LiteralnessContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { 
    XMarkIcon, TrophyIcon, LightningIcon, CheckCircleIcon, FireIcon, 
    ClockIcon, BoltIcon, ListBulletIcon, ChevronLeftIcon, 
    BookOpenIcon, EyeIcon, FilterIcon, ExclamationTriangleIcon, TrashIcon
} from '../components/icons';
import { ensureQuestionOptions } from '../services/questionParser';
import PromptText from '../components/ui/PromptText';
import { validateAnswer } from '../services/answerValidationService';
import ConfirmationModal from '../components/ConfirmationModal';
import QuestionViewer from '../components/QuestionViewer';
import QuestionExplanationBlocks from '../components/QuestionExplanationBlocks';
import InteractiveQuestionModal from '../components/InteractiveQuestionModal';

// --- TYPES ---

interface LightningQuizViewProps {
    onExit: (score?: number, passed?: boolean, pendingCommits?: any[]) => void;
    preSelectedQuestions?: any[]; 
    isSurpriseMode?: boolean;
    disableInternalCommit?: boolean;
}

type ArcadeEntry = {
    score: number;
    dateISO: string;
    correct: number;
    wrong: number;
    bestStreak: number;
    durationSec: number;
};

type GamePhase = 'setup' | 'getReady' | 'playing' | 'gameover';

interface SessionHistoryItem {
    id: string;
    questionRef: string;
    text: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    points: number;
    streak: number;
    originalItem: Question; // STORE FULL REFERENCE FOR CONSULTATION
}

type FilterType = 'all' | 'correct' | 'wrong' | 'gaps' | 'questions';

// --- CONSTANTS ---

const START_TIME_SEC = 60; // 60s countdown
const TIME_GAIN_CORRECT = 5;
const TIME_LOSS_WRONG = 10;
const COMBO_BONUS_TIME = 60;
const COMBO_THRESHOLD = 6;

const PENALTY_SCORE = 150;
const BASE_SCORE = 100;
const LS_ARCADE_KEY = 'miaaula_arcade_ranking_v1';

// --- SUB-COMPONENTS ---

const OptionButton: React.FC<{
    optionKey: string;
    text: string;
    isSelected: boolean;
    isDisabled: boolean;
    isCorrect?: boolean;
    isWrong?: boolean;
    onSelect: () => void;
    isCe?: boolean;
}> = ({ optionKey, text, isSelected, isDisabled, isCorrect, isWrong, onSelect, isCe }) => {
    let baseClasses = "relative w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all duration-100 font-bold active:scale-[0.98] overflow-hidden group ";
    let colorClasses = "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-orange-500/50 hover:bg-slate-800";

    if (isSelected) {
        colorClasses = "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/40 z-10";
    } 
    
    if (isDisabled && isCorrect) {
        colorClasses = "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/40 z-10";
    } else if (isDisabled && isWrong && isSelected) {
        colorClasses = "bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/40 z-10 animate-error-shake";
    } else if (isDisabled) {
        colorClasses = "bg-slate-900 border-slate-800 text-slate-600 opacity-50";
    }

    if (isCe) {
        baseClasses += " flex flex-col items-center justify-center h-24 md:h-32 text-lg md:text-xl uppercase tracking-widest";
    } else {
        baseClasses += " flex items-start gap-3 md:gap-4 text-sm md:text-base";
    }

    return (
        <button onClick={onSelect} disabled={isDisabled} className={`${baseClasses} ${colorClasses}`}>
            {!isCe && (
                <span className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-lg text-[10px] md:text-xs font-black border-2 shrink-0 ${isSelected || (isDisabled && isCorrect) ? 'border-white text-white' : 'border-slate-600 text-slate-500 group-hover:border-orange-500 group-hover:text-orange-500'}`}>
                    {optionKey}
                </span>
            )}
            <span className="leading-snug">{isCe ? (optionKey === 'C' || optionKey === 'A' ? 'CERTO' : 'ERRADO') : text}</span>
            
            {(isDisabled && isCorrect) && <div className="absolute right-4 top-1/2 -translate-x-1/2"><CheckCircleIcon className="w-6 h-6 text-white" /></div>}
        </button>
    );
};

// --- CONSULTATION MODAL (READ-ONLY) ---
const ConsultModal: React.FC<{ 
    question: Question; 
    userAnswer: string;
    onClose: () => void; 
    onTrain: () => void; 
}> = ({ question, userAnswer, onClose, onTrain }) => {
    return (
        <div className="fixed inset-0 z-[11000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 w-full max-w-2xl h-[90vh] rounded-3xl shadow-2xl flex flex-col relative" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-indigo-500/10">
                    <div className="flex items-center gap-3">
                        <BookOpenIcon className="w-5 h-5 text-indigo-400" />
                        <div>
                            <span className="text-sm font-black text-indigo-300 uppercase tracking-widest block">Modo Consulta</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-black/30 px-2 py-0.5 rounded">Não registra tentativa</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"><XMarkIcon className="w-5 h-5"/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">{question.questionRef}</span>
                        {userAnswer && (
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-widest ${question.correctAnswer === userAnswer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                Você marcou: {userAnswer}
                            </span>
                        )}
                    </div>

                    {/* Viewer in Locked=False, Revealed=True Mode */}
                    <QuestionViewer 
                        question={question} 
                        selectedOption={question.correctAnswer} 
                        isRevealed={true} 
                        isLocked={false} // NEVER LOCK IN CONSULTATION
                        showMedia={true}
                        onOptionSelect={() => {}} // No-op
                    />
                    
                    <div className="border-t border-white/5 pt-6">
                         <QuestionExplanationBlocks 
                             question={question} 
                             userAnswer={userAnswer} 
                             showTitle={true} 
                         />
                    </div>
                </div>
                
                {/* Footer Actions */}
                <div className="p-5 border-t border-white/5 bg-slate-950 flex justify-between items-center gap-4">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-white/10 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-white hover:bg-white/5">Fechar</button>
                    <button 
                        onClick={onTrain} 
                        className="px-8 py-3 rounded-xl bg-sky-600 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:bg-sky-500 flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                        <BoltIcon className="w-4 h-4" /> Treinar Esta Questão Agora
                    </button>
                </div>
            </div>
        </div>
    );
};


const LightningQuizView: React.FC<LightningQuizViewProps> = ({ onExit, preSelectedQuestions, disableInternalCommit }) => {
    const { updateQuestion } = useQuestionDispatch();
    const { updateLiteralnessCardSrs } = useLiteralnessDispatch();
    const { settings, updateSettings, addXp } = useSettings();

    // --- GAME STATE ---
    const [phase, setPhase] = useState<GamePhase>('setup');
    const [gameQueue, setGameQueue] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(START_TIME_SEC);
    
    // --- ARCADE STATS ---
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [maxStreak, setMaxStreak] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [wrongCount, setWrongCount] = useState(0);
    const [questionsAnswered, setQuestionsAnswered] = useState(0);
    const [multiplier, setMultiplier] = useState(1);
    const [ranking, setRanking] = useState<ArcadeEntry[]>([]);
    const [isNewRecord, setIsNewRecord] = useState(false);
    
    // --- HISTORY & DETAILS ---
    const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    
    // --- REPORT FILTERS & CONSULTATION ---
    const [reportFilter, setReportFilter] = useState<FilterType>('all');
    const [consultingItem, setConsultingItem] = useState<{ q: Question, userAns: string } | null>(null);
    const [trainingItem, setTrainingItem] = useState<Question | null>(null); // For "Train Now"

    // --- MILESTONES ---
    // (Legacy milestones replaced by repetitive combo bonus, but keeping struct if needed for other badges)
    const [milestones, setMilestones] = useState({ hit1: false, hit3: false, hit6: false });

    // --- INTERACTION ---
    const [pendingCommits, setPendingCommits] = useState<any[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [startCountdown, setStartCountdown] = useState(3);
    const [eventFeed, setEventFeed] = useState<{ id: number, text: string, type: 'bonus' | 'penalty' | 'info' }[]>([]);
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
    
    // --- UI Control ---
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- REFS ---
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    // --- HELPERS: STORAGE ---
    const loadRanking = useCallback(() => {
        try {
            const raw = localStorage.getItem(LS_ARCADE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                setRanking(data || []);
                if (data.length > 0) setHighScore(data[0].score);
            }
        } catch (e) { console.error("Failed to load arcade ranking", e); }
    }, []);

    const saveRanking = useCallback((finalScore: number, stats: { correct: number, wrong: number, bestStreak: number, duration: number }) => {
        const entry: ArcadeEntry = {
            score: finalScore,
            dateISO: new Date().toISOString(),
            correct: stats.correct,
            wrong: stats.wrong,
            bestStreak: stats.bestStreak,
            durationSec: stats.duration
        };
        
        let newRanking = [...ranking, entry].sort((a, b) => b.score - a.score).slice(0, 5);
        
        if (finalScore > highScore) {
            setIsNewRecord(true);
            setHighScore(finalScore);
        }
        
        setRanking(newRanking);
        localStorage.setItem(LS_ARCADE_KEY, JSON.stringify(newRanking));
    }, [highScore, ranking]);

    // --- FEEDBACK ---
    const pushEvent = (text: string, type: 'bonus' | 'penalty' | 'info') => {
        const id = Date.now();
        setEventFeed(prev => [...prev.slice(-4), { id, text, type }]); // Keep last 5
        setTimeout(() => setEventFeed(prev => prev.filter(e => e.id !== id)), 2000);
    };
    
    // --- NORMALIZER ---
    const prepareQueue = (items: any[]) => {
        return items.map(item => {
            // FIX: Robust mapping for Gap properties to Question standards
            let correct = item.correctAnswer || item.correct_letter || item.correct || (item.payload?.correct_letter);
            let text = item.questionText || item.lacuna_text || item.q_text;
            let options = item.options || (item.payload?.options);
            
            return {
                ...item,
                questionText: text,
                // Ensure Correct Key is valid (A-E)
                correctAnswer: correct ? String(correct).toUpperCase().trim().charAt(0) : '',
                options: options || {}
            };
        }).filter(q => q.questionText && q.correctAnswer); // Filter out broken items
    };

    // --- INIT ---
    useEffect(() => {
        loadRanking();
        if (phase === 'setup') {
            if (!preSelectedQuestions || preSelectedQuestions.length === 0) return;
            
            // Normalize and Shuffle
            const normalized = prepareQueue(preSelectedQuestions);
            const queue = normalized
                .sort(() => Math.random() - 0.5)
                .map(item => item.isGapType ? item : ensureQuestionOptions(item));

            setGameQueue(queue);
            setPhase('getReady');
        }
    }, [phase, preSelectedQuestions, loadRanking]);

    // --- ESCAPE KEY HANDLER ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (consultingItem) {
                    setConsultingItem(null);
                } else if (showSummary) {
                    setShowSummary(false);
                } else if (phase === 'playing' || phase === 'getReady') {
                    setIsExitModalOpen(true);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [phase, consultingItem, showSummary]);

    // --- COUNTDOWN & TIMER ---
    useEffect(() => {
        if (phase === 'getReady') {
            if (startCountdown > 0) {
                const t = setTimeout(() => setStartCountdown(p => p - 1), 1000);
                return () => clearTimeout(t);
            } else {
                setPhase('playing');
                startTimeRef.current = Date.now();
            }
        }
    }, [phase, startCountdown]);

    useEffect(() => {
        if (phase === 'playing' && !isExitModalOpen) {
            timerRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        finishGame();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase, isExitModalOpen]);

    // --- GAME LOGIC ---

    const finishGame = () => {
        setPhase('gameover');
        if (timerRef.current) clearInterval(timerRef.current);
        
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        
        saveRanking(score, { 
            correct: correctCount, 
            wrong: wrongCount, 
            bestStreak: maxStreak, 
            duration 
        });

        if (!disableInternalCommit && score > 0) {
            pendingCommits.forEach(item => {
                 if (item.type === 'gap') updateLiteralnessCardSrs(item.card, 'good', item.progress);
                 else if (item.type === 'question') updateQuestion(item.q);
            });
            if (score > (settings.lightningHighScore || 0)) {
                updateSettings({ lightningHighScore: score });
            }
        }
        addXp(Math.floor(score / 10), "Sessão Arcade");
    };
    
    const moveToNext = () => {
        setIsProcessing(false);
        setFeedbackMsg(null);
        if (timeLeft <= 0) return;
        if (currentIndex >= gameQueue.length - 1) {
            finishGame();
        } else {
            setCurrentIndex(p => p + 1);
            setSelectedOption(null);
        }
    };

    const handleAnswer = (optionKey: string) => {
        if (selectedOption || phase !== 'playing' || isProcessing) return;
        setIsProcessing(true);
        setSelectedOption(optionKey);
        setQuestionsAnswered(prev => prev + 1);

        const currentItem = gameQueue[currentIndex];
        
        // SAFETY CHECK: Skip if gabarito invalid
        if (!currentItem.correctAnswer || !['A','B','C','D','E'].includes(currentItem.correctAnswer)) {
             pushEvent("ERRO GABARITO: Pular", 'info');
             setTimeout(moveToNext, 1000);
             return;
        }

        const { isCorrect } = validateAnswer(currentItem, optionKey, 'ARENA_MINUTO_PORRADA');
        
        // VISUAL FEEDBACK
        setFeedbackMsg(isCorrect 
            ? `Correto: ${currentItem.correctAnswer} ✅` 
            : `Marcou: ${optionKey} | Correto: ${currentItem.correctAnswer} ❌`
        );

        let movePoints = 0;
        let newStreak = streak;

        if (isCorrect) {
            if (settings.enableSoundEffects) srs.playCorrectSound();
            newStreak = streak + 1;
            setStreak(newStreak);
            if (newStreak > maxStreak) setMaxStreak(newStreak);
            
            const newMult = 1 + Math.floor(newStreak / 3);
            setMultiplier(newMult);
            if (newMult > multiplier) pushEvent(`COMBO x${newMult}!`, 'bonus');

            // --- TIME LOGIC: CORRECT ---
            let timeBonus = TIME_GAIN_CORRECT;
            let eventMsg = `+${TIME_GAIN_CORRECT}s`;

            // COMBO BONUS (Multiples of 6)
            if (newStreak > 0 && newStreak % COMBO_THRESHOLD === 0) {
                 timeBonus += COMBO_BONUS_TIME;
                 eventMsg = `🔥 COMBO ${newStreak}! +${timeBonus}s`;
                 pushEvent(eventMsg, 'bonus');
            } else {
                 pushEvent(eventMsg, 'bonus');
            }
            setTimeLeft(prev => prev + timeBonus);

            const speedBonus = Math.round(timeLeft * 2);
            let points = (BASE_SCORE * newMult) + speedBonus;
            
            const totalHits = correctCount + 1;
            setCorrectCount(totalHits); 

            // Legacy milestones points (can keep for score padding)
            if (totalHits === 1 && !milestones.hit1) { points += 250; setMilestones(m => ({ ...m, hit1: true })); }
            else if (totalHits === 3 && !milestones.hit3) { points += 500; setMilestones(m => ({ ...m, hit3: true })); }
            else if (totalHits === 6 && !milestones.hit6) { points += 1000; setMilestones(m => ({ ...m, hit6: true })); }
            
            setScore(s => s + points);
            movePoints = points;

            if (currentItem.isGapType) {
                const card = currentItem.parentCard as LiteralnessCard;
                setPendingCommits(prev => [...prev, { type: 'gap', card, progress: card.batteryProgress + 1 }]);
            } else {
                const srsResult = srs.calculateNewSrsState(currentItem, true, 3, 5, settings);
                const updatedQ = { ...currentItem, ...srsResult, lastWasCorrect: true, totalAttempts: (currentItem.totalAttempts || 0) + 1 };
                setPendingCommits(prev => [...prev, { type: 'question', q: updatedQ }]);
            }

        } else {
            if (settings.enableSoundEffects) srs.playIncorrectSound();
            
            // --- TIME LOGIC: WRONG ---
            setTimeLeft(prev => Math.max(0, prev - TIME_LOSS_WRONG));
            pushEvent(`-${TIME_LOSS_WRONG}s`, 'penalty');
            
            setWrongCount(w => w + 1);
            setStreak(0);
            newStreak = 0;
            setMultiplier(1);
            setScore(s => Math.max(0, s - PENALTY_SCORE));
            
            movePoints = -PENALTY_SCORE;
        }

        let correctDisplay = currentItem.correctAnswer;
        if (!currentItem.isGapType && currentItem.options) {
             correctDisplay = currentItem.correctAnswer;
        }

        setSessionHistory(prev => [...prev, {
            id: currentItem.id,
            questionRef: currentItem.questionRef || (currentItem.isGapType ? 'LACUNA' : 'QUESTÃO'),
            text: currentItem.questionText,
            userAnswer: optionKey,
            correctAnswer: correctDisplay,
            isCorrect,
            points: movePoints,
            streak: newStreak,
            originalItem: currentItem // Store ref for consultation
        }]);

        setTimeout(moveToNext, isCorrect ? 600 : 1500); 
    };

    // --- CONSULTATION LOGIC ---
    const handleConsult = (item: Question, userAns: string) => {
        setConsultingItem({ q: item, userAns });
    };

    const handleTrainNow = () => {
        if (!consultingItem) return;
        const targetQ = consultingItem.q;
        setConsultingItem(null); // Close consult first
        setTimeout(() => {
             setTrainingItem(targetQ); // Open Training
        }, 100);
    };

    // --- FILTERED HISTORY ---
    const filteredHistory = useMemo(() => {
        let items = sessionHistory;
        
        // Filter
        if (reportFilter === 'wrong') items = items.filter(i => !i.isCorrect);
        else if (reportFilter === 'correct') items = items.filter(i => i.isCorrect);
        else if (reportFilter === 'gaps') items = items.filter(i => i.questionRef.includes('LACUNA') || i.originalItem.isGapType);
        else if (reportFilter === 'questions') items = items.filter(i => !i.questionRef.includes('LACUNA') && !i.originalItem.isGapType);

        // Sort (If 'wrong' is active, sort by penalty/severity)
        if (reportFilter === 'wrong') {
             return items.sort((a, b) => a.points - b.points); // Negative first (e.g. -150 before -50)
        }
        
        return items; // Default order (chronological)
    }, [sessionHistory, reportFilter]);

    // Counts for chips
    const counts = useMemo(() => {
        return {
            all: sessionHistory.length,
            correct: sessionHistory.filter(i => i.isCorrect).length,
            wrong: sessionHistory.filter(i => !i.isCorrect).length,
            gaps: sessionHistory.filter(i => i.originalItem.isGapType).length,
            questions: sessionHistory.filter(i => !i.originalItem.isGapType).length
        };
    }, [sessionHistory]);

    // --- RENDERERS ---

    if (phase === 'setup' && (!preSelectedQuestions || preSelectedQuestions.length === 0)) {
        return (
            <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
                <LightningIcon className="w-16 h-16 text-slate-700 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Sem Questões</h3>
                <button onClick={() => onExit(0, false)} className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold">Voltar</button>
            </div>
        );
    }

    if (phase === 'getReady') {
        return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center animate-fade-in-up select-none overflow-hidden bg-slate-950">
                <button onClick={() => setIsExitModalOpen(true)} className="absolute top-safe-top left-4 z-50 text-slate-600 hover:text-white flex items-center gap-2 font-bold uppercase tracking-widest text-xs p-2">
                    <ChevronLeftIcon className="w-5 h-5" /> Sair
                </button>
                <div className="relative z-10 flex flex-col items-center text-center">
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-orange-400 to-red-600 mb-10 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                        ARCADE MODE
                    </h1>
                    <div key={startCountdown} className="text-[12rem] font-black text-white leading-none drop-shadow-[0_0_40px_rgba(249,115,22,0.8)] animate-success-pop tabular-nums">
                        {startCountdown}
                    </div>
                </div>
                <ConfirmationModal isOpen={isExitModalOpen} onClose={() => setIsExitModalOpen(false)} onConfirm={() => onExit(0, false)} title="Cancelar Partida?">
                    <p>O progresso desta sessão será perdido.</p>
                </ConfirmationModal>
            </div>,
            document.body
        );
    }

    if (phase === 'playing' && gameQueue.length > currentIndex) {
        const item = gameQueue[currentIndex];
        const isGap = !!item.isGapType;
        const textToDisplay = item.questionText || item.lacuna_text || item.q_text || "Texto não disponível";
        
        let ceKeys: string[] | null = null;
        if (!isGap) {
            if (item.options.C === 'Certo' && item.options.E === 'Errado') ceKeys = ['C', 'E'];
            else if (item.options.A?.toLowerCase() === 'certo' && item.options.B?.toLowerCase() === 'errado') ceKeys = ['A', 'B'];
        }
        const optionKeys = ceKeys || ['A', 'B', 'C', 'D', 'E'];
        const isUrgent = timeLeft <= 10;
        
        const nextBonusIn = COMBO_THRESHOLD - (streak % COMBO_THRESHOLD);

        return ReactDOM.createPortal(
            <div className="fixed inset-0 bg-[#020617] z-[10000] flex flex-col overflow-hidden animate-fade-in">
                <div className="shrink-0 p-4 pt-safe-top bg-slate-900/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-20 shadow-xl relative">
                    <div className="absolute top-4 left-4 z-50">
                        <button onClick={() => setIsExitModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-white/10 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg">
                            <ChevronLeftIcon className="w-4 h-4" /> SAIR
                        </button>
                    </div>

                    <div className="flex flex-col items-start w-24 pl-20 md:pl-0">
                        <div className="flex items-center gap-1">
                            <FireIcon className={`w-5 h-5 ${streak >= 3 ? 'text-orange-500 animate-pulse' : 'text-slate-700'}`} />
                            <span className={`text-xl font-black italic ${streak >= 3 ? 'text-orange-400' : 'text-slate-600'}`}>x{multiplier}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">COMBO {streak}</span>
                    </div>

                    <div className={`flex flex-col items-center transition-transform ${isUrgent ? 'scale-110' : ''}`}>
                        <span className={`text-5xl font-mono font-black tracking-tighter leading-none tabular-nums drop-shadow-lg ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {timeLeft}
                        </span>
                    </div>

                    <div className="flex flex-col items-end w-24">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">HI: {Math.max(score, highScore)}</span>
                        <span className="text-2xl font-black text-sky-400 tabular-nums">{score}</span>
                    </div>
                    
                    {/* Next Bonus Indicator */}
                    <div className="absolute top-[80%] left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                        {streak > 0 ? `BÔNUS EM: ${nextBonusIn}` : 'ACERTE PARA COMBO'}
                    </div>

                    <div className="absolute top-full left-0 w-full flex flex-col items-center pointer-events-none pt-4 space-y-2">
                        {eventFeed.map(ev => (
                            <div key={ev.id} className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg animate-float-up ${ev.type === 'bonus' ? 'bg-emerald-500 text-white' : ev.type === 'penalty' ? 'bg-red-500 text-white' : 'bg-slate-800 text-sky-400 border border-sky-500/30'}`}>
                                {ev.text}
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Feedback Toast */}
                {feedbackMsg && (
                    <div className={`absolute top-28 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold shadow-2xl border ${feedbackMsg.includes('❌') ? 'bg-rose-600 text-white border-rose-500' : 'bg-emerald-600 text-white border-emerald-500'} animate-bounce-subtle pointer-events-none`}>
                         {feedbackMsg}
                    </div>
                )}

                <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto p-4 pb-20 relative z-10">
                    <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 bg-slate-900/50 border border-white/5 rounded-2xl p-6 shadow-inner flex flex-col justify-center text-center">
                         <div className="font-medium text-slate-100 text-lg md:text-2xl leading-relaxed">
                             <PromptText text={textToDisplay} mode="gap" />
                         </div>
                    </div>
                    <div className={`grid gap-2 shrink-0 ${ceKeys ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {optionKeys.map(key => {
                            const text = item.options[key];
                            if (!text && !ceKeys) return null;
                            return <OptionButton key={key} optionKey={key} text={text || ''} isCe={!!ceKeys} isSelected={selectedOption === key} isDisabled={!!selectedOption || isProcessing} isCorrect={key === item.correctAnswer} isWrong={key !== item.correctAnswer} onSelect={() => handleAnswer(key)} />;
                        })}
                    </div>
                </div>
                
                <ConfirmationModal isOpen={isExitModalOpen} onClose={() => setIsExitModalOpen(false)} onConfirm={() => onExit(score, false, pendingCommits)} title="Sair do Minuto de Porrada?"><p>Seus pontos atuais serão salvos, mas você perderá o bônus de combo atual.</p></ConfirmationModal>
            </div>,
            document.body
        );
    }

    if (phase === 'gameover') {
        return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[10000] bg-slate-950 overflow-y-auto custom-scrollbar animate-fade-in flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 z-10"></div>
                    
                    {showSummary ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
                                <button onClick={() => setShowSummary(false)} className="p-2 -ml-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <h3 className="font-black text-lg text-white uppercase tracking-tight">RELATÓRIO DA PARTIDA</h3>
                                <div className="w-8"></div>
                            </div>

                            {/* FILTERS BAR */}
                            <div className="px-4 py-3 bg-slate-950 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
                                {[
                                    { id: 'all', label: 'Todas', count: counts.all },
                                    { id: 'wrong', label: 'Erradas', count: counts.wrong, color: 'text-rose-400' },
                                    { id: 'correct', label: 'Certas', count: counts.correct, color: 'text-emerald-400' },
                                    { id: 'gaps', label: 'Lacunas', count: counts.gaps },
                                    { id: 'questions', label: 'Questões', count: counts.questions }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setReportFilter(f.id as FilterType)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${reportFilter === f.id ? 'bg-sky-600 border-sky-500 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}
                                    >
                                        <span className={reportFilter !== f.id ? f.color : ''}>{f.label} ({f.count})</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {filteredHistory.length === 0 && (
                                    <div className="text-center py-10 text-slate-500 text-xs">
                                        {sessionHistory.length === 0 ? "Sem dados nesta partida." : "Nenhum item neste filtro."}
                                    </div>
                                )}
                                {filteredHistory.map((item, idx) => (
                                    <div key={idx} className={`p-4 rounded-2xl border ${item.isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.questionRef}</span>
                                            <span className={`text-xs font-black ${item.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {item.points > 0 ? `+${item.points}` : item.points}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 line-clamp-2 mb-3 font-medium">{item.text}</p>
                                        
                                        <div className="mb-3 flex gap-2">
                                            <button 
                                                onClick={() => handleConsult(item.originalItem, item.userAnswer)}
                                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1 uppercase tracking-widest transition-all"
                                            >
                                                <BookOpenIcon className="w-3 h-3" /> Consultar
                                            </button>
                                        </div>
                                        
                                        <div className="flex gap-4 text-[10px] uppercase font-bold border-t border-white/5 pt-2">
                                            <span className="text-rose-400">Você: {item.userAnswer}</span>
                                            <span className="text-emerald-400">Correto: {item.correctAnswer}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center relative z-10 overflow-y-auto custom-scrollbar">
                            {isNewRecord && <div className="inline-block bg-yellow-500 text-yellow-950 font-black text-xs px-3 py-1 rounded-full mb-4 animate-bounce uppercase tracking-widest shadow-lg shadow-yellow-500/50">New Record!</div>}
                            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-1 drop-shadow-lg">GAME OVER</h2>
                            <div className="my-8 py-6 bg-slate-800/50 rounded-3xl border border-white/5">
                                <span className="block text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Final Score</span>
                                <span className="text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-md">{score}</span>
                                <div className="grid grid-cols-3 gap-2 mt-6 px-4">
                                    <div className="flex flex-col items-center"><TrophyIcon className="w-4 h-4 text-yellow-500 mb-1"/><span className="text-[10px] text-slate-500 uppercase font-bold">Best</span><span className="text-lg font-bold text-yellow-400">{Math.max(score, highScore)}</span></div>
                                    <div className="flex flex-col items-center border-x border-white/5"><FireIcon className="w-4 h-4 text-orange-500 mb-1"/><span className="text-[10px] text-slate-500 uppercase font-bold">Combo</span><span className="text-lg font-bold text-orange-400">{maxStreak}</span></div>
                                    <div className="flex flex-col items-center"><BoltIcon className="w-4 h-4 text-sky-500 mb-1"/><span className="text-[10px] text-slate-500 uppercase font-bold">Acertos</span><span className="text-lg font-bold text-sky-400">{correctCount}</span></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <button onClick={() => { setPhase('setup'); setScore(0); setTimeLeft(START_TIME_SEC); setCorrectCount(0); setWrongCount(0); setStreak(0); setMaxStreak(0); setQuestionsAnswered(0); setMultiplier(1); setMilestones({ hit1: false, hit3: false, hit6: false }); setIsNewRecord(false); setSessionHistory([]); setShowSummary(false); }} className="w-full bg-white text-slate-900 font-black py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-sm shadow-xl">Jogar Novamente</button>
                                <button onClick={() => setShowSummary(true)} className="w-full bg-slate-800/50 border border-white/10 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-800 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"><ListBulletIcon className="w-4 h-4" /> Detalhes da Partida</button>
                                <button onClick={() => onExit(score, true, pendingCommits)} className="w-full text-slate-500 font-bold py-3 hover:text-white transition-colors text-xs uppercase tracking-widest">Sair</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* CONSULTATION MODAL */}
                {consultingItem && (
                    <ConsultModal 
                        question={consultingItem.q} 
                        userAnswer={consultingItem.userAns}
                        onClose={() => setConsultingItem(null)} 
                        onTrain={handleTrainNow}
                    />
                )}
                
                {/* TRAINING MODAL (REAL ATTEMPT) */}
                {trainingItem && (
                    <InteractiveQuestionModal
                        question={trainingItem}
                        onClose={() => setTrainingItem(null)}
                        onQuestionAnswered={() => {}} // No-op in this context, just save attempt
                        context="orbital"
                    />
                )}
            </div>,
            document.body
        );
    }

    return null;
};

export default LightningQuizView;
