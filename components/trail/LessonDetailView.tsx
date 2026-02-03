
import React, { useState, useMemo, useEffect } from 'react';
import { LessonNode, GameResult, Flashcard, Question } from '../../types';
import { useTrailDispatch } from '../../contexts/TrailContext';
import { useQuestionState, useQuestionDispatch } from '../../contexts/QuestionContext';
import { useFlashcardState, useFlashcardDispatch } from '../../contexts/FlashcardContext';
import { useSettings } from '../../contexts/SettingsContext';
import { ChevronLeftIcon, ChevronRightIcon, BrainIcon, ClipboardDocumentCheckIcon, BookOpenIcon, ChartBarIcon, PencilIcon, TrashIcon, PlusIcon, ListBulletIcon, XMarkIcon, SearchIcon, CheckCircleIcon, TagIcon, PuzzlePieceIcon, BoltIcon } from '../icons'; // Added BoltIcon
import StudySessionModal from '../StudySessionModal';
import FlashcardStudySessionModal from '../FlashcardStudySessionModal';
import EditQuestionModal from '../EditQuestionModal';
import ConfirmationModal from '../ConfirmationModal';
import PairMatchGame from '../pairmatch/PairMatchGame'; 
import * as srs from '../../services/srsService';
import RelatorioTabView from './RelatorioTabView';
import LightningQuizView from '../../views/LightningQuizView'; // Added Import
import { isStrictQuestion } from '../../services/contentGate';

interface LessonDetailViewProps {
    lesson: LessonNode;
    onBack: () => void;
}

const EditLessonModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    lesson: LessonNode;
    onSave: (updated: LessonNode) => void;
    onDelete: (id: string) => void;
}> = ({ isOpen, onClose, lesson, onSave, onDelete }) => {
    const [form, setForm] = useState({
        code: lesson.code,
        title: lesson.title,
        order: lesson.order,
        themeTag: lesson.themeTag || '',
        keyPoints: lesson.keyPoints.join('\n'),
        summary: (lesson.summary || []).join('\n\n'),
        explanations: lesson.explanations.join('\n\n')
    });
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!form.title.trim()) { alert("O título da aula é obrigatório."); return; }
        if (form.order < 1) { alert("A ordem deve ser maior ou igual a 1."); return; }
        
        onSave({
            ...lesson,
            code: form.code.trim(),
            title: form.title.trim(),
            order: Math.floor(form.order),
            themeTag: form.themeTag.trim(),
            keyPoints: form.keyPoints.split('\n').filter(l => l.trim()),
            summary: form.summary.split('\n\n').filter(l => l.trim()),
            explanations: form.explanations.split('\n\n').filter(l => l.trim())
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-bunker-950 w-full max-w-2xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/10" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-bunker-100 dark:border-white/5 flex justify-between items-center bg-slate-900/20">
                    <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tighter">Editar Aula</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><XMarkIcon /></button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Código</label>
                            <input 
                                value={form.code} 
                                onChange={e => setForm({...form, code: e.target.value})}
                                className="w-full bg-white dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-sky-500"
                                placeholder="Aula 01"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Título da Aula</label>
                            <input 
                                value={form.title} 
                                onChange={e => setForm({...form, title: e.target.value})}
                                className="w-full bg-white dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-sky-500"
                                placeholder="Introdução à Matéria"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Ordem na Trilha</label>
                            <input 
                                type="number"
                                min="1"
                                value={form.order} 
                                onChange={e => setForm({...form, order: parseInt(e.target.value) || 1})}
                                className="w-full bg-white dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tag / Subtema</label>
                            <input 
                                value={form.themeTag} 
                                onChange={e => setForm({...form, themeTag: e.target.value})}
                                className="w-full bg-white dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-sky-500"
                                placeholder="Ex: Conceitos Iniciais"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Pontos Chave (Um por linha)</label>
                        <textarea 
                            value={form.keyPoints} 
                            onChange={e => setForm({...form, keyPoints: e.target.value})}
                            rows={4}
                            className="w-full bg-white dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-4 text-sm outline-none focus:border-sky-500 custom-scrollbar"
                            placeholder="Tópico 1&#10;Tópico 2"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Resumo (Separe blocos com 2 linhas vazias)</label>
                        <textarea 
                            value={form.summary} 
                            onChange={e => setForm({...form, summary: e.target.value})}
                            rows={4}
                            className="w-full bg-white dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-4 text-sm outline-none focus:border-sky-500 custom-scrollbar"
                            placeholder="Resumo geral do conteúdo..."
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Detalhamento (Separe blocos com 2 linhas vazias)</label>
                        <textarea 
                            value={form.explanations} 
                            onChange={e => setForm({...form, explanations: e.target.value})}
                            rows={6}
                            className="w-full bg-white dark:bg-slate-900 border border-bunker-200 dark:border-white/5 rounded-xl p-4 text-sm outline-none focus:border-sky-500 custom-scrollbar"
                            placeholder="Texto detalhado da aula..."
                        />
                    </div>
                </div>

                <footer className="p-6 bg-slate-900/20 border-t border-bunker-100 dark:border-white/5 flex flex-col sm:flex-row justify-between gap-4">
                    <button 
                        onClick={() => setIsConfirmDeleteOpen(true)}
                        className="px-6 py-3 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <TrashIcon className="w-4 h-4" /> Excluir Aula
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-3 rounded-xl bg-bunker-100 dark:bg-white/5 text-slate-500 font-bold text-xs uppercase tracking-widest">Cancelar</button>
                        <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-sky-600 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:bg-sky-500">Salvar Alterações</button>
                    </div>
                </footer>

                <ConfirmationModal 
                    isOpen={isConfirmDeleteOpen} 
                    onClose={() => setIsConfirmDeleteOpen(false)} 
                    onConfirm={() => { onDelete(lesson.id); onClose(); }} 
                    title="Excluir esta aula?"
                >
                    <p>Isso removerá a aula da sua trilha. As questões e flashcards vinculados continuarão existindo no seu banco de dados geral, mas o progresso específico desta aula será perdido.</p>
                </ConfirmationModal>
            </div>
        </div>
    );
};

const LessonDetailView: React.FC<LessonDetailViewProps> = ({ lesson, onBack }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'content' | 'practice' | 'reports'>('summary');
    const { syncLessonState, deleteLesson, addOrUpdateLesson } = useTrailDispatch();
    const { updateQuestion } = useQuestionDispatch();
    const { updateBatchFlashcards } = useFlashcardDispatch();
    const { settings, logDailyActivity } = useSettings();
    
    const [isEditLessonOpen, setIsEditLessonOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [sidebarOffset, setSidebarOffset] = useState(0);

    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    
    // --- SIDEBAR OFFSET LOGIC ---
    useEffect(() => {
        const updateSidebarWidth = () => {
            const sidebar = document.querySelector('aside');
            if (sidebar) {
                 if (window.innerWidth >= 768) {
                     setSidebarOffset(sidebar.getBoundingClientRect().width);
                 } else {
                     setSidebarOffset(0);
                 }
            }
        };
        
        updateSidebarWidth();
        
        const sidebar = document.querySelector('aside');
        const observer = new ResizeObserver(updateSidebarWidth);
        if (sidebar) observer.observe(sidebar);
        
        window.addEventListener('resize', updateSidebarWidth);
        
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateSidebarWidth);
        }
    }, []);

    const lessonQuestions = useMemo(() => {
        const refs = lesson.questionRefs || [];
        return allQuestions.filter(q => 
            (refs.includes(q.id) || refs.includes(q.questionRef) || q.topic === lesson.title)
            && isStrictQuestion(q) // STRICT FILTER: No Gaps allowed in Question list
        );
    }, [allQuestions, lesson]);

    const lessonFlashcards = useMemo(() => {
        const refs = lesson.flashcardRefs || [];
        // Robust filtering: check refs AND lesson linkage via tags/topic
        return allFlashcards.filter(fc => {
            if (refs.includes(fc.id)) return true;
            if (fc.topic === lesson.title && fc.discipline === lesson.subjectId) return true;
            if (fc.tags && Array.isArray(fc.tags)) {
                if (fc.tags.includes(lesson.id) || fc.tags.includes(lesson.uid || '')) return true;
            }
            return false;
        });
    }, [allFlashcards, lesson]);

    // NEW: Separate Pairs from standard Flashcards
    const lessonPairs = useMemo(() => {
        return lessonFlashcards.filter(fc => fc.tags?.includes('pair-match'));
    }, [lessonFlashcards]);

    const lessonStudyCards = useMemo(() => {
        return lessonFlashcards.filter(fc => !fc.tags?.includes('pair-match'));
    }, [lessonFlashcards]);

    // --- ACTIVITY STATES ---
    const [questionSession, setQuestionSession] = useState(false);
    const [flashcardSession, setFlashcardSession] = useState(false);
    const [pairSession, setPairSession] = useState(false); 
    const [lightningSession, setLightningSession] = useState(false);
    const [lightningQueue, setLightningQueue] = useState<Question[]>([]);

    const [retryQuestions, setRetryQuestions] = useState<Question[]>([]);

    const handleFinishQuestions = () => {
        syncLessonState(lesson.id, allQuestions, allFlashcards, settings);
    };

    const handleFinishFlashcards = () => {
        syncLessonState(lesson.id, allQuestions, allFlashcards, settings);
    }
    
    const handleFinishPairs = (result: GameResult, updatedItems: Flashcard[]) => {
         updateBatchFlashcards(updatedItems);
         syncLessonState(lesson.id, allQuestions, allFlashcards, settings);
         logDailyActivity('PLAY_PAIR_MATCH');
         setPairSession(false);
    }
    
    // --- LIGHTNING GAME LOGIC ---
    const handleStartLightning = () => {
        if (lessonQuestions.length === 0) {
            alert("Sem questões disponíveis para o Minuto de Porrada.");
            return;
        }

        // Build Intelligent Queue
        const pool = [...lessonQuestions];
        const now = new Date();
        
        // Sorting: 
        // 1. Pending Reviews (SRS)
        // 2. Recent Errors
        // 3. Low Mastery
        // 4. Random Mix
        
        pool.sort((a, b) => {
             // Check SRS Due
             const aDue = new Date(a.nextReviewDate) <= now;
             const bDue = new Date(b.nextReviewDate) <= now;
             if (aDue && !bDue) return -1;
             if (!aDue && bDue) return 1;
             
             // Check Errors
             const aError = a.totalAttempts > 0 && !a.lastWasCorrect;
             const bError = b.totalAttempts > 0 && !b.lastWasCorrect;
             if (aError && !bError) return -1;
             if (!aError && bError) return 1;
             
             // Check Mastery
             const aMastery = a.masteryScore || 0;
             const bMastery = b.masteryScore || 0;
             if (aMastery !== bMastery) return aMastery - bMastery;
             
             return Math.random() - 0.5;
        });

        // Limit to 30 for performance in arcade
        setLightningQueue(pool.slice(0, 30));
        setLightningSession(true);
    };
    
    const handleFinishLightning = (score?: number, passed?: boolean, pendingCommits?: any[]) => {
         if (score !== undefined) {
             // Commit results handled inside LightningQuizView via registerAttempt
             // Just sync the lesson state here
             syncLessonState(lesson.id, allQuestions, allFlashcards, settings);
             logDailyActivity('COMPLETE_QUESTIONS');
         }
         setLightningSession(false);
    };

    const handleSaveLesson = (updated: LessonNode) => {
        addOrUpdateLesson(updated);
    };

    const handleDeleteLesson = (id: string) => {
        deleteLesson(id);
        onBack();
    };

    const handleRetryErrors = (ids: string[]) => {
        const errors = allQuestions.filter(q => ids.includes(q.id));
        if (errors.length > 0) {
            setRetryQuestions(errors);
            setQuestionSession(true);
        }
    };

    return (
        <div 
            className="fixed inset-y-0 right-0 z-[40] flex flex-col bg-[#020617] text-slate-100 font-sans select-none overflow-hidden transition-[left] duration-200"
            style={{ left: sidebarOffset }}
        >
            {/* 1. NEW HEADER (Clean & Dense) */}
            <header className="shrink-0 px-6 py-4 flex items-start justify-between gap-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-xl z-30">
                <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all border border-white/5 shrink-0">
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight truncate">
                            {lesson.title}
                        </h1>
                    </div>
                    <div className="text-xs md:text-sm text-white/60 font-mono pl-11 flex flex-wrap gap-2 items-center">
                        <span>{lesson.code}</span>
                        <span className="text-white/20">•</span>
                        <span>Ordem {lesson.order}</span>
                        {lesson.themeTag && (
                            <>
                                <span className="text-white/20">•</span>
                                <span className="uppercase tracking-widest text-sky-500">{lesson.themeTag}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => setIsEditLessonOpen(true)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs md:text-sm font-medium transition-colors">
                        Editar
                    </button>
                </div>
            </header>

            {/* 2. MAIN SCROLLABLE CONTENT */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="mx-auto w-full max-w-6xl px-6 py-6 space-y-8">
                    
                    {/* TABS (Modern Style) */}
                    <div className="flex flex-wrap gap-2 border-b border-white/5 pb-1">
                        {[
                            { id: 'summary', label: 'Visão Geral' },
                            { id: 'content', label: 'Conteúdo' },
                            { id: 'practice', label: 'Prática' },
                            { id: 'reports', label: 'Relatórios' }
                        ].map(t => (
                            <button
                                key={t.id}
                                className={`px-4 py-2 rounded-t-xl text-sm font-bold border-t border-x border-transparent transition-all ${
                                    activeTab === t.id
                                        ? "bg-white/5 border-white/10 text-white"
                                        : "text-white/50 hover:text-white hover:bg-white/5"
                                }`}
                                onClick={() => setActiveTab(t.id as any)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* CONTENT RENDER */}
                    {activeTab === 'summary' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid gap-6 lg:grid-cols-2">
                                {/* RESUMO */}
                                <section className="rounded-2xl border border-white/10 bg-white/5 p-6 h-full">
                                    <div className="text-xs tracking-[0.2em] font-black text-white/40 uppercase mb-4 flex items-center gap-2">
                                        <BookOpenIcon className="w-4 h-4"/> Resumo
                                    </div>
                                    <div className="space-y-3">
                                        {(lesson.summary || []).length > 0 ? (lesson.summary || []).map((s, i) => (
                                            <div key={i} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                                                {s}
                                            </div>
                                        )) : <div className="text-white/30 text-sm italic">Sem resumo cadastrado.</div>}
                                    </div>
                                </section>

                                {/* DETALHAMENTO */}
                                <section className="rounded-2xl border border-white/10 bg-white/5 p-6 h-full">
                                    <div className="text-xs tracking-[0.2em] font-black text-white/40 uppercase mb-4 flex items-center gap-2">
                                        <ListBulletIcon className="w-4 h-4"/> Detalhamento
                                    </div>
                                    <div className="space-y-3">
                                        {(lesson.explanations || []).length > 0 ? (lesson.explanations || []).map((t, i) => (
                                            <div key={i} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                                                {t}
                                            </div>
                                        )) : <div className="text-white/30 text-sm italic">Sem detalhamento.</div>}
                                    </div>
                                </section>
                            </div>

                            {/* PONTOS-CHAVE */}
                            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <div className="text-xs tracking-[0.2em] font-black text-white/40 uppercase mb-4 flex items-center gap-2">
                                    <CheckCircleIcon className="w-4 h-4"/> Pontos-chave
                                </div>
                                {(lesson.keyPoints || []).length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {(lesson.keyPoints || []).map((kp, i) => (
                                            <div key={i} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-white/90 flex items-start gap-2">
                                                <span className="text-sky-500 mt-1">•</span>
                                                {kp}
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="text-white/30 text-sm italic">Sem pontos chave.</div>}
                            </section>
                        </div>
                    )}

                    {activeTab === 'practice' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                            {[
                                { id: 'q', icon: BrainIcon, title: 'Bateria de Questões', desc: `${lessonQuestions.length} disponíveis`, count: lessonQuestions.length, color: 'text-sky-400', action: () => { setRetryQuestions([]); setQuestionSession(true); } },
                                { id: 'fc', icon: ClipboardDocumentCheckIcon, title: 'Revisar Flashcards', desc: `${lessonStudyCards.length} disponíveis`, count: lessonStudyCards.length, color: 'text-teal-400', action: () => setFlashcardSession(true) },
                                { id: 'pairs', icon: PuzzlePieceIcon, title: 'Pares (Match)', desc: `${lessonPairs.length} pares disponíveis`, count: lessonPairs.length, color: 'text-violet-400', action: () => setPairSession(true) },
                                // NEW: Lightning Card
                                { id: 'lightning', icon: BoltIcon, title: 'Minuto de Porrada', desc: `${lessonQuestions.length} itens disponíveis`, count: lessonQuestions.length, color: 'text-orange-400', action: handleStartLightning },
                            ].map(box => (
                                <button key={box.id} onClick={box.action} disabled={box.count === 0} className="flex flex-col items-start p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 active:scale-95 group text-left shadow-lg">
                                    <div className={`mb-4 p-3 rounded-xl bg-black/30 ${box.color} group-hover:scale-110 transition-transform`}>
                                        <box.icon className="w-6 h-6" />
                                    </div>
                                    <span className="text-lg font-bold text-white tracking-tight">{box.title}</span>
                                    <span className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">{box.desc}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4">Questões ({lessonQuestions.length})</h3>
                                <div className="space-y-2">
                                    {lessonQuestions.map(q => (
                                        <div key={q.id} className="p-3 rounded-xl bg-black/20 border border-white/5 flex justify-between items-center group">
                                            <div className="min-w-0 pr-4">
                                                <span className="text-[9px] font-black text-sky-500 uppercase font-mono mr-2">{q.questionRef}</span>
                                                <span className="text-sm text-white/80 truncate">{q.questionText}</span>
                                            </div>
                                            <button onClick={() => setEditingQuestion(q)} className="p-2 bg-white/5 rounded-lg text-white/50 hover:text-white transition-colors opacity-0 group-hover:opacity-100"><PencilIcon className="w-3 h-3"/></button>
                                        </div>
                                    ))}
                                    {lessonQuestions.length === 0 && <p className="text-white/30 text-sm">Nenhuma questão.</p>}
                                </div>
                            </div>
                             <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4">Flashcards ({lessonFlashcards.length})</h3>
                                <div className="space-y-2">
                                    {lessonFlashcards.map(fc => (
                                        <div key={fc.id} className="p-3 rounded-xl bg-black/20 border border-white/5 flex justify-between items-center group">
                                            <div className="min-w-0 pr-4 flex flex-col">
                                                {/* FIX: Improved rendering for Flashcards to prevent invisible text */}
                                                <span className="text-[10px] font-bold text-sky-500/70 mb-0.5 uppercase tracking-wide">
                                                    {fc.topic || 'Geral'}
                                                </span>
                                                <p className="text-sm text-white/90 font-medium line-clamp-2 block break-words">
                                                    {fc.front || <span className="italic opacity-50 text-xs">Conteúdo Vazio</span>}
                                                </p>
                                                {fc.tags?.includes('pair-match') && <span className="text-[8px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded mt-1 inline-block w-fit uppercase font-bold">Par</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {lessonFlashcards.length === 0 && <p className="text-white/30 text-sm">Nenhum flashcard.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <RelatorioTabView lessonId={lesson.id} onRetryErrors={handleRetryErrors} />
                    )}
                </div>
            </div>

            <StudySessionModal 
                isOpen={questionSession} 
                onClose={() => { setQuestionSession(false); setRetryQuestions([]); }} 
                title={`Ciclo: ${lesson.code}`} 
                questions={retryQuestions.length > 0 ? retryQuestions : lessonQuestions} 
                onSessionFinished={handleFinishQuestions} 
                lessonId={lesson.id}
            />
            
            <FlashcardStudySessionModal 
                isOpen={flashcardSession} 
                onClose={() => setFlashcardSession(false)} 
                title={`Flash: ${lesson.code}`} 
                cards={lessonStudyCards} 
                onSessionFinished={handleFinishFlashcards}
            />
            
            {pairSession && (
                 <div className="fixed inset-0 z-[100] bg-[#020617]">
                     <PairMatchGame 
                        items={lessonPairs}
                        topicTitle={`Pares: ${lesson.title}`}
                        pairCount={lessonPairs.length}
                        onRoundFinished={handleFinishPairs}
                        onExit={() => setPairSession(false)}
                        settings={settings}
                        cycleStats={{ total: lessonPairs.length, completed: 0 }}
                        isStudyMode={false}
                     />
                 </div>
            )}
            
            {lightningSession && (
                 <LightningQuizView 
                    preSelectedQuestions={lightningQueue}
                    onExit={handleFinishLightning}
                    isSurpriseMode={false} // Regular mode for explicit access
                    disableInternalCommit={false} // Allow commits
                 />
            )}
            
            {editingQuestion && (
                <EditQuestionModal 
                    question={editingQuestion} 
                    onClose={() => setEditingQuestion(null)} 
                />
            )}

            {isEditLessonOpen && (
                <EditLessonModal 
                    isOpen={isEditLessonOpen} 
                    onClose={() => setIsEditLessonOpen(false)} 
                    lesson={lesson} 
                    onSave={handleSaveLesson} 
                    onDelete={handleDeleteLesson} 
                />
            )}
        </div>
    );
};

export default LessonDetailView;
