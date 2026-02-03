
import { Question } from '../types';

export interface ParsedQuestionContent {
    stem: string;
    options: { [key: string]: string | undefined };
}

/**
 * Sanitizes option text to remove Metadata leaks (P1=..., P7=..., GUIA_TRAPSCAN).
 * Defense Layer 1 & 2.
 */
export function sanitizeOptionText(text: string | undefined): string {
    if (!text) return '';
    
    // Regex to find Metadata patterns starting with P[0-7]= or specific keywords, 
    // often preceded by a semicolon or whitespace, extending to the end of the string.
    // Example: "Texto da opção; P7=Diagnóstico..." -> "Texto da opção"
    const METADATA_LEAK_REGEX = /(?:^|[;\s]+)(?:P[0-7]\s*[=:]|GUIA_TRAPSCAN|TRAPSCAN_EXIGIDO|WRONG_DIAGNOSIS)[\s\S]*$/i;
    
    let clean = text.replace(METADATA_LEAK_REGEX, '');
    
    // Remove potential trailing punctuation left behind (like a semicolon before the P7)
    clean = clean.replace(/[;]+$/, '');
    
    return clean.trim();
}

/**
 * Robust parser to extract options from raw text.
 * Handles:
 * - Inline: "Enunciado... A: Opção 1 B: Opção 2"
 * - Multiline: "Enunciado...\nA) Opção 1\nB) Opção 2"
 * - Separators: ":", ")", "-", "."
 * - Mixed formats
 */
export function parseQuestionText(rawText: string): ParsedQuestionContent {
    if (!rawText) return { stem: '', options: {} };

    const text = rawText.trim();
    const options: { [key: string]: string } = {};
    
    // 1. Identify potential markers positions
    // Regex looks for A, B, C, D, E followed by a separator, preceded by whitespace or start of line
    const markerRegex = /(?:^|\s|\n)([A-E])\s*[:\)\-\.]\s+/g;
    
    const matches: { key: string; index: number; fullMatch: string }[] = [];
    let match;
    
    while ((match = markerRegex.exec(text)) !== null) {
        matches.push({
            key: match[1], // "A", "B", etc.
            index: match.index,
            fullMatch: match[0]
        });
    }

    // 2. Validate Sequence (We need A -> B -> C...)
    // This filters out false positives like "O artigo A diz..."
    const validMatches: typeof matches = [];
    const expectedKeys = ['A', 'B', 'C', 'D', 'E'];
    let nextExpectedIndex = 0;

    for (const m of matches) {
        if (m.key === expectedKeys[nextExpectedIndex]) {
            validMatches.push(m);
            nextExpectedIndex++;
        } else if (m.key === 'A' && validMatches.length > 0) {
             // Restart sequence if we find another 'A' (maybe parsing multiple q's? stick to first valid block or reset)
             // For a single question parser, we assume the last valid sequence or the first. 
             // Let's stick to the first valid A..E sequence found.
             if (nextExpectedIndex < 2) {
                 // If we haven't even found B yet, restart
                 validMatches.length = 0;
                 validMatches.push(m);
                 nextExpectedIndex = 1;
             }
        }
    }

    // If we don't have at least A and B, treat as no options
    if (validMatches.length < 2) {
        return { stem: text, options: {} };
    }

    // 3. Extract Stem (Text before first 'A')
    // We trim the end to remove the marker of A
    // Adjust index: match.index identifies where the whitespace/newline BEFORE 'A' starts.
    // We want up to that point.
    let stem = text.substring(0, validMatches[0].index).trim();

    // 4. Extract Options
    for (let i = 0; i < validMatches.length; i++) {
        const current = validMatches[i];
        const next = validMatches[i + 1];
        
        // Start of content: end of the marker (A: )
        const contentStart = current.index + current.fullMatch.length;
        
        // End of content: start of next marker OR end of string
        const contentEnd = next ? next.index : text.length;
        
        const optionText = text.substring(contentStart, contentEnd).trim();
        
        // APPLY SANITIZATION LAYER 1
        options[current.key] = sanitizeOptionText(optionText);
    }

    return { stem, options };
}

/**
 * Ensures a Question object has its options parsed.
 * Returns a NEW Question object with 'questionText' cleaned (stem only) 
 * and 'options' populated.
 */
export function ensureQuestionOptions(q: Question): Question {
    // If we already have options populated, assume valid (or at least manual override)
    // Checking strict length 5 might be too aggressive if user deleted E, but check for at least A/B
    const hasExistingOptions = q.options && (q.options.A || q.options.B);
    
    if (hasExistingOptions) {
        // Even if existing, apply Sanitization Layer 2 (Runtime Cleanup)
        // just in case bad data was saved previously.
        const cleanedOptions: any = {};
        if (q.options) {
            Object.keys(q.options).forEach(k => {
                // @ts-ignore
                cleanedOptions[k] = sanitizeOptionText(q.options[k]);
            });
        }
        return { ...q, options: cleanedOptions };
    }

    // Fallback: Parse from text
    const { stem, options } = parseQuestionText(q.questionText);
    
    if (Object.keys(options).length >= 2) {
        return {
            ...q,
            questionText: stem, // Cleaned stem
            options: { ...q.options, ...options } // Merged options
        };
    }

    return q;
}
