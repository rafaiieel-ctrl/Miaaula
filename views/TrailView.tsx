
import React, { useState, useMemo, useEffect } from 'react';
import { useTrailState, useTrailDispatch } from '../contexts/TrailContext';
import { useQuestionDispatch, useQuestionState } from '../contexts/QuestionContext';
import { useFlashcardDispatch, useFlashcardState } from '../contexts/FlashcardContext';
import { useLiteralnessDispatch, useLiteralnessState } from '../contexts/LiteralnessContext'; 
import { useSettings } from '../contexts/SettingsContext';
import { LessonNode, Question, Flashcard, SubjectTrail, AppSettings, StudyRef, LiteralnessCard, ImportReport, ImportStagingData } from '../types';
import { 
    RoadIcon, PlusIcon, ChevronRightIcon, CheckCircleIcon, 
    BrainIcon, UploadIcon, SparklesIcon, 
    XMarkIcon, TrashIcon,
    PencilIcon, ClockIcon, ExclamationTriangleIcon,
    ClipboardDocumentCheckIcon, ChevronDownIcon, DocumentDuplicateIcon
} from '../components/icons';
import LessonDetailView from '../components/trail/LessonDetailView';
import ConfirmationModal from '../components/ConfirmationModal';
import ImportReportModal from '../components/trail/ImportReportModal';
import * as srs from '../services/srsService';
import { generateImportReport, sanitizeLessonNode } from '../services/trailImportService'; 
import * as idGen from '../services/idGenerator'; 
import { normalizeDiscipline } from '../services/taxonomyService'; 

type ViewMode = 'list' | 'import';
const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

// Helper to clean JSON Input
const cleanJsonInput = (str: string): string => {
    let cleaned = str.trim();
    cleaned = cleaned.replace(/^(code|json|javascript|js|typescript)\s*/i, '');
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
    
    // Only attempt JSON cleanup if it actually looks like JSON
    if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
        const firstBrace = cleaned.search(/[{[]/);
        if (firstBrace !== -1) {
            const lastBrace = cleaned.lastIndexOf(cleaned[firstBrace] === '{' ? '}' : ']');
            if (lastBrace !== -1) {
                cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            }
        }
    }
    return cleaned.trim();
};

const SAMPLE_IMPORT = `LIT_REF: CTN_ART_141
LAW_ID: Direito Tributario
ARTICLE: Art. 141
TOPIC: Credito Tributario
PHASE1_FULL: Art. 141. O crédito tributário regularmente constituído somente se modifica ou extingue, ou tem sua exigibilidade suspensa ou excluída, nos casos previstos nesta Lei.
RESUMO_POR_PARTES: 1) O crédito regularmente constituído é indisponível; 2) Só pode ser alterado nos casos da Lei.
KEYWORDS_PROVA: crédito tributário; somente se modifica; exigibilidade suspensa.
RISCO_FCC: Afirmar que a autoridade pode dispensar o crédito por conveniência.
GANCHO_MNEMONICO: Crédito Constituído é Pedra. Só a Lei quebra a Pedra.
STORYTELLING: CENA: Um auditor com uma borracha tentando apagar uma dívida.
FEYNMAN: O crédito é um bem público indisponível.

PHASE2_LACUNA_01: O crédito tributário {{regularmente constituído}} somente se modifica ou extingue...
PHASE2_CORRECT_01: D
PHASE2_OPT_A_01: definitivamente julgado
PHASE2_OPT_B_01: parcialmente pago
PHASE2_OPT_C_01: sujeito a recurso
PHASE2_OPT_D_01: regularmente constituído
PHASE2_OPT_E_01: inscrito em dívida

PHASE2_LACUNA_02: ...nos casos previstos {{nesta Lei}}, fora dos quais não podem ser dispensadas...
PHASE2_CORRECT_02: E
PHASE2_OPT_A_02: em regulamento
PHASE2_OPT_B_02: em portaria
PHASE2_OPT_C_02: na Constituição
PHASE2_OPT_D_02: em decreto
PHASE2_OPT_E_02: nesta Lei

PHASE2_LACUNA_03: ...sob pena de {{responsabilidade funcional}} na forma da lei...
PHASE2_CORRECT_03: B
PHASE2_OPT_A_03: nulidade relativa
PHASE2_OPT_B_03: responsabilidade funcional
PHASE2_OPT_C_03: demissão sumária
PHASE2_OPT_D_03: multa pecuniária
PHASE2_OPT_E_03: improbidade administrativa

PHASE2_LACUNA_04: ...a sua {{efetivação}} ou as respectivas garantias.
PHASE2_CORRECT_04: D
PHASE2_OPT_A_04: constituição
PHASE2_OPT_B_04: fiscalização
PHASE2_OPT_C_04: homologação
PHASE2_OPT_D_04: efetivação
PHASE2_OPT_E_04: inscrição

PHASE2_LACUNA_05: ...tem sua exigibilidade {{suspensa}} ou excluída...
PHASE2_CORRECT_05: C
PHASE2_OPT_A_05: renovada
PHASE2_OPT_B_05: interrompida
PHASE2_OPT_C_05: suspensa
PHASE2_OPT_D_05: anistiada
PHASE2_OPT_E_05: perdoada

PHASE2_LACUNA_06: ...fora dos quais não podem ser {{dispensadas}}, sob pena de responsabilidade...
PHASE2_CORRECT_06: A
PHASE2_OPT_A_06: dispensadas
PHASE2_OPT_B_06: exigidas
PHASE2_OPT_C_06: arbitradas
PHASE2_OPT_D_06: parceladas
PHASE2_OPT_E_06: executadas

Q_REF: CTN_ART_141_Q01
DISCIPLINE: Direito Tributario
SUBJECT: Credito Tributario
TOPIC: Disposicoes Gerais
TYPE: 01 Conceitual
BANK_STYLE: FCC
LAW_REF: CTN_ART_141
Q_TEXT: O crédito tributário regularmente constituído somente se modifica ou extingue, ou tem sua exigibilidade suspensa ou excluída:
A: Mediante decisão discricionária.
B: Nos casos previstos nesta Lei.
C: Por conveniência administrativa.
D: Através de decreto.
E: Por equidade.
CORRECT: B
EXPLANATION_TECH: O art. 141 consagra a indisponibilidade. Só lei altera.
GUIA_TRAPSCAN: P1=COMANDO: Condição de alteração; P2=TRAP: T (Texto); P3=ÂNCORA: "casos previstos nesta Lei".
WRONG_DIAGNOSIS_MAP: A=Erro: Discricionariedade não permitida.

...(Repetir Q02..Q20)...
...(Repetir FC01..FC06)...
...(Repetir PAIR01..PAIR06)...

PARTS_SUMMARY: 1) Crédito é indisponível; 2) Só lei altera; 3) Pena funcional.`;

// ... (CoverSelectionModal, EditTrailModal, etc. maintained as in existing code) ...
const COVER_PRESETS = [
    "linear-gradient(135deg, #FF6B6B 0%, #556270 100%)",
    "linear-gradient(45deg, #12c2e9, #c471ed, #f64f59)",
    "linear-gradient(to right, #2980B9, #6DD5FA, #FFFFFF)",
    "linear-gradient(to right, #8e2de2, #4a00e0)",
    "linear-gradient(to right, #00b09b, #96c93d)",
    "linear-gradient(to right, #fc466b, #3f5efb)",
    "linear-gradient(to right, #c94b4b, #4b134f)",
    "linear-gradient(to right, #11998e, #38ef7d)",
    "linear-gradient(to right, #FC5C7D, #6A82FB)",
    "linear-gradient(to right, #00F260, #0575E6)",
    "linear-gradient(to right, #232526, #414345)",
    "linear-gradient(to right, #0f2027, #203a43, #2c5364)",
    "linear-gradient(to right, #3a6186, #89253e)",
    "linear-gradient(to right, #485563, #29323c)",
    "linear-gradient(to right, #200122, #6f0000)",
    "linear-gradient(to right, #74ebd5, #ACB6E5)",
    "linear-gradient(to right, #ff9966, #ff5e62)",
    "linear-gradient(to right, #eecda3, #ef629f)",
    "linear-gradient(to right, #7f7fd5, #86a8e7, #91eae4)",
    "linear-gradient(to right, #654ea3, #eaafc8)"
];

const CoverSelectionModal: React.FC<{ isOpen: boolean; onClose: () => void; onSelect: (bg: string) => void; onGenerateAI: () => void; isGenerating: boolean; }> = ({ isOpen, onClose, onSelect, onGenerateAI, isGenerating }) => {
    const [customColor, setCustomColor] = useState("#3b82f6");
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-transparent dark:bg-bunker-950 w-full max-w-4xl max-h-[85vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/5" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-bunker-200 dark:border-white/5 flex justify-between items-center bg-transparent dark:bg-bunker-900 sticky top-0 z-10">
                    <div><h3 className="text-xl font-bold text-slate-900 dark:text-white">Escolha a Capa da Trilha</h3><p className="text-sm text-bunker-500 dark:text-bunker-400">Selecione um estilo, cor ou gere com IA.</p></div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-bunker-100 dark:hover:bg-bunker-800 transition-colors"><XMarkIcon /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button onClick={() => onSelect('')} className="h-24 rounded-2xl border-2 border-dashed border-bunker-300 dark:border-bunker-700 flex flex-col items-center justify-center gap-2 text-bunker-500 hover:bg-bunker-100 dark:hover:bg-bunker-800 transition-colors"><TrashIcon className="w-6 h-6" /><span className="text-xs font-bold uppercase tracking-widest">Remover</span></button>
                        <div className="h-24 rounded-2xl border border-bunker-200 dark:border-white/5 bg-bunker-50 dark:bg-bunker-950 flex flex-col items-center justify-center gap-2 relative overflow-hidden">
                            <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="w-8 h-8 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: customColor }}></div>
                            <button onClick={() => onSelect(customColor)} className="text-xs font-bold uppercase text-sky-600 dark:text-sky-400 z-10">Cor Sólida</button>
                        </div>
                        <button onClick={onGenerateAI} disabled={isGenerating} className="h-24 rounded-2xl bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border-2 border-dashed border-sky-500/50 hover:border-sky-500 flex flex-col items-center justify-center gap-2 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all group">
                            {isGenerating ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600"></div> : <><SparklesIcon className="w-6 h-6 group-hover:scale-110 transition-transform" /><span className="text-xs font-bold uppercase">Gerar com IA</span></>}
                        </button>
                    </div>
                    <div><h4 className="text-[10px] font-black text-bunker-500 dark:text-bunker-400 uppercase tracking-[0.3em] mb-4">Modelos Disponíveis</h4><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{COVER_PRESETS.map((preset, idx) => (<button key={idx} onClick={() => onSelect(preset)} className="aspect-video rounded-2xl shadow-sm hover:shadow-lg hover:scale-105 transition-all cursor-pointer ring-2 ring-transparent hover:ring-sky-500" style={{ background: preset }} />))}</div></div>
                </div>
            </div>
        </div>
    );
};

const EditTrailModal: React.FC<{ isOpen: boolean; onClose: () => void; trail: SubjectTrail; onSave: (oldId: string, newId: string, updates: Partial<SubjectTrail>) => void; }> = ({ isOpen, onClose, trail, onSave }) => {
    const [title, setTitle] = useState(trail.id);
    const [themeTag, setThemeTag] = useState(trail.themeTag || '');
    const [description, setDescription] = useState(trail.description || '');

    if (!isOpen) return null;

    const handleSave = () => {
        if (!title.trim()) { alert("O título da aula é obrigatório."); return; }
        onSave(trail.id, title.trim(), { themeTag: themeTag.trim(), description: description.trim() });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[210] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-transparent dark:bg-bunker-950 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/10" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-bunker-100 dark:border-white/5 flex justify-between items-center bg-slate-900/20">
                    <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tighter">Editar Trilha</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><XMarkIcon /></button>
                </header>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Título da Trilha</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-bunker-50 dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-sky-500" placeholder="Ex: FLUÊNCIA DE DADOS" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tag / Tema</label>
                        <input value={themeTag} onChange={e => setThemeTag(e.target.value)} className="w-full bg-bunker-50 dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-sky-500" placeholder="Ex: T.I." />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Descrição Curta</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-bunker-50 dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-3 text-sm outline-none focus:border-sky-500 custom-scrollbar" placeholder="Breve resumo da trilha..." />
                    </div>
                </div>
                <footer className="p-6 bg-slate-900/20 border-t border-bunker-100 dark:border-white/5 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl bg-bunker-100 dark:bg-white/5 text-slate-500 font-bold text-xs uppercase tracking-widest">Cancelar</button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-sky-600 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:bg-sky-500">Salvar Alterações</button>
                </footer>
            </div>
        </div>
    );
};

const getLessonStats = (questionIds: string[] | undefined, flashcardIds: string[] | undefined, allQuestions: Question[], allFlashcards: Flashcard[], settings: AppSettings) => {
    const qIds = questionIds || [];
    const fIds = flashcardIds || [];
    
    const items = [
        ...allQuestions.filter(q => qIds.includes(q.id) || qIds.includes(q.questionRef)),
        ...allFlashcards.filter(fc => fIds.includes(fc.id))
    ];

    if (items.length === 0) return { count: 0, mastery: 0, overdue: 0, nextDate: null };

    const now = new Date();
    const today = srs.todayISO();

    let masterySum = 0;
    let overdue = 0;
    let minDate = items[0].nextReviewDate;

    items.forEach(item => {
        masterySum += srs.calculateCurrentDomain(item, settings);
        
        if (item.nextReviewDate <= today || new Date(item.nextReviewDate) <= now) {
            overdue++;
        }

        if (item.nextReviewDate < minDate) {
            minDate = item.nextReviewDate;
        }
    });

    return {
        count: items.length,
        mastery: masterySum / items.length,
        overdue,
        nextDate: minDate
    };
};

const LessonStatusBadge: React.FC<{ overdue: number, nextDate: string | null, mastery: number }> = ({ overdue, nextDate, mastery }) => {
    let statusEl = null;

    if (overdue > 0) {
        statusEl = (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                <ExclamationTriangleIcon className="w-3 h-3" /> ATR: {overdue}
            </span>
        );
    } else if (nextDate) {
        const now = new Date();
        const next = new Date(nextDate);
        const diffTime = next.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const dayLabel = diffDays <= 0 ? 'Hoje' : diffDays === 1 ? 'Amanhã' : `${diffDays}d`;

        statusEl = (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bunker-100 dark:bg-white/5 border border-bunker-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                <ClockIcon className="w-3 h-3" /> {dayLabel}
            </span>
        );
    }

    let masteryColor = 'text-slate-500';
    if (mastery >= 90) masteryColor = 'text-emerald-500';
    else if (mastery >= 70) masteryColor = 'text-sky-500';
    else if (mastery >= 50) masteryColor = 'text-amber-500';
    else masteryColor = 'text-rose-500';

    return (
        <div className="flex items-center gap-2">
            {statusEl}
            <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${masteryColor} whitespace-nowrap`}>
                <div className={`w-1.5 h-1.5 rounded-full ${masteryColor.replace('text-', 'bg-')}`}></div>
                {Math.round(mastery)}%
            </span>
        </div>
    );
};

// --- UPDATED InlineImportPanel ---
const InlineImportPanel: React.FC<{
    lesson: LessonNode;
    allQuestions: Question[];
    allCards: LiteralnessCard[];
    allFlashcards: Flashcard[];
    settings: AppSettings;
    onAnalyze: (json: string, existingQuestions: Question[], existingCards: LiteralnessCard[], existingFlashcards: Flashcard[], settings: AppSettings, targetLesson: { subjectId: string, title: string, uid?: string }) => { report: ImportReport, staging: ImportStagingData | null };
    onCommit: (staging: ImportStagingData) => void;
    onClose: () => void;
}> = ({ lesson, allQuestions, allCards, allFlashcards, settings, onAnalyze, onCommit, onClose }) => {
    const [json, setJson] = useState('');
    const [report, setReport] = useState<ImportReport | null>(null);
    const [staging, setStaging] = useState<ImportStagingData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAnalyze = () => {
        if (!json.trim()) return;
        setIsProcessing(true);
        try {
            const cleaned = cleanJsonInput(json);
            const result = onAnalyze(cleaned, allQuestions, allCards, allFlashcards, settings, { 
                subjectId: lesson.subjectId, 
                title: lesson.title, 
                uid: lesson.uid 
            });
            setReport(result.report);
            setStaging(result.staging);
        } catch (e: any) {
            alert("Erro ao analisar: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCommit = () => {
        if (staging) {
            onCommit(staging);
            onClose();
        }
    };

    return (
        <div className="mt-4 p-4 bg-bunker-50 dark:bg-bunker-800 rounded-xl border border-bunker-200 dark:border-white/10 animate-fade-in relative z-20 cursor-default shadow-xl" onClick={e => e.stopPropagation()}>
            <textarea 
                className="w-full h-24 text-[10px] p-3 rounded-lg bg-transparent dark:bg-slate-950 border border-bunker-200 dark:border-white/10 outline-none focus:border-sky-500 font-mono resize-none mb-3 text-slate-900 dark:text-white"
                placeholder='Cole o JSON da aula aqui...'
                value={json}
                onChange={e => setJson(e.target.value)}
                disabled={isProcessing}
            />
            <div className="flex justify-between items-center">
                <button onClick={onClose} className="text-[9px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancelar</button>
                <button 
                    onClick={handleAnalyze} 
                    disabled={isProcessing || !json.trim()}
                    className="bg-sky-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                    {isProcessing ? 'Processando...' : 'Analisar Dados'}
                </button>
            </div>
            
            <ImportReportModal 
                isOpen={!!report} 
                onClose={() => setReport(null)} 
                onConfirm={handleCommit} 
                report={report} 
            />
        </div>
    );
};

interface TrailViewProps {
    activeStudyRef?: StudyRef | null;
}

const TrailView: React.FC<TrailViewProps> = ({ activeStudyRef }) => {
    const trails = useTrailState();
    const { addOrUpdateLesson, updateTrailImage, deleteLesson, reorderLessons, updateTrail } = useTrailDispatch();
    const { addBatchQuestions, deleteQuestions } = useQuestionDispatch();
    const { addBatchFlashcards, deleteFlashcards } = useFlashcardDispatch();
    const { addBatchCards } = useLiteralnessDispatch();
    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    const allCards = useLiteralnessState();
    const { settings } = useSettings();

    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedLesson, setSelectedLesson] = useState<LessonNode | null>(null);
    const [importText, setImportText] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
    const [editingTrail, setEditingTrail] = useState<SubjectTrail | null>(null);
    const [targetTrailId, setTargetTrailId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [lessonToDelete, setLessonToDelete] = useState<LessonNode | null>(null);
    const [importTargetId, setImportTargetId] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    
    // Drag & Drop
    const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
    const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);
    
    // Collapse State for Trail Accordions
    const [collapsedTrails, setCollapsedTrails] = useState<Set<string>>(new Set());

    // Report State
    const [report, setReport] = useState<ImportReport | null>(null);
    const [staging, setStaging] = useState<ImportStagingData | null>(null);
    const [stagedLessons, setStagedLessons] = useState<LessonNode[]>([]); // New state for text-parsed lessons

    const activeLesson = useMemo(() => {
        if (!selectedLesson) return null;
        for (const t of trails) {
            const l = t.lessons.find(x => x.id === selectedLesson.id);
            if (l) return l;
        }
        return selectedLesson; 
    }, [trails, selectedLesson]);

    useEffect(() => {
        if (activeStudyRef && activeStudyRef.sourceType === 'TRILHA' && activeStudyRef.target?.trailId) {
            const trail = trails.find(t => t.id === activeStudyRef.target?.trailId);
            if (trail) {
                if (activeStudyRef.target.lessonId) {
                    const lesson = trail.lessons.find(l => l.id === activeStudyRef.target?.lessonId || l.uid === activeStudyRef.target?.lessonId);
                    if (lesson) {
                        setSelectedLesson(lesson);
                    }
                }
            }
        }
    }, [activeStudyRef, trails]);

    const toggleTrail = (id: string) => {
        setCollapsedTrails(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDragStart = (e: React.DragEvent, lessonId: string) => { setDraggedLessonId(lessonId); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver = (e: React.DragEvent, lessonId: string) => { e.preventDefault(); if (lessonId !== dragOverLessonId) setDragOverLessonId(lessonId); };
    const handleDrop = (e: React.DragEvent, subjectId: string, targetLessonId: string) => {
        e.preventDefault();
        if (!draggedLessonId || draggedLessonId === targetLessonId) { setDraggedLessonId(null); setDragOverLessonId(null); return; }
        const trail = trails.find(t => t.id === subjectId);
        if (!trail) return;
        const currentLessons = [...trail.lessons];
        const draggedIdx = currentLessons.findIndex(l => l.id === draggedLessonId);
        const targetIdx = currentLessons.findIndex(l => l.id === targetLessonId);
        if (draggedIdx > -1 && targetIdx > -1) {
            const [movedItem] = currentLessons.splice(draggedIdx, 1);
            currentLessons.splice(targetIdx, 0, movedItem);
            reorderLessons(subjectId, currentLessons);
        }
        setDraggedLessonId(null); setDragOverLessonId(null);
    };

    const handleConfirmDelete = () => {
        if (lessonToDelete) {
            deleteQuestions(lessonToDelete.questionRefs || []);
            deleteFlashcards(lessonToDelete.flashcardRefs || []);
            deleteLesson(lessonToDelete.id);
            setLessonToDelete(null);
        }
    };

    // --- NEW IMPORT HANDLER ---
    const handleCommitImport = (stagingData: ImportStagingData, targetLesson?: LessonNode) => {
        // 1. Commit Data to Stores
        // IMPORTANT: Enforce scope='TRILHA' to isolate from Lei Seca view
        if (stagingData.cards.length > 0) {
            const scopedCards = stagingData.cards.map(c => ({ ...c, scope: 'TRILHA' as const }));
            addBatchCards(scopedCards, [], [], stagingData.gaps);
        }
        
        if (stagingData.questions.length > 0) addBatchQuestions(stagingData.questions, 'MERGE'); // FIXED: MERGE instead of default SKIP
        if (stagingData.flashcards.length > 0) addBatchFlashcards(stagingData.flashcards);

        // 2. Create or Update Lesson
        if (targetLesson) {
             const newQRefs = stagingData.questions.map(q => q.id);
             const newFRefs = stagingData.flashcards.map(f => f.id);
             
             const finalQRefs = [...new Set([...(targetLesson.questionRefs || []), ...newQRefs])];
             const finalFRefs = [...new Set([...(targetLesson.flashcardRefs || []), ...newFRefs])];

             addOrUpdateLesson({ 
                ...targetLesson, 
                questionRefs: finalQRefs, 
                flashcardRefs: finalFRefs 
             });
        }

        setReport(null);
        setStaging(null);
        setStagedLessons([]);
        setViewMode('list');
        alert("Dados importados com sucesso!");
    };
    
    // --- MASS IMPORT ---
    const handleAnalyzeImport = () => {
        if (!importText.trim()) return;
        setIsImporting(true);
        try {
            const context = {
                subjectId: 'GERAL',
                title: 'Importação em Massa',
                uid: `uid_${Date.now()}`
            };

            const result = generateImportReport(importText, allQuestions, allCards, allFlashcards, settings, context);
            setReport(result.report);
            setStaging(result.staging);
            if (result.lessons) {
                setStagedLessons(result.lessons);
            }
            
        } catch (e: any) {
            alert(`Erro na análise: ${e.message}`);
        }
        setIsImporting(false);
    };
    
    // --- FIX: SANITIZE & SPLIT LOGIC ---
    const handleMassCommit = () => {
        if (!staging) return;
        
        // 1. Commit Content (Heavy) to Stores
        handleCommitImport(staging); // Saves questions/cards/etc but DOES NOT save LessonNodes
        
        // 2. Create Clean LessonNodes
        // Priority: Use Staged Lessons (Text Parser) > Fallback to JSON Parsing
        try {
            if (stagedLessons.length > 0) {
                 stagedLessons.forEach(lesson => addOrUpdateLesson(lesson));
            } else {
                 const data = JSON.parse(cleanJsonInput(importText));
                 const items = Array.isArray(data) ? data : [data];
                 
                 items.forEach((item: any, idx: number) => {
                     if (item.subjectId && item.title) {
                         const lessonQuestions = staging.questions.filter(q => (q as any)._moduleIndex === idx);
                         const lessonFlashcards = staging.flashcards.filter(f => (f as any)._moduleIndex === idx);
                         
                         const cleanLesson = sanitizeLessonNode(item, {
                            questions: lessonQuestions.map(q => q.id),
                            flashcards: lessonFlashcards.map(f => f.id)
                         });
                         addOrUpdateLesson(cleanLesson);
                     }
                });
            }
        } catch (e) {
            console.error("Error creating lessons objects", e);
        }
    };

    const handleCopyTemplate = () => {
        navigator.clipboard.writeText(SAMPLE_IMPORT).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    if (viewMode === 'import') {
        return (
            <div className="max-w-3xl mx-auto p-6 bg-bunker-100 dark:bg-bunker-900 rounded-3xl space-y-4">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Importar Aula (Padrão Lei Seca)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Cole o conteúdo no formato <code>CHAVE: VALOR</code>. O sistema criará os Cards, Questões e Pares automaticamente. <br/>
                    <span className="opacity-50">Compatível também com JSON legado.</span>
                </p>
                <div className="flex justify-end mb-2">
                    <button 
                        onClick={handleCopyTemplate} 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${copySuccess ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'}`}
                    >
                        {copySuccess ? <CheckCircleIcon className="w-3 h-3" /> : <DocumentDuplicateIcon className="w-3 h-3" />}
                        {copySuccess ? 'Copiado!' : 'Copiar Modelo'}
                    </button>
                </div>
                <textarea 
                    className="w-full h-96 p-4 bg-transparent dark:bg-slate-950 border border-white/5 rounded-2xl font-mono text-xs outline-none focus:ring-2 focus:ring-sky-500" 
                    value={importText} 
                    onChange={e => setImportText(e.target.value)} 
                    placeholder={SAMPLE_IMPORT} 
                />
                <div className="flex justify-end gap-3">
                    <button onClick={() => setViewMode('list')} className="px-4 py-2 rounded-xl text-sm font-bold bg-bunker-200 dark:bg-bunker-800">Cancelar</button>
                    <button onClick={handleAnalyzeImport} disabled={isImporting} className="px-6 py-2 bg-sky-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg">
                        {isImporting ? 'Analisando...' : 'Analisar'}
                    </button>
                </div>
                
                {/* Global Import Report Modal */}
                <ImportReportModal 
                    isOpen={!!report} 
                    onClose={() => setReport(null)} 
                    onConfirm={handleMassCommit} 
                    report={report} 
                />
            </div>
        );
    }
    
    // ... (rest of the component remains same) ...

    if (activeLesson) return <LessonDetailView lesson={activeLesson} onBack={() => setSelectedLesson(null)} />;

    return (
        <>
            <div className="space-y-10 max-w-5xl mx-auto pb-20 pt-6 animate-fade-in">
                {/* ... existing trail view list render ... */}
                <div className="flex justify-between items-center px-4 text-slate-900 dark:text-white">
                    <div><h2 className="text-3xl font-black flex items-center gap-3"><RoadIcon className="text-amber-500 w-8 h-8" /> Trilhas</h2><p className="text-sm text-bunker-500 dark:text-bunker-400 font-medium">Cronograma de aulas estruturadas.</p></div>
                    <button onClick={() => setViewMode('import')} className="flex items-center gap-2 bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-5 rounded-2xl transition-all shadow-sm active:scale-95"><PlusIcon /> Importar Aula</button>
                </div>

                {trails.length === 0 ? (
                    <div className="text-center py-24 border-2 border-dashed border-bunker-200 dark:border-bunker-800 rounded-[3rem] bg-bunker-50/50 dark:bg-bunker-900/20"><RoadIcon className="w-12 h-12 mx-auto mb-4 text-bunker-400" /><p className="text-bunker-600 dark:text-bunker-300 font-bold text-xl">Sua jornada começa aqui</p><button onClick={() => setViewMode('import')} className="mt-4 text-sky-500 font-black uppercase tracking-widest text-xs hover:underline">Importar Aula</button></div>
                ) : (
                    <div className="space-y-16">
                        {trails.map(trail => {
                            const completed = trail.lessons.filter(l => l.status === 'mastered').length;
                            const progress = trail.lessons.length > 0 ? (completed / trail.lessons.length) * 100 : 0;
                            const imageStyle = trail.themeImage?.includes('gradient') || trail.themeImage?.startsWith('#') ? { background: trail.themeImage } : undefined;
                            const isCollapsed = collapsedTrails.has(trail.id);
                            
                            const allQIds = trail.lessons.flatMap(l => l.questionRefs || []);
                            const allFIds = trail.lessons.flatMap(l => l.flashcardRefs || []);
                            const trailStats = getLessonStats(allQIds, allFIds, allQuestions, allFlashcards, settings);

                            return (
                                <div key={trail.id} className="relative group">
                                    <div 
                                        onClick={() => toggleTrail(trail.id)}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden relative z-10"
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-6">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/5 dark:to-white/10 flex items-center justify-center text-3xl shadow-inner shrink-0" style={imageStyle}>
                                                    {!imageStyle && <RoadIcon className="w-8 h-8 text-slate-400" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-[clamp(1.25rem,5.5vw,2rem)] font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-[1.1] line-clamp-2 [overflow-wrap:anywhere] [hyphens:auto]">{trail.id}</h3>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[clamp(0.65rem,2.8vw,0.8125rem)] font-bold text-slate-500 uppercase tracking-widest">
                                                        <span className="whitespace-nowrap">{completed}/{trail.lessons.length} CONCLUÍDAS</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block"></span>
                                                        <span className="text-slate-700 dark:text-slate-300 whitespace-nowrap">{Math.round(progress)}% PROGRESSO</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 dark:border-white/5">
                                                <LessonStatusBadge overdue={trailStats.overdue} nextDate={trailStats.nextDate} mastery={trailStats.mastery} />
                                                <div className="flex items-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingTrail(trail); }} className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-sky-500 transition-colors"><PencilIcon className="w-4 h-4"/></button>
                                                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:text-white transition-colors">
                                                        {isCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-sky-500 shadow-[0_0_10px_#0ea5e9] transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="relative pl-8 md:pl-12 mt-8 space-y-8 animate-fade-in">
                                            <div className="absolute left-[29px] md:left-[45px] top-[-20px] bottom-0 w-0.5 bg-slate-200 dark:bg-white/10 z-0"></div>

                                            {trail.lessons.map((lesson, idx) => {
                                                const lStats = getLessonStats(lesson.questionRefs || [], lesson.flashcardRefs || [], allQuestions, allFlashcards, settings);
                                                const isMastered = lesson.status === 'mastered';
                                                const isNext = !isMastered && (idx === 0 || trail.lessons[idx - 1].status === 'mastered');

                                                return (
                                                    <div 
                                                        key={lesson.uid || lesson.id} 
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, lesson.id)}
                                                        onDragOver={(e) => handleDragOver(e, lesson.id)}
                                                        onDrop={(e) => handleDrop(e, trail.id, lesson.id)}
                                                        className={`relative group/lesson transition-all duration-500 ${draggedLessonId === lesson.id ? 'opacity-30' : ''}`}
                                                    >
                                                        <div className={`absolute left-[-21px] md:left-[-25px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-[#020617] z-10 shadow-lg ${isMastered ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : isNext ? 'bg-sky-500 animate-pulse' : 'bg-slate-700'}`}></div>

                                                        <div 
                                                            onClick={() => setSelectedLesson(lesson)}
                                                            className={`ml-4 p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden group-hover/lesson:scale-[1.01] 
                                                                ${isMastered 
                                                                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' 
                                                                    : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/5 hover:border-sky-500/30 shadow-lg hover:shadow-2xl'
                                                                }`}
                                                        >
                                                            <div className="flex justify-between items-start mb-4 gap-4">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] block mb-1">Aula {String(idx + 1).padStart(2, '0')}</span>
                                                                    <h4 className="text-[clamp(1rem,4.5vw,1.125rem)] font-black text-slate-900 dark:text-white leading-[1.2] line-clamp-2 [overflow-wrap:anywhere] [hyphens:auto]">{lesson.title}</h4>
                                                                    <p className="text-[10px] text-slate-500 mt-1.5 font-bold uppercase tracking-widest opacity-60">{lesson.code}</p>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {(lesson.questionRefs?.length || 0) > 0 && <span className="flex items-center gap-1 text-[9px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-lg border border-indigo-500/10 whitespace-nowrap"><BrainIcon className="w-3 h-3"/> {lesson.questionRefs.length}</span>}
                                                                        {(lesson.flashcardRefs?.length || 0) > 0 && <span className="flex items-center gap-1 text-[9px] font-black bg-teal-500/10 text-teal-400 px-2 py-1 rounded-lg border border-teal-500/10 whitespace-nowrap"><ClipboardDocumentCheckIcon className="w-3 h-3"/> {lesson.flashcardRefs.length}</span>}
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setImportTargetId(lesson.uid || null); }}
                                                                        className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all ${importTargetId === lesson.uid ? 'text-sky-500 bg-sky-500/10' : ''}`}
                                                                    >
                                                                        <UploadIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5 gap-3">
                                                                <LessonStatusBadge overdue={lStats.overdue} nextDate={lStats.nextDate} mastery={lStats.mastery} />
                                                                <div className={`p-2 rounded-full border transition-all shrink-0 ${isMastered ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 group-hover/lesson:border-sky-500 group-hover/lesson:text-sky-500'}`}>
                                                                    {isMastered ? <CheckCircleIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                                                </div>
                                                            </div>

                                                            {lesson.uid === importTargetId && (
                                                                <InlineImportPanel 
                                                                    lesson={lesson}
                                                                    allQuestions={allQuestions}
                                                                    allCards={allCards}
                                                                    allFlashcards={allFlashcards}
                                                                    settings={settings}
                                                                    onAnalyze={generateImportReport}
                                                                    onCommit={(data) => handleCommitImport(data, lesson)}
                                                                    onClose={() => setImportTargetId(null)}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            
                                            <div className="relative group/add pt-4">
                                                <div className="absolute left-[-21px] md:left-[-25px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-[#020617] bg-slate-800 z-10"></div>
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation();
                                                        const newOrder = trail.lessons.length + 1;
                                                        const newLessonId = `L_${slugify(trail.id)}_NEW_${Date.now()}`;
                                                        const newLesson: LessonNode = {
                                                            id: newLessonId,
                                                            uid: `uid_${Date.now()}`,
                                                            subjectId: trail.id,
                                                            title: 'Nova Aula',
                                                            code: `Aula ${String(newOrder).padStart(2, '0')}`,
                                                            order: newOrder,
                                                            status: 'not_started',
                                                            domainLevel: 0,
                                                            keyPoints: [], summary: [], explanations: [],
                                                            questionRefs: [], flashcardRefs: []
                                                        };
                                                        addOrUpdateLesson(newLesson);
                                                        setSelectedLesson(newLesson);
                                                    }}
                                                    className="ml-4 w-full py-4 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em] hover:border-sky-500 hover:text-sky-500 hover:bg-sky-500/5 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <PlusIcon className="w-4 h-4" /> Adicionar Aula
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* ... Modals ... */}
            {editingTrail && (
                <EditTrailModal isOpen={!!editingTrail} onClose={() => setEditingTrail(null)} trail={editingTrail} onSave={updateTrail} />
            )}
            {isCoverModalOpen && (
                <CoverSelectionModal isOpen={isCoverModalOpen} onClose={() => setIsCoverModalOpen(false)} onSelect={(bg) => { if(targetTrailId) updateTrailImage(targetTrailId, bg); setIsCoverModalOpen(false); }} onGenerateAI={() => {}} isGenerating={isGenerating} />
            )}
            <ConfirmationModal isOpen={!!lessonToDelete} onClose={() => setLessonToDelete(null)} onConfirm={handleConfirmDelete} title="Excluir Aula?">
                <div className="space-y-2"><p>Tem certeza que deseja excluir <strong>{lessonToDelete?.title}</strong>?</p><p className="text-xs text-rose-500">As questões e flashcards associados serão removidos do banco de dados.</p></div>
            </ConfirmationModal>
        </>
    );
};

export default TrailView;
