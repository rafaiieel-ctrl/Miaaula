
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Question, TrapscanEntry } from '../types';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { detectTrapFailure } from '../services/trapscanService';
import ReviewHistoryModal from './ReviewHistoryModal';
import { QuestionContextType } from './QuestionActionsMenu';
import TrapscanPreflightModal from './TrapscanPreflightModal'; 
import { useTrapscanPreflight } from '../hooks/useTrapscanPreflight';
import QuestionRunner from './QuestionRunner'; // IMPORT RUNNER

interface InteractiveQuestionModalProps {
    question: Question;
    onClose: () => void;
    onQuestionAnswered: (q: Question) => void;
    context?: QuestionContextType;
}

const InteractiveQuestionModal: React.FC<InteractiveQuestionModalProps> = ({ question: initialQuestion, onClose, onQuestionAnswered, context = 'questions' }) => {
    const { registerAttempt } = useQuestionDispatch();
    const { settings, addXp } = useSettings();
    
    // PREFLIGHT HOOK
    const { isPreflightOpen, sessionConfig, handleConfirmPreflight } = useTrapscanPreflight(settings);

    // State
    const [question] = useState<Question>(initialQuestion);
    const [reportingQuestionAfterAnswer, setReportingQuestionAfterAnswer] = useState<Question | null>(null);
    const [masteryBefore, setMasteryBefore] = useState<number>(0);

    const handleRunnerResult = (rating: 'again' | 'hard' | 'good' | 'easy', timeTaken: number, trapscanData?: TrapscanEntry) => {
        let isCorrectNow = true;
        let evalLevel = 2;
        if (rating === 'again') { evalLevel = 0; isCorrectNow = false; }
        else if (rating === 'hard') evalLevel = 1;
        else if (rating === 'good') evalLevel = 2;
        else if (rating === 'easy') evalLevel = 3;

        if (settings.enableSoundEffects) {
            isCorrectNow ? srs.playCorrectSound() : srs.playIncorrectSound();
        }
        if (isCorrectNow) addXp(10, "Acerto!");
        else addXp(2, "Esforço!");

        setMasteryBefore(srs.calculateCurrentDomain(question, settings));
        
        let trapCode = isCorrectNow ? 'CODE_CORRECT' : 'SRS_ERROR';

        // Register Attempt
        registerAttempt({
            question,
            isCorrect: isCorrectNow,
            userAnswer: isCorrectNow ? question.correctAnswer : 'ERROR', // Approx
            timeSec: timeTaken,
            mode: 'SRS',
            trapCode
        });

        // Optimistic Update for UI
        const updates = srs.calculateNewSrsState(question, isCorrectNow, evalLevel, timeTaken, settings);
        
        const updatedQuestion: Question = {
            ...question,
            yourAnswer: isCorrectNow ? question.correctAnswer : 'ERROR',
            ...updates,
            totalAttempts: (question.totalAttempts || 0) + 1,
            attemptHistory: [
                ...(question.attemptHistory || []),
                {
                    date: new Date().toISOString(),
                    wasCorrect: isCorrectNow,
                    masteryAfter: updates.masteryScore!,
                    stabilityAfter: updates.stability,
                    timeSec: Math.round(timeTaken),
                    selfEvalLevel: evalLevel,
                    trapCode,
                    trapscanData 
                }
            ]
        };

        setReportingQuestionAfterAnswer(updatedQuestion);

        if (!settings.showHistoryAfterAnswer) {
            onQuestionAnswered(updatedQuestion);
            onClose();
        }
    };

    const handleNext = () => {
        if (reportingQuestionAfterAnswer) {
             onQuestionAnswered(reportingQuestionAfterAnswer);
             onClose();
        }
    };

    // Theme
    const isDark = settings.appTheme === 'dark' || settings.appTheme === 'galaxy';
    const themeStyles = (isDark ? {
        '--q-surface': 'rgba(15, 23, 42, 0.95)',
        '--q-text': '#F1F5F9',
        '--q-muted': '#94A3B8',
        '--q-border': 'rgba(255, 255, 255, 0.1)',
        '--q-card-bg': 'rgba(30, 41, 59, 0.5)',
        '--q-hover': 'rgba(255, 255, 255, 0.05)',
        '--q-correct-bg': 'rgba(16, 185, 129, 0.2)',
        '--q-correct-border': '#10B981',
        '--q-correct-text': '#FFFFFF',
        '--q-error-bg': 'rgba(244, 63, 94, 0.2)',
        '--q-error-border': '#F43F5E',
        '--q-error-text': '#FFFFFF',
    } : {
        '--q-surface': '#FFFFFF',
        '--q-text': '#0F172A',
        '--q-muted': '#475569',
        '--q-border': '#E2E8F0',
        '--q-card-bg': '#F8FAFC',
        '--q-hover': '#F1F5F9',
        '--q-correct-bg': '#ECFDF5',
        '--q-correct-border': '#10B981',
        '--q-correct-text': '#065F46',
        '--q-error-bg': '#FFF1F2',
        '--q-error-border': '#F43F5E',
        '--q-error-text': '#9F1239',
    }) as unknown as React.CSSProperties;

    return ReactDOM.createPortal(
        <div className={isDark ? "dark" : ""} style={themeStyles}>
            
            {/* PREFLIGHT INTERCEPTOR */}
            <TrapscanPreflightModal 
                isOpen={isPreflightOpen && !reportingQuestionAfterAnswer} 
                onConfirm={handleConfirmPreflight}
                onCancel={() => { /* User cancelled preflight */ }}
            />

            <div className={`fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm items-center justify-center md:p-4 transition-opacity duration-300 ${isPreflightOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} onClick={onClose}>
                <div 
                    className="bg-[var(--q-surface)] text-[var(--q-text)] w-full h-[100dvh] md:h-[90vh] md:max-w-2xl md:rounded-3xl shadow-2xl border border-[var(--q-border)] flex flex-col overflow-hidden transition-all duration-300"
                    onClick={e => e.stopPropagation()}
                >
                    <QuestionRunner 
                        question={question}
                        sessionConfig={sessionConfig}
                        onResult={handleRunnerResult}
                        onNext={handleNext}
                        isLast={true}
                        onClose={onClose}
                        context={context}
                        mode="SRS"
                    />

                    {reportingQuestionAfterAnswer && (
                        <ReviewHistoryModal
                            isOpen={!!reportingQuestionAfterAnswer}
                            onClose={() => { setReportingQuestionAfterAnswer(null); onQuestionAnswered(reportingQuestionAfterAnswer); onClose(); }}
                            question={reportingQuestionAfterAnswer}
                            onContinue={() => { setReportingQuestionAfterAnswer(null); onQuestionAnswered(reportingQuestionAfterAnswer); onClose(); }}
                            masteryBefore={masteryBefore}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default InteractiveQuestionModal;
