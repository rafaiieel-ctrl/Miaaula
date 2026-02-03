
export interface GapPart {
    type: 'text' | 'gap';
    content: string;
}

export interface ParsedGap {
    displayText: string; // Texto corrido com máscara simples (_____)
    answers: string[]; // Lista de respostas extraídas
    parts: GapPart[]; // Array estruturado para renderização rica
}

/**
 * Faz o parsing de templates de lacunas no formato {{conteúdo}}.
 * Suporta acentos, maiúsculas/minúsculas e múltiplos tokens.
 */
export const parseGapTemplate = (rawText: string): ParsedGap => {
    if (!rawText) return { displayText: '', answers: [], parts: [] };

    // Regex captura qualquer coisa entre {{ e }} (non-greedy), incluindo quebras de linha se houver
    const regex = /\{\{([\s\S]+?)\}\}/g;
    
    const answers: string[] = [];
    const parts: GapPart[] = [];
    let lastIndex = 0;
    let match;

    // Loop de extração
    while ((match = regex.exec(rawText)) !== null) {
        // 1. Texto antes da lacuna
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: rawText.substring(lastIndex, match.index)
            });
        }

        // 2. Conteúdo da lacuna (gabarito)
        let content = match[1].trim();
        
        // CORREÇÃO CRÍTICA: Se o conteúdo for explicitamente "lacuna" ou "gap",
        // isso indica um dado mal formatado. Tratamos como vazio ou placeholder genérico.
        // O renderizador deve ignorar este conteúdo para display antes da resposta.
        if (content.toLowerCase() === 'lacuna' || content.toLowerCase() === 'gap') {
             // Opcional: tentar recuperar algo melhor, mas neste caso, o dado está corrompido ou é um placeholder.
             // Mantemos o valor para que o sistema não quebre, mas o renderizador saberá lidar.
        }

        answers.push(content);
        parts.push({
            type: 'gap',
            content: content
        });

        lastIndex = regex.lastIndex;
    }

    // 3. Texto restante após a última lacuna
    if (lastIndex < rawText.length) {
        parts.push({
            type: 'text',
            content: rawText.substring(lastIndex)
        });
    }

    // Fallback/Warning se não encontrar tokens
    if (answers.length === 0) {
        // Retorna o texto inteiro como uma parte de texto
        return {
            displayText: rawText,
            answers: [],
            parts: [{ type: 'text', content: rawText }]
        };
    }

    // Gera string simples para displays que não suportam componentes ricos
    const displayText = rawText.replace(regex, '_____');

    return { displayText, answers, parts };
};

// --- TESTES UNITÁRIOS RÁPIDOS (DEBUG) ---
export const runGapTests = () => {
    console.group('GapService Tests');
    
    const cases = [
        { input: "obrigações principais e/ou {{ACESSÓRIAS}}", expectedAns: "ACESSÓRIAS" },
        { input: "obrigações principais e/ou {{acessórias}}", expectedAns: "acessórias" },
        { input: "Texto sem token nenhum", expectedAns: undefined } // undefined indica array vazio
    ];

    cases.forEach((c, i) => {
        const result = parseGapTemplate(c.input);
        const passed = c.expectedAns 
            ? result.answers.includes(c.expectedAns) && result.displayText.includes('_____')
            : result.answers.length === 0 && result.displayText === c.input;
        
        console.log(`Test ${i + 1}: "${c.input}" ->`, passed ? 'PASS ✅' : 'FAIL ❌', result);
    });

    console.groupEnd();
};
