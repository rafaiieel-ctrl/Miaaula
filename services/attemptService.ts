
import { Question } from '../types';
import * as srs from './srsService';

export interface AttemptPayload {
    question: Question;
    isCorrect: boolean;
    userAnswer: string;
    timeSec: number;
    mode: 'LIT' | 'SRS' | 'ORBITAL' | 'BATTLE' | 'GAP';
    trapCode?: string;
    // Optional overrides
    timestamp?: number;
}

class AttemptService {
    private listeners: ((payload: AttemptPayload) => void)[] = [];

    public subscribe(callback: (payload: AttemptPayload) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    public notify(payload: AttemptPayload) {
        this.listeners.forEach(cb => cb(payload));
    }

    public createAttemptEntry(payload: AttemptPayload) {
        const { question, isCorrect, userAnswer, timeSec, trapCode, timestamp } = payload;
        
        // 1. Calculate SRS Metrics (Stateless calculation)
        // We assume 2 for correct (Good) and 0 for incorrect (Again) as base baseline
        const selfEval = isCorrect ? 3 : 0; 
        
        // Note: Actual SRS calculation depends on Settings, so it's often done in the Context/Component.
        // Here we format the History Entry structure.
        
        return {
            date: new Date(timestamp || Date.now()).toISOString(),
            wasCorrect: isCorrect,
            masteryAfter: 0, // Will be filled by Context logic
            stabilityAfter: 0, // Will be filled by Context logic
            timeSec: Math.round(timeSec),
            selfEvalLevel: selfEval,
            trapCode: trapCode || (isCorrect ? 'CODE_CORRECT' : undefined),
            userAnswer: userAnswer
        };
    }
}

export const attemptService = new AttemptService();
