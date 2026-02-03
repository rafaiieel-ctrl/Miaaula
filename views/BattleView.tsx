
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { Question } from '../types';
import { BoltIcon, ChevronDownIcon, ClockIcon, ArrowRightIcon } from '../components/icons';
import MasteryBadge from '../components/MasteryBadge';
import { ensureQuestionOptions } from '../services/questionParser';
import { detectTrapFailure } from '../services/trapscanService';

const shuffleArray = <T,>(array: T[]): T[] => {
    return array.slice().sort(() => Math.random() - 0.5);
};

type GamePhase = 'setup' | 'phase1' | 'phase2' | 'phase3' | 'feedback' | 'end';

interface BattleViewProps {
    mode?: 'standard' | 'instant';
    initialQuestion?: Question;
    onExit?: () => void;
}

const BattleView: React.FC<BattleViewProps> = ({ mode = 'standard', initialQuestion, onExit }) => {
    const allQuestions = useQuestionState();
    const { registerAttempt } = useQuestionDispatch();
    const { settings, addBattleHistoryEntry, logDailyActivity } = useSettings();
    const [phase, setPhase] = useState<GamePhase>('setup');
    const [gameQueue, setGameQueue] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const [eliminated, setEliminated] = useState<Set<string>>(new Set());
    const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState<any>(null);
    const [roundStartTime, setRoundStartTime] = useState(0);
    const [srsUpdates, setSrsUpdates] = useState<any>(null);

    const [sessionStats, setSessionStats] = useState({ totalScore: 0, correctCount: 0, perfectCount: 0 });
    const [discipline, setDiscipline] = useState('all');
    const [topic, setTopic] = useState('all');
    const [questionCount, setQuestionCount] = useState(5);
    const [availableCount, setAvailableCount] = useState(allQuestions.length);

    const { uniqueDisciplines, topicsForDiscipline } = useMemo(() => {
        const disciplines = [...new Set<string>(allQuestions.map(q => q.subject))].sort();
        let topics: string[] = [];
        if (discipline !== 'all') {
            topics = [...new Set<string>(allQuestions.filter(q => q.subject === discipline).map(q => q.topic))].sort();
        }
        return { uniqueDisciplines: disciplines, topicsForDiscipline: topics };
    }, [allQuestions, discipline]);

    useEffect(() => {
        let availableQuestions = allQuestions;
        if (discipline !== 'all') availableQuestions = availableQuestions.filter(q => q.subject === discipline);
        if (topic !== 'all') availableQuestions = availableQuestions.filter(q => q.topic === topic);
        setAvailableCount(availableQuestions.length);
        if (questionCount > availableQuestions.length) setQuestionCount(availableQuestions.length || 1);
    }, [discipline, topic, allQuestions, questionCount]);

    useEffect(() => {
        if (mode === 'instant' && phase === 'setup') {
            let startQ: Question | undefined = initialQuestion;
            if (!startQ) {
                if (allQuestions.length === 0) { alert("Nenhuma questão disponível para a batalha."); if (onExit) onExit(); return; }
                startQ = allQuestions[Math.floor(Math.random() * allQuestions.length)];
            }
            if (startQ) {
                const processedQ = ensureQuestionOptions(startQ);
                setGameQueue([processedQ]);
                setCurrentIndex(0);
                setSessionStats({ totalScore: 0, correctCount: 0, perfectCount: 0 });
                resetRoundState();
                setRoundStartTime(Date.now());
                setPhase('phase1');
            }
        }
    }, [mode, phase, allQuestions, onExit, initialQuestion]);

    const handleStartGame = () => {
        let availableQuestions = allQuestions;
        if (discipline !== 'all') availableQuestions = availableQuestions.filter(q => q.subject === discipline);
        if (topic !== 'all') availableQuestions = availableQuestions.filter(q => q.topic === topic);

        if (availableQuestions.length === 0) { alert("Nenhuma questão encontrada com os filtros selecionados."); return; }

        const count = Math.min(questionCount, availableQuestions.length);
        let queue = shuffleArray<Question>(availableQuestions).slice(0, count);
        queue = queue.map((q: Question) => ensureQuestionOptions(q));

        setGameQueue(queue);
        setCurrentIndex(0);
        setSessionStats({ totalScore: 0, correctCount: 0, perfectCount: 0 });
        resetRoundState();
        setRoundStartTime(Date.now());
        setPhase('phase1');
    };

    const resetRoundState = () => {
        setEliminated(new Set());
        setFinalAnswer(null);
        setScore(0);
        setFeedback(null);
        setSrsUpdates(null);
    };
    
    const handleNextQuestion = () => {
        if (currentIndex < gameQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            resetRoundState();
            setRoundStartTime(Date.now());
            setPhase('phase1');
        } else {
            logDailyActivity('PLAY_BATTLE');
            mode === 'instant' && onExit ? onExit() : setPhase('end');
        }
    };
    
    const currentQuestion = gameQueue[currentIndex];

    const handleEliminate = (optionKey: string) => {
        setEliminated(prev => {
            const newSet = new Set(prev);
            if (newSet.has(optionKey)) newSet.delete(optionKey);
            else {
                const validOptions = Object.entries(currentQuestion.options).filter(([_, v]) => v);
                if (newSet.size >= validOptions.length - 1) { alert("Não é possível eliminar todas as alternativas."); return prev; }
                newSet.add(optionKey);
            }
            return newSet;
        });
    };
    
    const handleProceedToPhase3 = () => {
        const validOptions = Object.entries(currentQuestion.options).filter(([_, v]) => v);
        if (eliminated.size >= validOptions.length) { alert("Não é possível eliminar todas as alternativas."); return; }
        setPhase('phase3');
    };

    const handleCalculateScore = () => {
        const cq = currentQuestion;
        if (!cq || finalAnswer === null) return;
        
        const timeTakenSec = (Date.now() - roundStartTime) / 1000;
        
        let correctKey = cq.correctAnswer;
        const isCe = cq.options.C === 'Certo' && cq.options.E === 'Errado';
        if (isCe) {
            if (['A', 'CERTO', 'TRUE'].includes(correctKey)) correctKey = 'C';
            if (['B', 'ERRADO', 'FALSE'].includes(correctKey)) correctKey = 'E';
        }

        const validOptions = Object.entries(cq.options).filter(([_, v]) => v).map(([k, _]) => k);
        const wrongOptions = validOptions.filter(k => k !== correctKey);
    
        let eliminationScore = 0;
        let finalAnswerScore = 0;
        let totalScore = 0;
        let eliminatedCorrectly = 0;
        let eliminatedIncorrectly = 0;
        const eliminationWeight = settings.battleEliminationWeight ?? 60;
        const finalAnswerWeight = 100 - eliminationWeight;
    
        if (eliminated.has(correctKey)) {
            eliminatedIncorrectly = 1;
            totalScore = 0;
        } else {
            const pointsPerWrong = wrongOptions.length > 0 ? eliminationWeight / wrongOptions.length : 0;
            eliminated.forEach(eliminatedKey => {
                if (wrongOptions.includes(eliminatedKey)) {
                    eliminationScore += pointsPerWrong;
                    eliminatedCorrectly++;
                }
            });
            finalAnswerScore = (finalAnswer === correctKey) ? finalAnswerWeight : 0;
            totalScore = Math.round(eliminationScore + finalAnswerScore);
        }
        
        const wasCorrect = finalAnswer === correctKey && !eliminated.has(correctKey);
    
        // TRAPSCAN PERSISTENCE
        let trapCode: string | undefined;
        if (!wasCorrect) {
            trapCode = detectTrapFailure(cq, finalAnswer) || undefined;
        } else {
            trapCode = 'CODE_CORRECT';
        }
        
        // Register via Service
        registerAttempt({
            question: cq,
            isCorrect: wasCorrect,
            userAnswer: finalAnswer,
            timeSec: timeTakenSec,
            mode: 'BATTLE',
            trapCode
        });
        
        // Local state update for session UI
        setSessionStats(prev => ({
            totalScore: prev.totalScore + totalScore,
            correctCount: prev.correctCount + (wasCorrect ? 1 : 0),
            perfectCount: prev.perfectCount + (totalScore === 100 ? 1 : 0)
        }));

        const fb = { totalScore, eliminationScore: Math.round(eliminationScore), finalAnswerScore, eliminatedCorrectly, eliminatedIncorrectly, wasCorrect };
        setScore(totalScore);
        setFeedback(fb);
        setPhase('feedback');
    
        addBattleHistoryEntry({
            questionRef: cq.questionRef,
            score: totalScore,
            wasCorrect: fb.wasCorrect,
            eliminatedCorrectly,
            eliminatedIncorrectly,
            eliminatedOptions: Array.from(eliminated),
            finalAnswer: finalAnswer,
            timeSec: Math.round(timeTakenSec),
        });
    };
    
    // ... (Renderers unchanged) ...
    if (phase === 'setup') {
        if (mode === 'instant') return <div className="p-8 text-center text-bunker-500">Preparando Batalha...</div>;
        return (
            <>
                <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
                    <div className="text-center">
                        <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white">Batalha de Alternativas</h2>
                        <p className="text-bunker-500 dark:text-bunker-400 mt-2 max-w-xl mx-auto">Aprimore sua técnica de prova: analise, elimine as opções erradas e então escolha a resposta final.</p>
                    </div>
                    <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-2xl space-y-6 border border-bunker-200 dark:border-bunker-800 shadow-lg">
                        <div>
                            <h3 className="font-bold text-lg text-sky-600 dark:text-sky-400">1. Selecione o Conteúdo</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Disciplina</label>
                                    <select value={discipline} onChange={e => { setDiscipline(e.target.value); setTopic('all'); }} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2">
                                        <option value="all">Modo Aleatório (Todas)</option>
                                        {uniqueDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tópico</label>
                                    <select value={topic} onChange={e => setTopic(e.target.value)} disabled={discipline === 'all'} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 disabled:opacity-50">
                                        <option value="all">Todos os Tópicos</option>
                                        {topicsForDiscipline.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-bunker-500 dark:text-bunker-400 mt-2">{availableCount} questões disponíveis com estes filtros.</p>
                        </div>
                        <div className="pt-6 border-t border-bunker-200 dark:border-bunker-800">
                            <h3 className="font-bold text-lg text-sky-600 dark:text-sky-400">2. Defina o Tamanho da Batalha</h3>
                            <div className="flex items-center gap-4 mt-3">
                                <input type="range" min="1" max={Math.max(1, availableCount)} value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value, 10))} disabled={availableCount === 0} className="w-full h-2 bg-bunker-200 rounded-lg appearance-none cursor-pointer dark:bg-bunker-700" />
                                <span className="font-bold text-lg w-12 text-center">{questionCount}</span>
                            </div>
                        </div>
                        <div className="pt-6 border-t border-bunker-200 dark:border-bunker-800">
                             <button onClick={handleStartGame} disabled={availableCount === 0} className="w-full bg-sky-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-sky-500/30 hover:bg-sky-50 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                <BoltIcon /> Iniciar Batalha com {questionCount} Questões
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }
    
    if (phase === 'end') {
        const accuracy = gameQueue.length > 0 ? Math.round((sessionStats.correctCount / gameQueue.length) * 100) : 0;
        return (
            <div className="max-w-xl mx-auto p-8 animate-fade-in">
                <div className="bg-bunker-100 dark:bg-bunker-900 rounded-3xl p-8 shadow-2xl border border-bunker-200 dark:border-bunker-800 text-center relative overflow-hidden">
                    <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">Batalha Finalizada!</h2>
                    <p className="text-bunker-500 dark:text-bunker-400 mb-8">Você completou {gameQueue.length} questões.</p>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white dark:bg-bunker-800 p-4 rounded-2xl border border-bunker-200 dark:border-bunker-700 shadow-sm">
                            <p className="text-xs font-bold text-bunker-400 uppercase tracking-wider mb-1">Pontuação Total</p>
                            <p className="text-3xl font-black text-sky-600 dark:text-sky-400">{sessionStats.totalScore}</p>
                        </div>
                        <div className="bg-white dark:bg-bunker-800 p-4 rounded-2xl border border-bunker-200 dark:border-bunker-700 shadow-sm">
                            <p className="text-xs font-bold text-bunker-400 uppercase tracking-wider mb-1">Precisão</p>
                            <p className={`text-3xl font-black ${accuracy >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{accuracy}%</p>
                        </div>
                    </div>
                    <button onClick={() => mode === 'instant' && onExit ? onExit() : setPhase('setup')} className="w-full bg-sky-600 text-white font-bold text-lg py-4 rounded-xl shadow-xl shadow-sky-600/30 hover:bg-sky-500 transition-all transform hover:scale-[1.02] active:scale-100 flex items-center justify-center gap-2">
                        {mode === 'instant' ? "Sair do Modo Porrada" : "Jogar Novamente"}
                    </button>
                </div>
            </div>
        );
    }

    if (!currentQuestion) return <div>Carregando...</div>;
    const validOptions = Object.entries(currentQuestion.options || {}).filter(([_,v])=>v);
    const remainingOptions = validOptions.filter(([key,_]) => !eliminated.has(key));
    const minEliminations = Math.max(1, Math.min(2, validOptions.length - 2));

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-xl">{currentQuestion.questionRef}</h2>
                <span className="font-mono text-sm bg-bunker-100 dark:bg-bunker-800 px-3 py-1 rounded-lg">{currentIndex + 1} / {gameQueue.length}</span>
            </div>
            
            {(phase === 'phase1' || phase === 'phase2' || phase === 'phase3' || phase === 'feedback') && (
                <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg animate-fade-in">
                    <p className="whitespace-pre-wrap text-lg">{currentQuestion.questionText}</p>
                </div>
            )}
            {phase === 'phase1' && <button onClick={() => setPhase('phase2')} className="w-full bg-sky-500 text-white font-bold py-3 rounded-lg">Já li, mostrar alternativas</button>}

            {phase === 'phase2' && (
                <div className="space-y-3 animate-fade-in">
                    <h3 className="font-semibold text-center text-bunker-500 dark:text-bunker-400">Fase de Eliminação</h3>
                    {validOptions.map(([key, value]) => {
                        const isEliminated = eliminated.has(key);
                        return (
                            <button key={key} onClick={() => handleEliminate(key)} className={`p-4 rounded-lg flex justify-between items-center transition-all w-full text-left ${isEliminated ? 'bg-rose-900/20 text-gray-500 line-through decoration-rose-400' : 'bg-bunker-100 dark:bg-bunker-900 hover:bg-bunker-200/50'}`}>
                                <p className={`flex-grow ${isEliminated ? '' : 'text-slate-800 dark:text-slate-200'}`}><span className="font-bold no-underline text-gray-800 dark:text-gray-300">{key})</span> {value}</p>
                                <span className={`text-xs font-bold rounded-full px-3 py-1 border transition-colors shrink-0 ml-4 ${isEliminated ? 'text-rose-600 dark:text-rose-400 border-rose-600/30' : 'text-rose-500 border-rose-500 hover:bg-rose-500 hover:text-white'}`}>{isEliminated ? 'Desfazer' : 'Eliminar'}</span>
                            </button>
                        );
                    })}
                    <button onClick={handleProceedToPhase3} disabled={eliminated.size < minEliminations} className="w-full bg-sky-500 text-white font-bold py-3 rounded-lg disabled:opacity-50">Escolher resposta final</button>
                </div>
            )}
            
            {phase === 'phase3' && (
                 <div className="space-y-3 animate-fade-in">
                    <h3 className="font-semibold text-center text-bunker-500 dark:text-bunker-400">Fase de Escolha</h3>
                    {remainingOptions.map(([key, value]) => (
                        <label key={key} className={`p-4 rounded-lg flex items-center gap-3 cursor-pointer border-2 ${finalAnswer === key ? 'border-sky-500 bg-sky-500/10' : 'border-bunker-200 dark:border-bunker-700'}`}>
                            <input type="radio" name="finalAnswer" value={key} onChange={(e) => setFinalAnswer(e.target.value)} className="w-4 h-4" />
                            <p><span className="font-bold">{key})</span> {value}</p>
                        </label>
                    ))}
                    <button onClick={handleCalculateScore} disabled={!finalAnswer} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-lg disabled:opacity-50">Confirmar Resposta</button>
                </div>
            )}

            {phase === 'feedback' && feedback && (
                <div className="space-y-4 animate-fade-in">
                    <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg text-center">
                        <h3 className="text-2xl font-bold">{feedback.wasCorrect ? "RESPOSTA CORRETA!" : "RESPOSTA INCORRETA"}</h3>
                        <p className="text-6xl font-bold my-4">{score} <span className="text-3xl text-bunker-400">/ 100</span></p>
                    </div>
                    {currentQuestion.explanation && (
                         <div className="p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                            <h4 className="font-bold mb-2">Comentário</h4>
                            <p className="text-sm whitespace-pre-wrap">{currentQuestion.explanation}</p>
                        </div>
                    )}
                    <button onClick={handleNextQuestion} className="w-full bg-sky-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                        {currentIndex < gameQueue.length - 1 ? "Próxima Questão" : "Finalizar Jogo"} <ArrowRightIcon />
                    </button>
                </div>
            )}
        </div>
    );
};

export default BattleView;
