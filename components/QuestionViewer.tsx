
import React from 'react';
import { Question, EvidenceItem } from '../types';
import { CheckCircleIcon, XCircleIcon, LockClosedIcon, TrashIcon } from './icons';
import QuestionExplanationBlocks from './QuestionExplanationBlocks';
import PromptText from './ui/PromptText';
import { sanitizeOptionText } from '../services/questionParser';

interface QuestionViewerProps {
    question: Question;
    selectedOption: string | null;
    isRevealed: boolean;
    onOptionSelect?: (key: string) => void;
    className?: string;
    showMedia?: boolean;
    isLocked?: boolean; 
    
    eliminatedOptions?: string[];
    onEliminate?: (key: string) => void;
    isEliminationMode?: boolean;
    highlightText?: string;
    
    // NEW PROP
    evidence?: { stem: EvidenceItem[], options: Record<string, EvidenceItem[]> } | undefined;
}

const QuestionViewer: React.FC<QuestionViewerProps> = ({ 
    question, 
    selectedOption, 
    isRevealed, 
    onOptionSelect, 
    className = "",
    showMedia = true,
    isLocked = false,
    eliminatedOptions = [],
    onEliminate,
    isEliminationMode = false,
    highlightText,
    evidence
}) => {
    
    const handleOptionClick = (key: string) => {
        if (isLocked) return;

        if (isEliminationMode && onEliminate) {
            onEliminate(key);
            return;
        }

        if (eliminatedOptions.includes(key)) return;

        if (!isRevealed && onOptionSelect) {
            onOptionSelect(key);
        }
    };
    
    const renderQuestionText = () => {
        // P3 Highlight (Legacy)
        if (highlightText && question.questionText.includes(highlightText)) {
            const parts = question.questionText.split(highlightText);
            return (
                <span>
                    {parts.map((part, i) => (
                        <React.Fragment key={i}>
                            <PromptText text={part} className="inline" />
                            {i < parts.length - 1 && (
                                <span className="bg-sky-500/30 text-white px-1 rounded animate-pulse font-bold border-b-2 border-sky-500">
                                    {highlightText}
                                </span>
                            )}
                        </React.Fragment>
                    ))}
                </span>
            );
        }
        
        // Evidence Overlay (New)
        return <PromptText text={question.questionText} highlights={evidence?.stem} />;
    };

    return (
        <div className={`space-y-6 pb-10 ${className}`}>
            <div id="question-start-anchor" className="h-px w-full -mt-2"></div>

            {showMedia && (question.questionImage || question.questionAudio) && (
                <div className="flex flex-col gap-4 mb-4">
                    {question.questionImage && <img src={question.questionImage} alt="Questão" className="max-w-full rounded-lg max-h-80 object-contain mx-auto bg-black/20" />}
                    {question.questionAudio && <audio controls src={question.questionAudio} className="w-full" />}
                </div>
            )}

            {/* Question Text */}
            <div className="text-base md:text-lg font-medium leading-relaxed text-slate-200">
                {renderQuestionText()}
            </div>

            <div className="relative">
                {/* LOCKED OVERLAY */}
                {isLocked && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/10 backdrop-blur-sm rounded-xl border border-white/5 animate-fade-in">
                        <div className="bg-slate-900 p-4 rounded-full shadow-2xl border border-indigo-500/50 mb-3 animate-bounce-subtle">
                            <LockClosedIcon className="w-8 h-8 text-indigo-400" />
                        </div>
                        <p className="text-sm font-bold text-white bg-slate-900/80 px-4 py-2 rounded-lg shadow-lg border border-white/10">
                            Complete o P1 e P2 para liberar
                        </p>
                    </div>
                )}
                
                {/* ELIMINATION MODE INDICATOR */}
                {isEliminationMode && !isLocked && (
                    <div className="absolute -top-10 left-0 w-full flex justify-center pointer-events-none z-30">
                        <div className="bg-rose-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-lg animate-pulse flex items-center gap-2">
                            <TrashIcon className="w-3 h-3" /> Modo Eliminação Ativo
                        </div>
                    </div>
                )}

                {/* Options List */}
                <div className={`space-y-2 transition-all duration-500 ${isLocked ? 'opacity-30 filter blur-[3px] pointer-events-none' : 'opacity-100'}`} id="answers-block">
                    {Object.entries(question.options || {}).map(([key, value]) => {
                        if (!value) return null;
                        
                        const displayValue = sanitizeOptionText(value as string);
                        const isEliminated = eliminatedOptions.includes(key);
                        const isSelected = selectedOption === key;
                        const isCorrect = question.correctAnswer === key;
                        const highlights = evidence?.options[key]; // Specific highlights for this option
                        
                        let btnClass = "w-full text-left p-3.5 rounded-xl border-2 transition-all flex gap-3 items-start group ";
                        
                        if (isEliminated) {
                             btnClass += "bg-slate-900/50 border-transparent opacity-40 grayscale decoration-slate-500 line-through cursor-not-allowed";
                        } else if (isRevealed) {
                            if (isCorrect) {
                                btnClass += "bg-emerald-500/20 border-emerald-500 text-emerald-100";
                            } else if (isSelected) {
                                btnClass += "bg-rose-500/20 border-rose-500 text-rose-100";
                            } else {
                                btnClass += "bg-white/5 border-white/5 opacity-50";
                            }
                        } else {
                            if (isEliminationMode) {
                                btnClass += "bg-white/5 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500 text-slate-300 cursor-crosshair";
                            } else if (isSelected) {
                                btnClass += "bg-sky-600 border-sky-500 text-white shadow-lg";
                            } else {
                                btnClass += "bg-white/5 border-white/10 hover:border-sky-500/30 hover:bg-white/10 active:scale-[0.99]";
                            }
                        }

                        return (
                            <button
                                key={key}
                                onClick={() => handleOptionClick(key)}
                                disabled={isRevealed || (isLocked)}
                                className={btnClass}
                            >
                                <strong className={`shrink-0 text-base ${!isRevealed && !isSelected && !isEliminated ? 'text-sky-500 group-hover:text-sky-400' : 'text-current'}`}>{key})</strong>
                                <span className="leading-snug pt-0.5 text-sm md:text-base w-full">
                                    <PromptText text={displayValue} highlights={highlights} />
                                </span>
                                {isRevealed && isCorrect && <CheckCircleIcon className="w-5 h-5 ml-auto shrink-0 text-emerald-400" />}
                                {isRevealed && isSelected && !isCorrect && <XCircleIcon className="w-5 h-5 ml-auto shrink-0 text-rose-400" />}
                                {!isRevealed && isEliminated && <TrashIcon className="w-4 h-4 ml-auto shrink-0 text-slate-600" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {isRevealed && (
                <div className="animate-fade-in pt-6 border-t border-white/10">
                   <QuestionExplanationBlocks 
                        question={question} 
                        userAnswer={selectedOption} 
                        showTitle={true}
                   />
                </div>
            )}
        </div>
    );
};

export default QuestionViewer;
