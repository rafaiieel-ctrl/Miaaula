
import React, { useState, useMemo } from 'react';
import { useLiteralnessDispatch, useLiteralnessState } from '../../contexts/LiteralnessContext';
import { useQuestionDispatch, useQuestionState } from '../../contexts/QuestionContext';
import { useFlashcardDispatch, useFlashcardState } from '../../contexts/FlashcardContext';
import { useSettings } from '../../contexts/SettingsContext';
import { LiteralnessCard, Question, Flashcard, LawContentType, ImportMode } from '../../types';
import * as srs from '../../services/srsService';
import { parseLitRefText, ImportResult, enforceTargetLinkage, cleanBatchForExport, runImportSelfTest } from '../../services/import/litRefParser';
import { generateSmartGap } from '../../services/gapGeneratorService';
import { traceService } from '../../services/traceService'; 
import { 
    CheckCircleIcon, XMarkIcon, SparklesIcon, CloudIcon, ChevronLeftIcon, 
    ExclamationTriangleIcon, BoltIcon, ClipboardDocumentCheckIcon, 
    DocumentDuplicateIcon, ArrowRightIcon, ChevronDownIcon, BookOpenIcon, 
    TrashIcon, DownloadIcon, ArrowPathIcon
} from '../icons';

interface ImportLiteralnessProps {
    type?: LawContentType;
    onBack?: () => void;
    forcedLawId?: string | null;
}

const OFFICIAL_TEMPLATE = `LIT_REF: LEI_EXEMPLO_01
LAW_ID: DIREITO CONSTITUCIONAL
ARTICLE: Art. 5º
TOPIC: Direitos Fundamentais
PHASE1_FULL: Todos são iguais perante a lei, sem distinção de qualquer natureza.
RESUMO_POR_PARTES: —
KEYWORDS_PROVA: Igualdade; Isonomia
RISCO_FCC: —
GANCHO_MNEMONICO: —
STORYTELLING: —
FEYNMAN: —

# --- MODELO DE LACUNA (Contextualizada) ---
PHASE2_LACUNA_01: Todos são iguais perante a lei, sem distinção de {{qualquer natureza}}.
PHASE2_CORRECT_01: A
PHASE2_OPT_A_01: qualquer natureza
PHASE2_OPT_B_01: raça ou cor
PHASE2_OPT_C_01: credo religioso
PHASE2_OPT_D_01: classe social
PHASE2_OPT_E_01: origem

Q_REF: Q_CONST_01
DISCIPLINE: DIREITO CONSTITUCIONAL
SUBJECT: DIREITO CONSTITUCIONAL
TOPIC: Direitos Individuais
TYPE: Literalidade
LAW_REF: LEI_EXEMPLO_01
Q_TEXT: O artigo 5º garante a igualdade apenas para brasileiros natos.
A: Certo
B: Errado
CORRECT: B

FC_REF: FC_CONST_01
DISCIPLINE: DIREITO CONSTITUCIONAL
FRONT: Qual o princípio do Art 5?
BACK: Igualdade.
TAGS: LEI_EXEMPLO_01`;

const ImportLiteralness: React.FC<ImportLiteralnessProps> = ({ type = 'LAW_DRY', onBack, forcedLawId }) => {
    const { addBatchCards, updateCard } = useLiteralnessDispatch();
    const { addBatchQuestions } = useQuestionDispatch();
    const { addBatchFlashcards } = useFlashcardDispatch();
    
    const allCards = useLiteralnessState();
    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    const { settings, updateSettings } = useSettings();
    
    const [activeTab, setActiveTab] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
    const [text, setText] = useState('');
    const [report, setReport] = useState<ImportResult | null>(null);
    const [hasCriticalErrors, setHasCriticalErrors] = useState(false);
    const [isTemplateOpen, setIsTemplateOpen] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [importMode, setImportMode] = useState<ImportMode>('MERGE');
    const [targetMode, setTargetMode] = useState<'NEW' | 'APPEND'>('NEW');
    const [selectedTargetCardId, setSelectedTargetCardId] = useState<string>('');
    const [cardSearchTerm, setCardSearchTerm] = useState('');
    const [selectedTargetLawId, setSelectedTargetLawId] = useState<string>('');
    const [forceLawId, setForceLawId] = useState(false);
    const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());

    const availableBatches = useMemo(() => {
        const batches = new Map<string, { id: string, count: number, date: string }>();
        const addBatch = (id: string | undefined) => {
            if (!id) return;
            if (!batches.has(id)) batches.set(id, { id, count: 0, date: new Date().toISOString() }); 
            batches.get(id)!.count++;
        };
        allCards.forEach(c => addBatch(c.importBatchId));
        allQuestions.forEach(q => addBatch(q.importBatchId));
        allFlashcards.forEach(f => addBatch(f.importBatchId));
        return Array.from(batches.values()).sort((a,b) => b.id.localeCompare(a.id));
    }, [allCards, allQuestions, allFlashcards]);

    const availableCards = useMemo(() => {
        if (!cardSearchTerm.trim()) return allCards.slice(0, 50); 
        const term = cardSearchTerm.toLowerCase();
        return allCards.filter(c => c.article.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)).slice(0, 50);
    }, [allCards, cardSearchTerm]);

    const uniqueLawIds = useMemo(() => {
        const laws = new Map<string, number>();
        allCards.forEach(c => laws.set(c.lawId || 'Geral', (laws.get(c.lawId || 'Geral') || 0) + 1));
        return Array.from(laws.entries()).map(([id, count]) => ({ id, count })).sort((a,b) => a.id.localeCompare(b.id));
    }, [allCards]);

    const handleAnalyze = () => {
        if (!text.trim()) return;
        const batchId = `BATCH_${Date.now()}`;
        let result = parseLitRefText(text, settings, batchId, targetMode === 'NEW' ? selectedTargetLawId : undefined, targetMode === 'NEW' ? forceLawId : false);
        if (targetMode === 'APPEND' && selectedTargetCardId) result = enforceTargetLinkage(result, selectedTargetCardId);
        setHasCriticalErrors(result.errors.length > 0);
        setReport(result);
    };

    const handleConfirmImport = () => {
        if (!report || hasCriticalErrors) return;
        
        updateSettings({ lastImportBatchId: report.batchId });
        
        if (targetMode === 'APPEND' && selectedTargetCardId) {
            const targetCard = allCards.find(c => c.id === selectedTargetCardId);
            if (targetCard && report.cards[0]) {
                const mergedGaps = [...(targetCard.extraGaps || []), ...(report.cards[0].extraGaps || [])];
                updateCard({ ...targetCard, extraGaps: mergedGaps });
            }
        } else {
            let cardsToImport = report.cards.map(c => ({ ...c, contentType: type }));
            if (forcedLawId) cardsToImport = cardsToImport.map(c => ({ ...c, lawId: forcedLawId }));
            
            // FIX: Passando as lacunas explicitamente para salvar no banco
            if (cardsToImport.length > 0) {
                addBatchCards(cardsToImport, report.questions, report.flashcards, report.gaps);
            }
        }
        
        if (report.questions.length > 0) addBatchQuestions(report.questions, importMode);
        if (report.flashcards.length > 0) addBatchFlashcards(report.flashcards);

        alert(`Sucesso!\n${report.stats.questions} Questões, ${report.stats.flashcards} Cards, ${report.stats.gaps} Lacunas.`);
        setReport(null); 
        setText('');
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-fade-in px-4">
            <div className="bg-slate-900/40 border border-white/10 p-8 rounded-[3rem] backdrop-blur-xl shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6">
                    <div>
                        <h3 className="text-3xl font-black text-white mb-2 flex items-center gap-3 italic tracking-tighter">
                            <CloudIcon className="text-sky-400 w-10 h-10" /> 
                            {activeTab === 'IMPORT' ? 'Importador Lei Seca' : 'Gestão de Lotes'}
                        </h3>
                    </div>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button onClick={() => setActiveTab('IMPORT')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'IMPORT' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Importar</button>
                        <button onClick={() => setActiveTab('EXPORT')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'EXPORT' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Exportar</button>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsTemplateOpen(true)} className="px-4 py-2 rounded-xl bg-white/5 text-sky-400 hover:bg-sky-500/10 border border-sky-500/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"><BookOpenIcon className="w-3.5 h-3.5" /> Template</button>
                        {onBack && <button onClick={onBack} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/5 transition-all"><XMarkIcon className="w-5 h-5"/></button>}
                    </div>
                </div>

                {activeTab === 'IMPORT' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-6">
                            <label className="flex-1 flex items-start gap-3 cursor-pointer group">
                                <input type="radio" name="targetMode" checked={targetMode === 'NEW'} onChange={() => setTargetMode('NEW')} className="mt-1" />
                                <div><span className="block text-sm font-bold text-white group-hover:text-sky-400">Importar Normal</span><span className="text-xs text-slate-500">Novos artigos baseados no LIT_REF.</span></div>
                            </label>
                            <label className="flex-1 flex items-start gap-3 cursor-pointer group">
                                <input type="radio" name="targetMode" checked={targetMode === 'APPEND'} onChange={() => setTargetMode('APPEND')} className="mt-1" />
                                <div><span className="block text-sm font-bold text-white group-hover:text-amber-400">Mesclar em Existente</span><span className="text-xs text-slate-500">Adiciona questões em card já criado.</span></div>
                            </label>
                        </div>

                        {targetMode === 'APPEND' && (
                            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl animate-fade-in">
                                <input type="text" placeholder="Filtrar cards..." value={cardSearchTerm} onChange={e => setCardSearchTerm(e.target.value)} className="w-full bg-black/20 border border-amber-500/30 rounded-lg p-2 text-xs text-white mb-2 focus:border-amber-500 outline-none" />
                                <div className="max-h-40 overflow-y-auto custom-scrollbar bg-black/20 rounded-lg border border-white/5">
                                    {availableCards.map(c => (
                                        <button key={c.id} onClick={() => setSelectedTargetCardId(c.id)} className={`w-full text-left p-2 text-xs border-b border-white/5 last:border-0 ${selectedTargetCardId === c.id ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}>{c.article} ({c.id})</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <textarea value={text} onChange={(e) => { setText(e.target.value); setReport(null); }} rows={12} className={`w-full bg-black/40 border-2 rounded-[2rem] p-6 font-mono text-xs text-sky-100 outline-none focus:border-sky-500/50 transition-all ${hasCriticalErrors ? 'border-rose-500/50' : 'border-white/5'}`} placeholder="Cole aqui seu conteúdo..." />

                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setText(''); setReport(null); }} className="p-5 rounded-2xl bg-white/5 text-slate-500 hover:text-rose-400 transition-colors"><TrashIcon className="w-6 h-6" /></button>
                            <button onClick={handleAnalyze} disabled={targetMode === 'APPEND' && !selectedTargetCardId} className="bg-sky-600 hover:bg-sky-500 text-white font-black px-12 py-5 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50">Analisar Texto</button>
                        </div>
                    </div>
                )}
            </div>

            {activeTab === 'IMPORT' && report && (
                <div className={`bg-slate-900 border p-10 rounded-[3.5rem] space-y-8 animate-fade-in-up ${hasCriticalErrors ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                         <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter">Resultado da Análise</h4>
                         <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
                            {['SKIP', 'MERGE', 'OVERWRITE'].map(opt => (
                                <button key={opt} onClick={() => setImportMode(opt as ImportMode)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${importMode === opt ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{opt}</button>
                            ))}
                         </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Cards', val: report.stats.cards, color: 'text-sky-400' },
                            { label: 'Questões', val: report.stats.questions, color: 'text-indigo-400' },
                            { label: 'Flashcards', val: report.stats.flashcards, color: 'text-teal-400' },
                            { label: 'Pares', val: report.stats.pairs, color: 'text-violet-400' },
                            { label: 'Lacunas', val: report.stats.gaps, color: 'text-amber-400' },
                        ].map(s => (
                            <div key={s.label} className="bg-white/5 p-5 rounded-[2rem] text-center border border-white/5">
                                <span className={`block text-3xl font-black ${s.color}`}>{s.val}</span>
                                <span className="text-[8px] text-slate-500 uppercase font-black tracking-[0.2em]">{s.label}</span>
                            </div>
                        ))}
                    </div>
                    {!hasCriticalErrors && <button onClick={handleConfirmImport} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-3xl shadow-2xl transition-all uppercase tracking-widest text-xs">Confirmar Importação</button>}
                </div>
            )}
        </div>
    );
};

export default ImportLiteralness;
