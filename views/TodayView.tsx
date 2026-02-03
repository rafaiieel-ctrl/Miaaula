
import React, { useMemo, useState, useEffect } from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import { useFlashcardState } from '../contexts/FlashcardContext';
import * as srs from '../services/srsService';
import { TabID } from '../types';
import { PlayIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { useSettings } from '../contexts/SettingsContext';
import BlackHoleEffect, { ClusterTheme } from '../components/BlackHoleEffect';

interface TodayViewProps {
  setActiveTab: (tab: TabID) => void;
}

const THEMES: { id: ClusterTheme; label: string; bgStyle: string }[] = [
    { 
        id: 'blackhole', 
        label: 'BURACO NEGRO', 
        bgStyle: 'bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-[#020617] to-[#020617]' 
    },
    { 
        id: 'fullmoon', 
        label: 'LUA CHEIA', 
        bgStyle: 'bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/30 via-[#0f172a] to-[#020617]' 
    },
    { 
        id: 'sun', 
        label: 'SOL', 
        bgStyle: 'bg-[#0f1016] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-[#0f1016] to-[#000000]' 
    },
    { 
        id: 'planet', 
        label: 'PLANETA', 
        bgStyle: 'bg-[#022c22] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-[#020617] to-[#000000]' 
    },
];

const TodayView: React.FC<TodayViewProps> = ({ setActiveTab }) => {
  const questions = useQuestionState();
  const flashcards = useFlashcardState();
  const { settings } = useSettings();

  // Theme State
  const [theme, setTheme] = useState<ClusterTheme>('blackhole');

  // Load Theme
  useEffect(() => {
    const saved = localStorage.getItem('miaaula_cluster_theme') as ClusterTheme;
    if (saved && THEMES.some(t => t.id === saved)) {
        setTheme(saved);
    }
  }, []);

  // Keyboard Navigation for Theme
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') changeTheme('next');
        if (e.key === 'ArrowLeft') changeTheme('prev');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [theme]);

  const changeTheme = (dir: 'next' | 'prev') => {
    const idx = THEMES.findIndex(t => t.id === theme);
    let newIdx = dir === 'next' ? idx + 1 : idx - 1;
    if (newIdx >= THEMES.length) newIdx = 0;
    if (newIdx < 0) newIdx = THEMES.length - 1;
    
    const newTheme = THEMES[newIdx].id;
    setTheme(newTheme);
    localStorage.setItem('miaaula_cluster_theme', newTheme);
  };

  const dueQuestions = useMemo(() => {
    const today = srs.todayISO();
    const now = new Date();
    return questions.filter(q => {
        if (settings.subjectConfigs && settings.subjectConfigs[q.subject]?.isFrozen) return false;
        return settings.useNewSrsLogic ? new Date(q.nextReviewDate) <= now : q.nextReviewDate <= today;
    });
  }, [questions, settings]);

  const dueFlashcards = useMemo(() => {
      const now = new Date();
      return flashcards.filter(fc => {
          if (settings.subjectConfigs && settings.subjectConfigs[fc.discipline]?.isFrozen) return false;
          return new Date(fc.nextReviewDate) <= now;
      });
  }, [flashcards, settings]);

  const totalDue = dueQuestions.length + dueFlashcards.length;
  const isClear = totalDue === 0;

  const activeThemeConfig = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <div className={`w-full h-full flex flex-col relative overflow-hidden animate-fade-in select-none transition-colors duration-700 ${activeThemeConfig.bgStyle}`}>
        
        {/* Subtle Vignette Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] z-0"></div>

        {/* Greeting Section */}
        <div className="w-full px-6 pt-6 md:pt-10 z-20 mb-8 md:mb-0">
            <h1 className="text-3xl md:text-4xl text-white font-medium tracking-tight mb-1 drop-shadow-md">
                Olá, <span className="font-bold">{settings.userName || 'Estudante'}</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-medium drop-shadow-sm">
                Sua evolução começa agora.
            </p>
        </div>

        {/* The Core (Interactive Circle) - Centered in remaining space */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-10 md:-mt-20 relative z-10">
            
            <div className="flex items-center gap-6 md:gap-16">
                {/* Previous Theme Button - Elegant & Discrete */}
                <button 
                    onClick={() => changeTheme('prev')} 
                    className="p-3 rounded-full text-white/30 hover:text-white/80 hover:bg-white/5 transition-all active:scale-90 outline-none focus:ring-0"
                    title="Ambiente Anterior"
                >
                    <ChevronLeftIcon className="w-6 h-6 md:w-8 md:h-8" />
                </button>

                <div 
                    className="relative group cursor-pointer transition-transform duration-700 hover:scale-[1.02] active:scale-95" 
                    onClick={() => totalDue > 0 && setActiveTab('study')}
                >
                    {/* Main Orb Container */}
                    <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-full flex flex-col items-center justify-center">
                        
                        {/* The Realistic Black Hole Effect */}
                        <BlackHoleEffect theme={theme} />

                        {/* Content Overlay - High Legibility */}
                        <div className="relative z-30 text-center flex flex-col items-center">
                            {isClear ? (
                                <div className="animate-fade-in-up flex flex-col items-center">
                                    <CheckCircleIcon className="w-16 h-16 text-emerald-500 mb-4 drop-shadow-lg" />
                                    <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest text-shadow-sm">Tudo em Dia</span>
                                </div>
                            ) : (
                                <div className="animate-fade-in-up flex flex-col items-center">
                                    <span className="block text-8xl md:text-9xl font-black text-white tracking-tighter leading-none drop-shadow-2xl mix-blend-overlay opacity-90">
                                        {totalDue}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] mt-2 mb-8 drop-shadow-md opacity-80">
                                        Pendentes
                                    </span>
                                    
                                    <button className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 backdrop-blur-md shadow-lg group-hover:bg-white/20">
                                        INICIAR <PlayIcon className="w-3 h-3 fill-current" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Next Theme Button - Elegant & Discrete */}
                <button 
                    onClick={() => changeTheme('next')} 
                    className="p-3 rounded-full text-white/30 hover:text-white/80 hover:bg-white/5 transition-all active:scale-90 outline-none focus:ring-0"
                    title="Próximo Ambiente"
                >
                    <ChevronRightIcon className="w-6 h-6 md:w-8 md:h-8" />
                </button>
            </div>

            {/* Theme Label - Minimalist */}
            <div className="mt-10 text-[9px] font-bold text-white/30 uppercase tracking-[0.3em] flex items-center gap-2 cursor-default transition-opacity duration-500">
                <span>AMBIENTE: {activeThemeConfig.label}</span>
            </div>

        </div>
    </div>
  );
};

export default TodayView;
