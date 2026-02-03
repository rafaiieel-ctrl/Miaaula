
import { Question, Flashcard, SrsItem } from '../types';

// services/taxonomyService.ts

const CANONICAL_MAP: Record<string, string> = {
    // TRIBUTÁRIO
    "CTN": "DIREITO TRIBUTÁRIO",
    "CODIGO TRIBUTARIO NACIONAL": "DIREITO TRIBUTÁRIO",
    "CREDITO TRIBUTARIO": "DIREITO TRIBUTÁRIO",
    "DIREITO TRIBUTARIO": "DIREITO TRIBUTÁRIO",
    "DIR. TRIBUTARIO": "DIREITO TRIBUTÁRIO",
    "TRIBUTARIO": "DIREITO TRIBUTÁRIO",
    "LEGISLACAO TRIBUTARIA": "LEGISLAÇÃO TRIBUTÁRIA",
    "LEG. TRIBUTARIA": "LEGISLAÇÃO TRIBUTÁRIA",
    "LTE": "LEGISLAÇÃO TRIBUTÁRIA",
    
    // AGILE
    "SCRUM": "SCRUM / AGILE",
    "AGILE": "SCRUM / AGILE",
    "KANBAN": "SCRUM / AGILE",
    "METODOS AGEIS": "SCRUM / AGILE",
    
    // CONSTITUCIONAL
    "DIREITO CONSTITUCIONAL": "DIREITO CONSTITUCIONAL",
    "CONST": "DIREITO CONSTITUCIONAL",
    "CONSTITUCIONAL": "DIREITO CONSTITUCIONAL",
    "DIR. CONST.": "DIREITO CONSTITUCIONAL",
    
    // ADMINISTRATIVO
    "DIREITO ADMINISTRATIVO": "DIREITO ADMINISTRATIVO",
    "ADMINISTRATIVO": "DIREITO ADMINISTRATIVO",
    "ADM": "DIREITO ADMINISTRATIVO",
    "DIR. ADM.": "DIREITO ADMINISTRATIVO",
    
    // LÍNGUAS
    "PORTUGUES": "LÍNGUA PORTUGUESA",
    "LINGUA PORTUGUESA": "LÍNGUA PORTUGUESA",
    "INGLES": "LÍNGUA INGLESA",
    
    // EXATAS
    "RLM": "RACIOCÍNIO LÓGICO",
    "RACIOCINIO LOGICO": "RACIOCÍNIO LÓGICO",
    "MATEMATICA": "MATEMÁTICA",
    
    // TI
    "BANCO DE DADOS": "BANCO DE DADOS",
    "BD": "BANCO DE DADOS",
    "ENGENHARIA DE SOFTWARE": "ENGENHARIA DE SOFTWARE",
    "ES": "ENGENHARIA DE SOFTWARE",
};

export const normalizeDiscipline = (raw: string | undefined): string => {
    if (!raw || !raw.trim()) return 'GERAL';
    
    // 1. Normalize string: Upper, No Accents, Collapse Spaces
    const clean = raw.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9\s\/\-\.]/g, "") // Keep alphanumeric, slash, dash, dot
        .replace(/\s+/g, " ");

    // 2. Exact Match in Map
    if (CANONICAL_MAP[clean]) {
        return CANONICAL_MAP[clean];
    }
    
    // 3. Partial Match Heuristics (Fallback)
    if (clean.includes("TRIBUTARI") && !clean.includes("LEGISLA")) return "DIREITO TRIBUTÁRIO";
    if (clean.includes("CONSTITUCIONAL")) return "DIREITO CONSTITUCIONAL";
    if (clean.includes("ADMINISTRATIVO")) return "DIREITO ADMINISTRATIVO";
    if (clean.includes("SCRUM") || clean.includes("AGILE")) return "SCRUM / AGILE";
    
    // 4. Return Normalized Raw if no alias found (Upper case, no accents)
    // We return 'clean' to ensure grouping works even if not in map.
    // If we want to preserve accents for unknown subjects, we would need to not strip them in step 1,
    // but stripping guarantees better grouping for "Historia" vs "História".
    return clean;
};

// --- MERGE LOGIC ---

export interface MergeResult {
    updatedQuestions: Question[];
    updatedFlashcards: Flashcard[];
    movedQuestionsCount: number;
    movedFlashcardsCount: number;
}

/**
 * Merges two disciplines into one Target.
 * Updates all related items. Does NOT perform deep text deduplication,
 * only subject re-assignment and normalization.
 */
export const mergeDisciplines = (
    sourceA: string,
    sourceB: string,
    target: string,
    allQuestions: Question[],
    allFlashcards: Flashcard[],
    applyNormalization: boolean = true
): MergeResult => {
    const finalTarget = applyNormalization ? normalizeDiscipline(target) : target.trim().toUpperCase();
    
    const targetsToMerge = new Set([
        applyNormalization ? normalizeDiscipline(sourceA) : sourceA, 
        applyNormalization ? normalizeDiscipline(sourceB) : sourceB
    ]);

    let movedQ = 0;
    const updatedQuestions = allQuestions.map(q => {
        const currentSubj = applyNormalization ? normalizeDiscipline(q.subject) : q.subject;
        if (targetsToMerge.has(currentSubj)) {
            movedQ++;
            return { ...q, subject: finalTarget };
        }
        return q;
    });

    let movedF = 0;
    const updatedFlashcards = allFlashcards.map(fc => {
        const currentDisc = applyNormalization ? normalizeDiscipline(fc.discipline) : fc.discipline;
        if (targetsToMerge.has(currentDisc)) {
            movedF++;
            return { ...fc, discipline: finalTarget };
        }
        return fc;
    });

    return {
        updatedQuestions: movedQ > 0 ? updatedQuestions : [],
        updatedFlashcards: movedF > 0 ? updatedFlashcards : [],
        movedQuestionsCount: movedQ,
        movedFlashcardsCount: movedF
    };
};
