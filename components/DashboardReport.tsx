
import React, { useEffect } from 'react';
import { Question, AppSettings, Flashcard, BattleHistoryEntry, PairMatchHistoryEntry } from '../types';
import StaticGalaxyMap from './StaticGalaxyMap';
import EvolutionChart from './EvolutionChart';
import ForgettingCurveChart from './ForgettingCurveChart';
import TopicMasteryChart from './TopicMasteryChart';
import AverageMasteryEvolutionChart from './AverageMasteryEvolutionChart';
import StudyTimeChart from './StudyTimeChart';

const ReportSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="print-section mt-10">
    <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 pb-2 mb-4">{title}</h2>
    <div className="text-slate-700">
        {children}
    </div>
  </section>
);

const ReportStatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
);

interface DashboardReportProps {
    data: any;
    questions: Question[];
    flashcards: Flashcard[];
    battleHistory?: BattleHistoryEntry[];
    pairMatchHistory?: PairMatchHistoryEntry[];
    settings: AppSettings;
    topicMasteryData: any[];
}

const DashboardReport: React.FC<DashboardReportProps> = ({ data, questions, flashcards, battleHistory, pairMatchHistory, settings, topicMasteryData }) => {
  const { stats, evolutionData, forgettingCurveData, masteryEvolutionData } = data;

  useEffect(() => {
    // This effect runs once when the component mounts.
    // The timeout gives the browser a moment to render the complex chart components before printing.
    const timer = setTimeout(() => {
      window.print();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-white p-4 font-sans text-sm">
      <header className="text-center border-b-2 border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Relatório de Evolução - Miaaula</h1>
        <p className="text-slate-500">Gerado em: {new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
      </header>

      <main>
        <ReportSection title="Resumo Geral de Performance">
            <div className="grid grid-cols-4 gap-4">
                <ReportStatCard label="Questões no Total" value={stats.total} />
                <ReportStatCard label="Domínio Médio Geral" value={stats.avgMastery} />
                <ReportStatCard label="Acurácia Recente" value={stats.recentAccuracy} />
                <ReportStatCard label="Questões Pendentes Hoje" value={stats.dueToday} />
                <ReportStatCard label="Temas Quentes" value={stats.hotTopics} />
                <ReportStatCard label="Marcadas com Atenção" value={stats.criticalCount} />
                <ReportStatCard label="Tempo Total de Estudo" value={stats.totalStudyTime} />
            </div>
        </ReportSection>

        <ReportSection title="Análise de Tempo de Estudo">
            <StudyTimeChart questions={questions} flashcards={flashcards} battleHistory={battleHistory} pairMatchHistory={pairMatchHistory} />
        </ReportSection>

        <ReportSection title="Mapa de Conhecimento (Galáxia de Disciplinas)">
            <p className="text-xs text-slate-600 mb-2">
            Cada ponto é uma questão. O eixo vertical representa o domínio (mais alto = maior domínio). As questões estão agrupadas por disciplina no eixo horizontal. Pontos vermelhos têm baixo domínio, amarelos são intermediários e verdes têm alto domínio.
            </p>
            <div className="border border-slate-200 rounded-lg p-2">
                <StaticGalaxyMap questions={questions} settings={settings} width={800} height={400} />
            </div>
        </ReportSection>

        <ReportSection title="Evolução de Atividade (Últimos 30 dias)">
            <EvolutionChart data={evolutionData} period="30d" />
        </ReportSection>

        <ReportSection title="Evolução do Domínio Médio (por revisão)">
            <AverageMasteryEvolutionChart data={masteryEvolutionData} period="30d" />
        </ReportSection>

        <ReportSection title="Curva de Esquecimento Projetada">
            <p className="text-xs text-slate-600 mb-2">
                Projeção da retenção média da memória para o conjunto de questões filtrado, caso não haja mais revisões. A área sombreada representa a faixa de domínio entre 25% e 75% das questões.
            </p>
            <ForgettingCurveChart series={forgettingCurveData.series} meta={forgettingCurveData.meta} />
        </ReportSection>
        
        <ReportSection title="Domínio por Tema (Top 20 Piores)">
            <p className="text-xs text-slate-600 mb-2">
                Temas com o menor domínio médio, indicando áreas que necessitam de mais atenção e estudo.
            </p>
            <TopicMasteryChart data={topicMasteryData} />
        </ReportSection>

      </main>
    </div>
  );
};

export default DashboardReport;
