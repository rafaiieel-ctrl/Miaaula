
import React, { useState } from 'react';
import { useFlashcardDispatch, useFlashcardState } from '../../../contexts/FlashcardContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { Flashcard } from '../../../types';
import { ClipboardListIcon, CheckCircleIcon } from '../../../components/icons';
import { normalizeDiscipline } from '../../../services/taxonomyService';

interface ParsedResult {
    newCards: Flashcard[];
    duplicates: Flashcard[];
    errors: { line: number, text: string, message: string }[];
}

const ImportFlashcardTab: React.FC = () => {
    const { addBatchFlashcards } = useFlashcardDispatch();
    const allFlashcards = useFlashcardState();
    const { settings } = useSettings();
    const [text, setText] = useState('');
    const [analysis, setAnalysis] = useState<ParsedResult | null>(null);
    const [copied, setCopied] = useState(false);

    const handleParse = () => {
        const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        const existingIds = new Set(allFlashcards.map(fc => fc.id));
        
        const results: ParsedResult = { newCards: [], duplicates: [], errors: [] };

        lines.forEach((line, index) => {
            try {
                const fields = line.split(';').reduce((acc, part) => {
                    const match = part.match(/(\w+):([\s\S]*)/);
                    if (match) {
                        acc[match[1].trim().toUpperCase()] = match[2].trim();
                    }
                    return acc;
                }, {} as Record<string, string>);

                if (!fields.FC_REF || !fields.DISCIPLINE || !fields.FRONT || !fields.BACK) {
                    throw new Error('Campos obrigatórios ausentes: FC_REF, DISCIPLINE, FRONT, BACK.');
                }
                
                const id = fields.FC_REF;

                const newFlashcard: Flashcard = {
                    id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    discipline: normalizeDiscipline(fields.DISCIPLINE),
                    topic: fields.TOPIC || '',
                    bank: fields.BANK,
                    source: fields.SOURCE,
                    front: fields.FRONT,
                    back: fields.BACK,
                    comments: fields.COMMENTS || '',
                    type: (fields.TYPE === 'cloze' || fields.TYPE === 'imageOcclusion') ? fields.TYPE : 'basic',
                    tags: fields.TAGS ? fields.TAGS.split(',').map(t => t.trim()) : [],
                    stability: settings.srsV2?.S_default_days ?? 1,
                    lastReviewedAt: undefined,
                    nextReviewDate: new Date().toISOString(),
                    masteryScore: 0,
                    recentError: 0, // Added missing property
                    hotTopic: fields.HOT === '1',
                    isCritical: fields.CRIT === '1',
                    isFundamental: fields.FUND === '1',
                    queroCair: fields.QUERO_CAIR === '1' ? 1 : 0,
                    pairMatchPlayed: false,
                    totalAttempts: 0,
                    lastWasCorrect: false,
                    correctStreak: 0,
                    srsStage: 0,
                    lastAttemptDate: '',
                    attemptHistory: [],
                    masteryHistory: [],
                    timeSec: 0,
                    selfEvalLevel: 0,
                };

                if (existingIds.has(id)) {
                    results.duplicates.push(newFlashcard);
                } else {
                    results.newCards.push(newFlashcard);
                }

            } catch (e: any) {
                results.errors.push({ line: index + 1, text: line, message: e.message });
            }
        });

        setAnalysis(results);
    };

    const handleImport = () => {
        if (!analysis || analysis.newCards.length === 0) {
            alert("Nenhum flashcard novo para importar.");
            return;
        }

        addBatchFlashcards(analysis.newCards);
        
        let msg = `${analysis.newCards.length} flashcards importados com sucesso!`;
        if (analysis.duplicates.length > 0) {
            msg += `\n${analysis.duplicates.length} duplicatas (mesmo FC_REF) foram ignoradas.`;
        }

        alert(msg);
        setText('');
        setAnalysis(null);
    };

    const example = `
# Formato: CHAVE:valor; CHAVE:valor; ... (uma linha por card)
# Campos obrigatórios: FC_REF, DISCIPLINE, FRONT, BACK
# Flags (0 ou 1): HOT, CRIT, FUND, QUERO_CAIR
# Tags: separadas por vírgula. Ex: TAGS:conceito,importante

FC_REF:scrum-pilares-v2;DISCIPLINE:Scrum;TOPIC:Pilares;TYPE:basic;FRONT:Quais são os 3 pilares do Scrum?;BACK:Transparência, Inspeção e Adaptação.;TAGS:scrum-guide,conceito;HOT:1;COMMENTS:Lembre-se que o empirismo é a base do Scrum.
FC_REF:ctn-exclusao-credito;DISCIPLINE:Direito Tributário;TOPIC:Crédito Tributário;TYPE:cloze;FRONT:A {{c1::isenção}} e a {{c2::anistia}} são formas de exclusão do crédito tributário.;BACK:Correto. Ambas impedem a constituição definitiva do crédito.;TAGS:ctn,literalidade;CRIT:1
FC_REF:po-responsabilidade;DISCIPLINE:Scrum;FRONT:Quem gerencia o Product Backlog?;BACK:O Product Owner.
`.trim();

    const handleCopy = () => {
        navigator.clipboard.writeText(example).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-6 p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg max-w-4xl mx-auto">
            <h3 className="font-bold text-lg">Importar Flashcards em Lote (.txt)</h3>
            <p className="text-sm text-bunker-500 dark:text-bunker-400">
                Cole o conteúdo do seu arquivo .txt. Cada linha é um flashcard. Use o formato <code>CHAVE:valor;</code>.
                <br/>Campos <strong>obrigatórios</strong>: <code>FC_REF</code> (ID único), <code>DISCIPLINE</code>, <code>FRONT</code>, <code>BACK</code>.
            </p>
            <div className="relative group">
                <pre className="text-xs p-3 bg-bunker-50 dark:bg-bunker-800 rounded-md overflow-x-auto whitespace-pre-wrap pr-10 font-mono border border-bunker-200 dark:border-bunker-700"><code>{example}</code></pre>
                <button 
                    onClick={handleCopy}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-bunker-200 dark:bg-bunker-700 text-bunker-500 hover:text-white hover:bg-sky-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Copiar exemplo"
                >
                    {copied ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardListIcon className="w-4 h-4" />}
                </button>
            </div>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Cole o conteúdo aqui..."
                className="w-full font-mono text-xs bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <div className="flex justify-end gap-4">
                <button onClick={handleParse} className="bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold py-2 px-4 rounded-lg hover:bg-sky-500/30">Analisar</button>
            </div>
            
            {analysis && (
                <div className="p-4 bg-bunker-50 dark:bg-bunker-800/50 rounded-lg space-y-4 animate-fade-in">
                    <h4 className="font-bold text-lg">Análise da Importação</h4>
                    {analysis.errors.length > 0 && (
                        <div className="p-3 bg-red-500/10 rounded-md">
                            <h5 className="font-bold text-red-500 mb-2">{analysis.errors.length} Erro(s) Encontrado(s):</h5>
                            <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-2 max-h-48 overflow-y-auto">
                                {analysis.errors.map((e, i) => <li key={i}><strong>Linha {e.line}:</strong> {e.message}</li>)}
                            </ul>
                        </div>
                    )}
                    <div className="p-3 bg-emerald-500/10 rounded-md text-emerald-700 dark:text-emerald-300">
                        <p><strong>{analysis.newCards.length}</strong> novo(s) flashcard(s) para importar.</p>
                    </div>
                     {analysis.duplicates.length > 0 && (
                        <div className="p-3 bg-amber-500/10 rounded-md text-amber-700 dark:text-amber-300">
                            <p><strong>{analysis.duplicates.length}</strong> flashcard(s) duplicados (mesmo FC_REF) foram encontrados e serão ignorados.</p>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button onClick={handleImport} disabled={analysis.newCards.length === 0} className="bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-emerald-600 disabled:opacity-50">
                            Importar ({analysis.newCards.length})
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportFlashcardTab;
