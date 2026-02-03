
import { Question } from '../types';

export interface ValidationResult {
    isCorrect: boolean;
    debugLog: {
        questionId: string;
        mode: string;
        correctRaw: string;
        correctNormalized: string;
        selectedRaw: string;
        selectedNormalized: string;
        isCorrect: boolean;
    };
}

/**
 * Normalizes text for comparison (Gap Fills).
 * Removes accents, trims spaces, lowercase, removes trailing punctuation.
 */
export const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .trim()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .replace(/[.,;:!]+$/, ''); // Remove trailing punctuation
};

/**
 * Normalizes options/keys (Multiple Choice).
 * Handles: "A", " a ", "0" (index), "Option A".
 */
export const normalizeOptionKey = (key: string | number): string => {
    const str = String(key).trim().toUpperCase();
    
    // Handle Numeric Index (0 -> A)
    if (/^\d+$/.test(str)) {
        const index = parseInt(str, 10);
        if (index >= 0 && index <= 25) {
            return String.fromCharCode(65 + index); // 0=A, 1=B...
        }
    }
    
    // Handle "Option A" or "Letra A"
    const match = str.match(/\b([A-E])\b/);
    if (match) return match[1];

    // Handle C/E (Certo/Errado) normalization
    if (str === 'CERTO' || str === 'C') return 'A'; // Standard mapping for C/E in app
    if (str === 'ERRADO' || str === 'E') return 'B';

    return str.charAt(0); // Fallback to first char
};

/**
 * Universal Answer Validator
 */
export const validateAnswer = (
    question: Question | any, 
    userAnswer: string | number, 
    context: string = 'UNKNOWN'
): ValidationResult => {
    let isCorrect = false;
    
    // Defensive: check for Gap-style properties if standard is missing
    let correctRaw = question.correctAnswer;
    if (!correctRaw) {
        // Fallbacks for non-standard objects (Gaps/Legacy)
        correctRaw = question.correct_letter || question.correct || (question.payload?.correct_letter) || '';
    }
    correctRaw = correctRaw || '';

    let selectedRaw = String(userAnswer);
    let correctNorm = '';
    let selectedNorm = '';

    // Scenario 1: Gap Fill (Text Comparison)
    // If the question is a GAP type, we prioritize comparing the ACTUAL TEXT content
    // because Key/Index might be unstable in shuffled views.
    // However, if the inputs are clearly Keys (A-E), we prefer Key comparison.
    const isGapTextComparison = (question.isGapType || (question.options && Object.values(question.options).some(v => v === selectedRaw))) 
                                && !/^[A-E]$/i.test(selectedRaw); // Only if NOT a key

    if (isGapTextComparison) {
        // Resolve the expected text from the correct key
        const expectedKey = normalizeOptionKey(correctRaw);
        // @ts-ignore
        const expectedText = question.options ? (question.options[expectedKey] || '') : '';
        
        // If user sent a Key (A, B...), resolve to text
        let userText = selectedRaw;
        if (/^[A-E]$/i.test(selectedRaw) && question.options) {
             // @ts-ignore
             userText = question.options[normalizeOptionKey(selectedRaw)] || '';
        }

        correctNorm = normalizeText(expectedText);
        selectedNorm = normalizeText(userText);
        
        // Primary Check: Text Content Match
        if (correctNorm && selectedNorm && correctNorm === selectedNorm) {
            isCorrect = true;
        } 
        // Secondary Check: If text lookup failed, fall back to Key Match (if user sent key)
        else if (/^[A-E]$/i.test(selectedRaw) && normalizeOptionKey(selectedRaw) === normalizeOptionKey(correctRaw)) {
            isCorrect = true;
        }
    } else {
        // Scenario 2: Multiple Choice (Key Comparison) - DEFAULT
        correctNorm = normalizeOptionKey(correctRaw);
        selectedNorm = normalizeOptionKey(selectedRaw);
        isCorrect = correctNorm === selectedNorm;
    }

    const debugLog = {
        questionId: question.id,
        mode: context,
        correctRaw,
        correctNormalized: correctNorm,
        selectedRaw,
        selectedNormalized: selectedNorm,
        isCorrect
    };

    // Telemetry / Console Log (Required by prompt for debugging)
    if (!isCorrect) {
        console.warn(`[Validation Fail][${context}]`, debugLog);
    } else {
        // console.debug(`[Validation Pass][${context}]`, debugLog);
    }

    return { isCorrect, debugLog };
};
