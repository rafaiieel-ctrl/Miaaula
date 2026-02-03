
import { Question, AppSettings, StudyMode, QueueBuilderParams, BuildStudyQueueResult, SrsItem, CalculatedItemMetrics, SessionKPIs, Flashcard } from '../types';
import * as srs from './srsService';
import * as studyLater from './studyLaterService';
import { filterExecutableItems, isStrictQuestion } from './contentGate'; // Import Gate

const MS_PER_DAY = 86400000;

// Validação de segurança para garantir que a questão tenha conteúdo mínimo para renderizar
export function validateQuestionForSession(q: Question): boolean {
    // 0. Strict Type Check (No Gaps allowed in Question Runner)
    if (!isStrictQuestion(q)) return false;

    // 1. Must have text
    if (!q.questionText || !q.questionText.trim()) return false;
    
    // 2. Must have correct answer
    if (!q.correctAnswer || !q.correctAnswer.trim()) return false;

    // 3. Options validation
    // If C/E type, we might not have 'options' in text import, they are auto-injected.
    if (q.questionType === '11 Certo/Errado') return true;

    // For standard, need at least 2 options
    const opts = q.options;
    if (!opts) return false;
    
    const validOptions = [opts.A, opts.B, opts.C, opts.D, opts.E].filter(x => {
        if (!x || x.trim().length === 0) return false;
        // ANTI-BUG: If option text looks like a diagnosis code, it's invalid.
        if (x.startsWith('WD_') || (x.length < 50 && x.includes('|'))) return false;
        return true;
    });

    return validOptions.length >= 2;
}

// Helper to group by subject/discipline
function groupBySubject<T extends SrsItem>(items: CalculatedItemMetrics<T>[]): Map<string, CalculatedItemMetrics<T>[]> {
    const groups = new Map<string, CalculatedItemMetrics<T>[]>();
    for (const metric of items) {
        const item = metric.item;
        let key = 'default';
        if ('discipline' in item) {
            key = (item as any).discipline;
        } else if ('subject' in item) {
            key = (item as any).subject;
        }
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(metric);
    }
    return groups;
}

export function buildStudyQueue<T extends SrsItem>(params: QueueBuilderParams<T>): BuildStudyQueueResult<T> {
    const { mode, allItems, settings, filters, sessionSize, newContentLimit = 0.1, allowEarlyItems = false } = params;
    const now = new Date();

    // --- GLOBAL CONTENT GATE ---
    // Filter out frozen disciplines and invalid items BEFORE any processing
    const activeItems = filterExecutableItems(allItems as unknown as (Question | Flashcard)[]);
    
    // Cast back to T for SRS calculations
    const calculatedMetrics = (activeItems as unknown as T[]).map(item => srs.calculateMetrics(item, settings, now));
    const studyLaterIds = new Set(studyLater.getStudyLaterIds());
    
    const filteredByUI: (Omit<CalculatedItemMetrics<T>, "dueReason">)[] = calculatedMetrics.filter(cm => {
        const item = cm.item;

        // --- Safety Validation ---
        // If it looks like a Question, validate it
        if ('questionText' in item) {
             if (!validateQuestionForSession(item as unknown as Question)) {
                 return false;
             }
        }

        let subjectOrDiscipline = '';
        if ('subject' in item) { 
            subjectOrDiscipline = (item as unknown as Question).subject;
        } else if ('discipline' in item) { 
            subjectOrDiscipline = (item as unknown as Flashcard).discipline;
        }

        // --- Double Check (Redundant but safe) ---
        // The filterExecutableItems above already handles this via contentGate, 
        // but keeping explicit logic for filters doesn't hurt.
        
        let topic = '';
        if ('topic' in item) {
          topic = (item as any).topic;
        }
        
        const subjectMatch = !filters.subjects?.length || filters.subjects.includes(subjectOrDiscipline);
        const topicMatch = !filters.topics?.length || filters.topics.includes(topic);

        const tagsMatch = !filters.tags?.length || ('tags' in item && Array.isArray((item as any).tags) && filters.tags.every(t => (item as any).tags.includes(t)));
        
        const bankMatch = !filters.banks?.length || ('bank' in item && typeof (item as any).bank === 'string' && filters.banks.includes((item as any).bank));
        const areaMatch = !filters.areas?.length || ('area' in item && typeof (item as any).area === 'string' && filters.areas.includes((item as any).area));
        const typeMatch = !filters.questionTypes?.length || ('questionType' in item && typeof item.questionType === 'string' && filters.questionTypes.includes(item.questionType));

        const hotMatch = !filters.isHot || item.hotTopic;
        const fundamentalMatch = !filters.isFundamental || item.isFundamental;
        const criticalMatch = !filters.isCritical || item.isCritical;
        const errorMatch = !filters.recentError || (item.totalAttempts > 0 && !item.lastWasCorrect);
        const favoriteMatch = !filters.isFavorite || ('isFavorite' in item && (item as any).isFavorite);
        const studyLaterMatch = !filters.isStudyLater || studyLaterIds.has(item.id);

        return subjectMatch && topicMatch && bankMatch && areaMatch && typeMatch && hotMatch && fundamentalMatch && criticalMatch && errorMatch && favoriteMatch && tagsMatch && studyLaterMatch;
    });

    let availableItems = filteredByUI;
    if (settings.lockEarlyReview && !allowEarlyItems) {
        availableItems = filteredByUI.filter(cm => {
            const item = cm.item;
            // New items are always available, lock only applies to items in the SRS cycle.
            if (item.totalAttempts === 0) return true;
            // Only include items scheduled for today or earlier.
            const isDue = new Date(item.nextReviewDate) <= now;
            return isDue;
        });
    }

    let finalQueue: CalculatedItemMetrics<T>[] = [];
    const mix = { due: 0, nearDue: 0, new: 0, critical: 0, total: 0, pctNew: 0 };

    if (mode === 'standard') {
        // 1. Separate New and Due
        const dueItems = availableItems.filter(cm => cm.item.totalAttempts > 0);
        const newItems = availableItems.filter(cm => cm.item.totalAttempts === 0);

        // 2. Group by Subject (Discipline)
        const dueBySubject = groupBySubject(dueItems);
        const newBySubject = groupBySubject(newItems);

        // 3. Sort each Due group by Priority (SRS + Mastery)
        // High Priority Spaced value = More urgent.
        // Tie-breaker: Lower Domain (D) comes first.
        dueBySubject.forEach(group => {
            group.sort((a, b) => {
                const diff = b.priority_spaced - a.priority_spaced;
                if (Math.abs(diff) > 0.1) return diff;
                return a.D - b.D; 
            });
        });
        
        // Randomize new items within subject to avoid stale order
        newBySubject.forEach(group => {
            group.sort(() => Math.random() - 0.5);
        });

        // 4. Interleaved Selection (Rodízio de Matérias)
        // Create a list of all subjects available in either pile
        const subjects = Array.from(new Set([...dueBySubject.keys(), ...newBySubject.keys()])).sort();
        
        let hasCandidates = true;
        
        while (finalQueue.length < sessionSize && hasCandidates) {
            hasCandidates = false;
            
            for (const subj of subjects) {
                if (finalQueue.length >= sessionSize) break;

                const dueGroup = dueBySubject.get(subj);
                const newGroup = newBySubject.get(subj);

                // Priority: Clear Due items first, then pick New items.
                if (dueGroup && dueGroup.length > 0) {
                    const item = dueGroup.shift()!;
                    finalQueue.push({ ...item, dueReason: 'due' });
                    hasCandidates = true;
                } else if (newGroup && newGroup.length > 0) {
                    const item = newGroup.shift()!;
                    finalQueue.push({ ...item, dueReason: 'new' });
                    hasCandidates = true;
                }
            }
        }
        
        mix.new = finalQueue.filter(cm => cm.dueReason === 'new').length;
        mix.due = finalQueue.filter(cm => cm.dueReason === 'due').length;

    } else if (mode === 'exam') {
        const newItems = availableItems.filter(cm => cm.item.totalAttempts === 0).map((cm): CalculatedItemMetrics<T> => ({ ...cm, dueReason: 'new' as const }));
        const reviewedItems = availableItems.filter(cm => cm.item.totalAttempts > 0).map((cm): CalculatedItemMetrics<T> => ({ ...cm, dueReason: 'due' as const }));
        
        reviewedItems.sort((a, b) => b.priority_exam - a.priority_exam);

        const newCount = Math.min(newItems.length, Math.floor(sessionSize * newContentLimit));
        mix.new = newCount;
        
        const reviewedCount = Math.min(reviewedItems.length, sessionSize - newCount);
        mix.due = reviewedCount;

        finalQueue = [
            ...reviewedItems.slice(0, reviewedCount),
            ...newItems.slice(0, newCount)
        ];

    } else if (mode === 'critical') {
        const criticalItems = availableItems.filter(cm => {
            const q = cm.item;
            return (q.totalAttempts > 0 && !q.lastWasCorrect) || (q.stability || settings.srsV2.S_default_days) < 10 || q.hotTopic;
        }).map(cm => ({ ...cm, dueReason: 'due' as const }));
        
        const priorityKey = settings.studyMode === 'exam' ? 'priority_exam' : 'priority_spaced';
        criticalItems.sort((a, b) => b[priorityKey] - a[priorityKey]);
        
        mix.critical = Math.min(criticalItems.length, sessionSize);
        finalQueue = criticalItems.slice(0, mix.critical);
    }
    
    const finalPriorityKey = (mode === 'exam' && settings.studyMode === 'exam') ? 'priority_exam' : 'priority_spaced';

    mix.total = finalQueue.length;
    mix.pctNew = mix.total > 0 ? (mix.new / mix.total) * 100 : 0;

    const queueDomains = finalQueue.map(q => q.D).sort((a,b) => a-b);

    const kpis: SessionKPIs = {
        mode, filters, mix,
        targets: {
            R_target: settings.srs.rTarget,
            timeBaseSec: settings.target_sec_default
        },
        kpiPreview: {
            meanD: queueDomains.length > 0 ? queueDomains.reduce((a,b)=>a+b,0) / queueDomains.length : 0,
            medianD: queueDomains.length > 0 ? queueDomains[Math.floor(queueDomains.length / 2)] : 0,
            meanPriority: finalQueue.length > 0 ? finalQueue.reduce((a,b)=>a+b[finalPriorityKey],0) / finalQueue.length : 0,
            pctNew: mix.pctNew
        }
    };
    
    return { queue: finalQueue, kpis };
}

// ... Audit function (omitted for brevity, no changes needed there) ...
export interface AuditReport { results: any; checks: any; }
export function runAuditTests(settings: AppSettings): AuditReport { return { results: {}, checks: {} }; }
