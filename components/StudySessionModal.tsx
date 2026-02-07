
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
import QuestionRunner from './QuestionRunner'; 
import { isStrictQuestion } from '../services/contentGate';
import { SessionEngine } from '../services/sessionEngine';
import { ClockIcon, FireIcon, CheckCircleIcon } from './icons';

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
  sessionType?: 'questions' | 'gaps'; 
}

const StudySessionModal: React.FC<StudySessionModalProps> = ({ isOpen, onClose, questions, title, initialIndex = 0, onSessionFinished, onStudyRefNavigate, lessonId, context = 'session', sessionType = 'questions' }) => {
  const { updateQuestion } = useQuestionDispatch();
  const { settings } = useSettings();
  
  // PREFLIGHT HOOK
  const { isPreflightOpen, sessionConfig, handleConfirmPreflight } = useTrapscanPreflight(settings);
  
  // --- ENGINE STATE ---
  const engineRef = useRef<SessionEngine | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [sessionPhase, setSessionPhase] = useState<'NEW' | 'REINFORCE'>('NEW');
  const [waitState, setWaitState] = useState<{ active: boolean, ms: number }>({ active: false, ms: 0 });
  const [forceFinish, setForceFinish] = useState(false);

  // --- STANDARD STATE ---
  const sessionStartTimeRef = useRef<Date | null>(null);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Question[]>([]);
  const [masteryBefore, setMasteryBefore] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [reportQuestion, setReportQuestion] = useState<Question | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [sessionInitialStates] = useState(new Map<string, { mastery: number, domain: number }>());
  const [summaryResult, setSessionSummary] = useState<SessionResult | null>(null);

  // --- ENGINE INIT ---
  useEffect(() => {
    if (isOpen && !isInitialized && questions.length > 0) {
      let validQuestions: Question[] = [];
      
      if (sessionType === 'questions') {
          validQuestions = questions.filter(isStrictQuestion);
      } else {
          validQuestions = questions.filter(q => q.questionText && (q.correctAnswer || q.options));
      }
      
      if (validQuestions.length === 0 && questions.length > 0) {
          onClose();
          return;
      }

      // Init Engine
      engineRef.current = new SessionEngine(validQuestions, settings);
      setSessionPhase(engineRef.current.getPhase());
      
      // Load First Question
      loadNextFromEngine();

      setAnsweredQuestions([]);
      sessionStartTimeRef.current = new Date();
      setIsInitialized(true);
      setSessionSummary(null);
      setReportQuestion(null);
      setWaitState({ active: false, ms: 0 });
      setForceFinish(false);

      sessionInitialStates.clear();
      validQuestions.forEach(q => {
          sessionInitialStates.set(q.id, {
              mastery: q.masteryScore,
              domain: srs.calculateCurrentDomain(q, settings)
          });
      });
    } else if (!isOpen) {
      setIsInitialized(false);
      engineRef.current = null;
    }
  }, [isOpen, questions, isInitialized, settings, sessionInitialStates, onClose, sessionType]);

  // --- ENGINE LOOP ---
  const loadNextFromEngine = () => {
      if (!engineRef.current) return;
      
      const next = engineRef.current.getNextQuestion();
      setSessionPhase(engineRef.current.getPhase());

      if (next.status === 'READY' && next.question) {
          setCurrentQuestion(next.question);
          setWaitState({ active: false, ms: 0 });
      } else if (next.status === 'WAITING') {
          setWaitState({ active: true, ms: next.nextUnlockInMs || 0 });
          setCurrentQuestion(null);
      } else if (next.status === 'EMPTY') {
          finalizeSession(true);
      }
  };

  // Timer for Wait State
  useEffect(() => {
      let interval: number;
      if (waitState.active) {
          interval = window.setInterval(() => {
              setWaitState(prev => {
                  const newMs = Math.max(0, prev.ms - 1000);
                  if (newMs <= 0) {
                      loadNextFromEngine(); // Try again
                      return { active: false, ms: 0 };
                  }
                  return { ...prev, ms: newMs };
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [waitState.active]);

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
          sessionType === 'gaps' ? 'LACUNAS' : 'QUESTOES',
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
    
    // UPDATE ENGINE
    if (engineRef.current) {
        engineRef.current.submitResult(currentQuestion.id, isCorrectNow);
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
        yourAnswer: isCorrectNow ? currentQuestion.correctAnswer : 'ERROR', // Simplify for session view
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
    
    if (settings.showHistoryAfterAnswer && sessionType !== 'gaps') {
        setReportQuestion(updated);
    } 
  };

  const moveToNextQuestion = () => {
    setReportQuestion(null);
    loadNextFromEngine();
  };
  
  const handleConfirmExit = () => { setIsLeaveConfirmOpen(false); finalizeSession(false); };
  
  const handleEdit = (q: Question) => {
      setEditingQuestion(q);
  };

  const handleDelete = (id: string) => {
      // Not implemented deeply in Engine mode, just skip
      moveToNextQuestion();
  };

  if (!isOpen) return null;

  // Theme logic
  const isDark = settings.appTheme === 'dark' || settings.appTheme === 'galaxy';
  const themeStyles = (isDark ? { '--q-surface': 'rgba(15, 23, 42, 0.95)', '--q-text': '#F1F5F9', '--q-muted': '#94A3B8', '--q-border': 'rgba(255, 255, 255, 0.1)', '--q-card-bg': 'rgba(30, 41, 59, 0.5)', '--q-hover': 'rgba(255, 255, 255, 0.05)', '--q-option-hover': 'rgba(56, 189, 248, 0.1)', '--q-correct-bg': 'rgba(16, 185, 129, 0.2)', '--q-correct-border': '#10B981', '--q-correct-text': '#FFFFFF', '--q-error-bg': 'rgba(244, 63, 94, 0.2)', '--q-error-border': '#F43F5E', '--q-error-text': '#FFFFFF', } : { '--q-surface': '#FFFFFF', '--q-text': '#0F172A', '--q-muted': '#475569', '--q-border': '#E2E8F0', '--q-card-bg': '#F8FAFC', '--q-hover': '#F1F5F9', '--q-option-hover': '#F0F9FF', '--q-correct-bg': '#ECFDF5', '--q-correct-border': '#10B981', '--q-correct-text': '#065F46', '--q-error-bg': '#FFF1F2', '--q-error-border': '#F43F5E', '--q-error-text': '#9F1239', }) as unknown as React.CSSProperties;

  // Formatting wait time
  const waitMinutes = Math.floor(waitState.ms / 60000);
  const waitSeconds = Math.floor((waitState.ms % 60000) / 1000);
  const waitTimeStr = `${waitMinutes}:${waitSeconds.toString().padStart(2, '0')}`;

  return ReactDOM.createPortal(
    <div className={isDark ? 'dark' : ''} style={themeStyles}>
      
      {/* PREFLIGHT INTERCEPTOR */}
      {sessionType === 'questions' && (
          <TrapscanPreflightModal 
            isOpen={isPreflightOpen && !summaryResult && !waitState.active} 
            onConfirm={handleConfirmPreflight}
            onCancel={() => {}}
          />
      )}

      <div className={`fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm items-center justify-center md:p-4 transition-opacity duration-300 ${isPreflightOpen && sessionType === 'questions' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} onClick={() => !summaryResult && !waitState.active && setIsLeaveConfirmOpen(true)}>
        
        {/* PHASE BADGE - Only show if playing */}
        {!summaryResult && !waitState.active && currentQuestion && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none">
                 <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border backdrop-blur-md flex items-center gap-2 ${sessionPhase === 'NEW' ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-amber-500/20 border-amber-500 text-amber-300'}`}>
                     {sessionPhase === 'NEW' ? <CheckCircleIcon className="w-3 h-3"/> : <FireIcon className="w-3 h-3"/>}
                     {sessionPhase === 'NEW' ? 'Fase: Inéditas' : 'Fase: Reforço'}
                 </div>
             </div>
        )}

        <div 
            className="bg-[var(--q-surface)] text-[var(--q-text)] w-full h-[100dvh] md:h-[90vh] md:max-w-2xl md:rounded-3xl shadow-2xl border border-[var(--q-border)] flex flex-col overflow-hidden transition-all duration-300 relative"
            onClick={e => e.stopPropagation()}
        >
            {summaryResult ? (
                  <StudyReportModal 
                    result={summaryResult} 
                    questions={answeredQuestions}
                    onClose={() => { onSessionFinished?.(); onClose(); }} 
                  />
            ) : waitState.active ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
                      <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center animate-pulse">
                          <ClockIcon className="w-12 h-12 text-slate-500" />
                      </div>
                      <div>
                          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Aguardando Retorno</h2>
                          <p className="text-slate-400 max-w-xs mx-auto">Você tem itens de reforço pendentes. O método exige um intervalo mínimo de 10 minutos para fixação.</p>
                      </div>
                      <div className="text-6xl font-mono font-black text-white tracking-tighter">
                          {waitTimeStr}
                      </div>
                      <button 
                          onClick={() => finalizeSession(true)} 
                          className="px-8 py-3 bg-white text-slate-900 font-bold rounded-xl uppercase tracking-widest hover:bg-slate-200 transition-colors"
                      >
                          Encerrar Sessão
                      </button>
                  </div>
            ) : currentQuestion && (
                <QuestionRunner 
                    question={currentQuestion}
                    sessionConfig={sessionConfig}
                    onResult={handleRunnerResult}
                    onNext={moveToNextQuestion}
                    isLast={false} // Engine is infinite/dynamic
                    onClose={() => setIsLeaveConfirmOpen(true)}
                    context={context}
                    mode="SRS"
                    allowGaps={sessionType === 'gaps'} 
                    onEdit={handleEdit}
                    onDelete={handleDelete}
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
                        setCurrentQuestion(updatedQ); // Refresh current
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
