
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Question, TrapscanEntry, TrapscanSessionConfig } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useTrapscanPreflight } from '../hooks/useTrapscanPreflight';
import * as trapscanLogic from '../services/trapscanLogic';
import * as srs from '../services/srsService';
import { 
    XMarkIcon, LockClosedIcon, CheckCircleIcon, ArrowRightIcon, 
    ExclamationTriangleIcon, BoltIcon, FullScreenIcon, ExitFullScreenIcon
} from './icons';
import QuestionViewer from './QuestionViewer';
import TrapscanGate from './TrapscanGate';
import QuestionActionsMenu, { QuestionContextType } from './QuestionActionsMenu';
import ReadingContainer from './ui/ReadingContainer';
import { getText } from '../utils/i18nText';
import { isStrictQuestion } from '../services/contentGate'; // IMPORT GATE
import ConfirmationModal from './ConfirmationModal'; // Added for delete confirmation
import EditQuestionModal from './EditQuestionModal'; // Ensure Edit Modal is available internally or via prop
import { useQuestionDispatch } from '../contexts/QuestionContext'; // For direct delete call if needed

interface QuestionRunnerProps {
    question: Question;
    sessionConfig?: TrapscanSessionConfig | null; // Optional override from session
    onResult: (rating: 'again' | 'hard' | 'good' | 'easy', timeTaken: number, trapscanData?: TrapscanEntry) => void;
    onNext?: () => void;
    isLast?: boolean;
    onClose?: () => void;
    context: QuestionContextType;
    mode?: 'SRS' | 'SIMPLE'; // SRS shows 4 buttons, SIMPLE shows Next/Finish
    allowGaps?: boolean; // NEW: Allow running Gap type items
    onEdit?: (q: Question) => void;
    onDelete?: (id: string) => void;
}

const MediaBlock: React.FC<{ image?: string, audio?: string }> = ({ image, audio }) => {
    if (!image && !audio) return null;
    return (
        <div className="flex flex-col gap-3 items-center mb-6 w-full animate-fade-in" onClick={e => e.stopPropagation()}>
           {image && (
               <img src={image} alt="Mídia da Questão" className="max-w-full max-h-72 rounded-2xl shadow-2xl object-contain bg-black/20" />
           )}
           {audio && (
               <audio controls src={audio} className="w-full max-w-md h-10 opacity-90 hover:opacity-100 transition-opacity" />
           )}
        </div>
    );
};

const QuestionRunner: React.FC<QuestionRunnerProps> = ({ 
    question, 
    sessionConfig, 
    onResult, 
    onNext, 
    isLast, 
    onClose, 
    context,
    mode = 'SRS',
    allowGaps = false,
    onEdit,
    onDelete
}) => {
    const { settings, updateSettings } = useSettings();
    const { deleteQuestions } = useQuestionDispatch();
    const scrollRef = useRef<HTMLDivElement>(null);
    const startTimeRef = useRef<number>(Date.now());

    // --- FAIL-SAFE GUARD ---
    // If a Gap slips through (e.g. from an old cache or unfiltered list), we must not crash or show broken UI.
    // BUT if allowGaps is true, we proceed.
    const isInvalidContent = !allowGaps && !isStrictQuestion(question);

    useEffect(() => {
        if (isInvalidContent) {
            console.warn("[QuestionRunner] Conteúdo inválido detectado (Lacuna em modo Questão). Pulando...", question.id);
            // Attempt to auto-skip
            if (onNext) {
                // Short timeout to avoid render-loop limits
                const t = setTimeout(onNext, 100);
                return () => clearTimeout(t);
            }
        }
    }, [question.id, isInvalidContent, onNext]);

    // Local state for delete confirmation
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    // Local state for edit modal if handler provided but wants internal handling (optional, mostly handled by parent via prop)
    // We assume parent handles Edit via onEdit prop, but we handle Delete confirmation locally.

    if (isInvalidContent) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-4">
                <ExclamationTriangleIcon className="w-12 h-12 text-amber-500 opacity-50" />
                <h3 className="text-xl font-bold text-white">Conteúdo Incompatível</h3>
                <p className="text-slate-400 text-sm">Este item parece ser uma lacuna, mas entrou no modo de questões. Pulando...</p>
                <button onClick={onNext} className="bg-white/10 px-6 py-2 rounded-lg text-sm font-bold uppercase hover:bg-white/20">
                    Forçar Pulo
                </button>
            </div>
        );
    }
    // -----------------------
    
    // Merge global settings with session config.
    const activeConfig = useMemo(() => {
        // Fix: Respect sessionConfig if provided (Preflight toggle)
        if (sessionConfig) {
            return sessionConfig;
        }
        return settings.trapscan || { enabled: true, assistMode: true, defaultMode: 'TREINO', lockLevel: 'SOFT' };
    }, [sessionConfig, settings.trapscan]);

    // State
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isRevealed, setIsRevealed] = useState(false);
    const [trapscanData, setTrapscanData] = useState<TrapscanEntry | undefined>(undefined);
    const [showBlockToast, setShowBlockToast] = useState<string | null>(null);
    
    // NEW: Elimination State (Lifted from Gate)
    const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
    const [isEliminationMode, setIsEliminationMode] = useState(false);
    const [highlightAnchor, setHighlightAnchor] = useState(false);

    // Reset on new question & Scroll to Top
    useEffect(() => {
        setSelectedOption(null);
        setIsRevealed(false);
        setTrapscanData(undefined);
        setEliminatedOptions([]);
        setIsEliminationMode(false);
        setHighlightAnchor(false);
        setIsDeleteConfirmOpen(false);
        startTimeRef.current = Date.now();
        
        // AUTO-SCROLL FIX: Scroll to top immediately when question changes
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [question.id]);

    // Computed Locks
    // Gaps (allowGaps=true) do NOT use Trapscan locking logic
    const isGap = allowGaps && (question.isGapType || question.questionText.includes('{{'));
    const isLocked = !isGap && trapscanLogic.checkAlternativesLocked(activeConfig, trapscanData);
    const blockReason = !isGap ? trapscanLogic.getSubmitBlockReason(activeConfig, trapscanData, !!selectedOption) : null;
    const canSubmit = !blockReason;

    // Handlers
    const handleOptionSelect = (key: string) => {
        if (!isRevealed && !isLocked && !isEliminationMode) {
            setSelectedOption(key);
        }
    };
    
    const handleEliminate = (key: string) => {
        setEliminatedOptions(prev => {
             if (prev.includes(key)) return prev.filter(k => k !== key); // Toggle off
             return [...prev, key];
        });
    };

    const handleReveal = () => {
        if (!canSubmit) {
            setShowBlockToast(blockReason);
            setTimeout(() => setShowBlockToast(null), 3000);
            return;
        }
        setIsRevealed(true);
    };

    const handleRating = (rating: 'again' | 'hard' | 'good' | 'easy') => {
        const timeTaken = (Date.now() - startTimeRef.current) / 1000;
        onResult(rating, timeTaken, trapscanData);
        if (onNext) onNext();
    };
    
    const handleSimpleNext = () => {
        const isCorrect = selectedOption === question.correctAnswer;
        const timeTaken = (Date.now() - startTimeRef.current) / 1000;
        onResult(isCorrect ? 'good' : 'again', timeTaken, trapscanData);
        if (onNext) onNext();
    };

    const toggleReaderMode = () => {
        const newMode = settings.readerMode === 'compact' ? 'fullscreen' : 'compact';
        updateSettings({ readerMode: newMode });
    };

    const handleDeleteRequest = (id: string) => {
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        // 1. Soft delete via Context
        deleteQuestions([question.id]);
        
        // 2. Notify Parent to remove from active queue if needed
        if (onDelete) onDelete(question.id);
        
        // 3. Move Next to avoid showing deleted question
        if (onNext) onNext();
        
        setIsDeleteConfirmOpen(false);
    };

    const showTrapscan = !isGap && trapscanLogic.isTrapscanActive(activeConfig) && !question.isGapType;

    return (
        <div className="flex flex-col h-full bg-[var(--q-surface)] text-[var(--q-text)] relative">
            {/* Header */}
            <header className="px-5 py-4 border-b border-[var(--q-border)] flex justify-between items-center bg-[var(--q-surface)] backdrop-blur-md shrink-0 z-10">
                <div className="min-w-0 pr-4">
                    <h2 className="text-sm font-extrabold tracking-tight truncate uppercase italic">{question.questionRef}</h2>
                    <p className="text-[10px] font-semibold text-[var(--q-muted)] uppercase mt-0.5">{question.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                    {activeConfig?.enabled && showTrapscan && (
                        <div className={`hidden sm:block px-2 py-0.5 rounded text-[9px] font-black uppercase border ${activeConfig.assistMode ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-slate-500/10 border-slate-500/30 text-slate-500'}`}>
                            {activeConfig.assistMode ? (activeConfig.defaultMode === 'GUIA' ? 'GUIA' : `LOCK: ${activeConfig.lockLevel}`) : 'OFF'}
                        </div>
                    )}
                    
                    {/* READER MODE TOGGLE */}
                    <button 
                        onClick={toggleReaderMode}
                        className="p-2 rounded-lg text-[var(--q-muted)] hover:bg-[var(--q-hover)] transition-colors hidden sm:block"
                        title={settings.readerMode === 'compact' ? "Expandir Tela" : "Modo Leitura"}
                    >
                        {settings.readerMode === 'compact' ? <FullScreenIcon className="w-5 h-5"/> : <ExitFullScreenIcon className="w-5 h-5"/>}
                    </button>

                    <QuestionActionsMenu 
                        question={question} 
                        context={context} 
                        onEdit={onEdit} 
                        onDelete={handleDeleteRequest} 
                    />
                    
                    {onClose && (
                        <button onClick={onClose} className="p-2 -mr-2 text-[var(--q-muted)] hover:bg-[var(--q-hover)] transition-colors">
                            <XMarkIcon className="w-5 h-5"/>
                        </button>
                    )}
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
                 <ReadingContainer mode={settings.readerMode} className="py-6 pb-24 md:py-8">
                      <MediaBlock image={question.questionImage} audio={question.questionAudio} />
                      
                      {showTrapscan && !isRevealed && (
                          <TrapscanGate 
                              question={question}
                              isLocked={isLocked}
                              onUnlock={() => {}} 
                              onAllowSubmit={() => {}} 
                              onUpdate={setTrapscanData}
                              userAnswer={selectedOption}
                              configOverride={activeConfig}
                              // Props for interaction
                              eliminatedOptions={eliminatedOptions}
                              onSetEliminationMode={setIsEliminationMode}
                              onSetHighlightAnchor={setHighlightAnchor}
                          />
                      )}

                      <QuestionViewer 
                          question={question}
                          selectedOption={selectedOption}
                          isRevealed={isRevealed}
                          onOptionSelect={handleOptionSelect}
                          showMedia={false} 
                          isLocked={isLocked}
                          // Elimination Props
                          isEliminationMode={isEliminationMode}
                          eliminatedOptions={eliminatedOptions}
                          onEliminate={handleEliminate}
                          highlightText={highlightAnchor ? getText(question.anchorText) : undefined}
                          // Gap Mode
                          // This passes visual mode to PromptText inside Viewer
                      />
                  </ReadingContainer>
            </div>

            {/* Toast for Block */}
            {showBlockToast && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-xs uppercase tracking-widest z-50 animate-bounce-subtle flex items-center gap-2">
                    <LockClosedIcon className="w-4 h-4" />
                    {showBlockToast}
                </div>
            )}
            
            {/* Footer Actions */}
            {selectedOption && (
                <footer className="p-5 bg-[var(--q-surface)] border-t border-[var(--q-border)] shrink-0 z-20 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
                    <ReadingContainer mode={settings.readerMode} className="!px-0">
                        {!isRevealed ? (
                            <button 
                                onClick={handleReveal} 
                                disabled={!canSubmit && activeConfig?.assistMode && activeConfig?.defaultMode === 'TREINO'}
                                className={`w-full font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2
                                    ${canSubmit || !activeConfig?.assistMode || activeConfig?.defaultMode === 'GUIA'
                                        ? 'bg-sky-600 text-white hover:bg-sky-500 active:scale-[0.98]' 
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-80'}`}
                            >
                                {(canSubmit || !activeConfig?.assistMode || activeConfig?.defaultMode === 'GUIA') ? 'Ver Gabarito' : <><LockClosedIcon className="w-4 h-4"/> Complete o Trapscan</>}
                            </button>
                        ) : (
                            mode === 'SRS' ? (
                                <div className="grid grid-cols-4 gap-3 h-20">
                                    <button onClick={() => handleRating('again')} className="rounded-2xl bg-rose-500/10 border-2 border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1 shadow-sm">
                                        <span>Errei</span>
                                    </button>
                                    <button onClick={() => handleRating('hard')} className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1 shadow-sm">
                                        <span>Difícil</span>
                                    </button>
                                    <button onClick={() => handleRating('good')} className="rounded-2xl bg-sky-500/10 border-2 border-sky-500/50 text-sky-500 hover:bg-sky-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1 shadow-sm">
                                        <span>Bom</span>
                                    </button>
                                    <button onClick={() => handleRating('easy')} className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1 shadow-sm">
                                        <span>Fácil</span>
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleSimpleNext} 
                                    className={`w-full font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 transition-all ${isLast ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-sky-50'}`}
                                >
                                    {isLast ? 'Finalizar' : 'Próxima'} <ArrowRightIcon className="w-4 h-4" />
                                </button>
                            )
                        )}
                    </ReadingContainer>
                </footer>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => setIsDeleteConfirmOpen(false)} 
                onConfirm={handleConfirmDelete} 
                title="Excluir Questão?"
            >
                <div className="space-y-2">
                    <p className="text-sm text-slate-300">Tem certeza que deseja apagar esta questão? Ela será removida de todas as suas listas de estudo.</p>
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Ação irreversível.</p>
                </div>
            </ConfirmationModal>

        </div>
    );
};

export default QuestionRunner;
