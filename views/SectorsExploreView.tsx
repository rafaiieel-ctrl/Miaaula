
import React, { useMemo, useState, useCallback } from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import { useFlashcardState } from '../contexts/FlashcardContext';
import { useSettings } from '../contexts/SettingsContext';
import { Question, NodeAgg } from '../types';
import * as srs from '../services/srsService';
import * as rs from '../services/reviewStatusService';
import * as studyLater from '../services/studyLaterService';
import { 
    XMarkIcon, SearchIcon, ChevronRightIcon, 
    TrashIcon, ExclamationTriangleIcon, ClockIcon, 
    ChartBarIcon, CheckCircleIcon, PlayIcon,
    BoltIcon, BookOpenIcon, BookmarkIcon, BookmarkSolidIcon,
    ListBulletIcon, MapIcon
} from '../components/icons';
import StudySessionModal from '../components/StudySessionModal';
import ErrorDiagnosticsReport from '../components/reports/ErrorDiagnosticsReport'; 
import ErrorsListPanel from '../components/reports/ErrorsListPanel';
import InteractiveQuestionModal from '../components/InteractiveQuestionModal';
import QuestionListModal from '../components/QuestionListModal';
import { filterExecutableItems } from '../services/contentGate'; // Import Gate

type SortMode = 'pending' | 'alpha' | 'mastery' | 'errors' | 'critical';
type ViewMode = 'sectors' | 'list';

const SectorsExploreView: React.FC<{ onExit: () => void }> = ({ onExit }) => {
    const allQuestions = useQuestionState();
    const { settings } = useSettings();
    
    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('sectors');
    const [sortMode, setSortMode] = useState<SortMode>('pending');
    const [showOnlyCritical, setShowOnlyCritical] = useState(false);
    const [showOnlyMarked, setShowOnlyMarked] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSector, setSelectedSector] = useState<any | null>(null);
    
    // Feature States
    const [isErrorReportOpen, setIsErrorReportOpen] = useState(false);
    const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
    const [showContentModal, setShowContentModal] = useState(false);
    
    // Session State
    const [activeSession, setActiveSession] = useState<{ title: string; questions: Question[] } | null>(null);

    // --- CONTENT GATE ---
    const activeQuestions = useMemo(() => filterExecutableItems(allQuestions), [allQuestions]);

    // Data Aggregation for Sectors View (Uses Active Questions)
    const aggregatedSectors = useMemo(() => {
        if (viewMode === 'list') return [];

        const tree: Record<string, any> = {};
        const today = srs.todayISO();
        const markedIds = new Set(studyLater.getStudyLaterIds());

        activeQuestions.forEach(q => {
            const sId = q.subject;
            if (!tree[sId]) {
                tree[sId] = { 
                    id: sId, label: sId, total: 0, attempted: 0, 
                    masterySum: 0, isOverdue: false, errorCount: 0, 
                    criticalCount: 0, markedCount: 0, itemIds: [] 
                };
            }
            const node = tree[sId];
            node.total++;
            node.itemIds.push(q.id);
            if (q.nextReviewDate <= today) node.isOverdue = true;
            if (q.totalAttempts > 0) {
                node.attempted++;
                node.masterySum += srs.calculateCurrentDomain(q, settings);
                if (!q.lastWasCorrect) node.errorCount++;
            }
            if (q.isCritical) node.criticalCount++;
            if (markedIds.has(q.id)) node.markedCount++;
        });

        return Object.values(tree).map((n: any) => ({
            ...n,
            masteryAll: n.attempted > 0 ? n.masterySum / n.attempted : 0
        }));
    }, [activeQuestions, settings, viewMode]);

    // Filtering & Sorting for Sectors
    const filteredSectors = useMemo(() => {
        if (viewMode === 'list') return [];

        let list = [...aggregatedSectors];
        
        if (showOnlyCritical) list = list.filter(s => s.criticalCount > 0);
        if (showOnlyMarked) list = list.filter(s => s.markedCount > 0);
        
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(s => s.label.toLowerCase().includes(term));
        }

        return list.sort((a, b) => {
            switch (sortMode) {
                case 'alpha': return a.label.localeCompare(b.label);
                case 'mastery': return a.masteryAll - b.masteryAll;
                case 'errors': return b.errorCount - a.errorCount;
                case 'critical': return b.criticalCount - a.criticalCount;
                case 'pending':
                default:
                    if (a.isOverdue && !b.isOverdue) return -1;
                    if (!a.isOverdue && b.isOverdue) return 1;
                    return b.errorCount - a.errorCount;
            }
        });
    }, [aggregatedSectors, sortMode, showOnlyCritical, showOnlyMarked, searchTerm, viewMode]);

    // Session Handlers
    const startSession = (subject: string, mode: 'normal' | 'errors' | 'critical' | 'marked') => {
        // Pool filters from active questions only
        let pool = activeQuestions.filter(q => q.subject === subject);
        let title = `Sessão: ${subject}`;
        const markedIds = new Set(studyLater.getStudyLaterIds());
        
        if (mode === 'errors') {
            pool = pool.filter(q => !q.lastWasCorrect && q.totalAttempts > 0);
            title = `Recuperação: ${subject}`;
        } else if (mode === 'critical') {
            pool = pool.filter(q => q.isCritical);
            title = `Críticos: ${subject}`;
        } else if (mode === 'marked') {
            pool = pool.filter(q => markedIds.has(q.id));
            title = `Marcados: ${subject}`;
        }

        if (pool.length === 0) {
            alert(`Sem questões disponíveis neste filtro (ou estão congeladas).`);
            return;
        }

        setActiveSession({ title, questions: pool.slice(0, 20) });
        setSelectedSector(null);
    };

    const handleRetrySpecificQuestion = (q: Question) => {
        setActiveSession({ title: `Prática: ${q.questionRef}`, questions: [q] });
        setIsErrorReportOpen(false); 
        setShowContentModal(false);
    };

    const handleViewContent = () => {
        setShowContentModal(true);
    };

    const toggleViewMode = () => {
        setViewMode(prev => prev === 'sectors' ? 'list' : 'sectors');
    };

    const selectedSectorQuestions = useMemo(() => {
        if (!selectedSector) return [];
        return activeQuestions.filter(q => q.subject === selectedSector.label);
    }, [activeQuestions, selectedSector]);

    return (
        <div className="min-h-screen bg-[#010204] text-white animate-fade-in pb-32">
            {/* Header Section */}
            <div className="p-6 pt-10 flex justify-between items-start">
                <div>
                    <h1 className="text-5xl font-black italic tracking-tighter leading-none">NAVEGAÇÃO</h1>
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.4em] mt-2">Exploração de Setores</p>
                </div>
                <button onClick={onExit} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-90 border border-white/10">
                    <XMarkIcon className="w-8 h-8" />
                </button>
            </div>

            {/* Controls */}
            <div className="px-6 space-y-6">
                <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 items-center">
                    <button 
                        onClick={toggleViewMode}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 border border-white/10 hover:bg-white/10 ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'bg-white/5 text-slate-400'}`}
                    >
                         {viewMode === 'sectors' ? <ListBulletIcon className="w-3.5 h-3.5" /> : <MapIcon className="w-3.5 h-3.5" />}
                         {viewMode === 'sectors' ? 'LISTA' : 'SETORES'}
                    </button>
                    
                    <div className="w-px h-6 bg-white/10 mx-2"></div>

                    {[
                        { id: 'pending', label: 'PRIORIDADE', icon: <ClockIcon className="w-3 h-3" /> },
                        { id: 'alpha', label: 'A-Z', icon: null },
                        { id: 'mastery', label: 'DOMÍNIO', icon: <ChartBarIcon className="w-3 h-3" /> },
                        { id: 'errors', label: 'ERROS', icon: <TrashIcon className="w-3 h-3" /> },
                        { id: 'critical', label: 'CRÍTICOS', icon: <ExclamationTriangleIcon className="w-3 h-3" /> }
                    ].map(opt => (
                        <button 
                            key={opt.id}
                            onClick={() => {
                                setSortMode(opt.id as any);
                            }}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 border 
                                ${sortMode === opt.id ? 'bg-sky-500 text-white border-sky-600 shadow-lg' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'}`}
                        >
                            {opt.icon} {opt.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-4 px-1">
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${showOnlyCritical ? 'bg-amber-500 border-amber-600' : 'border-white/10 bg-white/5'}`}>
                                {showOnlyCritical && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={showOnlyCritical} onChange={e => setShowOnlyCritical(e.target.checked)} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300">Apenas Críticos</span>
                        </label>

                        <label className="flex items-center gap-2.5 cursor-pointer group">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${showOnlyMarked ? 'bg-indigo-500 border-indigo-600' : 'border-white/10 bg-white/5'}`}>
                                {showOnlyMarked && <BookmarkSolidIcon className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={showOnlyMarked} onChange={e => setShowOnlyMarked(e.target.checked)} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300">Apenas Marcados</span>
                        </label>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                        <div className="relative flex-1 max-w-xs">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                            <input 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder={viewMode === 'list' ? "Buscar erro, ref, tópico..." : "Buscar setor..."}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:border-sky-500/50"
                            />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                            {viewMode === 'sectors' ? `${filteredSectors.length} Setores` : 'Modo Lista'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="mt-8 px-6 space-y-3">
                
                {/* MODE: SECTORS CARD LIST */}
                {viewMode === 'sectors' && (
                    <>
                        {filteredSectors.map(sector => {
                            let ctaLabel = "Iniciar Prática";
                            let ctaMode: 'normal' | 'errors' | 'critical' | 'marked' = 'normal';
                            let ctaIcon = <PlayIcon className="w-3 h-3 fill-current" />;
                            let ctaColor = "bg-white text-slate-950 hover:bg-sky-50";

                            if (sector.markedCount > 0) {
                                ctaLabel = `Revisar Marcados (${sector.markedCount})`;
                                ctaMode = 'marked';
                                ctaIcon = <BookmarkSolidIcon className="w-3 h-3" />;
                                ctaColor = "bg-indigo-600 text-white hover:bg-indigo-500";
                            } else if (sector.errorCount > 0) {
                                ctaLabel = "Refazer Erradas";
                                ctaMode = 'errors';
                                ctaIcon = <BoltIcon className="w-3 h-3" />;
                                ctaColor = "bg-rose-500 text-white hover:bg-rose-400";
                            } else if (sector.criticalCount > 0) {
                                ctaLabel = "Treinar Críticos";
                                ctaMode = 'critical';
                                ctaIcon = <ExclamationTriangleIcon className="w-3 h-3" />;
                                ctaColor = "bg-amber-500 text-white hover:bg-amber-400";
                            }

                            return (
                                <div 
                                    key={sector.id}
                                    className={`w-full bg-white/[0.02] border p-5 rounded-[2rem] flex flex-col group transition-all ${sector.isOverdue ? 'border-rose-500/20' : sector.markedCount > 0 ? 'border-indigo-500/20' : sector.criticalCount > 0 ? 'border-amber-500/20' : 'border-white/5'}`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex-1 min-w-0 pr-4" onClick={() => setSelectedSector(sector)}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-white font-black text-base md:text-lg truncate group-hover:text-sky-400 transition-colors uppercase tracking-tight italic">{sector.label}</h4>
                                                {sector.isOverdue && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#ef4444]"></div>}
                                            </div>
                                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 opacity-60">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{sector.total} Questões</span>
                                                {sector.markedCount > 0 && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1"><BookmarkIcon className="w-2.5 h-2.5" /> {sector.markedCount} Marcados</span>}
                                                {sector.errorCount > 0 && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1"><TrashIcon className="w-2.5 h-2.5" /> {sector.errorCount} Erros</span>}
                                                {sector.criticalCount > 0 && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"><ExclamationTriangleIcon className="w-2.5 h-2.5" /> {sector.criticalCount} Críticos</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-5 shrink-0">
                                            <div className="text-right hidden xs:block">
                                                <span className={`text-base font-black ${sector.masteryAll >= 85 ? 'text-emerald-500' : sector.masteryAll >= 70 ? 'text-sky-500' : 'text-amber-500'}`}>{Number(sector.masteryAll.toFixed(2))}%</span>
                                                <div className="w-12 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                                                    <div className={`h-full ${sector.masteryAll >= 85 ? 'bg-emerald-500' : sector.masteryAll >= 70 ? 'bg-sky-500' : 'bg-amber-500'}`} style={{ width: `${sector.masteryAll}%` }}></div>
                                                </div>
                                            </div>
                                            <button onClick={() => setSelectedSector(sector)} className="p-3 bg-white/5 rounded-full text-slate-600 hover:text-sky-500 group-hover:bg-sky-500/10 transition-all active:scale-90">
                                                <ChevronRightIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic">Recomendado</span>
                                        <button 
                                            onClick={() => startSession(sector.label, ctaMode)}
                                            className={`${ctaColor} px-5 py-2.5 rounded-xl text-[9px] font-black transition-all uppercase tracking-widest shadow-xl active:scale-95 flex items-center gap-2`}
                                        >
                                            {ctaIcon} {ctaLabel}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredSectors.length === 0 && (
                            <div className="py-32 text-center space-y-4">
                                <SearchIcon className="w-12 h-12 text-white/5 mx-auto" />
                                <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Nenhum setor disponível ou compatível com filtro.</p>
                            </div>
                        )}
                    </>
                )}
                
                {viewMode === 'list' && (
                    <ErrorsListPanel 
                        allQuestions={activeQuestions}
                        filters={{
                            searchTerm,
                            showOnlyCritical,
                            showOnlyMarked,
                            markedIds: new Set(studyLater.getStudyLaterIds())
                        }}
                        onReviewQuestion={(q) => setPreviewQuestion(q)}
                        onRetryQuestion={handleRetrySpecificQuestion}
                    />
                )}
            </div>

            {/* Detail Modal / Bottom Sheet */}
            {selectedSector && (
                <div className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedSector(null)}>
                    <div className="bg-slate-900 border-2 border-white/10 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-fade-in-up max-h-[85vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div className="min-w-0 pr-4">
                                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedSector.label}</h3>
                                <p className="text-[10px] font-black text-sky-400 uppercase tracking-[0.4em] mt-3 italic">Painel do Setor</p>
                            </div>
                            <button onClick={() => setSelectedSector(null)} className="p-3 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 text-center">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Domínio Total</span>
                                <p className="text-3xl font-black text-white">{Number(selectedSector.masteryAll.toFixed(2))}%</p>
                            </div>
                            <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 text-center">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Questões</span>
                                <p className="text-3xl font-black text-white">{selectedSector.total}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => startSession(selectedSector.label, 'normal')}
                                className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all active:scale-[0.98] hover:bg-sky-50 text-xs"
                            >
                                <PlayIcon className="w-5 h-5 fill-current" /> Iniciar Prática
                            </button>
                            
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => startSession(selectedSector.label, 'marked')}
                                    disabled={selectedSector.markedCount === 0}
                                    className="flex flex-col items-center justify-center p-4 rounded-[1.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 text-indigo-500 font-black uppercase tracking-widest text-[8px] hover:bg-indigo-500/20 transition-all disabled:opacity-20 disabled:grayscale"
                                >
                                    <BookmarkSolidIcon className="w-5 h-5 mb-2" /> Marcados ({selectedSector.markedCount})
                                </button>
                                <button 
                                    onClick={() => startSession(selectedSector.label, 'errors')}
                                    disabled={selectedSector.errorCount === 0}
                                    className="flex flex-col items-center justify-center p-4 rounded-[1.5rem] bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 font-black uppercase tracking-widest text-[8px] hover:bg-rose-500/20 transition-all disabled:opacity-20 disabled:grayscale"
                                >
                                    <TrashIcon className="w-5 h-5 mb-2" /> Erradas ({selectedSector.errorCount})
                                </button>
                                <button 
                                    onClick={() => startSession(selectedSector.label, 'critical')}
                                    disabled={selectedSector.criticalCount === 0}
                                    className="flex flex-col items-center justify-center p-4 rounded-[1.5rem] bg-amber-500/10 border-2 border-amber-500/20 text-amber-500 font-black uppercase tracking-widest text-[8px] hover:bg-amber-500/20 transition-all disabled:opacity-20 disabled:grayscale"
                                >
                                    <ExclamationTriangleIcon className="w-5 h-5 mb-2" /> Críticos ({selectedSector.criticalCount})
                                </button>
                            </div>

                            <button 
                                onClick={handleViewContent}
                                className="w-full bg-white/5 text-slate-400 font-black py-4 rounded-[2rem] border border-white/5 uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:bg-white/10 hover:text-white text-[10px]"
                            >
                                <BookOpenIcon className="w-4 h-4" /> Ver Conteúdo
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* CONTENT MODAL */}
            {selectedSector && (
                <QuestionListModal 
                    isOpen={showContentModal}
                    onClose={() => setShowContentModal(false)}
                    title={`Conteúdo: ${selectedSector.label}`}
                    questions={selectedSectorQuestions}
                    onPreview={(q) => setPreviewQuestion(q)}
                    onPractice={handleRetrySpecificQuestion}
                    context="questions"
                />
            )}

            {/* PREVIEW / RETRY SINGLE QUESTION */}
            {previewQuestion && (
                <InteractiveQuestionModal 
                    question={previewQuestion}
                    onClose={() => setPreviewQuestion(null)}
                    onQuestionAnswered={() => {}}
                    context="questions"
                />
            )}

            {/* Study Session Integration */}
            {activeSession && (
                <StudySessionModal 
                    isOpen={true} 
                    questions={activeSession.questions} 
                    title={activeSession.title} 
                    onClose={() => setActiveSession(null)} 
                    context="session"
                />
            )}
        </div>
    );
};

export default SectorsExploreView;
