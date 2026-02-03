
import { LiteralnessCard, Question, Flashcard, AppSettings, Attempt, SrsItem } from '../types';
import * as srs from './srsService';

export type ActivityType = 'READING' | 'GAPS' | 'QUESTIONS' | 'FLASHCARDS' | 'PAIRS' | 'ONEMIN';
export type ActivityStatus = 'EMPTY' | 'NEVER_DONE' | 'DUE_NOW' | 'TRAIN' | 'OK' | 'COMPLETED_TODAY';

export interface ActivityState {
    type: ActivityType;
    status: ActivityStatus;
    totalItems: number;
    pendingItems: number;
    nextReview: number;
    avgMastery: number;
    avgDomain: number;
    accuracy: number;
    metaHit: boolean;
    newCount: number;
    dueCount: number;
    trainCount: number;
}

export interface CardActivitySummary {
    cardId: string;
    activities: Record<ActivityType, ActivityState>;
    totalPending: number; 
    maxOverdueDays: number;
    recommendedActivity: ActivityType | null;
    statusLabel: string;
    isCritical: boolean;
    // Calculated Global Metrics (0-100)
    globalDomain: number;
    globalMastery: number;
    // NEW: Real SRS Next Review
    nextReviewLabel: string;
}

const getNow = () => Date.now();

// --- HELPER: SCORING LOGIC PER CATEGORY ---
// Uses srsService to compute aggregated stats
function calculateCategoryStats(
    items: SrsItem[], 
    settings: AppSettings
): { domain: number, mastery: number, count: number } {
    if (items.length === 0) return { domain: 0, mastery: 0, count: 0 };
    
    // Use the central aggregator from SRS Service
    const stats = srs.computeAggregatedStats(items, settings);

    return {
        domain: stats.avgDomain,
        mastery: stats.avgMastery,
        count: items.length
    };
}

function computeActivityState(
    type: ActivityType,
    items: SrsItem[],
    cardContext: LiteralnessCard,
    settings: AppSettings,
    manualDoneFlag: boolean = false
): ActivityState {
    
    if (type === 'READING') {
         const isRead = manualDoneFlag;
         return {
             type,
             status: isRead ? 'OK' : 'NEVER_DONE',
             totalItems: 1,
             pendingItems: isRead ? 0 : 1,
             nextReview: 0,
             avgMastery: isRead ? 100 : 0,
             avgDomain: isRead ? 100 : 0,
             accuracy: isRead ? 1 : 0,
             metaHit: isRead,
             newCount: isRead ? 0 : 1,
             dueCount: 0,
             trainCount: 0
         };
    }

    if (!items || items.length === 0) {
        return { 
            type, status: 'EMPTY', totalItems: 0, pendingItems: 0, nextReview: Infinity, 
            avgMastery: 0, avgDomain: 0, accuracy: 0, metaHit: false, 
            newCount: 0, dueCount: 0, trainCount: 0 
        };
    }

    const now = getNow();
    let dueCount = 0;
    let newCount = 0;
    let passedMetaCount = 0;
    
    // Use unified aggregation for this specific subset
    const agg = srs.computeAggregatedStats(items, settings);
    
    let minNextReview = Infinity;
    
    items.forEach(item => {
        const nextRev = item.nextReviewDate ? new Date(item.nextReviewDate).getTime() : 0;
        const attempts = item.totalAttempts || 0;
        
        if (attempts === 0) {
            newCount++;
            minNextReview = 0; 
        } else {
            if (!isNaN(nextRev) && nextRev <= now) {
                dueCount++;
            }
            if (!isNaN(nextRev)) {
                minNextReview = Math.min(minNextReview, nextRev);
            }
        }

        let itemPassed = false;
        if (type === 'QUESTIONS' || type === 'GAPS') {
            if (attempts > 0 && item.lastWasCorrect) itemPassed = true;
        } else if (type === 'FLASHCARDS') {
            const level = item.lastGrade ? (['again', 'hard', 'good', 'easy'].indexOf(item.lastGrade)) : ((item as any).selfEvalLevel ?? 0);
            if (attempts > 0 && level >= 2) itemPassed = true;
        } else {
             if (attempts > 0) itemPassed = true;
        }

        if (itemPassed) passedMetaCount++;
    });

    const totalCount = items.length;
    const attemptedCount = totalCount - newCount;

    // STRICT METAS
    const META_QUESTIONS_ACC = 0.85; 
    const META_GAPS_ACC = 1.00; 
    const META_PAIRS_ERRORS = 6;

    let metaHit = false;
    let currentAccuracy = 0;

    if (type === 'QUESTIONS' || type === 'GAPS' || type === 'FLASHCARDS') {
        if (attemptedCount > 0) {
            currentAccuracy = passedMetaCount / attemptedCount;
            metaHit = currentAccuracy >= (type === 'QUESTIONS' ? META_QUESTIONS_ACC : 1.0);
        }
    } else if (type === 'PAIRS') {
        const lastErrors = cardContext.pairsLastSessionErrors ?? 999;
        const pairsPlayed = attemptedCount === totalCount; 
        metaHit = pairsPlayed && lastErrors <= META_PAIRS_ERRORS;
        currentAccuracy = metaHit ? 1 : 0;
    } else if (type === 'ONEMIN') {
        const bestScore = cardContext.oneMinBestScore || 0;
        metaHit = bestScore > 0;
        currentAccuracy = metaHit ? 1 : 0;
    }

    let status: ActivityStatus = 'OK';
    if (newCount > 0) status = 'NEVER_DONE';
    else if (dueCount > 0) status = 'DUE_NOW';
    else if (!metaHit) status = 'TRAIN';
    
    let trainCount = 0;
    if (status === 'TRAIN') {
        trainCount = attemptedCount - passedMetaCount; 
        if ((type === 'PAIRS' || type === 'ONEMIN') && !metaHit) trainCount = 1;
    }

    return {
        type,
        status,
        totalItems: totalCount,
        pendingItems: newCount + dueCount,
        nextReview: minNextReview,
        avgMastery: agg.avgMastery,
        avgDomain: agg.avgDomain,
        accuracy: currentAccuracy,
        metaHit,
        newCount,
        dueCount,
        trainCount
    };
}

export function analyzeCardActivity(
    card: LiteralnessCard,
    allQuestions: Question[],
    allFlashcards: Flashcard[],
    settings: AppSettings
): CardActivitySummary {
    
    // 1. Get Aggregated SRS Stats (SOURCE OF TRUTH)
    // This calculates Domain, Mastery and Next Review Date based on linked items
    const srsStats = srs.getLitRefProgressStats(card.id, allQuestions, allFlashcards, settings);

    const relQuestions = srs.getQuestionsForCard(card, allQuestions);
    const allRelFlashcards = srs.getFlashcardsForCard(card, allFlashcards);
    
    const relFlashcards = allRelFlashcards.filter(fc => !fc.tags?.includes('pair-match'));
    const relPairs = srs.getPairsForCard(card, allFlashcards);
    const allGaps = srs.getGapsForCard(card, allQuestions);
    
    const readState = computeActivityState('READING', [], card, settings, !!card.cycleProgress?.readDone);
    const gapsState = computeActivityState('GAPS', allGaps, card, settings); 
    const questState = computeActivityState('QUESTIONS', relQuestions, card, settings);
    const flashState = computeActivityState('FLASHCARDS', relFlashcards, card, settings);
    const pairsState = computeActivityState('PAIRS', relPairs, card, settings);
    const oneminState = computeActivityState('ONEMIN', [...relQuestions, ...allGaps], card, settings);
    
    const activities = {
        READING: readState,
        GAPS: gapsState,
        QUESTIONS: questState,
        FLASHCARDS: flashState,
        PAIRS: pairsState,
        ONEMIN: oneminState
    };

    const totalPending = 
        readState.pendingItems + 
        gapsState.pendingItems + 
        questState.pendingItems + 
        flashState.pendingItems + 
        pairsState.pendingItems;
    
    let maxOverdueDays = 0;
    const now = getNow();
    
    // Calculate max overdue based on all linked items
    [relQuestions, relFlashcards, relPairs, allGaps].flat().forEach(item => {
        if (item.nextReviewDate) {
            const due = new Date(item.nextReviewDate).getTime();
            if (due < now) {
                const days = (now - due) / (1000 * 60 * 60 * 24);
                if (days > maxOverdueDays) maxOverdueDays = days;
            }
        }
    });

    let recommended: ActivityType | null = null;
    if (readState.status === 'NEVER_DONE') recommended = 'READING';
    else if (gapsState.status === 'NEVER_DONE') recommended = 'GAPS';
    else if (questState.status === 'NEVER_DONE') recommended = 'QUESTIONS';
    else if (flashState.status === 'NEVER_DONE') recommended = 'FLASHCARDS';
    else if (pairsState.status === 'NEVER_DONE') recommended = 'PAIRS';
    
    if (!recommended) {
        const dueList = [gapsState, questState, flashState, pairsState].filter(s => s.status === 'DUE_NOW');
        if (dueList.length > 0) {
            dueList.sort((a, b) => b.dueCount - a.dueCount);
            recommended = dueList[0].type;
        }
    }

    let statusLabel = 'Em Dia';
    if (totalPending > 0) {
        if (maxOverdueDays > 0) statusLabel = 'Revisar';
        else if (activities.READING.status === 'NEVER_DONE') statusLabel = 'Novo';
        else statusLabel = 'Pendente';
    } else if ([readState, gapsState, questState, flashState, pairsState].some(s => s.status === 'TRAIN')) {
        statusLabel = 'Treinar';
    }

    const isCritical = maxOverdueDays > 7 || srsStats.domain < 25;

    return {
        cardId: card.id,
        activities,
        totalPending,
        maxOverdueDays,
        recommendedActivity: recommended,
        statusLabel,
        isCritical,
        globalDomain: srsStats.domain,
        globalMastery: srsStats.mastery,
        nextReviewLabel: srsStats.nextReviewLabel
    };
}

export const processSessionResult = (
    items: (Question | Flashcard)[],
    answers: { itemId: string; wasCorrect: boolean; rating: 0 | 1 | 2 | 3; timeSec: number }[],
    parentCard: LiteralnessCard | null,
    settings: AppSettings
) => {
    const updatedQuestions: Question[] = [];
    const updatedFlashcards: Flashcard[] = [];
    
    const answerMap = new Map(answers.map(a => [a.itemId, a]));

    items.forEach(item => {
        const ans = answerMap.get(item.id);
        if (!ans) return;

        const srsResult = srs.calculateNewSrsState(item, ans.wasCorrect, ans.rating, ans.timeSec, settings);
        
        const historyEntry: Attempt = {
            date: srsResult.lastReviewedAt!,
            wasCorrect: ans.wasCorrect,
            masteryAfter: srsResult.masteryScore, 
            stabilityAfter: srsResult.stability,
            difficultyAfter: srsResult.difficulty, 
            timeSec: Math.round(ans.timeSec),
            selfEvalLevel: ans.rating,
            grade: srsResult.grade, // Safe now
            timingClass: srsResult.timingClass,
            targetSec: srsResult.targetSec
        };

        const baseUpdate = {
            ...item,
            ...srsResult,
            totalAttempts: (item.totalAttempts || 0) + 1,
            correctStreak: ans.wasCorrect ? (item.correctStreak || 0) + 1 : 0,
            recentError: ans.wasCorrect ? 0 : 1,
            lapses: !ans.wasCorrect ? (item.lapses || 0) + 1 : item.lapses,
            lastGrade: srsResult.grade,
            attemptHistory: [...(item.attemptHistory || []), historyEntry]
        };

        if ('questionText' in item) {
            updatedQuestions.push(baseUpdate as Question);
        } else {
            updatedFlashcards.push(baseUpdate as Flashcard);
        }
    });

    return { updatedQuestions, updatedFlashcards };
};

export const recomputeLiteralnessMetrics = (
    card: LiteralnessCard,
    allQuestions: Question[],
    allFlashcards: Flashcard[],
    settings: AppSettings,
    overrides?: (Question | Flashcard)[]
): LiteralnessCard => {
    // 1. Get Aggregated SRS Stats (Source of Truth)
    // This updates the CARD fields to match the items state
    const srsStats = srs.getLitRefProgressStats(card.id, allQuestions, allFlashcards, settings);

    return {
        ...card,
        domainPercent: srsStats.domain,
        masteryScore: srsStats.mastery,
        nextReviewDate: srsStats.nextReviewDate ? srsStats.nextReviewDate.toISOString() : (card.nextReviewDate || new Date().toISOString()),
        lastReviewedAt: new Date().toISOString()
    };
};
