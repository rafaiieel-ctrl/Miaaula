
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Question } from '../../types';
import { useQuestionState, useQuestionDispatch } from '../../contexts/QuestionContext';
import { useSettings } from '../../contexts/SettingsContext';
import { XMarkIcon, BoltIcon, FireIcon, ClockIcon, TrophyIcon, ExclamationTriangleIcon, StarSolidIcon, ArrowPathIcon, BookOpenIcon, PlayIcon, CheckCircleIcon, InfoIcon } from '../icons';
import { retroAudio } from '../../services/retroAudioService';
import { normalizeDiscipline } from '../../services/taxonomyService';
import PromptText from '../ui/PromptText';
import { deriveTrapscanRequired, TRAP_REQ_DEFS, TrapType } from '../../services/trapscanService'; // NEW IMPORT
import * as srs from '../../services/srsService';

// --- TYPES ---

interface TrapscanReactorProProps {
    onExit: () => void;
    crtEffect: boolean;
}

type GameMode = 'QUICK' | 'FIX' | 'DAILY';
type GamePhase = 'MENU' | 'PLAYING' | 'FEEDBACK' | 'SHIFT' | 'GAMEOVER';
type RoundStage = 'COMMAND' | 'TRAP';

type CommandType = 'CORRECT' | 'INCORRECT' | 'EXCEPT' | 'JUDGMENT';

interface RoundData {
    question: Question;
    correctCommand: CommandType;
    correctTrap: TrapType;
    excerpt: string;
    isTrapFocus: boolean; // Is this a targeted training question?
}

interface TrapMastery {
    [key: string]: number; // 0 to 100
}

// --- CONSTANTS ---
// Re-map colors to match service
const TRAP_CONFIG: Record<TrapType, { label: string; color: string; hint: string; tip: string }> = {
    'T': { label: 'TERMO ABSOLUTO', color: 'bg-red-500', hint: 'Palavras: sempre, nunca, apenas.', tip: 'Desconfie de generalizações.' },
    'R': { label: 'RESTRIÇÃO', color: 'bg-orange-500', hint: 'Palavras: exceto, salvo, vedado.', tip: 'O comando pede a exceção.' },
    'A': { label: 'COMPETÊNCIA', color: 'bg-blue-500', hint: 'Quem pode fazer? Autoridade.', tip: 'Confira o sujeito ativo.' },
    'P': { label: 'PRAZO/TEMPO', color: 'bg-green-500', hint: 'Datas, prescrição, vigência.', tip: 'Números são alvos fáceis.' },
    'S': { label: 'SEMÂNTICA', color: 'bg-purple-500', hint: 'Definições, conceitos, natureza.', tip: 'Troca de conceitos parecidos.' },
    'C': { label: 'JURISPRUDÊNCIA', color: 'bg-yellow-500', hint: 'STF, STJ, Súmula, Entendimento.', tip: 'Conflito lei vs tribunal.' },
    'A2': { label: 'PEGADINHA', color: 'bg-slate-500', hint: 'Inversão ou distrator sutil.', tip: 'Leia até a última palavra.' },
    'N': { label: 'NEGAÇÃO', color: 'bg-pink-500', hint: 'Não / Incorreto', tip: 'Cuidado com negativas.' },
    'SEM_DADO': { label: '?', color: 'bg-gray-500', hint: 'Sem classificação', tip: '...' },
};

const COMMAND_BTNS: { id: CommandType; label: string; color: string }[] = [
    { id: 'CORRECT', label: '✅ CORRETA', color: 'bg-emerald-600 border-emerald-500' },
    { id: 'INCORRECT', label: '❌ INCORRETA', color: 'bg-rose-600 border-rose-500' },
    { id: 'EXCEPT', label: '🚫 EXCETO / NÃO', color: 'bg-amber-600 border-amber-500' },
    { id: 'JUDGMENT', label: '⚠️ CERTO / ERRADO', color: 'bg-indigo-600 border-indigo-500' },
];

const PAUSE_OPTIONS = [0, 800, 1200, 2000];
const MANUAL_STORAGE_KEY = 'miaaula_reactor_manual_hidden';

// --- HEURISTICS ---

const inferCommand = (q: Question): CommandType => {
    const text = String(q.questionText || "").toUpperCase();
    if (q.questionType?.includes('C/E') || (q.options?.C === 'Certo' && q.options?.E === 'Errado')) return 'JUDGMENT';
    if (text.includes('EXCETO') || text.includes('INCORRETA') || text.includes('SALVO') || text.includes('NÃO É') || text.includes('ERRADA')) return 'INCORRECT';
    if (text.includes('ASSINALE A INCORRETA')) return 'INCORRECT';
    return 'CORRECT';
};

// Use the centralized service for Trap Logic
const inferTrap = (q: Question): TrapType => {
    return deriveTrapscanRequired(q).tag;
};

// --- GAME COMPONENT ---

const TrapscanReactorProGame: React.FC<TrapscanReactorProProps> = ({ onExit, crtEffect }) => {
    const allQuestions = useQuestionState();
    const { addBattleHistoryEntry, addXp } = useSettings();
    const { registerAttempt } = useQuestionDispatch(); // ADDED: Dispatch hook
    
    // State
    const [phase, setPhase] = useState<GamePhase>('MENU');
    const [mode, setMode] = useState<GameMode>('QUICK');
    const [queue, setQueue] = useState<RoundData[]>([]);
    const [roundIndex, setRoundIndex] = useState(0);
    const [stage, setStage] = useState<RoundStage>('COMMAND');
    
    // Config State
    const [isLearningMode, setIsLearningMode] = useState(false);
    const [manualAdvance, setManualAdvance] = useState(false); // Default OFF for Quick
    const [pauseDuration, setPauseDuration] = useState(1200); // 1.2s default

    // UI Modals State
    const [showManual, setShowManual] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [dontShowManualAgain, setDontShowManualAgain] = useState(false);

    // Control State
    const [canAdvance, setCanAdvance] = useState(false);
    
    // Stats
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [lives, setLives] = useState(3);
    const [trapMastery, setTrapMastery] = useState<TrapMastery>({});
    
    // Logic
    const [activeWeakness, setActiveWeakness] = useState<TrapType | null>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const [shiftMessage, setShiftMessage] = useState<string | null>(null);
    
    // Refs
    const roundStartRef = useRef<number>(0);
    const timeoutRef = useRef<number | undefined>(undefined);

    // --- INITIALIZATION ---
    useEffect(() => {
        const manualHidden = localStorage.getItem(MANUAL_STORAGE_KEY) === 'true';
        setDontShowManualAgain(manualHidden);
    }, []);

    // --- SAVE LOGIC ---
    const saveResults = () => {
        addBattleHistoryEntry({
            questionRef: `REACTOR PRO [${mode}]`,
            score: score,
            wasCorrect: lives > 0,
            eliminatedCorrectly: Math.floor(score / 200),
            eliminatedIncorrectly: 3 - Math.max(0, lives),
            eliminatedOptions: [],
            finalAnswer: `Max Combo: ${combo}`,
            timeSec: 0
        });

        if (score > 0) {
            addXp(Math.floor(score / 15), "Trapscan Reactor Pro");
        }
    };

    // --- ANALYSIS ENGINE ---
    const weaknessAnalysis = useMemo(() => {
        const errorCounts: Record<string, number> = {};
        let totalErrors = 0;
        
        allQuestions.forEach(q => {
            if (q.totalAttempts > 0 && !q.lastWasCorrect) {
                const trap = inferTrap(q);
                // Ignore unclassified for weakness targeting
                if (trap !== 'SEM_DADO') {
                    errorCounts[trap] = (errorCounts[trap] || 0) + 1;
                    totalErrors++;
                }
            }
        });

        const sorted = Object.entries(errorCounts).sort((a,b) => b[1] - a[1]);
        const weakest = sorted[0] ? (sorted[0][0] as TrapType) : 'A2';
        
        return { weakest, errorCounts, totalErrors };
    }, [allQuestions]);

    // --- GAME PREP ---
    const buildQueue = (selectedMode: GameMode, weakness: TrapType) => {
        let pool = allQuestions.filter(q => q.questionText && q.questionText.length > 30);
        let targetSize = 20;

        if (selectedMode !== 'DAILY') targetSize = 50;

        let finalQueue: RoundData[] = [];

        if (selectedMode === 'FIX') {
            const weakPool = pool.filter(q => inferTrap(q) === weakness);
            const otherPool = pool.filter(q => inferTrap(q) !== weakness);
            const weakCount = Math.floor(targetSize * 0.8);
            const otherCount = targetSize - weakCount;
            const selectedWeak = weakPool.sort(() => Math.random() - 0.5).slice(0, weakCount);
            const selectedOther = otherPool.sort(() => Math.random() - 0.5).slice(0, otherCount);
            
            finalQueue = [...selectedWeak, ...selectedOther].sort(() => Math.random() - 0.5).map(q => ({
                question: q,
                correctCommand: inferCommand(q),
                correctTrap: inferTrap(q),
                excerpt: q.questionText.length > 250 ? q.questionText.substring(0, 250) + "..." : q.questionText,
                isTrapFocus: inferTrap(q) === weakness
            }));
        } else {
            finalQueue = pool.sort(() => Math.random() - 0.5).slice(0, targetSize).map(q => ({
                question: q,
                correctCommand: inferCommand(q),
                correctTrap: inferTrap(q),
                excerpt: q.questionText.length > 250 ? q.questionText.substring(0, 250) + "..." : q.questionText,
                isTrapFocus: false
            }));
        }
        
        return finalQueue;
    };

    const startGame = (selectedMode: GameMode) => {
        setMode(selectedMode);
        setActiveWeakness(weaknessAnalysis.weakest);
        const newQueue = buildQueue(selectedMode, weaknessAnalysis.weakest);
        setQueue(newQueue);
        setRoundIndex(0);
        setScore(0);
        setCombo(0);
        setLives(3);
        setTrapMastery({});
        setStage('COMMAND');
        setPhase('PLAYING');
        setCanAdvance(false);
        roundStartRef.current = Date.now();
        retroAudio.play('START');
    };

    // --- GAME LOOP ---
    const handleCommand = (cmd: CommandType) => {
        if (phase !== 'PLAYING') return;

        const round = queue[roundIndex];
        const isCompatible = (cmd === round.correctCommand) || 
                             (cmd === 'INCORRECT' && round.correctCommand === 'EXCEPT') ||
                             (cmd === 'EXCEPT' && round.correctCommand === 'INCORRECT');
        
        if (isCompatible) {
            retroAudio.play('SELECT');
            setStage('TRAP');
        } else {
            handleError('COMMAND', round);
        }
    };

    const handleTrap = (trap: TrapType) => {
        if (phase !== 'PLAYING') return;
        
        const round = queue[roundIndex];
        const timeTaken = (Date.now() - roundStartRef.current) / 1000;
        
        if (trap === round.correctTrap) {
            handleSuccess(timeTaken, round);
        } else {
            handleError('TRAP', round);
        }
    };

    const handleSuccess = (timeTaken: number, round: RoundData) => {
        retroAudio.play('CORRECT');
        
        let base = 220;
        if (timeTaken < 1.0) base += 220;
        else if (timeTaken < 2.0) base += 140;
        else if (timeTaken < 3.0) base += 80;
        
        const multiplier = 1 + Math.floor(combo / 5) * 0.25;
        const points = Math.round(base * Math.min(3.0, multiplier));
        
        setScore(s => s + points);
        setCombo(c => c + 1);
        
        const trap = round.correctTrap;
        const currentM = trapMastery[trap] || 0;
        const newM = Math.min(100, currentM + (combo > 2 ? 5 : 3));
        setTrapMastery(prev => ({ ...prev, [trap]: newM }));
        
        // PERSIST SUCCESS TO RADAR
        registerAttempt({
             question: round.question,
             isCorrect: true,
             userAnswer: 'TRAINING',
             timeSec: timeTaken,
             mode: 'BATTLE',
             trapCode: trap
        });

        if (mode === 'FIX' && activeWeakness === trap && newM >= 75) {
            triggerShift(trap);
            return;
        }

        prepareFeedback('SUCCESS', round);
    };

    const handleError = (stage: 'COMMAND' | 'TRAP', round: RoundData) => {
        retroAudio.play('WRONG');
        setCombo(0);
        setLives(l => l - 1);
        
        const trap = round.correctTrap;
        // Decrease mastery for this trap
        setTrapMastery(prev => ({ ...prev, [trap]: Math.max(0, (prev[trap]||0) - 4) }));

        // PERSIST FAILURE TO RADAR
        registerAttempt({
             question: round.question,
             isCorrect: false,
             userAnswer: 'TRAINING_FAIL',
             timeSec: (Date.now() - roundStartRef.current) / 1000,
             mode: 'BATTLE',
             trapCode: trap // Marking as fail in this trap
        });

        prepareFeedback('ERROR', round, stage);
    };

    const prepareFeedback = (type: 'SUCCESS' | 'ERROR', round: RoundData, errorStage?: 'COMMAND' | 'TRAP') => {
        setPhase('FEEDBACK');
        setCanAdvance(false);
        
        const trapConfig = TRAP_CONFIG[round.correctTrap] || TRAP_CONFIG['SEM_DADO'];
        const msg = errorStage === 'COMMAND' 
            ? `Comando: ${round.correctCommand === 'CORRECT' ? 'CORRETA' : 'INCORRETA/EXCETO'}` 
            : `Trap: ${trapConfig.label}`;

        const detail = errorStage === 'COMMAND'
            ? "Leia atentamente se a banca pede a opção certa ou errada."
            : trapConfig.hint;
        
        const learningData = isLearningMode ? {
            guia: round.question.guiaTrapscan,
            distractor: round.question.distractorProfile ? JSON.stringify(round.question.distractorProfile) : null,
            diagnosis: round.question.wrongDiagnosis,
            keyDistinction: round.question.keyDistinction,
            anchor: round.question.anchorText
        } : null;

        setFeedback({
            title: type === 'SUCCESS' ? "ACERTOU!" : (errorStage === 'COMMAND' ? "ERRO DE COMANDO" : "TRAP NÃO DETECTADO"),
            type,
            msg,
            detail,
            tip: trapConfig.tip,
            trapColor: trapConfig.color,
            trapLabel: trapConfig.label,
            learningData
        });

        if (type === 'ERROR' && lives <= 1) {
             setTimeout(() => {
                 setPhase('GAMEOVER');
                 saveResults();
             }, 1500);
        } else {
             timeoutRef.current = window.setTimeout(() => {
                 setCanAdvance(true);
                 if (!manualAdvance && !isLearningMode) {
                     nextRound();
                 }
             }, pauseDuration);
        }
    };

    const handleContinue = () => {
        if (!canAdvance) return;
        setFeedback(null);
        nextRound();
    };

    // --- EXIT LOGIC ---
    const handleExitGame = () => {
        setShowExitConfirm(true);
    };

    const confirmExit = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShowExitConfirm(false);
        setPhase('MENU');
        setQueue([]);
    };

    const toggleManual = () => {
        setShowManual(!showManual);
    };

    const handleManualPreference = (checked: boolean) => {
        setDontShowManualAgain(checked);
        localStorage.setItem(MANUAL_STORAGE_KEY, String(checked));
    };

    // --- KEYBOARD HANDLER ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Escape') {
                if (showManual) {
                    setShowManual(false);
                    return;
                }
                if (phase === 'PLAYING' || phase === 'FEEDBACK') {
                    if (showExitConfirm) {
                        setShowExitConfirm(false);
                    } else {
                        setShowExitConfirm(true);
                    }
                    return;
                }
                if (phase === 'MENU' && !showManual) {
                    onExit();
                    return;
                }
            }
            if (phase === 'FEEDBACK' && canAdvance && (e.code === 'Space' || e.code === 'Enter')) {
                handleContinue();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [phase, canAdvance, showExitConfirm, showManual, onExit]);


    const triggerShift = (stabilizedTrap: TrapType) => {
        retroAudio.play('LEVELUP');
        setPhase('SHIFT');
        setShiftMessage(`Trap ${stabilizedTrap} Estabilizado! Buscando próxima fraqueza...`);
        
        const nextWeakness = 'A2'; 
        setActiveWeakness(nextWeakness);
        
        setTimeout(() => {
            setShiftMessage(null);
            setPhase('PLAYING');
            nextRound();
        }, 2000);
    };

    const nextRound = () => {
        if (roundIndex < queue.length - 1) {
            setRoundIndex(i => i + 1);
            setStage('COMMAND');
            roundStartRef.current = Date.now();
            setPhase('PLAYING');
        } else {
            setPhase('GAMEOVER');
            saveResults();
        }
    };

    // --- RENDERERS ---

    if (phase === 'MENU') {
        return (
            <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center p-6 animate-fade-in font-mono text-white">
                <div className="max-w-md w-full space-y-8 relative">
                    {/* Manual Toggle */}
                    <div className="absolute -top-12 right-0">
                         <button 
                            onClick={toggleManual}
                            className="flex items-center gap-2 text-slate-500 hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/5"
                         >
                             <InfoIcon className="w-4 h-4" /> Manual
                         </button>
                    </div>

                    <div className="text-center">
                        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-600 uppercase italic tracking-tighter mb-2">
                            REACTOR PRO+
                        </h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">Treino Cognitivo Adaptativo</p>
                    </div>

                    <div className="bg-slate-900 border-2 border-indigo-500/30 rounded-3xl p-6 space-y-4">
                        {/* Settings Toggles */}
                        <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpenIcon className={`w-5 h-5 ${isLearningMode ? 'text-indigo-400' : 'text-slate-500'}`} />
                                    <span className="text-sm font-bold text-slate-300">Modo Aprendizado</span>
                                </div>
                                <button 
                                    onClick={() => {
                                        setIsLearningMode(!isLearningMode);
                                        if (!isLearningMode) setManualAdvance(true); // Auto-enable manual advance for learning
                                    }}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${isLearningMode ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${isLearningMode ? 'left-6' : 'left-1'}`}></div>
                                </button>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PlayIcon className={`w-5 h-5 ${manualAdvance ? 'text-indigo-400' : 'text-slate-500'}`} />
                                    <span className="text-sm font-bold text-slate-300">Avanço Manual (Pause)</span>
                                </div>
                                <button 
                                    onClick={() => setManualAdvance(!manualAdvance)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${manualAdvance ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${manualAdvance ? 'left-6' : 'left-1'}`}></div>
                                </button>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="w-5 h-5 text-slate-500" />
                                    <span className="text-sm font-bold text-slate-300">Tempo de Pausa</span>
                                </div>
                                <div className="flex gap-1">
                                    {PAUSE_OPTIONS.map(opt => (
                                        <button 
                                            key={opt}
                                            onClick={() => setPauseDuration(opt)}
                                            className={`px-2 py-1 text-[10px] font-bold rounded border ${pauseDuration === opt ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                                        >
                                            {opt === 0 ? 'OFF' : (opt/1000)+'s'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 mt-6">
                            {/* QUICK REACTOR BUTTON */}
                            <button 
                                onClick={() => startGame('QUICK')} 
                                className="
                                    relative w-full rounded-2xl group text-left bg-slate-800
                                    transition-all duration-200 ease-out
                                    shadow-[0_14px_40px_rgba(0,0,0,0.45)]
                                    hover:shadow-[0_18px_60px_rgba(0,0,0,0.55)]
                                    hover:scale-[1.02]
                                    ring-1 ring-white/10
                                    hover:ring-white/30
                                    overflow-hidden
                                "
                            >
                                {/* Glow externo (Cyan/Sky) */}
                                <div className="
                                    pointer-events-none absolute -inset-2 rounded-2xl
                                    opacity-0 blur-2xl
                                    transition-opacity duration-300 ease-out
                                    group-hover:opacity-100
                                    bg-[radial-gradient(circle_at_50%_40%,rgba(14,165,233,0.4),transparent_60%)]
                                " />

                                {/* Reflexo premium */}
                                <div className="
                                    pointer-events-none absolute inset-0 rounded-2xl
                                    opacity-0 transition-opacity duration-300 ease-out
                                    group-hover:opacity-100
                                    bg-gradient-to-b from-white/10 via-white/5 to-transparent
                                " />

                                {/* Conteúdo */}
                                <div className="relative z-10 p-5 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-base text-white group-hover:text-sky-300 transition-colors tracking-tight">⚡ Quick Reactor</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium group-hover:text-slate-300">Sessão balanceada rápida.</p>
                                    </div>
                                    <div className="bg-black/30 p-2.5 rounded-xl text-slate-500 group-hover:text-sky-400 group-hover:bg-sky-400/10 transition-colors">
                                        <ArrowPathIcon className="w-5 h-5" />
                                    </div>
                                </div>
                            </button>
                            
                            {/* FIX MY WEAKNESS BUTTON */}
                            <button 
                                onClick={() => startGame('FIX')} 
                                className="
                                    relative w-full rounded-2xl group text-left bg-gradient-to-r from-indigo-900/40 to-purple-900/40
                                    transition-all duration-200 ease-out
                                    shadow-[0_14px_40px_rgba(0,0,0,0.45)]
                                    hover:shadow-[0_20px_80px_rgba(99,102,241,0.25)]
                                    hover:scale-[1.02]
                                    ring-1 ring-indigo-500/30
                                    hover:ring-indigo-400/60
                                    overflow-hidden
                                "
                            >
                                {/* Glow externo (Indigo/Purple) */}
                                <div className="
                                    pointer-events-none absolute -inset-2 rounded-2xl
                                    opacity-0 blur-2xl
                                    transition-opacity duration-300 ease-out
                                    group-hover:opacity-100
                                    bg-[radial-gradient(circle_at_50%_40%,rgba(120,80,255,0.5),transparent_60%)]
                                " />

                                {/* Reflexo premium */}
                                <div className="
                                    pointer-events-none absolute inset-0 rounded-2xl
                                    opacity-0 transition-opacity duration-300 ease-out
                                    group-hover:opacity-100
                                    bg-gradient-to-b from-white/10 via-white/5 to-transparent
                                " />

                                {/* Conteúdo */}
                                <div className="relative z-10 p-5 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-base text-indigo-200 group-hover:text-white transition-colors tracking-tight">🛠️ Fix My Weakness</span>
                                            <StarSolidIcon className="w-3 h-3 text-yellow-500 animate-pulse" />
                                        </div>
                                        <p className="text-[10px] text-indigo-300/60 font-medium group-hover:text-indigo-200">
                                            Foco intenso em <span className="font-bold text-indigo-400">{TRAP_CONFIG[weaknessAnalysis.weakest]?.label}</span>.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-400 group-hover:text-white group-hover:bg-indigo-500 transition-colors">
                                        <BoltIcon className="w-5 h-5" />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <button onClick={onExit} className="w-full py-4 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">Voltar para Arena</button>
                </div>

                {/* Manual Modal */}
                {showManual && (
                    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowManual(false)}>
                        <div className="bg-slate-900 border border-indigo-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowManual(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XMarkIcon className="w-6 h-6"/></button>
                            <h2 className="text-xl font-black text-indigo-400 uppercase tracking-tighter mb-4">Manual do Jogador</h2>
                            
                            <div className="space-y-4 text-sm text-slate-300 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2">
                                <div className="bg-black/30 p-3 rounded-xl">
                                    <h3 className="font-bold text-white mb-1 uppercase text-xs tracking-wider">Objetivo</h3>
                                    <p className="text-xs">Detectar o tipo de armadilha (TRAP) e o comando da questão antes de responder. Treine seu "scanner" mental.</p>
                                </div>
                                
                                <div className="bg-black/30 p-3 rounded-xl">
                                    <h3 className="font-bold text-white mb-2 uppercase text-xs tracking-wider">Códigos de Trap</h3>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div><span className="font-bold text-red-400">T</span> = Termo Absoluto (Sempre/Nunca)</div>
                                        <div><span className="font-bold text-orange-400">R</span> = Restrição / Exceção (Salvo)</div>
                                        <div><span className="font-bold text-blue-400">A</span> = Competência / Autoridade</div>
                                        <div><span className="font-bold text-green-400">P</span> = Prazo / Tempo</div>
                                        <div><span className="font-bold text-purple-400">S</span> = Semântica / Conceito</div>
                                        <div><span className="font-bold text-yellow-400">C</span> = Jurisprudência / Conflito</div>
                                        <div className="col-span-2"><span className="font-bold text-slate-400">A2</span> = Pegadinha Geral / Inversão</div>
                                    </div>
                                </div>

                                <div className="bg-black/30 p-3 rounded-xl">
                                    <h3 className="font-bold text-white mb-1 uppercase text-xs tracking-wider">Gameplay</h3>
                                    <ul className="list-disc list-inside text-xs space-y-1">
                                        <li>1. Leia o comando (Correta/Incorreta/Certo-Errado).</li>
                                        <li>2. Identifique o TRAP na afirmativa.</li>
                                        <li>3. Acerto rápido ganha mais pontos. Combos multiplicam score.</li>
                                        <li>4. Use <strong>Modo Aprendizado</strong> para ver explicações.</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={dontShowManualAgain}
                                        onChange={(e) => handleManualPreference(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
                                    />
                                    <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Não mostrar novamente</span>
                                </label>
                                <button onClick={() => setShowManual(false)} className="px-6 py-2 bg-white text-slate-900 font-bold rounded-lg uppercase tracking-widest text-xs hover:bg-slate-200">Entendi</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (phase === 'SHIFT') {
        return (
            <div className="fixed inset-0 z-[200] bg-indigo-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <BoltIcon className="w-24 h-24 text-yellow-400 animate-bounce mb-6" />
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">LEVEL UP!</h2>
                <p className="text-xl text-indigo-200 font-bold">{shiftMessage}</p>
            </div>
        );
    }

    if (phase === 'GAMEOVER') {
        return (
            <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center p-8 font-mono text-white animate-fade-in">
                <h1 className="text-6xl font-black text-white mb-2">FIM DE TREINO</h1>
                <div className="grid grid-cols-2 gap-8 mb-10 w-full max-w-md">
                    <div className="text-center">
                        <span className="text-4xl font-black text-indigo-400 block">{score}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Score Total</span>
                    </div>
                    <div className="text-center">
                        <span className="text-4xl font-black text-emerald-400 block">{combo}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Max Combo</span>
                    </div>
                </div>
                <div className="flex gap-4 w-full max-w-md">
                    <button onClick={() => setPhase('MENU')} className="flex-1 py-4 bg-white text-slate-900 font-black rounded-xl uppercase tracking-widest hover:scale-105 transition-transform">Menu</button>
                    <button onClick={onExit} className="flex-1 py-4 border-2 border-slate-700 text-slate-400 font-black rounded-xl uppercase tracking-widest hover:text-white hover:border-white transition-colors">Sair</button>
                </div>
            </div>
        );
    }

    // PLAYING RENDER
    const currentRound = queue[roundIndex];
    if (!currentRound) return <div>Loading...</div>;

    const isWeaknessRound = currentRound.isTrapFocus;

    // Hint Logic
    const hintText = isLearningMode && currentRound.question.guiaTrapscan 
        ? currentRound.question.guiaTrapscan.split(' ').slice(0, 8).join(' ') + '...'
        : null;

    return ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[9999] bg-[#020408] text-white overflow-hidden font-mono select-none ${crtEffect ? 'contrast-125' : ''}`}>
             {/* CRT Overlay */}
             {crtEffect && <div className="fixed inset-0 pointer-events-none z-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAuLDAsMCwwLjEpIi8+CjxwYXRoIGQ9Ik0wIDNMNCAzIiBzdHJva2U9InJnYmEoMCwwLDAsMC4yKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-30"></div>}

             {/* HUD */}
             <div className="relative z-10 p-4 pt-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
                 <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                         {mode === 'FIX' ? (isWeaknessRound ? '⚡ FOCO: FRAQUEZA' : '🔄 MIX') : 'MODO PADRÃO'}
                     </span>
                     <div className="flex items-center gap-2">
                         {Array.from({length: 3}).map((_, i) => (
                             <div key={i} className={`w-8 h-2 skew-x-[-12deg] ${i < lives ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : 'bg-slate-800'}`}></div>
                         ))}
                     </div>
                 </div>
                 
                 {/* Learning Hint */}
                 {isLearningMode && hintText && (
                     <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-indigo-900/80 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] text-indigo-200 font-bold max-w-[200px] truncate animate-fade-in">
                         💡 {hintText}
                     </div>
                 )}
                 
                 <div className="text-right flex flex-col items-end gap-1">
                     <button onClick={() => setShowExitConfirm(true)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Sair do Jogo">
                         <XMarkIcon className="w-5 h-5"/>
                     </button>
                     <span className="block text-3xl font-black text-white leading-none">{score}</span>
                     {combo > 1 && <span className="text-xs font-bold text-yellow-500 animate-bounce block mt-1">{combo}x COMBO</span>}
                 </div>
             </div>

             {/* MAIN AREA */}
             <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 max-w-3xl mx-auto w-full">
                 
                 {/* FEEDBACK OVERLAY (Updated for Learning Mode) */}
                 {phase === 'FEEDBACK' && feedback && (
                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-6 animate-fade-in text-center">
                         <div className="max-w-md w-full">
                             <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${feedback.type === 'SUCCESS' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                 {feedback.type === 'SUCCESS' ? <CheckCircleIcon className="w-8 h-8 text-emerald-500"/> : <XMarkIcon className="w-8 h-8 text-rose-500" />}
                             </div>
                             
                             <h2 className="text-3xl font-black text-white mb-1 uppercase italic">{feedback.title}</h2>
                             
                             <div className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase mb-6 ${feedback.trapColor} bg-opacity-20 text-white`}>
                                 {feedback.trapLabel}
                             </div>
                             
                             {/* Learning Panel Content - Only from existing data */}
                             {isLearningMode && feedback.learningData && (
                                 <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-left space-y-3 mb-6 max-h-[40vh] overflow-y-auto custom-scrollbar">
                                     {feedback.learningData.guia && (
                                         <div>
                                             <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Guia Trapscan</span>
                                             <p className="text-sm text-slate-300 leading-snug">{feedback.learningData.guia}</p>
                                         </div>
                                     )}
                                     {feedback.learningData.diagnosis && feedback.type === 'ERROR' && (
                                         <div>
                                             <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Diagnóstico</span>
                                             <p className="text-sm text-slate-300 leading-snug">{feedback.learningData.diagnosis}</p>
                                         </div>
                                     )}
                                      {feedback.learningData.keyDistinction && (
                                         <div>
                                             <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Palavra-Chave</span>
                                             <p className="text-sm text-slate-300 leading-snug">{feedback.learningData.keyDistinction}</p>
                                         </div>
                                     )}
                                 </div>
                             )}

                             {/* Standard Feedback (if not learning mode or as fallback) */}
                             {!isLearningMode && (
                                 <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-indigo-500 text-left mb-6">
                                     <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">DICA RÁPIDA</p>
                                     <p className="text-sm text-white mb-1">{feedback.detail}</p>
                                 </div>
                             )}
                             
                             {/* Continue Button */}
                             {(manualAdvance || isLearningMode) && (
                                 <button 
                                    onClick={handleContinue}
                                    disabled={!canAdvance}
                                    className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${canAdvance ? 'bg-white text-slate-900 hover:scale-105' : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
                                 >
                                     {canAdvance ? 'Continuar (Espaço)' : `Aguarde...`}
                                 </button>
                             )}
                             {!manualAdvance && !isLearningMode && (
                                 <p className="text-[10px] text-slate-500 animate-pulse mt-4 uppercase tracking-widest">Avançando...</p>
                             )}
                         </div>
                     </div>
                 )}

                 {/* QUESTION CARD */}
                 <div className="w-full bg-slate-900/80 border border-white/10 p-6 rounded-2xl mb-8 shadow-2xl relative overflow-hidden min-h-[160px] flex items-center justify-center text-center">
                     {isWeaknessRound && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-2 py-1 rounded-bl-lg">TARGET</div>}
                     <PromptText text={currentRound.excerpt} className="text-base md:text-xl font-medium leading-relaxed text-slate-200" />
                 </div>

                 {/* CONTROLS */}
                 <div className="w-full">
                     {stage === 'COMMAND' ? (
                         <div className="grid grid-cols-2 gap-3 animate-fade-in-up">
                             {COMMAND_BTNS.map(btn => (
                                 <button
                                    key={btn.id}
                                    onClick={() => handleCommand(btn.id)}
                                    className={`p-6 rounded-xl border-b-4 bg-slate-800 text-white font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all ${btn.color}`}
                                 >
                                     {btn.label}
                                 </button>
                             ))}
                         </div>
                     ) : (
                         <div className="grid grid-cols-4 gap-3 animate-fade-in-up">
                             {Object.entries(TRAP_CONFIG).map(([code, conf]) => (
                                 <button
                                    key={code}
                                    onClick={() => handleTrap(code as TrapType)}
                                    className={`p-4 rounded-xl border-b-4 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${conf.color} border-black/20`}
                                 >
                                     <span className="text-2xl font-black text-white">{code}</span>
                                     <span className="text-[8px] font-bold text-white/80 uppercase">{conf.label.split(' ')[0]}</span>
                                 </button>
                             ))}
                         </div>
                     )}
                 </div>

             </div>

             {/* EXIT CONFIRMATION MODAL */}
             {showExitConfirm && (
                <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowExitConfirm(false)}>
                    <div className="bg-slate-900 border-2 border-white/10 p-8 rounded-3xl text-center w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">Sair do Jogo?</h3>
                        <p className="text-slate-400 text-sm font-medium mb-8">Seu progresso da sessão atual será perdido.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors uppercase tracking-widest text-xs">Cancelar</button>
                            <button 
                                onClick={() => { setShowExitConfirm(false); setPhase('MENU'); }} 
                                className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-500 transition-colors uppercase tracking-widest text-xs shadow-lg"
                            >
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
             )}

        </div>,
        document.body
    );
};

export default TrapscanReactorProGame;
