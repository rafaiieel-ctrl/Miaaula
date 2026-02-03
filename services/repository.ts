
import * as storage from './storage';
import * as srs from './srsService';
import { LiteralnessCard, Question, Flashcard } from '../types';

export interface HydratedItem {
    id: string;
    litRef: string;
    type: string;
    idx: number;
    payload: any;
    progress?: any;
}

export interface HydratedNucleus {
    nucleus: LiteralnessCard;
    lacunas: HydratedItem[];
    questions: HydratedItem[];
    flashcards: HydratedItem[];
    pairs: HydratedItem[];
    counts: {
        lacunas: number;
        questions: number;
        flashcards: number;
        pairs: number;
    };
}

export const repository = {
    /**
     * Busca TODAS as lacunas do sistema para o modo Arcade (Gap Hunter).
     * Ignora o contexto de artigo individual.
     */
    async getAllGaps(): Promise<HydratedItem[]> {
        const allContent = await storage.dbGetByIndex<HydratedItem>(storage.STORES.CONTENT, 'type', 'LACUNA');
        return allContent || [];
    },

    async getNucleusHydrated(litRef: string, userId: string = 'default'): Promise<HydratedNucleus | null> {
        const canon = srs.canonicalizeLitRef(litRef);
        
        // 1. Nucleus Data
        const nucleus = await storage.dbGet<any>(storage.STORES.NUCLEUS, canon);
        if (!nucleus) return null;

        // 2. Fetch Content and Progress in parallel
        const [contents, progressList] = await Promise.all([
            storage.dbGetByIndex<any>(storage.STORES.CONTENT, 'litRef', canon),
            storage.dbGetByIndex<any>(storage.STORES.PROGRESS, 'litRef', canon)
        ]);

        const progressMap = new Map(
            progressList.filter(p => p.userId === userId || !p.userId).map(p => [p.itemId, p])
        );

        const result: any = {
            nucleus,
            lacunas: [], questions: [], flashcards: [], pairs: [],
            counts: { lacunas: 0, questions: 0, flashcards: 0, pairs: 0 }
        };

        contents.sort((a, b) => a.idx - b.idx).forEach(item => {
            const hydrated = {
                ...item,
                progress: progressMap.get(item.id) || { attempts: 0, mastery: 0 }
            };

            if (item.type === 'LACUNA') { result.lacunas.push(hydrated); result.counts.lacunas++; }
            else if (item.type === 'QUESTION') { result.questions.push(hydrated); result.counts.questions++; }
            else if (item.type === 'FLASHCARD') { result.flashcards.push(hydrated); result.counts.flashcards++; }
            else if (item.type === 'PAIR') { result.pairs.push(hydrated); result.counts.pairs++; }
        });

        return result as HydratedNucleus;
    },

    hydrateCardWithGaps(card: LiteralnessCard, lacunas: HydratedItem[]): LiteralnessCard {
        const mappedGaps = lacunas.map(l => ({
            id: l.id,
            text: l.payload.lacuna_text || l.payload.text,
            correct: l.payload.correct_letter || l.payload.correct || 'A',
            options: l.payload.options || { A: 'Erro' }
        }));

        return {
            ...card,
            extraGaps: mappedGaps
        };
    },

    /**
     * COMMIT ATÔMICO DE PROGRESSO
     * Garante persistência resiliente a reimports.
     */
    async saveProgress(itemId: string, litRef: string, updates: any, userId: string = 'default') {
        const pk = `${userId}:${itemId}`;
        const existing = await storage.dbGet<any>(storage.STORES.PROGRESS, pk) || { pk, userId, itemId, litRef };
        
        const merged = { 
            ...existing, 
            ...updates,
            lastAttemptAt: updates.lastAttemptAt || new Date().toISOString()
        };

        await storage.dbPut(storage.STORES.PROGRESS, merged);
        console.log(`[ATOMIC_COMMIT] Saved progress for ${itemId}`);
    }
};
