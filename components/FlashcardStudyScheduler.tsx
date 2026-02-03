
import React, { useState, useMemo } from 'react';
import { Flashcard } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from './icons';
import MasteryBadge from './MasteryBadge';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { GlassPanel, SectionHeader } from './ui/DesignSystem';

interface FlashcardStudySchedulerProps {
  flashcards: Flashcard[];
  onStartStudy: (title: string, cards: Flashcard[]) => void;
}

// Reusing Logic from StudyScheduler but adapting types. 
// Ideally would share component but props differ slightly (Flashcard vs Question).

const CalendarDay: React.FC<{
  date: Date;
  cardsDue: Flashcard[];
  isCurrentMonth: boolean;
  onSelectDate: (date: Date) => void;
}> = ({ date, cardsDue, isCurrentMonth, onSelectDate }) => {
  const day = date.getDate();
  const count = cardsDue.length;

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const dateWithoutTime = useMemo(() => {
    const d = new Date(date); d.setHours(0, 0, 0, 0); return d;
  }, [date]);

  const isToday = dateWithoutTime.getTime() === today.getTime();
  const isPast = dateWithoutTime < today;
  
  let bgClass = "bg-transparent hover:bg-white/5";
  let textClass = "text-slate-400";
  let borderClass = "border-transparent";

  if (!isCurrentMonth) { textClass = "text-slate-700"; } 
  else if (isToday) { bgClass = "bg-sky-500/10"; borderClass = "border-sky-500/50"; textClass = "text-sky-400"; } 
  else if (count > 0) { bgClass = isPast ? "bg-rose-500/5" : "bg-white/5"; textClass = isPast ? "text-rose-400" : "text-slate-200"; }

  let indicator = null;
  if (count > 0) {
       const color = isPast ? "bg-rose-500" : isToday ? "bg-sky-500" : "bg-emerald-500";
       indicator = <div className="absolute bottom-1 right-1 flex justify-center items-center"><span className={`h-1.5 w-1.5 rounded-full ${color}`}></span></div>;
  }

  return (
    <button 
      onClick={() => onSelectDate(date)} 
      disabled={count === 0}
      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl border transition-all duration-200 ${bgClass} ${borderClass} ${textClass} ${count > 0 ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
    >
        <span className="text-xs font-bold">{day}</span>
        {indicator}
    </button>
  );
};

const ScheduledSessionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  cards: Flashcard[];
  onStartSession: (title: string, cards: Flashcard[]) => void;
}> = ({ isOpen, onClose, date, cards, onStartSession }) => {
    const { settings } = useSettings();
    if (!isOpen || !date) return null;

    const handleStart = () => {
        const title = `Agendado: ${date.toLocaleDateString('pt-BR')}`;
        onStartSession(title, cards);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="p-6 border-b border-white/5 flex justify-between items-center shrink-0">
                    <div><h2 className="text-lg font-black text-white uppercase tracking-tight">Flashcards para {date.toLocaleDateString('pt-BR')}</h2><p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">{cards.length} Cards</p></div>
                    <button type="button" onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors">✕</button>
                </header>
                <div className="p-4 overflow-y-auto space-y-2 custom-scrollbar">
                    {cards.map(c => (
                         <div key={c.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center text-sm group hover:border-white/10 transition-colors">
                            <div className="min-w-0 pr-4">
                                <p className="font-bold text-white truncate max-w-sm">{c.front}</p>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide truncate">{c.discipline}</p>
                            </div>
                            <MasteryBadge score={srs.calculateCurrentDomain(c, settings)} lastAnswerAt={c.lastReviewedAt} size="sm" />
                        </div>
                    ))}
                </div>
                <footer className="p-4 border-t border-white/5 flex justify-end">
                    <button onClick={handleStart} className="bg-emerald-600 text-white font-black uppercase tracking-widest text-xs py-3 px-8 rounded-xl shadow-lg hover:bg-emerald-500 transition-all active:scale-95">Revisar Agora</button>
                </footer>
            </div>
        </div>
    );
};

const FlashcardStudyScheduler: React.FC<FlashcardStudySchedulerProps> = ({ flashcards, onStartStudy }) => {
  const { settings } = useSettings();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const scheduleData = useMemo(() => {
    const map = new Map<string, Flashcard[]>();
    flashcards.forEach(fc => {
      if (settings.subjectConfigs && settings.subjectConfigs[fc.discipline]?.isFrozen) return;
      const dateKey = fc.nextReviewDate.split('T')[0];
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(fc);
    });
    return map;
  }, [flashcards, settings]);

  const changeMonth = (amount: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + amount);
      return newDate;
    });
  };

  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); 
    const grid = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        const date = new Date(year, month, i - startDayOfWeek + 1);
        grid.push({ date, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        grid.push({ date, isCurrentMonth: true });
    }
    const remainingCells = (7 - (grid.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        const date = new Date(year, month, daysInMonth + i);
        grid.push({ date, isCurrentMonth: false });
    }
    return grid;
  }, [currentMonth]);

  const cardsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = selectedDate.toISOString().split('T')[0];
    return scheduleData.get(dateKey) || [];
  }, [selectedDate, scheduleData]);
  
  return (
    <>
        <GlassPanel className="p-6">
            <div className="flex justify-between items-center mb-6">
                <SectionHeader icon={<CalendarIcon />} title="Calendário" subtitle="Cards SRS" />
                <div className="flex items-center gap-4 bg-black/20 rounded-xl p-1 border border-white/5">
                    <button onClick={() => changeMonth(-1)} className="p-1 text-slate-400 hover:text-white transition-colors"><ChevronLeftIcon className="w-4 h-4" /></button>
                    <span className="text-xs font-bold text-white uppercase w-24 text-center">{currentMonth.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')}</span>
                    <button onClick={() => changeMonth(1)} className="p-1 text-slate-400 hover:text-white transition-colors"><ChevronRightIcon className="w-4 h-4" /></button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 text-center mb-2">
                {['D','S','T','Q','Q','S','S'].map((d, i) => (
                    <span key={i} className="text-[9px] font-black text-slate-600 uppercase">{d}</span>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
                {calendarGrid.map(({ date, isCurrentMonth }, index) => {
                    const dateKey = date.toISOString().split('T')[0];
                    const cardsDue = scheduleData.get(dateKey) || [];
                    return (
                        <CalendarDay
                            key={index}
                            date={date}
                            cardsDue={cardsDue}
                            isCurrentMonth={isCurrentMonth}
                            onSelectDate={setSelectedDate}
                        />
                    );
                })}
            </div>
        </GlassPanel>

        <ScheduledSessionModal
            isOpen={!!selectedDate}
            onClose={() => setSelectedDate(null)}
            date={selectedDate}
            cards={cardsForSelectedDate}
            onStartSession={onStartStudy}
        />
    </>
  );
};

export default FlashcardStudyScheduler;
