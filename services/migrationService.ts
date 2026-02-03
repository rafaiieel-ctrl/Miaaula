
import { Question, LiteralnessCard, Flashcard, StudyStep } from '../types';
import * as srs from './srsService';
import { parseQuestionText } from './questionParser';
import { buildReadingSteps } from './readingParser';

// --- Hash Helper for Deterministic IDs ---
// Used only when an ID is completely missing to avoid random generation
const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
};

// Generates a stable ID: CARD_ID + HASH(TEXT)
export const generateStableQuestionId = (litRef: string, qRef: string, text: string) => {
    const cleanRef = srs.canonicalizeLitRef(litRef || 'GENERAL');
    const cleanQRef = srs.canonicalizeLitRef(qRef || 'Q00');
    // If QRef is generic (Q01, Q02), mix in text hash to ensure uniqueness across different imports
    if (cleanQRef.length < 5 || cleanQRef.startsWith('Q')) {
        const textHash = simpleHash(text.trim().slice(0, 50)); 
        return `${cleanRef}__${cleanQRef}_${textHash}`;
    }
    return `${cleanRef}__${cleanQRef}`;
};

// --- MIGRATION LOGIC ---

/**
 * Normalizes a raw question object into the canonical Question schema.
 * CRITICAL RULE: NEVER change an existing valid ID.
 * SAFETY RULE: Prefer existing lawRef if input doesn't specify one.
 */
export const normalizeQuestion = (raw: any, litRefContext: string): Question => {
    // 1. Text & Options
    let qText = raw.questionText || raw.Q_TEXT || raw.text || '';
    let options = raw.options || {};
    
    // Auto-parse options if missing but present in text or legacy fields
    if (!options.A && !options.B) {
        if (raw.OPT_A) options = { A: raw.OPT_A, B: raw.OPT_B, C: raw.OPT_C, D: raw.OPT_D, E: raw.OPT_E };
        else if (raw.A) options = { A: raw.A, B: raw.B, C: raw.C, D: raw.D, E: raw.E };
        else {
            const parsed = parseQuestionText(qText);
            if (Object.keys(parsed.options).length > 0) {
                options = parsed.options;
                qText = parsed.stem;
            }
        }
    }

    // 2. Correct Answer
    let correct = raw.correctAnswer || raw.CORRECT || raw.correct || 'A';
    correct = correct.trim().toUpperCase().charAt(0);

    // 3. Identifiers
    // Ensure LitRef/LawRef is consistent.
    // SAFE MERGE: Prefer raw.lawRef, then raw.litRef, then context.
    // If none exist, we default to empty string.
    let litRef = raw.lawRef || raw.litRef || litRefContext || '';
    litRef = srs.canonicalizeLitRef(litRef);

    const qRef = raw.questionRef || raw.qRef || raw.Q_REF || `Q-${Date.now().toString().slice(-4)}`;

    // 4. CRITICAL: ID HANDLING
    // If ID exists and is NOT temp, keep it exactly as is.
    // This prevents overwrite during hydration.
    let questionId = raw.id || raw.questionId;
    
    const isTempId = !questionId || questionId.startsWith('temp_') || questionId.startsWith('new_');
    
    if (isTempId) {
        // Generate a deterministic ID so that re-imports or refreshes map to the same object
        questionId = generateStableQuestionId(litRef, qRef, qText);
    }

    // 5. SRS & Stats (Preserve or Default)
    const today = srs.todayISO();
    
    return {
        ...raw, // Keep other props
        id: questionId, // THE STABLE ID
        questionId, 
        
        litRef: litRef,
        lawRef: litRef, // Source of Truth for linking
        questionRef: qRef,
        
        questionText: qText,
        options,
        correctAnswer: correct,
        
        // Explanations & Feedback Engine (STRICT MAPPING)
        explanation: raw.explanation || raw.EXPLANATION || '',
        
        explanationTech: raw.explanationTech || raw.EXPLANATION_TECH || raw.explanation || '',
        explanationStory: raw.explanationStory || raw.EXPLANATION_STORY || '',
        
        feynmanQuestions: raw.feynmanQuestions || raw.PERGUNTAS_FEYNMAN || raw.feynman || '',
        feynman: raw.feynman || raw.feynmanQuestions || '', // legacy fallback
        
        distractorProfile: raw.distractorProfile || raw.DISTRACTOR_PROFILE || {},
        
        wrongDiagnosis: raw.wrongDiagnosis || raw.WRONG_DIAGNOSIS || '',
        wrongDiagnosisMap: raw.wrongDiagnosisMap || raw.WRONG_DIAGNOSIS_MAP || {},
        
        keyDistinction: raw.keyDistinction || raw.PALAVRA_QUE_SALVA || '',
        anchorText: raw.anchorText || raw.FRASE_ANCORA_FINAL || '',
        
        // Mapeamento extra para Trapscan (pode vir como string do import raw)
        guiaTrapscan: raw.guiaTrapscan || raw.GUIA_TRAPSCAN || '',

        // Meta
        subject: raw.subject || raw.discipline || 'Geral',
        topic: raw.topic || 'Geral',
        createdAt: raw.createdAt || today,
        nextReviewDate: raw.nextReviewDate || today,
        
        // Stats - Ensure numeric safety
        totalAttempts: Number(raw.totalAttempts) || 0,
        masteryScore: Number(raw.masteryScore) || 0,
        stability: Number(raw.stability) || 1,
        
        attemptHistory: Array.isArray(raw.attemptHistory) ? raw.attemptHistory : [],
        
        sourceSchema: 'current'
    };
};

/**
 * Migrates a LiteralnessCard to the new schema.
 */
export const migrateLiteralnessCard = (raw: any): LiteralnessCard => {
    const cardId = srs.canonicalizeLitRef(raw.id || raw.litRef || 'unknown');

    // 1. Map Article Content
    const storytellingArticle = raw.storytellingArticle || raw.storytelling || raw.STORYTELLING || '';
    const feynmanArticle = raw.feynmanArticle || raw.feynmanExplanation || raw.FEYNMAN || '';
    
    // 2. Rebuild Study Flow 
    const tempForFlow = { ...raw, storytelling: storytellingArticle, feynmanExplanation: feynmanArticle };
    const studyFlow = buildReadingSteps(tempForFlow);

    // 3. Safe Arrays (Never Null)
    // IMPORTANT: We do NOT force `questionIds` here because source of truth is now `lawRef` on questions.
    // We just keep it if it exists for legacy cache support.
    const qIds = Array.isArray(raw.questionIds) ? raw.questionIds : [];

    return {
        ...raw,
        id: cardId,
        lawId: raw.lawId || 'Geral',
        
        storytellingArticle,
        feynmanArticle,
        storytelling: storytellingArticle,
        feynmanExplanation: feynmanArticle,
        
        studyFlow, 
        questionIds: qIds, // Legacy cache, can be empty
        extraGaps: Array.isArray(raw.extraGaps) ? raw.extraGaps : [],
        
        contentType: raw.contentType || 'LAW_DRY',
        schemaVersion: 3
    };
};

/**
 * Batch migration for app load.
 */
export const migrateAllQuestions = (rawList: any[]): Question[] => {
    const seen = new Set<string>();
    const result: Question[] = [];
    
    rawList.forEach(raw => {
        const context = raw.litRef || raw.lawRef || '';
        const q = normalizeQuestion(raw, context);
        if (q && !seen.has(q.id)) {
            seen.add(q.id);
            result.push(q);
        }
    });
    
    return result;
};

/**
 * Identifies items that are missing their canonical linkage property (lawRef or litRef) 
 * but are logically connected to a card.
 */
export const calculateLinkageRepairs = (
    cards: LiteralnessCard[], 
    questions: Question[],
    flashcards: Flashcard[]
): { questions: { id: string, lawRef: string }[], flashcards: { id: string, litRef: string }[] } => {
    const qUpdates: { id: string, lawRef: string }[] = [];
    const fUpdates: { id: string, litRef: string }[] = [];
    
    const questionsById = new Map(questions.map(q => [q.id, q]));
    
    cards.forEach(card => {
        const canonCardId = srs.canonicalizeLitRef(card.id);

        // 1. Repair Questions (including external Gaps) via card.questionIds cache
        if (card.questionIds && card.questionIds.length > 0) {
            card.questionIds.forEach(qId => {
                const q = questionsById.get(qId);
                // If found AND has empty lawRef, backfill it with card.id
                if (q && (!q.lawRef || q.lawRef.trim() === '')) {
                    qUpdates.push({ id: q.id, lawRef: card.id });
                }
            });
        }

        // 2. Repair Flashcards (including Pairs) via Tags linkage
        // Criteria: Has tag matching card ID but NO litRef property
        flashcards.forEach(f => {
            const hasLinkTag = f.tags.some(t => srs.canonicalizeLitRef(t) === canonCardId);
            if (hasLinkTag && (!f.litRef || f.litRef.trim() === '')) {
                fUpdates.push({ id: f.id, litRef: card.id });
            }
        });

        // 3. Reverse repair for Questions: if question has text mentioning Article Ref or same topic
        // but missing lawRef. This is a "fuzzy" repair for imported orphans.
        questions.forEach(q => {
             if (!q.lawRef || q.lawRef.trim() === '') {
                 const qTopic = q.topic ? q.topic.trim() : '';
                 const cTopic = card.topic ? card.topic.trim() : '';
                 if (qTopic !== 'Geral' && qTopic === cTopic) {
                     qUpdates.push({ id: q.id, lawRef: card.id });
                 }
             }
        });
    });
    
    return { questions: qUpdates, flashcards: fUpdates };
};
