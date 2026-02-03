
import React from 'react';
import ReactDOM from 'react-dom';
import { FireIcon, UploadIcon, CheckCircleIcon, XCircleIcon } from './icons';
import { DailyActivityLog } from '../types';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakCount: number;
  activityLog?: DailyActivityLog;
}

const StreakModal: React.FC<StreakModalProps> = ({ isOpen, onClose, streakCount, activityLog }) => {
  if (!isOpen) return null;

  const today = new Date();
  const currentDayIndex = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDayIndex);

  const weekDays = [];
  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateKey = formatDateKey(d);
    const hasActivity = activityLog && activityLog[dateKey] && activityLog[dateKey].length > 0;
    
    let status: 'done' | 'missed' | 'today' | 'future' = 'future';
    if (i < currentDayIndex) status = hasActivity ? 'done' : 'missed';
    else if (i === currentDayIndex) status = hasActivity ? 'done' : 'today';
    
    weekDays.push({
      dayName: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][i],
      dayNumber: d.getDate(),
      status
    });
  }

  const handleShare = () => {
    if (navigator.share) {
        navigator.share({
            title: 'Minha Sequência no Miaaula',
            text: `Estou há ${streakCount} dias estudando sem parar! 🔥`,
        }).catch(console.error);
    }
  };

  const getDayStyles = (status: string) => {
      switch(status) {
          case 'done': return 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]';
          case 'missed': return 'bg-slate-800/40 text-slate-600 border border-white/5';
          case 'today': return 'bg-orange-500 text-white animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.4)]';
          default: return 'bg-white/5 text-slate-500 border border-white/5';
      }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000] bg-[#02040a] flex flex-col items-center justify-between p-8 animate-fade-in text-white font-sans overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>

      <div className="flex-1"></div>

      <div className="flex flex-col items-center w-full max-w-sm relative z-10">
        {/* Flame & Count */}
        <div className="flex flex-col items-center mb-12 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-orange-600/10 rounded-full blur-[80px]"></div>
            
            <div className="relative mb-6">
                 <FireIcon className="w-24 h-24 text-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.5)] animate-float" />
            </div>
            
            <h1 className="text-[10rem] font-black leading-[0.8] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-600">
                {streakCount}
            </h1>
            <p className="text-sm font-black text-orange-500 uppercase tracking-[0.4em] mt-8">Dias de sequência</p>
        </div>

        {/* Modern Week Tracker */}
        <div className="w-full grid grid-cols-7 gap-1.5 mb-10">
            {weekDays.map((day, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 tracking-widest">{day.dayName}</span>
                    <div className={`
                        w-10 h-10 flex items-center justify-center rounded-2xl text-xs font-bold transition-all duration-500
                        ${getDayStyles(day.status)}
                    `}>
                        {day.status === 'done' ? <CheckCircleIcon className="w-5 h-5" /> : 
                         day.status === 'missed' ? <XCircleIcon className="w-4 h-4 opacity-40" /> : 
                         day.dayNumber}
                    </div>
                </div>
            ))}
        </div>
        
        {/* Simple Legend */}
        <div className="flex gap-6 text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mb-12">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Feito</div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div> Hoje</div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div> Falta</div>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Action Buttons - Premium Pill Style */}
      <div className="w-full max-w-sm flex flex-col gap-4 pb-safe">
        <button 
            onClick={onClose}
            className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-base py-5 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.2em]"
        >
            Continuar Jornada
        </button>
        <button 
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
        >
            <UploadIcon className="w-4 h-4" /> Compartilhar Conquista
        </button>
      </div>

    </div>,
    document.body
  );
};

export default StreakModal;
