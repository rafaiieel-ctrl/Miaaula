
import { Question, SessionPhase, NextQuestionStatus, AppSettings } from '../types';
import * as srs from './srsService';

/**
 * SESSION ENGINE
 * Manages the intelligent queueing of questions during a practice session.
 * Features:
 * - New vs Reinforce Split
 * - 10-Minute Penalty Box for errors
 * - SRS Priority sorting
 */

export class SessionEngine {
    private phase: SessionPhase = 'NEW';
    private newQueue: string[] = []; // IDs of unseen questions
    private reinforcePool: Question[] = []; // All seen questions available for reinforcement
    
    // 10-minute penalty box: Map<ID, unlockTimeTimestamp>
    private penaltyBox = new Map<string, number>();
    
    // Track what was answered IN THIS SESSION to avoid immediate repetition in Reinforce mode
    // (unless it's a penalty redo)
    private answeredInSession = new Set<string>();

    // Initial items map for quick lookup
    private itemsMap = new Map<string, Question>();
    private settings: AppSettings;

    constructor(initialQuestions: Question[], settings: AppSettings) {
        this.settings = settings;
        this.initialize(initialQuestions);
    }

    private initialize(questions: Question[]) {
        this.itemsMap.clear();
        this.newQueue = [];
        this.reinforcePool = [];
        this.penaltyBox.clear();
        this.answeredInSession.clear();

        questions.forEach(q => {
            this.itemsMap.set(q.id, q);
            if (q.totalAttempts === 0) {
                this.newQueue.push(q.id);
            } else {
                this.reinforcePool.push(q);
            }
        });

        // If no new items, start in reinforce
        if (this.newQueue.length === 0) {
            this.phase = 'REINFORCE';
        } else {
            this.phase = 'NEW';
        }
    }

    /**
     * Updates the internal model of a question after an answer.
     * Should be called when the user answers a question.
     */
    public submitResult(questionId: string, isCorrect: boolean) {
        this.answeredInSession.add(questionId);
        
        // Remove from New Queue if it was there
        const newIdx = this.newQueue.indexOf(questionId);
        if (newIdx > -1) {
            this.newQueue.splice(newIdx, 1);
            // Move to reinforce pool for potential future review in this session
            const q = this.itemsMap.get(questionId);
            if (q) this.reinforcePool.push(q);
        }

        if (!isCorrect) {
            // INCORRECT: Schedule for 10 minutes later
            const unlockTime = Date.now() + (10 * 60 * 1000); // 10 mins
            this.penaltyBox.set(questionId, unlockTime);
        } else {
            // CORRECT: Remove from penalty box if it was there
            if (this.penaltyBox.has(questionId)) {
                this.penaltyBox.delete(questionId);
            }
        }

        // Check phase transition
        if (this.phase === 'NEW' && this.newQueue.length === 0) {
            this.phase = 'REINFORCE';
        }
    }

    /**
     * Retrieves the next question to show.
     */
    public getNextQuestion(): { status: NextQuestionStatus; question?: Question; nextUnlockInMs?: number } {
        const now = Date.now();

        // 1. CHECK PENALTY BOX (Priority #1 if time is up)
        // Find any item in penalty box that is ready (< now)
        for (const [id, unlockTime] of this.penaltyBox.entries()) {
            if (unlockTime <= now) {
                // Ready to retry!
                const q = this.itemsMap.get(id);
                if (q) return { status: 'READY', question: q };
            }
        }

        // 2. CHECK PHASE: NEW
        if (this.phase === 'NEW') {
            if (this.newQueue.length > 0) {
                // Return next new item
                const id = this.newQueue[0];
                const q = this.itemsMap.get(id);
                if (q) return { status: 'READY', question: q };
            } else {
                // Should have switched phase, but just in case
                this.phase = 'REINFORCE';
            }
        }

        // 3. CHECK PHASE: REINFORCE
        if (this.phase === 'REINFORCE') {
            // Filter pool:
            // - Exclude items currently in penalty box (waiting)
            // - Exclude items already answered in this session (unless they are the only ones left and we want infinite mode)
            // For "Standard Practice", we usually stop after clearing New + doing required reviews.
            // But if we want "Infinite Reinforce", we can relax the "answeredInSession" check.
            
            // Current Logic: 
            // - Candidates are items in reinforcePool that are NOT in penaltyBox.
            // - Sort by Priority.
            // - If the user has just answered it (in this session), try to avoid it for spacing, unless it's high priority.
            
            let candidates = this.reinforcePool.filter(q => !this.penaltyBox.has(q.id));
            
            // Calculate Priority for all
            const scoredCandidates = candidates.map(q => ({
                q,
                score: srs.calculateReinforcementPriority(q, this.settings)
            }));

            // Sort Descending
            scoredCandidates.sort((a, b) => b.score - a.score);

            // Try to find one not answered recently if possible
            const unAnsweredInSession = scoredCandidates.filter(c => !this.answeredInSession.has(c.q.id));
            
            if (unAnsweredInSession.length > 0) {
                return { status: 'READY', question: unAnsweredInSession[0].q };
            }
            
            // If all answered, but we have high priority items (e.g. overdue), show them again?
            // Usually we stop here if "New" phase is done and we covered the "Reinforce" candidates once.
            // But the prompt implies a continuous loop if "Reinforce" mode is active.
            
            // Let's check if we have pending items in Penalty Box
            if (this.penaltyBox.size > 0) {
                 // Find the soonest unlock time
                 let minUnlock = Infinity;
                 for (const t of this.penaltyBox.values()) {
                     if (t < minUnlock) minUnlock = t;
                 }
                 const wait = Math.max(0, minUnlock - now);
                 return { status: 'WAITING', nextUnlockInMs: wait };
            }
            
            // If truly nothing left (no penalty, all answered), session is effectively done
            // UNLESS user explicitly asked for infinite drill. Assuming standard completion flow for now.
            return { status: 'EMPTY' };
        }

        // Fallback for empty states
        if (this.penaltyBox.size > 0) {
             let minUnlock = Infinity;
             for (const t of this.penaltyBox.values()) {
                 if (t < minUnlock) minUnlock = t;
             }
             return { status: 'WAITING', nextUnlockInMs: Math.max(0, minUnlock - now) };
        }

        return { status: 'EMPTY' };
    }

    public getPhase(): SessionPhase {
        return this.phase;
    }
    
    public getPendingRetryCount(): number {
        return this.penaltyBox.size;
    }
}
