
import { Question, LiteralnessCard, AppSettings, NucleusStats, TrapscanReport, TrapSignal, TrapscanEntry, TrapscanPlan, TrapscanGuide, VulnerabilityStats, DiagnosticSummary, TrapscanQualityMetrics, TrapscanAutoAnalysis, AxisCandidate, TrapType, EvidenceItem, TrapscanEvidenceMap } from '../types';
import * as srs from './srsService';
import { normalizeTrapscan } from '../utils/feedbackFormatters';
import { getText, toNumber } from '../utils/i18nText';

export type { TrapType }; // Fix TS1205: isolatedModules requires `export type`

export const TRAP_REQ_DEFS: Record<string, { label: string; meaning: string; advice: string; triggers: string[] }> = {
    'T': { 
        label: 'TEXTO / LITERALIDADE', 
        meaning: 'A banca trocou uma palavra do texto de lei.', 
        advice: 'Aumente a atenção em palavras absolutas (sempre/nunca) e listas taxativas.',
        triggers: ['sempre', 'nunca', 'jamais', 'apenas', 'exclusivamente', 'unicamente']
    },
    'R': { 
        label: 'REGRA / EXCEÇÃO', 
        meaning: 'O comando pedia a exceção ou a regra geral foi aplicada incorretamente.', 
        advice: 'Sempre circule "SALVO", "EXCETO" ou "RESSALVADO" no enunciado.',
        triggers: ['salvo', 'exceto', 'ressalvado', 'vedado', 'proibido', 'em regra', 'desde que']
    },
    'A': { 
        label: 'AUTORIDADE / COMPETÊNCIA', 
        meaning: 'Erro na atribuição de quem faz o quê (sujeito ativo/passivo/órgão).', 
        advice: 'Mapeie quem tem competência privativa vs concorrente.',
        triggers: ['compete', 'competencia', 'sujeito', 'autoridade', 'privativo', 'exclusivo', 'cabe ao']
    },
    'P': { 
        label: 'PRAZO / TEMPO', 
        meaning: 'Erro numérico de prazos, vigência ou anterioridade.', 
        advice: 'Crie tabelas de prazos. A banca adora trocar dias por meses.',
        triggers: ['prazo', 'dias', 'anos', 'meses', 'horas', 'decadencial', 'prescricional', 'vigencia']
    },
    'S': { 
        label: 'SEMÂNTICA / CONCEITO', 
        meaning: 'Confusão entre conceitos parecidos ou natureza jurídica.', 
        advice: 'Diferencie definições (Ex: Taxa vs Tarifa, Dolo vs Culpa).',
        triggers: ['conceito', 'define', 'considera-se', 'natureza juridica', 'significa']
    },
    'C': { 
        label: 'JURISPRUDÊNCIA / CONFLITO', 
        meaning: 'A resposta dependia de entendimento de tribunal (STF/STJ) ou tese.', 
        advice: 'Verifique se a questão pede "segundo a jurisprudência" ou "letra da lei".',
        triggers: ['sumula', 'stf', 'stj', 'jurisprudencia', 'entendimento', 'doutrina']
    },
    'A2': { 
        label: 'ARMADILHA DE ALTERNATIVAS', 
        meaning: 'Distrator malicioso, inversão de frase ou casca de banana.', 
        advice: 'Leia todas as alternativas até a última palavra antes de marcar.',
        triggers: ['incorreta', 'errada', 'exceto']
    },
    'N': { 
        label: 'NEGAÇÃO / NÃO', 
        meaning: 'Erro por não perceber o comando negativo (INCORRETA).', 
        advice: 'Destaque gigante no comando "NÃO" ou "INCORRETA".',
        triggers: ['não', 'incorreta', 'falso']
    },
    'SEM_DADO': { 
        label: 'NÃO CLASSIFICADO', 
        meaning: 'Questão antiga sem metadados de Trapscan.', 
        advice: 'Atualize o cadastro desta questão com TRAPSCAN_EXIGIDO.',
        triggers: []
    }
};

// --- EVIDENCE OVERLAY HEURISTICS ---
// Matches exact words but respects word boundaries
const EVIDENCE_MATCHERS: Record<string, { regex: RegExp, reason: string, color: string }> = {
    // P1 COMMAND
    'CMD_CORRECT': { regex: /\b(correta|certo|verdadeiro)\b/i, reason: 'Comando positivo: busque a verdade.', color: 'text-emerald-500 border-emerald-500/50' },
    'CMD_INCORRECT': { regex: /\b(incorreta|errada|falso|exceto|salvo|não|inválido)\b/i, reason: 'Comando negativo ou exceção: cuidado com a inversão.', color: 'text-rose-500 border-rose-500/50' },
    'CMD_JUDGMENT': { regex: /\b(julgue|certo ou errado|certo\/errado)\b/i, reason: 'Formato Julgamento: analise item a item.', color: 'text-indigo-500 border-indigo-500/50' },

    // P2 AXES
    'T': { regex: /\b(sempre|nunca|jamais|apenas|exclusivamente|unicamente|somente|todo|toda|qualquer)\b/i, reason: 'Termo absoluto: geralmente indica erro (generalização).', color: 'text-red-500 border-red-500/50' },
    'R': { regex: /\b(em regra|salvo|exceto|ressalvado|desde que|independentemente|prescinde)\b/i, reason: 'Restrição ou Exceção: o foco está na condição.', color: 'text-orange-500 border-orange-500/50' },
    'A': { regex: /\b(compete|cabe a|autoridade|sujeito|privativo|exclusivo|delegável|indelegável|órgão)\b/i, reason: 'Competência: verifique se o sujeito está correto.', color: 'text-blue-500 border-blue-500/50' },
    'P': { regex: /\b(prazo|dias|meses|anos|horas|decadência|prescrição|vigência|anterioridade|noventena|após|antes)\b/i, reason: 'Temporalidade: números são alvos fáceis de troca.', color: 'text-green-500 border-green-500/50' },
    'S': { regex: /\b(pode|deve|vedado|permitido|facultado|obrigatório|conceito|natureza|definição)\b/i, reason: 'Semântica: troca de modal (Pode vs Deve) ou definição.', color: 'text-purple-500 border-purple-500/50' },
    'C': { regex: /\b(stf|stj|súmula|entendimento|doutrina|jurisprudência|pacífico|tese)\b/i, reason: 'Jurisprudência: exige conhecimento além da lei seca.', color: 'text-yellow-500 border-yellow-500/50' },
    'N': { regex: /\b(não|inaplicável|inexistente|impossível)\b/i, reason: 'Negação: verifique se não é dupla negação.', color: 'text-pink-500 border-pink-500/50' }
};

export const extractEvidence = (text: string): EvidenceItem[] => {
    if (!text) return [];
    
    const results: EvidenceItem[] = [];
    const seenTerms = new Set<string>();

    Object.entries(EVIDENCE_MATCHERS).forEach(([key, config]) => {
        const matches = text.match(new RegExp(config.regex, 'gi'));
        if (matches) {
            matches.forEach(match => {
                const term = match.toLowerCase();
                if (!seenTerms.has(term)) {
                    seenTerms.add(term);
                    
                    let axis = key;
                    if (key.startsWith('CMD_')) axis = 'CMD'; // Group commands
                    else if (['T','R','A','P','S','C','N'].includes(key)) axis = key;
                    else axis = 'A2'; // Fallback

                    results.push({
                        term: match, // Keep original case for display
                        axis: axis,
                        reason: config.reason,
                        confidence: 80, // Static high confidence for regex hits
                        color: config.color
                    });
                }
            });
        }
    });

    return results;
};

export const analyzeEvidence = (question: Question): TrapscanEvidenceMap => {
    const stemEvidence = extractEvidence(question.questionText);
    const optionsEvidence: Record<string, EvidenceItem[]> = {};

    if (question.options) {
        Object.entries(question.options).forEach(([key, text]) => {
            if (text) {
                optionsEvidence[key] = extractEvidence(text);
            }
        });
    }

    return {
        stem: stemEvidence,
        options: optionsEvidence
    };
};

// --- QUICK RULES DEFINITION ---
export const QUICK_RULES: Record<string, { id: string, text: string, type: TrapType, example: string }> = {
    'A_WHO': { id: 'A_WHO', text: 'QUEM FAZ / QUEM COMPETE / PAPEL / RESPONSÁVEL / AUTORIDADE?', type: 'A', example: 'Quem é responsável por…?' },
    'T_DEFINITION': { id: 'T_DEFINITION', text: 'O QUE É / DEFINIÇÃO / PROPÓSITO / CONCEITO?', type: 'T', example: 'O propósito primário é…' },
    'R_EXCEPTION': { id: 'R_EXCEPTION', text: 'TEM EXCEÇÃO / CONDIÇÃO / LIMITADOR? (exceto, salvo, em regra…)', type: 'R', example: 'Exceto / salvo / em regra…' },
    'P_TIME': { id: 'P_TIME', text: 'PRAZO / TEMPO / MOMENTO? (dias, decadência, prescrição…)', type: 'P', example: 'Prazo de…' },
    'S_SEMANTIC': { id: 'S_SEMANTIC', text: 'A PEGADINHA É O SENTIDO? (pode vs deve, vedado vs não se aplica…)', type: 'S', example: 'Pode vs deve…' },
    'C_CASELAW': { id: 'C_CASELAW', text: 'DEPENDE DE ENTENDIMENTO? (STF/STJ/súmula/tese/jurisprudência…)', type: 'C', example: 'Segundo o STF…' },
    'N_NEGATION': { id: 'N_NEGATION', text: 'TEM NEGAÇÃO / DUPLA NEGAÇÃO? (‘não é incorreto’, ‘exceto NÃO…’)', type: 'N', example: 'Não é incorreto…' },
    'A2_GENERIC': { id: 'A2_GENERIC', text: 'MALDADE GENÉRICA: quase verdade, inversão, generalização sem gatilho claro', type: 'A2', example: 'Inversão sutil…' }
};

export interface ChecklistItem {
    id: string;
    text: string;
    implies: string; 
    category: 'COMMAND' | 'TRAP';
}

export const P1_CHECKLIST: ChecklistItem[] = [
    { id: 'p1_1', text: 'Existe “EXCETO”, “NÃO”, “SALVO”, “INCORRETA” no enunciado?', implies: 'EXCEPT', category: 'COMMAND' },
    { id: 'p1_2', text: 'O enunciado pede “assinale a alternativa CORRETA”?', implies: 'CORRECT', category: 'COMMAND' },
    { id: 'p1_3', text: 'O enunciado pede “assinale a alternativa INCORRETA”?', implies: 'INCORRECT', category: 'COMMAND' },
    { id: 'p1_4', text: 'É formato “julgue o item” / “certo ou errado”?', implies: 'JUDGMENT', category: 'COMMAND' }
];

export const P2_CHECKLIST: ChecklistItem[] = [
    { id: 'p2_t1', text: 'Depende de palavra exata? ("vedado", "somente", "apenas")', implies: 'T', category: 'TRAP' },
    { id: 'p2_t2', text: 'Alternativa parece "quase igual" mas troca 1 palavra?', implies: 'T', category: 'TRAP' },
    { id: 'p2_r1', text: 'Há regra geral + exceção explícita? ("em regra... exceto...")', implies: 'R', category: 'TRAP' },
    { id: 'p2_r2', text: 'Pergunta quer "quando NÃO se aplica" ou "hipótese especial"?', implies: 'R', category: 'TRAP' },
    { id: 'p2_a1', text: 'O núcleo é "quem pode?" (União/Estado/Juiz/MP)?', implies: 'A', category: 'TRAP' },
    { id: 'p2_p1', text: 'Envolve Prazos (prescrição, dias, vigência)?', implies: 'P', category: 'TRAP' },
    { id: 'p2_s1', text: 'A pegadinha é sentido/conceito ("pode" vs "deve")?', implies: 'S', category: 'TRAP' },
    { id: 'p2_c1', text: 'Depende de STF/STJ/Súmula/Entendimento?', implies: 'C', category: 'TRAP' },
    { id: 'p2_n1', text: 'Possui dupla negação ou "não é incorreto"?', implies: 'N', category: 'TRAP' },
    { id: 'p2_a2', text: 'Inversão sutil ou generalização maldosa?', implies: 'A2', category: 'TRAP' }
];

export const calculateDetectionScore = (checkedIds: string[]) => {
    let commandScore: Record<string, number> = {};
    let trapScore: Record<string, number> = {};

    checkedIds.forEach(id => {
        const p1Item = P1_CHECKLIST.find(i => i.id === id);
        if (p1Item) {
            if (p1Item.id === 'p1_1') commandScore['EXCEPT'] = (commandScore['EXCEPT'] || 0) + 10;
            if (p1Item.id === 'p1_3') commandScore['INCORRECT'] = (commandScore['INCORRECT'] || 0) + 10;
            if (p1Item.id === 'p1_4') commandScore['JUDGMENT'] = (commandScore['JUDGMENT'] || 0) + 10;
            if (p1Item.id === 'p1_2') commandScore['CORRECT'] = (commandScore['CORRECT'] || 0) + 5;
        }

        const p2Item = P2_CHECKLIST.find(i => i.id === id);
        if (p2Item) {
            trapScore[p2Item.implies] = (trapScore[p2Item.implies] || 0) + 1;
        }
    });

    let bestCommand = 'CORRECT';
    let maxCmdScore = 0;
    Object.entries(commandScore).forEach(([cmd, score]) => {
        if (score > maxCmdScore) {
            maxCmdScore = score;
            bestCommand = cmd;
        }
    });

    let bestTrap = 'A2';
    let maxTrapScore = 0;
    let totalTrapChecks = 0;
    
    Object.entries(trapScore).forEach(([trap, score]) => {
        totalTrapChecks += score;
        if (score > maxTrapScore) {
            maxTrapScore = score;
            bestTrap = trap;
        }
    });
    
    const confidence = totalTrapChecks > 0 ? Math.round((maxTrapScore / totalTrapChecks) * 100) : 0;

    return {
        suggestedCommand: bestCommand,
        suggestedTrap: bestTrap,
        confidence,
        hasP1Check: Object.keys(commandScore).length > 0,
        hasP2Check: totalTrapChecks > 0
    };
};

export const GUIDE_CONTENT: Record<string, TrapscanGuide> = {
    'T': {
        concept: "A resposta depende de identificar a palavra exata do artigo (vedado, somente, salvo). A banca troca o sentido alterando um único termo.",
        pattern: "Você erra quando a banca troca: 'é vedado' ↔ 'é permitido' ou remove um 'somente'.",
        triggers: ["vedado", "somente", "apenas", "exclusivamente", "em qualquer hipótese"],
        method: ["P1: Comando", "P3: Âncora literal", "Procure a palavra no texto", "Elimine 2 alternativas com troca de verbo (pode/deve)"],
        training: ["10 min: 5 lacunas + 10 questões T", "30 min: 20 questões + revisão de âncoras", "1 dia: Rebatida SRS T"],
        kpi: "Acurácia de âncora literal (P3)"
    },
    'R': {
        concept: "A questão cobra a exceção à regra. O erro acontece ao aplicar a regra geral em um caso especial.",
        pattern: "Você acerta a regra geral mas erra o caso específico do 'Salvo' ou 'Ressalvado'.",
        triggers: ["salvo", "exceto", "ressalvado", "em regra", "independentemente"],
        method: ["P1: Identificar se pede Regra ou Exceção", "P2: Marcar R", "Procurar o caso especial no texto"],
        training: ["10 min: 10 questões com 'Salvo'", "30 min: Mapear exceções do art. 5º", "1 dia: Simulado curto de exceções"],
        kpi: "Taxa de acerto em exceções"
    },
    'N': {
        concept: "Erro de atenção no comando negativo. Você marca a correta quando a questão pede a INCORRETA.",
        pattern: "Erros por desatenção, marcando a letra A (que está certa) quando o comando pedia o erro.",
        triggers: ["incorreta", "não", "exceto", "falso", "errada"],
        method: ["P1: Circular GIGANTE o 'NÃO'", "Escrever F ao lado das erradas", "Marcar a única F"],
        training: ["10 min: 10 questões 'Incorreta'", "30 min: Treino de P1 reverso", "1 dia: Simulado 'Caça-Erro'"],
        kpi: "Comando correto (P1)"
    },
    'A': {
        concept: "Troca de competência ou sujeito. Quem faz o quê? (União x Estado, Juiz x MP).",
        pattern: "Confundir competência privativa com concorrente ou trocar o órgão responsável.",
        triggers: ["compete", "privativo", "exclusivo", "cabe ao", "autoridade"],
        method: ["P2: Marcar A", "P3: Quem é o sujeito?", "Verificar se a ação cabe a esse sujeito"],
        training: ["10 min: 8 questões 'quem faz o quê'", "30 min: Tabela de competências", "1 dia: Rebatida de sujeitos"],
        kpi: "Acurácia de competência"
    },
    'P': {
        concept: "Erro numérico. Prazos, datas, quóruns ou porcentagens.",
        pattern: "Troca de dias úteis por corridos, ou meses por anos.",
        triggers: ["dias", "meses", "anos", "prazo", "até"],
        method: ["P2: Marcar P", "Isolar o número", "Validar apenas o número nas opções"],
        training: ["10 min: Tabela de prazos rápida", "30 min: 20 questões de prazo", "1 dia: Flashcards de números"],
        kpi: "Acerto numérico"
    },
    'S': {
        concept: "Erro semântico ou conceitual. Definições parecidas (Taxa x Tarifa, Dolo x Culpa).",
        pattern: "Confusão entre conceitos vizinhos.",
        triggers: ["conceito", "define-se", "natureza jurídica", "significa"],
        method: ["P2: Marcar S", "Definir o conceito antes de ler as opções", "Buscar palavras-chave exclusivas"],
        training: ["10 min: Diferenciar Pode/Deve", "30 min: 10 questões de conceito", "1 dia: Mapa mental de definições"],
        kpi: "Precisão conceitual"
    },
    'C': {
        concept: "Conflito Jurisprudencial. A lei diz X, o STF diz Y.",
        pattern: "Responder com a letra da lei em questão que pede entendimento sumulado.",
        triggers: ["STF", "STJ", "Súmula", "Entendimento", "Doutrina"],
        method: ["P1: Pede Lei ou Juris?", "P2: Marcar C", "Lembrar da Súmula Vinculante"],
        training: ["10 min: 5 Súmulas recentes", "30 min: Questões de Informativos", "1 dia: Leitura de Jurisprudência"],
        kpi: "Atualização Jurisprudencial"
    },
    'A2': {
        concept: "Armadilha de Alternativas. Distratores genéricos, cascas de banana.",
        pattern: "Cair no distrator que parece certo mas tem uma palavra errada no final.",
        triggers: ["todas", "nenhuma", "apenas"],
        method: ["P4: Eliminação", "Ler até a última palavra", "Comparar A com B"],
        training: ["10 min: 10 questões com distratores", "30 min: Forçar eliminação P4", "1 dia: Simulado Hard"],
        kpi: "Taxa de eliminação (P4)"
    },
    'SEM_DADO': {
        concept: "Questão não classificada.",
        pattern: "Sem padrão definido.",
        triggers: [],
        method: ["Classificar a questão"],
        training: ["Atualizar cadastro"],
        kpi: "Classificação"
    }
};

export const TRIGGER_WORDS = {
    EXCEPTION: { 
        label: 'EXCEÇÃO / RESSALVA', 
        words: ['exceto', 'salvo', 'ressalvado', 'desde que', 'quando', 'caso', 'se', 'apenas se', 'somente se'],
        color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        advice: 'Verifique se a alternativa aplica a regra geral onde deveria ser exceção.'
    },
    CONCESSION: { 
        label: 'CONCESSÃO', 
        words: ['ainda que', 'mesmo que', 'independentemente de', 'não obstante', 'sem prejuízo de'],
        color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
        advice: 'O termo indica que a condição NÃO impede a regra. Cuidado com inversões.'
    },
    RESTRICTION: { 
        label: 'RESTRIÇÃO / CONDIÇÃO', 
        words: ['somente', 'apenas', 'exclusivamente', 'exclusivamente quando', 'limitado a', 'restrito a'],
        color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        advice: 'Restringe demais? Verifique se a lei permite outras hipóteses.'
    },
    ABSOLUTE: { 
        label: 'ABSOLUTIZAÇÃO', 
        words: ['sempre', 'nunca', 'em qualquer caso', 'em nenhuma hipótese', 'obrigatoriamente', 'necessariamente'],
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        advice: 'Alta chance de erro. Procure uma única exceção para invalidar.'
    },
    LITERALNESS: { 
        label: 'LITERALIDADE', 
        words: ['nos termos de', 'conforme', 'de acordo com', 'na forma de', 'como dispõe'],
        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        advice: 'Exige texto exato. Não use lógica ou jurisprudência aqui.'
    },
    COMPETENCE: { 
        label: 'COMPETÊNCIA', 
        words: ['compete', 'é de competência', 'cabe a', 'incumbe a', 'é privativo de'],
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        advice: 'Verifique se o sujeito (órgão/ente) está correto para esta ação.'
    }
};

export const P4_SCRIPT = [
    {
        id: 'b1',
        label: 'NEGATIVIDADE & EXCEÇÃO',
        category: 'EXCEPTION',
        questions: [
            { id: 'p4_b1_1', text: 'Há negação explícita? (NÃO / EXCETO / SALVO)' },
            { id: 'p4_b1_2', text: 'Há estrutura de exceção ou ressalva?' },
            { id: 'p4_b1_3', text: 'A exceção restringe a regra OU confirma a regra geral?' }
        ]
    },
    {
        id: 'b2',
        label: 'CONCESSÃO',
        category: 'CONCESSION',
        questions: [
            { id: 'p4_b2_1', text: 'Existe termo concessivo? (ainda que / mesmo que)' },
            { id: 'p4_b2_2', text: 'Esse termo indica que a condição NÃO impede a regra?' },
            { id: 'p4_b2_3', text: 'Alguma alternativa tratou esse termo como impeditivo?' }
        ]
    },
    {
        id: 'b3',
        label: 'RESTRIÇÃO / CONDIÇÃO',
        category: 'RESTRICTION',
        questions: [
            { id: 'p4_b3_1', text: 'Há termo restritivo? (somente / apenas)' },
            { id: 'p4_b3_2', text: 'A alternativa ampliou o alcance além do termo?' },
            { id: 'p4_b3_3', text: 'Alguma alternativa ignorou a condição?' }
        ]
    },
    {
        id: 'b4',
        label: 'ABSOLUTIZAÇÃO',
        category: 'ABSOLUTE',
        questions: [
            { id: 'p4_b4_1', text: 'Há termo absoluto? (sempre / nunca)' },
            { id: 'p4_b4_2', text: 'O texto legal realmente autoriza absolutização?' },
            { id: 'p4_b4_3', text: 'Alternativas absolutas sem base devem ser eliminadas?' }
        ]
    },
    {
        id: 'b5',
        label: 'LITERALIDADE',
        category: 'LITERALNESS',
        questions: [
            { id: 'p4_b5_1', text: 'A questão exige leitura literal?' },
            { id: 'p4_b5_2', text: 'Alguma alternativa alterou verbo ou sujeito?' },
            { id: 'p4_b5_3', text: 'Há paráfrase enganosa com sentido diferente?' }
        ]
    },
    {
        id: 'b6',
        label: 'COMPETÊNCIA / AUTORIDADE',
        category: 'COMPETENCE',
        questions: [
            { id: 'p4_b6_1', text: 'Existe verbo de competência? (compete, cabe)' },
            { id: 'p4_b6_2', text: 'O ente/órgão está correto conforme o texto?' },
            { id: 'p4_b6_3', text: 'Alguma alternativa trocou o sujeito competente?' }
        ]
    }
];

export interface FoundTrigger {
    word: string;
    category: keyof typeof TRIGGER_WORDS;
    advice: string;
    color: string;
}

export function scanForTriggers(text: string): FoundTrigger[] {
    const found: FoundTrigger[] = [];
    const normalizedText = text.toLowerCase();

    Object.entries(TRIGGER_WORDS).forEach(([catKey, config]) => {
        config.words.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(normalizedText)) {
                if (!found.some(f => f.word === word)) {
                    found.push({
                        word,
                        category: catKey as any,
                        advice: config.advice,
                        color: config.color
                    });
                }
            }
        });
    });

    return found;
}

export const normalizeText = (s: string): string => {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .trim()
        .replace(/\s+/g, " "); // collapse spaces
};

export const tokenize = (s: string): Set<string> => {
    const stopWords = new Set(["a", "o", "as", "os", "de", "da", "do", "em", "para", "por", "com", "que", "um", "uma"]);
    const tokens = normalizeText(s)
        .replace(/[.,;:\-()"]/g, "") // remove punctuation
        .split(" ")
        .filter(t => t.length > 2 && !stopWords.has(t));
    return new Set(tokens);
};

export const calculateJaccardSimilarity = (s1: string, s2: string): number => {
    const t1 = tokenize(s1);
    const t2 = tokenize(s2);
    if (t1.size === 0 || t2.size === 0) return 0;

    let intersection = 0;
    t1.forEach(token => { if (t2.has(token)) intersection++; });
    
    const union = t1.size + t2.size - intersection;
    return intersection / union;
};

export const checkAlternativeSimilarity = (options: Record<string, string | undefined>): boolean => {
    const opts = Object.values(options).filter((o): o is string => !!o);
    if (opts.length < 2) return false;

    let totalSim = 0;
    let comparisons = 0;
    let maxSim = 0;

    for (let i = 0; i < opts.length; i++) {
        for (let j = i + 1; j < opts.length; j++) {
            // FIX (Error 8): TS2365 - Ensure numbers are finite and safe for comparison
            // Wait, this is similarity logic, returns 0-1.
            const sim = calculateJaccardSimilarity(opts[i], opts[j]);
            
            // Safe number check
            if (Number.isFinite(sim)) {
                totalSim += sim;
                if (sim > maxSim) maxSim = sim;
            }
            comparisons++;
        }
    }
    
    const avg = comparisons > 0 ? totalSim / comparisons : 0;
    
    // FIX (Error 8): Comparison logic using toNumber helper
    const safeAvg = toNumber(avg) ?? 0;
    const safeMax = toNumber(maxSim) ?? 0;

    return safeAvg > 0.55 || safeMax > 0.70;
};

// --- PRIORITY ENGINE & AXIS GEAR (New Logic) ---

export const runTrapscanAnalysis = (q: Question): TrapscanAutoAnalysis => {
    const qText = normalizeText(q.questionText || "");
    const reasons: string[] = [];
    const triggersFound: string[] = [];
    const axisCandidates: AxisCandidate[] = [];
    
    // 1. COMMAND DETECTION (P1)
    let p1 = 'CORRECT';
    
    const NEGATION_TRIGGERS = ["exceto", "nao", "não", "salvo", "ressalvado", "incorreta", "errada", "incorreto", "errado"];
    const JUDGMENT_TRIGGERS = ["julgue", "certo ou errado", "certo/errado", "assinale se esta correta ou incorreta", "item"];
    
    let alertNegation = false;
    const hasNegation = NEGATION_TRIGGERS.some(t => {
        if (qText.includes(t)) {
            triggersFound.push(t);
            return true;
        }
        return false;
    });

    if (hasNegation && (qText.includes("não é incorreto") || (qText.includes("nao") && qText.includes("incorreta")))) {
        alertNegation = true;
        reasons.push("Dupla negação detectada");
    }

    if (qText.includes("exceto") || (qText.includes("salvo") && qText.includes("exceto"))) {
        p1 = 'EXCEPT';
        reasons.push("Comando de Exceção (exceto/salvo)");
    } else if (qText.includes("incorreta") || qText.includes("errada")) {
        p1 = 'INCORRECT';
        reasons.push("Pede a Incorreta");
    } else if (JUDGMENT_TRIGGERS.some(t => qText.includes(t)) || (q.options?.C === 'Certo' && q.options?.E === 'Errado')) {
        p1 = 'JUDGMENT';
        reasons.push("Formato Julgamento");
    } else {
        p1 = 'CORRECT';
    }

    // 2. KEY QUESTIONS (Axis Gear)
    const keyQuestions = {
        asksWho: /\b(quem|papel|responsavel|atribuicao|compete|cabe a|autoridade)\b/.test(qText),
        asksWhat: /\b(conceito|definicao|significa|proposito|objetivo|caracteriza|natureza)\b/.test(qText),
        asksException: /\b(exceto|salvo|em regra|ressalvado|desde que|somente|nao)\b/.test(qText)
    };

    // 3. TRAP SCORING (Priority Waterfall)
    // Priority: A -> T -> R -> P -> C -> N -> S -> A2
    const scores: Record<string, number> = { A: 0, T: 0, R: 0, P: 0, C: 0, N: 0, S: 0, A2: 0 };
    let decisiveRule = 'A2_GENERIC';

    // A: Authority
    if (keyQuestions.asksWho || ["compete", "cabe", "autoridade", "uniao", "estado", "municipio", "privativo", "exclusivo"].some(t => qText.includes(t))) {
        scores.A += 50;
        axisCandidates.push({ axis: 'A', score: 50, primaryReason: "Pergunta sobre competência/sujeito." });
        decisiveRule = 'A_WHO';
    }

    // T: Text/Definition
    if (keyQuestions.asksWhat || ["conceito", "define", "significa", "proposito", "objetivo", "caracteriza"].some(t => qText.includes(t))) {
        scores.T += 45;
        axisCandidates.push({ axis: 'T', score: 45, primaryReason: "Pergunta sobre definição/conceito." });
        if (scores.A < 50) decisiveRule = 'T_DEFINITION';
    }
    if (checkAlternativeSimilarity(q.options || {})) {
        scores.T += 20;
    }

    // R: Rule/Exception
    if (keyQuestions.asksException || ["em regra", "salvo", "ressalvado", "exceto", "desde que", "somente se"].some(t => qText.includes(t))) {
        scores.R += 40;
        axisCandidates.push({ axis: 'R', score: 40, primaryReason: "Presença de termos de exceção." });
        if (scores.A < 50 && scores.T < 45) decisiveRule = 'R_EXCEPTION';
    }

    // P: Time
    if (["prazo", "dias", "meses", "anos", "contado", "prescricao", "decadencia", "anterioridade", "noventena", "vigencia"].some(t => qText.includes(t))) {
        scores.P += 60; // Very strong signal
        axisCandidates.push({ axis: 'P', score: 60, primaryReason: "Termos explícitos de prazo." });
        decisiveRule = 'P_TIME';
    }

    // C: Jurisprudence
    if (["stf", "stj", "sumula", "tema", "repercussao geral", "jurisprudencia", "entendimento"].some(t => qText.includes(t))) {
        scores.C += 70; // Dominant signal
        axisCandidates.push({ axis: 'C', score: 70, primaryReason: "Citação direta de tribunal/súmula." });
        decisiveRule = 'C_CASELAW';
    }

    // N: Negation
    if (alertNegation) {
        scores.N += 50;
        axisCandidates.push({ axis: 'N', score: 50, primaryReason: "Dupla negação detectada." });
        decisiveRule = 'N_NEGATION';
    }

    // S: Semantics (Modals)
    if (["pode", "deve", "facultado", "obrigatorio", "vedado", "permitido"].some(t => qText.includes(t))) {
        scores.S += 30;
        axisCandidates.push({ axis: 'S', score: 30, primaryReason: "Verbos modais (Pode/Deve)." });
        if (Math.max(scores.A, scores.T, scores.R, scores.P, scores.C) < 30) decisiveRule = 'S_SEMANTIC';
    }

    // A2: Generic Fallback
    const maxOtherScore = Math.max(scores.A, scores.T, scores.R, scores.P, scores.C, scores.N, scores.S);
    if (maxOtherScore < 40) {
        scores.A2 = 40; // Default winner if nothing else is strong
        axisCandidates.push({ axis: 'A2', score: 40, primaryReason: "Sem sinais específicos fortes." });
        decisiveRule = 'A2_GENERIC';
    }

    // Populate "Why Not" reasons
    axisCandidates.forEach(cand => {
        const others = axisCandidates.filter(c => c.axis !== cand.axis);
        cand.whyNotReasons = [];
        if (cand.axis === 'A' && scores.T < 20) cand.whyNotReasons.push("Não foca em definição (T).");
        if (cand.axis === 'T' && scores.A < 20) cand.whyNotReasons.push("Não pergunta 'quem' (A).");
        if (cand.axis === 'A2' && maxOtherScore > 0) cand.whyNotReasons.push("Sinais fracos em outros eixos.");
    });

    // Select Winner
    let bestTrap = 'A2';
    let maxScore = 0;
    Object.entries(scores).forEach(([key, val]) => {
        if (val > maxScore) {
            maxScore = val;
            bestTrap = key;
        }
    });

    // Enforce A2 Logic: Never suggest A2 if strong signal elsewhere
    if (maxOtherScore >= 40) {
        scores.A2 = 0;
        if (bestTrap === 'A2') {
             // Find next best
             const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
             bestTrap = sorted[0][0]; 
        }
    }

    let confidence = 50;
    if (maxScore > 60) confidence += 20;
    if (maxScore < 30) confidence = 30;

    return {
        suggestedCommand: p1,
        suggestedTrap: bestTrap,
        confidence: Math.min(100, confidence),
        reasons: reasons.slice(0, 3),
        scores,
        triggersFound,
        alertNegation,
        axisCandidates: axisCandidates.sort((a,b) => b.score - a.score),
        keyQuestions,
        decisiveRule
    };
};

export type CommandType = 'CORRECT' | 'INCORRECT' | 'EXCEPT' | 'JUDGMENT';

export interface TrapDiagnosis {
    realError: string;
    why: string;
    antidote: string;
    anchorProof: string | null;
}

export function deriveTrapscanRequired(q: Question): { tag: TrapType; label: string; meaning: string } {
    // ... existing implementation
    const techText = q.explanationTech || "";
    const match = techText.match(/(?:TRAPSCAN_EXIGIDO|TRAPSCAN)\s*=\s*([A-Z0-9_]+)/i);
    
    let rawTag = match ? match[1].toUpperCase() : null;

    if (!rawTag && q.guiaTrapscan) {
        const normalized = normalizeTrapscan(q.guiaTrapscan);
        if (normalized.itemLabel && normalized.itemLabel !== '—') {
             rawTag = normalized.itemLabel.toUpperCase();
        }
    }

    if (rawTag) {
        if (rawTag === 'A1') rawTag = 'A'; 
        if (rawTag === 'LITERALIDADE') rawTag = 'T';
        if (rawTag === 'O' || rawTag === 'D') rawTag = 'A2'; 

        if (rawTag in TRAP_REQ_DEFS) {
            const tag = rawTag as TrapType;
            return { tag, ...TRAP_REQ_DEFS[tag] };
        }
    }
    
    const inferred = inferTrap(q);
    if (inferred !== 'SEM_DADO') {
         return { tag: inferred, ...TRAP_REQ_DEFS[inferred] };
    }

    return { tag: 'SEM_DADO', ...TRAP_REQ_DEFS['SEM_DADO'] };
}

export const inferCommand = (q: Question): CommandType => {
    const text = String(q.questionText || "").toUpperCase();
    if (q.questionType?.includes('C/E') || (q.options?.C === 'Certo' && q.options?.E === 'Errado')) {
        return 'JUDGMENT';
    }
    if (text.includes('EXCETO') || text.includes('INCORRETA') || text.includes('SALVO') || text.includes('NÃO É') || text.includes('NÃO SE APLICA') || text.includes('À EXCEÇÃO DE')) {
        if (text.includes('INCORRETA') || text.includes('ERRADA')) return 'INCORRECT';
        return 'EXCEPT';
    }
    if (text.includes('ASSINALE A INCORRETA')) return 'INCORRECT';
    return 'CORRECT';
};

export const inferTrap = (q: Question): TrapType => {
    // 1. Check AI Engine first
    const ai = runTrapscanAnalysis(q);
    if (ai.confidence > 50) return ai.suggestedTrap as TrapType;

    // 2. Fallback
    // FIX (Error 8): Use getText to fix TS2322 (string | Record not string)
    const rawGuide = q.guiaTrapscan || q.wrongDiagnosis || "";
    const trapGuide = String(getText(rawGuide)).toUpperCase();

    if (trapGuide.includes('P3') || trapGuide.includes('ÂNCORA') || trapGuide.includes('ANCORA')) return 'T';
    
    return 'A2'; 
};

export const extractAnchor = (q: Question, trap: TrapType): string | null => {
    // FIX: Using getText for anchorText
    const anchorText = getText(q.anchorText);
    if (anchorText && anchorText.length > 2) return anchorText;
    
    const text = q.questionText.toLowerCase();
    const triggers = TRAP_REQ_DEFS[trap]?.triggers || [];
    for (const trigger of triggers) {
        if (text.includes(trigger)) {
            const index = text.indexOf(trigger);
            const start = Math.max(0, index - 20);
            const end = Math.min(text.length, index + trigger.length + 30);
            return `"...${q.questionText.substring(start, end).trim()}..."`;
        }
    }
    return null;
};

// ... (Other helpers kept unchanged) ...
export const getTrapMismatchDiagnosis = (
    userTrap: string, 
    actualTrap: TrapType, 
    q: Question
): TrapDiagnosis => {
    // ... same as before
    const userLabel = TRAP_REQ_DEFS[userTrap]?.label || userTrap;
    const actualLabel = TRAP_REQ_DEFS[actualTrap]?.label || actualTrap;
    const anchor = extractAnchor(q, actualTrap);

    const result: TrapDiagnosis = {
        realError: `Você tratou como ${userTrap} (${userLabel}), mas a questão exigia ${actualTrap} (${actualLabel}).`,
        why: `O núcleo da questão estava em ${actualLabel.toLowerCase()}, não em ${userLabel.toLowerCase()}.`,
        antidote: TRAP_REQ_DEFS[actualTrap]?.advice || "Releia com atenção ao núcleo.",
        anchorProof: anchor
    };
    return result;
};

export interface TrapscanValidation {
    p1: { isCorrect: boolean; chosen: string; expected: CommandType; };
    p2: { isCorrect: boolean; chosen: string; expected: TrapType; diagnosis: TrapDiagnosis; };
}

export const validateTrapscan = (q: Question, userEntry: TrapscanEntry): TrapscanValidation => {
    const expectedCommand = inferCommand(q);
    const expectedTrap = deriveTrapscanRequired(q).tag;
    const userCommand = userEntry.command || 'SKIPPED';
    const p1Correct = userCommand === expectedCommand;
    const userTrap = userEntry.trapType || 'SKIPPED';
    const p2Correct = userTrap === expectedTrap;
    const diagnosis = getTrapMismatchDiagnosis(userTrap, expectedTrap, q);

    return {
        p1: { isCorrect: p1Correct, chosen: userCommand, expected: expectedCommand },
        p2: { isCorrect: p2Correct, chosen: userTrap, expected: expectedTrap, diagnosis }
    };
};

const getRecencyWeight = (dateStr: string, now: Date): number => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 0.5;
    const diffDays = Math.ceil(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return 1.0; 
    if (diffDays <= 7) return 0.8;
    if (diffDays <= 30) return 0.5;
    return 0.2;
};

const calculateTrapMetrics = (questions: Question[], cutoffDate: Date, now: Date) => {
    const stats: Record<string, { errors: number, weightedErrors: number, total: number, lastDate: string }> = {};
    const evidence: Record<string, Question[]> = {};
    
    Object.keys(TRAP_REQ_DEFS).forEach(key => {
        stats[key] = { errors: 0, weightedErrors: 0, total: 0, lastDate: '' };
        evidence[key] = [];
    });
    
    questions.forEach(q => {
        const trapInfo = deriveTrapscanRequired(q);
        const trapType = trapInfo.tag;
        const attempts = (q.attemptHistory || []).filter(a => new Date(a.date) >= cutoffDate);
        
        attempts.forEach(att => {
            const weight = getRecencyWeight(att.date, now);
            if (stats[trapType]) stats[trapType].total++;
            
            if (!att.wasCorrect) {
                if (stats[trapType]) {
                    stats[trapType].errors++;
                    stats[trapType].weightedErrors += weight;
                    if (att.date > stats[trapType].lastDate) stats[trapType].lastDate = att.date;
                    
                    const existingEv = evidence[trapType].find(eq => eq.id === q.id);
                    if (!existingEv) {
                        evidence[trapType].unshift(q);
                        if (evidence[trapType].length > 5) evidence[trapType].pop();
                    }
                }
            }
        });
    });
    
    return { stats, evidence };
};

const computeMetric = (correct: number, total: number, minSample: number = 5): number | null => {
    if (total < minSample) return null;
    return (correct / total) * 100;
};

export const calculateTrapscanQuality = (q: Question, entry: TrapscanEntry): TrapscanQualityMetrics => {
    const eliminated = entry.eliminatedOptions || [];
    const correct = q.correctAnswer;
    const totalWrong = Object.keys(q.options || {}).length - 1; 
    
    const didEliminateCorrect = eliminated.includes(correct);
    
    const wrongEliminated = eliminated.filter(opt => opt !== correct).length;
    const efficiency = totalWrong > 0 ? wrongEliminated / totalWrong : 1;
    
    const userAns = (entry as any).userAnswer || q.yourAnswer;
    const isCorrect = userAns === correct;
    const isLuckyGuess = isCorrect && eliminated.length === 0;
    
    const scriptChecks = entry.scriptChecks || [];
    const adherenceScore = Math.min(1, scriptChecks.length / 4); 
    
    let processRating: 'PERFECT' | 'RISKY' | 'FAILED' | 'GOOD' = 'GOOD';
    
    if (isLuckyGuess) processRating = 'RISKY';
    else if (didEliminateCorrect) processRating = 'FAILED';
    else if (efficiency >= 0.75 && isCorrect) processRating = 'PERFECT';
    else if (!isCorrect) processRating = 'FAILED';
    
    return {
        eliminationEfficiency: efficiency,
        didEliminateCorrect,
        isLuckyGuess,
        adherenceScore,
        processRating
    };
};

const calculateDeepMetrics = (questions: Question[], cutoffDate: Date) => {
    let p1CorrectCount = 0;
    let p1Base = 0;
    
    let p2CorrectCount = 0;
    let p2Base = 0;
    
    let eliminationCount = 0;
    
    let deepTotal = 0;
    
    let operationalErrors = 0;
    let conceptualErrors = 0;
    
    questions.forEach(q => {
        const attempts = (q.attemptHistory || []).filter(a => new Date(a.date) >= cutoffDate);
        attempts.forEach(a => {
            if (a.trapscanData) {
                deepTotal++;
                
                if (a.trapscanData.command) p1Base++;
                if (a.trapscanData.trapType) p2Base++;
                
                const valid = validateTrapscan(q, a.trapscanData);
                
                if (valid.p1.isCorrect && a.trapscanData.command) p1CorrectCount++;
                if (valid.p2.isCorrect && a.trapscanData.trapType) p2CorrectCount++;
                
                const elims = a.trapscanData.eliminatedOptions || [];
                if (elims.length >= 1) eliminationCount++;
                
                if (!a.wasCorrect) {
                     if ((a.trapscanData.command && !valid.p1.isCorrect) || (a.trapscanData.trapType && !valid.p2.isCorrect)) {
                         operationalErrors++;
                     } else {
                         conceptualErrors++;
                     }
                }
            } else if (!a.wasCorrect) {
                conceptualErrors++; 
            }
        });
    });
    
    const dominance: 'OPERATIONAL' | 'CONCEPTUAL' = operationalErrors > conceptualErrors ? 'OPERATIONAL' : 'CONCEPTUAL';
    
    return {
        p1Accuracy: computeMetric(p1CorrectCount, p1Base),
        p2Accuracy: computeMetric(p2CorrectCount, p2Base),
        eliminationRate: computeMetric(eliminationCount, deepTotal), 
        dataConsistency: deepTotal > 0 ? Math.round((deepTotal / questions.length) * 100) : 0, 
        failureDominance: dominance
    };
};

const generatePlan = (weakestTrap: TrapType, currentScore: number): TrapscanPlan => {
    const def = TRAP_REQ_DEFS[weakestTrap];
    const targetScore = Math.min(100, currentScore + 30);
    const guide = GUIDE_CONTENT[weakestTrap] || GUIDE_CONTENT['SEM_DADO'];
    
    const steps = guide.training.slice(0, 3);
    
    return {
        axis: weakestTrap,
        label: def.label,
        objective: `Subir score de ${currentScore.toFixed(0)} para ${targetScore.toFixed(0)}`,
        cause: def.meaning,
        steps,
        targetCount: 25,
        estimatedTime: '10 min'
    };
};

export const analyzeTrapscan = (
  questions: Question[],
  cards: LiteralnessCard[],
  settings: AppSettings,
  periodDays: number = 30
): TrapscanReport & { evidence: Record<string, Question[]> } => {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const prevCutoffDate = new Date(cutoffDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const { stats: statsCurrent, evidence } = calculateTrapMetrics(questions, cutoffDate, now);
    
    const { stats: statsPrev } = calculateTrapMetrics(questions, prevCutoffDate, cutoffDate);
    
    const deepMetrics = calculateDeepMetrics(questions, cutoffDate);

    const nucleusStats: Record<string, NucleusStats> = {};
    const subjectStats: Record<string, number> = {};
    let totalAttemptsCount = 0;
    let totalCorrect = 0;
    let masterySum = 0;
    let questionsWithAttempts = 0;
    
    questions.forEach(q => {
        const litRef = srs.canonicalizeLitRef(q.lawRef || q.litRef || 'GERAL');
        const relevantAttempts = (q.attemptHistory || []).filter(a => new Date(a.date) >= cutoffDate);
        
        if (!nucleusStats[litRef]) {
             nucleusStats[litRef] = {
                 litRef, lawId: q.subject, topic: q.topic || 'Geral', totalAttempts: 0, errorCount: 0,
                 errorRate: 0, riskScore: 0, topSignal: 'SEM_DADO', lastAttemptAt: '', lastErrorAt: null
             };
        }
        
        if (q.totalAttempts > 0) {
             questionsWithAttempts++;
             masterySum += srs.calculateCurrentDomain(q, settings);
        }
        
        relevantAttempts.forEach(att => {
             totalAttemptsCount++;
             if (att.wasCorrect) totalCorrect++;
             else {
                 nucleusStats[litRef].errorCount++;
                 nucleusStats[litRef].riskScore += 10; 
                 subjectStats[q.subject] = (subjectStats[q.subject] || 0) + 1;
             }
             nucleusStats[litRef].totalAttempts++;
        });
    });

    const signals: TrapSignal[] = Object.entries(statsCurrent)
        .filter(([key]) => key !== 'SEM_DADO' || statsCurrent[key].errors > 0)
        .map(([code, data]) => {
            const prevData = statsPrev[code];
            const errorRate = data.total > 0 ? (data.weightedErrors / data.total) : 0;
            const frequency = data.total;
            const difficultyWeight = 1.5; 
            
            const rawRisk = errorRate * Math.log(frequency + 1) * difficultyWeight * 100;
            const riskScore = Math.min(100, Math.round(rawRisk));
            
            const prevRate = prevData.total > 0 ? (prevData.weightedErrors / prevData.total) * 100 : 0;
            const riskTrend = Math.round(riskScore - prevRate); 

            const confidence = Math.min(100, (data.total / 10) * 100); 

            let severity: 'low' | 'medium' | 'high' = 'low';
            if (riskScore > 40) severity = 'high';
            else if (riskScore > 15) severity = 'medium';

            const def = TRAP_REQ_DEFS[code] || TRAP_REQ_DEFS['SEM_DADO'];

            return {
                id: code,
                code: code as any,
                label: def.label,
                description: def.meaning,
                advice: def.advice,
                riskScore,
                riskTrend,
                totalAttempts: data.total,
                errorCount: data.errors,
                lastErrorAt: data.lastDate || null,
                severity,
                trend: riskTrend > 0 ? 'worsening' : riskTrend < 0 ? 'improving' : 'stable',
                confidence
            };
    });
    
    const sortedSignals = signals.sort((a, b) => b.riskScore - a.riskScore);
    const weakestSignal = sortedSignals[0];
    
    const vulnerabilities: VulnerabilityStats[] = sortedSignals.slice(0, 3).map(sig => {
        const sampleQ = evidence[sig.code]?.[0];
        let realError = undefined;
        
        if (sampleQ) {
             const userLast = sampleQ.attemptHistory[sampleQ.attemptHistory.length - 1];
             const tsData = userLast?.trapscanData;
             const validation = tsData ? validateTrapscan(sampleQ, tsData) : null;
             
             realError = {
                 userChoice: { 
                     p1: validation?.p1.chosen || '—', 
                     p2: validation?.p2.chosen || '—' 
                 },
                 correctChoice: { 
                     p1: inferCommand(sampleQ), 
                     p2: deriveTrapscanRequired(sampleQ).tag 
                 },
                 anchor: extractAnchor(sampleQ, sig.code as TrapType) || '—',
                 why: validation?.p2.diagnosis.why || TRAP_REQ_DEFS[sig.code].meaning
             };
        }

        return {
            code: sig.code,
            label: sig.label,
            riskScore: sig.riskScore,
            errorRate: sig.errorCount / (sig.totalAttempts || 1),
            sampleSize: sig.totalAttempts,
            realError
        };
    });
    
    const diagnosticSummary: DiagnosticSummary = {
        situation: weakestSignal ? `Você está errando mais em ${weakestSignal.label} (${weakestSignal.code}).` : "Sem padrão de erro significativo (amostra pequena).",
        cause: weakestSignal ? (deepMetrics.failureDominance === 'OPERATIONAL' ? "Falha técnica: Pulo do P3/Recorte." : "Falha conceitual: Desconhecimento da regra.") : "Continue treinando para gerar dados.",
        impact: weakestSignal ? "Isso derruba questões fáceis e médias, reduzindo acurácia." : "Mantenha a constância."
    };

    const recommendedPlan = (weakestSignal && weakestSignal.riskScore > 20) 
        ? generatePlan(weakestSignal.code as TrapType, 100 - weakestSignal.riskScore) 
        : null;

    const nucleiList = Object.values(nucleusStats).map(n => ({
        ...n,
        errorRate: n.totalAttempts > 0 ? (n.errorCount / n.totalAttempts) * 100 : 0,
        riskScore: Math.min(100, n.riskScore)
    })).sort((a,b) => b.riskScore - a.riskScore);

    const topSubject = Object.entries(subjectStats).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    
    const accuracyQuestions = totalAttemptsCount > 0 ? (totalCorrect / totalAttemptsCount) * 100 : null;

    return {
        period: periodDays,
        kpis: {
            totalAttempts: totalAttemptsCount,
            accuracyQuestions: accuracyQuestions,
            avgMastery: questionsWithAttempts > 0 ? (masterySum / questionsWithAttempts) : 0,
            topErrorSubject: topSubject,
            riskSubject: topSubject,
            topErrorLitRef: nucleiList.find(n => n.errorCount > 0)?.topic || '—',
            p1Accuracy: deepMetrics.p1Accuracy,
            p2Accuracy: deepMetrics.p2Accuracy,
            eliminationRate: deepMetrics.eliminationRate,
            dataConsistency: deepMetrics.dataConsistency,
            failureDominance: deepMetrics.failureDominance
        },
        signals: sortedSignals,
        weakestNuclei: nucleiList,
        focusSuggestion: weakestSignal?.advice || 'Mantenha a constância.',
        evidence,
        recommendedPlan,
        diagnostic: diagnosticSummary,
        vulnerabilities,
        guides: GUIDE_CONTENT
    };
};

export const detectTrapFailure = (q: Question, userAnswer: string): string | null => {
    const correct = q.correctAnswer;
    if (userAnswer === correct) return null;
    const trap = deriveTrapscanRequired(q);
    return trap.tag;
};
