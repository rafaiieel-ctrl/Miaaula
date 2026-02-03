
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Question } from '../../types';
import { useQuestionState } from '../../contexts/QuestionContext';
import { useSettings } from '../../contexts/SettingsContext';
import { XMarkIcon, BoltIcon, FireIcon, ClockIcon, TrophyIcon, PlayIcon, ExclamationTriangleIcon } from '../icons';
import { retroAudio } from '../../services/retroAudioService';
import { normalizeDiscipline } from '../../services/taxonomyService';
import PromptText from '../ui/PromptText';

// --- TYPES ---

interface TrapscanReactorProps {
    onExit: () => void;
    crtEffect: boolean;
}

type GamePhase = 'CONFIG' | 'PLAYING' | 'GAMEOVER';
type RoundStage = 'COMMAND' | 'TRAP';

type CommandType = 'CORRECT' | 'INCORRECT' | 'EXCEPT' | 'JUDGMENT';
type TrapType = 'T' | 'R' | 'A' | 'P' | 'S' | 'C' | 'A2';

interface RoundData {
    question: Question;
    correctCommand: CommandType;
    correctTrap: TrapType;
    excerpt: string;
}

interface GameStats {
    score: number;
    combo: number;
    maxCombo: number;
    correct: number;
    wrong: number;
    perfectRounds: number;
}

// --- CONSTANTS ---
const GAME_DURATION = 60;

const TRAP_LABELS: Record<TrapType, { label: string; color: string; full: string }> = {
    'T': { label: 'T', color: 'bg-red-500', full: 'Termo Absoluto' },
    'R': { label: 'R', color: 'bg-orange-500', full: 'Restrição/Exceção' },
    'A': { label: 'A', color: 'bg-blue-500', full: 'Alçada/Competência' },
    'P': { label: 'P', color: 'bg-green-500', full: 'Prazo/Tempo' },
    'S': { label: 'S', color: 'bg-purple-500', full: 'Semântica' },
    'C': { label: 'C', color: 'bg-yellow-500', full: 'Conflito/Juris' },
    'A2': { label: 'A2', color: 'bg-slate-500', full: 'Armadilha Geral' },
};

const COMMAND_BTNS: { id: CommandType; label: string; color: string }[] = [
    { id: 'CORRECT', label: '✅ CORRETA', color: 'bg-emerald-600 hover:bg-emerald-500' },
    { id: 'INCORRECT', label: '❌ INCORRETA', color: 'bg-rose-600 hover:bg-rose-500' },
    { id: 'EXCEPT', label: '🚫 EXCETO / NÃO', color: 'bg-amber-600 hover:bg-amber-500' },
    { id: 'JUDGMENT', label: '⚠️ CERTO / ERRADO', color: 'bg-indigo-600 hover:bg-indigo-500' },
];

// --- HEURISTICS ENGINE ---

const inferCommand = (q: Question): CommandType => {
    const text = String(q.questionText || "").toUpperCase();
    
    // 1. Judgment (C/E)
    if (q.questionType?.includes('C/E') || (q.options?.C === 'Certo' && q.options?.E === 'Errado')) {
        return 'JUDGMENT';
    }
    
    // 2. Except / Negative
    if (text.includes('EXCETO') || text.includes('INCORRETA') || text.includes('SALVO') || text.includes('NÃO É') || text.includes('NÃO SE APLICA')) {
        // Simple logic: if text explicitly asks for Incorrect/Except
        if (text.includes('INCORRETA') || text.includes('ERRADA')) return 'INCORRECT';
        return 'EXCEPT';
    }

    // 3. Incorrect specific check (redundant but safe)
    if (text.includes('ASSINALE A INCORRETA')) return 'INCORRECT';

    // 4. Default
    return 'CORRECT';
};

const inferTrap = (q: Question): TrapType => {
    // 1. Explicit Metadata
    const trapGuide = String(q.guiaTrapscan || q.wrongDiagnosis || "").toUpperCase();
    if (trapGuide.includes('P1') || trapGuide.includes('TEMA')) return 'A2'; // Broad
    if (trapGuide.includes('P2') || trapGuide.includes('REGRA')) return 'A2';
    if (trapGuide.includes('P3') || trapGuide.includes('ÂNCORA') || trapGuide.includes('ANCORA')) return 'T'; // Anchors often T/R
    if (trapGuide.includes('P4') || trapGuide.includes('PREDIÇÃO')) return 'A2';
    if (trapGuide.includes('P5') || trapGuide.includes('CORTE')) return 'A2'; 
    if (trapGuide.includes('P6') || trapGuide.includes('PEGADINHA')) return 'A2';
    
    // 2. Text Heuristics
    const text = String(q.questionText || "").toUpperCase();
    
    // T - Absolute Terms
    if (/\b(SEMPRE|NUNCA|JAMAIS|APENAS|EXCLUSIVAMENTE|UNICAMENTE)\b/.test(text)) return 'T';
    
    // R - Restrictions
    if (/\b(SALVO|EXCETO|RESSALVADO|VEDADO|PROIBIDO|DEPENDENTE)\b/.test(text)) return 'R';
    
    // P - Prazo/Tempo
    if (/\b(PRAZO|DIAS|ANOS|MESES|HORAS|ANTERIORIDADE|DECADENCIAL|PRESCRICIONAL|VIGENCIA)\b/.test(text)) return 'P';
    
    // A - Authority/Competence
    if (/\b(COMPETE|COMPETENCIA|SUJEITO ATIVO|AUTORIDADE|PRIVATIVO|EXCLUSIVO|DELEGAVEL)\b/.test(text)) return 'A';
    
    // C - Jurisprudence
    if (/\b(SUMULA|STF|STJ|JURISPRUDENCIA|ENTENDIMENTO|DOUTRINA)\b/.test(text)) return 'C';
    
    // S - Semantics
    if (/\b(CONCEITO|DEFINE|CONSIDERA-SE|NATUREZA JURIDICA|SIGNIFICA)\b/.test(text)) return 'S';

    // Fallback
    return 'A2';
};

const generateRound = (q: Question): RoundData => {
    return {
        question: q,
        correctCommand: inferCommand(q),
        correctTrap: inferTrap(q),
        excerpt: q.questionText.length > 300 ? q.questionText.substring(0, 300) + "..." : q.questionText
    };
};

// --- GAME COMPONENT ---

const TrapscanReactorGame: React.FC<TrapscanReactorProps> = ({ onExit, crtEffect }) => {
    const allQuestions = useQuestionState();
    const { addBattleHistoryEntry } = useSettings();
    
    // State
    const [phase, setPhase] = useState<GamePhase>('CONFIG');
    const [discipline, setDiscipline] = useState('ALL');
    const [queue, setQueue] = useState<Question[]>([]);
    const [round, setRound] = useState<RoundData | null>(null);
    const [stage, setStage] = useState<RoundStage>('COMMAND');
    
    const [stats, setStats] = useState<GameStats>({ score: 0, combo: 0, maxCombo: 0, correct: 0, wrong: 0, perfectRounds: 0 });
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
    const [feedback, setFeedback] = useState<{ text: string, type: 'good' | 'bad' } | null>(null);
    
    // Refs for Timing
    const roundStartRef = useRef<number>(0);
    const timerRef = useRef<number | undefined>(undefined);

    // --- SETUP ---
    const disciplines = useMemo(() => ['ALL', ...new Set(allQuestions.map(q => normalizeDiscipline(q.subject)))].sort(), [allQuestions]);

    const startGame = () => {
        let pool = allQuestions.filter(q => q.questionText && q.questionText.length > 20);
        if (discipline !== 'ALL') pool = pool.filter(q => normalizeDiscipline(q.subject) === discipline);
        
        if (pool.length < 10) {
            alert("Poucas questões disponíveis. Selecione outra disciplina.");
            return;
        }

        const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 100);
        setQueue(shuffled);
        setStats({ score: 0, combo: 0, maxCombo: 0, correct: 0, wrong: 0, perfectRounds: 0 });
        setTimeLeft(GAME_DURATION);
        loadRound(shuffled[0]);
        setPhase('PLAYING');
        retroAudio.play('START');
    };

    const loadRound = (q: Question) => {
        setRound(generateRound(q));
        setStage('COMMAND');
        roundStartRef.current = Date.now();
    };

    // --- GAME LOOP ---
    useEffect(() => {
        if (phase === 'PLAYING') {
            timerRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        endGame();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    const endGame = () => {
        setPhase('GAMEOVER');
        if (timerRef.current) clearInterval(timerRef.current);
        retroAudio.play('WRONG'); // Or specific game over sound
        
        // Persist "Arcade" stats (using Battle History generic storage for now)
        addBattleHistoryEntry({
            questionRef: `REACTOR - ${discipline}`,
            score: stats.score,
            wasCorrect: stats.wrong === 0, // Session pass/fail metric
            eliminatedCorrectly: stats.correct,
            eliminatedIncorrectly: stats.wrong,
            eliminatedOptions: [],
            finalAnswer: `Combo: ${stats.maxCombo}`,
            timeSec: GAME_DURATION - timeLeft
        });
    };

    // --- ACTIONS ---

    const handleCommand = (cmd: CommandType) => {
        if (!round) return;
        
        if (cmd === round.correctCommand) {
            // Correct Command -> Go to Trap
            setStage('TRAP');
            retroAudio.play('SELECT');
        } else {
            // Wrong Command -> Penalty
            handleMistake("COMANDO ERRADO");
        }
    };

    const handleTrap = (trap: TrapType) => {
        if (!round) return;

        const timeTaken = (Date.now() - roundStartRef.current) / 1000;
        
        if (trap === round.correctTrap) {
            // PERFECT ROUND
            retroAudio.play('CORRECT');
            
            // Score Calculation
            let points = 200;
            if (timeTaken < 1.5) points += 200;
            else if (timeTaken < 2.5) points += 120;
            else if (timeTaken < 4.0) points += 60;
            
            // Combo
            const newCombo = stats.combo + 1;
            const multiplier = 1 + Math.floor(newCombo / 5) * 0.25; // Max 2.5x
            const finalPoints = Math.round(points * Math.min(2.5, multiplier));
            
            setStats(prev => ({
                ...prev,
                score: prev.score + finalPoints,
                combo: newCombo,
                maxCombo: Math.max(prev.maxCombo, newCombo),
                correct: prev.correct + 1,
                perfectRounds: prev.perfectRounds + 1
            }));

            setFeedback({ text: `PERFECT! +${finalPoints}`, type: 'good' });
            
            // Next Round
            nextRound();
        } else {
            // WRONG TRAP
            handleMistake(`TRAP ERRADO (ERA ${round.correctTrap})`);
        }
    };

    const handleMistake = (msg: string) => {
        retroAudio.play('DAMAGE');
        setStats(prev => ({ ...prev, combo: 0, wrong: prev.wrong + 1 }));
        setFeedback({ text: msg, type: 'bad' });
        // Penalty delay then next
        setTimeout(nextRound, 800);
    };

    const nextRound = () => {
        const currentIdx = queue.indexOf(round!.question);
        if (currentIdx < queue.length - 1) {
            loadRound(queue[currentIdx + 1]);
        } else {
            // Reshuffle / Endless
            const newQ = queue.sort(() => Math.random() - 0.5);
            setQueue(newQ);
            loadRound(newQ[0]);
        }
        // Clear feedback after short delay
        setTimeout(() => setFeedback(null), 1000);
    };

    // --- RENDERERS ---

    if (phase === 'CONFIG') {
        return (
            <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-6 animate-fade-in font-mono">
                <div className="max-w-md w-full bg-slate-900 border-4 border-indigo-500 rounded-3xl p-8 shadow-[0_0_50px_rgba(99,102,241,0.2)] text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                    <BoltIcon className="w-16 h-16 text-indigo-500 mx-auto mb-4 animate-pulse" />
                    <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">Trapscan<br/>Reactor</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">Treino de Reflexo Cognitivo</p>
                    
                    <div className="text-left space-y-4 mb-8">
                        <div>
                            <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">Disciplina</label>
                            <select 
                                value={discipline} 
                                onChange={e => setDiscipline(e.target.value)} 
                                className="w-full bg-slate-950 border-2 border-slate-800 text-white text-xs font-bold rounded-xl p-3 outline-none focus:border-indigo-500"
                            >
                                {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={onExit} className="py-4 rounded-xl border-2 border-slate-700 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">Voltar</button>
                        <button onClick={startGame} className="py-4 rounded-xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/30">Start</button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'GAMEOVER') {
        return (
            <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-6 animate-fade-in font-mono text-white">
                <div className="max-w-md w-full text-center">
                    <h1 className="text-6xl font-black text-rose-500 mb-2 animate-bounce">TIME UP</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.3em] mb-8">Sessão Finalizada</p>
                    
                    <div className="bg-slate-900 border-2 border-white/10 p-8 rounded-3xl mb-8 relative overflow-hidden">
                        <div className="relative z-10">
                            <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Score Final</span>
                            <span className="text-6xl font-black text-white tracking-tighter">{stats.score}</span>
                            
                            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
                                <div>
                                    <FireIcon className="w-5 h-5 text-orange-500 mx-auto mb-1"/>
                                    <span className="text-[10px] text-slate-500 block">MAX COMBO</span>
                                    <span className="text-xl font-bold">{stats.maxCombo}</span>
                                </div>
                                <div>
                                    <BoltIcon className="w-5 h-5 text-emerald-500 mx-auto mb-1"/>
                                    <span className="text-[10px] text-slate-500 block">ACERTOS</span>
                                    <span className="text-xl font-bold">{stats.correct}</span>
                                </div>
                                <div>
                                    <ClockIcon className="w-5 h-5 text-sky-500 mx-auto mb-1"/>
                                    <span className="text-[10px] text-slate-500 block">RITMO</span>
                                    <span className="text-xl font-bold">{(stats.correct + stats.wrong) > 0 ? (60 / (stats.correct + stats.wrong)).toFixed(1) : 0}s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={() => setPhase('CONFIG')} className="flex-1 py-4 bg-white text-slate-950 font-black rounded-xl uppercase tracking-widest hover:scale-105 transition-transform">Jogar Novamente</button>
                        <button onClick={onExit} className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-xl uppercase tracking-widest hover:text-white transition-colors">Sair</button>
                    </div>
                </div>
            </div>
        );
    }

    return ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[9999] bg-[#050510] text-white font-mono flex flex-col overflow-hidden select-none ${crtEffect ? 'contrast-125' : ''}`}>
             {/* CRT Overlay */}
             {crtEffect && <div className="fixed inset-0 pointer-events-none z-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAuLDAsMCwwLjEpIi8+CjxwYXRoIGQ9Ik0wIDNMNCAzIiBzdHJva2U9InJnYmEoMCwwLDAsMC4yKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-30"></div>}

             {/* HUD */}
             <div className="flex justify-between items-center p-4 bg-slate-900/80 border-b border-indigo-500/30 z-20">
                 <div className="flex flex-col">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">SCORE</span>
                     <span className="text-2xl font-black leading-none">{stats.score.toString().padStart(6, '0')}</span>
                 </div>
                 <div className="flex flex-col items-center">
                     <span className={`text-4xl font-black tracking-tighter ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}</span>
                 </div>
                 <div className="flex flex-col items-end">
                     <div className="flex items-center gap-1 text-orange-500">
                         <FireIcon className="w-4 h-4" />
                         <span className="text-xl font-black italic">x{stats.combo}</span>
                     </div>
                 </div>
             </div>

             {/* Game Area */}
             <div className="flex-1 relative flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full">
                 
                 {/* Question Snippet */}
                 <div className="bg-slate-900 border-2 border-indigo-500/20 p-6 rounded-2xl mb-6 shadow-[0_0_30px_rgba(99,102,241,0.1)] relative overflow-hidden shrink-0">
                     <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-br-lg uppercase tracking-widest">
                         {round?.question.subject}
                     </div>
                     <p className="text-sm md:text-lg font-bold text-slate-200 leading-relaxed font-sans pt-2">
                         <PromptText text={round?.excerpt || ''} />
                     </p>
                 </div>

                 {/* Interactions */}
                 <div className="flex-1 flex flex-col justify-center">
                     {stage === 'COMMAND' ? (
                         <div className="space-y-4 animate-fade-in-up">
                             <h3 className="text-center text-xs font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">ETAPA 1: O QUE A BANCA QUER?</h3>
                             <div className="grid grid-cols-2 gap-4">
                                 {COMMAND_BTNS.map(btn => (
                                     <button 
                                        key={btn.id}
                                        onClick={() => handleCommand(btn.id)}
                                        className={`p-6 rounded-2xl border-b-4 border-black/20 text-white font-black text-sm md:text-base uppercase tracking-wider shadow-lg active:scale-95 transition-transform ${btn.color}`}
                                     >
                                         {btn.label}
                                     </button>
                                 ))}
                             </div>
                         </div>
                     ) : (
                         <div className="space-y-4 animate-fade-in-up">
                             <h3 className="text-center text-xs font-black text-orange-400 uppercase tracking-[0.4em] mb-2">ETAPA 2: IDENTIFIQUE A ARMADILHA</h3>
                             <div className="flex flex-wrap justify-center gap-3">
                                 {(Object.keys(TRAP_LABELS) as TrapType[]).map(key => (
                                     <button
                                         key={key}
                                         onClick={() => handleTrap(key)}
                                         className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex flex-col items-center justify-center gap-1 border-b-4 border-black/20 text-white shadow-lg active:scale-95 transition-transform ${TRAP_LABELS[key].color}`}
                                     >
                                         <span className="text-2xl md:text-3xl font-black">{TRAP_LABELS[key].label}</span>
                                         <span className="text-[8px] font-bold uppercase max-w-[60px] leading-tight">{TRAP_LABELS[key].full}</span>
                                     </button>
                                 ))}
                             </div>
                         </div>
                     )}
                 </div>

                 {/* Feedback Overlay */}
                 {feedback && (
                     <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                         <div className={`text-4xl md:text-6xl font-black uppercase italic tracking-tighter drop-shadow-2xl transform -rotate-6 ${feedback.type === 'good' ? 'text-emerald-400 animate-success-pop' : 'text-rose-500 animate-error-shake'}`}>
                             {feedback.text}
                         </div>
                     </div>
                 )}
             </div>
        </div>,
        document.body
    );
};

export default TrapscanReactorGame;
