
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Question, AppSettings, ImportMode } from '../types';
import * as srs from '../services/srsService';
import { SAMPLE_QUESTIONS } from './sample-data';
import { saveData, loadData } from '../services/storage';
import { useSettings } from './SettingsContext';
import { ensureQuestionOptions } from '../services/questionParser';
import { migrateAllQuestions, normalizeQuestion } from '../services/migrationService';
import { traceService } from '../services/traceService';
import { attemptService, AttemptPayload } from '../services/attemptService';
import { isStrictQuestion } from '../services/contentGate'; // IMPORT GATE

const LS_QUESTIONS_KEY = 'revApp_questions_v5_react';

const QuestionStateContext = createContext<Question[] | undefined>(undefined);

interface QuestionDispatch {
  addQuestion: (newQuestion: Omit<Question, 'id'>) => void;
  updateQuestion: (updatedQuestion: Question) => void;
  updateBatchQuestions: (updates: ({ id: string } & Partial<Omit<Question, 'id'>>)[]) => void;
  deleteQuestions: (ids: string[]) => void;
  resetAllProgress: (settings: AppSettings) => void;
  addBatchQuestions: (newQuestions: Omit<Question, 'id'>[], mode?: ImportMode) => { imported: number, blocked: number, updated: number };
  removeDuplicates: () => number;
  registerAttempt: (payload: AttemptPayload) => void; // NEW
}

const QuestionDispatchContext = createContext<QuestionDispatch | undefined>(undefined);

export const QuestionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { logSystemError, settings } = useSettings();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
        try {
            traceService.trace('BOOT_START', 'BOOT');
            const data = await loadData<any[]>(LS_QUESTIONS_KEY);
            let finalQuestions: Question[] = [];
            
            if (data && Array.isArray(data)) {
                // Apply strict migration to remove potential gaps stored as questions
                const rawMigrated = migrateAllQuestions(data);
                finalQuestions = rawMigrated.filter(isStrictQuestion);
                
                if (rawMigrated.length !== finalQuestions.length) {
                    console.warn(`[QuestionProvider] Filtered out ${rawMigrated.length - finalQuestions.length} Gaps stored as Questions.`);
                }
                
                console.log(`[QuestionContext] Loaded & Migrated ${finalQuestions.length} questions.`);
                traceService.trace('BOOT_LOADED', 'BOOT', undefined, { count: finalQuestions.length });
            } else {
                finalQuestions = migrateAllQuestions(SAMPLE_QUESTIONS.map((q, i) => ({...q, id: `q_sample_${i}`})));
            }
            
            setQuestions(finalQuestions);
            traceService.snapshot('ON_APP_BOOT', { questions: finalQuestions });
        } catch (error) {
            logSystemError(error, 'QuestionContext Load');
            traceService.trace('BOOT_ERROR', 'BOOT', undefined, { error });
        } finally {
            setIsLoaded(true);
        }
    }
    load();
  }, [logSystemError]);

  useEffect(() => {
    if (!isLoaded) return;
    saveData(LS_QUESTIONS_KEY, questions).catch(e => logSystemError(e, 'QuestionContext Save'));
  }, [questions, isLoaded, logSystemError]);

  const addQuestion = useCallback((newQuestionData: Omit<Question, 'id'>) => {
    const normalizedData = normalizeQuestion({ ...newQuestionData, id: 'temp' }, newQuestionData.lawRef || '');
    const { id, ...cleanData } = normalizedData;
    
    // STRICT CHECK
    if (!isStrictQuestion(normalizedData as Question)) {
        console.error("Tentativa de adicionar Lacuna como Questão bloqueada.");
        return;
    }
    
    const fingerprint = srs.generateQuestionFingerprint(cleanData as any);
    
    setQuestions(prev => {
        if (prev.some(q => q.fingerprint === fingerprint)) {
            console.warn("Duplicate blocked:", cleanData.questionRef);
            return prev;
        }
        const finalId = normalizedData.id && !normalizedData.id.startsWith('temp') 
            ? normalizedData.id 
            : `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            
        traceService.trace('QUESTION_ADD', 'QUESTIONS', finalId, { ref: normalizedData.questionRef });
        return [...prev, { ...cleanData, fingerprint, id: finalId } as Question];
    });
  }, []);

  const addBatchQuestions = useCallback((newQuestions: Omit<Question, 'id'>[], mode: ImportMode = 'SKIP') => {
    let imported = 0;
    let blocked = 0;
    let updated = 0;

    traceService.trace('BATCH_ADD_START', 'QUESTIONS', undefined, { count: newQuestions.length, mode });

    setQuestions(prev => {
        const existingById = new Map<string, Question>(prev.map(q => [q.id, q]));
        const existingByRef = new Map<string, Question>(prev.map(q => [q.questionRef, q]));
        const existingFingerprints = new Set(prev.map(q => q.fingerprint));
        
        const finalBatch: Question[] = [];
        const updates: Question[] = [];
        
        newQuestions.forEach((q, idx) => {
            // STRICT CHECK FOR BATCH
            // If it has isGapType=true or text with {{...}}, reject it from this store
            // (It belongs in Literalness/Content store with type='LACUNA')
            if (q.isGapType || (q.questionText && q.questionText.includes('{{'))) {
                blocked++;
                return;
            }

            const inputId = (q as any).id;
            const hasStableId = inputId && !inputId.toString().startsWith('temp');
            const normalized = normalizeQuestion({ ...q, id: hasStableId ? inputId : 'temp' }, q.lawRef || '');
            const fingerprint = srs.generateQuestionFingerprint(normalized);
            
            let existing: Question | undefined;
            if (hasStableId) existing = existingById.get(normalized.id);
            if (!existing) existing = existingByRef.get(normalized.questionRef);

            if (existing) {
                if (mode === 'SKIP') {
                    blocked++;
                } else if (mode === 'MERGE') {
                    const updatedQ = { ...existing };
                    let hasChanges = false;
                    const fieldsToCheck: (keyof Question)[] = [
                        'explanationTech', 'explanationStory', 'feynmanQuestions', 
                        'distractorProfile', 'wrongDiagnosis', 'wrongDiagnosisMap',
                        'rawImportBlock', 'lawRef', 'guiaTrapscan', 'keyDistinction', 'anchorText'
                    ];

                    fieldsToCheck.forEach(key => {
                        const val = normalized[key];
                        if ((!updatedQ[key] || (typeof updatedQ[key] === 'object' && Object.keys(updatedQ[key] || {}).length === 0)) && val) {
                            (updatedQ as any)[key] = val;
                            hasChanges = true;
                        }
                    });

                    if (hasChanges) {
                        updates.push(updatedQ);
                        updated++;
                    } else {
                        blocked++;
                    }
                } else if (mode === 'OVERWRITE') {
                    const updatedQ: Question = {
                        ...existing,
                        ...normalized,
                        id: existing.id, 
                        totalAttempts: existing.totalAttempts,
                        masteryScore: existing.masteryScore,
                        stability: existing.stability,
                        nextReviewDate: existing.nextReviewDate,
                        attemptHistory: existing.attemptHistory,
                        lastAttemptDate: existing.lastAttemptDate,
                        lastWasCorrect: existing.lastWasCorrect,
                    };
                    updates.push(updatedQ);
                    updated++;
                }
            } else {
                if (mode === 'SKIP' && existingFingerprints.has(fingerprint)) {
                     blocked++;
                } else {
                    const finalId = normalized.id && !normalized.id.startsWith('temp') 
                        ? normalized.id 
                        : `q_batch_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
                    
                    finalBatch.push({ ...normalized, fingerprint, id: finalId });
                    existingFingerprints.add(fingerprint);
                    imported++;
                }
            }
        });
        
        const updatedIds = new Set(updates.map(u => u.id));
        const nextState = prev.map(q => updatedIds.has(q.id) ? updates.find(u => u.id === q.id)! : q);
        const finalState = [...nextState, ...finalBatch];
        
        return finalState;
    });
    
    return { imported, blocked, updated };
  }, []);

  const removeDuplicates = useCallback(() => {
      let removedCount = 0;
      setQuestions(prev => {
          const seen = new Set<string>();
          const filtered = prev.filter(q => {
              const fp = q.fingerprint || srs.generateQuestionFingerprint(q);
              if (seen.has(fp)) {
                  removedCount++;
                  return false;
              }
              seen.add(fp);
              return true;
          });
          return filtered;
      });
      return removedCount;
  }, []);

  const updateQuestion = useCallback((updatedQuestion: Question) => {
    const finalQ = normalizeQuestion(updatedQuestion, updatedQuestion.lawRef);
    const canonicalId = srs.getCanonicalId(finalQ.id);

    console.log(`[SRS_SAVE] Updating question ${canonicalId}. Attempts: ${finalQ.totalAttempts}, Mastery: ${finalQ.masteryScore}`);
    
    traceService.trace('QUESTION_UPDATE', 'QUESTIONS', canonicalId, { 
        lawRef: finalQ.lawRef, 
        attempts: finalQ.totalAttempts 
    });
    
    setQuestions(prev => prev.map(q => {
        if (srs.getCanonicalId(q.id) === canonicalId) {
            return finalQ;
        }
        return q;
    }));
  }, []);

  const updateBatchQuestions = useCallback((updates: ({ id: string } & Partial<Omit<Question, 'id'>>)[]) => {
    setQuestions(prev => {
        const updatesMap = new Map(updates.map(u => [srs.getCanonicalId(u.id), u]));
        return prev.map(q => {
            const update = updatesMap.get(srs.getCanonicalId(q.id));
            return update ? { ...q, ...update } : q;
        });
    });
  }, []);

  const deleteQuestions = useCallback((ids: string[]) => {
    const idsSet = new Set(ids.map(id => srs.getCanonicalId(id)));
    traceService.trace('QUESTION_DELETE', 'QUESTIONS', undefined, { count: ids.length });
    setQuestions(prev => prev.filter(q => !idsSet.has(srs.getCanonicalId(q.id))));
  }, []);

  const resetAllProgress = useCallback((settings: AppSettings) => {
    setQuestions(prev => prev.map(q => ({
      ...q,
      totalAttempts: 0,
      correctStreak: 0,
      errorCount: 0,
      masteryScore: 0,
      stability: settings.srsV2.S_default_days,
      nextReviewDate: srs.todayISO(),
      lastAttemptDate: '',
      attemptHistory: [],
      masteryHistory: [],
      srsStage: 0,
      lastWasCorrect: false,
      recentError: 0,
      lastReviewedAt: undefined,
    })));
  }, []);

  // --- NEW: CENTRAL ATTEMPT REGISTRY ---
  const registerAttempt = useCallback((payload: AttemptPayload) => {
      const { question, isCorrect, userAnswer, timeSec, trapCode, mode } = payload;
      
      setQuestions(prev => {
          // 1. Try to find existing question
          let targetIndex = prev.findIndex(q => q.id === question.id);
          let targetQ = targetIndex !== -1 ? prev[targetIndex] : question;

          // 2. SRS Calculation
          // Note: If passed via payload, use it. Otherwise calculate.
          const selfEval = isCorrect ? 3 : 0; // Simple logic, assumes binary outcome unless specified
          const srsResult = srs.calculateNewSrsState(targetQ, isCorrect, selfEval, timeSec, settings);
          
          // 3. Update Object
          const updatedQ: Question = {
              ...targetQ,
              ...srsResult,
              yourAnswer: userAnswer,
              totalAttempts: (targetQ.totalAttempts || 0) + 1,
              correctStreak: isCorrect ? (targetQ.correctStreak || 0) + 1 : 0,
              errorCount: !isCorrect ? (targetQ.errorCount || 0) + 1 : targetQ.errorCount,
              lastWasCorrect: isCorrect,
              recentError: !isCorrect ? 1 : 0,
              attemptHistory: [
                  ...(targetQ.attemptHistory || []),
                  {
                      date: srsResult.lastReviewedAt!,
                      wasCorrect: isCorrect,
                      masteryAfter: srsResult.masteryScore!,
                      stabilityAfter: srsResult.stability,
                      timeSec: Math.round(timeSec),
                      selfEvalLevel: selfEval,
                      timingClass: srsResult.timingClass,
                      targetSec: srsResult.targetSec,
                      trapCode // PERSISTED FOR RADAR
                  }
              ]
          };

          // 4. Update State (Upsert)
          const newState = [...prev];
          if (targetIndex !== -1) {
              newState[targetIndex] = updatedQ;
          } else {
              // It was a virtual/new question (common in Lei Seca gaps), add it to persistence
              // FIX: Ensure virtual questions that are actually gaps (isGapType) don't get added to question state here
              if (!isStrictQuestion(updatedQ)) {
                   console.log(`[Attempt] Skipping upsert for Gap: ${updatedQ.id}`);
                   // For Gaps, persistence is usually handled via LiteralnessContext (updateCard) or special gap handler
              } else {
                   console.log(`[Attempt] Upserting virtual question: ${updatedQ.questionRef}`);
                   newState.push(updatedQ);
              }
          }
          
          // Notify Service
          attemptService.notify(payload);
          
          return newState;
      });
  }, [settings]);
  
  const dispatchValue = useMemo(() => ({
    addQuestion, updateQuestion, updateBatchQuestions, deleteQuestions, resetAllProgress, addBatchQuestions, removeDuplicates, registerAttempt
  }), [addQuestion, updateQuestion, updateBatchQuestions, deleteQuestions, resetAllProgress, addBatchQuestions, removeDuplicates, registerAttempt]);

  return (
    <QuestionStateContext.Provider value={questions}>
        <QuestionDispatchContext.Provider value={dispatchValue}>
            {children}
        </QuestionDispatchContext.Provider>
    </QuestionStateContext.Provider>
  );
};

export const useQuestionState = () => {
  const context = useContext(QuestionStateContext);
  if (context === undefined) throw new Error('useQuestionState error');
  return context;
};

export const useQuestionDispatch = () => {
  const context = useContext(QuestionDispatchContext);
  if (context === undefined) throw new Error('useQuestionDispatch error');
  return context;
};
