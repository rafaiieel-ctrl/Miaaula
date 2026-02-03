
import React, { useState } from 'react';
import { useFlashcardDispatch, useFlashcardState } from '../../../contexts/FlashcardContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { Flashcard, DominioLevel, TabID } from '../../../types';
import { ClipboardListIcon, CheckCircleIcon } from '../../../components/icons';
import { normalizeDiscipline } from '../../../services/taxonomyService';

interface ParsedResult {
    newCards: Flashcard[];
    duplicates: string[];
    errors: { blockNumber: number, text: string, message: string }[];
    groupsFound: Record<string, number>;
}

interface ImportPairsTabProps {
    setActiveTab: (tab: TabID) => void;
}

const ImportPairsTab: React.FC<ImportPairsTabProps> = ({ setActiveTab }) => {
    const { addBatchFlashcards } = useFlashcardDispatch();
    const allFlashcards = useFlashcardState();
    const { settings } = useSettings();
    const [text, setText] = useState('');
    const [manualGroup, setManualGroup] = useState('');
    const [analysis, setAnalysis] = useState<ParsedResult | null>(null);
    const [copied, setCopied] = useState(false);

    const handleParse = () => {
        const rawText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
        
        const blocks = rawText
            .split(/(?:^---$)|(?=^PAIR_REF:)/m)
            .map(b => b.trim())
            .filter(b => b.length > 0);

        const existingIds = new Set(allFlashcards.map(fc => fc.id));
        const groupsCount: Record<string, number> = {};
        
        const results: ParsedResult = { newCards: [], duplicates: [], errors: [], groupsFound: {} };
        
        blocks.forEach((block, index) => {
            try {
                const lines = block.split('\n');
                const fields: Record<string, string> = {};
                let currentKey: string | null = null;

                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;

                    const match = trimmed.match(/^([A-Z0-9_]+)\s*:\s*(.*)/i);
                    if (match) {
                        currentKey = match[1].toUpperCase();
                        fields[currentKey] = match[2].trim();
                    } else if (currentKey) {
                        fields[currentKey] += '\n' + trimmed;
                    }
                });

                if (!fields.PAIR_REF) throw new Error("Campo PAIR_REF não encontrado.");
                if (!fields.FRONT) throw new Error("Campo FRONT não encontrado.");
                if (!fields.BACK) throw new Error("Campo BACK não encontrado.");
                
                const topicTitle = manualGroup.trim() 
                    ? manualGroup.trim() 
                    : (fields.TOPIC_TITLE || 'Geral');
                
                const topicId = fields.TOPIC_ID || 'geral';
                const id = fields.PAIR_REF;

                if (existingIds.has(id)) {
                    results.duplicates.push(id);
                    return;
                }

                const rawDominio = parseInt(fields.DOMINIO || '1', 10);
                const dominio = (isNaN(rawDominio) ? 1 : Math.max(1, Math.min(4, rawDominio))) as DominioLevel;
                const masteryMap = { 1: 0, 2: 40, 3: 75, 4: 90 };
                
                const today = new Date().toISOString();

                // For pairs, discipline is often used as the Game Title/Group
                // We normalize it if it looks like a subject, but for games it might be specific
                // However, consistent taxonomy helps cleanup.
                const normalizedDiscipline = normalizeDiscipline(topicTitle);

                const newCard: Flashcard = {
                    id: id,
                    createdAt: today,
                    updatedAt: today,
                    discipline: normalizedDiscipline,
                    topic: topicId,
                    front: fields.FRONT,
                    back: fields.BACK,
                    comments: fields.COMMENTS || '',
                    extra: fields.EXTRA || '',
                    type: 'basic',
                    tags: ['pair-match'],
                    dominioLevel: dominio,
                    pairMatchPlayed: false,
                    
                    stability: settings.srsV2?.S_default_days ?? 1,
                    lastReviewedAt: undefined,
                    nextReviewDate: today, 
                    masteryScore: masteryMap[dominio] || 0,
                    recentError: 0, // Added missing property
                    hotTopic: false,
                    isCritical: false,
                    isFundamental: false,
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

                results.newCards.push(newCard);
                groupsCount[normalizedDiscipline] = (groupsCount[normalizedDiscipline] || 0) + 1;

            } catch (e: any) {
                if (block !== '---') {
                    results.errors.push({ 
                        blockNumber: index + 1, 
                        text: block.substring(0, 30) + '...', 
                        message: e.message 
                    });
                }
            }
        });

        results.groupsFound = groupsCount;
        setAnalysis(results);
    };

    const handleImport = () => {
        if (!analysis || analysis.newCards.length === 0) {
            alert("Nenhum par novo para importar.");
            return;
        }

        addBatchFlashcards(analysis.newCards);
        
        if (window.confirm(`${analysis.newCards.length} pares importados com sucesso! \n\nDeseja ir para o Jogo dos Pares agora?`)) {
            setActiveTab('pair-match');
        } else {
            setText('');
            setAnalysis(null);
            setManualGroup('');
        }
    };

    const example = `
PAIR_REF: RICMS_EX_01
TOPIC_TITLE: RICMS/SP - Exemplo
FRONT: O que o ICMS incide?
BACK: Circulação de mercadorias e serviços de transporte/comunicação.
EXTRA: Competência estadual.
DOMINIO: 3
---
PAIR_REF: RICMS_EX_02
TOPIC_TITLE: RICMS/SP - Exemplo
FRONT: Incide sobre exportação?
BACK: Não, há imunidade para exportação de mercadorias.
DOMINIO: 4
`.trim();

    const handleCopy = () => {
        navigator.clipboard.writeText(example).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg shadow-sm border border-bunker-200 dark:border-bunker-800">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Importar Pares</h3>
                <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-2 leading-relaxed">
                    Cole seus pares abaixo. O sistema identifica automaticamente os blocos.
                    <br />Use <code>TOPIC_TITLE</code> para agrupar, ou use o campo de "Forçar Grupo" abaixo.
                </p>
                
                <div className="relative group mt-4">
                    <div className="p-3 bg-bunker-50 dark:bg-bunker-800 rounded-md border border-bunker-200 dark:border-bunker-700 font-mono text-xs text-bunker-600 dark:text-bunker-300 overflow-x-auto pr-10 whitespace-pre-wrap">
                        {example}
                    </div>
                    <button 
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-bunker-200 dark:bg-bunker-700 text-bunker-500 hover:text-white hover:bg-sky-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Copiar exemplo"
                    >
                        {copied ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardListIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="p-6 bg-white dark:bg-bunker-950 rounded-lg shadow-sm border border-bunker-200 dark:border-bunker-800 space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Forçar Nome do Grupo (Opcional)
                    </label>
                    <input 
                        type="text" 
                        value={manualGroup}
                        onChange={(e) => setManualGroup(e.target.value)}
                        placeholder="Ex: Revisão Final (Se preenchido, agrupa todos aqui)"
                        className="w-full bg-bunker-50 dark:bg-bunker-900 border border-bunker-300 dark:border-bunker-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                    />
                    <p className="text-xs text-bunker-400 mt-1">
                        Útil se você quiser juntar vários pares soltos em um único jogo.
                    </p>
                </div>
                
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Conteúdo
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={12}
                        placeholder="Cole o texto aqui..."
                        className="w-full font-mono text-xs bg-bunker-50 dark:bg-bunker-900 border border-bunker-300 dark:border-bunker-700 rounded-lg p-3 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                    />
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={handleParse} 
                        disabled={!text.trim()}
                        className="bg-sky-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-sky-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Analisar Texto
                    </button>
                </div>
            </div>

            {analysis && (
                <div className="p-6 bg-white dark:bg-bunker-900 rounded-lg shadow-lg border border-bunker-200 dark:border-bunker-800 animate-fade-in space-y-4">
                    <div className="flex items-center justify-between border-b border-bunker-200 dark:border-b-bunker-800 pb-3">
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white">Resultado da Análise</h4>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
                            {analysis.newCards.length} Válidos
                        </span>
                    </div>
                    
                    {Object.keys(analysis.groupsFound).length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-bunker-500 uppercase tracking-wider mb-2">Grupos Identificados</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(analysis.groupsFound).map(([group, count]) => (
                                    <span key={group} className="text-xs px-3 py-1.5 rounded-md bg-bunker-100 dark:bg-bunker-800 text-bunker-700 dark:text-bunker-200 border border-bunker-200 dark:border-bunker-700">
                                        <strong>{group}</strong>: {count} pares
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.errors.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
                            <h5 className="font-bold text-rose-600 dark:text-rose-400 text-sm mb-2">{analysis.errors.length} Problemas Encontrados</h5>
                            <ul className="list-disc list-inside text-xs text-rose-500 dark:text-rose-300 space-y-1 max-h-32 overflow-y-auto">
                                {analysis.errors.map((e, i) => <li key={i}><strong>{e.text}:</strong> {e.message}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <button 
                            onClick={handleImport} 
                            disabled={analysis.newCards.length === 0} 
                            className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:bg-emerald-500 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            Confirmar Importação
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportPairsTab;
