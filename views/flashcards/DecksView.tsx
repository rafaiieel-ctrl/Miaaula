

import React, { useMemo, useState } from 'react';
import { Flashcard } from '../../types';
import { BrainIcon, ChevronDownIcon, CheckCircleIcon } from '../../components/icons';
import FlashcardStudySessionModal from '../../components/FlashcardStudySessionModal';
import { useSettings } from '../../contexts/SettingsContext';
import * as srs from '../../services/srsService';

interface DecksViewProps {
  allFlashcards: Flashcard[];
}

// Cleaner Mastery Indicator
const MasteryIndicator: React.FC<{ percentage: number }> = ({ percentage }) => {
    let color = 'bg-emerald-500';
    let text = 'text-emerald-600 dark:text-emerald-400';
    
    if (percentage < 50) {
        color = 'bg-rose-500';
        text = 'text-rose-600 dark:text-rose-400';
    } else if (percentage < 80) {
        color = 'bg-amber-500';
        text = 'text-amber-600 dark:text-amber-400';
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 w-24 h-1.5 bg-bunker-200 dark:bg-bunker-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
            <span className={`text-xs font-bold ${text}`}>{percentage.toFixed(0)}%</span>
        </div>
    )
}

const AccordionItem: React.FC<{
  title: string;
  count: number;
  mastery: number;
  subDecks: { topic: string; cards: Flashcard[]; isDue: boolean; dueCount: number }[];
  onStartStudy: (title: string, cards: Flashcard[]) => void;
  isDeckDue: boolean;
  deckDueCount: number;
  isFrozen: boolean;
}> = ({ title, count, mastery, subDecks, onStartStudy, isDeckDue, deckDueCount, isFrozen }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`bg-white dark:bg-bunker-900 rounded-2xl border transition-all duration-200 overflow-hidden group ${isDeckDue ? 'border-bunker-200 dark:border-bunker-700 shadow-sm hover:shadow-md' : 'border-emerald-500/20 dark:border-emerald-500/10 opacity-75 hover:opacity-100'} ${isFrozen ? 'opacity-50 border-dashed border-bunker-300 dark:border-bunker-600' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex flex-col md:flex-row md:items-center justify-between p-5 text-left gap-4 hover:bg-bunker-50/50 dark:hover:bg-bunker-800/20 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex flex-col gap-1.5 flex-grow">
          <div className="flex items-center justify-between md:justify-start gap-3">
             <h4 className={`font-bold text-lg leading-tight transition-colors ${isDeckDue ? 'text-slate-900 dark:text-white group-hover:text-sky-600' : 'text-emerald-700 dark:text-emerald-400'} ${isFrozen ? '!text-bunker-500 dark:!text-bunker-400' : ''}`}>
                {title} {isFrozen && <span className="text-xs ml-2 border border-bunker-300 dark:border-bunker-600 px-1.5 py-0.5 rounded text-bunker-500">Congelado</span>}
             </h4>
             <div className="md:hidden text-bunker-400">
                <ChevronDownIcon className={`w-5 h-5 transition-transform transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-bunker-500 dark:text-bunker-400">
                {count} cartões
            </span>
            <span className="text-bunker-300 dark:text-bunker-600">•</span>
            <MasteryIndicator percentage={mastery} />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-bunker-100 dark:border-bunker-800">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isDeckDue && !isFrozen) {
                  const dueCards = subDecks.flatMap(sd => sd.cards).filter(c => {
                      const isNew = c.totalAttempts === 0;
                      const isDueTime = new Date(c.nextReviewDate) <= new Date();
                      return isNew || isDueTime;
                  });
                  onStartStudy(`Disciplina: ${title}`, dueCards);
              }
            }}
            disabled={!isDeckDue || isFrozen}
            className={`flex-grow md:flex-grow-0 flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-sm active:scale-95
                ${isFrozen
                    ? 'bg-bunker-100 dark:bg-bunker-800 text-bunker-400 dark:text-bunker-500 cursor-not-allowed border border-bunker-200 dark:border-bunker-700'
                    : isDeckDue 
                        ? 'bg-sky-500 text-white hover:bg-sky-600 hover:shadow-sky-500/20' 
                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 cursor-default border border-emerald-100 dark:border-emerald-800/50'
                }`}
          >
            {isFrozen ? (
                <>
                    <span>Congelado</span>
                </>
            ) : isDeckDue ? (
                <>
                    <BrainIcon /> <span>Revisar ({deckDueCount})</span>
                </>
            ) : (
                <>
                    <CheckCircleIcon /> <span>Tudo em dia</span>
                </>
            )}
          </button>
          <div className="hidden md:block text-bunker-400 group-hover:text-bunker-600 dark:group-hover:text-bunker-300 transition-colors">
             <ChevronDownIcon className={`w-5 h-5 transition-transform transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>
      
      {/* Accordion Content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden bg-bunker-50/50 dark:bg-bunker-950/30 ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 border-t border-bunker-100 dark:border-bunker-800">
          <h5 className="text-[10px] font-bold uppercase tracking-widest mt-4 mb-3 text-bunker-400 dark:text-bunker-500 pl-1">Tópicos</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subDecks.map(({ topic, cards, isDue, dueCount }) => {
                const topicMastery = cards.reduce((acc, c) => acc + srs.calculateCurrentDomain(c, {} as any), 0) / (cards.length || 1);
                const masteryColor = topicMastery < 50 ? 'bg-rose-500' : topicMastery < 80 ? 'bg-amber-500' : 'bg-emerald-500';
                
                return (
                  <div key={topic} className="flex items-center justify-between p-3 bg-white dark:bg-bunker-800/50 rounded-xl border border-bunker-200 dark:border-bunker-700/50 hover:border-sky-500/30 hover:shadow-sm transition-all group/topic">
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate" title={topic}>{topic === 'Não Categorizado' ? 'Geral' : topic}</p>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-bunker-500 dark:text-bunker-400">{cards.length} cards</span>
                          <div className="w-0.5 h-3 bg-bunker-200 dark:bg-bunker-700"></div>
                          <div className="flex items-center gap-1.5">
                             <div className={`w-1.5 h-1.5 rounded-full ${masteryColor}`}></div>
                             <span className="text-xs text-bunker-500 dark:text-bunker-400 font-medium">{topicMastery.toFixed(0)}%</span>
                          </div>
                      </div>
                    </div>
                    {isDue && !isFrozen ? (
                        <button
                        onClick={() => {
                            const dueCards = cards.filter(c => c.totalAttempts === 0 || new Date(c.nextReviewDate) <= new Date());
                            onStartStudy(`Tópico: ${topic}`, dueCards);
                        }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors whitespace-nowrap"
                        >
                        Revisar ({dueCount})
                        </button>
                    ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500/70 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded">
                            {isFrozen ? 'Congelado' : 'Em dia'}
                        </span>
                    )}
                  </div>
                );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const DecksView: React.FC<DecksViewProps> = ({ allFlashcards }) => {
  const { settings } = useSettings();
  const [activeStudySession, setActiveStudySession] = useState<{ title: string; cards: Flashcard[] } | null>(null);

  const decksByDiscipline = useMemo(() => {
    const decks: Record<string, { cards: Flashcard[], topics: Record<string, Flashcard[]> }> = {};
    const now = new Date();

    const isCardDue = (fc: Flashcard) => {
        if (fc.totalAttempts === 0) return true; // New
        return new Date(fc.nextReviewDate) <= now; // Due
    };
    
    allFlashcards.forEach(fc => {
      const discipline = fc.discipline || 'Não Categorizado';
      const topic = fc.topic || 'Não Categorizado';
      if (!decks[discipline]) {
        decks[discipline] = { cards: [], topics: {} };
      }
      decks[discipline].cards.push(fc);
      if (!decks[discipline].topics[topic]) {
        decks[discipline].topics[topic] = [];
      }
      decks[discipline].topics[topic].push(fc);
    });
    
    return Object.entries(decks)
      .map(([discipline, data]) => {
        const totalMastery = data.cards.reduce((acc, card) => acc + srs.calculateCurrentDomain(card, settings), 0);
        const avgMastery = data.cards.length > 0 ? totalMastery / data.cards.length : 0;
        
        const isFrozen = settings.subjectConfigs?.[discipline]?.isFrozen || false;
        
        const dueCardsInDeck = data.cards.filter(isCardDue);
        const deckDueCount = dueCardsInDeck.length;
        const isDeckDue = deckDueCount > 0 && !isFrozen;

        return {
            discipline,
            count: data.cards.length,
            avgMastery,
            isDeckDue,
            deckDueCount,
            isFrozen,
            subDecks: Object.entries(data.topics)
            .map(([topic, cards]) => {
                const dueCardsInTopic = cards.filter(isCardDue);
                return { 
                    topic, 
                    cards, 
                    isDue: dueCardsInTopic.length > 0 && !isFrozen, 
                    dueCount: dueCardsInTopic.length 
                };
            })
            .sort((a, b) => a.topic.localeCompare(b.topic))
        };
      })
      .sort((a, b) => {
          // Sort frozen to bottom, then by due status, then by mastery
          if (a.isFrozen && !b.isFrozen) return 1;
          if (!a.isFrozen && b.isFrozen) return -1;
          if (a.isDeckDue && !b.isDeckDue) return -1;
          if (!a.isDeckDue && b.isDeckDue) return 1;
          return a.avgMastery - b.avgMastery
      });
  }, [allFlashcards, settings]);
  
  const handleStartStudy = (title: string, cards: Flashcard[]) => {
    setActiveStudySession({ title, cards });
  };
  
  const handleCloseStudy = () => {
    setActiveStudySession(null);
  };

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div className="flex justify-between items-center px-1">
            <div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white">Seus Decks</h3>
                <p className="text-xs text-bunker-500 dark:text-bunker-400 mt-0.5">Organizados por menor domínio.</p>
            </div>
            <div className="text-xs font-mono font-bold bg-bunker-100 dark:bg-bunker-800 text-bunker-600 dark:text-bunker-300 px-3 py-1.5 rounded-lg border border-bunker-200 dark:border-bunker-700">
                {decksByDiscipline.length} Disciplinas
            </div>
        </div>
        
        {decksByDiscipline.length > 0 ? (
          <div className="space-y-4">
            {decksByDiscipline.map(({ discipline, count, avgMastery, subDecks, isDeckDue, deckDueCount, isFrozen }) => (
              <AccordionItem
                key={discipline}
                title={discipline}
                count={count}
                mastery={avgMastery}
                subDecks={subDecks}
                isDeckDue={isDeckDue}
                deckDueCount={deckDueCount}
                isFrozen={isFrozen}
                onStartStudy={handleStartStudy}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-bunker-50/50 dark:bg-bunker-900/30 border-2 border-dashed border-bunker-200 dark:border-bunker-800 rounded-3xl">
            <p className="text-bunker-500 dark:text-bunker-400 font-medium text-lg">Nenhum flashcard encontrado.</p>
            <p className="text-sm text-bunker-400 mt-2">Crie ou importe flashcards para ver seus decks aqui.</p>
          </div>
        )}
      </div>
      
      <FlashcardStudySessionModal 
        isOpen={!!activeStudySession}
        onClose={handleCloseStudy}
        title={activeStudySession?.title || ''}
        cards={activeStudySession?.cards || []}
      />
    </>
  );
};

export default DecksView;
