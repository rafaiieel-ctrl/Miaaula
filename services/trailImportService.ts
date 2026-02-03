
import { Question, Flashcard, LiteralnessCard, AppSettings, ImportReport, ImportDetail, ImportStagingData, ImportEntityType, ImportCountDetail, LessonNode, Gap, StudyStep, LessonStatus } from '../types';
import * as srs from './srsService';
import * as idGen from './idGenerator';
import { buildReadingSteps } from './readingParser';
import { normalizeDiscipline } from './taxonomyService';
import { parseLitRefText } from './import/litRefParser';

// --- HELPERS ---

const createEmptyCount = (): ImportCountDetail => ({ received: 0, imported: 0, skipped: 0, normalized: 0 });

const normalizeOptions = (opts: any): { A: string, B: string, C: string, D: string, E: string } => {
    if (!opts) return { A: '', B: '', C: '', D: '', E: '' };
    return {
        A: opts.A || opts.a || opts.OPT_A || '',
        B: opts.B || opts.b || opts.OPT_B || '',
        C: opts.C || opts.c || opts.OPT_C || '',
        D: opts.D || opts.d || opts.OPT_D || '',
        E: opts.E || opts.e || opts.OPT_E || ''
    };
};

function asStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.filter(x => typeof x === "string") as string[];
}

/**
 * Sanitiza o objeto de importação para garantir que ele esteja em conformidade com a interface LessonNode.
 * Remove arrays pesados (questions, lawCards) e garante defaults para campos obrigatórios.
 */
export function sanitizeLessonNode(imported: any, refsOverride?: { 
    questions?: string[], 
    flashcards?: string[] 
}): LessonNode {
    // 1. Identificadores
    const id = String(imported?.id || imported?.uid || `L_${Date.now()}_${Math.random().toString(36).substr(2,5)}`).trim();
    const uid = String(imported?.uid || id).trim();
    const title = String(imported?.title || "Nova Aula").trim();
    const code = String(imported?.code || "NO_CODE").trim();
    const subjectId = String(imported?.subjectId || "GERAL").trim();
  
    // 2. Metadados Leves
    const order = Number.isFinite(imported?.order) ? Number(imported.order) : 1;
    const themeTag = imported?.themeTag ? String(imported.themeTag) : undefined;
  
    // 3. Referências (Source of Truth)
    // Usa overrides (calculados no staging) ou tenta extrair apenas IDs do payload
    const questionRefs = refsOverride?.questions || 
      asStringArray(imported?.refs?.questions) ||
      (Array.isArray(imported?.questions) ? imported.questions.map((x: any) => String(x?.id || x?.Q_REF || "")).filter(Boolean) : []);
  
    const flashcardRefs = refsOverride?.flashcards ||
      asStringArray(imported?.refs?.flashcards) ||
      (Array.isArray(imported?.flashcards) ? imported.flashcards.map((x: any) => String(x?.id || x?.FC_REF || "")).filter(Boolean) : []);

    // 4. Conteúdo Textual (Arrays de Strings apenas)
    const keyPoints = asStringArray(imported?.keyPoints);
    
    // Summary normalizado
    let summary: string[] = [];
    if (typeof imported?.summary === 'string') summary = [imported.summary];
    else if (Array.isArray(imported?.summary)) summary = asStringArray(imported.summary);
    
    // Explanations normalizado (remove objetos complexos se houver)
    let explanations: string[] = [];
    if (Array.isArray(imported?.explanations)) {
        explanations = imported.explanations.map((e: any) => {
            if (typeof e === 'string') return e;
            if (e?.text) return e.text;
            return '';
        }).filter(Boolean);
    }

    // 5. Status & Progresso (Defaults Obrigatórios)
    const validStatuses: LessonStatus[] = ['locked', 'not_started', 'in_progress', 'review', 'mastered'];
    const status: LessonStatus = validStatuses.includes(imported?.status) ? imported.status : 'not_started';
    const domainLevel = Number.isFinite(imported?.domainLevel) ? Number(imported.domainLevel) : 0;

    // CONTRATO FINAL
    return {
        id,
        uid,
        subjectId: normalizeDiscipline(subjectId),
        title,
        code,
        order,
        status,
        domainLevel,
        keyPoints,
        summary,
        explanations,
        questionRefs,
        flashcardRefs,
        themeTag,
        successRate: typeof imported?.successRate === 'number' ? imported.successRate : undefined,
        lastSessionAt: imported?.lastSessionAt,
        nextReviewAt: imported?.nextReviewAt
    };
}

// --- PARSER LEI SECA ADAPTER ---
// Converte o resultado do parseLitRefText em LessonNode e StagingData

const processLeiSecaImport = (
    text: string, 
    settings: AppSettings,
    baseOrder: number = 1
): { report: ImportReport, staging: ImportStagingData, lessons: LessonNode[] } => {
    
    const batchId = `IMP_LS_${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // 1. Parse usando o serviço robusto existente
    const parsed = parseLitRefText(text, settings, batchId);
    
    const details: ImportDetail[] = [];
    const staging: ImportStagingData = {
        cards: parsed.cards,
        questions: parsed.questions,
        flashcards: parsed.flashcards, // Inclui pairs pois a lógica interna já separa por tag
        gaps: parsed.gaps
    };

    const lessons: LessonNode[] = [];
    let errorCount = 0;
    
    // 2. Validação Estrita & Mapping para Lessons
    // Cada CARD (Núcleo) vira uma Lesson
    parsed.cards.forEach((card, idx) => {
        const litRef = card.id;
        
        // Filter content related to this card
        const lessonQuestions = parsed.questions.filter(q => srs.canonicalizeLitRef(q.lawRef) === srs.canonicalizeLitRef(litRef));
        // Pairs and Flashcards are in the same array in parseLitRefText output, distinguished by tags
        const lessonFlashcards = parsed.flashcards.filter(f => srs.isLinked(f, litRef) && !f.tags?.includes('pair-match'));
        const lessonPairs = parsed.flashcards.filter(f => srs.isLinked(f, litRef) && f.tags?.includes('pair-match'));
        const lessonGaps = parsed.gaps.filter(g => srs.canonicalizeLitRef(g.litRef) === srs.canonicalizeLitRef(litRef));

        // STRICT VALIDATION RULES
        // A5) Lacunas >= 6
        if (lessonGaps.length < 6) {
            details.push({ entityType: 'gap', ref: litRef, action: 'ERROR', reasonCode: 'MIN_COUNT_FAIL', message: `Mínimo 6 lacunas exigido. Encontrado: ${lessonGaps.length}.` });
            errorCount++;
        }

        // A6) Questões == 20
        if (lessonQuestions.length !== 20) {
            details.push({ entityType: 'question', ref: litRef, action: 'ERROR', reasonCode: 'STRICT_COUNT_FAIL', message: `Exatamente 20 questões exigidas. Encontrado: ${lessonQuestions.length}.` });
            errorCount++;
        }

        // A7) Flashcards >= 6
        if (lessonFlashcards.length < 6) {
            details.push({ entityType: 'flashcard', ref: litRef, action: 'ERROR', reasonCode: 'MIN_COUNT_FAIL', message: `Mínimo 6 flashcards exigido. Encontrado: ${lessonFlashcards.length}.` });
            errorCount++;
        }

        // A8) Pares >= 6
        if (lessonPairs.length < 6) {
            details.push({ entityType: 'pair', ref: litRef, action: 'ERROR', reasonCode: 'MIN_COUNT_FAIL', message: `Mínimo 6 pares exigido. Encontrado: ${lessonPairs.length}.` });
            errorCount++;
        }

        // Mapping to LessonNode
        // Title = Tópico ou Artigo
        const title = card.topic !== 'Geral' ? `${card.article} - ${card.topic}` : card.article;
        
        // Explanation / Summary derived from Card fields
        const summary = [card.partsSummary || 'Resumo não disponível.'];
        const explanations = [
            `Conceito: ${card.phase1Full}`,
            card.storytelling ? `Storytelling: ${card.storytelling}` : '',
            card.feynmanExplanation ? `Feynman: ${card.feynmanExplanation}` : '',
            card.riscoFcc ? `Risco: ${card.riscoFcc}` : ''
        ].filter(Boolean);

        // Collect ALL IDs for refs
        const questionIds = lessonQuestions.map(q => q.id);
        const flashcardIds = [...lessonFlashcards, ...lessonPairs].map(f => f.id);

        const lesson: LessonNode = {
            id: litRef, // Use LitRef as ID for stable mapping
            uid: litRef,
            subjectId: normalizeDiscipline(card.lawId),
            title: title,
            code: litRef,
            order: baseOrder + idx,
            status: 'not_started',
            domainLevel: 0,
            keyPoints: card.keywordsProva ? card.keywordsProva.split(';').map(s=>s.trim()) : [],
            summary: summary,
            explanations: explanations,
            questionRefs: questionIds,
            flashcardRefs: flashcardIds, // Includes Pairs!
            themeTag: 'LEI SECA'
        };

        lessons.push(lesson);
    });

    const counts = {
        lawCards: { received: parsed.stats.cards, imported: parsed.stats.cards, skipped: 0, normalized: 0 },
        questions: { received: parsed.stats.questions, imported: parsed.stats.questions, skipped: 0, normalized: 0 },
        flashcards: { received: parsed.stats.flashcards, imported: parsed.stats.flashcards, skipped: 0, normalized: 0 },
        pairs: { received: parsed.stats.pairs, imported: parsed.stats.pairs, skipped: 0, normalized: 0 },
        gaps: { received: parsed.stats.gaps, imported: parsed.stats.gaps, skipped: 0, normalized: 0 }
    };

    const status = errorCount > 0 ? 'FAILED' : 'SUCCESS';
    const report: ImportReport = {
        importId: batchId,
        timestamp,
        summary: {
            status,
            totalEntities: counts.lawCards.received + counts.questions.received + counts.flashcards.received + counts.pairs.received + counts.gaps.received,
            importedEntities: errorCount === 0 ? counts.lawCards.imported + counts.questions.imported + counts.flashcards.imported + counts.pairs.imported + counts.gaps.imported : 0,
            skippedEntities: 0,
            normalizedEntities: 0,
            errorsCount: errorCount,
            warningsCount: parsed.errors.length
        },
        counts,
        details: [...details, ...parsed.errors.map(e => ({ entityType: 'meta' as ImportEntityType, ref: 'PARSER', action: 'NORMALIZED' as any, reasonCode: 'WARNING', message: e }))]
    };

    // Atomic Fail Safety: If failed, return empty staging
    return {
        report,
        staging: status === 'FAILED' ? { cards: [], questions: [], flashcards: [], gaps: [] } : staging,
        lessons: status === 'FAILED' ? [] : lessons
    };
};

// --- CORE GENERATOR ---

export const generateImportReport = (
    rawInput: string,
    existingQuestions: Question[],
    existingCards: LiteralnessCard[],
    existingFlashcards: Flashcard[],
    settings: AppSettings,
    context?: { subjectId: string, title: string, uid?: string } // Fallback context if not provided in JSON
): { report: ImportReport, staging: ImportStagingData | null, lessons?: LessonNode[] } => {
    
    const trimmed = rawInput.trim();
    const isJson = trimmed.startsWith('[') || trimmed.startsWith('{');

    // ROUTE 1: LEI SECA FORMAT (TEXT)
    if (!isJson && trimmed.includes('LIT_REF:')) {
        // Assume basic order starts at 1, or try to detect max order from existing trails if needed (omitted for simplicity)
        return processLeiSecaImport(rawInput, settings, 1);
    }

    // ROUTE 2: JSON LEGACY FORMAT
    const importId = `IMP_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const details: ImportDetail[] = [];
    
    const counts = {
        lawCards: createEmptyCount(),
        gaps: createEmptyCount(),
        questions: createEmptyCount(),
        flashcards: createEmptyCount(),
        pairs: createEmptyCount(),
    };

    const staging: ImportStagingData = { cards: [], questions: [], flashcards: [], gaps: [] };

    // --- PARSE JSON ---
    let modules: any[] = [];
    try {
        const parsed = JSON.parse(trimmed);
        modules = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e: any) {
        return {
            report: {
                importId, timestamp,
                summary: { status: 'FAILED', errorsCount: 1, warningsCount: 0, totalEntities: 0, importedEntities: 0, skippedEntities: 0, normalizedEntities: 0 },
                counts,
                details: [{ entityType: 'meta', ref: 'JSON', action: 'ERROR', reasonCode: 'INVALID_JSON', message: e.message, path: '$' }]
            },
            staging: null
        };
    }

    const today = srs.todayISO();

    // Sets for uniqueness check within batch
    const batchQRefs = new Set<string>();
    const batchCardRefs = new Set<string>();

    modules.forEach((mod, modIdx) => {
        // --- 1. MODULE VALIDATION ---
        const modId = mod.uid || mod.id; // Allow id as fallback but convert to internal uid concept if needed
        const subjectId = normalizeDiscipline(mod.subjectId || context?.subjectId);
        const title = mod.title || context?.title || `Módulo ${modIdx + 1}`;
        
        if (!subjectId) {
             details.push({ entityType: 'module', ref: title, action: 'ERROR', reasonCode: 'MISSING_SUBJECT', message: 'SubjectID obrigatório.', path: `$[${modIdx}].subjectId`, moduleId: modId });
        }

        // --- 2. LAW CARDS ---
        const lawCards = Array.isArray(mod.lawCards) ? mod.lawCards : [];
        counts.lawCards.received += lawCards.length;

        lawCards.forEach((lc: any, i: number) => {
            // Updated to prefer LC_REF
            const litRef = srs.canonicalizeLitRef(lc.LC_REF || lc.LIT_REF || lc.litRef || lc.id);
            const path = `$[${modIdx}].lawCards[${i}]`;

            if (!litRef) {
                details.push({ entityType: 'lawCard', ref: 'UNKNOWN', action: 'SKIPPED', reasonCode: 'MISSING_REF', message: 'LC_REF/LIT_REF ausente.', path, moduleId: modId });
                counts.lawCards.skipped++;
                return;
            }
            
            if (batchCardRefs.has(litRef)) {
                 details.push({ entityType: 'lawCard', ref: litRef, action: 'SKIPPED', reasonCode: 'DUPLICATE_IN_BATCH', message: 'Card duplicado no lote.', path, moduleId: modId });
                 counts.lawCards.skipped++;
                 return;
            }
            batchCardRefs.add(litRef);

            const newCard: LiteralnessCard = {
                id: litRef,
                lawId: subjectId, // Grouping key
                article: lc.ARTICLE || lc.LC_REF || lc.title || 'Artigo',
                topic: lc.TOPIC_TITLE || lc.TOPIC || title,
                phase1Full: lc.PHASE1_FULL || lc.text || '',
                partsSummary: lc.RESUMO_POR_PARTES || lc.partsSummary || '',
                keywordsProva: lc.KEYWORDS_PROVA || lc.keywords || '',
                riscoFcc: lc.RISCO_FCC || lc.risco || '',
                gancho: lc.GANCHO_MNEMONICO || lc.gancho || '',
                storytelling: lc.STORYTELLING || '',
                feynmanExplanation: lc.FEYNMAN || '',
                createdAt: today, nextReviewDate: today, lastReviewedAt: today,
                masteryScore: 0, totalAttempts: 0, stability: 1, batteryProgress: 0, progressionLevel: 0,
                importBatchId: importId, extraGaps: [], contentType: 'LAW_DRY'
            };
            
            newCard.studyFlow = buildReadingSteps(newCard); // Generate steps
            (newCard as any)._moduleIndex = modIdx; // TRACKER
            staging.cards.push(newCard);
            counts.lawCards.imported++;
        });

        // --- 3. QUESTIONS ---
        const questions = Array.isArray(mod.questions) ? mod.questions : [];
        counts.questions.received += questions.length;

        questions.forEach((q: any, i: number) => {
            const qRef = q.Q_REF || q.questionRef || q.id;
            const path = `$[${modIdx}].questions[${i}]`;

            if (!qRef) {
                details.push({ entityType: 'question', ref: 'UNKNOWN', action: 'SKIPPED', reasonCode: 'MISSING_REF', message: 'Q_REF obrigatório.', path, moduleId: modId });
                counts.questions.skipped++;
                return;
            }

            if (batchQRefs.has(qRef)) {
                 details.push({ entityType: 'question', ref: qRef, action: 'SKIPPED', reasonCode: 'DUPLICATE_IN_BATCH', message: 'Questão duplicada no lote.', path, moduleId: modId });
                 counts.questions.skipped++;
                 return;
            }
            
            const lawRef = srs.canonicalizeLitRef(q.LAW_REF || q.lawRef || q.litRef);
            
            const correct = (q.CORRECT || q.correctAnswer || 'A').toUpperCase().trim().charAt(0);
            const options = normalizeOptions(q.options || q); // Normalize using q directly if OPT_A keys are at root
            
            if (!options.A || !options.B) {
                 if (q.TYPE?.includes('C/E') || correct === 'C' || correct === 'E') {
                     options.A = 'Certo'; options.B = 'Errado';
                 } else {
                     details.push({ entityType: 'question', ref: qRef, action: 'SKIPPED', reasonCode: 'INVALID_OPTIONS', message: 'Opções insuficientes.', path, moduleId: modId });
                     counts.questions.skipped++;
                     return;
                 }
            }

            const stableId = idGen.makeDeterministicId(lawRef || 'GERAL', 'QUESTION', qRef);
            batchQRefs.add(qRef);

            const newQ: Question = {
                id: stableId,
                questionRef: qRef,
                questionText: q.Q_TEXT || q.STEM || q.questionText || '...',
                options,
                correctAnswer: correct,
                subject: subjectId,
                topic: q.TOPIC || title,
                lawRef: lawRef || '', // Canonical link
                
                guiaTrapscan: q.GUIA_TRAPSCAN || q.guiaTrapscan || '',
                keyDistinction: q.KEY_DISTINCTION || q.keyDistinction,
                anchorText: q.ANCHOR_TEXT || q.anchorText,
                wrongDiagnosis: q.WRONG_DIAGNOSIS || q.wrongDiagnosis,
                explanationTech: q.EXPLANATION || q.EXPLANATION_TECH || q.explanationTech,
                explanationStory: q.EXPLANATION_STORY || q.explanationStory,

                // --- NOVOS CAMPOS MAPEADOS ---
                feynmanQuestions: q.PERGUNTAS_FEYNMAN || q.feynmanQuestions || q.feynman,
                distractorProfile: q.DISTRACTOR_PROFILE || q.distractorProfile,
                wrongDiagnosisMap: q.WRONG_DIAGNOSIS_MAP || q.wrongDiagnosisMap,
                // -----------------------------
                
                // Extra fields from TRAPSCAN object if present at root
                ...((q.TRAPSCAN) ? {
                     guiaTrapscan: JSON.stringify(q.TRAPSCAN),
                     keyDistinction: q.TRAPSCAN.P1_TERMO_ALVO || q.TRAPSCAN.KEY_DISTINCTION,
                     // Map other trapscan fields if needed, or store whole object
                } : {}),

                createdAt: today, nextReviewDate: today, totalAttempts: 0, masteryScore: 0,
                stability: settings.srsV2.S_default_days, attemptHistory: [],
                questionType: q.TYPE || 'Literalidade', difficultyLevel: 'normal',
                importBatchId: importId, sequenceNumber: 0, comments: '',
                lastAttemptDate: '', errorCount: 0, timeSec: 0, selfEvalLevel: 0,
                willFallExam: false, srsStage: 0, correctStreak: 0, lastWasCorrect: false, recentError: 0
            } as any;
            
            (newQ as any)._moduleIndex = modIdx; // TRACKER
            staging.questions.push(newQ);
            counts.questions.imported++;
        });

        // --- 4. GAPS ---
        const gaps = Array.isArray(mod.gaps) ? mod.gaps : [];
        counts.gaps.received += gaps.length;
        
        gaps.forEach((g: any, i: number) => {
             const gapRef = g.GAP_REF || g.id || `GAP_${i}`;
             // Try to infer litRef from parent or generate if missing
             const litRef = srs.canonicalizeLitRef(g.LIT_REF || g.litRef || `GAP_LIT_${modIdx}`);
             
             // Gaps don't strictly require LIT_REF for import if they are part of a lesson structure
             // But for SRS linkage it is better.
             
             const gapId = idGen.makeDeterministicId(litRef, 'LACUNA', gapRef);
             
             staging.gaps.push({
                 id: gapId,
                 litRef,
                 type: 'LACUNA',
                 payload: {
                     lacuna_text: g.TEXT_WITH_BLANKS || g.GAP_TEXT || g.text || g.PHASE2_LACUNA,
                     correct_text: g.ANSWER || g.correct_text, // Add correct text field support
                     correct_letter: g.PHASE2_CORRECT || g.correct || 'A',
                     options: normalizeOptions(g.options || { A: g.PHASE2_OPT_A, B: g.PHASE2_OPT_B, C: g.PHASE2_OPT_C, D: g.PHASE2_OPT_D, E: g.PHASE2_OPT_E })
                 }
             });
             counts.gaps.imported++;
        });

        // --- 5. FLASHCARDS & PAIRS ---
        const flashcards = Array.isArray(mod.flashcards) ? mod.flashcards : [];
        const pairs = Array.isArray(mod.pairs) ? mod.pairs : [];
        
        const processFc = (f: any, i: number, isPair: boolean) => {
            const listName = isPair ? 'pairs' : 'flashcards';
            const countObj = isPair ? counts.pairs : counts.flashcards;
            countObj.received++;
            
            const ref = f.FC_REF || f.PAIR_REF || f.id || `${listName}_${i}`;
            const path = `$[${modIdx}].${listName}[${i}]`;
            
            if (!f.front && !f.FRONT) {
                 details.push({ entityType: isPair ? 'pair' : 'flashcard', ref, action: 'SKIPPED', reasonCode: 'MISSING_CONTENT', message: 'Sem frente/verso.', path, moduleId: modId });
                 countObj.skipped++;
                 return;
            }

            const litRef = srs.canonicalizeLitRef(f.LIT_REF || f.litRef);
            const stableId = idGen.makeDeterministicId(litRef || subjectId, isPair ? 'PAIR' : 'FLASHCARD', ref);
            
            const tags = [...(f.tags || []), f.TAGS, litRef].flat().filter(Boolean);
            if (isPair) tags.push('pair-match');

            const newFc: Flashcard = {
                id: stableId,
                front: f.FRONT || f.front,
                back: f.BACK || f.back,
                discipline: subjectId,
                topic: f.TOPIC_TITLE || f.TOPIC || title,
                tags,
                type: 'basic',
                importBatchId: importId,
                createdAt: today, updatedAt: today, nextReviewDate: today,
                masteryScore: 0, stability: settings.srsV2.S_default_days,
                totalAttempts: 0, attemptHistory: [], masteryHistory: [],
                hotTopic: false, isCritical: false, isFundamental: false,
                lastWasCorrect: false, recentError: 0, correctStreak: 0, srsStage: 0,
                lastAttemptDate: '', pairMatchPlayed: false, timeSec: 0, selfEvalLevel: 0, comments: ''
            };
            
            (newFc as any)._moduleIndex = modIdx; // TRACKER
            staging.flashcards.push(newFc);
            countObj.imported++;
        };
        
        flashcards.forEach((f: any, i: number) => processFc(f, i, false));
        pairs.forEach((p: any, i: number) => processFc(p, i, true));
    });

    // --- FINAL REPORT ---
    const errorCount = details.filter(d => d.action === 'ERROR').length;
    const warningCount = details.filter(d => d.action === 'NORMALIZED').length;
    
    let status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" = "SUCCESS";
    if (errorCount > 0) status = "FAILED";
    else if (details.some(d => d.action === 'SKIPPED')) status = "PARTIAL_SUCCESS";

    const report: ImportReport = {
        importId,
        timestamp,
        summary: {
            status,
            totalEntities: counts.lawCards.received + counts.questions.received + counts.flashcards.received + counts.pairs.received + counts.gaps.received,
            importedEntities: counts.lawCards.imported + counts.questions.imported + counts.flashcards.imported + counts.pairs.imported + counts.gaps.imported,
            skippedEntities: counts.lawCards.skipped + counts.questions.skipped + counts.flashcards.skipped + counts.pairs.skipped + counts.gaps.skipped,
            normalizedEntities: warningCount,
            errorsCount: errorCount,
            warningsCount: warningCount
        },
        counts,
        details
    };

    return { report, staging: status === 'FAILED' ? null : staging };
};
