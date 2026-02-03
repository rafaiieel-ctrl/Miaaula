
import { Question, LiteralnessCard, Flashcard, AppSettings } from '../types';
import { traceService } from './traceService';
import * as srs from './srsService';

// Interfaces for Audit Reports
export interface AuditReport {
    timestamp: string;
    sessionId: string;
    integrity: {
        totalCards: number;
        totalQuestions: number;
        totalFlashcards: number;
        uniqueQuestionIds: number;
        duplicateQuestionIds: string[];
        tempIdsFound: string[];
        orphanedQuestions: number; // Questions pointing to non-existent cards
        cardsWithBrokenCache: number; // Cards where questionIds.length != actual linked count
    };
    drift: {
        schemaVersionMismatch: number;
        invalidLawRefs: string[];
        suspiciousNextReviewDates: string[]; // Past dates that should have been updated
    };
    conclusions: {
        status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
        issues: string[];
    };
}

const GOLDEN_BASELINE = {
    bannedPrefixes: ['temp_', 'new_', 'undefined', 'null'],
    dateRegex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
};

class AuditService {
    
    public runAudit(
        cards: LiteralnessCard[],
        questions: Question[],
        flashcards: Flashcard[],
        settings: AppSettings
    ): AuditReport {
        const report: AuditReport = {
            timestamp: new Date().toISOString(),
            sessionId: (window as any).__MIAAULA_SESSION_ID__ || 'unknown',
            integrity: {
                totalCards: cards.length,
                totalQuestions: questions.length,
                totalFlashcards: flashcards.length,
                uniqueQuestionIds: 0,
                duplicateQuestionIds: [],
                tempIdsFound: [],
                orphanedQuestions: 0,
                cardsWithBrokenCache: 0
            },
            drift: {
                schemaVersionMismatch: 0,
                invalidLawRefs: [],
                suspiciousNextReviewDates: []
            },
            conclusions: { status: 'HEALTHY', issues: [] }
        };

        // 1. ID Integrity Check
        const qIdMap = new Map<string, number>();
        questions.forEach(q => {
            qIdMap.set(q.id, (qIdMap.get(q.id) || 0) + 1);
            
            // Check Banned Prefixes (Temp IDs persistence check)
            if (GOLDEN_BASELINE.bannedPrefixes.some(p => q.id.startsWith(p))) {
                report.integrity.tempIdsFound.push(q.id);
            }

            // Check Drift: LawRef Format
            if (q.lawRef && q.lawRef !== srs.canonicalizeLitRef(q.lawRef)) {
                report.drift.invalidLawRefs.push(q.id);
            }
        });

        report.integrity.uniqueQuestionIds = qIdMap.size;
        qIdMap.forEach((count, id) => {
            if (count > 1) report.integrity.duplicateQuestionIds.push(id);
        });

        // 2. Linkage Check (The "Disappearing Questions" Bug Detector)
        const cardMap = new Set(cards.map(c => c.id));
        const questionsByLawRef = new Map<string, number>();

        questions.forEach(q => {
            if (q.lawRef) {
                const canonicalRef = srs.canonicalizeLitRef(q.lawRef);
                
                // Check Orphan
                if (!cardMap.has(canonicalRef)) {
                    report.integrity.orphanedQuestions++;
                }

                questionsByLawRef.set(canonicalRef, (questionsByLawRef.get(canonicalRef) || 0) + 1);
            }
        });

        // Check Cache Consistency (Card.questionIds vs Actual)
        cards.forEach(c => {
            const actualCount = questionsByLawRef.get(c.id) || 0;
            const cachedCount = c.questionIds?.length || 0;
            
            if (actualCount > 0 && cachedCount === 0) {
                report.integrity.cardsWithBrokenCache++;
            }
        });

        // 3. Logic/State Drift
        const now = new Date();
        questions.forEach(q => {
            // Logic Drift: Items marked as "done" but due in the past
            if (q.totalAttempts > 0 && new Date(q.nextReviewDate).getTime() < now.getTime() - (86400000 * 365)) {
                 report.drift.suspiciousNextReviewDates.push(q.id);
            }
        });

        // 4. Conclusions
        if (report.integrity.duplicateQuestionIds.length > 0) {
            report.conclusions.status = 'CRITICAL';
            report.conclusions.issues.push('DUPLICATE_IDS_DETECTED');
        }
        if (report.integrity.tempIdsFound.length > 0) {
            report.conclusions.status = 'CRITICAL';
            report.conclusions.issues.push('TEMP_IDS_PERSISTED');
        }
        if (report.integrity.cardsWithBrokenCache > 0) {
            report.conclusions.status = 'WARNING';
            report.conclusions.issues.push('CACHE_DESYNC_DETECTED');
        }
        if (report.drift.invalidLawRefs.length > 10) {
             report.conclusions.status = 'WARNING';
             report.conclusions.issues.push('HIGH_DRIFT_LAW_REFS');
        }

        // Trace the Audit Result
        traceService.trace('AUDIT_RUN', 'SRS', report.conclusions.status, { issues: report.conclusions.issues });

        return report;
    }

    public async generateAuditPackage(
        cards: LiteralnessCard[],
        questions: Question[],
        flashcards: Flashcard[],
        settings: AppSettings
    ) {
        const report = this.runAudit(cards, questions, flashcards, settings);
        const logs = await traceService.exportLogs();
        
        const pkg = {
            meta: {
                generatedAt: new Date().toISOString(),
                appVersion: '17.0b',
                userAgent: navigator.userAgent
            },
            report,
            logs: logs.slice(0, 500), // Limit for file size
            snapshot: {
                sampleCards: cards.slice(0, 5),
                sampleQuestions: questions.slice(0, 10),
                settingsConfig: { 
                    srs: settings.srs, 
                    srsV2: settings.srsV2 
                }
            }
        };

        const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `miaaula_audit_pkg_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

export const auditService = new AuditService();
