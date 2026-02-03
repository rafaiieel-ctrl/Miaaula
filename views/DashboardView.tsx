
import React, { useState, useMemo, useCallback } from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import { useFlashcardState } from '../contexts/FlashcardContext';
import * as srs from '../services/srsService';
import { Question, Flashcard } from '../types';
import { BrainIcon, ClockIcon, CheckCircleIcon, ChartBarIcon, DownloadIcon, FireIcon, ExclamationTriangleIcon } from '../components/icons';
import TopicMasteryChart from '../components/TopicMasteryChart';
import { useSettings } from '../contexts/SettingsContext';
import DashboardReport from '../components/DashboardReport';
import InfoModal from '../components/InfoModal';
import LearningDiagnostics from '../components/LearningDiagnostics';
import ErrorParetoChart from '../components/ErrorParetoChart';
import RecoveryPanel from '../components/RecoveryPanel';
import StudySessionModal from '../components/StudySessionModal';
import InfoTooltip from '../components/InfoTooltip';
import { filterExecutableItems } from '../services/contentGate'; // Import Gate

const DashCard: React.FC<{ label: string; value: string | number; color?: string; icon?: React.ReactNode; tooltip?: string }> = ({ label, value, color, icon, tooltip }) => (
  <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between group hover:border-slate-300 dark:hover:border-white/10 transition-all duration-300 relative shadow-sm">
    <div>
        <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
            {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <p className={`text-4xl font-black tracking-tighter ${color || 'text-slate-900 dark:text-white'}`}>{value}</p>
    </div>
    {icon && (
        <div className={`p-4 rounded-3xl bg-slate-50 dark:bg-white/5 ${color || 'text-slate-500'} opacity-50 group-hover:opacity-100 transition-opacity`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
        </div>
    )}
  </div>
);

const DashboardView: React.FC = () => {
  const questions = useQuestionState();
  const flashcards = useFlashcardState();
  const { settings, logDailyActivity } = useSettings();
  const [evolutionPeriod, setEvolutionPeriod] = useState<'7d' | '30d'>('30d');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Drilldown State
  const [recoverySubject, setRecoverySubject] = useState<string | null>(null);
  const [recoveryQueue, setRecoveryQueue] = useState<Question[]>([]);
  const [isRecoverySessionOpen, setIsRecoverySessionOpen] = useState(false);

  // --- CONTENT GATE ---
  // Ensure only active (non-frozen, non-deleted) content is analyzed
  const activeQuestions = useMemo(() => filterExecutableItems(questions), [questions]);
  const activeFlashcards = useMemo(() => filterExecutableItems(flashcards), [flashcards]);
  const allContent = useMemo(() => [...activeQuestions, ...activeFlashcards], [activeQuestions, activeFlashcards]);

  const stats = useMemo(() => {
    const total = allContent.length;
    if (total === 0) return { total: 0, avgMastery: '0%', recentAccuracy: '0%', totalStudyTime: '0h 0m' };

    // Standardized global mastery calculation
    const avgMasteryVal = srs.calculateAggregateMastery(allContent, settings);
    
    const allAttemptsSorted = allContent.flatMap(item => item.attemptHistory || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentAttempts = allAttemptsSorted.slice(0, 50);
    const correctRecent = recentAttempts.filter(a => a.wasCorrect).length;
    const totalSeconds = allAttemptsSorted.reduce((acc, att) => acc + (att.timeSec || 0), 0);

    return {
      total,
      avgMastery: `${avgMasteryVal}%`,
      recentAccuracy: `${recentAttempts.length > 0 ? ((correctRecent / recentAttempts.length) * 100).toFixed(0) : 0}%`,
      totalStudyTime: `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m`
    };
  }, [allContent, settings]);

  const topicMasteryData = useMemo(() => {
    const topics: Record<string, { sum: number, count: number }> = {};
    allContent.forEach(item => {
        const name = item.topic || 'Geral';
        if (!topics[name]) topics[name] = { sum: 0, count: 0 };
        topics[name].sum += srs.calculateCurrentDomain(item, settings);
        topics[name].count++;
    });
    return Object.entries(topics).map(([name, data]) => ({ name, avgMastery: data.sum / data.count, count: data.count }))
        .sort((a, b) => a.avgMastery - b.avgMastery);
  }, [allContent, settings]);

  const handleStartRecovery = useCallback((queue: Question[]) => {
      // Gate check for recovery queue
      const validQueue = filterExecutableItems(queue);
      if (validQueue.length === 0) {
          alert("Não há questões disponíveis para recuperação (podem estar em disciplinas congeladas).");
          return;
      }
      setRecoveryQueue(validQueue);
      setIsRecoverySessionOpen(true);
      setRecoverySubject(null); 
  }, []);

  const handleRecoveryFinished = () => {
      logDailyActivity('COMPLETE_QUESTIONS');
      setIsRecoverySessionOpen(false);
      setRecoveryQueue([]);
  };

  if (isPrinting) {
      return (
          <div className="bg-white min-h-screen p-8">
              <button onClick={() => setIsPrinting(false)} className="fixed top-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold print:hidden">Fechar</button>
              <DashboardReport data={{ stats, evolutionData: [], forgettingCurveData: {series:[], meta:{N:0}}, masteryEvolutionData: [] }} questions={activeQuestions} flashcards={activeFlashcards} settings={settings} topicMasteryData={topicMasteryData} />
          </div>
      );
  }

  return (
    <div className="space-y-12 pb-32 animate-fade-in px-4">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div>
                <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-2">Análise de Performance</h2>
                <p className="text-slate-500 font-medium uppercase tracking-[0.3em] text-[10px]">Consolidado Científico de Estudos</p>
            </div>
            <button onClick={() => setIsPrintModalOpen(true)} className="flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest">
                <DownloadIcon className="w-4 h-4" /> Relatório Completo
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DashCard label="Volume Total" value={stats.total} icon={<BrainIcon />} color="text-sky-500" />
            <DashCard 
                label="Nível de Domínio" 
                value={stats.avgMastery} 
                icon={<ChartBarIcon />} 
                color="text-emerald-500"
                tooltip="Média do domínio de todos os itens ativos (Questões + Flashcards). Calculado com a mesma base do Gráfico Orbital."
            />
            <DashCard label="Acurácia 50Q" value={stats.recentAccuracy} icon={<CheckCircleIcon />} color="text-indigo-500" />
            <DashCard label="Tempo Focado" value={stats.totalStudyTime} icon={<ClockIcon />} color="text-amber-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-10 rounded-[3rem] shadow-xl dark:shadow-2xl relative">
                <div className="flex items-center gap-3 mb-8">
                    <ExclamationTriangleIcon className="text-rose-500 w-5 h-5" />
                    <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-[0.3em]">Pareto de Erros por Disciplina</h3>
                </div>
                <ErrorParetoChart 
                    questions={activeQuestions} 
                    onBarClick={(subject) => setRecoverySubject(subject)}
                />
            </div>
            
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-10 rounded-[3rem] shadow-xl dark:shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                    <FireIcon className="text-amber-500 w-5 h-5" />
                    <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-[0.3em]">Maestria Crítica (Piores Temas)</h3>
                </div>
                <TopicMasteryChart data={topicMasteryData.slice(0, 8)} />
            </div>
        </div>

        {/* Diagnóstico no Final conforme solicitado */}
        <LearningDiagnostics questions={activeQuestions} settings={settings} />

        {/* Modals & Panels */}
        
        {isPrintModalOpen && (
            <InfoModal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} onConfirm={() => { setIsPrinting(true); setIsPrintModalOpen(false); }} title="Relatório Analítico" confirmText="Visualizar">
                <p className="text-sm leading-relaxed text-slate-600">Prepare-se para uma visão profunda da sua evolução. O sistema irá compilar todos os mapas orbitais e tendências de memória em um PDF.</p>
            </InfoModal>
        )}

        {recoverySubject && (
            <RecoveryPanel 
                subject={recoverySubject} 
                questions={activeQuestions} 
                settings={settings}
                onClose={() => setRecoverySubject(null)}
                onStartRecovery={handleStartRecovery}
            />
        )}

        <StudySessionModal
            isOpen={isRecoverySessionOpen}
            onClose={() => { setIsRecoverySessionOpen(false); setRecoveryQueue([]); }}
            questions={recoveryQueue}
            title={`Recuperação: ${recoveryQueue[0]?.subject || 'Geral'}`}
            onSessionFinished={handleRecoveryFinished}
        />
    </div>
  );
};

export default DashboardView;
