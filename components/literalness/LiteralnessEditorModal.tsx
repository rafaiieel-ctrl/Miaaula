
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { LiteralnessCard, Question, Flashcard, Gap, StudyStep } from '../../types';
import { useQuestionState, useQuestionDispatch } from '../../contexts/QuestionContext';
import { useFlashcardState, useFlashcardDispatch } from '../../contexts/FlashcardContext';
import { useLiteralnessDispatch } from '../../contexts/LiteralnessContext';
import { XMarkIcon, DocumentDuplicateIcon, ChevronLeftIcon, PlusIcon, TrashIcon, PencilIcon, SearchIcon, CheckCircleIcon, UploadIcon, BoltIcon } from '../icons';
import EditQuestionModal from '../EditQuestionModal';
import * as srs from '../../services/srsService';

interface LiteralnessEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    card: LiteralnessCard;
}

interface DraftState {
    phase1Full: string;
    storytelling: string;
    feynman: string;
    partsSummary: string;
    keywordsProva: string;
    riscoFcc: string;
    gancho: string;
    gaps: Gap[];
    flow: StudyStep[];
    questions: Question[];
    flashcards: Flashcard[];
    pairs: Flashcard[];
}

type EditorView = 'MAIN' | 'QUESTIONS' | 'FLASHCARDS' | 'GAPS' | 'PAIRS';

const LiteralnessEditorModal: React.FC<LiteralnessEditorModalProps> = ({ isOpen, onClose, card }) => {
    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    const { updateCard } = useLiteralnessDispatch();
    const { addQuestion, addBatchQuestions } = useQuestionDispatch();
    const { addFlashcard, updateFlashcard, addBatchFlashcards } = useFlashcardDispatch();

    const [activeView, setActiveView] = useState<EditorView>('MAIN');
    const [draft, setDraft] = useState<DraftState>({
        phase1Full: '', storytelling: '', feynman: '', partsSummary: '',
        keywordsProva: '', riscoFcc: '', gancho: '', gaps: [], flow: [],
        questions: [], flashcards: [], pairs: []
    });
    
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [tempItemData, setTempItemData] = useState<any>(null);
    
    const [isImporting, setIsImporting] = useState(false);
    const [importText, setImportText] = useState('');
    const [importReport, setImportReport] = useState<{ valid: number, type: string } | null>(null);

    useEffect(() => {
        if (isOpen && card) {
            console.log(`[Editor] Opening nucleus: ${card.id} (${card.lawId} ${card.article})`);
            
            // USE SOURCE OF TRUTH (LIT_REF LINKAGE)
            // This replaces the old fragile filtering and ensures we see exactly what the Game sees.
            const relQuestions = srs.getQuestionsForCard(card, allQuestions);
            const relFlash = srs.getFlashcardsForCard(card, allFlashcards);
            const relPairs = srs.getPairsForCard(card, allFlashcards);
            
            console.log(`[Editor] Found: ${relQuestions.length} Qs, ${relFlash.length} FCs, ${relPairs.length} Pairs`);

            // Gaps are stored on the card itself (extraGaps), or legacy phase2
            const initialGaps = Array.isArray(card.extraGaps) 
                ? card.extraGaps.map((g: any, i) => ({ ...g, id: g.id || `gap_${i}` })) 
                : (card.phase2Lacuna ? [{ text: card.phase2Lacuna, options: card.phase2Options || { A:'',B:'',C:'',D:'',E:'' }, correct: card.phase2Correct || 'A', id: 'main' }] : []);

            setDraft({
                phase1Full: card.phase1Full || '',
                storytelling: card.storytelling || '',
                feynman: card.feynmanExplanation || '',
                partsSummary: card.partsSummary || '',
                keywordsProva: card.keywordsProva || '',
                riscoFcc: card.riscoFcc || '',
                gancho: card.gancho || '',
                gaps: initialGaps as Gap[],
                flow: card.studyFlow || [],
                questions: relQuestions,
                flashcards: relFlash,
                pairs: relPairs
            });
            setActiveView('MAIN');
        }
    }, [isOpen, card, allQuestions, allFlashcards]);

    const handleSave = () => {
        if (!card) return;
        
        const updatedCard: LiteralnessCard = {
            ...card,
            phase1Full: draft.phase1Full,
            storytelling: draft.storytelling,
            feynmanExplanation: draft.feynman,
            partsSummary: draft.partsSummary,
            keywordsProva: draft.keywordsProva,
            riscoFcc: draft.riscoFcc,
            gancho: draft.gancho,
            extraGaps: draft.gaps,
            // Update cache array for legacy support, but source of truth remains lawRef on Questions
            questionIds: draft.questions.map(q => q.id)
        };
        
        console.log(`[Editor] Saving nucleus ${card.id} with ${draft.questions.length} linked questions.`);
        updateCard(updatedCard);
        onClose();
    };

    const handleChange = (field: keyof DraftState, value: any) => {
        setDraft(prev => ({ ...prev, [field]: value }));
    };

    const handleBatchImport = () => {
        if (!importText.trim()) return;
        const lines = importText.split('\n').filter(l => l.trim());
        const blocks = importText.split(/(?:^---$)|(?=^(?:Q_REF|FC_REF|PAIR_REF|PHASE2_LACUNA_01):)/m).filter(b => b.trim().length > 5);
        
        const today = srs.todayISO();
        let addedCount = 0;

        if (activeView === 'QUESTIONS') {
            const newQuestions: Omit<Question, 'id'>[] = [];
            
            if (importText.includes('Q_REF:')) {
                blocks.forEach((block, idx) => {
                    const fields: Record<string, string> = {};
                    block.split('\n').forEach(line => {
                        const match = line.match(/^([A-Z0-9_]+)\s*:\s*(.*)/i);
                        if (match) fields[match[1].toUpperCase()] = match[2].trim();
                    });

                    if (fields.Q_TEXT && fields.CORRECT) {
                        const opts = {
                            A: fields.A || fields.OPT_A || fields.ALT_A,
                            B: fields.B || fields.OPT_B || fields.ALT_B,
                            C: fields.C || fields.OPT_C || fields.ALT_C,
                            D: fields.D || fields.OPT_D || fields.ALT_D,
                            E: fields.E || fields.OPT_E || fields.ALT_E
                        };
                        newQuestions.push({
                            questionRef: fields.Q_REF || `${card.article} Q${idx+1}`,
                            questionText: fields.Q_TEXT,
                            options: opts,
                            correctAnswer: fields.CORRECT.charAt(0).toUpperCase(),
                            explanation: fields.EXPLANATION || '',
                            comments: '',
                            difficultyLevel: 'normal',
                            wrongDiagnosis: fields.WRONG_DIAGNOSIS,
                            subject: card.lawId,
                            topic: card.topic,
                            questionType: fields.TYPE || 'Literalidade',
                            createdAt: today, nextReviewDate: today, totalAttempts: 0, masteryScore: 0,
                            srsVersion: 2, stability: 1, attemptHistory: [], sequenceNumber: 0,
                            bank: '', position: '', area: card.lawId, hotTopic: false, isCritical: false, isFundamental: false,
                            lastAttemptDate: '', lastWasCorrect: false, recentError: 0, timeSec: 0, selfEvalLevel: 0,
                            willFallExam: false, correctStreak: 0, srsStage: 0, ignoreDuplicatesFor: [], errorCount: 0,
                            lawRef: card.id // CRITICAL: Link to Card
                        });
                    }
                });
            } 
            else {
                lines.forEach((line, idx) => {
                    const parts = line.split('||').map(s => s.trim());
                    if (parts.length >= 7) {
                        newQuestions.push({
                            questionRef: `${card.article} Q${idx+1}`,
                            questionText: parts[0],
                            options: { A: parts[1], B: parts[2], C: parts[3], D: parts[4], E: parts[5] },
                            correctAnswer: parts[6].toUpperCase(),
                            explanation: parts[7] || '',
                            comments: '',
                            difficultyLevel: 'normal',
                            subject: card.lawId,
                            topic: card.topic,
                            questionType: 'Literalidade',
                            createdAt: today, nextReviewDate: today, totalAttempts: 0, masteryScore: 0,
                            srsVersion: 2, stability: 1, attemptHistory: [], sequenceNumber: 0,
                            bank: '', position: '', area: card.lawId, hotTopic: false, isCritical: false, isFundamental: false,
                            lastAttemptDate: '', lastWasCorrect: false, recentError: 0, timeSec: 0, selfEvalLevel: 0,
                            willFallExam: false, correctStreak: 0, srsStage: 0, ignoreDuplicatesFor: [], errorCount: 0,
                            lawRef: card.id // CRITICAL: Link to Card
                        });
                    }
                });
            }

            if (newQuestions.length > 0) {
                const withIds = newQuestions.map((q, i) => ({ ...q, id: `temp_q_${Date.now()}_${i}` })) as Question[];
                addBatchQuestions(newQuestions);
                setDraft(prev => ({ ...prev, questions: [...prev.questions, ...withIds] }));
                addedCount = newQuestions.length;
            }
        }
        else if (activeView === 'FLASHCARDS' || activeView === 'PAIRS') {
            const isPair = activeView === 'PAIRS';
            const newCards: Flashcard[] = [];

            if (importText.includes('FRONT:') || importText.includes('PAIR_REF:') || importText.includes('FC_REF:')) {
                blocks.forEach(block => {
                     const fields: Record<string, string> = {};
                     block.split('\n').forEach(line => {
                        const match = line.match(/^([A-Z0-9_]+)\s*:\s*(.*)/i);
                        if (match) fields[match[1].toUpperCase()] = match[2].trim();
                    });
                    
                    if (fields.FRONT && fields.BACK) {
                        newCards.push({
                            id: fields.FC_REF || fields.PAIR_REF || `temp_fc_${Date.now()}_${Math.random()}`,
                            front: fields.FRONT,
                            back: fields.BACK,
                            discipline: card.lawId,
                            topic: card.topic,
                            tags: [card.id, isPair ? 'pair-match' : 'literalness'],
                            type: 'basic', createdAt: today, updatedAt: today, nextReviewDate: today, masteryScore: 0,
                            stability: 1, totalAttempts: 0, attemptHistory: [], recentError: 0, hotTopic: false, 
                            isCritical: false, isFundamental: false, correctStreak: 0, srsStage: 0, lastAttemptDate: '', 
                            pairMatchPlayed: false, timeSec: 0, selfEvalLevel: 0, lastWasCorrect: false, comments: fields.COMMENTS || '',
                            masteryHistory: []
                        });
                    }
                });
            }
            else {
                lines.forEach((line, idx) => {
                    const parts = line.split('||').map(s => s.trim());
                    if (parts.length >= 2) {
                        newCards.push({
                            id: `temp_fc_${Date.now()}_${idx}`,
                            front: parts[0],
                            back: parts[1],
                            discipline: card.lawId,
                            topic: card.topic,
                            tags: [card.id, isPair ? 'pair-match' : 'literalness'],
                            type: 'basic', createdAt: today, updatedAt: today, nextReviewDate: today, masteryScore: 0,
                            stability: 1, totalAttempts: 0, attemptHistory: [], recentError: 0, hotTopic: false, 
                            isCritical: false, isFundamental: false, correctStreak: 0, srsStage: 0, lastAttemptDate: '', 
                            pairMatchPlayed: false, timeSec: 0, selfEvalLevel: 0, lastWasCorrect: false, comments: '',
                            masteryHistory: []
                        });
                    }
                });
            }

            if (newCards.length > 0) {
                addBatchFlashcards(newCards);
                if (isPair) setDraft(prev => ({ ...prev, pairs: [...prev.pairs, ...newCards] }));
                else setDraft(prev => ({ ...prev, flashcards: [...prev.flashcards, ...newCards] }));
                addedCount = newCards.length;
            }
        }
        else if (activeView === 'GAPS') {
            const newGaps: Gap[] = [];
            
            if (importText.includes('PHASE2_LACUNA')) {
                const indices = new Set<string>();
                const matches = importText.matchAll(/PHASE2_LACUNA_(\d+):/g);
                for (const m of matches) indices.add(m[1]);
                
                indices.forEach(idx => {
                    const extract = (key: string) => {
                        const regex = new RegExp(`${key}_${idx}:\\s*(.*)`);
                        const m = importText.match(regex);
                        return m ? m[1].trim() : '';
                    };
                    
                    const text = extract('PHASE2_LACUNA');
                    if (text) {
                        newGaps.push({
                            text,
                            correct: extract('PHASE2_CORRECT') || 'A',
                            options: {
                                A: extract('PHASE2_OPT_A'),
                                B: extract('PHASE2_OPT_B'),
                                C: extract('PHASE2_OPT_C'),
                                D: extract('PHASE2_OPT_D'),
                                E: extract('PHASE2_OPT_E')
                            }
                        });
                    }
                });
            } 
            else {
                lines.forEach(line => {
                    const parts = line.split('||').map(s => s.trim());
                    if (parts.length >= 3) {
                          newGaps.push({
                             text: parts[0],
                             options: { A: parts[1], B: parts[2], C: parts[3] || '', D: parts[4] || '', E: parts[5] || '' },
                             correct: parts[6] || 'A'
                         });
                    }
                });
            }

            if (newGaps.length > 0) {
                setDraft(prev => ({ ...prev, gaps: [...prev.gaps, ...newGaps] }));
                addedCount = newGaps.length;
            }
        }

        setImportReport({ valid: addedCount, type: activeView });
        setTimeout(() => {
            setIsImporting(false);
            setImportText('');
            setImportReport(null);
        }, 1500);
    };

    const handleCreateQuestion = () => {
        const nextSequenceNumber = allQuestions.length > 0 ? Math.max(...allQuestions.map(q => q.sequenceNumber || 0)) + 1 : 1;

        const newQ: Question = {
            id: `temp_q_${Date.now()}`,
            sequenceNumber: nextSequenceNumber,
            lastAttemptDate: '',
            subject: card.lawId,
            topic: card.topic,
            questionRef: `${card.lawId} - Nova`,
            questionText: '',
            options: { A: '', B: '' },
            correctAnswer: 'A',
            bank: '', position: '', area: '', explanation: '', comments: '',
            createdAt: srs.todayISO(), nextReviewDate: srs.todayISO(),
            masteryScore: 0, totalAttempts: 0, lastWasCorrect: false, recentError: 0,
            hotTopic: false, isCritical: false, isFundamental: false, willFallExam: false,
            srsStage: 0, correctStreak: 0, attemptHistory: [], srsVersion: 2,
            stability: 1, timeSec: 0, selfEvalLevel: 0, difficultyLevel: 'normal',
            studyRefs: [{ sourceType: 'LEI_SECA', target: { cardId: card.id }, label: 'Artigo' }],
            ignoreDuplicatesFor: [], errorCount: 0,
            lawRef: card.id, // CRITICAL: Link to Card
            questionType: 'Literalidade'
        };
        
        setEditingQuestion(newQ); 
    };

    const handleUnlinkQuestion = (qId: string) => {
        setDraft(prev => ({ ...prev, questions: prev.questions.filter(q => q.id !== qId) }));
    };

    const handleCreateFlashcard = (type: 'flashcard' | 'pair') => {
        const isPair = type === 'pair';
        const tempId = `temp_${Date.now()}`;
        const newFc: Flashcard = {
            id: tempId,
            discipline: card.lawId,
            topic: card.topic,
            front: '',
            back: '',
            comments: '',
            tags: [card.id, ...(isPair ? ['pair-match'] : [])],
            type: 'basic',
            createdAt: srs.todayISO(), updatedAt: srs.todayISO(), nextReviewDate: srs.todayISO(),
            masteryScore: 0, stability: 1, totalAttempts: 0, lastWasCorrect: false, attemptHistory: [],
            recentError: 0, hotTopic: false, isCritical: false, isFundamental: false, 
            correctStreak: 0, srsStage: 0, lastAttemptDate: '', pairMatchPlayed: false, timeSec: 0, selfEvalLevel: 0,
            masteryHistory: []
        };
        
        if (isPair) setDraft(prev => ({ ...prev, pairs: [newFc, ...prev.pairs] }));
        else setDraft(prev => ({ ...prev, flashcards: [newFc, ...prev.flashcards] }));
        
        setEditingItemIndex(0);
        setTempItemData(newFc);
    };

    const handleSaveInlineItem = (type: 'flashcard' | 'pair' | 'gap') => {
        if (type === 'gap') {
             const newGaps = [...draft.gaps];
             if (editingItemIndex !== null && newGaps[editingItemIndex]) {
                 newGaps[editingItemIndex] = tempItemData;
             } else {
                 newGaps.push(tempItemData);
             }
             setDraft(prev => ({ ...prev, gaps: newGaps }));
        } else {
            const isPair = type === 'pair';
            const list = isPair ? draft.pairs : draft.flashcards;
            const isNew = tempItemData.id.startsWith('temp_');
            
            if (isNew) {
                const { id, ...dataToSave } = tempItemData;
                addFlashcard(dataToSave);
            } else {
                updateFlashcard(tempItemData);
            }
            
            const newList = list.map((item, idx) => idx === editingItemIndex ? tempItemData : item);
            if (isPair) setDraft(prev => ({ ...prev, pairs: newList }));
            else setDraft(prev => ({ ...prev, flashcards: newList }));
        }
        setEditingItemIndex(null);
        setTempItemData(null);
    };

    const handleDeleteInline = (type: 'flashcard' | 'pair' | 'gap', index: number) => {
        if (type === 'gap') {
             setDraft(prev => ({ ...prev, gaps: prev.gaps.filter((_, i) => i !== index) }));
        } else {
            if (type === 'pair') setDraft(prev => ({ ...prev, pairs: prev.pairs.filter((_, i) => i !== index) }));
            else setDraft(prev => ({ ...prev, flashcards: prev.flashcards.filter((_, i) => i !== index) }));
        }
    };

    const renderHeader = (title: string, backToMain = true) => (
        <header className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3">
                {backToMain && (
                    <button onClick={() => setActiveView('MAIN')} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                )}
                <div>
                    <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tighter">{title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{card.lawId} • {card.article}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        </header>
    );

    const renderQuestionsView = () => {
        const filtered = draft.questions.filter(q => 
            q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) || 
            q.questionRef.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
                {renderHeader('Questões Vinculadas')}
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex gap-3 shrink-0">
                    <div className="flex-1 relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar questões..."
                            className="w-full bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 rounded-xl text-sm border border-transparent focus:border-sky-500 outline-none text-slate-900 dark:text-white"
                        />
                    </div>
                    <button onClick={() => setIsImporting(true)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <UploadIcon className="w-4 h-4" /> Importar
                    </button>
                    <button onClick={handleCreateQuestion} className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <PlusIcon className="w-4 h-4" /> Nova
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                    {filtered.map((q) => (
                        <div key={q.id} className="p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500/30 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-black text-sky-500">{q.questionRef}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingQuestion(q)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-sky-400"><PencilIcon className="w-4 h-4"/></button>
                                    <button onClick={() => handleUnlinkQuestion(q.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"><TrashIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 break-words whitespace-pre-wrap">{q.questionText}</p>
                        </div>
                    ))}
                    {filtered.length === 0 && <p className="text-center text-slate-500 py-10">Nenhuma questão encontrada.</p>}
                </div>
            </div>
        );
    };

    const renderInlineListEditor = (
        items: any[], 
        type: 'flashcard' | 'pair' | 'gap', 
        renderItem: (item: any) => React.ReactNode,
        renderForm: (data: any, onChange: (d: any) => void) => React.ReactNode
    ) => {
        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
                {renderHeader(type === 'gap' ? 'Lacunas' : type === 'pair' ? 'Pares' : 'Flashcards')}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-white dark:bg-slate-900 shrink-0">
                    <button onClick={() => setIsImporting(true)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <UploadIcon className="w-4 h-4" /> Importar
                    </button>
                    <button 
                        onClick={() => {
                            if (type === 'gap') {
                                setTempItemData({ text: 'Texto com {{lacuna}}...', options: {A:'', B:''}, correct: 'A' });
                                setEditingItemIndex(draft.gaps.length);
                            } else {
                                handleCreateFlashcard(type as 'flashcard'|'pair');
                            }
                        }}
                        className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                        <PlusIcon className="w-4 h-4" /> Adicionar
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                    {items.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-4 transition-all">
                            {editingItemIndex === idx ? (
                                <div className="space-y-4 animate-fade-in">
                                    {renderForm(tempItemData || item, (d) => setTempItemData(d))}
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => { setEditingItemIndex(null); setTempItemData(null); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Cancelar</button>
                                        <button onClick={() => handleSaveInlineItem(type)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">Salvar</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start group">
                                    <div className="flex-1 cursor-pointer break-words" onClick={() => { setEditingItemIndex(idx); setTempItemData(item); }}>
                                        {renderItem(item)}
                                    </div>
                                    <button onClick={() => handleDeleteInline(type, idx)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && <p className="text-center text-slate-500 py-10">Nenhum item cadastrado.</p>}
                </div>
            </div>
        );
    };

    const renderGapsView = () => renderInlineListEditor(
        draft.gaps, 'gap',
        (gap) => (
            <>
                <p className="text-sm font-serif text-slate-700 dark:text-slate-300 mb-1 whitespace-pre-wrap">{gap.text}</p>
                <div className="flex gap-2 text-[10px] text-slate-500 font-mono">
                    <span className="text-emerald-500">Resp: {gap.correct}</span>
                    <span>{Object.keys(gap.options||{}).length} opções</span>
                </div>
            </>
        ),
        (data, onChange) => (
            <div className="space-y-3">
                <textarea 
                    value={data.text} 
                    onChange={e => onChange({...data, text: e.target.value})} 
                    className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500" 
                    rows={2} 
                    placeholder="Texto com {{resposta}}"
                />
                <div className="grid grid-cols-2 gap-2">
                    {['A','B','C','D','E'].map(opt => (
                        <div key={opt} className="flex gap-2 items-center">
                            <span className={`text-xs font-bold ${data.correct === opt ? 'text-emerald-500' : 'text-slate-500'}`}>{opt})</span>
                            <input 
                                value={data.options?.[opt] || ''} 
                                onChange={e => onChange({...data, options: {...data.options, [opt]: e.target.value}})}
                                className="flex-1 bg-slate-50 dark:bg-slate-900 rounded p-1.5 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
                            />
                            <input 
                                type="radio" 
                                name="correctGap" 
                                checked={data.correct === opt} 
                                onChange={() => onChange({...data, correct: opt})} 
                            />
                        </div>
                    ))}
                </div>
            </div>
        )
    );

    const renderFlashcardsView = () => renderInlineListEditor(
        draft.flashcards, 'flashcard',
        (fc) => (
            <>
                <div className="mb-1"><span className="text-[9px] font-bold text-sky-500 uppercase mr-2">Frente</span><span className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{fc.front}</span></div>
                <div><span className="text-[9px] font-bold text-emerald-500 uppercase mr-2">Verso</span><span className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{fc.back}</span></div>
            </>
        ),
        (data, onChange) => (
            <div className="space-y-3">
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold">Frente</label>
                    <textarea value={data.front} onChange={e => onChange({...data, front: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500" rows={2} />
                </div>
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold">Verso</label>
                    <textarea value={data.back} onChange={e => onChange({...data, back: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500" rows={2} />
                </div>
            </div>
        )
    );

    const renderPairsView = () => renderInlineListEditor(
        draft.pairs, 'pair',
        (fc) => (
            <div className="flex items-center gap-4">
                <div className="flex-1"><span className="text-[9px] font-bold text-indigo-500 block mb-0.5">Termo A</span><span className="text-sm text-slate-700 dark:text-slate-300">{fc.front}</span></div>
                <div className="text-slate-400">↔</div>
                <div className="flex-1 text-right"><span className="text-[9px] font-bold text-indigo-500 block mb-0.5">Termo B</span><span className="text-sm text-slate-700 dark:text-slate-300">{fc.back}</span></div>
            </div>
        ),
        (data, onChange) => (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold">Termo A</label>
                    <input value={data.front} onChange={e => onChange({...data, front: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500" />
                </div>
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold">Termo B</label>
                    <input value={data.back} onChange={e => onChange({...data, back: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500" />
                </div>
            </div>
        )
    );

    const importModal = isImporting ? (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsImporting(false)}>
            <div className="bg-white dark:bg-bunker-950 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-bunker-100 dark:border-white/5 flex justify-between items-center bg-slate-900/20">
                    <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tighter">Importar {activeView === 'QUESTIONS' ? 'Questões' : activeView === 'GAPS' ? 'Lacunas' : activeView === 'PAIRS' ? 'Pares' : 'Flashcards'}</h3>
                    <button onClick={() => setIsImporting(false)}><XMarkIcon className="w-5 h-5 text-slate-500"/></button>
                </div>
                <div className="p-6 flex-1 flex flex-col min-h-0">
                    <p className="text-xs text-slate-500 mb-2">
                        Cole o conteúdo abaixo. Use o formato de bloco (CHAVE: Valor) ou o formato simplificado (separado por ||).
                        <br/>
                        <span className="opacity-70">Ex: {activeView === 'QUESTIONS' ? 'Q_TEXT || Alt A || Alt B || ...' : 'Frente || Verso'}</span>
                    </p>
                    <textarea 
                        value={importText} 
                        onChange={e => setImportText(e.target.value)} 
                        className="w-full flex-1 bg-bunker-50 dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-4 text-xs font-mono outline-none focus:border-sky-500 resize-none"
                        placeholder="Cole aqui..."
                    />
                    {importReport && (
                        <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 text-sm font-bold ${importReport.valid > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {importReport.valid > 0 ? <CheckCircleIcon /> : <BoltIcon />}
                            <span>{importReport.valid} itens identificados.</span>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-bunker-100 dark:border-white/5 flex justify-end gap-3 bg-slate-900/20">
                    <button onClick={() => setIsImporting(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white">Cancelar</button>
                    <button onClick={handleBatchImport} className="px-6 py-2 bg-sky-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-sky-500 shadow-lg">Processar Importação</button>
                </div>
            </div>
        </div>
    ) : null;

    if (activeView === 'QUESTIONS') return <><div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 h-full">{renderQuestionsView()}</div>{editingQuestion && <EditQuestionModal question={editingQuestion} onClose={() => setEditingQuestion(null)} onSave={(updatedQ) => { if(updatedQ.id.startsWith('temp_')) { addQuestion(updatedQ); setDraft(prev => ({ ...prev, questions: [...prev.questions, updatedQ] })); } else { setDraft(prev => ({ ...prev, questions: prev.questions.map(q => q.id === updatedQ.id ? updatedQ : q) })); } }} />}</div>{importModal}</>;
    
    if (activeView === 'FLASHCARDS') return <><div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 h-full">{renderFlashcardsView()}</div></div>{importModal}</>;
    
    if (activeView === 'GAPS') return <><div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 h-full">{renderGapsView()}</div></div>{importModal}</>;

    if (activeView === 'PAIRS') return <><div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 h-full">{renderPairsView()}</div></div>{importModal}</>;

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 h-full" onClick={e => e.stopPropagation()}>
                {renderHeader('Editor de Artigo', false)}
                
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar min-h-0">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Texto da Lei (Phase 1)</label>
                            <textarea 
                                value={draft.phase1Full} 
                                onChange={e => handleChange('phase1Full', e.target.value)}
                                rows={4}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 custom-scrollbar font-serif"
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Resumo por Partes</label>
                                <textarea 
                                    value={draft.partsSummary} 
                                    onChange={e => handleChange('partsSummary', e.target.value)}
                                    rows={3}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 custom-scrollbar"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Keywords de Prova</label>
                                <textarea 
                                    value={draft.keywordsProva} 
                                    onChange={e => handleChange('keywordsProva', e.target.value)}
                                    rows={3}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 custom-scrollbar"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Risco FCC / Pegadinhas</label>
                                <textarea 
                                    value={draft.riscoFcc} 
                                    onChange={e => handleChange('riscoFcc', e.target.value)}
                                    rows={3}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 custom-scrollbar"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Gancho Mnemônico</label>
                                <textarea 
                                    value={draft.gancho} 
                                    onChange={e => handleChange('gancho', e.target.value)}
                                    rows={3}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 custom-scrollbar"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Storytelling</label>
                                <textarea 
                                    value={draft.storytelling} 
                                    onChange={e => handleChange('storytelling', e.target.value)}
                                    rows={3}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 custom-scrollbar"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Explicacao Feynman</label>
                                <textarea 
                                    value={draft.feynman} 
                                    onChange={e => handleChange('feynman', e.target.value)}
                                    rows={3}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 custom-scrollbar"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button onClick={() => setActiveView('QUESTIONS')} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group">
                            <span className="block text-2xl font-black text-indigo-500 group-hover:scale-110 transition-transform">{draft.questions.length}</span>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Questões</span>
                        </button>
                        <button onClick={() => setActiveView('FLASHCARDS')} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group">
                            <span className="block text-2xl font-black text-teal-500 group-hover:scale-110 transition-transform">{draft.flashcards.length}</span>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Flashcards</span>
                        </button>
                        <button onClick={() => setActiveView('GAPS')} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group">
                            <span className="block text-2xl font-black text-amber-500 group-hover:scale-110 transition-transform">{draft.gaps.length}</span>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Lacunas</span>
                        </button>
                        <button onClick={() => setActiveView('PAIRS')} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group">
                            <span className="block text-2xl font-black text-violet-500 group-hover:scale-110 transition-transform">{draft.pairs.length}</span>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Pares</span>
                        </button>
                    </div>
                </div>

                <footer className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-sky-600 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:bg-sky-500 transition-colors">Salvar Alterações</button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default LiteralnessEditorModal;
