
import * as storage from './storage';
import { LiteralnessCard, Question, Flashcard, SrsItem } from '../types';
import * as srs from './srsService';

/**
 * Repository Service
 * Centralizes all cross-store data access to ensure LIT_REF integrity.
 */

export const nucleusRepo = {
    /**
     * Rehydrates an article completely, fetching linked content directly from DB 
     * to avoid "missing items" UI bugs.
     */
    async getFullArticleData(litRef: string) {
        const canon = srs.canonicalizeLitRef(litRef);
        
        // 1. Get Core Card
        const cards = await storage.loadData<LiteralnessCard[]>('revApp_literalness_v1') || [];
        const card = cards.find(c => srs.canonicalizeLitRef(c.id) === canon);
        
        if (!card) return null;

        // 2. Direct Index Search in DB (Source of Truth)
        // Fix: storage.STORES.QUESTIONS/FLASHCARDS do not exist. Using STORES.CONTENT and filtering by type.
        const allItems = await storage.dbGetByIndex<any>(storage.STORES.CONTENT, 'litRef', canon);
        const questions = allItems.filter(i => i.type === 'QUESTION').map(i => i.payload as Question);
        const flashcards = allItems.filter(i => i.type === 'FLASHCARD' || i.type === 'PAIR').map(i => i.payload as Flashcard);
        
        return {
            card,
            questions: questions.filter(q => !q.isGapType),
            gaps: srs.getGapsForCard(card, questions),
            flashcards: flashcards.filter(f => !f.tags?.includes('pair-match')),
            pairs: flashcards.filter(f => f.tags?.includes('pair-match'))
        };
    },

    /**
     * Persists imported batch ensuring immutability rules.
     */
    async saveImportBatch(batch: { cards: LiteralnessCard[], questions: Question[], flashcards: Flashcard[] }) {
        // Save to specialized stores for indexing
        await storage.dbPut(storage.STORES.NUCLEUS, batch.cards);
        
        // Fix: Use CONTENT store and wrap items into the type/payload structure used by the app.
        const questionsContent = batch.questions.map(q => ({
            id: q.id,
            litRef: srs.canonicalizeLitRef(q.lawRef || q.litRef),
            type: 'QUESTION',
            payload: q
        }));

        const flashcardsContent = batch.flashcards.map(fc => ({
            id: fc.id,
            litRef: srs.canonicalizeLitRef(fc.litRef || (fc.tags ? fc.tags.find(t => !['pair-match', 'literalness'].includes(t)) : undefined)),
            type: fc.tags?.includes('pair-match') ? 'PAIR' : 'FLASHCARD',
            payload: fc
        }));

        await storage.dbPut(storage.STORES.CONTENT, [...questionsContent, ...flashcardsContent]);
        
        // Sync with legacy stores for context compatibility
        // (In a full migration, we'd remove the legacy loadData calls)
        const existingCards = await storage.loadData<LiteralnessCard[]>('revApp_literalness_v1') || [];
        const existingQs = await storage.loadData<Question[]>('revApp_questions_v5_react') || [];
        const existingFs = await storage.loadData<Flashcard[]>('revApp_flashcards_v1') || [];

        const updatedCards = [...existingCards.filter(ec => !batch.cards.some(bc => bc.id === ec.id)), ...batch.cards];
        const updatedQs = [...existingQs.filter(eq => !batch.questions.some(bq => bq.id === eq.id)), ...batch.questions];
        const updatedFs = [...existingFs.filter(ef => !batch.flashcards.some(bf => bf.id === ef.id)), ...batch.flashcards];

        await storage.saveData('revApp_literalness_v1', updatedCards);
        await storage.saveData('revApp_questions_v5_react', updatedQs);
        await storage.saveData('revApp_flashcards_v1', updatedFs);
    }
};
