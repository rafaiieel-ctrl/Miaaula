


import React, { useState, useMemo } from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
// FIX: Import ExclamationTriangleIcon to display the attention status.
import { BrainIcon, CheckCircleIcon, FireIcon, XCircleIcon, ExclamationTriangleIcon, ClockIcon } from '../components/icons';
import { Question, TabID } from '../types';
import StudySessionModal from '../components/StudySessionModal';
import Pagination from '../components/Pagination';
import MasteryBadge from '../components/MasteryBadge';

interface QueueViewProps {
  setActiveTab: (tab: TabID) => void;
}

interface QueueItemProps {
  question: Question;
  onStartStudy: () => void;
}

const QueueItem: React.FC<QueueItemProps> = ({ question, onStartStudy }) => {
    const { settings } = useSettings();
    const urgency = srs.calcUrgency(question, settings);
    // FIX: Add isManualAttention flag to handle the "attention" state, as UrgencyStatus.ATENCAO does not exist.
    const isManualAttention = question.isCritical;

    // FIX: Replace object lookup with a ternary operator to correctly handle border color based on urgency and attention status.
    const topBorderColorClass = 
        urgency === 'CRITICO' ? 'border-t-rose-500'
        : isManualAttention ? 'border-t-amber-500'
        : 'border-t-emerald-500';

    const domain = srs.calculateCurrentDomain(question, settings);

    // Calculate overdue days
    const getOverdueDays = () => {
        const now = new Date();
        const review = new Date(question.nextReviewDate);
        // Reset hours to compare just days
        now.setHours(0,0,0,0);
        review.setHours(0,0,0,0);
        
        const diffTime = now.getTime() - review.getTime();
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return days;
    };

    const overdueDays = getOverdueDays();

    return (
        <button 
            onClick={onStartStudy}
            className={`w-full text-left p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bunker-100 dark:bg-bunker-900 border-t-4 ${topBorderColorClass} transition-all duration-200 hover:bg-bunker-200/30 dark:hover:bg-bunker-800/50 hover:-translate-y-px hover:scale-[1.01] shadow-sm hover:shadow-lg border border-bunker-200 dark:border-bunker-800`}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {urgency === 'CRITICO' && (
                        <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-rose-500 text-white shadow-md shadow-rose-500/30">
                            CRÍTICO
                        </span>
                    )}
                    {/* FIX: Display "ATENÇÃO" badge based on the isManualAttention flag instead of the non-existent UrgencyStatus.ATENCAO. */}
                     {isManualAttention && (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-400 text-amber-900 shadow-md shadow-amber-400/30">
                            <ExclamationTriangleIcon /> REVISAR
                        </span>
                    )}
                    {question.hotTopic && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-bunker-950 bg-amber-400 px-2 py-1 rounded">
                            <FireIcon /> QUENTE
                        </span>
                    )}
                </div>
                <div className="flex items-center flex-wrap gap-2">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-lg mr-1">{question.questionRef}</p>
                    {overdueDays > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/50 whitespace-nowrap">
                            <ClockIcon className="w-3 h-3" /> +{overdueDays} dias
                        </span>
                    )}
                </div>
                <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-1">{question.subject} &bull; {question.topic}</p>
            </div>
            <div className="flex items-center gap-6 text-sm self-end md:self-center">
                <div className="flex flex-col items-center">
                    <p className="text-bunker-500 dark:text-bunker-400 text-xs uppercase tracking-wider">Domínio</p>
                    <MasteryBadge score={domain} lastAnswerAt={question.lastReviewedAt} />
                </div>
                 <div className="text-right">
                    <p className="text-bunker-500 dark:text-bunker-400 text-xs uppercase tracking-wider">Vencimento</p>
                    <p className={`font-semibold text-base ${overdueDays > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                        {srs.formatISOToBr(question.nextReviewDate)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-bunker-500 dark:text-bunker-400 text-xs uppercase tracking-wider">Última</p>
                    <div className="flex justify-end mt-1 h-5 w-5 mx-auto">
                        {question.totalAttempts > 0 ? 
                            (question.lastWasCorrect ? <span className="text-emerald-400"><CheckCircleIcon /></span> : <span className="text-rose-400"><XCircleIcon /></span>) 
                            : <span className="text-bunker-500 font-bold text-xl">-</span>}
                    </div>
                </div>
            </div>
        </button>
    );
};


const QueueView: React.FC<QueueViewProps> = ({ setActiveTab }) => {
  const questions = useQuestionState();
  const { settings } = useSettings();
  const [currentPage, setCurrentPage] = useState(1);
  const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
  const [studyModalQuestions, setStudyModalQuestions] = useState<Question[]>([]);
  const [studyModalTitle, setStudyModalTitle] = useState('');

  const dueQuestions = React.useMemo(() => {
    const today = srs.todayISO();
    const now = new Date();
    let due = questions.filter(q => {
        // Freeze Check
        if (settings.subjectConfigs && settings.subjectConfigs[q.subject]?.isFrozen) return false;

        const isDueByManualDate = false; // q.dueDate is not in types, assume false or remove
        if (settings.useNewSrsLogic) {
            const isDueByDate = new Date(q.nextReviewDate) <= now;
            return isDueByManualDate || isDueByDate;
        } else {
            return isDueByManualDate || q.nextReviewDate <= today;
        }
    });

    return due.sort((a,b) => (srs.calcUrgency(a, settings) === srs.calcUrgency(b, settings)) ? srs.calculateCurrentDomain(a, settings) - srs.calculateCurrentDomain(b, settings) : (srs.calcUrgency(a, settings) === 'CRITICO' ? -1 : 1));

  }, [questions, settings]);

  // Pagination logic
  const questionsPerPage = settings.questionsPerPage;
  const totalPages = Math.ceil(dueQuestions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const endIndex = startIndex + questionsPerPage;
  const paginatedQuestions = dueQuestions.slice(startIndex, endIndex);

  const handleStartStudySession = (title: string, questionsToStudy: Question[]) => {
    setStudyModalTitle(title);
    setStudyModalQuestions(questionsToStudy);
    setIsStudyModalOpen(true);
  };

  const handleCloseStudyModal = () => {
    setIsStudyModalOpen(false);
  };


  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Fila de Revisão</h2>
            <p className="text-bunker-500 dark:text-bunker-400">Aqui estão todas as questões que precisam da sua atenção.</p>
          </div>
          {dueQuestions.length > 0 && (
            <button onClick={() => setActiveTab('study')} className="flex items-center gap-2 bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors hover:scale-105 transform">
              <BrainIcon />
              <span>Estudar Fila Completa ({dueQuestions.length})</span>
            </button>
          )}
        </div>

        {dueQuestions.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedQuestions.map(q => 
                <QueueItem 
                  key={q.id} 
                  question={q} 
                  onStartStudy={() => handleStartStudySession(`Estudar: ${q.questionRef}`, [q])}
                />
              )}
            </div>
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                    currentPage={currentPage}
                    totalCount={dueQuestions.length}
                    pageSize={questionsPerPage}
                    onPageChange={page => setCurrentPage(page)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 px-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
            <h3 className="text-xl font-semibold">Fila Vazia!</h3>
            <p className="text-bunker-500 dark:text-bunker-400 mt-2">Você está em dia. Nenhuma questão precisa ser revisada no momento.</p>
          </div>
        )}
      </div>
      <StudySessionModal
        isOpen={isStudyModalOpen}
        onClose={handleCloseStudyModal}
        questions={studyModalQuestions}
        title={studyModalTitle}
      />
    </>
  );
};

export default QueueView;
