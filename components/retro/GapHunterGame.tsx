
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Question, LiteralnessCard } from '../../types';
import { useQuestionState } from '../../contexts/QuestionContext';
import { useLiteralnessState } from '../../contexts/LiteralnessContext';
import { useSettings } from '../../contexts/SettingsContext';
import { XMarkIcon, PlayIcon, BookOpenIcon, MapIcon, BoltIcon, ScaleIcon, GavelIcon, ClipboardDocumentCheckIcon, ArrowPathIcon } from '../icons';
import { retroAudio } from '../../services/retroAudioService';
import * as srs from '../../services/srsService';
import { repository } from '../../services/repository'; // IMPORT REPO
import { normalizeDiscipline } from '../../services/taxonomyService';
import PromptText from '../ui/PromptText';

// --- TYPES & ADAPTERS ---

interface GapItem {
    id: string;
    discipline: string;
    topic: string;
    sourceType: 'LEI_SECA' | 'JURISPRUDENCIA' | 'NORMAS' | 'QUESTÃO';
    refLabel: string;
    prompt: string;
    answer: string;
    fullText: string;
}

interface GapHunterGameProps {
    onExit: () => void;
    crtEffect: boolean;
}

interface FloatingChip {
    id: string;
    text: string;
    isTarget: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
}

interface GapRound {
    gapItem: GapItem;
    distractors: string[];
}

interface LevelConfig {
    time: number;
    wordCount: number;
    speedMult: number;
    lives: number;
    label: string;
}

// --- CONSTANTS ---
const HUD_HEIGHT = 180; // Increased slightly for centered layout
const LEVELS: Record<number, LevelConfig> = {
    1: { time: 60, wordCount: 6, speedMult: 0.5, lives: 3, label: 'NÍVEL 1: INICIANTE' },
    2: { time: 55, wordCount: 9, speedMult: 0.7, lives: 3, label: 'NÍVEL 2: APRENDIZ' },
    3: { time: 50, wordCount: 12, speedMult: 0.9, lives: 3, label: 'NÍVEL 3: ESTUDANTE' },
    4: { time: 45, wordCount: 14, speedMult: 1.1, lives: 2, label: 'NÍVEL 4: AVANÇADO' },
    5: { time: 40, wordCount: 16, speedMult: 1.3, lives: 2, label: 'NÍVEL 5: EXPERT' },
    6: { time: 35, wordCount: 18, speedMult: 1.5, lives: 2, label: 'NÍVEL 6: MESTRE' },
    7: { time: 35, wordCount: 20, speedMult: 1.8, lives: 1, label: 'NÍVEL 7: INSANO' },
    8: { time: 30, wordCount: 22, speedMult: 2.2, lives: 1, label: 'NÍVEL 8: LENDÁRIO' },
    9: { time: 30, wordCount: 25, speedMult: 2.6, lives: 1, label: 'NÍVEL 9: DEUS DA LEI' },
    10: { time: 25, wordCount: 28, speedMult: 3.5, lives: 1, label: 'NÍVEL FINAL: ONISCIENTE' },
};

// --- HELPERS ---

const cleanWord = (w: string): string => w.trim().replace(/[.,;:"'()]/g, '');
const normalizeString = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

const formatPrettyRef = (ref: string, article?: string): string => {
    if (!ref) return '—';
    let cleanRef = ref.replace(/_/g, ' ').replace('LEG ', '').replace('CONST ', '');
    
    if (cleanRef.includes('CTN')) cleanRef = 'CTN';
    if (cleanRef.includes('CF') || cleanRef.includes('CONSTITUICAO')) cleanRef = 'CF/88';
    if (cleanRef.includes('CC')) cleanRef = 'Código Civil';
    if (cleanRef.includes('CP')) cleanRef = 'Código Penal';
    
    if (article) {
        return `${cleanRef} • ${article}`;
    }
    return cleanRef;
};

// Helper to normalize content types into GapItem source types
// Fixes TS error: Type '"LEI_SECA" | LawContentType' is not assignable to type 'GapItem["sourceType"]'
function normalizeGapSourceType(raw: unknown): GapItem['sourceType'] {
  const v = String(raw ?? "").toUpperCase();

  if (v.includes("JUR")) return "JURISPRUDENCIA";
  if (v.includes("NORM")) return "NORMAS";
  if (v.includes("QUEST")) return "QUESTÃO";

  // Tudo que vier do Literalness (ex: LAW_DRY) vira Lei Seca no jogo
  return "LEI_SECA";
}

// --- DATA AGGREGATION ---

const extractGapsFromQuestions = (questions: Question[]): GapItem[] => {
    const items: GapItem[] = [];
    questions.forEach(q => {
        if (!q.isGapType && !q.questionText.includes('{{') && !q.questionText.includes('___')) return;
        
        let prompt = q.questionText;
        let answer = '';

        const match = q.questionText.match(/\{\{(.+?)\}\}/);
        if (match) {
            answer = match[1].trim();
            prompt = q.questionText.replace(/\{\{.+?\}\}/, "______");
        } else if (q.options && q.correctAnswer && q.options[q.correctAnswer]) {
            answer = q.options[q.correctAnswer]!;
            prompt = q.questionText; 
        }

        if (answer && answer.length > 1) {
            items.push({
                id: q.id,
                discipline: normalizeDiscipline(q.subject),
                topic: q.topic || 'Geral',
                sourceType: 'QUESTÃO',
                refLabel: q.questionRef || 'Questão',
                prompt,
                answer,
                fullText: q.questionText
            });
        }
    });
    return items;
};

// --- GAME LOGIC ---

const generateRound = (targetItem: GapItem, allItems: GapItem[], level: number): GapRound => {
    const config = LEVELS[level] || LEVELS[10];
    const neededDistractors = config.wordCount - 1;
    
    const pool = allItems.filter(i => 
        i.id !== targetItem.id && 
        i.discipline === targetItem.discipline
    );
    
    const candidates = new Set<string>();
    
    pool.forEach(p => {
        if (candidates.size < neededDistractors * 2) { 
            const ansNorm = normalizeString(p.answer);
            const tgtNorm = normalizeString(targetItem.answer);
            if (ansNorm !== tgtNorm && ansNorm.length > 2) {
                candidates.add(cleanWord(p.answer));
            }
        }
    });

    const LEGAL_FILLERS = [
        "Nulidade", "Eficácia", "Vigência", "Dolo", "Culpa", "Liminar", "Mérito", "Recurso",
        "Preclusão", "Revelia", "Trânsito", "Julgado", "Ex Tunc", "Ex Nunc", "Lícito", "Ilícito",
        "Ativo", "Passivo", "Solidário", "Subsidiário", "Taxa", "Imposto", "Pena", "Multa"
    ];

    LEGAL_FILLERS.forEach(w => candidates.add(w));

    const finalDistractors = Array.from(candidates)
        .sort(() => Math.random() - 0.5)
        .slice(0, neededDistractors);
        
    return {
        gapItem: targetItem,
        distractors: finalDistractors
    };
};

// --- CONFIG COMPONENT ---
interface GameConfig {
    discipline: string;
}

const GapHunterConfig: React.FC<{ 
    allGaps: GapItem[], 
    onStart: (config: GameConfig) => void, 
    onExit: () => void,
    isLoading: boolean
}> = ({ allGaps, onStart, onExit, isLoading }) => {
    const [discipline, setDiscipline] = useState('ALL');
    
    const stats = useMemo(() => {
        const discCounts: Record<string, number> = {};
        const sourceCounts: Record<string, number> = { 'LEI_SECA': 0, 'QUESTÃO': 0, 'JURISPRUDENCIA': 0, 'NORMAS': 0 };
        
        allGaps.forEach(g => {
            discCounts[g.discipline] = (discCounts[g.discipline] || 0) + 1;
            if (sourceCounts[g.sourceType] !== undefined) sourceCounts[g.sourceType]++;
        });
        
        return { discCounts, sourceCounts };
    }, [allGaps]);

    const disciplines = useMemo(() => ['ALL', ...Object.keys(stats.discCounts).sort()], [stats]);

    const handlePlayClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onStart({ discipline });
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center p-4 font-mono text-white animate-fade-in">
            <div className="max-w-md w-full bg-slate-900 border-4 border-sky-600 rounded-3xl p-8 shadow-[0_0_50px_rgba(14,165,233,0.2)] relative">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-sky-500 uppercase italic tracking-tighter mb-2 drop-shadow-md">GAP HUNTER</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Complete a Lacuna</p>
                </div>
                
                {isLoading ? (
                     <div className="flex flex-col items-center py-10">
                        <ArrowPathIcon className="w-10 h-10 text-sky-500 animate-spin mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Carregando Base de Dados...</p>
                     </div>
                ) : (
                    <>
                        <div className="mb-6 bg-slate-950 rounded-xl p-4 border border-white/5 grid grid-cols-3 gap-2 text-center">
                             <div className="flex flex-col items-center">
                                 <MapIcon className="w-5 h-5 text-amber-500 mb-1" />
                                 <span className="text-lg font-bold text-white">{stats.sourceCounts.LEI_SECA}</span>
                                 <span className="text-[8px] uppercase text-slate-500 font-bold">Lei Seca</span>
                             </div>
                             <div className="flex flex-col items-center">
                                 <GavelIcon className="w-5 h-5 text-purple-500 mb-1" />
                                 <span className="text-lg font-bold text-white">{stats.sourceCounts.JURISPRUDENCIA}</span>
                                 <span className="text-[8px] uppercase text-slate-500 font-bold">Juris</span>
                             </div>
                             <div className="flex flex-col items-center">
                                 <ClipboardDocumentCheckIcon className="w-5 h-5 text-teal-500 mb-1" />
                                 <span className="text-lg font-bold text-white">{stats.sourceCounts.NORMAS}</span>
                                 <span className="text-[8px] uppercase text-slate-500 font-bold">Normas</span>
                             </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <label className="block text-[10px] font-black text-sky-600 uppercase tracking-widest mb-1.5">Filtro de Disciplina</label>
                            <select 
                                value={discipline} 
                                onChange={e => setDiscipline(e.target.value)} 
                                className="w-full bg-slate-950 border-2 border-slate-800 text-slate-300 text-xs font-bold rounded-lg p-3 outline-none uppercase focus:border-sky-500"
                            >
                                {disciplines.map(d => (
                                    <option key={d} value={d}>
                                        {d} {d !== 'ALL' ? `(${stats.discCounts[d]})` : `(${allGaps.length})`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={onExit} 
                                className="flex-1 py-4 rounded-xl border-2 border-slate-700 text-slate-400 font-black uppercase hover:bg-slate-800 transition-colors"
                            >
                                Sair
                            </button>
                            <button 
                                type="button" 
                                onClick={handlePlayClick} 
                                disabled={allGaps.length === 0}
                                className="flex-[2] py-4 rounded-xl bg-sky-500 text-black font-black uppercase hover:bg-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <PlayIcon className="w-5 h-5 fill-current" /> JOGAR
                            </button>
                        </div>
                        
                        {allGaps.length === 0 && (
                            <p className="text-xs text-rose-500 text-center mt-4 font-bold animate-pulse">
                                Sem lacunas encontradas. Importe Lei Seca, Jurisprudência ou Normas.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const GapHunterGame: React.FC<GapHunterGameProps> = ({ onExit, crtEffect }) => {
    const allQuestions = useQuestionState();
    const allCards = useLiteralnessState(); // Used for mapping Law ID lookup if needed
    const { addXp } = useSettings();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);

    // Data State
    const [dbGaps, setDbGaps] = useState<GapItem[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Game State
    const [gameState, setGameState] = useState<'CONFIG' | 'PLAYING' | 'GAMEOVER'>('CONFIG');
    const [config, setConfig] = useState<GameConfig | null>(null);
    const [round, setRound] = useState<GapRound | null>(null);
    const [level, setLevel] = useState(1);
    
    // Stats
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [combo, setCombo] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    
    // UI
    const [showContext, setShowContext] = useState(false);
    const [feedback, setFeedback] = useState<'HIT'|'MISS'|null>(null);

    // Refs
    const chipsRef = useRef<FloatingChip[]>([]);
    const dimensions = useRef({ w: window.innerWidth, h: window.innerHeight });

    // --- DATA LOADING ---
    useEffect(() => {
        const load = async () => {
            setIsLoadingData(true);
            try {
                // 1. Fetch from Content Store (Lei Seca)
                const rawDbGaps = await repository.getAllGaps();
                const mappedDbGaps: GapItem[] = rawDbGaps.map(item => {
                    const p = item.payload;
                    const card = allCards.find(c => c.id === item.litRef);
                    return {
                        id: item.id,
                        discipline: normalizeDiscipline(card?.lawId || 'GERAL'),
                        topic: card?.topic || 'Geral',
                        // FIX: Using robust normalizer
                        sourceType: normalizeGapSourceType(card?.contentType),
                        refLabel: card?.article ? `${card.lawId} • ${card.article}` : item.litRef,
                        prompt: (p.lacuna_text || p.text || "").replace(/\{\{.+?\}\}/, "______"),
                        answer: p.correct_text || p.correct || 'Erro',
                        fullText: p.lacuna_text || p.text || ""
                    };
                });

                // 2. Fetch from Questions Context (Questões com lacunas)
                const questionGaps = extractGapsFromQuestions(allQuestions);
                
                // 3. Merge
                const merged = [...mappedDbGaps, ...questionGaps];
                
                // Dedupe
                const unique = new Map<string, GapItem>();
                merged.forEach(g => {
                    if (g.answer && g.answer.length > 1) {
                         const key = `${g.prompt.trim()}-${g.answer.trim().toLowerCase()}`;
                         if (!unique.has(key)) unique.set(key, g);
                    }
                });

                setDbGaps(Array.from(unique.values()));
            } catch (e) {
                console.error("GapHunter load failed", e);
            } finally {
                setIsLoadingData(false);
            }
        };
        load();
    }, [allQuestions, allCards]);

    // --- RESIZE ---
    useEffect(() => {
        const handleResize = () => { dimensions.current = { w: window.innerWidth, h: window.innerHeight }; };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- GAME LOOP ---
    const startGame = (cfg: GameConfig) => {
        let pool = dbGaps;
        if (cfg.discipline !== 'ALL') {
            pool = pool.filter(g => g.discipline === cfg.discipline);
        }

        // Diagnostics Log
        const counts = { LEI: 0, NORMAS: 0, JURIS: 0, Q: 0 };
        pool.forEach(p => {
             if (p.sourceType === 'LEI_SECA') counts.LEI++;
             else if (p.sourceType === 'NORMAS') counts.NORMAS++;
             else if (p.sourceType === 'JURISPRUDENCIA') counts.JURIS++;
             else counts.Q++;
        });
        console.log(`[GAP_HUNTER] discipline=${cfg.discipline}`);
        console.log(`[GAP_HUNTER] leiSeca=${counts.LEI}, normas=${counts.NORMAS}, jurisprudencia=${counts.JURIS}, questions=${counts.Q}`);
        console.log(`[GAP_HUNTER] total=${pool.length}`);
        
        if (pool.length === 0) {
            alert(`Nenhuma lacuna encontrada para ${cfg.discipline}.`);
            return;
        }

        setConfig(cfg);
        setScore(0);
        setLevel(1);
        setLives(LEVELS[1].lives);
        setCombo(0);
        
        const success = loadNextRound(pool, 1);
        if (success) {
            setGameState('PLAYING');
            retroAudio.play('START');
        }
    };

    const loadNextRound = (pool: GapItem[], lvl: number): boolean => {
        if (pool.length === 0) return false;

        let nextRound: GapRound | null = null;
        let attempts = 0;
        
        while (!nextRound && attempts < 20) {
            const target = pool[Math.floor(Math.random() * pool.length)];
            nextRound = generateRound(target, dbGaps, lvl); 
            attempts++;
        }

        if (!nextRound) {
            alert("Não foi possível gerar rodada válida.");
            onExit();
            return false;
        }

        setRound(nextRound);
        setTimeLeft(LEVELS[lvl].time);
        spawnChips(nextRound, lvl);
        return true;
    };

    const spawnChips = (rnd: GapRound, lvl: number) => {
        const { gapItem, distractors } = rnd;
        const allWords = [gapItem.answer, ...distractors].sort(() => Math.random() - 0.5);
        const cfg = LEVELS[lvl] || LEVELS[10];
        
        const newChips: FloatingChip[] = [];
        allWords.forEach((text, i) => {
            const w = Math.min(300, text.length * 12 + 40); 
            const h = 44;
            const startX = Math.random() * (dimensions.current.w - w);
            const startY = Math.random() * (dimensions.current.h - HUD_HEIGHT - 100) + HUD_HEIGHT + 50;
            
            const isTarget = text === gapItem.answer;
            
            newChips.push({
                id: `chip_${i}_${Date.now()}`,
                text,
                isTarget,
                x: startX,
                y: startY,
                vx: (Math.random() - 0.5) * cfg.speedMult * 2.0,
                vy: (Math.random() - 0.5) * cfg.speedMult * 2.0,
                w, h
            });
        });
        chipsRef.current = newChips;
    };

    // --- PHYSICS ---
    const updatePhysics = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        ctx.clearRect(0, 0, dimensions.current.w, dimensions.current.h);
        
        // HUD Line
        ctx.beginPath();
        ctx.moveTo(0, HUD_HEIGHT);
        ctx.lineTo(dimensions.current.w, HUD_HEIGHT);
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        chipsRef.current.forEach(chip => {
            chip.x += chip.vx;
            chip.y += chip.vy;

            // Bounce
            if (chip.x < 0 || chip.x + chip.w > dimensions.current.w) chip.vx *= -1;
            if (chip.y < HUD_HEIGHT || chip.y + chip.h > dimensions.current.h) chip.vy *= -1;

            // Draw Chip
            ctx.fillStyle = chip.isTarget && level <= 2 ? 'rgba(14, 165, 233, 0.1)' : 'rgba(15, 23, 42, 0.9)'; 
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
            
            ctx.beginPath();
            ctx.roundRect(chip.x, chip.y, chip.w, chip.h, 12);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = "bold 14px monospace";
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            const displayText = chip.text.length > 25 ? chip.text.substring(0, 22) + '...' : chip.text;
            ctx.fillText(displayText, chip.x + chip.w / 2, chip.y + 26);
        });

        requestRef.current = requestAnimationFrame(updatePhysics);
    };

    useEffect(() => {
        if (gameState === 'PLAYING') {
            requestRef.current = requestAnimationFrame(updatePhysics);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [gameState, level]);

    // Timer
    useEffect(() => {
        if (gameState === 'PLAYING' && !showContext) {
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                         handleFail();
                         return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [gameState, showContext]);

    // --- INTERACTION ---
    const handleCanvasClick = (e: React.MouseEvent) => {
        if (gameState !== 'PLAYING') return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        const hit = chipsRef.current.find(c => cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h);

        if (hit) {
            if (hit.isTarget) handleSuccess();
            else handleFail();
        }
    };

    const handleSuccess = () => {
        retroAudio.play('CORRECT');
        setFeedback('HIT');
        
        const pts = 100 + (combo * 20) + (timeLeft * 2);
        setScore(s => s + pts);
        setCombo(c => c + 1);
        addXp(5, "Gap Hunter");

        let nextLevel = level;
        if (combo > 0 && combo % 2 === 0 && level < 10) {
            nextLevel++;
            retroAudio.play('LEVELUP');
            setLives(l => Math.min(l + 1, LEVELS[nextLevel].lives + 2)); 
        }
        setLevel(nextLevel);

        setTimeout(() => {
            setFeedback(null);
            if (config) {
                let pool = dbGaps;
                if (config.discipline !== 'ALL') pool = pool.filter(g => g.discipline === config.discipline);
                loadNextRound(pool, nextLevel);
            }
        }, 500);
    };

    const handleFail = () => {
        retroAudio.play('WRONG');
        setFeedback('MISS');
        setLives(l => l - 1);
        setCombo(0);
        
        if (lives <= 1) {
            setGameState('GAMEOVER');
        } else {
             setTimeout(() => {
                 setFeedback(null);
                 if (config) {
                    let pool = dbGaps;
                    if (config.discipline !== 'ALL') pool = pool.filter(g => g.discipline === config.discipline);
                    loadNextRound(pool, level);
                 }
             }, 500);
        }
    };

    if (gameState === 'CONFIG') return <GapHunterConfig allGaps={dbGaps} onStart={startGame} onExit={onExit} isLoading={isLoadingData} />;

    return ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[9999] bg-[#020408] text-white overflow-hidden font-mono select-none ${crtEffect ? 'contrast-125' : ''}`}>
             {/* CRT Overlay */}
             {crtEffect && <div className="absolute inset-0 pointer-events-none z-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAuLDAsMCwwLjEpIi8+CjxwYXRoIGQ9Ik0wIDNMNCAzIiBzdHJva2U9InJnYmEoMCwwLDAsMC4yKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-30"></div>}
            
            {/* HUD */}
            <div className="absolute top-0 left-0 w-full p-0 z-20 bg-gradient-to-b from-slate-900 via-slate-900/90 to-transparent pointer-events-none" style={{ height: HUD_HEIGHT }}>
                
                {/* CENTERED MISSION HUD */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl text-center pointer-events-auto flex flex-col items-center">
                    {/* Title Row */}
                    <div className="flex items-center gap-3 mb-2 bg-black/30 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MISSÃO ATUAL</span>
                        <div className="h-3 w-px bg-white/10"></div>
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">{LEVELS[level].label}</span>
                    </div>

                    {/* Prompt */}
                    <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-3 drop-shadow-lg font-sans px-4">
                        {round?.gapItem.prompt.split(/______/).map((part, i) => (
                            <React.Fragment key={i}>
                            {part}
                            {i < round.gapItem.prompt.split(/______/).length - 1 && (
                                <span className="inline-block mx-1 border-b-4 border-sky-500 min-w-[60px] align-bottom relative top-[-4px] animate-pulse opacity-80"></span>
                            )}
                            </React.Fragment>
                        ))}
                    </h2>

                    {/* Metadata */}
                    <div className="flex items-center justify-center flex-wrap gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="text-sky-600">{round?.gapItem.discipline}</span>
                        <span className="opacity-30">•</span>
                        <span>{round?.gapItem.refLabel}</span>
                        <button onClick={() => setShowContext(true)} className="ml-2 flex items-center gap-1 text-slate-300 hover:text-white pointer-events-auto transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10">
                            <BookOpenIcon className="w-3 h-3"/> CONTEXTO
                        </button>
                    </div>
                </div>

                {/* RIGHT CONTROLS */}
                <div className="absolute top-4 right-4 flex flex-col items-end pointer-events-auto">
                    <button onClick={onExit} className="p-2 text-slate-500 hover:text-white mb-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><XMarkIcon className="w-6 h-6"/></button>
                    <div className="text-right bg-slate-900/50 p-2 rounded-xl border border-white/5 backdrop-blur-sm">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">SCORE</span>
                        <div className="text-2xl font-black text-white leading-none tracking-tighter">{score.toString().padStart(6, '0')}</div>
                    </div>
                </div>
            </div>

            {/* FEEDBACK OVERLAY */}
            {feedback && (
                 <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-30 ${feedback === 'HIT' ? 'bg-sky-500/10' : 'bg-red-500/10'}`}>
                     <h1 className={`text-6xl font-black italic uppercase tracking-tighter animate-bounce ${feedback === 'HIT' ? 'text-sky-400' : 'text-red-500'}`}>
                         {feedback === 'HIT' ? 'EXATO!' : 'ERROU!'}
                     </h1>
                 </div>
            )}

            {/* Bottom Status */}
            <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-end pointer-events-none">
                <div className="flex flex-col gap-2">
                    {combo > 1 && <div className="text-yellow-400 font-black italic text-xl animate-bounce">{combo}x COMBO</div>}
                    <div className="flex gap-1">
                        {Array.from({length: 5}).map((_, i) => (
                            <div key={i} className={`w-6 h-3 skew-x-[-12deg] border border-slate-700 ${i < lives ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-transparent'}`}></div>
                        ))}
                    </div>
                </div>
                <div className={`text-5xl font-black tabular-nums ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {timeLeft}
                </div>
            </div>

            <canvas 
                ref={canvasRef}
                width={dimensions.current.w}
                height={dimensions.current.h}
                onClick={handleCanvasClick}
                className="block w-full h-full cursor-crosshair touch-none relative z-10"
            />

            {/* Game Over Modal */}
            {gameState === 'GAMEOVER' && (
                <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center animate-fade-in text-center p-6">
                    <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-2">FIM DE JOGO</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest mb-8">Score Final: {score}</p>
                    <div className="flex gap-4">
                        <button onClick={() => { setGameState('CONFIG'); retroAudio.play('SELECT'); }} className="px-8 py-3 bg-white text-black font-black uppercase rounded-xl hover:scale-105 transition-transform">Jogar Novamente</button>
                        <button onClick={onExit} className="px-8 py-3 border-2 border-white/20 text-white font-black uppercase rounded-xl hover:bg-white/10 transition-colors">Sair</button>
                    </div>
                </div>
            )}

            {/* Context Modal */}
            {showContext && round && (
                <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowContext(false)}>
                    <div className="bg-slate-900 border-2 border-white/10 w-full max-w-lg rounded-3xl shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowContext(false)} className="absolute top-4 right-4"><XMarkIcon className="w-5 h-5 text-slate-400"/></button>
                        <h3 className="text-lg font-bold text-white mb-4">Contexto Original</h3>
                        <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-sm text-slate-300 leading-relaxed font-serif max-h-[60vh] overflow-y-auto">
                            <div className="mb-2 text-[10px] font-bold text-sky-500 uppercase">{round.gapItem.refLabel}</div>
                            <PromptText text={round.gapItem.fullText} />
                        </div>
                    </div>
                </div>
            )}

        </div>,
        document.body
    );
};

export default GapHunterGame;
