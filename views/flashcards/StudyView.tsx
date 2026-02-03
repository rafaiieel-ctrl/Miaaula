
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Flashcard, BuildStudyQueueResult } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { buildStudyQueue } from '../../services/queueBuilder';
import QueueFilters from '../../components/QueueFilters';
import FlashcardStudyScheduler from '../../components/FlashcardStudyScheduler';
import FlashcardStudySessionModal from '../../components/FlashcardStudySessionModal';
import { ClipboardDocumentCheckIcon, ChevronDownIcon, PlayIcon, SparklesIcon, FilterIcon } from '../../components/icons';
import { GlassPanel, SectionHeader, MetricTile, PrimaryCTA } from '../../components/ui/DesignSystem';

interface StudyViewProps {
  allFlashcards: Flashcard[];
}

const StudyView: React.FC<StudyViewProps> = ({ allFlashcards }) => {
    const { settings, logDailyActivity } = useSettings();
    
    const [activeSessionData, setActiveSessionData] = useState<{ title: string; cards: Flashcard[] } | null>(null);
    const [scheduledSession, setScheduledSession] = useState<{ title: string, cards: Flashcard[] } | null>(null);

    const [isCustomizing, setIsCustomizing] = useState(false);
    const [filters, setFilters] = useState<any>({});
    const [sessionSize, setSessionSize] = useState(20);
    const [sessionPreview, setSessionPreview] = useState<BuildStudyQueueResult<Flashcard> | null>(null);
    const [isStandardSessionFlag, setIsStandardSessionFlag] = useState(false);

    const standardSessionData = useMemo(() => {
        return buildStudyQueue({
            mode: 'standard',
            allItems: allFlashcards,
            settings,
            filters: {},
            sessionSize: 999, // Zerar todos
            allowEarlyItems: !settings.lockEarlyReview,
        });
    }, [allFlashcards, settings]);

    const handleStartStandardSession = () => {
        if (standardSessionData && standardSessionData.queue.length > 0) {
            setIsStandardSessionFlag(true);
            setActiveSessionData({
                title: 'Revisão de Flashcards',
                cards: standardSessionData.queue.map(c => c.item),
            });
        }
    };
    
    const startSessionFromPreview = () => {
        if (sessionPreview) {
            setIsStandardSessionFlag(false);
            setActiveSessionData({
                title: 'Sessão Personalizada',
                cards: sessionPreview.queue.map(c => c.item)
            });
        }
    };

    const handlePreviewCustomSession = useCallback(() => {
        const result = buildStudyQueue({
            mode: 'standard',
            allItems: allFlashcards,
            settings,
            filters,
            sessionSize,
            allowEarlyItems: true, // Custom sessions ignore the lock
        });
        setSessionPreview(result);
    }, [allFlashcards, settings, filters, sessionSize]);

    // Effect to update preview when filters or size change
    useEffect(() => {
        if (isCustomizing) {
            handlePreviewCustomSession();
        }
    }, [isCustomizing, filters, sessionSize, handlePreviewCustomSession]);
    
    const hasAvailableStandardCards = standardSessionData && standardSessionData.queue.length > 0;

    return (
        <>
            <div className="space-y-8 max-w-5xl mx-auto px-4 animate-fade-in">
                
                {/* 1. Recommended Session Panel */}
                <GlassPanel className="p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <SectionHeader 
                            icon={<SparklesIcon />} 
                            title="Recomendação do Dia" 
                            subtitle="Algoritmo SRS"
                        />
                        {!hasAvailableStandardCards && (
                            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                                Tudo em Dia
                            </span>
                        )}
                    </div>
                    
                    {hasAvailableStandardCards ? (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <MetricTile label="Total" value={standardSessionData.kpis.mix.total} tooltip="Total de flashcards prontos." highlight />
                                <MetricTile label="Novos" value={standardSessionData.kpis.mix.new} tooltip="Flashcards nunca vistos." />
                                <MetricTile label="Domínio" value={`${standardSessionData.kpis.kpiPreview.meanD.toFixed(0)}%`} tooltip="Domínio médio atual." />
                                <MetricTile label="Tempo" value={`~${Math.ceil((standardSessionData.kpis.mix.total * 15) / 60)}m`} tooltip="Estimativa de tempo." />
                            </div>
                            <PrimaryCTA onClick={handleStartStandardSession} icon={<PlayIcon />}>
                                Iniciar Revisão
                            </PrimaryCTA>
                        </>
                    ) : (
                        <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                            <p className="text-slate-400 font-medium text-sm">Nenhum flashcard pendente para o algoritmo SRS.</p>
                            <p className="text-xs text-slate-600 mt-1">Utilize a sessão personalizada abaixo ou adiante estudos.</p>
                        </div>
                    )}
                </GlassPanel>
                
                {/* 2. Custom Session Accordion */}
                <GlassPanel>
                    <details className="group" onToggle={(e) => setIsCustomizing((e.target as HTMLDetailsElement).open)}>
                        <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/5 transition-colors select-none">
                            <SectionHeader icon={<FilterIcon />} title="Sessão Personalizada" className="pointer-events-none" />
                            <div className="p-2 rounded-full bg-white/5 text-slate-400 group-open:rotate-180 transition-transform duration-300">
                                <ChevronDownIcon className="w-5 h-5" />
                            </div>
                        </summary>
                        
                        <div className="px-6 pb-6 pt-2 space-y-6 border-t border-white/5 animate-fade-in">
                            <QueueFilters allItems={allFlashcards} onFilterChange={setFilters} />
                            
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                                    <label htmlFor="fc-session-size" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Limite:</label>
                                    <input 
                                        id="fc-session-size" 
                                        type="number" 
                                        value={sessionSize} 
                                        onChange={e => setSessionSize(Math.max(1, parseInt(e.target.value, 10) || 1))} 
                                        className="w-16 bg-transparent text-center font-black text-white outline-none border-b border-white/20 focus:border-sky-500 transition-colors" 
                                        min="1" max="200" step="5" 
                                    />
                                </div>
                                <button 
                                    onClick={startSessionFromPreview} 
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-white/10 active:scale-95"
                                >
                                    Iniciar Personalizada
                                </button>
                            </div>
                        </div>
                    </details>
                </GlassPanel>

                {/* 3. Scheduler */}
                <FlashcardStudyScheduler 
                    flashcards={allFlashcards}
                    onStartStudy={(title, cards) => {
                        if (cards.length === 0) return;
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const sessionDate = new Date(cards[0].nextReviewDate);
                        sessionDate.setHours(0,0,0,0);

                        if (settings.lockEarlyReview && sessionDate > today) {
                            alert("Revisão bloqueada para não distorcer sua curva de esquecimento.");
                            return;
                        }
                        setScheduledSession({ title, cards });
                    }}
                />
            </div>
            
            <FlashcardStudySessionModal 
                isOpen={!!activeSessionData}
                onClose={() => { setActiveSessionData(null); setIsStandardSessionFlag(false); }}
                title={activeSessionData?.title || ''}
                cards={activeSessionData?.cards || []}
                onSessionFinished={() => {
                    if (isStandardSessionFlag) {
                        logDailyActivity('COMPLETE_FLASHCARDS');
                    }
                }}
            />
             <FlashcardStudySessionModal 
                isOpen={!!scheduledSession} 
                onClose={() => setScheduledSession(null)} 
                title={scheduledSession?.title || ''} 
                cards={scheduledSession?.cards || []} 
            />
        </>
    );
};

export default StudyView;
