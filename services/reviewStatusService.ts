
import { SrsItem, AppSettings, LiteralnessCard } from '../types';
import * as srs from './srsService';

export type ReviewStatus = 'OVERDUE' | 'NOW' | 'TODAY' | 'FUTURE';
export type MasteryTier = 'GOLD' | 'SILVER' | 'BRONZE';

export interface AggregatedStats {
    status: ReviewStatus;
    tier: MasteryTier;
    priorityScore: number;
    label: string;
    breakdown: Record<ReviewStatus, number>;
    avgMastery: number;
    nextReviewAt: Date;
}

const WINDOW_HOURS = 12;
const GRACE_HOURS = 6;

export const getReviewStatus = (nextReviewDate: string): ReviewStatus => {
    const now = new Date();
    const next = new Date(nextReviewDate);
    
    // Safety check
    if (isNaN(next.getTime())) return 'OVERDUE'; 
    
    const diffHours = (next.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < -GRACE_HOURS) return 'OVERDUE';
    if (diffHours >= -GRACE_HOURS && diffHours <= WINDOW_HOURS) return 'NOW';
    
    const isSameDay = now.getDate() === next.getDate() && 
                      now.getMonth() === next.getMonth() && 
                      now.getFullYear() === next.getFullYear();
    
    if (isSameDay) return 'TODAY';
    return 'FUTURE';
};

export const getMasteryTier = (mastery: number): MasteryTier => {
    if (mastery >= 85) return 'GOLD';
    if (mastery >= 70) return 'SILVER';
    return 'BRONZE';
};

export const getPriorityScore = (status: ReviewStatus, tier: MasteryTier): number => {
    let score = 0;
    // Base Priority
    if (status === 'OVERDUE') score = 100;
    else if (status === 'NOW') score = 80;
    else if (status === 'TODAY') score = 50;
    else score = 10;

    // Tier Bonus (Lower tier = higher priority to fix)
    if (tier === 'BRONZE') score += 20;
    else if (tier === 'SILVER') score += 10;
    
    return score;
};

export const formatReviewLabel = (status: ReviewStatus, nextReviewDate: string): string => {
    if (status === 'NOW') return 'AGORA';
    
    const now = new Date();
    const next = new Date(nextReviewDate);
    
    if (isNaN(next.getTime())) return 'ERRO DATA';

    // Difference in full days
    const diffTime = next.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (status === 'OVERDUE') {
        const absDays = Math.abs(Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        return absDays > 0 ? `ATRASADO ${absDays}d` : 'ATRASADO';
    }
    
    if (status === 'TODAY') {
        return `HOJE ${next.getHours().toString().padStart(2, '0')}:${next.getMinutes().toString().padStart(2, '0')}`;
    }
    
    return `EM ${Math.max(1, diffDays)}d`;
};

export const aggregateCardStats = (items: SrsItem[], settings: AppSettings, cardContext?: LiteralnessCard): AggregatedStats => {
    if (!items || items.length === 0) {
        // Fallback if no items but card context exists
        if (cardContext) {
             const status = getReviewStatus(cardContext.nextReviewDate);
             const tier = getMasteryTier(cardContext.masteryScore);
             const priorityScore = getPriorityScore(status, tier);
             const label = formatReviewLabel(status, cardContext.nextReviewDate);
             
             let validDate = new Date(cardContext.nextReviewDate);
             if (isNaN(validDate.getTime())) validDate = new Date();

             return {
                 status, tier, priorityScore, label, 
                 breakdown: { OVERDUE: 0, NOW: 0, TODAY: 0, FUTURE: 0 },
                 avgMastery: cardContext.masteryScore,
                 nextReviewAt: validDate
             };
        }
        
        return {
            status: 'FUTURE',
            tier: 'BRONZE',
            priorityScore: 0,
            label: '—',
            breakdown: { OVERDUE: 0, NOW: 0, TODAY: 0, FUTURE: 0 },
            avgMastery: 0,
            nextReviewAt: new Date(Date.now() + 86400000 * 365) // Far future
        };
    }

    let masterySum = 0;
    let minNextReview = Infinity;
    let worstNextReviewDate = items[0].nextReviewDate;
    
    const breakdown = { OVERDUE: 0, NOW: 0, TODAY: 0, FUTURE: 0 };
    let attemptedCount = 0;

    items.forEach(item => {
        // Calculate mastery using SRS service to ensure "Current Domain" logic
        if (item.totalAttempts > 0) {
            const m = srs.calculateCurrentDomain(item, settings);
            masterySum += m;
            attemptedCount++;
        }
        
        const nextTime = new Date(item.nextReviewDate).getTime();
        // Skip invalid dates for min calc, but ensure at least one valid exists
        if (!isNaN(nextTime)) {
            if (nextTime < minNextReview) {
                minNextReview = nextTime;
                worstNextReviewDate = item.nextReviewDate;
            }
            const s = getReviewStatus(item.nextReviewDate);
            breakdown[s]++;
        } else {
             // Treat invalid as overdue to force fix
             breakdown['OVERDUE']++;
        }
    });
    
    // OVERRIDE: If the Card itself has a nextReviewDate in the FUTURE (meaning cycle just completed),
    // we use THAT date instead of the items' worst date.
    if (cardContext) {
        const cardNextTime = new Date(cardContext.nextReviewDate).getTime();
        const nowTime = Date.now();
        // Only override if card review is strictly in the future (plus a small buffer)
        // and is valid
        if (!isNaN(cardNextTime) && cardNextTime > nowTime + (1000 * 60 * 5)) { 
            worstNextReviewDate = cardContext.nextReviewDate;
        }
    }

    const avgMastery = attemptedCount > 0 ? masterySum / attemptedCount : 0;
    
    // Decay visual logic for mastery
    let finalMastery = avgMastery;
    if (cardContext) {
        const now = new Date();
        const nextDate = new Date(cardContext.nextReviewDate);
        
        if (cardContext.lastCycleCompletedAt && !isNaN(nextDate.getTime()) && nextDate > now) {
             const cycleCompletedAt = new Date(cardContext.lastCycleCompletedAt);
             if (!isNaN(cycleCompletedAt.getTime())) {
                 const totalDuration = nextDate.getTime() - cycleCompletedAt.getTime();
                 const elapsed = now.getTime() - cycleCompletedAt.getTime();
                 const progress = Math.max(0, Math.min(1, elapsed / Math.max(1, totalDuration)));
                 const floor = Math.max(40, avgMastery); 
                 finalMastery = 100 - (progress * (100 - floor));
             }
        }
    }
    
    // Ensure worstNextReviewDate is valid before passing out
    let safeWorstDate = new Date(worstNextReviewDate);
    if (isNaN(safeWorstDate.getTime())) {
        safeWorstDate = new Date(); // Fail safe to now
        worstNextReviewDate = safeWorstDate.toISOString();
    }

    const status = getReviewStatus(worstNextReviewDate);
    const tier = getMasteryTier(finalMastery);
    const priorityScore = getPriorityScore(status, tier);
    const label = formatReviewLabel(status, worstNextReviewDate);

    return {
        status,
        tier,
        priorityScore,
        label,
        breakdown,
        avgMastery: finalMastery,
        nextReviewAt: safeWorstDate
    };
};
