
import { LiteralnessCard, StudyStep, StudyStepType } from '../types';

export const READING_FLOW_ORDER: { type: StudyStepType; label: string }[] = [
    { type: 'READING', label: 'Leitura da Lei Seca' }, // PHASE1_FULL maps to READING
    { type: 'PARTS_SUMMARY', label: 'Resumo por Partes' },
    { type: 'KEYWORDS_PROVA', label: 'Keywords de Prova' },
    { type: 'RISCO_FCC', label: 'Risco / Pegadinhas FCC' },
    { type: 'GANCHO', label: 'Gancho de Memorização' },
    { type: 'EXPLANATION', label: 'Explicação' },
    { type: 'STORYTELLING', label: 'Storytelling' },
    { type: 'FEYNMAN', label: 'Técnica Feynman' },
    { type: 'SUMMARY', label: 'Resumo Esquemático' }, // RESUMO_ESQUEMATICO maps to SUMMARY
];

export const SYNONYMS: Record<string, string> = {
    'PHASE1_FULL': 'PHASE1_FULL',
    'TEXTO_LEI': 'PHASE1_FULL',
    'TEXTO_DA_LEI': 'PHASE1_FULL',
    'LEI_SECA': 'PHASE1_FULL',
    
    'PARTS_SUMMARY': 'PARTS_SUMMARY',
    'RESUMO': 'PARTS_SUMMARY',
    'RESUMO_ESQUEMATICO': 'PARTS_SUMMARY',
    
    'KEYWORDS_PROVA': 'KEYWORDS_PROVA',
    'PALAVRAS_CHAVE': 'KEYWORDS_PROVA',
    'KEYWORDS': 'KEYWORDS_PROVA',
    
    'RISCO_FCC': 'RISCO_FCC',
    'RISCO': 'RISCO_FCC',
    'PEGADINHAS': 'RISCO_FCC',
    'RISCO_FCC_PEGADINHAS': 'RISCO_FCC',
    
    'GANCHO': 'GANCHO',
    'GANCHO_MNEMONICO': 'GANCHO',
    'GANCHO_MNEMÔNICO': 'GANCHO',
    'MNEMONICO': 'GANCHO',
    
    'EXPLANATION': 'EXPLANATION',
    'EXPLICACAO': 'EXPLANATION',
    'EXPLICAÇÃO': 'EXPLANATION',
    'EXPLAIN': 'EXPLANATION',
    
    'STORYTELLING': 'STORYTELLING',
    'HISTORIA': 'STORYTELLING',
    
    'FEYNMAN': 'FEYNMAN',
    'EXPLICACAO_FEYNMAN': 'FEYNMAN'
};

export const parseKeyedBlocks = (rawText: string): Record<string, string> => {
    const blocks: Record<string, string> = {};
    if (!rawText) return blocks;

    const lines = rawText.replace(/\r\n/g, '\n').split('\n');
    let currentKey = '';
    let currentContent: string[] = [];

    // Relaxed regex to catch more natural language keys like "RISCO FCC / PEGADINHAS:"
    const keyRegex = /^\s*([A-Z0-9_À-Ú\s/]+)(?::|---)\s*(.*)/i;

    lines.forEach(line => {
        const match = line.match(keyRegex);
        if (match) {
            // Save previous block if exists
            if (currentKey) {
                blocks[currentKey] = currentContent.join('\n').trim();
            }
            // Start new block
            // Normalize the found key to match SYNONYMS map keys (e.g. "RISCO FCC" -> "RISCO_FCC")
            const rawKeyString = match[1];
            const normalizedKey = rawKeyString
                .trim()
                .toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z0-9_]/g, "_")
                .replace(/_+/g, "_");

            currentKey = SYNONYMS[normalizedKey] || normalizedKey;
            currentContent = [match[2].trim()]; // Capture content on same line
        } else {
            if (currentKey) {
                currentContent.push(line);
            }
        }
    });

    // Save last block
    if (currentKey) {
        blocks[currentKey] = currentContent.join('\n').trim();
    }

    return blocks;
};

export const buildReadingSteps = (card: Partial<LiteralnessCard>): StudyStep[] => {
    const steps: StudyStep[] = [];
    const id = card.id || 'temp';

    // 1. PHASE1_FULL (The Article Text itself)
    if (card.phase1Full && card.phase1Full.trim()) {
        steps.push({ 
            id: `${id}_p1`, 
            type: 'READING', 
            title: 'Leitura da Lei Seca', 
            enabled: true,
            content: card.phase1Full
        });
    }

    // 2. PARTS_SUMMARY
    if (card.partsSummary && card.partsSummary.trim()) {
        steps.push({
            id: `${id}_sum`,
            type: 'PARTS_SUMMARY',
            title: 'Resumo por Partes',
            enabled: true,
            content: card.partsSummary
        });
    }

    // 3. KEYWORDS_PROVA
    if (card.keywordsProva && card.keywordsProva.trim()) {
        steps.push({
            id: `${id}_kw`,
            type: 'KEYWORDS_PROVA',
            title: 'Keywords de Prova',
            enabled: true,
            content: card.keywordsProva
        });
    }

    // 4. RISCO_FCC
    if (card.riscoFcc && card.riscoFcc.trim()) {
        steps.push({
            id: `${id}_risk`,
            type: 'RISCO_FCC',
            title: 'Risco / Pegadinhas FCC',
            enabled: true,
            content: card.riscoFcc
        });
    }

    // 5. GANCHO
    if (card.gancho && card.gancho.trim()) {
        steps.push({
            id: `${id}_hook`,
            type: 'GANCHO',
            title: 'Gancho de Memorização',
            enabled: true,
            content: card.gancho
        });
    }

    // 6. EXPLANATION
    if (card.explain && card.explain.trim()) {
        steps.push({
            id: `${id}_exp`,
            type: 'EXPLANATION',
            title: 'Explicação Detalhada',
            enabled: true,
            content: card.explain
        });
    }

    // 7. STORYTELLING
    if (card.storytelling && card.storytelling.trim()) {
        steps.push({
            id: `${id}_story`,
            type: 'STORYTELLING',
            title: 'Storytelling',
            enabled: true,
            content: card.storytelling
        });
    }

    // 8. FEYNMAN
    if (card.feynmanExplanation && card.feynmanExplanation.trim()) {
        steps.push({
            id: `${id}_feyn`,
            type: 'FEYNMAN',
            title: 'Técnica Feynman',
            enabled: true,
            content: card.feynmanExplanation
        });
    }
    
    return steps;
};
