
import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import * as srs from '../services/srsService';
import * as studyLater from '../services/studyLaterService';
import { 
    XMarkIcon, SearchIcon, FilterIcon, 
    CheckCircleIcon, ExclamationTriangleIcon, 
    BookmarkIcon, EyeIcon, PlayIcon, TrashIcon,
    DownloadIcon, ChartBarIcon, ClockIcon, BoltIcon,
    ChevronDownIcon, ChevronRightIcon
} from './icons';
import MasteryBadge from './MasteryBadge';
import { useSettings } from '../contexts/SettingsContext';
import QuestionActionsMenu, { QuestionContextType } from './QuestionActionsMenu';
import EditQuestionModal from './EditQuestionModal';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { getText } from '../utils/i18nText';

interface QuestionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questions: Question[];
  onPreview: (q: Question) => void;
  onPractice: (q: Question) => void;
  context: QuestionContextType; // Explicit Context Required
}

type FilterType = 'all' | 'wrong' | 'correct' | 'marked' | 'critical';

// ... (Helper functions checkIsWrong, checkIsRight, checkIsCritical remain same)
const checkIsWrong = (q: Question): boolean => {
    const hasErrorCount = (typeof q.errorCount === 'number' && q.errorCount > 0);
    const hasHistoryError = q.attemptHistory && q.attemptHistory.some(a => a.wasCorrect === false);
    const legacyError = (q.totalAttempts > 0 && q.lastWasCorrect === false);
    return !!(hasErrorCount || hasHistoryError || legacyError);
};

const checkIsRight = (q: Question): boolean => {
    const activeCorrect = q.totalAttempts > 0 && q.lastWasCorrect === true;
    const isWrong = checkIsWrong(q);
    return activeCorrect && !isWrong;
};

const checkIsCritical = (q: Question): boolean => {
    return !!q.isCritical;
};

const getDerivedErrorCount = (q: Question): number => {
    if (q.errorCount !== undefined && q.errorCount > 0) return q.errorCount;
    if (q.attemptHistory && q.attemptHistory.length > 0) {
        return q.attemptHistory.filter(a => !a.wasCorrect).length;
    }
    if (q.totalAttempts > 0 && !q.lastWasCorrect) return 1;
    return 0;
};

const getMasteryPct = (q: Question): number => {
    if (q.masteryScore !== undefined) return Math.round(q.masteryScore);
    return 0;
};

const getDomainPct = (q: Question, settings: any): number => {
    return srs.calculateCurrentDomain(q, settings);
};

const checkTooFast = (q: Question): boolean => {
    const lastAttempt = q.attemptHistory?.[q.attemptHistory.length - 1];
    const time = lastAttempt?.timeSec ?? q.timeSec ?? 0;
    if (time <= 0) return false;
    const expectedSec = Math.max(6, Math.ceil((q.questionText || '').length / 25));
    return time < Math.min(6, expectedSec * 0.35);
};

const getDiagnosis = (q: Question) => {
    const lastAns = q.yourAnswer;
    let raw = "";
    if (lastAns && q.wrongDiagnosisMap && q.wrongDiagnosisMap[lastAns]) {
        raw = q.wrongDiagnosisMap[lastAns];
    } else {
        // Fix: Use getText to normalize string or Record
        raw = getText(q.wrongDiagnosis);
    }
    if (!raw) return null;
    const parts = raw.split('|');
    return {
        code: parts.length > 1 ? parts[0].trim() : "DIAG",
        message: parts.length > 1 ? parts[1].trim() : parts[0].trim()
    };
};

// Extracted Component
const FilterChipButton: React.FC<{ 
    type: FilterType; 
    label: string; 
    icon?: React.ReactNode;
    currentFilter: FilterType;
    onSelect: (type: FilterType) => void;
}> = ({ type, label, icon, currentFilter, onSelect }) => (
    <button
        onClick={() => onSelect(type)}
        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex items-center gap-1.5
            ${currentFilter === type 
                ? 'bg-sky-500 text-white border-sky-600 shadow-md' 
                : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:text-slate-300'
            }
        `}
    >
        {icon}
        {label}
    </button>
);

// Extracted Component
const QuestionItem: React.FC<{ 
    q: Question; 
    onPreview: () => void; 
    onPractice: () => void; 
    onEdit: (q: Question) => void;
    onDelete: (id: string) => void;
    settings: any;
    context: QuestionContextType;
}> = ({ q, onPreview, onPractice, onEdit, onDelete, settings, context }) => {
    const [showDetails, setShowDetails] = useState(false);
    
    // Recalcular status para exibição local
    const errorCount = getDerivedErrorCount(q);
    const isMarked = studyLater.isStudyLater(q.id);
    const domain = getDomainPct(q, settings);
    const mastery = getMasteryPct(q);
    const isTooFast = checkTooFast(q);
    const diag = !q.lastWasCorrect && q.totalAttempts > 0 ? getDiagnosis(q) : null;
    const lastTime = q.attemptHistory?.[q.attemptHistory.length - 1]?.timeSec ?? q.timeSec ?? 0;

    let statusBadge = null;
    if (q.totalAttempts === 0) {
        statusBadge = <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">Novo</span>;
    } else if (!q.lastWasCorrect) {
        statusBadge = <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Erro ({errorCount})</span>;
    } else if (q.lastWasCorrect) {
        statusBadge = <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Acerto</span>;
    }

    return (
        <div className="p-4 rounded-[1.5rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group flex flex-col gap-3 relative">
            <div className="absolute top-3 right-3 z-10">
                <QuestionActionsMenu 
                    question={q} 
                    context={context} 
                    onEdit={onEdit} 
                    onDelete={onDelete} 
                />
            </div>
            
            <div className="flex justify-between items-start pr-10">
                <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-black text-sky-500 truncate">{q.questionRef}</span>
                        {statusBadge}
                        {isMarked && <BookmarkIcon className="w-3 h-3 text-indigo-400" />}
                        {q.isCritical && <ExclamationTriangleIcon className="w-3 h-3 text-amber-500" />}
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">
                        {q.topic || q.subject} {q.subtopic ? `• ${q.subtopic}` : ''}
                    </p>
                </div>
                <div className="mr-4">
                    <MasteryBadge score={domain} size="sm" />
                </div>
            </div>

            {/* Linha de Badges Técnicos */}
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[8px] font-black bg-white/5 px-2 py-0.5 rounded text-slate-400 uppercase tracking-tighter">TIPO: {q.questionType || 'N/A'}</span>
                <span className="text-[8px] font-black bg-white/5 px-2 py-0.5 rounded text-slate-400 uppercase tracking-tighter">DIF: {q.difficulty || '—'}</span>
                <span className="text-[8px] font-black bg-white/5 px-2 py-0.5 rounded text-sky-400 uppercase tracking-tighter">D: {domain}%</span>
                <span className="text-[8px] font-black bg-white/5 px-2 py-0.5 rounded text-emerald-400 uppercase tracking-tighter">M: {mastery}%</span>
                <span className="text-[8px] font-black bg-white/5 px-2 py-0.5 rounded text-slate-500 flex items-center gap-1">
                    <ClockIcon className="w-2.5 h-2.5" /> {lastTime > 0 ? `${lastTime}s` : '—'}
                </span>
                {isTooFast && (
                    <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">RÁPIDO</span>
                )}
            </div>

            <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed opacity-80 text-[11px] md:text-sm">
                {q.questionText}
            </p>

            {/* Bloco Diagnóstico */}
            {diag && (
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Diagnóstico do Erro</span>
                        <span className="text-[8px] font-mono text-rose-300/50">Marcou: {q.yourAnswer}</span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-tight">
                        <strong className="text-rose-400 mr-1">{diag.code}</strong> {diag.message}
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                <button 
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-sky-400 transition-colors"
                >
                    {showDetails ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                    Detalhes
                </button>
                <div className="flex gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onPreview(); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-sky-500 hover:text-white text-slate-400 transition-colors"
                    >
                        <EyeIcon className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onPractice(); }}
                        className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 transition-colors"
                    >
                        <PlayIcon className="w-3.5 h-3.5 fill-current" />
                    </button>
                </div>
            </div>

            {/* Accordion de Detalhes */}
            {showDetails && (
                <div className="p-3 rounded-xl bg-black/20 border border-white/5 grid grid-cols-2 gap-x-4 gap-y-1.5 animate-fade-in">
                    {[
                        { l: 'Banca', v: q.bank },
                        { l: 'Skill', v: q.skill },
                        { l: 'Ref Lei', v: q.lawRef },
                        { l: 'Âncora', v: getText(q.anchorText) },
                        { l: 'Distinção', v: q.keyDistinction },
                        { l: 'Tentativas', v: q.totalAttempts },
                    ].map((item, i) => item.v ? (
                        <div key={i} className="flex flex-col">
                            <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">{item.l}</span>
                            <span className="text-[10px] text-slate-400 truncate font-medium">{item.v}</span>
                        </div>
                    ) : null)}
                </div>
            )}
        </div>
    );
};

// --- Modal Principal ---

const QuestionListModal: React.FC<QuestionListModalProps> = ({ 
    isOpen, onClose, title, questions, onPreview, onPractice, context 
}) => {
    const { settings } = useSettings();
    const { updateQuestion, deleteQuestions } = useQuestionDispatch();
    
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [minDomain, setMinDomain] = useState(0);
    const [minMastery, setMinMastery] = useState(0);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    
    // Edit State
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    // --- LÓGICA DE FILTRO CORRIGIDA ---
    const filteredQuestions = useMemo(() => {
        let result = questions;

        // 1. Filtrar por Aba (Status)
        if (filter !== 'all') {
            switch (filter) {
                case 'wrong':
                    result = result.filter(q => checkIsWrong(q));
                    break;
                case 'correct':
                    result = result.filter(q => checkIsRight(q));
                    break;
                case 'marked':
                    // Fetch IDs directly here to ensure we use current storage state
                    const markedIds = new Set(studyLater.getStudyLaterIds());
                    result = result.filter(q => markedIds.has(q.id));
                    break;
                case 'critical':
                    result = result.filter(q => checkIsCritical(q));
                    break;
            }
        }

        // 2. Filtrar por Busca (Texto)
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(q => 
                q.questionRef.toLowerCase().includes(term) ||
                (q.questionText || '').toLowerCase().includes(term) ||
                (q.topic && q.topic.toLowerCase().includes(term)) ||
                (q.subtopic && q.subtopic.toLowerCase().includes(term))
            );
        }

        // 3. Filtros Numéricos (Advanced)
        if (minDomain > 0) result = result.filter(q => getDomainPct(q, settings) >= minDomain);
        if (minMastery > 0) result = result.filter(q => getMasteryPct(q) >= minMastery);

        // 4. Ordenação (Erros primeiro, depois data)
        return result.sort((a, b) => {
            // Prioridade: Erros
            const errA = getDerivedErrorCount(a);
            const errB = getDerivedErrorCount(b);
            if (errA !== errB) return errB - errA;
            // Desempate: Data Recente
            return new Date(b.lastAttemptDate || 0).getTime() - new Date(a.lastAttemptDate || 0).getTime();
        });
    }, [questions, filter, searchTerm, minDomain, minMastery, settings]);

    const handleDownload = (format: 'csv' | 'json') => {
        // ... (implementation same as before) ...
        const sectorName = title.split(':').pop()?.trim() || "setor";
        const date = new Date().toISOString().split('T')[0];
        const fileName = `miaaula_relatorio_${sectorName.toLowerCase()}_${date}_${filter}`;

        let content = "";
        let mimeType = "";

        if (format === 'json') {
             const data = filteredQuestions.map(q => ({ Q_REF: q.questionRef, TEXT: q.questionText })); // Simplified for brevity
             content = JSON.stringify(data, null, 2);
             mimeType = "application/json";
        } else {
             content = "Q_REF,TEXT\n" + filteredQuestions.map(q => `${q.questionRef},"${q.questionText.slice(0,50)}..."`).join("\n");
             mimeType = "text/csv";
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.${format}`;
        link.click();
        URL.revokeObjectURL(url);
        setShowDownloadMenu(false);
    };
    
    const handleEditQuestion = (q: Question) => {
        setEditingQuestion(q);
    };

    const handleDeleteQuestion = (id: string) => {
        deleteQuestions([id]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-[#020617] w-full max-w-3xl h-[85vh] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-slate-900/50 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight italic">{title}</h2>
                        <p className="text-[10px] font-bold text-sky-500 uppercase tracking-[0.3em] mt-1">
                            {filteredQuestions.length} questões
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <button 
                                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
                                title="Baixar Relatório"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                            {showDownloadMenu && (
                                <div className="absolute right-0 top-full mt-2 w-40 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 animate-fade-in">
                                    <button onClick={() => handleDownload('csv')} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">CSV (Filtro)</button>
                                    <button onClick={() => handleDownload('json')} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">JSON (Filtro)</button>
                                </div>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-white/5 space-y-4 bg-slate-900/30 shrink-0">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                            <input 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar erro, ref, âncora..."
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white placeholder-slate-700 outline-none focus:border-sky-500/50 transition-all"
                            />
                        </div>
                        <button 
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`p-3 rounded-xl border transition-all ${showAdvancedFilters ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-white/5 text-slate-500 border-white/5 hover:text-slate-300'}`}
                        >
                            <FilterIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Filtros Avançados Expansíveis */}
                    {showAdvancedFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-black/40 rounded-2xl border border-white/5 animate-fade-in-up">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Domínio Mín. ({minDomain}%)</span>
                                    {minDomain > 0 && <button onClick={() => setMinDomain(0)} className="text-[8px] font-bold text-sky-500 uppercase">Limpar</button>}
                                </div>
                                <input type="range" min="0" max="100" step="5" value={minDomain} onChange={e => setMinDomain(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-sky-500 cursor-pointer" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Maestria Mín. ({minMastery}%)</span>
                                    {minMastery > 0 && <button onClick={() => setMinMastery(0)} className="text-[8px] font-bold text-emerald-500 uppercase">Limpar</button>}
                                </div>
                                <input type="range" min="0" max="100" step="5" value={minMastery} onChange={e => setMinMastery(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <FilterChipButton currentFilter={filter} onSelect={setFilter} type="all" label="Todas" />
                        <FilterChipButton currentFilter={filter} onSelect={setFilter} type="wrong" label="Erradas" icon={<TrashIcon className="w-3 h-3"/>} />
                        <FilterChipButton currentFilter={filter} onSelect={setFilter} type="correct" label="Certas" icon={<CheckCircleIcon className="w-3 h-3"/>} />
                        <FilterChipButton currentFilter={filter} onSelect={setFilter} type="marked" label="Marcadas" icon={<BookmarkIcon className="w-3 h-3"/>} />
                        <FilterChipButton currentFilter={filter} onSelect={setFilter} type="critical" label="Críticas" icon={<ExclamationTriangleIcon className="w-3 h-3"/>} />
                    </div>
                </div>

                {/* Content List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-950/50">
                    {filteredQuestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4 opacity-50 py-20">
                            <ChartBarIcon className="w-12 h-12" />
                            <p className="text-xs font-black uppercase tracking-widest">Nenhum item encontrado</p>
                        </div>
                    ) : (
                        filteredQuestions.map(q => (
                            <QuestionItem 
                                key={q.id} 
                                q={q} 
                                onPreview={() => onPreview(q)}
                                onPractice={() => onPractice(q)}
                                onEdit={handleEditQuestion}
                                onDelete={handleDeleteQuestion}
                                settings={settings}
                                context={context}
                            />
                        ))
                    )}
                </div>
            </div>

            {editingQuestion && (
                <EditQuestionModal 
                    question={editingQuestion} 
                    onClose={() => setEditingQuestion(null)}
                    onSave={(updatedQ) => updateQuestion(updatedQ)} 
                />
            )}
        </div>
    );
};

export default QuestionListModal;
