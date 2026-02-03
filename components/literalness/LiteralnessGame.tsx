
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { LiteralnessCard, Question, StudyStep } from '../../types';
import { useQuestionDispatch, useQuestionState } from '../../contexts/QuestionContext';
import { useSettings } from '../../contexts/SettingsContext';
import * as srs from '../../services/srsService';
import * as doctor from '../../services/leiSecaDoctor'; 
import { repository } from '../../services/repository';
import { 
    XMarkIcon, ArrowRightIcon, CheckCircleIcon, 
    XCircleIcon, BrainIcon, MapIcon, ChevronLeftIcon, FullScreenIcon, ExitFullScreenIcon
} from '../icons';
import { normalizeQuestion } from '../../services/migrationService';
import PromptText from '../ui/PromptText';
import { detectTrapFailure } from '../../services/trapscanService';
import QuestionRunner from '../QuestionRunner'; // IMPORT
import ReadingContainer from '../ui/ReadingContainer'; // IMPORT READING CONTAINER

// --- Shared Shell Component ---
const SessionShell: React.FC<{
    title: string;
    current: number;
    total: number;
    color: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    onToggleReader?: () => void; // Added Header Action
    readerMode?: 'compact' | 'fullscreen'; // Added Prop
}> = ({ title, current, total, color, onClose, children, footer, onToggleReader, readerMode }) => (
    <div className="flex flex-col h-full bg-[#020617] text-white overflow-hidden animate-fade-in">
        <div className="shrink-0 px-6 py-4 flex justify-between items-center bg-slate-900/50 border-b border-white/5 z-10 backdrop-blur-md">
            <div className="flex flex-col">
                <span className={`text-[10px] font-black uppercase tracking-widest text-${color}`}>{title}</span>
                <span className="text-sm font-bold text-white">{current} / {total}</span>
            </div>
            <div className="flex items-center gap-2">
                 {onToggleReader && (
                    <button 
                        onClick={onToggleReader}
                        className="p-2 rounded-lg text-slate-400 hover:bg-white/10 transition-colors hidden sm:block"
                        title={readerMode === 'compact' ? "Expandir Tela" : "Modo Leitura"}
                    >
                        {readerMode === 'compact' ? <FullScreenIcon className="w-5 h-5"/> : <ExitFullScreenIcon className="w-5 h-5"/>}
                    </button>
                 )}
                <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5 text-slate-400 hover:text-white">
                    <XMarkIcon className="w-5 h-5"/>
                </button>
            </div>
        </div>

        {/* Enhanced scroll container for long feedbacks */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 scroll-smooth">
            {children}
        </div>

        {footer && (
            <div className="shrink-0 p-4 bg-slate-900/90 backdrop-blur-xl border-t border-white/5 z-20 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="max-w-2xl mx-auto w-full space-y-4">
                    {footer}
                </div>
            </div>
        )}
    </div>
);

interface QuestionSessionProps {
    card: LiteralnessCard;
    onExit: (completed: boolean) => void;
}

const QuestionSession: React.FC<QuestionSessionProps> = ({ card, onExit }) => {
    const allQuestions = useQuestionState();
    const { registerAttempt } = useQuestionDispatch();
    const { settings } = useSettings();
    const [queue, setQueue] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const startTimeRef = useRef(Date.now());

    const relevantQuestions = useMemo(() => srs.getQuestionsForCard(card, allQuestions), [card.id, allQuestions]);

    useEffect(() => {
        const prepared = relevantQuestions.map(q => doctor.repairQuestion(normalizeQuestion(q, card.id)));
        setQueue(prepared);
        startTimeRef.current = Date.now();
    }, [card.id, relevantQuestions]);
    
    const currentQ = queue[currentIndex];

    // This handles the result from QuestionRunner
    const handleResult = async (rating: 'again' | 'hard' | 'good' | 'easy', timeTaken: number, trapscanData?: any) => {
        if (!currentQ) return;
        
        const isCorrect = rating !== 'again';
        
        // Use Centralized Recorder
        registerAttempt({
            question: currentQ,
            isCorrect,
            userAnswer: isCorrect ? currentQ.correctAnswer : 'ERROR', 
            timeSec: timeTaken,
            mode: 'LIT',
            trapCode: isCorrect ? 'CODE_CORRECT' : 'SRS_ERROR'
        });

        // Also save progress for legacy tracking in repository if needed
        await repository.saveProgress(currentQ.id, card.id, {
            lastAttemptAt: new Date().toISOString(),
            wasCorrect: isCorrect
        });
    };
    
    const handleNext = () => {
        if (currentIndex < queue.length - 1) {
             setCurrentIndex(prev => prev + 1);
             startTimeRef.current = Date.now();
        } else {
            onExit(true);
        }
    };

    if (queue.length === 0) return <div className="flex flex-col items-center justify-center h-full p-20 text-slate-500 font-bold uppercase tracking-widest"><BrainIcon className="w-12 h-12 mb-4 opacity-20"/> Sem questões.</div>;

    // We use a custom Shell-less runner here because QuestionRunner includes its own layout logic
    // We just wrap it in a div to fit the literalness game modal style
    
    // BUT we want to keep the Trapscan functionality. QuestionRunner provides that.
    
    return (
        <div className="h-full bg-[#020617]">
             <div className="shrink-0 px-6 py-4 flex justify-between items-center bg-slate-900/50 border-b border-white/5 z-10 backdrop-blur-md">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Atividade</span>
                    <span className="text-sm font-bold text-white">{currentIndex + 1} / {queue.length}</span>
                </div>
                <button onClick={() => onExit(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5 text-slate-400 hover:text-white">
                    <XMarkIcon className="w-5 h-5"/>
                </button>
            </div>
            
            <div className="h-[calc(100%-70px)]">
                 {currentQ && (
                     <QuestionRunner 
                        question={currentQ}
                        onResult={handleResult}
                        onNext={handleNext}
                        isLast={currentIndex === queue.length - 1}
                        context="literalness"
                        mode="SIMPLE" // Use simple next button style
                     />
                 )}
            </div>
        </div>
    );
};

interface GapSessionProps {
    card: LiteralnessCard;
    onExit: (completed: boolean) => void;
}

const GapSession: React.FC<GapSessionProps> = ({ card, onExit }) => {
    const allQuestions = useQuestionState();
    const { registerAttempt } = useQuestionDispatch();
    const { settings, updateSettings } = useSettings();
    const [queue, setQueue] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const isProcessingRef = useRef(false);
    const startTimeRef = useRef(Date.now());

    useEffect(() => { 
        const gaps = srs.getGapsForCard(card, allQuestions);
        setQueue(gaps);
        startTimeRef.current = Date.now();
    }, [card.id]);

    const handleAnswer = async (opt: string) => {
        if (feedback || isProcessingRef.current) return;
        isProcessingRef.current = true;
        
        const currentGap = queue[currentIndex];
        const isCorrect = opt === currentGap.correctAnswer;
        setFeedback(isCorrect ? 'correct' : 'wrong');
        setSelectedOption(opt);
        if (settings.enableSoundEffects) isCorrect ? srs.playCorrectSound() : srs.playIncorrectSound();
        
        const timeTaken = (Date.now() - startTimeRef.current) / 1000;
        
        // Convert Gap to Question compatible format if needed for registerAttempt
        const asQuestion: Question = {
            ...currentGap,
            id: currentGap.id,
            questionText: currentGap.questionText,
            correctAnswer: currentGap.correctAnswer,
            options: currentGap.options,
            subject: card.lawId,
            topic: card.topic,
            questionRef: currentGap.questionRef || 'GAP',
            questionType: 'Lacuna',
            lawRef: card.id, // Ensure linkage
            isGapType: true
        };

        // Register! This will upsert the gap as a question in the global state if it's new
        registerAttempt({
            question: asQuestion,
            isCorrect,
            userAnswer: opt,
            timeSec: timeTaken,
            mode: 'GAP'
        });

        isProcessingRef.current = false;
    };

    const handleNext = () => {
        if (currentIndex < queue.length - 1) { 
            setFeedback(null); 
            setSelectedOption(null); 
            setCurrentIndex(prev => prev + 1); 
            startTimeRef.current = Date.now();
        } else { 
            onExit(true); 
        }
    };
    
    const toggleReaderMode = () => {
        const newMode = settings.readerMode === 'compact' ? 'fullscreen' : 'compact';
        updateSettings({ readerMode: newMode });
    };

    if (queue.length === 0) return <div className="flex flex-col items-center justify-center h-full p-20 text-slate-500 font-bold uppercase tracking-widest"><MapIcon className="w-12 h-12 mb-4 opacity-20"/> Sem lacunas.</div>;

    const currentGap = queue[currentIndex];
    const text = currentGap.questionText || "Conteúdo não disponível";

    return (
        <SessionShell 
            title="Lacunas" 
            current={currentIndex + 1} 
            total={queue.length} 
            color="amber-500" 
            onClose={() => onExit(false)} 
            onToggleReader={toggleReaderMode}
            readerMode={settings.readerMode}
            footer={feedback ? (<button onClick={handleNext} className="w-full px-8 py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 hover:bg-slate-200">{currentIndex < queue.length - 1 ? 'Próxima Lacuna' : 'Finalizar Bateria'} <ArrowRightIcon className="w-5 h-5"/></button>) : null}
        >
            <ReadingContainer mode={settings.readerMode} className="h-full flex flex-col justify-center py-6">
                 <div className="p-8 md:p-10 bg-slate-900/60 border border-white/5 rounded-3xl text-center shadow-inner mb-6">
                    <div className="text-xl md:text-3xl font-serif leading-relaxed text-slate-100">
                            <PromptText text={text} mode="gap" revealExpected={feedback !== null} />
                    </div>
                </div>
                {!feedback && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(currentGap?.options || {}).map(([k, v]) => v && (
                            <button key={k} onClick={() => handleAnswer(k)} className="p-4 rounded-2xl border-2 transition-all font-bold text-sm active:scale-95 bg-white/5 border-white/10 hover:border-amber-500/50 hover:bg-white/10 text-slate-200 text-left flex items-start gap-2 group">
                                <span className="opacity-50 text-amber-500 shrink-0 group-hover:text-amber-400">{k})</span> <span className="leading-snug break-words">{String(v)}</span>
                            </button>
                        ))}
                    </div>
                )}
                {feedback && selectedOption && (
                    <div className={`inline-flex flex-col items-center gap-2 px-6 py-4 rounded-2xl text-sm font-bold animate-fade-in shadow-lg self-center w-full ${feedback === 'correct' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                        <div className="flex items-center gap-2 text-base">
                            {feedback === 'correct' ? <CheckCircleIcon className="w-6 h-6"/> : <XCircleIcon className="w-6 h-6"/>}
                            {feedback === 'correct' ? 'Resposta Correta!' : 'Incorreto!'}
                        </div>
                        {feedback !== 'correct' && (
                            <div className="text-xs font-normal opacity-90 flex flex-col gap-1 items-center mt-1">
                                <span className="line-through text-rose-300">Você: {currentGap.options[selectedOption] || selectedOption}</span>
                                <span className="font-bold text-emerald-400">Correto: {currentGap.options[currentGap.correctAnswer] || currentGap.correctAnswer}</span>
                            </div>
                        )}
                    </div>
                )}
            </ReadingContainer>
        </SessionShell>
    );
};

// ... ReadingView and LiteralnessGame wrapper remain unchanged ...
const ReadingView: React.FC<{ card: LiteralnessCard, onExit: () => void }> = ({ card, onExit }) => {
    const [step, setStep] = useState(0);
    const flow = card.studyFlow || [];
    const renderContent = (item: StudyStep): React.ReactNode => {
        if (item.type === 'KEYWORDS_PROVA') {
            return (<div className="flex flex-wrap gap-2 justify-center">{item.content.split(/[;|,]/).map((k, i) => (<span key={i} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-lg animate-fade-in" style={{ animationDelay: `${i*100}ms` }}>{k.trim()}</span>))}</div>);
        }
        return <PromptText text={item.content} mode="plain" className="text-lg md:text-2xl font-serif text-slate-100 leading-relaxed whitespace-pre-wrap" />;
    };
    if (flow.length === 0) return <div className="p-20 text-center text-slate-500">Nenhum conteúdo estruturado.</div>;
    return (
        <div className="flex flex-col h-full bg-[#020617] text-white">
            <header className="px-6 py-4 flex justify-between items-center bg-slate-900/50 border-b border-white/5 shrink-0 z-10 backdrop-blur-md">
                <div><span className="text-[9px] font-black text-sky-500 uppercase tracking-widest block mb-1">Passo {step + 1} de {flow.length}</span><h2 className="text-sm font-black uppercase italic tracking-tighter">{flow[step].title}</h2></div>
                <button onClick={onExit} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><XMarkIcon className="w-5 h-5"/></button>
            </header>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 pb-32">
                <ReadingContainer mode="compact" className="animate-fade-in-up" key={step}>
                    <div className="p-8 md:p-12 bg-white/[0.02] rounded-[3rem] border border-white/5 shadow-2xl relative">
                        <div className="absolute -top-4 -left-4 w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg shadow-sky-900/50">L</div>
                        {flow[step] ? renderContent(flow[step]) : null}
                    </div>
                </ReadingContainer>
            </div>
            <footer className="p-6 bg-slate-900/90 border-t border-white/5 flex justify-between items-center shrink-0 z-20 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
                <button disabled={step === 0} onClick={() => setStep(s => s - 1)} className="p-4 rounded-2xl bg-white/5 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"><ChevronLeftIcon className="w-6 h-6" /></button>
                <button onClick={() => step < flow.length - 1 ? setStep(s => s + 1) : onExit()} className="bg-sky-600 hover:bg-sky-500 text-white font-black px-10 py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest text-xs">{step < flow.length - 1 ? 'Continuar' : 'Finalizar Leitura'} <ArrowRightIcon className="w-5 h-5" /></button>
            </footer>
        </div>
    );
};

const LiteralnessGame: React.FC<{ cards: LiteralnessCard[], mode: string, onExit: (c: boolean) => void }> = ({ cards, mode, onExit }) => {
    const card = cards[0];
    if (!card) return null;
    const gameContent = (
        <div className="fixed inset-0 z-[100] bg-[#020617] text-white flex flex-col overflow-hidden animate-fade-in">
            {mode === 'questions' && <QuestionSession card={card} onExit={onExit} />}
            {mode === 'gaps' && <GapSession card={card} onExit={onExit} />}
            {mode === 'read' && <ReadingView card={card} onExit={() => onExit(true)} />}
        </div>
    );
    return ReactDOM.createPortal(gameContent, document.getElementById('modal-root') || document.body);
};
export default LiteralnessGame;
