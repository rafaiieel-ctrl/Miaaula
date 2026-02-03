
import { LiteralnessCard, Question, Flashcard, AppSettings } from '../types';
import * as srs from './srsService';
import { saveData, loadData } from './storage';
import { sanitizeOptionText } from './questionParser'; // Import sanitizer

interface Issue {
    id: string;
    entityId: string;
    entityType: 'CARD' | 'QUESTION';
    type: 'BAD_LINK' | 'ORPHAN_QUESTIONS' | 'MISSING_FIELD' | 'SCHEMA_OUTDATED';
    description: string;
    severity: 'critical' | 'warning';
}

interface DiagnosisReport {
    issues: Issue[];
    stats: {
        cardsChecked: number;
        questionsChecked: number;
        criticalIssues: number;
    };
    timestamp: number;
}

const STORAGE_KEYS = {
    QUESTIONS: 'revApp_questions_v5_react',
    LITERALNESS: 'revApp_literalness_v1',
    FLASHCARDS: 'revApp_flashcards_v1'
};

export const runDiagnosis = async (
    cards: LiteralnessCard[],
    questions: Question[],
    flashcards: Flashcard[],
    settings: AppSettings
): Promise<DiagnosisReport> => {
    const issues: Issue[] = [];
    let criticalIssues = 0;
    const cardsMap = new Map(cards.map(c => [srs.canonicalizeLitRef(c.id), c]));

    // 1. Check Cards - Minimal Checks only
    for (const card of cards) {
        // We no longer consider missing questionIds array as critical if canonical link works
        if (!card.id) {
             issues.push({ 
                 id: `missing_id_${Math.random()}`, 
                 entityId: 'unknown', 
                 entityType: 'CARD', 
                 type: 'MISSING_FIELD', 
                 description: 'Card without ID found.', severity: 'critical' 
             });
             criticalIssues++;
        }
        
        if (!card.schemaVersion || card.schemaVersion < 3) {
             issues.push({ id: `schema_${card.id}`, entityId: card.id, entityType: 'CARD', type: 'SCHEMA_OUTDATED', description: 'Card using old schema version', severity: 'warning' });
        }
    }

    // 2. Check Questions for ORPHAN status
    for (const q of questions) {
        if (q.lawRef) {
             const targetId = srs.canonicalizeLitRef(q.lawRef);
             if (!cardsMap.has(targetId)) {
                 issues.push({
                     id: `orphan_${q.id}`,
                     entityId: q.id,
                     entityType: 'QUESTION',
                     type: 'ORPHAN_QUESTIONS',
                     description: `Question ${q.questionRef} points to lawRef ${q.lawRef} which does not exist.`,
                     severity: 'warning'
                 });
             }
        }
    }

    return { 
        issues, 
        stats: { cardsChecked: cards.length, questionsChecked: questions.length, criticalIssues }, 
        timestamp: Date.now() 
    };
};

export const runRepair = async (
    cards: LiteralnessCard[],
    questions: Question[],
    flashcards: Flashcard[],
    settings: AppSettings
): Promise<{ success: boolean; log: string[] }> => {
    const log: string[] = [];
    let updatedCardsCount = 0;
    let sanitizedQuestionsCount = 0;
    
    try {
        log.push('Starting Metrics Recompute (Safe Repair)...');
        
        // 1. Recompute metrics for all cards to ensure consistency in stats
        const finalizedCards = cards.map(c => {
             const { updatedCard } = srs.recomputeArticleCardStatus(c, questions, flashcards, settings);
             return updatedCard;
        });

        updatedCardsCount = finalizedCards.length;

        // 2. SANITIZE OPTIONS BACKFILL (Fix for P7 leaks)
        const cleanedQuestions = questions.map(q => {
            let hasChange = false;
            const newOptions: any = {};
            
            if (q.options) {
                Object.keys(q.options).forEach(k => {
                    // @ts-ignore
                    const original = q.options[k];
                    const clean = sanitizeOptionText(original);
                    newOptions[k] = clean;
                    if (original !== clean) hasChange = true;
                });
            }
            
            if (hasChange) {
                sanitizedQuestionsCount++;
                return { ...q, options: newOptions };
            }
            return q;
        });

        if (updatedCardsCount > 0) {
            await saveData(STORAGE_KEYS.LITERALNESS, finalizedCards);
            log.push(`Metrics Updated for ${updatedCardsCount} cards.`);
        }
        
        if (sanitizedQuestionsCount > 0) {
            await saveData(STORAGE_KEYS.QUESTIONS, cleanedQuestions);
            log.push(`Sanitized options for ${sanitizedQuestionsCount} questions (removed metadata leaks).`);
        } else {
            log.push('No question sanitization needed.');
        }
        
        return { success: true, log };

    } catch (e: any) {
        console.error("Repair Failed", e);
        log.push(`ERROR: ${e.message}`);
        return { success: false, log };
    }
};

/**
 * Repairs a single question object to ensure consistency.
 */
export const repairQuestion = (q: Question): Question => {
    const repaired = { ...q };
    if (!repaired.id) repaired.id = `q_${Date.now()}_repair_${Math.random().toString(36).substr(2, 5)}`;
    if (!repaired.options) repaired.options = { A: '', B: '' };
    // Canonicalize refs
    if (repaired.lawRef) repaired.lawRef = srs.canonicalizeLitRef(repaired.lawRef);
    if (repaired.litRef) repaired.litRef = srs.canonicalizeLitRef(repaired.litRef);
    return repaired;
};

export const runBatchMigration = async (
    questions: Question[],
    cards: LiteralnessCard[]
): Promise<{ success: boolean; stats: { migrated: number, noRawData: number, total: number }; log: string[] }> => {
    const log: string[] = [];
    let migrated = 0;
    const updatedQuestions = questions.map(q => {
        const oldLawRef = q.lawRef;
        const newLawRef = srs.canonicalizeLitRef(oldLawRef);
        let changed = false;
        
        // Normalize refs
        if (oldLawRef !== newLawRef) changed = true;
        
        // Fix empty options if possible
        if (!q.options || Object.keys(q.options).length === 0) changed = true;
        
        if (changed) {
            migrated++;
            return repairQuestion({ ...q, lawRef: newLawRef });
        }
        return q;
    });
    
    if (migrated > 0) {
        await saveData(STORAGE_KEYS.QUESTIONS, updatedQuestions);
    }
    
    return {
        success: true,
        stats: { migrated, noRawData: 0, total: questions.length },
        log
    };
};

// ... Batch Report & Dump Logic ... (remains unchanged)

export interface BatchReport {
    meta: {
        batchId: string;
        timestamp: string;
        stats: {
            cards: number;
            questions: number;
            flashcards: number;
        }
    };
    integrity: {
        cardId: string;
        originalRef: string;
        questionsFoundByLawRef: number;
        questionsInArray: number;
        difference: number;
        samples: { id: string, ref: string }[];
    }[];
    collisions: {
        type: 'ID' | 'REF';
        key: string;
        count: number;
    }[];
    brokenRefs: {
        id: string;
        ref: string;
        issue: string;
    }[];
}

export const generateBatchReport = async (batchId: string): Promise<BatchReport> => {
    const cards = await loadData<LiteralnessCard[]>(STORAGE_KEYS.LITERALNESS) || [];
    const questions = await loadData<Question[]>(STORAGE_KEYS.QUESTIONS) || [];
    const flashcards = await loadData<Flashcard[]>(STORAGE_KEYS.FLASHCARDS) || [];

    const batchCards = cards.filter(c => c.importBatchId === batchId);
    const batchQuestions = questions.filter(q => q.importBatchId === batchId);
    const batchFlashcards = flashcards.filter(f => f.importBatchId === batchId);

    const integrity = batchCards.map(c => {
        const linkedByLawRef = batchQuestions.filter(q => srs.canonicalizeLitRef(q.lawRef) === srs.canonicalizeLitRef(c.id));
        const questionsInArray = c.questionIds?.length || 0;
        
        return {
            cardId: c.id,
            originalRef: c.article || c.id,
            questionsFoundByLawRef: linkedByLawRef.length,
            questionsInArray,
            difference: linkedByLawRef.length - questionsInArray,
            samples: linkedByLawRef.slice(0, 5).map(q => ({ id: q.id, ref: q.questionRef }))
        };
    });

    const refCounts = new Map<string, number>();
    const idCounts = new Map<string, number>();
    
    batchQuestions.forEach(q => {
        refCounts.set(q.questionRef, (refCounts.get(q.questionRef) || 0) + 1);
        idCounts.set(q.id, (idCounts.get(q.id) || 0) + 1);
    });

    const collisions: { type: 'ID' | 'REF', key: string, count: number }[] = [];
    refCounts.forEach((count, key) => {
        if (count > 1) collisions.push({ type: 'REF', key, count });
    });
    idCounts.forEach((count, key) => {
        if (count > 1) collisions.push({ type: 'ID', key, count });
    });

    const brokenRefs = batchQuestions
        .filter(q => !q.lawRef || !cards.some(c => srs.canonicalizeLitRef(c.id) === srs.canonicalizeLitRef(q.lawRef)))
        .map(q => ({ id: q.id, ref: q.questionRef, issue: !q.lawRef ? 'Missing LawRef' : 'Orphan (No Card)' }));

    return {
        meta: {
            batchId,
            timestamp: new Date().toISOString(),
            stats: {
                cards: batchCards.length,
                questions: batchQuestions.length,
                flashcards: batchFlashcards.length
            }
        },
        integrity,
        collisions,
        brokenRefs
    };
};

export const dumpDatabase = async () => {
    const cards = await loadData(STORAGE_KEYS.LITERALNESS);
    const questions = await loadData(STORAGE_KEYS.QUESTIONS);
    
    const dump = {
        timestamp: new Date().toISOString(),
        cards,
        questions
    };
    
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miaaula_dump_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
