
import React, { useState, useRef } from 'react';
import { useQuestionDispatch, useQuestionState } from '../../../contexts/QuestionContext';
import { Question, ImportMode } from '../../../types';
import * as srs from '../../../services/srsService';
import { useSettings } from '../../../contexts/SettingsContext';
import { UploadIcon, ClipboardListIcon, CheckCircleIcon, BoltIcon, ExclamationTriangleIcon } from '../../../components/icons';
import { parseQuestionText } from '../../../services/questionParser';
import { normalizeDiscipline } from '../../../services/taxonomyService';

interface ImportTxtTabProps {
  setActiveTab: (tab: 'list') => void;
}

interface ParsedResult {
    newQuestions: Omit<Question, 'id'>[];
    duplicates: string[];
    errors: { blockNumber: number, text: string, message: string }[];
}

const ImportTxtTab: React.FC<ImportTxtTabProps> = ({ setActiveTab }) => {
    const { addBatchQuestions } = useQuestionDispatch();
    const allQuestions = useQuestionState();
    const { settings } = useSettings();
    const [text, setText] = useState('');
    const [analysis, setAnalysis] = useState<ParsedResult | null>(null);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importMode, setImportMode] = useState<ImportMode>('MERGE');

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setText(content);
            setAnalysis(null); 
        };
        reader.readAsText(file);
        event.target.value = ''; 
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    // --- NORMALIZADOR DE CHAVES ---
    const normalizeKey = (rawKey: string): string => {
        return rawKey.trim().toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
            .replace(/[^A-Z0-9_]/g, "_") 
            .replace(/_+/g, "_"); 
    };

    // --- SECTION-AWARE PARSER ---
    const parseBlock = (block: string): Partial<Question> & { answer?: string, bankStyle?: string, hot?: string, crit?: string, fund?: string } => {
        const lines = block.split('\n');
        
        // Initial State
        const result: any = { options: {}, distractorProfile: {}, wrongDiagnosisMap: {} };
        let currentSection: 'METADATA' | 'OPTIONS' | 'PROFILE' | 'DIAGNOSIS' = 'METADATA';
        let lastKey: string | null = null;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // 1. Detect Section Headers
            if (/^(DISTRACTOR_PROFILE|PERFIL_DISTRATORES)[:=]/i.test(trimmed)) { 
                const content = trimmed.replace(/^(DISTRACTOR_PROFILE|PERFIL_DISTRATORES)[:=]\s*/i, '').trim();
                if (content.length > 0) {
                    // Try to parse inline: A=X | B=Y
                    const parts = content.split('|');
                    parts.forEach(p => {
                        const m = p.trim().match(/^([A-E])\s*=\s*(.*)$/);
                        if (m) result.distractorProfile[m[1]] = m[2];
                    });
                    currentSection = 'METADATA'; 
                } else {
                    currentSection = 'PROFILE'; 
                }
                return; 
            }

            if (/^(WRONG_DIAGNOSIS_MAP|MAPA_ERRO)[:=]/i.test(trimmed)) { 
                const content = trimmed.replace(/^(WRONG_DIAGNOSIS_MAP|MAPA_ERRO)[:=]\s*/i, '').trim();
                if (content.length > 0) {
                    // Try to parse inline: A=X || B=Y (Double pipe is safer for this field)
                    const parts = content.includes('||') ? content.split('||') : content.split('|');
                    parts.forEach(p => {
                         const m = p.trim().match(/^([A-E])\s*=\s*(.*)$/);
                         if (m) result.wrongDiagnosisMap[m[1]] = m[2];
                    });
                    currentSection = 'METADATA';
                } else {
                    currentSection = 'DIAGNOSIS'; 
                }
                return; 
            }

            if (/^(Q_TEXT|QUESTION_TEXT|ENUNCIADO)[:=]/i.test(trimmed)) {
                const textContent = trimmed.replace(/^(Q_TEXT|QUESTION_TEXT|ENUNCIADO)[:=]\s*/i, '');
                result.Q_TEXT = textContent;
                currentSection = 'OPTIONS';
                lastKey = 'Q_TEXT';
                return;
            }
            if (/^(CORRECT|ANSWER|GABARITO)[:=]/i.test(trimmed)) {
                currentSection = 'METADATA'; 
            }

            // 2. Handle Options / Map Entries
            if (currentSection === 'DIAGNOSIS') {
                const wdMatch = trimmed.match(/^(?:WD_|WDMAP_)?([A-E])[:=\)\-]\s*(.*)$/);
                if (wdMatch) {
                    result.wrongDiagnosisMap[wdMatch[1]] = wdMatch[2];
                    lastKey = `DIAG_${wdMatch[1]}`; 
                    return;
                }
            }

            const optionMatch = trimmed.match(/^([A-E])[:=\)\-]\s*(.*)$/);

            if (optionMatch) {
                const letter = optionMatch[1];
                const content = optionMatch[2];

                if (currentSection === 'PROFILE') {
                    result.distractorProfile[letter] = content;
                    lastKey = `PROF_${letter}`;
                } else if (currentSection === 'DIAGNOSIS') {
                    result.wrongDiagnosisMap[letter] = content;
                    lastKey = `DIAG_${letter}`;
                } else {
                    if (!content.startsWith('WD_') && !content.includes('|')) {
                         result.options[letter] = content;
                         lastKey = `OPT_${letter}`;
                    }
                }
                return;
            }

            // 3. Handle General Metadata Keys
            const keyMatch = trimmed.match(/^([A-Za-z0-9_À-ÿ\s]+):\s*(.*)$/);
            if (keyMatch) {
                const rawKey = keyMatch[1];
                const value = keyMatch[2];
                const normalizedKey = normalizeKey(rawKey);
                
                if (!['DISTRACTOR_PROFILE', 'PERFIL_DISTRATORES', 'WRONG_DIAGNOSIS_MAP', 'MAPA_ERRO', 'Q_TEXT', 'ENUNCIADO'].includes(normalizedKey)) {
                    if (normalizedKey === 'ANSWER' || normalizedKey === 'GABARITO') result.answer = value;
                    else if (normalizedKey === 'BANK_STYLE') result.bankStyle = value;
                    else if (normalizedKey === 'HOT') result.hot = value;
                    else if (normalizedKey === 'CRIT') result.crit = value;
                    else if (normalizedKey === 'FUND') result.fund = value;
                    else if (normalizedKey === 'WRONG_DIAGNOSIS' || normalizedKey === 'DIAGNOSTICO_ERRO') result.WRONG_DIAGNOSIS = value;
                    else result[normalizedKey] = value;
                    
                    lastKey = normalizedKey;
                    if (normalizedKey === 'CORRECT' || normalizedKey === 'ANSWER') currentSection = 'METADATA';
                }
                return;
            }

            // 4. Handle Multiline Append
            if (lastKey) {
                if (lastKey === 'Q_TEXT') {
                    result.Q_TEXT = (result.Q_TEXT || '') + '\n' + trimmed;
                } else if (lastKey.startsWith('OPT_')) {
                    const letter = lastKey.replace('OPT_', '');
                    if (result.options[letter]) result.options[letter] += '\n' + trimmed;
                } else {
                    result[lastKey] = (result[lastKey] || '') + '\n' + trimmed;
                }
            }
        });
        
        return result;
    }

    const handleParse = () => {
        const blocks = text.split(/(?:^Q_REF:)|(?:^----------------------\s*)/m).filter(b => b.trim());
        
        if (blocks.length > 50) {
            alert(`Limite de 50 questões por vez. Encontradas: ${blocks.length}.`);
            return;
        }

        const existingRefs = new Set(allQuestions.map(q => q.questionRef));
        const results: ParsedResult = { newQuestions: [], duplicates: [], errors: [] };
        let nextSequenceNumber = allQuestions.length > 0 ? Math.max(...allQuestions.map(q => q.sequenceNumber)) + 1 : 1;

        blocks.forEach((rawBlock, index) => {
            const block = rawBlock.includes('Q_REF:') ? rawBlock : `Q_REF: ${rawBlock}`; 
            try {
                const rawFields: any = parseBlock(block);

                const fields = {
                    Q_REF: rawFields.Q_REF,
                    Q_TEXT: rawFields.Q_TEXT,
                    CORRECT: rawFields.CORRECT,
                    ANSWER: rawFields.answer,
                    DISCIPLINE: rawFields.DISCIPLINE || rawFields.DISCIPLINA,
                    SUBJECT: rawFields.SUBJECT || rawFields.ASSUNTO,
                    TOPIC: rawFields.TOPIC || rawFields.TOPICO,
                    SUBTOPIC: rawFields.SUBTOPIC || rawFields.SUBTOPICO,
                    
                    ANCHOR_TEXT: rawFields.ANCHOR_TEXT || rawFields.FRASE_ANCORA_FINAL || rawFields.FRASE_ANCORA,
                    KEY_DISTINCTION: rawFields.KEY_DISTINCTION || rawFields.PALAVRA_QUE_SALVA || rawFields.PALAVRA_CHAVE_ERRO,
                    GUIA_TRAPSCAN: rawFields.GUIA_TRAPSCAN || rawFields.TRAPSCAN,

                    BANK: rawFields.BANK || rawFields.BANCA,
                    EXAM: rawFields.EXAM || rawFields.POSITION || rawFields.CARGO,
                    TYPE: rawFields.TYPE || rawFields.TIPO,
                    
                    EXPLANATION: rawFields.EXPLANATION || rawFields.COMENTARIO,
                    EXPLANATION_TECH: rawFields.EXPLANATION_TECH || rawFields.EXPLICA_TECNICA,
                    EXPLANATION_STORY: rawFields.EXPLANATION_STORY || rawFields.STORYTELLING || rawFields.HISTORIA,
                    PERGUNTAS_FEYNMAN: rawFields.PERGUNTAS_FEYNMAN || rawFields.FEYNMAN,
                    
                    WRONG_DIAGNOSIS: rawFields.WRONG_DIAGNOSIS || rawFields.DIAGNOSTICO_ERRO,
                    
                    OPT_A: rawFields.options?.A || rawFields.OPT_A,
                    OPT_B: rawFields.options?.B || rawFields.OPT_B,
                    OPT_C: rawFields.options?.C || rawFields.OPT_C,
                    OPT_D: rawFields.options?.D || rawFields.OPT_D,
                    OPT_E: rawFields.options?.E || rawFields.OPT_E,
                    
                    // Maps - Guaranteed to be objects from parseBlock
                    distractorProfile: rawFields.distractorProfile,
                    wrongDiagnosisMap: rawFields.wrongDiagnosisMap,
                    
                    HOT: rawFields.hot || rawFields.HOT,
                    CRIT: rawFields.crit || rawFields.CRIT,
                    FUND: rawFields.fund || rawFields.FUND,

                    // TRILHA Support: Use LAW_REF if present, explicitly bypassing strict Lei Seca validation
                    // The srsService.canonicalizeLitRef will handle preservation of 'TRILHA_' prefix.
                    LAW_REF: rawFields.LAW_REF || rawFields.LIT_REF,
                    LIT_REF: rawFields.LIT_REF
                };

                if (!fields.Q_REF || !fields.Q_TEXT) {
                     if (block.length > 50 && !fields.Q_REF) throw new Error('Campo Q_REF obrigatório não encontrado.');
                     else return; 
                }
                
                if (existingRefs.has(fields.Q_REF)) results.duplicates.push(fields.Q_REF);
                
                const isCebraspe = (fields.BANK || '').toUpperCase().includes('CEBRASPE') || 
                                   (fields.TYPE || '').includes('C/E');

                let correctAnswer = (fields.CORRECT || '').toUpperCase().trim();
                const matchAns = correctAnswer.match(/^([A-E])/);
                if (matchAns) correctAnswer = matchAns[1];

                if (!correctAnswer && fields.ANSWER) {
                     const ans = fields.ANSWER.toUpperCase().trim();
                     if (ans === 'CERTO' || ans === 'C') correctAnswer = 'A';
                     else if (ans === 'ERRADO' || ans === 'E') correctAnswer = 'B';
                }

                if (!correctAnswer) throw new Error('Gabarito ausente (CORRECT ou ANSWER).');

                let options: any = { A: fields.OPT_A, B: fields.OPT_B, C: fields.OPT_C, D: fields.OPT_D, E: fields.OPT_E };

                if (isCebraspe && !options.A && !options.C) {
                    options = { A: 'Certo', B: 'Errado', C: '—', D: '—', E: '—' };
                }

                let qText = fields.Q_TEXT;
                if (!isCebraspe) {
                    const hasExplicitOptions = Object.values(options).some(v => !!v);
                    if (!hasExplicitOptions) {
                        const parsed = parseQuestionText(fields.Q_TEXT);
                        if (Object.keys(parsed.options).length > 0) {
                            options = { ...options, ...parsed.options };
                            qText = parsed.stem;
                        }
                    }
                }

                const newQuestion: Omit<Question, 'id'> = {
                    sequenceNumber: nextSequenceNumber++,
                    bank: fields.BANK || '',
                    position: fields.EXAM || '',
                    subject: normalizeDiscipline(fields.DISCIPLINE || 'Geral'),
                    topic: fields.SUBJECT || fields.TOPIC || 'Geral',
                    subtopic: fields.SUBTOPIC,
                    
                    // Prioritize LAW_REF, fallback to LIT_REF, then empty string.
                    // If LAW_REF starts with TRILHA_, it will be preserved by srsService.
                    lawRef: fields.LAW_REF || fields.LIT_REF || '',
                    litRef: fields.LIT_REF,
                    
                    anchorText: fields.ANCHOR_TEXT,
                    keyDistinction: fields.KEY_DISTINCTION,
                    guiaTrapscan: fields.GUIA_TRAPSCAN,
                    
                    area: fields.SUBJECT || fields.DISCIPLINE || 'Geral',
                    questionRef: fields.Q_REF,
                    questionText: qText,
                    options: options,
                    
                    explanation: fields.EXPLANATION_TECH || fields.EXPLANATION || '',
                    explanationTech: fields.EXPLANATION_TECH,
                    explanationStory: fields.EXPLANATION_STORY,
                    feynmanQuestions: fields.PERGUNTAS_FEYNMAN,
                    
                    comments: '',
                    correctAnswer: correctAnswer,
                    questionType: fields.TYPE || (isCebraspe ? '13 C/E' : 'Literalidade'),
                    createdAt: srs.todayISO(),
                    lastAttemptDate: '',
                    totalAttempts: 0,
                    errorCount: 0,
                    lastWasCorrect: false,
                    timeSec: 0,
                    selfEvalLevel: 0,
                    masteryScore: 0,
                    stability: settings.srsV2?.S_default_days ?? 1,
                    lastReviewedAt: undefined,
                    nextReviewDate: srs.todayISO(),
                    willFallExam: false,
                    srsStage: 0,
                    correctStreak: 0,
                    attemptHistory: [],
                    srsVersion: 2,
                    recentError: 0,
                    difficulty: 0.5,
                    difficultyLevel: 'normal',
                    
                    wrongDiagnosis: fields.WRONG_DIAGNOSIS,
                    distractorProfile: fields.distractorProfile,
                    wrongDiagnosisMap: fields.wrongDiagnosisMap,
                    rawImportBlock: block,
                    
                    hotTopic: !!fields.HOT,
                    isCritical: !!fields.CRIT,
                    isFundamental: !!fields.FUND
                };
                
                results.newQuestions.push(newQuestion);
                if (existingRefs.has(fields.Q_REF)) {
                    results.duplicates.push(fields.Q_REF);
                }

            } catch (e: any) {
                results.errors.push({ blockNumber: index + 1, text: block.substring(0, 50) + '...', message: e.message });
            }
        });

        setAnalysis(results);
    };

    const handleImport = () => {
        if (!analysis || analysis.newQuestions.length === 0) {
            alert("Nenhuma questão nova para importar.");
            return;
        }
        
        const { imported, updated, blocked } = addBatchQuestions(analysis.newQuestions, importMode);
        
        let msg = `Processamento concluído (${importMode}).\n`;
        msg += `Novas: ${imported}\n`;
        msg += `Atualizadas: ${updated}\n`;
        msg += `Ignoradas: ${blocked}`;
        
        alert(msg);
        setText('');
        setAnalysis(null);
    };

    const runParserTests = () => {
         alert("Teste: Cole o texto no campo e clique em 'Analisar Texto' para ver o resultado.");
    };

    const example = `
Q_REF: TRILHA_CONT_SEFAZMT_AUTO_Q01
LAW_REF: TRILHA_CONT_SEFAZMT_AUTO
DISCIPLINE: Direito Tributario
Q_TEXT: Exemplo de questão de trilha...
A: Opção A
B: Opção B
CORRECT: B
`.trim();

    const handleCopy = () => { navigator.clipboard.writeText(example); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-lg">Importar Questões em Lote</h3>
                        <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-2">
                            Cole o texto ou carregue um arquivo .txt. Suporta formato de Trilha e Lei Seca.
                        </p>
                    </div>
                     <button onClick={runParserTests} className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-colors flex items-center gap-2">
                        <BoltIcon className="w-3 h-3" /> Ajuda / Teste
                    </button>
                </div>
                
                <div className="relative group my-4">
                    <pre className="text-xs p-3 bg-bunker-50 dark:bg-bunker-800 rounded-md overflow-x-auto whitespace-pre-wrap font-mono border border-bunker-200 dark:border-bunker-700 pr-10"><code>{example}</code></pre>
                    <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-lg bg-bunker-200 dark:bg-bunker-700 text-bunker-500 hover:text-white hover:bg-sky-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                        {copied ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardListIcon className="w-4 h-4" />}
                    </button>
                </div>

                <div>
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt" className="hidden" />
                    <div className="flex justify-between items-center mb-2">
                        <button onClick={triggerFileInput} className="text-xs font-bold text-sky-500 hover:underline flex items-center gap-1">
                            <UploadIcon className="w-3 h-3"/> Carregar Arquivo
                        </button>
                    </div>
                </div>
                
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder="Cole o conteúdo aqui... Ex: Q_REF: TRILHA_..." className="w-full font-mono text-xs bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500" />
                <div className="mt-4 flex justify-between items-center">
                    <span className="text-xs text-bunker-400">{text.length > 0 ? `${text.length} caracteres` : ''}</span>
                    <button onClick={handleParse} className="bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold py-2 px-4 rounded-lg hover:bg-sky-500/30 transition-colors">Analisar Texto</button>
                </div>
            </div>
            {analysis && (
                <div className="p-4 bg-bunker-50 dark:bg-bunker-800/50 rounded-lg space-y-4 animate-fade-in border border-bunker-200 dark:border-bunker-700">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-lg">Resultado da Análise</h4>
                        <div className="flex gap-1 bg-bunker-200 dark:bg-bunker-800 p-1 rounded-lg">
                             <button onClick={() => setImportMode('SKIP')} className={`px-3 py-1 rounded text-xs font-bold ${importMode === 'SKIP' ? 'bg-white dark:bg-bunker-600 shadow' : 'text-slate-500'}`}>Ignorar Duplicatas</button>
                             <button onClick={() => setImportMode('MERGE')} className={`px-3 py-1 rounded text-xs font-bold ${importMode === 'MERGE' ? 'bg-sky-500 text-white shadow' : 'text-slate-500'}`}>Mesclar (Completar)</button>
                             <button onClick={() => setImportMode('OVERWRITE')} className={`px-3 py-1 rounded text-xs font-bold ${importMode === 'OVERWRITE' ? 'bg-amber-500 text-white shadow' : 'text-slate-500'}`}>Sobrescrever</button>
                        </div>
                    </div>

                    {analysis.errors.length > 0 && (
                        <div className="p-3 bg-red-500/10 rounded-md border border-red-500/20">
                            <h5 className="font-bold text-red-500 mb-2">{analysis.errors.length} Erro(s):</h5>
                            <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-2 max-h-48 overflow-y-auto">
                                {analysis.errors.map((e, i) => <li key={i}><strong>Bloco {e.blockNumber}:</strong> {e.message}</li>)}
                            </ul>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-md text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-center">
                            <span className="block text-2xl font-bold">{analysis.newQuestions.length}</span>
                            <span className="text-xs uppercase font-bold">Identificadas</span>
                        </div>
                         <div className="p-3 bg-amber-500/10 rounded-md text-amber-700 dark:text-amber-300 border border-amber-500/20 text-center">
                            <span className="block text-2xl font-bold">{analysis.duplicates.length}</span>
                            <span className="text-xs uppercase font-bold">Já Existem (Q_REF)</span>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={handleImport} disabled={analysis.newQuestions.length === 0} className="bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                            Processar ({importMode})
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportTxtTab;
