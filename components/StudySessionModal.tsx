
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { Question, Attempt, StudyRef, SessionResult, TrapscanEntry } from '../types';
import ConfirmationModal from './ConfirmationModal';
import ReviewHistoryModal from './ReviewHistoryModal';
import EditQuestionModal from './EditQuestionModal';
import StudyReportModal from './StudyReportModal';
import { saveAttemptReport, buildReportFromQuestions, calculateSessionResult } from '../services/reportService';
import { QuestionContextType } from './QuestionActionsMenu';
import { detectTrapFailure } from '../services/trapscanService';
import TrapscanPreflightModal from './TrapscanPreflightModal'; 
import { useTrapscanPreflight } from '../hooks/useTrapscanPreflight';
import QuestionRunner from './QuestionRunner'; // IMPORT RUNNER
import { isStrictQuestion } from '../services/contentGate'; // IMPORT GATE

interface StudySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  title: string;
  initialIndex?: number;
  onSessionFinished?: () => void;
  onStudyRefNavigate?: (ref: StudyRef) => void;
  lessonId?: string; 
  context?: QuestionContextType; 
  sessionType?: 'questions' | 'gaps'; // NEW: Explicit session type
}

const StudySessionModal: React.FC<StudySessionModalProps> = ({ isOpen, onClose, questions, title, initialIndex = 0, onSessionFinished, onStudyRefNavigate, lessonId, context = 'session', sessionType = 'questions' }) => {
  const { updateQuestion } = useQuestionDispatch();
  const { settings } = useSettings();
  
  // PREFLIGHT HOOK
  const { isPreflightOpen, sessionConfig, handleConfirmPreflight } = useTrapscanPreflight(settings);
  
  const [sessionQueue, setSessionQueue] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const sessionStartTimeRef = useRef<Date | null>(null);
  
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Question[]>([]);
  const [masteryBefore, setMasteryBefore] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [reportQuestion, setReportQuestion] = useState<Question | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [sessionInitialStates] = useState(new Map<string, { mastery: number, domain: number }>());
  const [summaryResult, setSessionSummary] = useState<SessionResult | null>(null);

  const currentQuestion = sessionQueue.length > 0 && currentIndex < sessionQueue.length ? sessionQueue[currentIndex] : null;
  const isLastQuestion = currentIndex === sessionQueue.length - 1;

  // Init
  useEffect(() => {
    if (isOpen && !isInitialized && questions.length > 0) {
      // Logic: Filter based on sessionType. 
      // If 'questions', use strict filter. 
      // If 'gaps', trust the input (or filter to ensure isGapType=true if available, but legacy gaps might miss flag)
      let validQuestions: Question[] = [];
      
      if (sessionType === 'questions') {
          validQuestions = questions.filter(isStrictQuestion);
      } else {
          // For Gaps, we accept them. Ensure they have minimal fields.
          validQuestions = questions.filter(q => q.questionText && (q.correctAnswer || q.options));
      }
      
      if (validQuestions.length === 0 && questions.length > 0) {
          console.warn(`[StudySession] All items filtered out. SessionType: ${sessionType}`);
          onClose(); // Close if everything was invalid
          return;
      }

      setSessionQueue(validQuestions);
      setCurrentIndex(0);
      setAnsweredQuestions([]);
      sessionStartTimeRef.current = new Date();
      
      setIsInitialized(true);
      setSessionSummary(null);
      setReportQuestion(null);

      sessionInitialStates.clear();
      validQuestions.forEach(q => {
          sessionInitialStates.set(q.id, {
              mastery: q.masteryScore,
              domain: srs.calculateCurrentDomain(q, settings)
          });
      });
    } else if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen, questions, isInitialized, settings, sessionInitialStates, onClose, sessionType]);

  const finalizeSession = useCallback((completed: boolean) => {
      const attemptsCount = answeredQuestions.length;
      if (attemptsCount === 0) {
          onClose();
          return;
      }
      const result = calculateSessionResult(
          title,
          sessionStartTimeRef.current || new Date(),
          answeredQuestions,
          sessionInitialStates,
          settings,
          completed
      );
      const report = buildReportFromQuestions(
          lessonId || 'GERAL',
          sessionType === 'gaps' ? 'LACUNAS' : 'QUESTOES', // Use correct type for report
          sessionStartTimeRef.current || new Date(),
          answeredQuestions
      );
      saveAttemptReport(report);
      setSessionSummary(result);
  }, [answeredQuestions, lessonId, sessionInitialStates, settings, title, onClose, sessionType]);

  const handleRunnerResult = (rating: 'again' | 'hard' | 'good' | 'easy', timeTaken: number, trapscanData?: TrapscanEntry) => {
    if (!currentQuestion) return;
    
    let evalLevel: number; 
    let isCorrectNow: boolean = true;
    
    switch (rating) {
        case 'again': evalLevel = 0; isCorrectNow = false; break;
        case 'hard': evalLevel = 1; break;
        case 'good': evalLevel = 2; break;
        case 'easy': evalLevel = 3; break;
        default: evalLevel = 2;
    }
    
    if (settings.enableSoundEffects) isCorrectNow ? srs.playCorrectSound() : srs.playIncorrectSound();
    
    const mBefore = srs.calculateCurrentDomain(currentQuestion, settings);
    setMasteryBefore(mBefore);

    const { timingClass, targetSec, ...questionUpdates } = srs.calculateNewSrsState(currentQuestion, isCorrectNow, evalLevel, timeTaken, settings);
    
    let trapCode: string | undefined;
    if (!isCorrectNow) {
        trapCode = 'SRS_ERROR'; 
    } else {
        trapCode = 'CODE_CORRECT';
    }

    const updated: Question = {
        ...currentQuestion, 
        ...questionUpdates, 
        lastWasCorrect: isCorrectNow, 
        selfEvalLevel: evalLevel, 
        totalAttempts: (currentQuestion.totalAttempts || 0) + 1,
        attemptHistory: [
            ...(currentQuestion.attemptHistory || []), 
            { 
                date: questionUpdates.lastReviewedAt!, 
                wasCorrect: isCorrectNow, 
                masteryAfter: questionUpdates.masteryScore!, 
                stabilityAfter: questionUpdates.stability, 
                timeSec: Math.round(timeTaken), 
                selfEvalLevel: evalLevel, 
                timingClass, 
                targetSec,
                trapCode,
                trapscanData 
            }
        ]
    };
    
    updateQuestion(updated);
    setAnsweredQuestions(prev => [...prev, updated]);
    
    // Auto-advance if not showing history (default true in settings but check)
    // For Gaps, we might want faster flow
    if (settings.showHistoryAfterAnswer && sessionType !== 'gaps') {
        setReportQuestion(updated);
    } else {
        // Delay slightly for visual feedback if needed, handled by runner or immediate next
        // Since Runner handles immediate feedback visually, we can wait 800ms
        // But Runner calls this *after* its internal delay usually.
        // We'll trust the parent to move next.
    }
  };

  const moveToNextQuestion = () => {
    setReportQuestion(null); 
    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(prev => prev + 1); 
    } else {
      finalizeSession(true);
    }
  };
  
  const handleConfirmExit = () => { setIsLeaveConfirmOpen(false); finalizeSession(false); };
  
  if (!isOpen) return null;

  // Theme logic (omitted for brevity, same as before)
  const isDark = settings.appTheme === 'dark' || settings.appTheme === 'galaxy';
  const themeStyles = (isDark ? { '--q-surface': 'rgba(15, 23, 42, 0.95)', '--q-text': '#F1F5F9', '--q-muted': '#94A3B8', '--q-border': 'rgba(255, 255, 255, 0.1)', '--q-card-bg': 'rgba(30, 41, 59, 0.5)', '--q-hover': 'rgba(255, 255, 255, 0.05)', '--q-option-hover': 'rgba(56, 189, 248, 0.1)', '--q-correct-bg': 'rgba(16, 185, 129, 0.2)', '--q-correct-border': '#10B981', '--q-correct-text': '#FFFFFF', '--q-error-bg': 'rgba(244, 63, 94, 0.2)', '--q-error-border': '#F43F5E', '--q-error-text': '#FFFFFF', } : { '--q-surface': '#FFFFFF', '--q-text': '#0F172A', '--q-muted': '#475569', '--q-border': '#E2E8F0', '--q-card-bg': '#F8FAFC', '--q-hover': '#F1F5F9', '--q-option-hover': '#F0F9FF', '--q-correct-bg': '#ECFDF5', '--q-correct-border': '#10B981', '--q-correct-text': '#065F46', '--q-error-bg': '#FFF1F2', '--q-error-border': '#F43F5E', '--q-error-text': '#9F1239', }) as unknown as React.CSSProperties;

  return ReactDOM.createPortal(
    <div className={isDark ? 'dark' : ''} style={themeStyles}>
      
      {/* PREFLIGHT INTERCEPTOR (Only for Questions) */}
      {sessionType === 'questions' && (
          <TrapscanPreflightModal 
            isOpen={isPreflightOpen && !summaryResult} 
            onConfirm={handleConfirmPreflight}
            onCancel={() => { /* Ideally close session, but confirming defaults is safer UX */ }}
          />
      )}

      <div className={`fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm items-center justify-center md:p-4 transition-opacity duration-300 ${isPreflightOpen && sessionType === 'questions' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} onClick={() => !summaryResult && setIsLeaveConfirmOpen(true)}>
        <div 
            className="bg-[var(--q-surface)] text-[var(--q-text)] w-full h-[100dvh] md:h-[90vh] md:max-w-2xl md:rounded-3xl shadow-2xl border border-[var(--q-border)] flex flex-col overflow-hidden transition-all duration-300"
            onClick={e => e.stopPropagation()}
        >
            {summaryResult ? (
                  <StudyReportModal result={summaryResult} onClose={() => { onSessionFinished?.(); onClose(); }} />
            ) : currentQuestion && (
                <QuestionRunner 
                    question={currentQuestion}
                    sessionConfig={sessionConfig}
                    onResult={handleRunnerResult}
                    onNext={moveToNextQuestion}
                    isLast={isLastQuestion}
                    onClose={() => setIsLeaveConfirmOpen(true)}
                    context={context}
                    mode="SRS"
                    allowGaps={sessionType === 'gaps'} // Pass flag to Runner
                />
            )}

          <ConfirmationModal isOpen={isLeaveConfirmOpen} onClose={() => setIsLeaveConfirmOpen(false)} onConfirm={handleConfirmExit} title="Encerrar prática?">
              <p>Deseja ver seu desempenho nas questões que já respondeu? Seu progresso atual será salvo e o relatório de maestria será exibido.</p>
          </ConfirmationModal>

          {reportQuestion && (
              <ReviewHistoryModal
                  isOpen={!!reportQuestion}
                  onClose={() => setReportQuestion(null)}
                  question={reportQuestion}
                  onContinue={moveToNextQuestion}
                  masteryBefore={masteryBefore}
              />
          )}

          {editingQuestion && (
                <EditQuestionModal 
                    question={editingQuestion} 
                    onClose={() => setEditingQuestion(null)}
                    onSave={(updatedQ) => {
                        updateQuestion(updatedQ);
                        setSessionQueue(prev => prev.map(q => q.id === updatedQ.id ? updatedQ : q));
                    }}
                />
            )}
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
};

export default StudySessionModal;
