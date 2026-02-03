
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Flashcard, AppSettings, Attempt } from '../types';
import * as srs from '../services/srsService';
import { SAMPLE_FLASHCARDS } from './flashcard-sample-data';
import { saveData, loadData } from '../services/storage';
import { useSettings } from './SettingsContext';

const LS_FLASHCARDS_KEY = 'revApp_flashcards_v1';
const FlashcardStateContext = createContext<Flashcard[] | undefined>(undefined);

interface FlashcardDispatch {
  addFlashcard: (newFlashcard: Omit<Flashcard, 'id'>) => void;
  updateFlashcard: (updatedFlashcard: Flashcard) => void;
  deleteFlashcards: (ids: string[]) => void;
  addBatchFlashcards: (newFlashcards: Flashcard[]) => void;
  updateBatchFlashcards: (updates: ({ id: string } & Partial<Omit<Flashcard, 'id'>>)[]) => void;
}
const FlashcardDispatchContext = createContext<FlashcardDispatch | undefined>(undefined);

const hydrateFlashcard = (fc: any, index: number): Flashcard | null => {
    if (!fc || typeof fc !== 'object' || !fc.id || !fc.front) return null;
    const today = srs.todayISO();
    return {
        id: String(fc.id),
        createdAt: fc.createdAt || today,
        updatedAt: fc.updatedAt || today,
        discipline: fc.discipline || 'Não categorizado',
        topic: fc.topic || '',
        bank: fc.bank,
        source: fc.source,
        front: fc.front,
        back: fc.back,
        comments: fc.comments || '',
        frontImage: fc.frontImage,
        frontAudio: fc.frontAudio,
        backImage: fc.backImage,
        backAudio: fc.backAudio,
        type: ['basic', 'cloze', 'imageOcclusion'].includes(fc.type) ? fc.type : 'basic',
        tags: Array.isArray(fc.tags) ? fc.tags : [],
        stability: Number(fc.stability) || undefined,
        lastReviewedAt: fc.lastReviewedAt,
        nextReviewDate: fc.nextReviewDate || today,
        masteryScore: Number(fc.masteryScore) || 0,
        recentError: fc.recentError === 1 ? 1 : 0,
        hotTopic: !!fc.hotTopic,
        isFundamental: !!fc.isFundamental,
        isCritical: !!fc.isCritical,
        queroCair: fc.queroCair === 1 ? 1 : 0,
        pairMatchPlayed: !!fc.pairMatchPlayed,
        totalAttempts: Number(fc.totalAttempts) || 0,
        lastWasCorrect: !!fc.lastWasCorrect,
        correctStreak: Number(fc.correctStreak) || 0,
        lastTimeSec: Number(fc.lastTimeSec) || undefined,
        avgTimeSec: Number(fc.avgTimeSec) || undefined,
        domainDCache: Number(fc.domainDCache) || undefined,
        attemptHistory: Array.isArray(fc.attemptHistory) ? fc.attemptHistory : [],
        masteryHistory: Array.isArray(fc.masteryHistory) ? fc.masteryHistory : [],
        srsStage: Number(fc.srsStage) || 0,
        lastAttemptDate: fc.lastAttemptDate || '',
        timeSec: Number(fc.timeSec) || 0,
        selfEvalLevel: Number(fc.selfEvalLevel) || 0,
    };
};

export const FlashcardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { logSystemError } = useSettings();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
      async function load() {
          try {
              const data = await loadData<any[]>(LS_FLASHCARDS_KEY);
              if (data && Array.isArray(data)) {
                  const hydrated = data.map((fc: any, index: number) => hydrateFlashcard(fc, index)).filter((fc): fc is Flashcard => fc !== null);
                  setFlashcards(hydrated);
              } else {
                  setFlashcards(SAMPLE_FLASHCARDS.map((fc_data, index) => ({ ...fc_data, id: `fc_sample_${index}` })));
              }
          } catch (e) {
              logSystemError(e, 'FlashcardContext Load');
              setFlashcards(SAMPLE_FLASHCARDS.map((fc_data, index) => ({ ...fc_data, id: `fc_sample_${index}` })));
          } finally {
              setIsLoaded(true);
          }
      }
      load();
  }, [logSystemError]);

  useEffect(() => {
    if (!isLoaded) return;
    const save = async () => {
        try {
            await saveData(LS_FLASHCARDS_KEY, flashcards);
        } catch (e) {
            logSystemError(e, 'FlashcardContext Save');
        }
    };
    save();
  }, [flashcards, isLoaded, logSystemError]);

  const addFlashcard = useCallback((newCardData: Omit<Flashcard, 'id'>) => {
    const newCard: Flashcard = { ...newCardData, id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` };
    setFlashcards(prev => [...prev, newCard]);
  }, []);

  const updateFlashcard = useCallback((updatedCard: Flashcard) => {
    setFlashcards(prev => prev.map(fc => (fc.id === updatedCard.id ? { ...updatedCard, updatedAt: new Date().toISOString() } : fc)));
  }, []);

  const updateBatchFlashcards = useCallback((updates: ({ id: string } & Partial<Omit<Flashcard, 'id'>>)[]) => {
    setFlashcards(prev => {
        const updatesMap = new Map(updates.map(u => [u.id, u]));
        return prev.map(fc => {
            const update = updatesMap.get(fc.id);
            return update ? { ...fc, ...update } : fc;
        });
    });
  }, []);
  
  const addBatchFlashcards = useCallback((newCards: Flashcard[]) => {
      setFlashcards(prev => {
          const prevMap = new Map(prev.map(f => [f.id, f]));
          newCards.forEach(f => prevMap.set(f.id, f));
          return Array.from(prevMap.values());
      });
    }, []);

  const deleteFlashcards = useCallback((ids: string[]) => {
    const idsSet = new Set(ids);
    setFlashcards(prev => prev.filter(fc => !idsSet.has(fc.id)));
  }, []);
  
  const dispatchValue = useMemo(() => ({
    addFlashcard, updateFlashcard, addBatchFlashcards, deleteFlashcards, updateBatchFlashcards,
  }), [addFlashcard, updateFlashcard, addBatchFlashcards, deleteFlashcards, updateBatchFlashcards]);

  return (
    <FlashcardStateContext.Provider value={flashcards}>
        <FlashcardDispatchContext.Provider value={dispatchValue}>
            {children}
        </FlashcardDispatchContext.Provider>
    </FlashcardStateContext.Provider>
  );
};

export const useFlashcardState = () => {
  const context = useContext(FlashcardStateContext);
  if (context === undefined) throw new Error('useFlashcardState error');
  return context;
};

export const useFlashcardDispatch = () => {
  const context = useContext(FlashcardDispatchContext);
  if (context === undefined) throw new Error('useFlashcardDispatch error');
  return context;
};
