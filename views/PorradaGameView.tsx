
import React, { useState, useMemo } from 'react';
import { StudyRef, Question, Flashcard } from '../types';
import { useQuestionState } from '../contexts/QuestionContext';
import { useFlashcardState, useFlashcardDispatch } from '../contexts/FlashcardContext';
import { useSettings } from '../contexts/SettingsContext';
import BattleView from './BattleView';
import LightningQuizView from './LightningQuizView';
import RetroArcadeHub from '../components/retro/RetroArcadeHub';
import { BoltIcon, GamepadIcon, TrophyIcon, ChevronLeftIcon, FireIcon, JoystickIcon } from '../components/icons';
import * as srs from '../services/srsService';

interface PorradaGameViewProps {
    onStudyRefNavigate?: (ref: StudyRef) => void;
}

type ArenaMode = 'HUB' | 'LIGHTNING' | 'BATTLE' | 'RETRO';

const PorradaGameView: React.FC<PorradaGameViewProps> = ({ onStudyRefNavigate }) => {
    const [mode, setMode] = useState<ArenaMode>('HUB');
    const allQuestions = useQuestionState();
    const { settings, logDailyActivity } = useSettings();

    // --- DATA PREP ---

    // 1. Lightning Data (Random Mix)
    const lightningQueue = useMemo(() => {
        if (mode !== 'LIGHTNING') return [];
        // Filter valid questions
        const validQ = allQuestions.filter(q => q.questionText && q.correctAnswer).slice();
        // Shuffle
        return validQ.sort(() => Math.random() - 0.5).slice(0, 20); // Max 20 for lightning
    }, [allQuestions, mode]);

    // --- HANDLERS ---

    const handleExit = () => {
        setMode('HUB');
    };

    const handleLightningExit = (score?: number, passed?: boolean) => {
        if (score !== undefined) {
             // Logic handled inside view, just log activity here if needed
             logDailyActivity('COMPLETE_QUESTIONS');
        }
        handleExit();
    };

    // --- RENDERERS ---

    if (mode === 'BATTLE') {
        return <BattleView mode="instant" onExit={handleExit} />;
    }

    if (mode === 'LIGHTNING') {
        return (
            <LightningQuizView 
                preSelectedQuestions={lightningQueue} 
                onExit={handleLightningExit}
                isSurpriseMode={true}
            />
        );
    }

    if (mode === 'RETRO') {
        return <RetroArcadeHub onExit={handleExit} />;
    }

    // --- HUB VIEW ---
    return (
        <div className="min-h-full p-6 md:p-8 animate-fade-in pb-32">
            <header className="mb-10 text-center">
                <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl shadow-2xl mb-4 shadow-orange-500/20">
                    <GamepadIcon className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase mb-2">
                    Arena de Treino
                </h1>
                <p className="text-slate-400 font-medium text-sm md:text-base max-w-md mx-auto">
                    Desafie seus limites. Escolha sua modalidade e entre no fluxo de alta performance.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {/* CARD 1: LIGHTNING */}
                <button 
                    onClick={() => setMode('LIGHTNING')}
                    className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-left transition-all hover:border-yellow-500/50 hover:shadow-2xl hover:shadow-yellow-500/10 active:scale-95 flex flex-col"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BoltIcon className="w-32 h-32 text-yellow-500" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="w-14 h-14 bg-yellow-500/20 text-yellow-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <BoltIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Minuto<br/>Porrada</h3>
                        <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8 flex-grow">
                            60 segundos insanos. Responda rápido para ganhar tempo extra. Errou? Penalidade.
                        </p>
                        <div className="flex items-center gap-2 text-yellow-500 font-bold text-xs uppercase tracking-widest mt-auto">
                            <span>Jogar Agora</span> <ChevronLeftIcon className="w-4 h-4 rotate-180" />
                        </div>
                    </div>
                </button>

                {/* CARD 2: BATTLE */}
                <button 
                    onClick={() => setMode('BATTLE')}
                    className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-left transition-all hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10 active:scale-95 flex flex-col"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FireIcon className="w-32 h-32 text-orange-500" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="w-14 h-14 bg-orange-500/20 text-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <GamepadIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Modo<br/>Batalha</h3>
                        <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8 flex-grow">
                            Elimine as alternativas erradas antes de escolher a certa. Estratégia pura.
                        </p>
                        <div className="flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-widest mt-auto">
                            <span>Jogar Agora</span> <ChevronLeftIcon className="w-4 h-4 rotate-180" />
                        </div>
                    </div>
                </button>

                {/* CARD 3: RETRO ARCADE (NEW) */}
                <button 
                    onClick={() => setMode('RETRO')}
                    className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-left transition-all hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/10 active:scale-95 flex flex-col"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <JoystickIcon className="w-32 h-32 text-purple-500" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="w-14 h-14 bg-purple-500/20 text-purple-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <JoystickIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Retro<br/>Arcade</h3>
                        <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8 flex-grow">
                            Nostalgia pura. Jogue Space Quiz e outros clássicos dos anos 80 integrados aos seus estudos.
                        </p>
                        <div className="flex items-center gap-2 text-purple-500 font-bold text-xs uppercase tracking-widest mt-auto">
                            <span>Jogar Agora</span> <ChevronLeftIcon className="w-4 h-4 rotate-180" />
                        </div>
                    </div>
                </button>
            </div>

            {/* Stats Footer */}
            <div className="mt-12 text-center">
                <div className="inline-flex items-center gap-4 bg-slate-900/50 border border-white/5 px-6 py-3 rounded-2xl backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <TrophyIcon className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs font-bold text-slate-300">Recorde Relâmpago: <span className="text-white">{settings.lightningHighScore || 0}</span></span>
                    </div>
                    <div className="w-px h-4 bg-white/10"></div>
                    <div className="flex items-center gap-2">
                        <GamepadIcon className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold text-slate-300">Batalhas: <span className="text-white">{settings.battleHistory?.length || 0}</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PorradaGameView;
