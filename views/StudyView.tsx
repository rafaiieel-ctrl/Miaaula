
import React, { useState, useMemo } from 'react';
import { BuildStudyQueueResult, Question, StudyMode, StudyRef } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useQuestionState } from '../contexts/QuestionContext';
import { buildStudyQueue } from '../services/queueBuilder';
import QueueFilters from '../components/QueueFilters';
import StudyScheduler from '../components/StudyScheduler';
import StudySessionModal from '../components/StudySessionModal';
import { 
    ChevronDownIcon, 
    FilterIcon, 
    BrainIcon, 
    ClockIcon, 
    ExclamationTriangleIcon, 
    BookOpenIcon,
    XMarkIcon
} from '../components/icons';
import { GlassPanel, SectionHeader, MetricTile, PrimaryCTA, ModeCard } from '../components/ui/DesignSystem';

interface StudyViewProps {
  dueQuestions?: Question[]; 
  onStudyRefNavigate?: (ref: StudyRef) => void;
}

const StudyView: React.FC<StudyViewProps> = ({ onStudyRefNavigate }) => {
    const allQuestions = useQuestionState();
    const { settings, logDailyActivity } = useSettings();
    
    // Core State
    const [activeMode, setActiveMode] = useState<StudyMode>('standard');
    const [filters, setFilters] = useState<any>({});
    const [sessionSize, setSessionSize] = useState(20);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    
    // Session Execution State
    const [activeSessionData, setActiveSessionData] = useState<{ title: string; questions: Question[] } | null>(null);
    const [scheduledSession, setScheduledSession] = useState<{ title: string, questions: Question[] } | null>(null);
    const [isStandardSessionFlag, setIsStandardSessionFlag] = useState(false);

    // Queue Calculation
    const queueData = useMemo(() => {
        return buildStudyQueue({
            mode: activeMode,
            allItems: allQuestions,
            settings,
            filters,
            sessionSize,
            allowEarlyItems: !settings.lockEarlyReview || activeMode !== 'standard', 
        });
    }, [allQuestions, settings, filters, sessionSize, activeMode]);

    const activeFilterCount = Object.keys(filters).length;
    const hasItems = queueData.queue.length > 0;

    const handleStartSession = () => {
        if (!hasItems) return;
        
        let sessionTitle = '';
        if (activeMode === 'exam') sessionTitle = 'Simulado (Sprint)';
        else if (activeMode === 'critical') sessionTitle = 'Revisão Crítica';
        else sessionTitle = activeFilterCount > 0 ? 'Sessão Personalizada' : 'Sessão Padrão (SRS)';

        if (filters.subjects && filters.subjects.length === 1) {
            sessionTitle += `: ${filters.subjects[0]}`;
        }

        setIsStandardSessionFlag(activeMode === 'standard' && activeFilterCount === 0);
        setActiveSessionData({
            title: sessionTitle,
            questions: queueData.queue.map(q => q.item),
        });
    };

    const handleClearFilters = () => {
        setFilters({});
    };

    return (
        <>
            <div className="space-y-8 max-w-5xl mx-auto px-4 pb-20 animate-fade-in">
                
                {/* 1. Mode Selection */}
                <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Configurar Sessão</h2>
                    <div className="flex flex-col md:flex-row gap-4">
                        <ModeCard 
                            isActive={activeMode === 'standard'} 
                            onClick={() => setActiveMode('standard')} 
                            icon={<BookOpenIcon />} 
                            title="Padrão (SRS)" 
                            description="Algoritmo inteligente. Mistura revisões e novas." 
                        />
                        <ModeCard 
                            isActive={activeMode === 'exam'} 
                            onClick={() => setActiveMode('exam')} 
                            icon={<ClockIcon />} 
                            title="Modo Prova" 
                            description="Foco em alta prioridade e probabilidade de queda." 
                        />
                        <ModeCard 
                            isActive={activeMode === 'critical'} 
                            onClick={() => setActiveMode('critical')} 
                            icon={<ExclamationTriangleIcon />} 
                            title="Resgate (Crítico)" 
                            description="Apenas erros recentes e matérias atrasadas." 
                        />
                    </div>
                </div>

                {/* 2. Filters Panel */}
                <GlassPanel className="transition-all duration-300">
                    <div 
                        className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl border ${activeFilterCount > 0 ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-white/5 border-white/5 text-slate-500'}`}>
                                <FilterIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                                    Filtros e Escopo
                                </h3>
                                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                                    {activeFilterCount > 0 
                                        ? `${activeFilterCount} filtros ativos` 
                                        : "Nenhum filtro ativo"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             {activeFilterCount > 0 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleClearFilters(); }}
                                    className="text-[10px] font-black text-rose-400 hover:text-white px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 rounded-lg border border-rose-500/20 transition-all flex items-center gap-1 uppercase tracking-widest"
                                >
                                    <XMarkIcon className="w-3 h-3" /> Limpar
                                </button>
                            )}
                            <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isFiltersOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </div>

                    {isFiltersOpen && (
                        <div className="px-6 pb-6 pt-2 border-t border-white/5 animate-fade-in">
                            <QueueFilters allItems={allQuestions} onFilterChange={setFilters} />
                            
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                                    <label htmlFor="session-size" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tamanho:</label>
                                    <input 
                                        id="session-size" 
                                        type="number" 
                                        value={sessionSize} 
                                        onChange={e => setSessionSize(Math.max(5, Math.min(200, parseInt(e.target.value) || 20)))}
                                        className="w-16 bg-transparent text-center font-black text-white outline-none border-b border-white/20 focus:border-sky-500 transition-colors"
                                    />
                                    <span className="text-xs text-slate-500 font-bold uppercase">Questões</span>
                                </div>
                            </div>
                        </div>
                    )}
                </GlassPanel>

                {/* 3. Dashboard Preview & Action */}
                <GlassPanel className="p-8">
                    <SectionHeader icon={<BrainIcon />} title="Resumo da Sessão" subtitle="Previsão de Impacto" className="mb-6" />
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <MetricTile label="Selecionadas" value={queueData.kpis.mix.total} tooltip="Questões na fila." highlight />
                        <MetricTile label="Novas" value={queueData.kpis.mix.new} tooltip="Conteúdo inédito." />
                        <MetricTile label="Domínio Médio" value={`${queueData.kpis.kpiPreview.meanD.toFixed(0)}%`} tooltip="Domínio atual do conteúdo." />
                        <MetricTile label="Tempo Estimado" value={`~${Math.ceil((queueData.kpis.mix.total * settings.target_sec_default) / 60)}m`} tooltip="Baseado no seu ritmo." />
                    </div>

                    <PrimaryCTA onClick={handleStartSession} disabled={!hasItems} icon={<BrainIcon />}>
                        {hasItems ? 'Iniciar Sessão' : 'Nenhuma questão encontrada'}
                    </PrimaryCTA>
                    
                    {!hasItems && (
                        <p className="text-center text-xs text-rose-500 mt-3 font-bold uppercase tracking-widest animate-pulse">
                            Ajuste os filtros para encontrar questões.
                        </p>
                    )}
                </GlassPanel>

                {/* 4. Scheduler */}
                <StudyScheduler
                    questions={allQuestions}
                    onStartStudy={(title, questions) => {
                        if (questions.length === 0) return;
                        setScheduledSession({ title, questions });
                    }}
                />
            </div>

            {/* Modals */}
            <StudySessionModal 
                isOpen={!!activeSessionData} 
                onClose={() => {setActiveSessionData(null); setIsStandardSessionFlag(false);}} 
                title={activeSessionData?.title || ''} 
                questions={activeSessionData?.questions || []} 
                onSessionFinished={() => {
                    if (isStandardSessionFlag) {
                        logDailyActivity('COMPLETE_QUESTIONS');
                    }
                }}
                onStudyRefNavigate={onStudyRefNavigate}
                context="session"
            />
            <StudySessionModal 
                isOpen={!!scheduledSession} 
                onClose={() => setScheduledSession(null)} 
                title={scheduledSession?.title || ''} 
                questions={scheduledSession?.questions || []} 
                onStudyRefNavigate={onStudyRefNavigate}
                context="session"
            />
        </>
    );
};

export default StudyView;
