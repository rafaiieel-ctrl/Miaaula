
import React, { useState, useMemo } from 'react';
import { StudyRef, Flashcard, GameResult } from '../types';
import { useFlashcardState, useFlashcardDispatch } from '../contexts/FlashcardContext';
import { useSettings } from '../contexts/SettingsContext';
import PairMatchGame from '../components/pairmatch/PairMatchGame';
import { PuzzlePieceIcon, BoltIcon, ChevronLeftIcon, PlayIcon, SearchIcon } from '../components/icons';

interface PairMatchGameViewProps {
    onStudyRefNavigate?: (ref: StudyRef) => void;
}

const PairMatchGameView: React.FC<PairMatchGameViewProps> = ({ onStudyRefNavigate }) => {
    const allFlashcards = useFlashcardState();
    const { updateBatchFlashcards } = useFlashcardDispatch();
    const { settings, updateGameRecord, addPairMatchHistory, logDailyActivity } = useSettings();

    const [activeQueue, setActiveQueue] = useState<Flashcard[]>([]);
    const [gameTitle, setGameTitle] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // --- DATA PREPARATION ---
    
    // 1. Filter only Pair cards
    const allPairs = useMemo(() => {
        return allFlashcards.filter(fc => fc.tags && fc.tags.includes('pair-match'));
    }, [allFlashcards]);

    // 2. Group by Discipline (Source/Law)
    const groupedPairs = useMemo(() => {
        const groups: Record<string, Flashcard[]> = {};
        
        allPairs.forEach(pair => {
            const key = pair.discipline || 'Geral';
            if (!groups[key]) groups[key] = [];
            groups[key].push(pair);
        });

        // Convert to array and sort by count desc
        return Object.entries(groups)
            .map(([name, items]) => ({ name, items, count: items.length }))
            .sort((a, b) => b.count - a.count);
    }, [allPairs]);

    // 3. Filter for UI
    const displayedGroups = useMemo(() => {
        if (!searchTerm) return groupedPairs;
        return groupedPairs.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [groupedPairs, searchTerm]);

    // --- HANDLERS ---

    const handleStartGlobal = () => {
        if (allPairs.length < 2) return;
        // Shuffle all
        const queue = [...allPairs].sort(() => Math.random() - 0.5).slice(0, 16); // Cap at 16 for a round
        setActiveQueue(queue);
        setGameTitle('Arena Global (Mix)');
        setIsPlaying(true);
    };

    const handleStartGroup = (groupName: string, items: Flashcard[]) => {
        if (items.length < 2) {
            alert("Este grupo precisa de pelo menos 2 pares para jogar.");
            return;
        }
        // Shuffle specific group
        const queue = [...items].sort(() => Math.random() - 0.5).slice(0, 16);
        setActiveQueue(queue);
        setGameTitle(groupName);
        setIsPlaying(true);
    };

    const handleRoundFinished = (result: GameResult, updatedItems: Flashcard[]) => {
        updateBatchFlashcards(updatedItems);
        updateGameRecord({ topicTitle: gameTitle, pairCount: result.totalPairs, timeSec: result.totalTimeSec, clicks: result.totalClicks });
        addPairMatchHistory({ topicTitle: gameTitle, pairCount: result.totalPairs, totalTimeSec: result.totalTimeSec, totalClicks: result.totalClicks });
        logDailyActivity('PLAY_PAIR_MATCH');
        setIsPlaying(false);
    };

    // --- RENDER GAME ---
    
    if (isPlaying) {
        return (
            <PairMatchGame 
                items={activeQueue} 
                topicTitle={gameTitle} 
                pairCount={activeQueue.length} 
                onRoundFinished={handleRoundFinished} 
                onExit={() => setIsPlaying(false)} 
                settings={settings} 
                cycleStats={{ total: activeQueue.length, completed: 0 }} 
            />
        );
    }

    // --- RENDER HUB ---

    if (allPairs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in">
                <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
                    <PuzzlePieceIcon className="w-12 h-12 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Coleção Vazia</h3>
                <p className="text-slate-400 mb-8 max-w-sm">
                    Os pares são gerados automaticamente na tela de <strong>Lei Seca</strong> ou podem ser importados manualmente na tela <strong>Adicionar</strong>.
                </p>
                <div className="p-4 bg-slate-900 border border-white/10 rounded-xl text-sm text-slate-500">
                    Dica: Use a tag <code>pair-match</code> nos flashcards.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full p-6 md:p-8 animate-fade-in pb-32">
            <header className="mb-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2 flex items-center gap-3">
                            <PuzzlePieceIcon className="w-10 h-10 text-indigo-500" />
                            Arena de Pares
                        </h1>
                        <p className="text-slate-400 font-medium text-sm">
                            <span className="text-indigo-400 font-bold">{allPairs.length}</span> pares colecionados em sua base.
                        </p>
                    </div>
                    
                    <button 
                        onClick={handleStartGlobal}
                        className="group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black rounded-2xl shadow-xl hover:shadow-indigo-500/30 transition-all active:scale-95 overflow-hidden w-full md:w-auto"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <span className="relative flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                            <BoltIcon className="w-5 h-5" /> Jogar Mix Global
                        </span>
                    </button>
                </div>

                <div className="mt-8 relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Buscar coleção por lei ou disciplina..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedGroups.map((group) => (
                    <button
                        key={group.name}
                        onClick={() => handleStartGroup(group.name, group.items)}
                        disabled={group.count < 2}
                        className={`group relative p-6 rounded-[2rem] border text-left transition-all active:scale-[0.98] flex flex-col justify-between h-40 overflow-hidden
                            ${group.count < 2 
                                ? 'bg-slate-900/30 border-white/5 opacity-50 cursor-not-allowed' 
                                : 'bg-slate-900/60 border-white/10 hover:border-indigo-500/50 hover:bg-slate-900/80 hover:shadow-2xl hover:shadow-indigo-500/10'
                            }
                        `}
                    >
                        {/* Background Decoration */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <PuzzlePieceIcon className="w-32 h-32" />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${group.count < 2 ? 'bg-slate-800 text-slate-500' : 'bg-indigo-500/20 text-indigo-300'}`}>
                                    Coleção
                                </span>
                                {group.count >= 2 && <PlayIcon className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors fill-current" />}
                            </div>
                            <h3 className="text-xl font-bold text-slate-200 group-hover:text-white transition-colors line-clamp-2 leading-tight">
                                {group.name}
                            </h3>
                        </div>

                        <div className="flex items-end gap-2 relative z-10">
                            <span className="text-4xl font-black text-white">{group.count}</span>
                            <span className="text-xs text-slate-500 font-bold mb-1.5 uppercase tracking-wide">Pares</span>
                        </div>
                    </button>
                ))}
            </div>

            {displayedGroups.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-slate-500">Nenhuma coleção encontrada com este nome.</p>
                </div>
            )}
        </div>
    );
};

export default PairMatchGameView;
