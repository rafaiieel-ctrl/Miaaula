
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
}

const getNow = () => Date.now();

// --- HELPER: SCORING LOGIC PER CATEGORY ---
function calculateCategoryScore(
    items: SrsItem[], 
    type: 'GAPS' | 'QUESTIONS' | 'FLASHCARDS' | 'PAIRS'
): { domain: number, mastery: number } {
    const total = items.length;
    if (total === 0) return { domain: 0, mastery: 0 };

    let domainPoints = 0;
    let masteryPoints = 0;

    items.forEach(item => {
        const attempts = item.totalAttempts || 0;
        const isCorrect = item.lastWasCorrect;
        const hasRecentError = !!item.recentError;
        const masteryScore = item.masteryScore || 0;
        
        // --- DOMAIN LOGIC (Execution) ---
        // "Have I done it correctly at least once?"
        if (type === 'QUESTIONS') {
             // For Questions (SRS + Arcade): Count as covered if CORRECT AT LEAST ONCE in history
             const hasEverBeenCorrect = isCorrect || (item.attemptHistory && item.attemptHistory.some(a => a.wasCorrect));
             if (attempts > 0 && hasEverBeenCorrect) domainPoints++;
        } else if (type === 'GAPS') {
             // For Gaps: Strict current correctness usually preferred, but "at least once" is acceptable
             if (attempts > 0 && isCorrect) domainPoints++;
        } else if (type === 'FLASHCARDS') {
             // Flashcards: Just seeing it counts for Domain ("Passagem")
             if (attempts > 0) domainPoints++;
        } else if (type === 'PAIRS') {
             // Pairs: Must have played this specific pair
             if ((item as Flashcard).pairMatchPlayed) domainPoints++;
        }

        // --- MASTERY LOGIC (Stability) ---
        // "Is it stable/easy?"
        if (type === 'QUESTIONS') {
             // SRS Driven + Penalty for recent errors (Arcade style)
             let m = masteryScore;
             // Check last 2 attempts for errors to apply penalty
             if (item.attemptHistory && item.attemptHistory.length >= 1) {
                 const recentAttempts = item.attemptHistory.slice(-2);
                 const hasRecentFail = recentAttempts.some(a => !a.wasCorrect);
                 if (hasRecentFail) {
                     m = m * 0.7; // Apply 30% penalty for recent instability
                 }
             } else if (item.totalAttempts > 0 && !item.lastWasCorrect) {
                 // Fallback if history missing but status is error
                 m = m * 0.7;
             }
             masteryPoints += m;
        } else if (type === 'GAPS') {
            // Strict: Correct and NO recent error
            if (isCorrect && !hasRecentError && attempts > 0) masteryPoints += 100;
        } else if (type === 'FLASHCARDS') {
            // Quality: Only Good/Easy counts fully
            const grade = item.lastGrade;
            // Map grades to points: Easy/Good=100, Hard=50, Again=0
            if (grade === 'easy' || grade === 'good') masteryPoints += 100;
            else if (grade === 'hard') masteryPoints += 50;
            else if (masteryScore > 75) masteryPoints += 100; // Fallback to score
        } else if (type === 'PAIRS') {
            // Pairs: Played and NO recent error
            if ((item as Flashcard).pairMatchPlayed && !hasRecentError) masteryPoints += 100;
        }
    });

    return {
        domain: (domainPoints / total) * 100,
        mastery: (masteryPoints / total) // masteryPoints is already sum of 0-100 values (normalized per item logic)
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
    
    let sumMastery = 0;
    let sumDomain = 0;
    let minNextReview = Infinity;
    
    let passedMetaCount = 0;
    
    // STRICT METAS FOR "TRAINING" STATUS
    const META_QUESTIONS_ACC = 0.85; 
    const META_GAPS_ACC = 1.00; 
    const META_PAIRS_ERRORS = 6;
    
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

        const mScore = item.masteryScore || 0;
        const dScore = attempts > 0 ? srs.calculateCurrentDomain(item, settings) : 0;
        
        sumMastery += mScore;
        sumDomain += dScore;

        let itemPassed = false;
        
        if (type === 'QUESTIONS') {
            if (attempts > 0 && item.lastWasCorrect) itemPassed = true;
        } 
        else if (type === 'GAPS') {
            if (attempts > 0 && item.lastWasCorrect) itemPassed = true;
        }
        else if (type === 'FLASHCARDS') {
            const level = item.lastGrade ? (['again', 'hard', 'good', 'easy'].indexOf(item.lastGrade)) : ((item as any).selfEvalLevel ?? 0);
            if (attempts > 0 && level >= 2) itemPassed = true;
        }
        else {
             if (attempts > 0) itemPassed = true;
        }

        if (itemPassed) passedMetaCount++;
    });

    const totalCount = items.length;
    const attemptedCount = totalCount - newCount;

    const avgMastery = totalCount > 0 ? sumMastery / totalCount : 0;
    const avgDomain = totalCount > 0 ? sumDomain / totalCount : 0;

    let metaHit = false;
    let currentAccuracy = 0;

    if (type === 'QUESTIONS') {
        if (attemptedCount > 0) {
            currentAccuracy = passedMetaCount / attemptedCount;
            metaHit = currentAccuracy >= META_QUESTIONS_ACC; 
        }
    } else if (type === 'GAPS') {
        if (attemptedCount > 0) {
            currentAccuracy = passedMetaCount / attemptedCount;
            metaHit = currentAccuracy >= META_GAPS_ACC;
        }
    } else if (type === 'FLASHCARDS') {
        if (attemptedCount > 0) {
            currentAccuracy = passedMetaCount / attemptedCount;
            metaHit = currentAccuracy >= 1.0;
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
    
    if (newCount > 0) {
        status = 'NEVER_DONE';
    } else if (dueCount > 0) {
        status = 'DUE_NOW';
    } else if (!metaHit) {
        status = 'TRAIN';
    } else {
        status = 'OK';
    }
    
    let trainCount = 0;
    if (status === 'TRAIN') {
        trainCount = attemptedCount - passedMetaCount; 
        if ((type === 'PAIRS' || type === 'ONEMIN') && !metaHit) trainCount = 1;
    }

    const pendingItems = newCount + dueCount;

    return {
        type,
        status,
        totalItems: totalCount,
        pendingItems,
        nextReview: minNextReview,
        avgMastery,
        avgDomain,
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
    
    // 1. Gather Items using Robust SRS Getters
    const relQuestions = srs.getQuestionsForCard(card, allQuestions);
    const allRelFlashcards = srs.getFlashcardsForCard(card, allFlashcards);
    
    const relFlashcards = allRelFlashcards.filter(fc => !fc.tags?.includes('pair-match'));
    const relPairs = srs.getPairsForCard(card, allFlashcards);
    const allGaps = srs.getGapsForCard(card, allQuestions);
    
    // 2. Compute Individual Activity States (for UI/Buttons)
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

    // 3. Compute GLOBAL Metrics (The 25% Rule)
    const scoresGaps = calculateCategoryScore(allGaps, 'GAPS');
    const scoresQuest = calculateCategoryScore(relQuestions, 'QUESTIONS');
    const scoresFlash = calculateCategoryScore(relFlashcards, 'FLASHCARDS');
    const scoresPairs = calculateCategoryScore(relPairs, 'PAIRS');

    // Formula: Sum of each category / 4. 
    // If a category has 0 items, it contributes 0 to the sum, effectively punishing for missing content.
    const globalDomain = (scoresGaps.domain + scoresQuest.domain + scoresFlash.domain + scoresPairs.domain) / 4;
    const globalMastery = (scoresGaps.mastery + scoresQuest.mastery + scoresFlash.mastery + scoresPairs.mastery) / 4;

    const totalPending = 
        readState.pendingItems + 
        gapsState.pendingItems + 
        questState.pendingItems + 
        flashState.pendingItems + 
        pairsState.pendingItems;
    
    let maxOverdueDays = 0;
    const now = getNow();
    
    [relQuestions, relFlashcards, relPairs, allGaps].flat().forEach(item => {
        if (item.nextReviewDate) {
            const due = new Date(item.nextReviewDate).getTime();
            if (due < now) {
                const days = (now - due) / (1000 * 60 * 60 * 24);
                if (days > maxOverdueDays) maxOverdueDays = days;
            }
        }
    });

    if (card.nextReviewDate) {
        const due = new Date(card.nextReviewDate).getTime();
        if (due < now && (gapsState.totalItems > 0 || readState.totalItems > 0)) {
             const days = (now - due) / (1000 * 60 * 60 * 24);
             if (days > maxOverdueDays) maxOverdueDays = days;
        }
    }

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

    if (!recommended) {
        const trainList = [gapsState, questState, flashState, pairsState].filter(s => s.status === 'TRAIN');
        if (trainList.length > 0) {
            recommended = trainList[0].type;
        }
    }

    if (!recommended && oneminState.status === 'NEVER_DONE' && oneminState.totalItems > 0) {
        recommended = 'ONEMIN';
    }
    
    let statusLabel = 'Em Dia';
    if (totalPending > 0) {
        if (maxOverdueDays > 0) statusLabel = 'Revisar';
        else if (activities.READING.status === 'NEVER_DONE') statusLabel = 'Novo';
        else statusLabel = 'Pendente';
    } else if ([readState, gapsState, questState, flashState, pairsState].some(s => s.status === 'TRAIN')) {
        statusLabel = 'Treinar';
    }

    const isCritical = maxOverdueDays > 7 || globalMastery < 25; // Critical if mastery is very low (e.g., only 1 activity done)

    return {
        cardId: card.id,
        activities,
        totalPending,
        maxOverdueDays,
        recommendedActivity: recommended,
        statusLabel,
        isCritical,
        globalDomain,
        globalMastery
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
    const overrideMap = new Map<string, Question | Flashcard>();
    if (overrides) {
        overrides.forEach(item => overrideMap.set(item.id, item));
    }

    const rawQuestions = srs.getQuestionsForCard(card, allQuestions);
    const rawFlashcards = allFlashcards.filter(fc => fc.tags?.includes(card.id));
    const rawGaps = srs.getGapsForCard(card, rawQuestions); 

    const mergedQuestions = rawQuestions.map(q => (overrideMap.get(q.id) as Question) || q);
    const mergedFlashcards = rawFlashcards.map(fc => (overrideMap.get(fc.id) as Flashcard) || fc);
    
    // 2. Separate into Categories
    const relQuestions = mergedQuestions.filter(q => !q.isGapType);
    const relGaps = srs.getGapsForCard(card, mergedQuestions); 
    const relFlash = mergedFlashcards.filter(fc => !fc.tags?.includes('pair-match'));
    const relPairs = mergedFlashcards.filter(fc => fc.tags?.includes('pair-match'));

    // 3. Calculate Scores using the 25% Rule
    const scoresGaps = calculateCategoryScore(relGaps, 'GAPS');
    const scoresQuest = calculateCategoryScore(relQuestions, 'QUESTIONS');
    const scoresFlash = calculateCategoryScore(relFlash, 'FLASHCARDS');
    const scoresPairs = calculateCategoryScore(relPairs, 'PAIRS');

    const newDomain = (scoresGaps.domain + scoresQuest.domain + scoresFlash.domain + scoresPairs.domain) / 4;
    const newMastery = (scoresGaps.mastery + scoresQuest.mastery + scoresFlash.mastery + scoresPairs.mastery) / 4;

    // 4. Determine Next Review Date
    let minNextReview = new Date(8640000000000000).toISOString(); 
    const allItems = [...relQuestions, ...relFlash, ...relPairs, ...relGaps];
    
    if (allItems.length === 0) {
        minNextReview = card.nextReviewDate || new Date().toISOString();
    } else {
        allItems.forEach(i => {
            if (i.nextReviewDate < minNextReview) {
                minNextReview = i.nextReviewDate;
            }
        });
    }

    return {
        ...card,
        domainPercent: newDomain,
        masteryScore: newMastery,
        nextReviewDate: minNextReview,
        lastReviewedAt: new Date().toISOString()
    };
};
