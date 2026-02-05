
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { LiteralnessCard, Question, Flashcard } from '../types';
import * as storage from '../services/storage';
import * as idGen from '../services/idGenerator';
import * as srs from '../services/srsService';

const LiteralnessStateContext = createContext<LiteralnessCard[] | undefined>(undefined);
const LiteralnessDispatchContext = createContext<any | undefined>(undefined);

export const LiteralnessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cards, setCards] = useState<LiteralnessCard[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const boot = async () => {
            const legacyKey = 'revApp_literalness_v1';
            if (localStorage.getItem(legacyKey)) {
                console.log("[Literalness] Limpando cache legado para nova arquitetura...");
                localStorage.removeItem(legacyKey);
            }

            const db = await storage.openDB();
            
            // --- MIGRATION: SCOPE ASSIGNMENT ---
            // Detect Trail Lessons to flag their corresponding cards
            const trails = await storage.loadData<any[]>('revApp_trails_v1') || [];
            const lessonIds = new Set<string>();
            
            trails.forEach(t => {
                if (t.lessons && Array.isArray(t.lessons)) {
                    t.lessons.forEach((l: any) => {
                         if (l.id) lessonIds.add(srs.canonicalizeLitRef(l.id));
                         if (l.uid) lessonIds.add(srs.canonicalizeLitRef(l.uid));
                    });
                }
            });

            const tx = db.transaction(storage.STORES.NUCLEUS, 'readwrite');
            const store = tx.objectStore(storage.STORES.NUCLEUS);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const loadedCards: LiteralnessCard[] = request.result || [];
                let hasMigration = false;

                const migratedCards = loadedCards.map(c => {
                    if (!c.scope) {
                        hasMigration = true;
                        const canonId = srs.canonicalizeLitRef(c.id);
                        if (lessonIds.has(canonId)) {
                             return { ...c, scope: 'TRILHA' as const };
                        } else {
                             return { ...c, scope: 'LEI_SECA' as const };
                        }
                    }
                    return c;
                });
                
                if (hasMigration) {
                    console.log("[Literalness] Migrating scopes for isolation...");
                    migratedCards.forEach(c => store.put(c));
                }

                setCards(migratedCards);
                setIsLoaded(true);
            };
        };
        boot();
    }, []);

    const addBatchCards = useCallback(async (newCards: LiteralnessCard[], questions: Question[] = [], flashcards: Flashcard[] = [], gaps: any[] = []) => {
        // Validação defensiva
        const safeQuestions = Array.isArray(questions) ? questions : [];
        const safeFlashcards = Array.isArray(flashcards) ? flashcards : [];
        const safeGaps = Array.isArray(gaps) ? gaps : [];

        // 1. Persiste Núcleos
        await storage.dbPut(storage.STORES.NUCLEUS, newCards);
        
        // 2. Persiste Questões
        if (safeQuestions.length > 0) {
            const questionsContent = safeQuestions.map((q, idx) => ({
                id: idGen.makeStableId(q.lawRef || '', 'QUESTION', q.questionRef || idx),
                litRef: srs.canonicalizeLitRef(q.lawRef),
                type: 'QUESTION',
                payload: q
            }));
            await storage.dbPut(storage.STORES.CONTENT, questionsContent);
        }

        // 3. Persiste Flashcards
        if (safeFlashcards.length > 0) {
            const flashcardsContent = safeFlashcards.map((f, idx) => {
                // Ensure tags is an array
                const tags = f.tags || [];
                return {
                    id: f.id || idGen.makeStableId(srs.resolveLitRef(f), 'FLASHCARD', idx),
                    litRef: srs.resolveLitRef(f),
                    // Safe check for pair-match
                    type: tags.includes('pair-match') ? 'PAIR' : 'FLASHCARD',
                    payload: f
                };
            });
            await storage.dbPut(storage.STORES.CONTENT, flashcardsContent);
        }
        
        // 4. Persiste Gaps (CRÍTICO para o jogo de lacunas funcionar)
        if (safeGaps.length > 0) {
             await storage.dbPut(storage.STORES.CONTENT, safeGaps);
        }

        setCards(prev => {
            const incomingIds = new Set(newCards.map(c => c.id));
            return [...prev.filter(c => !incomingIds.has(c.id)), ...newCards];
        });
    }, []);

    const updateCard = useCallback(async (card: LiteralnessCard) => {
        await storage.dbPut(storage.STORES.NUCLEUS, card);
        setCards(prev => prev.map(c => c.id === card.id ? card : c));
    }, []);

    const moveCardToLaw = useCallback(async (cardId: string, newLawId: string) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return;
        const updated = { ...card, lawId: newLawId };
        await updateCard(updated);
    }, [cards, updateCard]);

    const deleteCards = useCallback(async (ids: string[]) => {
        for (const id of ids) {
            await storage.dbDelete(storage.STORES.NUCLEUS, id);
        }
        setCards(prev => prev.filter(c => !ids.includes(c.id)));
    }, []);

    const dispatch = useMemo(() => ({ addBatchCards, updateCard, deleteCards, moveCardToLaw }), [addBatchCards, updateCard, deleteCards, moveCardToLaw]);

    return (
        <LiteralnessStateContext.Provider value={cards}>
            <LiteralnessDispatchContext.Provider value={dispatch}>
                {children}
            </LiteralnessDispatchContext.Provider>
        </LiteralnessStateContext.Provider>
    );
};

export const useLiteralnessState = () => useContext(LiteralnessStateContext)!;
export const useLiteralnessDispatch = () => useContext(LiteralnessDispatchContext)!;
