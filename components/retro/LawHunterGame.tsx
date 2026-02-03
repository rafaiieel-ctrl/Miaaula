
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Question } from '../../types';
import { useQuestionState, useQuestionDispatch } from '../../contexts/QuestionContext';
import { useSettings } from '../../contexts/SettingsContext';
import { XMarkIcon, CrosshairIcon, FilterIcon, PlayIcon, BoltIcon, TrophyIcon, FireIcon, BookOpenIcon, ScaleIcon, ClipboardListIcon } from '../icons';
import { retroAudio } from '../../services/retroAudioService';
import * as srs from '../../services/srsService';
import { normalizeDiscipline } from '../../services/taxonomyService';
import PromptText from '../ui/PromptText';

// --- TYPES ---
interface LawHunterGameProps {
    onExit: () => void;
    crtEffect: boolean;
}

interface FloatingWord {
    id: string;
    text: string;
    isTarget: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
}

type MissionType = 'KEYWORD' | 'EXCEPTION' | 'TRAP' | 'SAVING_WORD';

interface RoundContext {
    missionType: MissionType;
    missionLabel: string;
    targetWord: string;
    sourceType: 'LEI SECA' | 'QUESTÃO';
    referenceLabel: string; // Ex: "CTN • Art. 3" ou "Q_REF: Q123"
    discipline: string;
    excerpt: string; // O texto completo para o modal
    distractors: string[];
}

type GameState = 'CONFIG' | 'INTRO' | 'PLAYING' | 'FEEDBACK' | 'GAMEOVER';

interface GameConfig {
    source: 'ALL' | 'LEI_SECA' | 'BANK';
    discipline: string;
    topic: string;
    difficulty: 'NORMAL' | 'HARDCORE';
}

// --- CONSTANTS ---
const HUD_HEIGHT = 160; // Increased for Reference Card
const WORDS_COUNT = 25; // Slightly reduced for clarity
const INITIAL_TIME = 45; 

// Stopwords para limpeza
const STOPWORDS = new Set([
    "O", "A", "OS", "AS", "UM", "UMA", "DE", "DA", "DO", "EM", "NO", "NA", "POR", "PARA", "COM", "SEM", 
    "E", "OU", "MAS", "QUE", "SE", "NAO", "SIM", "FOI", "ERA", "SAO", "DOS", "DAS", "NOS", "NAS"
]);

// --- HELPER: WORD CLEANER ---
const cleanWord = (w: string): string => w.trim().toUpperCase().replace(/[.,;:"'()]/g, '');

const isValidToken = (w: string): boolean => {
    const clean = cleanWord(w);
    if (clean.length < 3) return false;
    if (clean.includes('_')) return false; // Remove technical tags
    if (STOPWORDS.has(clean)) return false;
    if (/^\d+$/.test(clean)) return false; // Remove pure numbers
    return true;
};

// --- HELPER: GENERATE ROUND DATA (STRICT RULES) ---
const generateRoundData = (q: Question): RoundContext | null => {
    const textUpper = (q.questionText || "").toUpperCase();
    const cleanDiscipline = normalizeDiscipline(q.subject);

    // 1. TENTAR "PALAVRA QUE SALVA" (Highest Priority if data exists)
    if (q.keyDistinction && q.keyDistinction.length > 3) {
        const rawTarget = q.keyDistinction.split(/[\s,;]+/)[0];
        const target = cleanWord(rawTarget);
        
        if (isValidToken(target)) {
             // Extract distractors from text to ensure context
             const textWords = textUpper.split(/\s+/).filter(w => isValidToken(w) && w !== target);
             
             return {
                missionType: 'SAVING_WORD',
                missionLabel: "ENCONTRE A PALAVRA QUE SALVA",
                targetWord: target,
                sourceType: 'QUESTÃO',
                referenceLabel: `${q.questionRef || 'Q-SEM-REF'}`,
                discipline: cleanDiscipline,
                excerpt: `Enunciado:\n${q.questionText}\n\nGabarito: ${q.correctAnswer}\n\nDistinção Chave: ${q.keyDistinction}`,
                distractors: textWords
            };
        }
    }

    // 2. TENTAR "EXCEÇÃO" ou "PEGADINHA" (Logic based)
    const exceptionTriggers = ["EXCETO", "SALVO", "RESSALVADO", "PRESCINDE", "INDEPENDENTEMENTE"];
    const foundException = exceptionTriggers.find(t => textUpper.includes(t));

    if (foundException) {
         const textWords = textUpper.split(/\s+/).filter(w => isValidToken(w) && w !== foundException);
         return {
            missionType: 'EXCEPTION',
            missionLabel: "ENCONTRE O GATILHO DE EXCEÇÃO",
            targetWord: foundException,
            sourceType: 'QUESTÃO',
            referenceLabel: `${q.questionRef}`,
            discipline: cleanDiscipline,
            excerpt: q.questionText,
            distractors: textWords
        };
    }

    // 3. TENTAR "TERMO CHAVE" (Lei Seca priority)
    // Se tiver lawRef, assumimos que é uma questão de lei seca
    if (q.lawRef) {
        // Find a suitable big word
        const words = textUpper.split(/\s+/).map(cleanWord).filter(isValidToken);
        // Prioritize words > 6 chars
        const bigWords = words.filter(w => w.length > 6);
        const target = bigWords.length > 0 
            ? bigWords[Math.floor(Math.random() * bigWords.length)]
            : (words.length > 0 ? words[Math.floor(Math.random() * words.length)] : null);

        if (target) {
            return {
                missionType: 'KEYWORD',
                missionLabel: "ENCONTRE O TERMO CHAVE",
                targetWord: target,
                sourceType: 'LEI SECA',
                referenceLabel: q.lawRef.replace(/_/g, ' '), // Clean display
                discipline: cleanDiscipline,
                excerpt: `Artigo Referência: ${q.lawRef}\n\nTexto:\n${q.questionText}`,
                distractors: words.filter(w => w !== target)
            };
        }
    }

    // 4. FALLBACK: GENERIC KEYWORD (Se tudo falhar, mas tiver texto)
    if (textUpper.length > 20) {
        const words = textUpper.split(/\s+/).map(cleanWord).filter(isValidToken);
        if (words.length > 5) {
             const target = words.reduce((a, b) => a.length > b.length ? a : b); // Longest word
             return {
                missionType: 'KEYWORD',
                missionLabel: "ENCONTRE O TERMO MAIS LONGO",
                targetWord: target,
                sourceType: 'QUESTÃO',
                referenceLabel: q.questionRef,
                discipline: cleanDiscipline,
                excerpt: q.questionText,
                distractors: words.filter(w => w !== target)
            };
        }
    }

    return null; // Skip this question if no valid game data can be generated
};

const fillDistractors = (pool: string[], count: number, target: string): string[] => {
    // Remove duplicates and target
    let unique = [...new Set(pool)].filter(w => w !== target);
    
    // If not enough, add generic legal words
    const FILLERS = [
        "LEI", "DOLO", "CULPA", "ATO", "FATO", "JUIZ", "REU", "AÇÃO", "BENS", "TAXA",
        "VETO", "VOTO", "CIVIL", "PENAL", "DANO", "NEXO", "ONUS", "RITO", "VISTA"
    ];
    
    while (unique.length < count) {
        const filler = FILLERS[Math.floor(Math.random() * FILLERS.length)];
        if (filler !== target && !unique.includes(filler)) {
            unique.push(filler);
        }
        // Break if we run out of fillers to avoid inf loop (unlikely)
        if (unique.length >= count + FILLERS.length) break; 
    }

    return unique.sort(() => Math.random() - 0.5).slice(0, count);
};

// --- COMPONENT: CONFIG SCREEN ---
const LawHunterConfig: React.FC<{ 
    questions: Question[], 
    onStart: (config: GameConfig) => void,
    onExit: () => void
}> = ({ questions, onStart, onExit }) => {
    const [config, setConfig] = useState<GameConfig>({
        source: 'ALL',
        discipline: 'ALL',
        topic: 'ALL',
        difficulty: 'NORMAL'
    });

    // Extract Filters
    const { disciplines, topics } = useMemo(() => {
        let pool = questions;
        
        if (config.source === 'LEI_SECA') {
            pool = pool.filter(q => q.lawRef || q.litRef);
        } else if (config.source === 'BANK') {
            pool = pool.filter(q => !q.lawRef && !q.litRef); 
        }

        const dis = [...new Set(pool.map(q => normalizeDiscipline(q.subject)))].sort();
        
        let filteredTopics: string[] = [];
        if (config.discipline !== 'ALL') {
            filteredTopics = [...new Set<string>(pool.filter(q => normalizeDiscipline(q.subject) === config.discipline).map(q => q.topic))].sort();
        } else {
            filteredTopics = [...new Set<string>(pool.map(q => q.topic))].sort();
        }

        return { disciplines: dis, topics: filteredTopics };
    }, [questions, config.source, config.discipline]);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-4 font-mono text-white">
            <div className="max-w-lg w-full bg-slate-900 border-4 border-yellow-600 rounded-3xl p-8 shadow-[0_0_50px_rgba(234,179,8,0.2)] relative">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-yellow-500 uppercase italic tracking-tighter mb-2 drop-shadow-md">
                        LAW HUNTER
                    </h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Configuração de Missão</p>
                </div>

                {/* Filters */}
                <div className="space-y-4 mb-8">
                    <div>
                        <label className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1.5">Fonte de Dados</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['ALL', 'LEI_SECA', 'BANK'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setConfig({ ...config, source: opt as any, discipline: 'ALL', topic: 'ALL' })}
                                    className={`py-2 text-xs font-bold uppercase rounded border-2 transition-all ${config.source === opt ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                                >
                                    {opt === 'ALL' ? 'Aleatório' : opt === 'LEI_SECA' ? 'Lei Seca' : 'Banco'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1.5">Disciplina</label>
                        <select 
                            value={config.discipline} 
                            onChange={e => setConfig({ ...config, discipline: e.target.value, topic: 'ALL' })}
                            className="w-full bg-slate-950 border-2 border-slate-800 text-slate-300 text-xs font-bold rounded-lg p-3 outline-none focus:border-yellow-500 uppercase"
                        >
                            <option value="ALL">TODAS AS DISCIPLINAS</option>
                            {disciplines.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1.5">Tópico</label>
                        <select 
                            value={config.topic} 
                            onChange={e => setConfig({ ...config, topic: e.target.value })}
                            disabled={config.discipline === 'ALL'}
                            className="w-full bg-slate-950 border-2 border-slate-800 text-slate-300 text-xs font-bold rounded-lg p-3 outline-none focus:border-yellow-500 uppercase disabled:opacity-50"
                        >
                            <option value="ALL">QUALQUER TÓPICO</option>
                            {topics.map(t => <option key={t} value={t}>{t.substring(0, 40).toUpperCase()}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1.5">Dificuldade</label>
                        <div className="flex gap-2">
                            <button onClick={() => setConfig({...config, difficulty: 'NORMAL'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded border-2 ${config.difficulty === 'NORMAL' ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>Normal</button>
                            <button onClick={() => setConfig({...config, difficulty: 'HARDCORE'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded border-2 ${config.difficulty === 'HARDCORE' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>Hardcore</button>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button onClick={onExit} className="flex-1 py-4 rounded-xl border-2 border-slate-700 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">Voltar</button>
                    <button onClick={() => onStart(config)} className="flex-[2] py-4 rounded-xl bg-yellow-500 text-black font-black uppercase tracking-widest hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2">
                        <PlayIcon className="w-5 h-5 fill-current" /> Start Game
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: CONTEXT MODAL ---
const ContextModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    data: RoundContext;
    revealed?: boolean;
}> = ({ isOpen, onClose, data, revealed }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border-2 border-yellow-600/50 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <div className="mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${data.sourceType === 'LEI SECA' ? 'text-emerald-400' : 'text-sky-400'}`}>
                            {data.sourceType}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">•</span>
                        <span className="text-[10px] font-bold text-slate-300">{data.referenceLabel}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white leading-tight">{data.discipline}</h3>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-xl p-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    <PromptText text={data.excerpt} className="text-sm text-slate-300 font-mono leading-relaxed" />
                </div>

                {revealed && (
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-1">ALVO ENCONTRADO</span>
                        <span className="text-2xl font-black text-white">{data.targetWord}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN GAME COMPONENT ---
const LawHunterGame: React.FC<LawHunterGameProps> = ({ onExit, crtEffect }) => {
    const allQuestions = useQuestionState();
    const { updateQuestion } = useQuestionDispatch();
    const { settings, addXp } = useSettings();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | undefined>(undefined);
    
    // State
    const [state, setState] = useState<GameState>('CONFIG');
    const [activeConfig, setActiveConfig] = useState<GameConfig | null>(null);
    const [roundContext, setRoundContext] = useState<RoundContext | null>(null);
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);
    
    const [queue, setQueue] = useState<Question[]>([]);
    const [currentQIndex, setCurrentIndex] = useState(0);
    const [lives, setLives] = useState(3);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
    
    const wordsRef = useRef<FloatingWord[]>([]);
    const [feedback, setFeedback] = useState<{ type: 'correct'|'wrong', msg: string } | null>(null);
    
    // Resize Handler
    const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- GAME ENGINE ---
    
    const handleStart = (config: GameConfig) => {
        setActiveConfig(config);
        
        // Filter Pool based on Discipline
        let pool = allQuestions.filter(q => q.questionText && q.questionText.length > 50); 
        
        if (config.source === 'LEI_SECA') pool = pool.filter(q => q.lawRef || q.litRef);
        else if (config.source === 'BANK') pool = pool.filter(q => !q.lawRef && !q.litRef);

        if (config.discipline !== 'ALL') pool = pool.filter(q => normalizeDiscipline(q.subject) === config.discipline);
        if (config.topic !== 'ALL') pool = pool.filter(q => q.topic === config.topic);

        if (pool.length === 0) {
            alert("Nenhuma questão encontrada para este filtro. Expandindo para 'Qualquer Tema'.");
            pool = allQuestions.filter(q => q.questionText?.length > 50);
        }

        const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 50);
        setQueue(shuffled);
        setCurrentIndex(0);
        setScore(0);
        setLives(3);
        setStreak(0);
        
        // Difficulty settings
        const time = config.difficulty === 'HARDCORE' ? 15 : 30;
        setTimeLeft(time);

        // Try to load first round
        const firstValidQ = findNextValidQuestion(shuffled, 0);
        if (firstValidQ.idx !== -1) {
             setCurrentIndex(firstValidQ.idx);
             loadRound(firstValidQ.q, time);
             setState('PLAYING');
             retroAudio.play('START');
        } else {
             alert("Não foi possível gerar missões válidas com as questões selecionadas.");
             onExit();
        }
    };

    const findNextValidQuestion = (qList: Question[], startIdx: number): { q: Question, idx: number } => {
        for (let i = startIdx; i < qList.length; i++) {
            const context = generateRoundData(qList[i]);
            if (context) return { q: qList[i], idx: i };
        }
        return { q: qList[0], idx: -1 }; // Fail
    };

    const loadRound = (q: Question, initialTime: number) => {
        if (!q) return;
        const context = generateRoundData(q);
        
        if (!context) {
             // Skip if generation failed
             handleNextRound();
             return;
        }

        setRoundContext(context);
        setTimeLeft(initialTime);

        // Generate Physics
        const newWords: FloatingWord[] = [];
        const speedMult = activeConfig?.difficulty === 'HARDCORE' ? 2.5 : 1.5;

        // Add Target
        newWords.push({
            id: 'target',
            text: context.targetWord,
            isTarget: true,
            x: Math.random() * (dimensions.w - 100) + 50,
            y: Math.random() * (dimensions.h - HUD_HEIGHT - 100) + HUD_HEIGHT + 50,
            vx: (Math.random() - 0.5) * speedMult,
            vy: (Math.random() - 0.5) * speedMult,
            w: context.targetWord.length * 12 + 20
        });

        // Add Distractors
        const cleanDistractors = fillDistractors(context.distractors, WORDS_COUNT - 1, context.targetWord);
        cleanDistractors.forEach((d, i) => {
            newWords.push({
                id: `dist_${i}`,
                text: d,
                isTarget: false,
                x: Math.random() * (dimensions.w - 100) + 50,
                y: Math.random() * (dimensions.h - HUD_HEIGHT - 100) + HUD_HEIGHT + 50,
                vx: (Math.random() - 0.5) * (speedMult * 0.8),
                vy: (Math.random() - 0.5) * (speedMult * 0.8),
                w: d.length * 10 + 20
            });
        });

        wordsRef.current = newWords;
    };

    // Physics Loop
    useEffect(() => {
        if (state !== 'PLAYING') return;

        const update = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, dimensions.w, dimensions.h);

            wordsRef.current.forEach(word => {
                word.x += word.vx;
                word.y += word.vy;

                // Bounce Logic (Respect HUD_HEIGHT)
                if (word.x < 0 || word.x > dimensions.w - word.w) word.vx *= -1;
                if (word.y < HUD_HEIGHT + 20 || word.y > dimensions.h - 20) word.vy *= -1;

                // Draw Text
                ctx.font = `bold ${word.isTarget ? '18px' : '14px'} monospace`;
                ctx.fillStyle = '#cbd5e1'; 
                
                // Optional: Highlight for debugging/easy mode
                // if (word.isTarget) ctx.fillStyle = '#fbbf24'; 
                
                ctx.fillText(word.text, word.x, word.y);
            });

            animationFrameId.current = requestAnimationFrame(update);
        };

        animationFrameId.current = requestAnimationFrame(update);
        return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }, [state, dimensions]);

    // Timer Logic
    useEffect(() => {
        if (state === 'PLAYING' && !isContextModalOpen) {
            const interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleMiss(); 
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [state, isContextModalOpen]);

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (state !== 'PLAYING') return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Simple Hit Test (Loose box)
        const hit = wordsRef.current.find(w => {
            return x >= w.x && x <= w.x + w.w && y >= w.y - 20 && y <= w.y + 5;
        });

        if (hit) {
            if (hit.isTarget) handleSuccess();
            else handleMiss();
        }
    };

    const handleSuccess = () => {
        retroAudio.play('CORRECT');
        const points = 100 + (streak * 10) + (timeLeft * 5);
        setScore(s => s + points);
        setStreak(s => s + 1);
        setFeedback({ type: 'correct', msg: `ACHOU! +${points}` });
        
        // SRS Update
        if (queue[currentQIndex]) {
             const q = queue[currentQIndex];
             const srsResult = srs.calculateNewSrsState(q, true, 3, 10, settings);
             updateQuestion({ ...q, ...srsResult, totalAttempts: (q.totalAttempts||0)+1 });
             addXp(5, "Law Hunter Hit");
        }

        // Show context briefly or option
        // For arcade flow, move fast. User can view context in modal if they pause/want.
        // We'll show a "Revealed" modal for 2s? No, keep it fast.
        
        setState('FEEDBACK');
        setTimeout(() => {
            setFeedback(null);
            handleNextRound();
        }, 1500);
    };

    const handleMiss = () => {
        retroAudio.play('WRONG');
        setLives(l => l - 1);
        setStreak(0);
        setFeedback({ type: 'wrong', msg: "ERROU! -1 VIDA" });
        
        if (lives <= 1) {
            setState('GAMEOVER');
        } else {
            setState('FEEDBACK');
            setTimeout(() => {
                setFeedback(null);
                handleNextRound();
            }, 1500);
        }
    };

    const handleNextRound = () => {
        const next = findNextValidQuestion(queue, currentQIndex + 1);
        if (next.idx !== -1) {
             setCurrentIndex(next.idx);
             const nextTime = activeConfig?.difficulty === 'HARDCORE' ? 15 : 30;
             loadRound(next.q, nextTime);
             setState('PLAYING');
        } else {
             setState('GAMEOVER');
        }
    };

    // --- RENDER ---
    
    if (state === 'CONFIG') {
        return <LawHunterConfig questions={allQuestions} onStart={handleStart} onExit={onExit} />;
    }

    // Portal for Fullscreen Game
    const gameContent = (
        <div className={`fixed inset-0 z-[9999] flex flex-col bg-[#110000] text-white font-mono overflow-hidden select-none ${crtEffect ? 'contrast-125' : ''}`}>
             {/* CRT Overlay */}
             {crtEffect && <div className="fixed inset-0 pointer-events-none z-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAuLDAsMCwwLjEpIi8+CjxwYXRoIGQ9Ik0wIDNMNCAzIiBzdHJva2U9InJnYmEoMCwwLDAsMC4yKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-30"></div>}
            
            {/* HUD */}
            <div 
                className="absolute top-0 left-0 w-full flex flex-col p-4 z-20 bg-gradient-to-b from-black via-black/80 to-transparent"
                style={{ height: `${HUD_HEIGHT}px` }}
            >
                <div className="flex justify-between items-start">
                    <div className="max-w-[70%]">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                            MISSÃO ATUAL
                        </span>
                        <h2 className="text-2xl md:text-3xl font-black text-yellow-400 uppercase leading-none tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
                            {roundContext?.missionLabel}
                        </h2>
                        
                        {/* Reference Card */}
                        <div className="mt-3 flex items-center gap-3">
                             <div className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${roundContext?.sourceType === 'LEI SECA' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'}`}>
                                 {roundContext?.sourceType}
                             </div>
                             <div className="text-xs text-slate-300 font-bold truncate max-w-[200px]">
                                 {roundContext?.referenceLabel}
                             </div>
                             <button 
                                onClick={() => setIsContextModalOpen(true)}
                                className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-bold uppercase transition-colors text-slate-300 hover:text-white"
                             >
                                 <BookOpenIcon className="w-3 h-3"/> Ver Contexto
                             </button>
                        </div>
                        
                        <div className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide truncate">
                            {roundContext?.discipline}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <button onClick={onExit} className="text-slate-500 hover:text-white mb-1"><XMarkIcon className="w-8 h-8" /></button>
                        <div className="text-right">
                             <span className="block text-[10px] font-bold text-slate-500">SCORE</span>
                             <span className="text-3xl font-black text-white leading-none">{score.toString().padStart(6, '0')}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-auto flex justify-between items-end pb-2">
                     <div className="flex gap-1">
                        {Array.from({length: 3}).map((_, i) => (
                            <div key={i} className={`w-8 h-2 rounded-sm skew-x-[-12deg] ${i < lives ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-slate-800'}`}></div>
                        ))}
                     </div>
                     <div className="flex items-center gap-2">
                        {streak > 1 && <span className="text-orange-500 font-black animate-pulse">{streak}x COMBO</span>}
                        <span className={`text-4xl font-black tabular-nums ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}</span>
                     </div>
                </div>
            </div>

            {/* Game Canvas */}
            <canvas 
                ref={canvasRef} 
                width={dimensions.w} 
                height={dimensions.h} 
                onClick={handleCanvasClick}
                className="block w-full h-full cursor-crosshair touch-none"
            />

            {/* Overlays */}
            {feedback && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 pointer-events-none">
                    <div className={`text-6xl md:text-8xl font-black uppercase tracking-tighter transform -rotate-6 drop-shadow-2xl ${feedback.type === 'correct' ? 'text-emerald-400 animate-success-pop' : 'text-red-500 animate-error-shake'}`}>
                        {feedback.msg}
                    </div>
                </div>
            )}
            
            {/* Context Modal */}
            {roundContext && (
                <ContextModal 
                    isOpen={isContextModalOpen} 
                    onClose={() => setIsContextModalOpen(false)} 
                    data={roundContext}
                    revealed={state === 'FEEDBACK' && feedback?.type === 'correct'}
                />
            )}

            {state === 'GAMEOVER' && (
                <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-8 animate-fade-in text-center">
                    <h1 className="text-6xl md:text-8xl font-black text-yellow-500 mb-4 animate-pulse uppercase italic">GAME OVER</h1>
                    <div className="bg-slate-900 border-2 border-white/20 p-8 rounded-3xl w-full max-w-md">
                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Score</p>
                                <p className="text-4xl font-bold text-white">{score}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Rodadas</p>
                                <p className="text-4xl font-bold text-white">{currentQIndex}</p>
                            </div>
                        </div>
                        <button onClick={() => setState('CONFIG')} className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-slate-200 transition-colors">
                            Jogar Novamente
                        </button>
                        <button onClick={onExit} className="mt-4 text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest">Sair para Arena</button>
                    </div>
                </div>
            )}
        </div>
    );

    return ReactDOM.createPortal(gameContent, document.body);
};

export default LawHunterGame;
