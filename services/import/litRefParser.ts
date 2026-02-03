
import { LiteralnessCard, Question, Flashcard, AppSettings } from '../../types';
import * as srs from '../srsService';
import * as idGen from '../idGenerator';
import { buildReadingSteps } from '../readingParser';
import { sanitizeOptionText } from '../questionParser'; // IMPORT SANITIZER

export interface ImportResult {
    batchId: string;
    cards: LiteralnessCard[];
    questions: Question[];
    flashcards: Flashcard[];
    gaps: any[]; 
    stats: {
        cards: number;
        questions: number;
        flashcards: number;
        pairs: number;
        gaps: number;
    };
    errors: string[];
}

export interface ImportReport {
    litRef: string;
    status: 'SUCCESS' | 'FAILED';
    errors: string[];
    warnings: string[];
    counts: {
        lacunas: number;
        questions: number;
        flashcards: number;
        pairs: number;
    };
    detectedGaps: string[];
}

// --- HELPER: Parse Map String to Object ---
const parseMapString = (data: string): Record<string, string> => {
    const result: Record<string, string> = {};
    if (!data || typeof data !== 'string') return result;
    
    // Support | or || separators
    const parts = data.includes('||') ? data.split('||') : data.split('|');
    parts.forEach(p => {
        const match = p.trim().match(/^([A-E])\s*[:=]\s*(.*)$/);
        if (match) {
            result[match[1]] = match[2].trim();
        }
    });
    return result;
};


/**
 * MIIAULA ROBUST PARSER (PATCH 1.6 - FEEDBACK ENGINE & FLEXIBLE KEYS)
 */
export const parseOfficialStrict = (text: string, settings: AppSettings): { 
    batchId: string, 
    nuclei: any[], 
    contents: any[],
    reports: ImportReport[] 
} => {
    const batchId = `BATCH_${Date.now()}`;
    const nuclei: any[] = [];
    const contents: any[] = [];
    const reports: ImportReport[] = [];

    // Regex expandido para incluir campos do Feedback Engine com suporte a variações
    const KEY_REGEX = /\b(LIT_REF|LAW_ID|ARTICLE|TOPIC|PHASE1_FULL|PARTS_SUMMARY|RESUMO_POR_PARTES|KEYWORDS_PROVA|RISCO_FCC|GANCHO_MNEMONICO|STORYTELLING|FEYNMAN|PHASE3_ORIGINAL|PHASE3_VARIANT|EXPLAIN|PHASE2_LACUNA_\d+|PHASE2_CORRECT_\d+|PHASE2_OPT_[A-E]_\d+|Q_REF|Q_TEXT|QUESTION_TEXT|CORRECT|ANSWER|A|B|C|D|E|FC_REF|PAIR_REF|TOPIC_TITLE|FRONT|BACK|TAGS|LAW_REF|GUIA_TRAPSCAN|TRAPSCAN|PALAVRA_QUE_SALVA|KEY_DISTINCTION|FRASE_ANCORA_FINAL|FRASE_ANCORA|ANCHOR_TEXT|EXPLANATION_TECH|EXPLICA_TECNICA|EXPLANATION_STORY|HISTORIA|PERGUNTAS_FEYNMAN|DISTRACTOR_PROFILE|PERFIL_DISTRATORES|WRONG_DIAGNOSIS|DIAGNOSTICO_ERRO|WRONG_DIAGNOSIS_MAP|MAPA_ERRO|EXPLANATION|COMENTARIO):\s*/g;

    const keyPositions: { key: string, start: number, end: number }[] = [];
    let match;
    while ((match = KEY_REGEX.exec(text)) !== null) {
        keyPositions.push({
            key: match[1].toUpperCase(),
            start: match.index,
            end: match.index + match[0].length
        });
    }

    const flatEntries: { key: string, value: string }[] = [];
    keyPositions.forEach((pos, i) => {
        const valueEnd = (i < keyPositions.length - 1) ? keyPositions[i + 1].start : text.length;
        const val = text.substring(pos.end, valueEnd).trim();
        const cleanVal = val.replace(/;$/, ''); 
        
        flatEntries.push({
            key: pos.key,
            value: cleanVal
        });
    });

    let currentNucleus: any = null;
    let currentReport: ImportReport | null = null;
    let currentItem: any = null;
    let currentItemType: 'QUESTION' | 'FLASHCARD' | 'PAIR' | null = null;
    let gapDataMap: Record<string, Record<string, string>> = {};

    const flushItem = () => {
        if (currentItem && currentNucleus) {
            const litRef = currentNucleus.id;
            const type = currentItemType || 'UNKNOWN';
            let idx = 1;
            
            if (type === 'QUESTION') {
                const m = currentItem.q_ref?.match(/Q(\d+)/i);
                idx = m ? parseInt(m[1]) : contents.length + 1;
                if (!currentItem.questionText && currentItem.q_text) currentItem.questionText = currentItem.q_text;
                currentReport!.counts.questions++;
            } else if (type === 'FLASHCARD') {
                idx = contents.length + 1;
                currentReport!.counts.flashcards++;
            } else if (type === 'PAIR') {
                idx = contents.length + 1;
                currentReport!.counts.pairs++;
                if (!currentItem.tags) currentItem.tags = [];
                if (!currentItem.tags.includes('pair-match')) currentItem.tags.push('pair-match');
            }

            if (!currentItem.lawRef) currentItem.lawRef = litRef;

            contents.push({
                id: idGen.makeDeterministicId(litRef, type, idx),
                litRef, type, idx,
                payload: { ...currentItem }
            });
            currentItem = null;
            currentItemType = null;
        }
    };

    const processGaps = () => {
        if (!currentNucleus || !currentReport) return;
        const GAP_REGEX = /{{\s*([^{}]+?)\s*}}/;
        
        Object.keys(gapDataMap).sort().forEach(xx => {
            const data = gapDataMap[xx];
            const rawText = data['LACUNA'] || '';
            const correctLetter = (data['CORRECT'] || '').trim().toUpperCase();
            
            // SANITIZE GAP OPTIONS TOO
            const options: Record<string, string> = {
                A: sanitizeOptionText(data['OPT_A']), 
                B: sanitizeOptionText(data['OPT_B']), 
                C: sanitizeOptionText(data['OPT_C']),
                D: sanitizeOptionText(data['OPT_D']), 
                E: sanitizeOptionText(data['OPT_E'])
            };

            const m = rawText.match(GAP_REGEX);
            let hasError = false;

            if (!m) { 
                const correctText = options[correctLetter];
                if (!correctText || !rawText.includes(correctText)) {
                     if (!options['A']) {
                        currentReport!.errors.push(`Lacuna ${xx}: Texto sem marcação {{ }} e sem opções.`);
                        hasError = true;
                     }
                }
            }
            
            if (!hasError) {
                contents.push({
                    id: idGen.makeDeterministicId(currentNucleus.id, 'LACUNA', xx),
                    litRef: currentNucleus.id,
                    type: 'LACUNA',
                    idx: parseInt(xx),
                    payload: {
                        lacuna_text: rawText,
                        blank_text: rawText.replace(GAP_REGEX, '__________'),
                        correct_letter: correctLetter || 'A',
                        correct_text: options[correctLetter] || '',
                        options
                    }
                });
                currentReport!.counts.lacunas++;
            }
        });
        gapDataMap = {};
    };

    flatEntries.forEach(entry => {
        const { key, value } = entry;

        if (key === 'LIT_REF') {
            flushItem(); processGaps();
            const id = srs.canonicalizeLitRef(value);
            currentNucleus = { id, importBatchId: batchId };
            currentReport = {
                litRef: id, status: 'SUCCESS', errors: [], warnings: [],
                counts: { lacunas: 0, questions: 0, flashcards: 0, pairs: 0 },
                detectedGaps: []
            };
            nuclei.push(currentNucleus);
            reports.push(currentReport);
        } 
        else if (key.startsWith('PHASE2_')) {
            const m = key.match(/^PHASE2_(LACUNA|CORRECT|OPT_[A-E])_(\d+)$/);
            if (m) {
                const subKey = m[1];
                const xx = m[2];
                if (!gapDataMap[xx]) gapDataMap[xx] = {};
                gapDataMap[xx][subKey] = value;
            }
        } 
        else if (key === 'Q_REF') {
            flushItem(); 
            currentItemType = 'QUESTION'; 
            currentItem = { q_ref: value, options: {}, questionText: '' };
        } 
        else if (key === 'FC_REF') {
            flushItem(); 
            currentItemType = 'FLASHCARD'; 
            currentItem = { fc_ref: value, tags: [] };
        } 
        else if (key === 'PAIR_REF') {
            flushItem(); 
            currentItemType = 'PAIR'; 
            currentItem = { pair_ref: value, tags: ['pair-match'] };
        } 
        else if (currentItem) {
            if (['A','B','C','D','E'].includes(key) && currentItemType === 'QUESTION') {
                // APPLY SANITIZATION LAYER 1
                currentItem.options[key] = sanitizeOptionText(value);
            } 
            else if (key === 'Q_TEXT' || key === 'QUESTION_TEXT') {
                if (currentItemType === 'QUESTION') currentItem.questionText = value;
            }
            else if (key === 'CORRECT' || key === 'ANSWER') {
                currentItem.correctAnswer = value;
            }
            else if (key === 'FRONT') currentItem.front = value;
            else if (key === 'BACK') currentItem.back = value;
            else if (key === 'TOPIC_TITLE') currentItem.topic = value; // Para Pares
            else if (key === 'TAGS') {
                currentItem.tags = value.split(/[;,]/).map(t => t.trim()).filter(Boolean);
            }
            else if (key === 'LAW_REF') currentItem.lawRef = srs.canonicalizeLitRef(value);
            
            // Map common aliases for feedback fields
            else if (['COMENTARIO', 'EXPLAIN'].includes(key)) currentItem.explanation = value;
            else if (['PALAVRA_QUE_SALVA', 'KEY_DISTINCTION'].includes(key)) currentItem.key_distinction = value;
            else if (['FRASE_ANCORA_FINAL', 'ANCHOR_TEXT', 'FRASE_ANCORA'].includes(key)) currentItem.anchor_text = value;
            else if (['GUIA_TRAPSCAN', 'TRAPSCAN'].includes(key)) currentItem.guia_trapscan = value;
            else if (['EXPLANATION_TECH', 'EXPLICA_TECNICA'].includes(key)) currentItem.explanation_tech = value;
            else if (['EXPLANATION_STORY', 'HISTORIA', 'STORYTELLING'].includes(key)) currentItem.explanation_story = value;
            else if (['WRONG_DIAGNOSIS', 'DIAGNOSTICO_ERRO'].includes(key)) currentItem.wrong_diagnosis = value;
            else if (['DISTRACTOR_PROFILE', 'PERFIL_DISTRATORES'].includes(key)) currentItem.distractor_profile = value;
            else if (['WRONG_DIAGNOSIS_MAP', 'MAPA_ERRO'].includes(key)) currentItem.wrong_diagnosis_map = value;
            
            else {
                currentItem[key.toLowerCase()] = value;
            }
        } 
        else if (currentNucleus) {
            currentNucleus[key.toLowerCase()] = value;
        }
    });

    flushItem(); 
    processGaps();

    return { batchId, nuclei, contents, reports };
};

export function parseLitRefText(text: string, settings: AppSettings, batchId: string, lawId?: string, forceLawId?: boolean): ImportResult {
    const { nuclei, contents, reports } = parseOfficialStrict(text, settings);
    const errors: string[] = [];
    reports.forEach(r => errors.push(...r.errors));

    const today = srs.todayISO();

    const cards: LiteralnessCard[] = nuclei.map(n => {
        const card: LiteralnessCard = {
            id: n.id,
            lawId: forceLawId && lawId ? lawId : (n.law_id || lawId || 'Geral'),
            article: n.article || n.id,
            topic: n.topic || 'Geral',
            phase1Full: n.phase1_full || '',
            partsSummary: n.parts_summary || n.resumo_por_partes || '',
            keywordsProva: n.keywords_prova || '',
            riscoFcc: n.risco_fcc || '',
            gancho: n.gancho_mnemonico || '',
            storytelling: n.storytelling || '',
            feynmanExplanation: n.feynman || '',
            createdAt: today, nextReviewDate: today, lastReviewedAt: today, masteryScore: 0, totalAttempts: 0,
            stability: settings.srsV2.S_default_days,
            batteryProgress: 0, progressionLevel: 0, userNotes: '',
            contentType: 'LAW_DRY', importBatchId: batchId,
            extraGaps: [] 
        };
        card.studyFlow = buildReadingSteps(card);
        return card;
    });

    const questions: Question[] = contents.filter(c => c.type === 'QUESTION').map(c => {
        const p = c.payload;
        
        // ENSURE OPTIONS ARE SANITIZED
        const rawOptions = p.options || { A: "Erro", B: "Erro" };
        const cleanOptions: any = {};
        Object.keys(rawOptions).forEach(k => {
             cleanOptions[k] = sanitizeOptionText(rawOptions[k]);
        });
        
        // Mapeamento dos campos do objeto temporário (lowercase) para o objeto Question (camelCase)
        return {
            id: c.id,
            questionRef: p.q_ref || `Q-${c.idx}`,
            questionText: p.questionText || p.q_text || 'Enunciado não encontrado',
            options: cleanOptions,
            correctAnswer: p.correctAnswer || 'A',
            
            // Core Explanation
            explanation: p.explanation || p.comentario || '',
            
            // Feedback Engine Mappings
            explanationTech: p.explanation_tech || p.explanation || '',
            explanationStory: p.explanation_story || p.storytelling,
            feynmanQuestions: p.perguntas_feynman || p.feynman,
            
            guiaTrapscan: p.guia_trapscan,
            keyDistinction: p.key_distinction || p.palavra_que_salva,
            anchorText: p.anchor_text || p.frase_ancora_final || p.frase_ancora,
            
            wrongDiagnosis: p.wrong_diagnosis || p.diagnostico_erro,
            // Critical Fix: Ensure maps are objects if they come as strings
            distractorProfile: typeof p.distractor_profile === 'string' ? parseMapString(p.distractor_profile) : p.distractor_profile, 
            wrongDiagnosisMap: typeof p.wrong_diagnosis_map === 'string' ? parseMapString(p.wrong_diagnosis_map) : p.wrong_diagnosis_map, 

            subject: p.discipline || cards.find(card => card.id === c.litRef)?.lawId || 'Geral',
            topic: p.topic || cards.find(card => card.id === c.litRef)?.article || 'Geral',
            lawRef: c.litRef,
            
            importBatchId: batchId,
            totalAttempts: 0, masteryScore: 0, attemptHistory: [],
            stability: settings.srsV2.S_default_days, nextReviewDate: today,
            createdAt: today, lastAttemptDate: '', errorCount: 0, timeSec: 0,
            selfEvalLevel: 0, willFallExam: false, srsStage: 0, correctStreak: 0,
            srsVersion: 2, sequenceNumber: 0, comments: '', questionType: 'Literalidade'
        } as unknown as Question;
    });

    const flashcards: Flashcard[] = contents.filter(c => c.type === 'FLASHCARD' || c.type === 'PAIR').map(c => {
        const p = c.payload;
        const tags = p.tags || [];
        if (c.type === 'PAIR' && !tags.includes('pair-match')) tags.push('pair-match');
        if (!tags.includes(c.litRef)) tags.push(c.litRef);

        return {
            id: c.id,
            front: p.front || 'Frente Vazia',
            back: p.back || 'Verso Vazio',
            discipline: p.discipline || cards.find(card => card.id === c.litRef)?.lawId || 'Geral',
            topic: p.topic || cards.find(card => card.id === c.litRef)?.article || 'Geral',
            tags: tags,
            type: 'basic',
            importBatchId: batchId, totalAttempts: 0, masteryScore: 0,
            stability: settings.srsV2.S_default_days, nextReviewDate: today,
            createdAt: today, updatedAt: today, lastAttemptDate: '',
            timeSec: 0, selfEvalLevel: 0, attemptHistory: [], masteryHistory: [],
            pairMatchPlayed: false, comments: ''
        } as unknown as Flashcard;
    });

    // CRITICAL FIX: Extract Gaps specifically for persistence
    const gaps = contents.filter(c => c.type === 'LACUNA').map(c => ({
        id: c.id,
        litRef: c.litRef,
        type: 'LACUNA',
        payload: c.payload
    }));

    return {
        batchId, cards, questions, flashcards, gaps,
        stats: {
            cards: cards.length,
            questions: questions.length,
            flashcards: flashcards.filter(f => !f.tags.includes('pair-match')).length,
            pairs: flashcards.filter(f => f.tags.includes('pair-match')).length,
            gaps: gaps.length
        },
        errors
    };
}

export function enforceTargetLinkage(result: ImportResult, targetId: string): ImportResult {
    const canon = srs.canonicalizeLitRef(targetId);
    return {
        ...result,
        questions: (result.questions || []).map(q => ({ ...q, lawRef: canon })),
        flashcards: (result.flashcards || []).map(f => ({ ...f, tags: [...new Set([...(f.tags || []), canon])] })),
        // Also relink gaps if we were appending
        gaps: (result.gaps || []).map(g => ({ ...g, litRef: canon, id: idGen.makeDeterministicId(canon, 'LACUNA', g.payload.idx || 99) }))
    };
}

export function cleanBatchForExport(batch: any): any { return batch; }

export async function runImportSelfTest(): Promise<any> {
    const testText = `LIT_REF: TEST_01 LAW_ID: TEST ARTICLE: Art 1 PHASE1_FULL: Texto Q_REF: Q1 Q_TEXT: T? A: Sim; P7=Leaky B: Não CORRECT: A`;
    const mockSettings: any = { srsV2: { S_default_days: 1 } };
    const result = parseLitRefText(testText, mockSettings, 'TEST_BATCH');
    return { parseResult: result, auditReport: [] };
}
