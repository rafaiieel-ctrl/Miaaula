

// ... existing imports ...
import { Question, Flashcard, AppSettings, SrsItem, LiteralnessCard, Attempt, Goal, CalculatedItemMetrics } from '../types';
import * as studyLater from './studyLaterService';
import { normalizeDiscipline } from './taxonomyService';
import { traceService } from './traceService'; 

// ... (Existing Constants, Date Helpers - Keep unchanged)
const DAY_MS = 86400000;
const MINUTE_MS = 60000;

export const todayISO = (): string => new Date().toISOString();
export const toISODate = (date: Date): string => {
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
};

export const addDaysToDate = (date: Date, days: number): Date => { 
    if (isNaN(date.getTime())) {
        return new Date();
    }
    if (days < 0.05) { 
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    }
    const r = new Date(date); 
    r.setDate(r.getDate() + days); 
    return r; 
};

export const addDaysISO = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString();
    
    const res = addDaysToDate(d, days);
    if (isNaN(res.getTime())) return new Date().toISOString();
    
    return res.toISOString();
};

export const formatISOToBr = (isoDate: string): string => {
    if (!isoDate) return '-';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
};

export const isReviewFuture = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d > new Date();
};

// --- NEW: GOLD WINDOW CHECKER ---
export const checkIsGoldWindow = (nextReviewDate: string): boolean => {
    if (!nextReviewDate) return false;
    const now = new Date().getTime();
    const due = new Date(nextReviewDate).getTime();
    if (isNaN(due)) return false;

    // Gold Window definition: 12 hours before to 12 hours after the due time
    const WINDOW_MS = 12 * 60 * 60 * 1000;
    const diff = now - due;

    // If within window (diff absolute value < window)
    return Math.abs(diff) <= WINDOW_MS;
};

export const formatReviewLabelLocal = (date: Date): string => {
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR');
};

// ... (Existing Helpers like normalizeTextForFingerprint, getCanonicalId, etc. - Keep unchanged) ...
export const normalizeTextForFingerprint = (text: string): string => text ? text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,;:\-_?!()\[\]{}"']/g, "").replace(/\s+/g, " ") : '';
export const normalizeTextForDedup = normalizeTextForFingerprint;
export const generateQuestionFingerprint = (q: Partial<Question>): string => `${normalizeTextForFingerprint(q.lawRef||'')}|${normalizeTextForFingerprint(q.questionText||'')}`;
export function getCanonicalId(id: string): string { if (!id) return ''; return id.trim(); }
export function canonicalizeLitRef(v?: string | null): string { if (!v) return ""; if (v.trim().toUpperCase().startsWith('TRILHA_')) { return v.trim(); } return String(v).normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase(); }
export function resolveLitRef(obj: any): string { if (!obj) return ""; if (obj.litRef && typeof obj.litRef === 'string' && obj.litRef.trim()) return canonicalizeLitRef(obj.litRef); if (obj.lawRef && typeof obj.lawRef === 'string' && obj.lawRef.trim()) return canonicalizeLitRef(obj.lawRef); if (obj.LIT_REF && typeof obj.LIT_REF === 'string') return canonicalizeLitRef(obj.LIT_REF); if (Array.isArray(obj.tags)) { const validTag = obj.tags.find((t: string) => { const u = canonicalizeLitRef(t); return u !== 'pair-match' && u !== 'literalness' && u !== 'flashcard' && t.length > 2; }); if (validTag) return canonicalizeLitRef(validTag); } if (obj.id && typeof obj.id === 'string') { if (!obj.id.startsWith('q_') && !obj.id.startsWith('fc_') && !obj.id.startsWith('temp_')) { return canonicalizeLitRef(obj.id); } } return ""; }
export function isLinked(item: any, targetIdCanonical: string): boolean { if (!targetIdCanonical) return false; const itemRef = resolveLitRef(item); if (itemRef && itemRef === targetIdCanonical) return true; if (item.tags && Array.isArray(item.tags)) { const hasTag = item.tags.some((t: string) => canonicalizeLitRef(t) === targetIdCanonical); if (hasTag) return true; } if (item.lawRef && canonicalizeLitRef(item.lawRef) === targetIdCanonical) return true; if (item.litRef && canonicalizeLitRef(item.litRef) === targetIdCanonical) return true; return false; }

// ... (Existing getLitRefProgressStats - Keep unchanged) ...
export interface LitRefProgressStats { domain: number; mastery: number; nextReviewDate: Date | null; nextReviewLabel: string; totalItems: number; reviewedItems: number; overdueItems: number; }
export interface LitRefSmartStatus extends LitRefProgressStats { counts: { total: { questions: number, gaps: number, flashcards: number, pairs: number }; pending: { questions: number, gaps: number, flashcards: number, pairs: number }; notStarted: { questions: number, gaps: number, flashcards: number, pairs: number }; }; lists: { pendingQuestions: Question[]; pendingGaps: Question[]; pendingFlashcards: Flashcard[]; pendingPairs: Flashcard[]; }; nextDueAtFuture: number | null; }
export const getLitRefProgressStats = (litRef: string, allQuestions: Question[], allFlashcards: Flashcard[], settings: AppSettings): LitRefProgressStats => { const smart = getLitRefSmartStatus(litRef, allQuestions, allFlashcards, settings); return { domain: smart.domain, mastery: smart.mastery, nextReviewDate: smart.nextReviewDate, nextReviewLabel: smart.nextReviewLabel, totalItems: smart.totalItems, reviewedItems: smart.reviewedItems, overdueItems: smart.overdueItems }; }
export const getLitRefSmartStatus = (litRef: string, allQuestions: Question[], allFlashcards: Flashcard[], settings: AppSettings): LitRefSmartStatus => { const targetCanon = canonicalizeLitRef(litRef); const now = new Date(); const nowTs = now.getTime(); const result: LitRefSmartStatus = { domain: 0, mastery: 0, nextReviewDate: null, nextReviewLabel: '—', totalItems: 0, reviewedItems: 0, overdueItems: 0, counts: { total: { questions: 0, gaps: 0, flashcards: 0, pairs: 0 }, pending: { questions: 0, gaps: 0, flashcards: 0, pairs: 0 }, notStarted: { questions: 0, gaps: 0, flashcards: 0, pairs: 0 } }, lists: { pendingQuestions: [], pendingGaps: [], pendingFlashcards: [], pendingPairs: [] }, nextDueAtFuture: null }; if (!targetCanon) return result; const items: (Question | Flashcard)[] = []; allQuestions.forEach(q => { if (canonicalizeLitRef(q.lawRef || q.litRef) === targetCanon) { items.push(q); if (q.isGapType) result.counts.total.gaps++; else result.counts.total.questions++; } }); allFlashcards.forEach(fc => { const ref = canonicalizeLitRef(fc.litRef) || (fc.tags?.find(t => canonicalizeLitRef(t) === targetCanon) ? targetCanon : ''); if (ref === targetCanon) { items.push(fc); if (fc.tags?.includes('pair-match')) result.counts.total.pairs++; else result.counts.total.flashcards++; } }); result.totalItems = items.length; if (items.length === 0) { result.nextReviewLabel = 'Novo'; return result; } let sumDomain = 0; let sumMastery = 0; let minFutureDate = Infinity; items.forEach(item => { const attempts = item.totalAttempts || 0; if (attempts > 0) { result.reviewedItems++; sumDomain += calculateCurrentDomain(item, settings); sumMastery += (item.masteryScore || 0); } let nextTime = item.nextReviewDate ? new Date(item.nextReviewDate).getTime() : NaN; if (attempts === 0) { if ('isGapType' in item && item.isGapType) result.counts.notStarted.gaps++; else if ('questionText' in item) result.counts.notStarted.questions++; else if (item.tags?.includes('pair-match')) result.counts.notStarted.pairs++; else result.counts.notStarted.flashcards++; } else if (!isNaN(nextTime)) { if (nextTime <= nowTs) { result.overdueItems++; if ('isGapType' in item && item.isGapType) { result.counts.pending.gaps++; result.lists.pendingGaps.push(item as Question); } else if ('questionText' in item) { result.counts.pending.questions++; result.lists.pendingQuestions.push(item as Question); } else if (item.tags?.includes('pair-match')) { result.counts.pending.pairs++; result.lists.pendingPairs.push(item as Flashcard); } else { result.counts.pending.flashcards++; result.lists.pendingFlashcards.push(item as Flashcard); } } else { if (nextTime < minFutureDate) minFutureDate = nextTime; } } }); result.domain = items.length > 0 ? sumDomain / items.length : 0; result.mastery = items.length > 0 ? sumMastery / items.length : 0; if (minFutureDate !== Infinity) { result.nextDueAtFuture = minFutureDate; const nextDate = new Date(minFutureDate); const dayStr = nextDate.getDate().toString().padStart(2, '0'); const monthStr = (nextDate.getMonth() + 1).toString().padStart(2, '0'); const hourStr = nextDate.getHours().toString().padStart(2, '0'); const minStr = nextDate.getMinutes().toString().padStart(2, '0'); if (minFutureDate > nowTs) { result.nextReviewDate = nextDate; if (nextDate.toDateString() === now.toDateString()) { result.nextReviewLabel = `Hoje às ${hourStr}:${minStr}`; } else { result.nextReviewLabel = `${dayStr}/${monthStr} às ${hourStr}:${minStr}`; } } } else { result.nextReviewLabel = result.overdueItems > 0 ? 'AGORA' : (result.reviewedItems > 0 ? 'Concluído' : 'Iniciar'); } if (result.overdueItems > 0) { let oldest = Infinity; items.forEach(i => { const t = new Date(i.nextReviewDate).getTime(); if (t <= nowTs && t < oldest) oldest = t; }); if (oldest !== Infinity) { const d = new Date(oldest); result.nextReviewDate = d; const dayStr = d.getDate().toString().padStart(2, '0'); const monthStr = (d.getMonth() + 1).toString().padStart(2, '0'); const hourStr = d.getHours().toString().padStart(2, '0'); const minStr = d.getMinutes().toString().padStart(2, '0'); result.nextReviewLabel = `ATRASADA (${dayStr}/${monthStr} ${hourStr}:${minStr})`; } } const sortByDate = (a: any, b: any) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime(); result.lists.pendingQuestions.sort(sortByDate); result.lists.pendingGaps.sort(sortByDate); result.lists.pendingFlashcards.sort(sortByDate); result.lists.pendingPairs.sort(sortByDate); return result; };

export const traceLinkDebug = (cardId: string, allCards: LiteralnessCard[], allQuestions: Question[], allFlashcards: Flashcard[]) => {};
export const auditImportLinks = (batchId: string, cards: LiteralnessCard[], questions: Question[], flashcards: Flashcard[], preImportSnapshot?: Map<string, any>) => [];
export const getQuestionsForCard = (card: LiteralnessCard, allQuestions: Question[]): Question[] => { const targetId = resolveLitRef(card); if (!targetId) return []; return allQuestions.filter(q => { if (q.isGapType) return false; return isLinked(q, targetId); }); };
export const getFlashcardsForCard = (card: LiteralnessCard, allFlashcards: Flashcard[]): Flashcard[] => { const targetId = resolveLitRef(card); if (!targetId) return []; return allFlashcards.filter(fc => { if (fc.tags?.includes('pair-match')) return false; return isLinked(fc, targetId); }); };
export const getPairsForCard = (card: LiteralnessCard, allFlashcards: Flashcard[]): Flashcard[] => { const targetId = resolveLitRef(card); if (!targetId) return []; return allFlashcards.filter(fc => { return fc.tags?.includes('pair-match') && isLinked(fc, targetId); }); };
export const getGapsForCard = (card: LiteralnessCard, allQuestions: Question[]): any[] => { const targetId = resolveLitRef(card); if (!targetId) return []; const gaps: any[] = []; let hasLegacyMain = false; if (card.phase2Lacuna && card.phase2Lacuna.trim()) { hasLegacyMain = true; gaps.push({ id: `gap_${targetId}_01`, questionText: card.phase2Lacuna, options: card.phase2Options || { A: "Erro", B: "Erro" }, correctAnswer: card.phase2Correct || 'A', isGapType: true, questionRef: 'GAP-01', totalAttempts: card.cycleProgress?.gapsDone ? 1 : 0, lastWasCorrect: !!card.cycleProgress?.gapsDone, litRef: targetId, parentCard: card, nextReviewDate: card.nextReviewDate, stability: card.stability, masteryScore: card.masteryScore, index: 1 }); } if (card.extraGaps && Array.isArray(card.extraGaps)) { card.extraGaps.forEach((g, i) => { const baseIndex = hasLegacyMain ? 2 : 1; const displayIndex = i + baseIndex; const suffix = String(displayIndex).padStart(2, '0'); const qText = g.text || "Conteúdo não carregado"; const correct = g.correct || "A"; const finalId = g.id || `gap_${targetId}_${suffix}`; gaps.push({ id: finalId, questionText: qText, options: g.options, correctAnswer: correct, isGapType: true, questionRef: `GAP-${suffix}`, totalAttempts: card.cycleProgress?.gapsDone ? 1 : 0, lastWasCorrect: !!card.cycleProgress?.gapsDone, litRef: targetId, parentCard: card, index: displayIndex }); }); } const externalGaps = allQuestions.filter(q => q.isGapType && isLinked(q, targetId)).map((q, i) => ({ ...q, parentCard: card, index: gaps.length + i + 1, id: q.id })); return [...gaps, ...externalGaps]; };

// --- CORE LOGIC: SRS UPDATE ---
export const calculateNewSrsState = (
    item: SrsItem, 
    wasCorrect: boolean, 
    rating: number, // 0-3
    timeTaken: number, 
    settings: AppSettings
): any => {
    const { srsV2 } = settings;
    const now = new Date();
    
    // Fallbacks
    let currentS = item.stability || srsV2.S_default_days;
    let currentD = item.difficulty || 0.5;
    const currentR = calculateRetrievability(item);

    let newS = currentS;
    let newD = currentD;
    
    if (!wasCorrect) {
        newD = Math.min(1.0, currentD + 0.2); // Harder
        newS = Math.max(0.5, currentS * srsV2.gamma_fail); // Cut stability
    } else {
        // Difficulty drift
        if (rating === 3) newD = Math.max(0.1, currentD - 0.15); // Easier
        else if (rating === 1) newD = Math.min(1.0, currentD + 0.1); // Harder
        
        let alpha = srsV2.alpha_good;
        if (rating === 3) alpha = srsV2.alpha_easy;
        if (rating === 1) alpha = srsV2.alpha_hard;
        
        let gain = alpha * (1 + (1 - currentR) * 2) * (1 + (1 - currentD));
        
        let timeBonus = 1.0;
        const expectedTime = 20; 
        if (timeTaken < expectedTime * 0.5) timeBonus = 1.0 + srsV2.k_rt_bonus;
        
        newS = currentS * (1 + gain * timeBonus);
    }
    
    // Cap S
    newS = Math.min(newS, settings.learning.srs.stabilityCapDays || 365);
    
    // --- MASTERY CALCULATION FIX ---
    let masteryScore = 0;
    if (newS <= 1) {
        if (wasCorrect) masteryScore = 15;
        else masteryScore = 0;
    } else {
        masteryScore = Math.min(100, (Math.log(newS) / Math.log(365)) * 100);
        if (masteryScore < 20 && wasCorrect) masteryScore = 20;
    }
    
    masteryScore = masteryScore * (1 - (newD * 0.2)); 
    masteryScore = Math.max(0, Math.min(100, masteryScore));

    const nextDate = addDaysToDate(now, newS);

    let timingClass = 'OK';
    if (timeTaken < 5) timingClass = 'RUSH';
    else if (timeTaken > 60) timingClass = 'SLOW';

    return {
        stability: newS,
        difficulty: newD,
        masteryScore: masteryScore,
        nextReviewDate: nextDate.toISOString(),
        lastReviewedAt: now.toISOString(),
        timingClass,
        targetSec: 30,
        grade: ['again', 'hard', 'good', 'easy'][rating],
        lastWasCorrect: wasCorrect
    };
};

export const calculateRetrievability = (item: SrsItem) => {
    if (!item.lastReviewedAt) return 0;
    const now = new Date().getTime();
    const last = new Date(item.lastReviewedAt).getTime();
    const daysElapsed = (now - last) / DAY_MS;
    const S = item.stability || 1;
    return Math.exp(-daysElapsed / S);
}; 

export const calculateCurrentDomain = (item: SrsItem, settings: AppSettings) => {
    if (!item.totalAttempts || item.totalAttempts === 0) return 0;
    const R = calculateRetrievability(item);
    const baseMastery = item.masteryScore || 0;
    return baseMastery * R; 
};

export const computeAggregatedStats = (items: SrsItem[], settings: AppSettings) => {
    let total = 0;
    let attempted = 0;
    let masterySum = 0;
    let domainSum = 0;
    let errorCount = 0;
    let criticalCount = 0;
    
    const now = new Date();
    
    items.forEach(item => {
        total++;
        if (item.totalAttempts > 0) {
            attempted++;
            masterySum += item.masteryScore || 0;
            domainSum += calculateCurrentDomain(item, settings);
            if (!item.lastWasCorrect) errorCount++;
        }
        
        if (item.isCritical) criticalCount++;
    });
    
    return {
        total,
        attempted,
        avgMastery: attempted > 0 ? masterySum / attempted : 0,
        avgDomain: attempted > 0 ? domainSum / attempted : 0, 
        errorCount,
        criticalCount
    };
};

export const calculateAggregateMastery = (items: SrsItem[], settings: AppSettings) => {
    if (items.length === 0) return 0;
    const stats = computeAggregatedStats(items, settings);
    return Math.round(stats.avgDomain); 
};
export const calculateAggregateDomain = calculateAggregateMastery; 

// --- NEW: REINFORCEMENT PRIORITY CALCULATION ---
/**
 * Calculates a sorting score for reinforcement phase.
 * Higher score = higher priority to show again.
 * Formula: Overdue (huge weight) + Low Domain + Low Mastery + High Error Rate
 */
export const calculateReinforcementPriority = (item: SrsItem, settings: AppSettings): number => {
    const now = new Date();
    const nextReview = new Date(item.nextReviewDate);
    
    let score = 0;

    // 1. Overdue / Due Status (Primary Factor)
    // If due now or in past, massive priority boost
    if (nextReview <= now) {
        score += 1000;
        // Add days overdue as extra urgency
        const daysOverdue = (now.getTime() - nextReview.getTime()) / DAY_MS;
        score += Math.min(100, daysOverdue); // Cap at 100 points for lateness
    }

    // 2. Domain (Retention) - Lower is better for review
    // Range 0-100. We want low domain to have high score.
    const domain = calculateCurrentDomain(item, settings);
    score += (100 - domain) * 2; // Weight 2x

    // 3. Mastery (Stability) - Lower is better
    // Range 0-100.
    const mastery = item.masteryScore || 0;
    score += (100 - mastery);

    // 4. Error Rate / History
    // Recent error flag is huge
    if (item.totalAttempts > 0 && !item.lastWasCorrect) {
        score += 500;
    }
    
    // Total error rate (if many attempts, high error rate pushes up)
    if (item.totalAttempts > 5) {
        // Calculate approximate error count from history if available or deduce
        // Assuming we store errorCount or derive it
        // Use lastWasCorrect as proxy for now if deep stats unavailable in SrsItem base interface
        // But SrsItem usually has recentError
        if (item.recentError) score += 50; 
    }

    return score;
};

// ... (Rest of Stubs) ...
export const getQuestionsForPractice = (params: any) => []; 
export const calcUrgency = (item: SrsItem, settings: AppSettings) => { const R = calculateRetrievability(item); if (R < 0.7) return 'CRITICO'; if (R < 0.85) return 'ALERTA'; return 'ESTAVEL'; }; 
export const getGoalDescription = (goal: any) => ''; 
export const calculateMetrics = (item: any, settings: any, now: any) => { const R = calculateRetrievability(item); const D = calculateCurrentDomain(item, settings); return { item, dt: 0, R_now: R, D: D, priority_spaced: 1 - R, priority_exam: (1 - R) * (item.hotTopic ? 1.5 : 1), R_proj: R }; }; 
export const classifyTiming = (time: number, item: any, settings: any) => ({ timingClass: 'OK', targetSec: 30 }); 
export const setNavigationGuard = (guard: any) => {}; 
export const registerDryError = (cardId: string, activity: string, itemId: string, resolved: boolean, text?: string, type?: string) => {}; 
export const resolveAllArticleErrors = (cardId: string) => {}; 
export const getArticleOpenErrors = (cardId: string) => ({ questions: [], flashcards: [], gaps: [] }); 
export const recomputeArticleCardStatus = (card: any, allQuestions: any, allFlashcards: any, settings: any) => ({ updatedCard: card }); 
export const getLevelInfo = (xp: number) => { const level = Math.floor(Math.sqrt(xp / 100)) + 1; const nextLevelXp = Math.pow(level, 2) * 100; const prevLevelXp = Math.pow(level - 1, 2) * 100; const progress = ((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100; return { level, progressPercent: progress }; };
export const playCorrectSound = () => {}; 
export const playIncorrectSound = () => {}; 
export const playAchievementSound = () => {}; 
export const selectQuestionsByLitRef = (allQuestions: any, litRef: string) => []; 
export const deriveLitRef = (q: any) => "";
