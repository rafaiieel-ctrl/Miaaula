
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import { Question } from '../types';
import * as srs from '../services/srsService';
import { 
    ClipboardListIcon, ClockIcon, CheckCircleIcon, XCircleIcon, 
    ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon,
    ExitFullScreenIcon, FullScreenIcon, LightBulbIcon
} from '../components/icons';

interface ExamModeViewProps {
    onExit: () => void;
}

type Phase = 'config' | 'running' | 'results';

const ExamModeView: React.FC<ExamModeViewProps> = ({ onExit }) => {
    const allQuestions = useQuestionState();
    const { updateQuestion } = useQuestionDispatch();
    const { settings, logDailyActivity, addXp } = useSettings();

    // Config State
    const [phase, setPhase] = useState<Phase>('config');
    const [selectedSubject, setSelectedSubject] = useState('all');
    const [questionCount, setQuestionCount] = useState(15);
    const [isTimed, setIsTimed] = useState(true);

    // Exam State
    const [examQueue, setExamQueue] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({}); 
    const [flags, setFlags] = useState<Set<string>>(new Set()); 
    const [timeLeft, setTimeLeft] = useState(0); 
    const [startTime, setStartTime] = useState(0);
    
    // Result State
    const [finalScore, setFinalScore] = useState(0);
    const [timeTaken, setTimeTaken] = useState(0);
    const [resultDetails, setResultDetails] = useState<{ id: string, isCorrect: boolean }[]>([]);
    const [detailQuestion, setDetailQuestion] = useState<Question | null>(null);

    const timerRef = useRef<number | null>(null);

    // --- Helpers ---
    const { uniqueSubjects } = useMemo(() => {
        const subjects = [...new Set(allQuestions.map(q => q.subject))].sort();
        return { uniqueSubjects: subjects };
    }, [allQuestions]);

    const availableCount = useMemo(() => {
        if (selectedSubject === 'all') return allQuestions.length;
        return allQuestions.filter(q => q.subject === selectedSubject).length;
    }, [allQuestions, selectedSubject]);

    // --- Actions ---

    const handleStartExam = () => {
        let pool = allQuestions;
        if (selectedSubject !== 'all') {
            pool = pool.filter(q => q.subject === selectedSubject);
        }

        if (pool.length === 0) {
            alert("Nenhuma questão disponível para os filtros selecionados.");
            return;
        }

        const count = Math.min(questionCount, pool.length);
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);

        setExamQueue(shuffled);
        setCurrentIndex(0);
        setAnswers({});
        setFlags(new Set());
        setStartTime(Date.now());
        
        if (isTimed) {
            setTimeLeft(count * 3 * 60); // 3 min per question
        } else {
            setTimeLeft(0);
        }

        setPhase('running');
        enterFullScreen();
    };

    const enterFullScreen = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log(err));
        }
    };

    const exitFullScreen = () => {
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
    };

    // --- Running Logic ---

    useEffect(() => {
        if (phase === 'running' && isTimed) {
            timerRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleSubmitExam();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [phase, isTimed]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (phase === 'running') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [phase]);

    const handleSelectOption = (optionKey: string) => {
        const qId = examQueue[currentIndex].id;
        setAnswers(prev => ({ ...prev, [qId]: optionKey }));
    };

    const handleToggleFlag = () => {
        const qId = examQueue[currentIndex].id;
        setFlags(prev => {
            const next = new Set(prev);
            if (next.has(qId)) next.delete(qId);
            else next.add(qId);
            return next;
        });
    };

    const handleSubmitExam = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        
        const now = Date.now();
        const durationSec = Math.round((now - startTime) / 1000);
        const avgTimePerQuestion = durationSec / examQueue.length;

        let correctCount = 0;
        const details: { id: string, isCorrect: boolean }[] = [];

        examQueue.forEach(q => {
            const userAnswer = answers[q.id];
            
            let correctKey = q.correctAnswer;
            // Normalize C/E
            if (q.options.C === 'Certo' && q.options.E === 'Errado') {
                if (['A', 'CERTO', 'TRUE'].includes(correctKey)) correctKey = 'C';
                if (['B', 'ERRADO', 'FALSE'].includes(correctKey)) correctKey = 'E';
            } else if (q.options.A?.toLowerCase() === 'certo' && q.options.B?.toLowerCase() === 'errado') {
                 if (['C', 'CERTO', 'TRUE'].includes(correctKey)) correctKey = 'A';
                 if (['E', 'ERRADO', 'FALSE'].includes(correctKey)) correctKey = 'B';
            }

            const isCorrect = userAnswer === correctKey;
            if (isCorrect) correctCount++;
            
            details.push({ id: q.id, isCorrect });

            if (userAnswer) { 
                const selfEval = isCorrect ? 2 : 0;
                const srsResult = srs.calculateNewSrsState(q, isCorrect, selfEval, avgTimePerQuestion, settings);
                
                const updatedQ: Question = {
                    ...q,
                    yourAnswer: userAnswer,
                    ...srsResult,
                    attemptHistory: [
                        ...(q.attemptHistory || []),
                        {
                            date: srsResult.lastReviewedAt!,
                            wasCorrect: isCorrect,
                            masteryAfter: srsResult.masteryScore!,
                            stabilityAfter: srsResult.stability,
                            timeSec: Math.round(avgTimePerQuestion),
                            selfEvalLevel: selfEval,
                            timingClass: srsResult.timingClass,
                            targetSec: srsResult.targetSec,
                        }
                    ]
                };
                updateQuestion(updatedQ);
            }
        });

        setFinalScore(correctCount);
        setTimeTaken(durationSec);
        setResultDetails(details);
        setPhase('results');
        
        logDailyActivity('FINISH_EXAM');
        addXp(correctCount * 20 + 50, "Simulado Concluído!");
        exitFullScreen();
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // --- Renderers ---

    if (phase === 'config') {
        return (
            <div className="max-w-xl mx-auto p-6 animate-fade-in">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <ClipboardListIcon className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Modo Simulado</h2>
                    <p className="text-bunker-500 dark:text-bunker-400 mt-2">
                        Treine sob pressão. Sem feedback imediato. Foco total.
                    </p>
                </div>

                <div className="bg-white dark:bg-bunker-900 p-8 rounded-2xl shadow-xl border border-bunker-200 dark:border-bunker-800 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-bunker-700 dark:text-bunker-300 mb-2">Disciplina</label>
                        <select 
                            value={selectedSubject} 
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="w-full bg-bunker-50 dark:bg-bunker-950 border border-bunker-200 dark:border-bunker-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">Todas as Disciplinas (Geral)</option>
                            {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-bunker-700 dark:text-bunker-300 mb-2">Quantidade de Questões</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[15, 30, 60, 90].map(val => (
                                <button
                                    key={val}
                                    onClick={() => setQuestionCount(val)}
                                    className={`py-2 rounded-lg font-bold text-sm border-2 transition-all ${questionCount === val ? 'bg-indigo-500 border-indigo-600 text-white' : 'bg-transparent border-bunker-200 dark:border-bunker-700 text-bunker-500 hover:border-indigo-400'}`}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-bunker-400 mt-2 text-right">Disponíveis: {availableCount}</p>
                    </div>

                    <div className="flex items-center justify-between bg-bunker-50 dark:bg-bunker-950 p-4 rounded-lg border border-bunker-200 dark:border-bunker-700">
                        <div className="flex items-center gap-3">
                            <ClockIcon className="text-indigo-500" />
                            <div>
                                <p className="font-bold text-sm">Tempo Cronometrado</p>
                                <p className="text-xs text-bunker-500">3 min por questão</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isTimed} onChange={e => setIsTimed(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <div className="pt-4 border-t border-bunker-200 dark:border-bunker-800 flex gap-3">
                        <button onClick={onExit} className="flex-1 py-3 font-bold text-bunker-500 hover:bg-bunker-100 dark:hover:bg-bunker-800 rounded-xl transition-colors">Cancelar</button>
                        <button 
                            onClick={handleStartExam} 
                            disabled={availableCount === 0}
                            className="flex-[2] bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Iniciar Simulado
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'running' && examQueue.length > 0) {
        const currentQ = examQueue[currentIndex];
        const isFlagged = flags.has(currentQ.id);
        const progress = ((currentIndex + 1) / examQueue.length) * 100;
        
        let ceKeys: string[] | null = null;
        if (currentQ.options.C === 'Certo' && currentQ.options.E === 'Errado') ceKeys = ['C', 'E'];
        else if (currentQ.options.A?.toLowerCase() === 'certo' && currentQ.options.B?.toLowerCase() === 'errado') ceKeys = ['A', 'B'];
        else if (currentQ.questionType?.includes('C/E') && currentQ.options.A && currentQ.options.B) ceKeys = ['A', 'B']; // Fallback
        
        const isCe = !!ceKeys;
        const optionKeys = ceKeys || ['A', 'B', 'C', 'D', 'E'];

        return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[200] bg-slate-100 dark:bg-slate-950 flex flex-col h-full overflow-hidden select-none">
                {/* Header */}
                <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <div className="font-mono text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            {isTimed && <ClockIcon className={timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-slate-400'} />}
                            {isTimed ? formatTime(timeLeft) : '∞'}
                        </div>
                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700"></div>
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Questão <span className="font-bold text-indigo-500">{currentIndex + 1}</span> / {examQueue.length}
                        </div>
                    </div>
                    <button onClick={handleSubmitExam} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90">
                        Finalizar
                    </button>
                </header>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-800">
                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto w-full custom-scrollbar">
                    <div className="mb-6 flex justify-between items-start">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded">
                            {currentQ.subject}
                        </span>
                        <button 
                            onClick={handleToggleFlag}
                            className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${isFlagged ? 'bg-yellow-100 text-yellow-700' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        >
                            <ExclamationTriangleIcon className="w-4 h-4" /> Revisar
                        </button>
                    </div>

                    <p className="text-lg md:text-xl text-slate-900 dark:text-slate-100 font-medium leading-relaxed mb-8">
                        {currentQ.questionText}
                    </p>

                    <div className={`space-y-3 mb-24 ${isCe ? 'grid grid-cols-2 gap-4 space-y-0' : ''}`}>
                        {optionKeys.map((key) => {
                            const text = currentQ.options[key as keyof typeof currentQ.options];
                            if (!text && !isCe) return null;
                            
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleSelectOption(key)}
                                    className={`
                                        ${isCe ? 'p-6 rounded-xl border-2 font-bold text-lg text-center' : 'w-full text-left p-4 rounded-xl border-2 flex gap-4'}
                                        transition-all
                                        ${answers[currentQ.id] === key
                                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-slate-700 dark:text-slate-300'
                                        }
                                    `}
                                >
                                    {!isCe && <span className={`font-bold ${answers[currentQ.id] === key ? 'text-white' : 'text-indigo-500'}`}>{key})</span>}
                                    <span>{isCe ? (key === 'C' || key === 'A' ? 'Certo' : 'Errado') : text}</span>
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Navigation Buttons in Content */}
                    <div className="flex justify-between mt-8 mb-4">
                         <button 
                            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentIndex === 0}
                            className="bg-bunker-200 dark:bg-bunker-800 text-bunker-700 dark:text-bunker-200 font-bold py-3 px-6 rounded-lg disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        
                        {currentIndex < examQueue.length - 1 ? (
                            <button 
                                onClick={() => setCurrentIndex(prev => prev + 1)}
                                className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg"
                            >
                                Próxima
                            </button>
                        ) : (
                            <button 
                                onClick={handleSubmitExam}
                                className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg"
                            >
                                Finalizar
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer Navigation Mini Map */}
                <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 flex justify-between items-center z-10 pb-safe">
                    <button 
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}
                        className="p-3 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                    >
                        <ChevronLeftIcon />
                    </button>

                    <div className="flex gap-1 overflow-x-auto max-w-[200px] md:max-w-md px-2 no-scrollbar">
                        {examQueue.map((q, idx) => (
                            <div 
                                key={q.id}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-2 h-2 rounded-full shrink-0 cursor-pointer ${
                                    idx === currentIndex ? 'bg-indigo-500 scale-125' : 
                                    flags.has(q.id) ? 'bg-yellow-400' :
                                    answers[q.id] ? 'bg-slate-400 dark:bg-slate-500' : 
                                    'bg-slate-200 dark:bg-slate-800'
                                }`}
                            />
                        ))}
                    </div>

                    <button 
                        onClick={() => setCurrentIndex(prev => Math.min(examQueue.length - 1, prev + 1))}
                        disabled={currentIndex === examQueue.length - 1}
                        className="p-3 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                    >
                        <ChevronRightIcon />
                    </button>
                </div>
            </div>,
            document.body
        );
    }

    if (phase === 'results') {
        const percentage = Math.round((finalScore / examQueue.length) * 100);
        
        return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[200] bg-slate-50 dark:bg-slate-950 overflow-y-auto animate-fade-in custom-scrollbar">
                <div className="max-w-3xl mx-auto p-6 pb-20">
                    <div className="bg-white dark:bg-bunker-900 rounded-3xl p-8 shadow-xl border border-bunker-200 dark:border-bunker-800 text-center mb-8 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-2 ${percentage >= 70 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                        
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-4 mb-2">Simulado Finalizado</h2>
                        <p className="text-bunker-500 dark:text-bunker-400">Tempo Total: {Math.floor(timeTaken/60)}m {timeTaken%60}s</p>

                        <div className="flex justify-center items-center gap-8 mt-8 mb-8">
                            <div className="text-center">
                                <span className="block text-5xl font-black text-slate-900 dark:text-white">{percentage}%</span>
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Aproveitamento</span>
                            </div>
                            <div className="h-12 w-px bg-slate-200 dark:bg-slate-800"></div>
                            <div className="text-center">
                                <span className="block text-5xl font-black text-indigo-500">{finalScore}</span>
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Acertos ({examQueue.length})</span>
                            </div>
                        </div>

                        <button onClick={onExit} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3 px-8 rounded-xl shadow-lg hover:scale-105 transition-transform">
                            Voltar ao Menu
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 px-2">Gabarito Comentado</h3>
                        {resultDetails.map((detail, idx) => {
                            const question = examQueue.find(q => q.id === detail.id);
                            if (!question) return null;
                            return (
                                <div 
                                    key={detail.id}
                                    className={`bg-white dark:bg-bunker-900 p-4 rounded-xl border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${detail.isCorrect ? 'border-emerald-500' : 'border-red-500'}`}
                                    onClick={() => setDetailQuestion(question)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-500">#{idx + 1}</span>
                                            {detail.isCorrect 
                                                ? <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Correto</span>
                                                : <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">Errado</span>
                                            }
                                        </div>
                                        <ArrowRightIcon className="text-slate-300 w-4 h-4" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{question.questionText}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {detailQuestion && (
                    <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailQuestion(null)}>
                        <div className="bg-white dark:bg-bunker-900 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-lg text-indigo-500">{detailQuestion.questionRef}</h3>
                                <button onClick={() => setDetailQuestion(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200"><XCircleIcon className="w-5 h-5"/></button>
                            </div>
                            <p className="text-base text-slate-800 dark:text-white mb-6 whitespace-pre-wrap">{detailQuestion.questionText}</p>
                            
                            <div className="space-y-2 mb-6">
                                {Object.entries(detailQuestion.options).map(([k, v]) => v && (
                                    <div key={k} className={`p-3 rounded-lg border ${
                                        k === detailQuestion.correctAnswer 
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500' 
                                            : k === answers[detailQuestion.id] 
                                                ? 'bg-red-50 dark:bg-red-900/20 border-red-500' 
                                                : 'border-slate-200 dark:border-slate-700'
                                    }`}>
                                        <span className="font-bold mr-2">{k})</span> {v}
                                        {k === detailQuestion.correctAnswer && <span className="float-right text-emerald-600 font-bold text-xs">Gabarito</span>}
                                        {k === answers[detailQuestion.id] && k !== detailQuestion.correctAnswer && <span className="float-right text-red-600 font-bold text-xs">Sua Resposta</span>}
                                    </div>
                                ))}
                            </div>

                            {detailQuestion.explanation && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                    <h4 className="font-bold text-indigo-700 dark:text-indigo-300 text-sm uppercase tracking-wider mb-2 flex items-center gap-2"><LightBulbIcon className="w-4 h-4" /> Comentário</h4>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{detailQuestion.explanation}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>,
            document.body
        );
    }

    return null;
};

export default ExamModeView;
