
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StudyRef, Question } from '../types';
import { useQuestionState } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import * as studyLater from '../services/studyLaterService'; 
import { normalizeDiscipline } from '../services/taxonomyService';
import { useForceGraph, GalaxyNode } from '../hooks/useForceGraph';
import { 
    XMarkIcon, BoltIcon, 
    SearchIcon,
    MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon,
    TargetIcon,
    PencilIcon,
    ExclamationTriangleIcon,
    PlayIcon,
    TrashIcon,
    BookmarkSolidIcon,
    BookOpenIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    FullScreenIcon,
    ExitFullScreenIcon,
    EyeIcon,
    EyeSlashIcon,
    ClockIcon,
    SnowflakeIcon,
    FireIcon,
    MapIcon
} from '../components/icons';
import StudySessionModal from '../components/StudySessionModal';
import MergeDisciplinesModal from '../components/MergeDisciplinesModal';
import QuestionListModal from '../components/QuestionListModal';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { mergeDisciplines } from '../services/taxonomyService';
import { getFrozenSet, setFrozen, normalizeKey, isFrozen } from '../services/disciplineFlags';
import InteractiveQuestionModal from '../components/InteractiveQuestionModal';

interface MapViewProps {
    onStudyRefNavigate?: (ref: StudyRef) => void;
    onToggleUI?: (isHidden: boolean) => void; 
}

// Extended Node Type for UI display
interface ExtendedGalaxyNode extends GalaxyNode {
    totalCount?: number;
}

// ... (FrozenManagerModal, FreezeDisciplineModal, DeleteDisciplineModal remain unchanged) ...

// --- FROZEN MANAGER MODAL ---
const FrozenManagerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    frozenSubjects: string[];
    onUnfreeze: (subject: string) => void;
}> = ({ isOpen, onClose, frozenSubjects, onUnfreeze }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-sky-900/10">
                    <div className="flex items-center gap-2 text-sky-400">
                        <SnowflakeIcon className="w-5 h-5" />
                        <h3 className="font-bold text-lg text-white">Disciplinas Congeladas</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
                </div>
                
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2">
                    {frozenSubjects.length === 0 ? (
                        <p className="text-center text-slate-500 py-8 text-sm">Nenhuma disciplina congelada.</p>
                    ) : (
                        frozenSubjects.map(subject => (
                            <div key={subject} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="text-sm font-bold text-slate-200">{subject}</span>
                                <button 
                                    onClick={() => onUnfreeze(subject)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white border border-orange-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <FireIcon className="w-3.5 h-3.5" /> Descongelar
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// --- FREEZE CONFIRMATION MODAL ---
const FreezeDisciplineModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    subjectName: string;
    onConfirm: () => void;
}> = ({ isOpen, onClose, subjectName, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-400">
                        <SnowflakeIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Congelar {subjectName}?</h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-6">
                        Congelar remove a disciplina do Orbital e do treino. <br/><strong className="text-white">Nada será apagado.</strong>
                    </p>
                    
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-white transition-colors">Cancelar</button>
                        <button onClick={onConfirm} className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-sky-900/20">Congelar Agora</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- DELETE CONFIRMATION MODAL ---
const DeleteDisciplineModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    subjectName: string;
    stats: { total: number; marked: number; errors: number; critical: number };
    onConfirm: () => void;
}> = ({ isOpen, onClose, subjectName, stats, onConfirm }) => {
    const [confirmText, setConfirmText] = useState('');
    const requiredText = `DELETAR ${subjectName}`;
    const isMatch = confirmText.trim().toUpperCase() === requiredText.toUpperCase();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-white/5 bg-rose-500/5">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <TrashIcon className="w-5 h-5 text-rose-500" />
                        Excluir {subjectName}?
                    </h3>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="text-sm text-slate-300 leading-relaxed">
                        <p>Essa ação vai remover a disciplina do Orbital e <strong className="text-rose-400">apagar permanentemente</strong> todas as questões vinculadas a ela do banco de dados.</p>
                    </div>

                    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Resumo do Impacto</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-2xl font-bold text-white">{stats.total}</span>
                                <span className="text-xs text-slate-500">Questões Totais</span>
                            </div>
                            <div>
                                <span className="block text-2xl font-bold text-rose-400">{stats.errors}</span>
                                <span className="text-xs text-slate-500">Erradas Reg.</span>
                            </div>
                            <div>
                                <span className="block text-2xl font-bold text-amber-400">{stats.critical}</span>
                                <span className="text-xs text-slate-500">Críticas</span>
                            </div>
                            <div>
                                <span className="block text-2xl font-bold text-indigo-400">{stats.marked}</span>
                                <span className="text-xs text-slate-500">Marcadas</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                            Digite <span className="select-all text-white bg-white/10 px-1 rounded">{requiredText}</span> para confirmar:
                        </label>
                        <input 
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-rose-500 outline-none transition-colors"
                            placeholder={requiredText}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-slate-950/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">Cancelar</button>
                    <button 
                        onClick={onConfirm}
                        disabled={!isMatch}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isMatch ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/20' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
                    >
                        Excluir Agora
                    </button>
                </div>
            </div>
        </div>
    );
};

const MapView: React.FC<MapViewProps> = ({ onStudyRefNavigate, onToggleUI }) => {
    const questions = useQuestionState();
    const { settings, updateSettings } = useSettings();
    const { updateBatchQuestions, deleteQuestions } = useQuestionDispatch();
    
    // --- State ---
    const [focusedNode, setFocusedNode] = useState<ExtendedGalaxyNode | null>(null);
    const [isOrbitEnabled, setIsOrbitEnabled] = useState(true);
    const [simulationSpeed, setSimulationSpeed] = useState(1.0); 
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [expandAll, setExpandAll] = useState(false); 
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 }); 
    const containerRef = useRef<HTMLDivElement>(null);
    
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [showCriticalOnly, setShowCriticalOnly] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [mergeCandidates, setMergeCandidates] = useState<string[]>([]);
    const [isHUDCollapsed, setIsHUDCollapsed] = useState(false);
    
    // Freeze State
    const [freezeVersion, setFreezeVersion] = useState(0);
    const [isFrozenListOpen, setIsFrozenListOpen] = useState(false);

    // Modals
    const [activeSession, setActiveSession] = useState<{ title: string; questions: Question[] } | null>(null);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [showContentModal, setShowContentModal] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);
    const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

    // --- Robust Resize Observer ---
    useEffect(() => {
        if (!containerRef.current) return;

        setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
        });

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // --- Full Screen Logic ---
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // --- Data Preparation using Unified Aggregator (FIXED) ---
    const { nodes, globalStats, frozenSubjects } = useMemo(() => {
        // Group Questions
        const groupedQuestions: Record<string, Question[]> = {};
        const frozenSet = getFrozenSet();
        const allSubjects = new Set<string>();
        
        questions.forEach(q => {
             // CRITICAL FIX: Normalize discipline here to ensure aggregation works for mixed case/accents
             const subj = normalizeDiscipline(q.subject);
             allSubjects.add(subj);

             // 1. Filter
             if (showCriticalOnly && !q.isCritical && !srs.isReviewFuture(q.nextReviewDate)) return;
             if (searchTerm && !subj.toLowerCase().includes(searchTerm.toLowerCase())) return;

             const subjKey = normalizeKey(subj);
             
             // SKIP FROZEN (BUT TRACK IT)
             if (frozenSet.has(subjKey)) return;

             if (!groupedQuestions[subj]) groupedQuestions[subj] = [];
             groupedQuestions[subj].push(q);
        });
        
        // Compute actual list of frozen subjects that have content
        const actualFrozenSubjects = Array.from(allSubjects).filter(s => isFrozen(s));

        const graphNodes: ExtendedGalaxyNode[] = [];
        const allFilteredQuestions = Object.values(groupedQuestions).flat();
        const agg = srs.computeAggregatedStats(allFilteredQuestions, settings);

        // Process Subject Nodes
        Object.entries(groupedQuestions).forEach(([subjectName, items]) => {
            const stats = srs.computeAggregatedStats(items, settings);
            
            // Calculate Topics for this Subject
            const topicGroups: Record<string, Question[]> = {};
            items.forEach(q => {
                let topicName = q.topic ? q.topic.trim() : 'Geral';
                if (!topicName) topicName = 'Geral';
                if (!topicGroups[topicName]) topicGroups[topicName] = [];
                topicGroups[topicName].push(q);
            });

            // Radius Logic
            const radius = 25 + Math.log(items.length + 1) * 5;

            graphNodes.push({
                id: subjectName,
                label: subjectName,
                type: 'subject',
                radius: Math.min(100, Math.max(30, radius)),
                masteryAll: stats.avgDomain, // Use Domain for visual color/orbit
                attempted: stats.attempted,
                totalCount: items.length, // FIX: Track total count
                isCritical: stats.criticalCount > 0 || settings.subjectConfigs[subjectName]?.isCritical,
                isGold: items.some(q => srs.checkIsGoldWindow(q.nextReviewDate)),
                isStarted: stats.attempted > 0
            });

            // Process Topic Nodes (Moons)
            Object.entries(topicGroups).forEach(([topicName, tItems]) => {
                const tStats = srs.computeAggregatedStats(tItems, settings);
                const topicId = `${subjectName}::${topicName}`;
                
                graphNodes.push({
                    id: topicId,
                    label: topicName,
                    type: 'topic',
                    parentId: subjectName,
                    radius: 8 + Math.log(tItems.length + 1) * 3,
                    masteryAll: tStats.avgDomain,
                    attempted: tStats.attempted,
                    totalCount: tItems.length, // FIX: Track total count
                    isGold: tItems.some(q => srs.checkIsGoldWindow(q.nextReviewDate)),
                    isStarted: tStats.attempted > 0
                });
            });
        });

        return { nodes: graphNodes, globalStats: { mastery: agg.avgDomain }, frozenSubjects: actualFrozenSubjects };
    }, [questions, settings, searchTerm, showCriticalOnly, freezeVersion]);

    // --- Hook Integration ---
    const { canvasRef, handleCanvasClick, handleMouseMove, handleMouseDown, handleMouseUp, handleWheel, zoomIn, zoomOut, resetView } = useForceGraph(
        nodes,
        dimensions,
        (node) => {
            if (editMode && node?.type === 'subject') {
                setMergeCandidates(prev => {
                    if (prev.includes(node.id)) return prev.filter(id => id !== node.id);
                    if (prev.length < 2) return [...prev, node.id];
                    return [prev[1], node.id];
                });
            } else {
                if (node) {
                    if (node.type === 'subject') {
                        setFocusedNode(prev => prev?.id === node.id ? null : (node as ExtendedGalaxyNode));
                        if (onToggleUI) onToggleUI(true); 
                    } else if (node.type === 'topic') {
                        const parent = nodes.find(n => n.id === node.parentId);
                        setFocusedNode(parent ? (parent as ExtendedGalaxyNode) : null);
                        if (onToggleUI) onToggleUI(true);
                    }
                } else {
                    setFocusedNode(null); 
                    resetView(); 
                    if (onToggleUI) onToggleUI(false); 
                }
            }
        },
        focusedNode?.id || null,
        isOrbitEnabled,
        expandAll,
        simulationSpeed // Passando a velocidade
    );

    // ... (rest of component)
    const handleCloseDetail = () => {
        setFocusedNode(null);
        resetView(); 
        if (onToggleUI) onToggleUI(false); 
    };

    const toggleNodeCriticalStatus = () => {
        if (!focusedNode || focusedNode.type !== 'subject') return;
        const subject = focusedNode.id;
        const currentConfig = settings.subjectConfigs[subject] || { priority: 'medium', isFrozen: false };
        const newStatus = !currentConfig.isCritical;
        updateSettings({
            subjectConfigs: {
                ...settings.subjectConfigs,
                [subject]: { ...currentConfig, isCritical: newStatus }
            }
        });
        setFocusedNode(prev => prev ? { ...prev, isCritical: newStatus } : null);
    };

    // CRITICAL FIX: Ensure startSession filters using normalized discipline
    const startSession = (mode: 'normal' | 'errors' | 'critical' | 'marked') => {
        if (!focusedNode) return;
        
        const targetDiscipline = focusedNode.id; // already normalized from nodes
        
        let pool = questions.filter(q => normalizeDiscipline(q.subject) === targetDiscipline);
        
        let title = `Sessão: ${focusedNode.id}`;
        if (mode === 'errors') {
            pool = pool.filter(q => !q.lastWasCorrect && q.totalAttempts > 0);
            title = `Erros: ${focusedNode.id}`;
        } else if (mode === 'critical') {
            pool = pool.filter(q => q.isCritical);
            title = `Críticos: ${focusedNode.id}`;
        } else if (mode === 'marked') {
            title = `Marcados: ${focusedNode.id}`;
            const markedIds = new Set(studyLater.getStudyLaterIds());
            pool = pool.filter(q => markedIds.has(q.id));
        }
        
        if (pool.length > 0) {
            setActiveSession({ title, questions: pool.slice(0, 20) });
        } else {
            alert("Sem questões disponíveis para este filtro.");
        }
    };

    // CRITICAL FIX: Ensure modal content list also filters correctly
    const selectedSectorQuestions = useMemo(() => {
        if (!focusedNode) return [];
        return questions.filter(q => normalizeDiscipline(q.subject) === focusedNode.id);
    }, [questions, focusedNode]);


    const handleMergeConfirm = (targetName: string, normalize: boolean) => {
        if (mergeCandidates.length !== 2) return;
        const [sourceA, sourceB] = mergeCandidates;
        const result = mergeDisciplines(sourceA, sourceB, targetName, questions, [], normalize); 
        updateBatchQuestions(result.updatedQuestions);
        setIsMergeModalOpen(false);
        setMergeCandidates([]);
        setEditMode(false);
    };

    const handleFreezeDiscipline = () => {
        if (!focusedNode) return;
        setFrozen(focusedNode.id, true);
        setFreezeVersion(v => v + 1);
        setIsFreezeModalOpen(false);
        handleCloseDetail();
    };

    const handleUnfreezeDiscipline = (subject: string) => {
        setFrozen(subject, false);
        setFreezeVersion(v => v + 1);
        // Modal stays open so user can unfreeze multiple
    };
    
    // --- DELETE DISCIPLINE LOGIC ---
    const getDeletionStats = () => {
        if (!focusedNode) return { total: 0, marked: 0, errors: 0, critical: 0 };
        const subject = focusedNode.id;
        const pool = questions.filter(q => normalizeDiscipline(q.subject) === subject);
        const markedIds = new Set(studyLater.getStudyLaterIds());
        
        return {
            total: pool.length,
            marked: pool.filter(q => markedIds.has(q.id)).length,
            errors: pool.filter(q => q.totalAttempts > 0 && !q.lastWasCorrect).length,
            critical: pool.filter(q => q.isCritical).length
        };
    };

    const handleDeleteDiscipline = () => {
        if (!focusedNode) return;
        const subject = focusedNode.id;
        // 1. Find all questions for this subject
        const idsToDelete = questions
            .filter(q => normalizeDiscipline(q.subject) === subject)
            .map(q => q.id);
        
        if (idsToDelete.length > 0) {
            // 2. Cascade Delete
            deleteQuestions(idsToDelete);
        }
        
        // 3. UI Cleanup
        setIsDeleteModalOpen(false);
        handleCloseDetail();
        
        // 4. Feedback
        alert(`Disciplina "${subject}" removida.\n${idsToDelete.length} questões apagadas.`);
    };

    useEffect(() => {
        if (mergeCandidates.length === 2) setIsMergeModalOpen(true);
    }, [mergeCandidates]);
    
    useEffect(() => {
        return () => { if (onToggleUI) onToggleUI(false); };
    }, []);

    const getColorClass = (val: number) => val < 40 ? 'text-rose-500' : val < 80 ? 'text-amber-500' : 'text-emerald-500';

    return (
        <div className="w-full h-full min-h-[85vh] bg-[#020617] relative overflow-hidden font-sans" ref={containerRef}>
            <canvas 
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                className="absolute inset-0 z-10 touch-none block cursor-grab active:cursor-grabbing"
            />
            
            {/* ... (Controls) ... */}
            <div className={`absolute top-4 right-4 z-20 flex flex-col gap-3 items-end pointer-events-none transition-opacity duration-300 ${focusedNode ? 'opacity-0' : 'opacity-100'}`}>
                 <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 p-1 flex items-center shadow-2xl pointer-events-auto transition-all w-48 focus-within:w-64">
                     <div className="p-2 text-slate-400"><SearchIcon className="w-4 h-4"/></div>
                     <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-white text-xs w-full placeholder-slate-500 font-bold uppercase tracking-wide" placeholder="BUSCAR SETOR..." />
                 </div>
                 <div className="flex gap-2 pointer-events-auto">
                    {frozenSubjects.length > 0 && (
                        <button 
                            onClick={() => setIsFrozenListOpen(true)}
                            className="p-3 rounded-xl border transition-all bg-sky-900/40 text-sky-400 border-sky-500/30 hover:bg-sky-900/60 hover:text-white"
                            title="Gerenciar Disciplinas Congeladas"
                        >
                            <SnowflakeIcon className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => setEditMode(!editMode)} className={`p-3 rounded-xl border transition-all ${editMode ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20' : 'bg-slate-900/80 text-slate-400 border-white/10 hover:text-white'}`} title="Modo Edição (Fundir)"><PencilIcon className="w-4 h-4" /></button>
                    <button onClick={() => setShowCriticalOnly(!showCriticalOnly)} className={`p-3 rounded-xl border transition-all ${showCriticalOnly ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20' : 'bg-slate-900/80 text-slate-400 border-white/10 hover:text-white'}`} title="Filtro Crítico"><ExclamationTriangleIcon className="w-4 h-4" /></button>
                    <button onClick={() => setExpandAll(!expandAll)} className={`p-3 rounded-xl border transition-all ${expandAll ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-slate-900/80 text-slate-400 border-white/10 hover:text-white'}`} title={expandAll ? "Ocultar Satélites" : "Expandir Satélites"}>{expandAll ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>
                 </div>
                 <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-1.5 flex flex-col gap-1 shadow-2xl pointer-events-auto">
                     <button onClick={zoomIn} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><MagnifyingGlassPlusIcon className="w-4 h-4"/></button>
                     <button onClick={zoomOut} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><MagnifyingGlassMinusIcon className="w-4 h-4"/></button>
                     <button onClick={resetView} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Centralizar (Auto-Fit)"><TargetIcon className="w-4 h-4"/></button>
                     <button onClick={toggleFullScreen} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Tela Cheia">{isFullScreen ? <ExitFullScreenIcon className="w-4 h-4" /> : <FullScreenIcon className="w-4 h-4" />}</button>
                 </div>
            </div>

            <div className={`absolute bottom-8 left-8 z-20 pointer-events-auto transition-all duration-300 ${isHUDCollapsed ? 'translate-y-[80%]' : ''} ${focusedNode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl min-w-[220px] relative">
                    <button onClick={() => setIsHUDCollapsed(!isHUDCollapsed)} className="absolute -top-4 right-6 bg-slate-800 text-slate-400 p-1.5 rounded-full border border-white/10 shadow-lg hover:text-white">
                        {isHUDCollapsed ? <ChevronUpIcon className="w-4 h-4"/> : <ChevronDownIcon className="w-4 h-4"/>}
                    </button>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30"><MapIcon className="w-5 h-5" /></div>
                        <div><h1 className="text-sm font-black text-white uppercase tracking-widest leading-none">Galaxy</h1><p className="text-9x text-slate-500 font-bold uppercase mt-1">Visão Orbital</p></div>
                    </div>
                    <div><span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Domínio Global</span><span className={`text-4xl font-black tracking-tighter ${getColorClass(globalStats.mastery)}`}>{globalStats.mastery.toFixed(0)}%</span></div>
                    
                    {!isHUDCollapsed && (
                        <>
                            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="w-3 h-3 text-slate-500" />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Velocidade: {simulationSpeed.toFixed(1)}x</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="3.0" 
                                    step="0.1" 
                                    value={simulationSpeed} 
                                    onChange={(e) => setSimulationSpeed(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                />
                            </div>
                            
                            <div className="mt-4 pt-2 flex gap-2">
                                <button onClick={() => setIsOrbitEnabled(!isOrbitEnabled)} className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${!isOrbitEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{isOrbitEnabled ? 'Pausar' : 'Rodar'}</button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {focusedNode && (
                <div className="absolute top-0 left-0 w-full z-30 pointer-events-none flex justify-center pt-8 px-4">
                    <div className="bg-slate-900 border-2 border-white/10 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-md pointer-events-auto animate-slide-down">
                        <div className="flex justify-between items-start mb-6">
                            <div className="min-w-0 pr-4">
                                <span className="text-[9px] font-black text-sky-500 uppercase tracking-[0.3em] block mb-1">{focusedNode.type === 'subject' ? 'Setor Ativo' : 'Satélite'}</span>
                                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none truncate">{focusedNode.label}</h2>
                            </div>
                            <div className="flex gap-2">
                                {focusedNode.type === 'subject' && (
                                    <>
                                        <button 
                                            onClick={() => setIsFreezeModalOpen(true)}
                                            className="p-2 rounded-full transition-all border bg-white/5 border-white/5 text-sky-500 hover:text-sky-300 hover:bg-sky-500/10 hover:border-sky-500/20" 
                                            title="Congelar disciplina"
                                        >
                                            <SnowflakeIcon className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => setIsDeleteModalOpen(true)}
                                            className="p-2 rounded-full transition-all border bg-white/5 border-white/5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20" 
                                            title="Excluir disciplina e questões"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={toggleNodeCriticalStatus} className={`p-2 rounded-full transition-all border ${focusedNode.isCritical ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:bg-white/10'}`} title={focusedNode.isCritical ? "Desmarcar Crítico" : "Marcar como Crítico (Inverte Rotação)"}>
                                            <ExclamationTriangleIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                <button onClick={handleCloseDetail} className="p-2 bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"><XMarkIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center"><span className="block text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Domínio</span><span className={`text-3xl font-black ${getColorClass(focusedNode.masteryAll)}`}>{focusedNode.masteryAll.toFixed(0)}%</span></div>
                             <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center"><span className="block text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Questões</span><span className="text-3xl font-black text-white">{focusedNode.totalCount || focusedNode.attempted}</span></div>
                        </div>
                        {focusedNode.type === 'subject' && (
                            <div className="space-y-3">
                                <button onClick={() => startSession('normal')} className="w-full py-4 rounded-[1.5rem] bg-white text-slate-950 font-black uppercase tracking-[0.2em] text-xs hover:bg-sky-50 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-3"><PlayIcon className="w-4 h-4 fill-current" /> Iniciar Prática</button>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => startSession('marked')} className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl font-bold text-[9px] uppercase tracking-widest hover:bg-indigo-500/20 border border-indigo-500/20 transition-all flex flex-col items-center gap-1"><BookmarkSolidIcon className="w-4 h-4"/> Marcados</button>
                                    <button onClick={() => startSession('errors')} className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl font-bold text-[9px] uppercase tracking-widest hover:bg-rose-500/20 border border-rose-500/20 transition-all flex flex-col items-center gap-1"><TrashIcon className="w-4 h-4"/> Erradas</button>
                                    <button onClick={() => startSession('critical')} className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl font-bold text-[9px] uppercase tracking-widest hover:bg-amber-500/20 border border-amber-500/20 transition-all flex flex-col items-center gap-1"><BoltIcon className="w-4 h-4"/> Críticos</button>
                                </div>
                                <button onClick={() => setShowContentModal(true)} className="w-full py-3 mt-1 rounded-2xl bg-white/5 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 border border-white/5"><BookOpenIcon className="w-4 h-4" /> Ver Conteúdo</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {isDeleteModalOpen && focusedNode && (
                <DeleteDisciplineModal 
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    subjectName={focusedNode.id}
                    stats={getDeletionStats()}
                    onConfirm={handleDeleteDiscipline}
                />
            )}
            
            {isFreezeModalOpen && focusedNode && (
                <FreezeDisciplineModal 
                    isOpen={isFreezeModalOpen}
                    onClose={() => setIsFreezeModalOpen(false)}
                    subjectName={focusedNode.id}
                    onConfirm={handleFreezeDiscipline}
                />
            )}
            
            <FrozenManagerModal
                isOpen={isFrozenListOpen}
                onClose={() => setIsFrozenListOpen(false)}
                frozenSubjects={frozenSubjects}
                onUnfreeze={handleUnfreezeDiscipline}
            />

            {activeSession && <StudySessionModal isOpen={!!activeSession} onClose={() => setActiveSession(null)} title={activeSession.title} questions={activeSession.questions} onStudyRefNavigate={onStudyRefNavigate} context="orbital" />}
            {showContentModal && focusedNode && <QuestionListModal isOpen={showContentModal} onClose={() => setShowContentModal(false)} title={focusedNode.label} questions={selectedSectorQuestions} onPreview={(q) => setPreviewQuestion(q)} onPractice={() => {}} context="orbital" />}
            
            {/* PREVIEW QUESTION MODAL */}
            {previewQuestion && (
                <InteractiveQuestionModal
                    question={previewQuestion}
                    onClose={() => setPreviewQuestion(null)}
                    onQuestionAnswered={() => {}}
                    context="orbital"
                />
            )}
            
            <MergeDisciplinesModal isOpen={isMergeModalOpen} onClose={() => { setIsMergeModalOpen(false); setMergeCandidates([]); setEditMode(false); }} sourceA={mergeCandidates[0]} sourceB={mergeCandidates[1]} onConfirm={handleMergeConfirm} />
        </div>
    );
};

export default MapView;
