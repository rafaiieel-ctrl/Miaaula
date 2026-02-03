
import { Gap } from '../types';

// 1. BLACKLIST (Stopwords & Irrelevant terms)
const STOPWORDS_PT = new Set([
    // Artigos
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    // Preposições
    'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 
    'por', 'pelo', 'pela', 'pelos', 'pelas', 'para', 'com', 'sem', 'sob', 'sobre', 'ante', 'até',
    // Conjunções
    'e', 'ou', 'mas', 'porém', 'contudo', 'todavia', 'entretanto', 'pois', 'porque', 'porquê', 
    'que', 'se', 'quando', 'como', 'logo', 'portanto', 'assim', 'nem',
    // Pronomes / Determinantes
    'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 
    'meu', 'teu', 'seu', 'nosso', 'vosso', 'deles',
    'este', 'esta', 'isto', 'esse', 'essa', 'isso', 'aquele', 'aquela', 'aquilo',
    'qual', 'quais', 'quem', 'onde', 'cujo', 'cuja',
    // Verbos Auxiliares / Comuns (flexões)
    'é', 'são', 'foi', 'foram', 'era', 'eram', 'ser', 'estar', 'está', 'estão',
    'tem', 'têm', 'ter', 'tinha', 'haver', 'há', 'houve', 'vai', 'vão', 'pode', 'podem', 'deve', 'devem',
    // Outros
    'não', 'sim', 'tal', 'tão', 'mais', 'menos', 'muito', 'pouco', 'cada', 'qualquer',
    'lei', 'art', 'artigo', 'inciso', 'item', 'alinea', 'paragrafo', '§', '°', 'º', 'ª'
]);

// 2. LEGAL TERMS DICTIONARY (Fallback for distractors)
const LEGAL_TERMS_FALLBACK = [
    'obrigação tributária', 'lançamento', 'crédito tributário', 'isenção', 'anistia',
    'imunidade', 'fato gerador', 'base de cálculo', 'alíquota', 'sujeito passivo',
    'solidariedade', 'domicílio', 'responsabilidade', 'decadência', 'prescrição',
    'pagamento', 'compensação', 'transação', 'remissão', 'consignação'
];

interface CandidateToken {
    text: string;
    index: number;
    score: number;
    original: string;
}

// --- LOGIC ---

function isStopword(word: string): boolean {
    const clean = word.toLowerCase().replace(/[.,;:\-()"]/g, '');
    return STOPWORDS_PT.has(clean) || clean.length < 3;
}

function calculateScore(word: string, fullText: string, keywords: string[]): number {
    let score = 0;
    const clean = word.replace(/[.,;:\-()"]/g, '');

    // Base score by length (preference for substantial words)
    score += Math.min(clean.length, 10);

    // Bonus: Capitalized word (not at start of sentence)
    // We'd need context for start of sentence, here we simplify
    if (/^[A-ZÁÉÍÓÚÀÃÕÊÔ]/.test(word)) {
        score += 5;
    }

    // Bonus: Is in Keywords
    if (keywords.some(k => k.toLowerCase().includes(clean.toLowerCase()))) {
        score += 20;
    }

    // Penalty: Common verbs endings (heuristic)
    if (clean.endsWith('r') || clean.endsWith('ndo') || clean.endsWith('ado') || clean.endsWith('ido')) {
        score -= 3; 
    }

    return score;
}

function tokenize(text: string): CandidateToken[] {
    // Split by spaces but keep punctuation attached for reconstruction, clean for analysis
    const tokens = text.split(/(\s+)/); 
    const candidates: CandidateToken[] = [];
    let currentIndex = 0;

    tokens.forEach(token => {
        const clean = token.trim().replace(/[.,;:\-()"]/g, '');
        if (clean && !isStopword(clean)) {
            candidates.push({
                text: clean,
                original: token.trim(), // Keep punctuation for replacement later if needed
                index: currentIndex,
                score: 0
            });
        }
        currentIndex += token.length;
    });

    return candidates;
}

/**
 * Generates distractors based on the correct answer and the context text.
 */
function generateDistractors(correctAnswer: string, fullText: string): string[] {
    const distractors = new Set<string>();
    const tokens = tokenize(fullText);
    
    // 1. Try to find words of same class/length in text
    const pool = tokens
        .filter(t => t.text.toLowerCase() !== correctAnswer.toLowerCase())
        .filter(t => Math.abs(t.text.length - correctAnswer.length) <= 4) // Similar length
        .map(t => t.text);

    // Shuffle pool
    pool.sort(() => Math.random() - 0.5);

    // Add from text pool
    for (const word of pool) {
        if (distractors.size >= 4) break;
        distractors.add(word);
    }

    // 2. If not enough, fill with Legal Terms Fallback
    if (distractors.size < 4) {
        const shuffledTerms = [...LEGAL_TERMS_FALLBACK].sort(() => Math.random() - 0.5);
        for (const term of shuffledTerms) {
            if (distractors.size >= 4) break;
            if (term.toLowerCase() !== correctAnswer.toLowerCase()) {
                distractors.add(term);
            }
        }
    }

    return Array.from(distractors).slice(0, 4);
}

export interface GeneratedGapData {
    gapText: string; // The full text with {{gap}}
    correct: string;
    options: { A: string, B: string, C: string, D: string, E: string };
}

/**
 * Analyzes the text and generates a smart gap fill exercise.
 */
export function generateSmartGap(
    text: string, 
    keywordsStr: string = ''
): GeneratedGapData | null {
    if (!text || text.length < 10) return null;

    const keywords = keywordsStr.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const candidates = tokenize(text);

    // Calculate scores
    candidates.forEach(c => {
        c.score = calculateScore(c.text, text, keywords);
    });

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Pick top candidate
    if (candidates.length === 0) return null;
    
    // Randomize slightly among top 3 to avoid always picking the same if multiple runs
    const topCandidates = candidates.slice(0, 3);
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    const correctAnswer = selected.text; // Use clean text
    const exactMatch = selected.original; // Use original to replace in text (handles punctuation attached)

    // Generate Gap Text: Replace only the selected occurrence
    // We use a safe replacement that doesn't nuke all occurrences if word appears twice
    // Construct regex with word boundaries
    // Note: This is a simplified replacement. Ideally we'd use index, but text reconstruction is complex.
    // We will replace the *first* or *best context* occurrence. 
    // For MVP, we replace the specific string found.
    const gapTemplate = text.replace(selected.original, `{{${correctAnswer}}}`); 

    // Generate Distractors
    const dists = generateDistractors(correctAnswer, text);
    
    // Prepare Options
    const allOptions = [correctAnswer, ...dists];
    // Shuffle options
    allOptions.sort(() => Math.random() - 0.5);

    return {
        gapText: gapTemplate,
        correct: correctAnswer,
        options: {
            A: allOptions[0],
            B: allOptions[1],
            C: allOptions[2],
            D: allOptions[3],
            E: allOptions[4]
        }
    };
}
