
export interface TrapscanData {
    itemLabel: string; // Categoria (ex: "O", "T", "Regra")
    steps: { key: string; label: string; text: string }[];
    hasAny: boolean;
    completenessScore: number;
}

const TRAPSCAN_KEYS: Record<string, { id: string; label: string }> = {
    'P0': { id: 'P0', label: 'Micro-Pausa' },
    'P1': { id: 'P1', label: 'Termo Alvo / Comando' },
    'P1_TERMO_ALVO': { id: 'P1', label: 'Termo Alvo' },
    'P2': { id: 'P2', label: 'Base / Trecho' },
    'P2_BASE_TRECHO': { id: 'P2', label: 'Base do Trecho' },
    'P3': { id: 'P3', label: 'Restrição / Exceção' },
    'P3_RESTRICAO_EXCECAO': { id: 'P3', label: 'Restrição / Exceção' },
    'P4': { id: 'P4', label: 'Aplicação' },
    'P4_APLICACAO_PASSO_A_PASSO': { id: 'P4', label: 'Passo a Passo' },
    'P5': { id: 'P5', label: 'Pegadinha' },
    'P5_PEGADINHA_FCC': { id: 'P5', label: 'Pegadinha da Banca' },
    'P6': { id: 'P6', label: 'Eliminação' },
    'P6_COMO_ELIMINAR': { id: 'P6', label: 'Como Eliminar' },
    // P7 usually handled separately as map, but captured here for text fallback
    'P7': { id: 'P7', label: 'Diagnóstico' },
    'P7_WRONG_MAP': { id: 'P7', label: 'Mapa de Erros' }
};

/**
 * Normaliza o Guia Trapscan vindo de String ("ITEM=X; P1=Y") ou Objeto JSON.
 * Suporta chaves detalhadas (P1_TERMO_ALVO) e simples (P1).
 */
export const normalizeTrapscan = (raw: any): TrapscanData => {
    const data: Record<string, string> = {};

    // 1. Parsing Input
    if (typeof raw === 'string') {
        try {
            // Tenta parsear como JSON primeiro (formato novo de importação)
            const parsed = JSON.parse(raw);
            Object.assign(data, parsed);
        } catch (e) {
            // Fallback para formato String legado: "ITEM=O; P1=Texto; P2=Texto"
            raw.split(/;|\|/).forEach(part => {
                const match = part.match(/^\s*([^=:]+)[:=](.*)$/);
                if (match) {
                    const key = match[1].trim().toUpperCase();
                    const val = match[2].trim();
                    if (key && val) data[key] = val;
                }
            });
        }
    } else if (typeof raw === 'object' && raw !== null) {
        // Formato Objeto direto
        Object.entries(raw).forEach(([k, v]) => {
            if (v) {
                if (typeof v === 'object') {
                    // Se for objeto (ex: P7_WRONG_MAP), stringify para exibição simples ou ignora se tratado externamente
                    data[k.toUpperCase()] = JSON.stringify(v);
                } else {
                    data[k.toUpperCase()] = String(v).trim();
                }
            }
        });
    }

    // 2. Extract Metadata
    const itemLabel = data['ITEM'] || data['TRAPSCAN_EXIGIDO'] || data['EIXO'] || '—';
    
    // 3. Extract Steps (P0..P9) using mapping
    const steps: { key: string; label: string; text: string }[] = [];
    
    // Normalizar chaves encontradas para a ordem correta P0->P7
    const foundKeys = Object.keys(data);
    
    // Ordem de iteração fixa para garantir P1 antes de P2, etc.
    const ORDERED_IDS = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

    ORDERED_IDS.forEach(id => {
        // Encontrar a chave correspondente no objeto de dados (ex: P1 ou P1_TERMO_ALVO)
        // Prioriza chave detalhada se existir, senão chave curta
        const matchKey = foundKeys.find(k => {
            const def = TRAPSCAN_KEYS[k];
            return def && def.id === id;
        });

        if (matchKey) {
            let text = data[matchKey];
            // Limpeza de texto JSON se for o P7 map
            if (id === 'P7' && text.startsWith('{')) {
                 text = "Ver tabela de diagnóstico abaixo.";
            }
            
            if (text && text !== '—') {
                steps.push({
                    key: id,
                    label: TRAPSCAN_KEYS[matchKey]?.label || id,
                    text: text
                });
            }
        }
    });

    // 4. Auto-inject P0 (Micro-Pausa) if missing but P1 exists
    const hasP0 = steps.some(s => s.key === 'P0');
    const hasP1 = steps.some(s => s.key === 'P1');
    
    if (!hasP0 && hasP1) {
        steps.unshift({
            key: 'P0',
            label: 'Micro-Pausa',
            text: 'MICRO-PAUSA (2s): Pare e respire antes de marcar. O que a banca quer?'
        });
    }

    // 5. Final Score
    const hasAny = steps.length > 0;
    const completenessScore = steps.length;

    return {
        itemLabel,
        steps,
        hasAny,
        completenessScore
    };
};

/**
 * Formata strings de passos (Legado)
 */
export const parseStepString = (text: any): Record<string, string> | string => {
    if (!text || typeof text !== 'string') return text;
    return text;
};

/**
 * Formata mapas de diagnóstico (Ex: "A: Erro tal | B: Erro tal")
 */
export const parseDiagnosisMap = (text: any): Record<string, string> | any => {
    if (typeof text === 'object') return text;
    if (!text || typeof text !== 'string') return {};

    // Tenta parse JSON primeiro (novo formato importador)
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch (e) {
        // ignore, continue to regex parse
    }

    const map: Record<string, string> = {};
    // Separa por || ou |
    const parts = text.split(/\|\||\|/).map(s => s.trim()).filter(Boolean);
    
    parts.forEach(part => {
        // Tenta capturar "A: ..." ou "A=..."
        const m = part.match(/^([A-E])\s*[:=\-]\s*(.*)$/i);
        if (m) {
            map[m[1].toUpperCase()] = m[2].trim();
        }
    });

    return Object.keys(map).length > 0 ? map : text;
};
