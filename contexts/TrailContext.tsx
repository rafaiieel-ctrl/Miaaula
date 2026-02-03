
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { SubjectTrail, LessonNode, LessonStatus, Question, Flashcard, AppSettings } from '../types';
import * as srs from '../services/srsService';
import * as rs from '../services/reviewStatusService';
import { saveData, loadData } from '../services/storage';
import { useSettings } from './SettingsContext';

const LS_TRAILS_KEY = 'revApp_trails_v1';

// State Context
const TrailStateContext = createContext<SubjectTrail[] | undefined>(undefined);

// Dispatch Context
interface TrailDispatch {
  addOrUpdateLesson: (lesson: LessonNode) => void;
  updateLessonStatus: (lessonId: string, status: LessonStatus) => void;
  updateLessonStats: (lessonId: string, correctRate: number) => void; // Deprecated but kept for compat
  syncLessonState: (lessonId: string, allQuestions: Question[], allFlashcards: Flashcard[], settings: AppSettings) => void;
  deleteLesson: (lessonId: string) => void;
  updateTrailImage: (subjectId: string, base64Image: string) => void;
  reorderLessons: (subjectId: string, newLessons: LessonNode[]) => void;
  updateTrail: (oldId: string, newId: string, updates: Partial<SubjectTrail>) => void;
}
const TrailDispatchContext = createContext<TrailDispatch | undefined>(undefined);

export const TrailProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { logSystemError } = useSettings();
  const [trails, setTrails] = useState<SubjectTrail[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Data Async
  useEffect(() => {
      async function load() {
          try {
              const data = await loadData<SubjectTrail[]>(LS_TRAILS_KEY);
              if (data && Array.isArray(data)) {
                  // Migration: Ensure all lessons have a UID
                  let hasChanges = false;
                  const migratedData = data.map(trail => ({
                      ...trail,
                      lessons: trail.lessons.map(lesson => {
                          if (!lesson.uid) {
                              hasChanges = true;
                              return { 
                                  ...lesson, 
                                  uid: `${lesson.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` 
                              };
                          }
                          return lesson;
                      })
                  }));
                  
                  setTrails(migratedData);
                  if (hasChanges) {
                      saveData(LS_TRAILS_KEY, migratedData).catch(e => console.error("Auto-migration save failed", e));
                  }
              }
          } catch (e) {
              logSystemError(e, 'TrailContext Load');
          } finally {
              setIsLoaded(true);
          }
      }
      load();
  }, [logSystemError]);

  // Save Data Async
  useEffect(() => {
    if (!isLoaded) return;
    const save = async () => {
        try {
            await saveData(LS_TRAILS_KEY, trails);
        } catch (error) {
            logSystemError(error, 'TrailContext Save');
        }
    };
    save();
  }, [trails, isLoaded, logSystemError]);

  const addOrUpdateLesson = useCallback((lesson: LessonNode) => {
    setTrails(prev => {
        const trailIndex = prev.findIndex(t => t.id === lesson.subjectId);
        
        // Ensure lesson has a UID if not present (safety fallback)
        const lessonWithUid = lesson.uid ? lesson : { 
            ...lesson, 
            uid: `${lesson.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` 
        };
        
        if (trailIndex === -1) {
            // Nova trilha (disciplina)
            return [...prev, {
                id: lessonWithUid.subjectId,
                lessons: [lessonWithUid]
            }];
        }

        // Trilha existente
        return prev.map((trail, idx) => {
            if (idx !== trailIndex) return trail;

            // Update logic using UID if available, else fallback to ID
            const existingLessonIndex = trail.lessons.findIndex(l => 
                (lessonWithUid.uid && l.uid === lessonWithUid.uid) || l.id === lessonWithUid.id
            );

            let updatedLessons = [...trail.lessons];

            if (existingLessonIndex > -1) {
                // Update
                updatedLessons[existingLessonIndex] = lessonWithUid;
            } else {
                // Add
                updatedLessons.push(lessonWithUid);
            }

            // Ordenar por 'order' para manter a sequência correta
            updatedLessons.sort((a, b) => (a.order || 0) - (b.order || 0));

            return { ...trail, lessons: updatedLessons };
        });
    });
  }, []);

  const updateTrail = useCallback((oldId: string, newId: string, updates: Partial<SubjectTrail>) => {
    setTrails(prev => prev.map(trail => {
        if (trail.id !== oldId) return trail;

        const newTrailId = newId.trim() || oldId;
        const updatedLessons = trail.lessons.map(l => ({
            ...l,
            subjectId: newTrailId
        }));

        return {
            ...trail,
            ...updates,
            id: newTrailId,
            lessons: updatedLessons
        };
    }));
  }, []);

  const reorderLessons = useCallback((subjectId: string, newLessons: LessonNode[]) => {
      setTrails(prev => prev.map(trail => {
          if (trail.id !== subjectId) return trail;
          // Garantir IDs únicos no array reordenado
          const seenIds = new Set();
          const uniqueLessons = newLessons.filter(l => {
              const uniqueKey = l.uid || l.id;
              if (seenIds.has(uniqueKey)) return false;
              seenIds.add(uniqueKey);
              return true;
          });
          
          // Atualizar ordens baseadas no índice do array
          const orderedLessons = uniqueLessons.map((l, idx) => ({ ...l, order: idx + 1 }));
          return { ...trail, lessons: orderedLessons };
      }));
  }, []);

  const updateLessonStatus = useCallback((lessonId: string, status: LessonStatus) => {
      setTrails(prev => prev.map(trail => ({
          ...trail,
          lessons: trail.lessons.map(l => l.id === lessonId ? { ...l, status } : l)
      })));
  }, []);

  const updateLessonStats = useCallback((lessonId: string, correctRate: number) => {
      // Deprecated in favor of syncLessonState, but kept for compatibility
      setTrails(prev => prev.map(trail => {
          const lesson = trail.lessons.find(l => l.id === lessonId);
          if (!lesson) return trail;

          let newDomain = lesson.domainLevel || 0;
          if (correctRate >= 0.9) newDomain = Math.min(5, newDomain + 1);
          else if (correctRate < 0.6) newDomain = Math.max(1, newDomain - 1);
          else if (newDomain === 0) newDomain = 1;

          const intervals = [1, 3, 7, 14, 30, 60];
          const daysToAdd = intervals[newDomain] || 1;
          const nextReview = srs.addDaysISO(srs.todayISO(), daysToAdd);

          return {
              ...trail,
              lessons: trail.lessons.map(l => l.id === lessonId ? {
                  ...l,
                  successRate: correctRate,
                  domainLevel: newDomain,
                  lastSessionAt: new Date().toISOString(),
                  nextReviewAt: nextReview,
                  status: newDomain >= 4 ? 'mastered' : 'review'
              } : l)
          };
      }));
  }, []);

  // --- NEW: ADAPTER FOR TRAIL COMMIT (Lei Seca Logic) ---
  const syncLessonState = useCallback((lessonId: string, allQuestions: Question[], allFlashcards: Flashcard[], settings: AppSettings) => {
      setTrails(prev => prev.map(trail => {
          const lessonIndex = trail.lessons.findIndex(l => l.id === lessonId);
          if (lessonIndex === -1) return trail;

          const lesson = trail.lessons[lessonIndex];
          
          // FIX: Ensure arrays exist before calling includes
          const qRefs = lesson.questionRefs || [];
          const fRefs = lesson.flashcardRefs || [];

          const qItems = allQuestions.filter(q => 
            qRefs.includes(q.id) || 
            qRefs.includes(q.questionRef) || 
            q.topic === lesson.title
          );
          const fItems = allFlashcards.filter(fc => 
            fRefs.includes(fc.id) || 
            (fc.tags || []).includes(lesson.id) || 
            fc.topic === lesson.title
          );
          const items = [...qItems, ...fItems];

          if (items.length === 0) return trail;

          // 2. Aggregate Stats using Shared Service (Same as LiteralnessCard)
          const stats = rs.aggregateCardStats(items, settings);
          
          // 3. Determine Lesson Status
          let newStatus: LessonStatus = 'in_progress';
          const hasAttempts = items.some(i => i.totalAttempts > 0);
          
          if (!hasAttempts) {
              newStatus = 'not_started';
          } else if (stats.avgMastery >= 90 && stats.status === 'FUTURE') {
              newStatus = 'mastered';
          } else if (stats.status === 'OVERDUE' || stats.status === 'NOW' || stats.status === 'TODAY') {
              newStatus = 'review';
          } else {
              newStatus = 'in_progress';
          }

          // 4. Map Domain (0-100) to Level (0-5)
          const domainLevel = Math.max(0, Math.min(5, Math.floor(stats.avgMastery / 20)));

          const updatedLesson: LessonNode = {
              ...lesson,
              status: newStatus,
              domainLevel: domainLevel,
              successRate: stats.avgMastery / 100, // Normalized for legacy usage
              lastSessionAt: new Date().toISOString(),
              nextReviewAt: stats.nextReviewAt.toISOString()
          };

          const newLessons = [...trail.lessons];
          newLessons[lessonIndex] = updatedLesson;

          return { ...trail, lessons: newLessons };
      }));
  }, []);

  const deleteLesson = useCallback((lessonId: string) => {
      setTrails(prev => prev.map(trail => ({
          ...trail,
          lessons: trail.lessons.filter(l => l.id !== lessonId)
      })).filter(t => t.lessons.length > 0));
  }, []);

  const updateTrailImage = useCallback((subjectId: string, base64Image: string) => {
      setTrails(prev => prev.map(trail => 
          trail.id === subjectId ? { ...trail, themeImage: base64Image } : trail
      ));
  }, []);

  const dispatchValue = useMemo(() => ({
    addOrUpdateLesson,
    updateLessonStatus,
    updateLessonStats,
    syncLessonState, // Added
    deleteLesson,
    updateTrailImage,
    reorderLessons,
    updateTrail
  }), [addOrUpdateLesson, updateLessonStatus, updateLessonStats, syncLessonState, deleteLesson, updateTrailImage, reorderLessons, updateTrail]);

  return (
    <TrailStateContext.Provider value={trails}>
        <TrailDispatchContext.Provider value={dispatchValue}>
            {children}
        </TrailDispatchContext.Provider>
    </TrailStateContext.Provider>
  );
};

export const useTrailState = (): SubjectTrail[] => {
  const context = useContext(TrailStateContext);
  if (context === undefined) throw new Error('useTrailState must be used within a TrailProvider');
  return context;
};

export const useTrailDispatch = (): TrailDispatch => {
  const context = useContext(TrailDispatchContext);
  if (context === undefined) throw new Error('useTrailDispatch must be used within a TrailProvider');
  return context;
};
