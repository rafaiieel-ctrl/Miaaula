
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiteralnessState, useLiteralnessDispatch } from '../contexts/LiteralnessContext';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { useFlashcardState, useFlashcardDispatch } from '../contexts/FlashcardContext';
import { useSettings } from '../contexts/SettingsContext';
import { LiteralnessCard, LawContentType, Question, Flashcard, StudyRef } from '../types';
import { repository, HydratedNucleus } from '../services/repository';
import LoadingState from '../components/LoadingState';
import LiteralnessLawMap from '../components/literalness/LiteralnessLawMap';
import LiteralnessKanban from '../components/literalness/LiteralnessKanban';
import LiteralnessGame from '../components/literalness/LiteralnessGame';
import ImportLiteralness from '../components/literalness/ImportLiteralness';
import FlashcardStudySessionModal from '../components/FlashcardStudySessionModal';
import LightningQuizView from './LightningQuizView';
import PairMatchGame from '../components/pairmatch/PairMatchGame'; 
import { SwordIcon, PlusIcon, ChevronLeftIcon, BookOpenIcon, BrainIcon, MapIcon, ClipboardDocumentCheckIcon, BoltIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, PuzzlePieceIcon } from '../components/icons';
import { filterExecutableItems } from '../services/contentGate'; 

type ViewMode = 'hub' | 'kanban' | 'article_panel' | 'import' | 'read' | 'gaps' | 'questions' | 'flashcards' | 'onemin' | 'pairs';

const LiteralnessView: React.FC<{ type?: LawContentType; activeStudyRef?: StudyRef | null }> = ({ type = 'LAW_DRY', activeStudyRef }) => {
    const rawCards = useLiteralnessState();
    
    // Apply Gate to Cards immediately AND Filter by Scope (Hide Trail content)
    const cards = useMemo(() => 
        filterExecutableItems(
            rawCards.filter(c => c.contentType === type && c.scope !== 'TRILHA')
        ), 
    [rawCards, type]);

    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    const { updateBatchFlashcards } = useFlashcardDispatch();
    const { logDailyActivity, settings, updateSettings } = useSettings();

    const [viewMode, setViewMode] = useState<ViewMode>('hub');
    const [hydratedData, setHydratedData] = useState<HydratedNucleus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);

    useEffect(() => {
        const handleResize = () => setWindowHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isCompact = windowHeight < 800;

    useEffect(() => {
        if (activeStudyRef && activeStudyRef.sourceType === 'LEI_SECA' && activeStudyRef.target?.cardId) {
            const card = cards.find(c => c.id === activeStudyRef.target.cardId);
            if (card) {
                handleOpenArticle(card);
            }
        }
    }, [activeStudyRef, cards]);

    const handleOpenArticle = useCallback(async (card: LiteralnessCard) => {
        setIsLoading(true);
        try {
            const data = await repository.getNucleusHydrated(card.id);
            if (data) {
                setHydratedData(data);
                setViewMode('article_panel');
                setIsTextExpanded(false); 
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    if (isLoading) return <LoadingState message="Acessando registros..." />;

    // --- RENDERS DAS ATIVIDADES ---

    if (viewMode === 'read' && hydratedData) {
        return <LiteralnessGame cards={[hydratedData.nucleus]} mode="read" onExit={() => setViewMode('article_panel')} />;
    }

    if (viewMode === 'gaps' && hydratedData) {
        const hydratedCard = repository.hydrateCardWithGaps(hydratedData.nucleus, hydratedData.lacunas);
        return <LiteralnessGame cards={[hydratedCard]} mode="gaps" onExit={() => setViewMode('article_panel')} />;
    }

    if (viewMode === 'questions' && hydratedData) {
        const hydratedCard = { ...hydratedData.nucleus, questionIds: hydratedData.questions.map(q => q.id) };
        return <LiteralnessGame cards={[hydratedCard]} mode="questions" onExit={() => setViewMode('article_panel')} />;
    }

    if (viewMode === 'flashcards' && hydratedData) {
        const studyCards = hydratedData.flashcards.map(i => i.payload as Flashcard);
        return (
            <FlashcardStudySessionModal 
                isOpen={true}
                onClose={() => setViewMode('article_panel')}
                title={`Flashcards: ${hydratedData.nucleus.article}`}
                cards={studyCards}
                onSessionFinished={() => { logDailyActivity('COMPLETE_FLASHCARDS'); setViewMode('article_panel'); }}
            />
        );
    }
    
    if (viewMode === 'pairs' && hydratedData) {
        const pairCards = hydratedData.pairs.map(i => i.payload as Flashcard);
        return (
            <div className="fixed inset-0 z-[100] bg-[#020617]">
                 <PairMatchGame 
                    items={pairCards}
                    topicTitle={`Pares: ${hydratedData.nucleus.article}`}
                    pairCount={pairCards.length}
                    onRoundFinished={(result, updatedItems) => {
                        if (updatedItems.length > 0) {
                            updateBatchFlashcards(updatedItems.map(f => ({ id: f.id, ...f })));
                        }
                        logDailyActivity('PLAY_PAIR_MATCH');
                    }}
                    onExit={() => setViewMode('article_panel')}
                    settings={settings}
                    cycleStats={{ total: pairCards.length, completed: 0 }}
                    isStudyMode={false}
                 />
            </div>
        );
    }

    if (viewMode === 'onemin' && hydratedData) {
        const mix = [
            ...hydratedData.lacunas.map(l => ({ 
                ...l.payload, 
                questionText: l.payload.questionText || l.payload.lacuna_text || l.payload.q_text || "",
                correctAnswer: l.payload.correctAnswer || l.payload.correct_letter || l.payload.correct || 'A',
                options: l.payload.options || {},
                isGapType: true, 
                id: l.id, 
                parentCard: hydratedData.nucleus 
            })),
            ...hydratedData.questions.map(q => ({ 
                ...q.payload, 
                questionText: q.payload.questionText || q.payload.q_text || "",
                correctAnswer: q.payload.correctAnswer || q.payload.correct || 'A',
                id: q.id, 
                parentCard: hydratedData.nucleus 
            }))
        ];
        return (
            <LightningQuizView 
                preSelectedQuestions={mix}
                onExit={() => setViewMode('article_panel')}
            />
        );
    }

    if (viewMode === 'article_panel' && hydratedData) {
        const { nucleus, counts } = hydratedData;
        
        const actions = [
            { id: 'read', label: 'Leitura', icon: <BookOpenIcon />, count: null, available: true, color: 'text-sky-400', border: 'hover:border-sky-500/30' },
            { id: 'gaps', label: 'Lacunas', icon: <MapIcon />, count: counts.lacunas, available: counts.lacunas > 0, color: 'text-amber-400', border: 'hover:border-amber-500/30' },
            { id: 'questions', label: 'Questões', icon: <BrainIcon />, count: counts.questions, available: counts.questions > 0, color: 'text-indigo-400', border: 'hover:border-indigo-500/30' },
            { id: 'flashcards', label: 'Cards', icon: <ClipboardDocumentCheckIcon />, count: counts.flashcards, available: counts.flashcards > 0, color: 'text-teal-400', border: 'hover:border-teal-500/30' },
            { id: 'pairs', label: 'Pares', icon: <PuzzlePieceIcon />, count: counts.pairs, available: counts.pairs > 0, color: 'text-violet-400', border: 'hover:border-violet-500/30' },
            { id: 'onemin', label: '1 Min', icon: <BoltIcon />, count: counts.lacunas + counts.questions, available: (counts.lacunas + counts.questions) > 0, color: 'text-orange-400', border: 'hover:border-orange-500/30' },
        ];

        return (
            <div 
                className="fixed inset-0 z-[60] bg-[#020617] flex flex-col animate-fade-in overflow-hidden lg:pl-[var(--sidebar-width)] transition-[padding] duration-200 ease-out"
            >
                <header className="sticky top-0 z-50 flex justify-between items-center px-6 py-4 bg-slate-900/95 backdrop-blur-xl border-b border-white/5 shrink-0 shadow-lg">
                    <button 
                        onClick={() => setViewMode('hub')} 
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 active:scale-95 group"
                    >
                        <ChevronLeftIcon className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
                    </button>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Painel de Artigo</p>
                        <h3 className="text-xs md:text-sm font-bold text-white truncate max-w-[150px] md:max-w-md">{nucleus.lawId}</h3>
                    </div>
                </header>
                
                <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                    <div className={`max-w-6xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col h-full ${isCompact ? 'gap-4' : 'gap-8'}`}>
                        
                        <section className={`bg-slate-900 border border-white/10 rounded-[1.5rem] overflow-hidden shadow-2xl relative group shrink-0 transition-all duration-300 ${isCompact ? 'p-0' : ''}`}>
                            <div className={`${isCompact ? 'p-5' : 'p-6 md:p-8'} space-y-3`}>
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <h2 className={`${isCompact ? 'text-xl' : 'text-2xl md:text-3xl'} font-black text-white italic tracking-tighter`}>{nucleus.article}</h2>
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 bg-white/5 border border-white/5 px-3 py-1 rounded-lg uppercase tracking-wide">
                                        {nucleus.topic || 'Geral'}
                                    </span>
                                </div>

                                <div className={`relative transition-all duration-500 ease-in-out ${isTextExpanded ? '' : isCompact ? 'max-h-[100px] overflow-hidden' : 'max-h-[180px] overflow-hidden'}`}>
                                    <p className={`${isCompact ? 'text-sm' : 'text-base md:text-lg'} text-white/90 leading-relaxed font-medium whitespace-pre-wrap font-sans`}>
                                        {nucleus.phase1Full}
                                    </p>
                                    {!isTextExpanded && (
                                        <div className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent pointer-events-none ${isCompact ? 'h-16' : 'h-24'}`}></div>
                                    )}
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setIsTextExpanded(!isTextExpanded)}
                                className="w-full py-2 bg-white/[0.02] hover:bg-white/[0.05] border-t border-white/5 text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                            >
                                {isTextExpanded ? (
                                    <>Recolher <ChevronUpIcon className="w-3 h-3" /></>
                                ) : (
                                    <>Ler Tudo <ChevronDownIcon className="w-3 h-3" /></>
                                )}
                            </button>
                        </section>
                        
                        <section className="flex-1 min-h-min flex flex-col justify-end pb-4">
                             <div className="flex items-center gap-3 mb-3 px-1">
                                 <div className="w-1 h-4 bg-sky-500 rounded-full shadow-[0_0_10px_#0ea5e9]"></div>
                                 <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Atividades Disponíveis</h4>
                             </div>
                             
                             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                 {actions.map(action => (
                                     <button
                                         key={action.id}
                                         onClick={() => setViewMode(action.id as ViewMode)}
                                         disabled={!action.available}
                                         className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-[0.98] group overflow-hidden
                                             ${isCompact ? 'h-24' : 'h-32'}
                                             ${action.available 
                                                 ? `bg-slate-900/60 border-white/10 ${action.border} hover:bg-slate-800 shadow-sm hover:shadow-lg` 
                                                 : 'bg-transparent border-white/5 opacity-40 cursor-not-allowed'}
                                         `}
                                     >
                                         <div className={`mb-2 p-2.5 rounded-2xl transition-transform duration-300 ${action.available ? `bg-white/5 ${action.color} group-hover:scale-110 group-hover:bg-white/10` : 'bg-white/5 text-slate-600'}`}>
                                            {React.cloneElement(action.icon as React.ReactElement<{ className?: string }>, { className: isCompact ? "w-5 h-5" : "w-6 h-6" })}
                                         </div>
                                         
                                         <span className={`text-[9px] font-black uppercase tracking-widest ${action.available ? 'text-slate-300 group-hover:text-white' : 'text-slate-600'}`}>
                                             {action.label}
                                         </span>
                                         
                                         {action.count !== null && (
                                             <span className={`text-[8px] font-bold text-slate-500 mt-1 bg-black/20 px-2 py-0.5 rounded-md border border-white/5 ${isCompact ? 'hidden group-hover:inline-block' : 'inline-block'}`}>
                                                 {action.count}
                                             </span>
                                         )}
                                         {action.available && (
                                             <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br from-white to-transparent pointer-events-none`}></div>
                                         )}
                                     </button>
                                 ))}
                             </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'import') return <ImportLiteralness type={type} onBack={() => setViewMode('hub')} />;

    return (
        <div className="space-y-10 pb-24 animate-fade-in max-w-6xl mx-auto px-4">
            <header className="flex flex-col items-center text-center mt-6">
                <div className="p-6 bg-slate-900 rounded-[3rem] border border-white/5 shadow-2xl mb-8 relative group cursor-pointer overflow-hidden">
                    <SwordIcon className="w-16 h-16 text-sky-400 group-hover:scale-110 transition-transform relative z-10" />
                    <div className="absolute inset-0 bg-sky-500/5 blur-xl group-hover:bg-sky-500/10 transition-colors"></div>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">Lei Seca</h2>
                <div className="flex gap-4 mt-8">
                    <button onClick={() => setViewMode('import')} className="flex items-center gap-2.5 px-6 py-2.5 rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"><PlusIcon className="w-4 h-4" /> Importar</button>
                </div>
            </header>

            <div className="flex justify-center mb-8">
                <div className="p-1.5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/5 flex gap-1 shadow-lg">
                    <button className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'hub' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setViewMode('hub')}>Mapa</button>
                    <button className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setViewMode('kanban')}>Kanban</button>
                </div>
            </div>

            <div className="animate-fade-in">
                {viewMode === 'kanban' ? (
                    <LiteralnessKanban cards={cards} onEditCard={handleOpenArticle} />
                ) : (
                    <LiteralnessLawMap 
                        cards={cards} 
                        onStudyArticle={() => {}} 
                        onViewArticle={handleOpenArticle} 
                        onViewDiagnostic={() => {}} 
                    />
                )}
            </div>
        </div>
    );
};

export default LiteralnessView;
