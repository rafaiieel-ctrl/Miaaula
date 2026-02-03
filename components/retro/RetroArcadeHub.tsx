
import React, { useState, useEffect } from 'react';
import { JoystickIcon, ChevronLeftIcon, BoltIcon, PuzzlePieceIcon, TrendingUpIcon, CrosshairIcon, MapIcon, RadarIcon, FireIcon } from '../icons';
import RetroGameRunner from './RetroGameRunner';
import LawHunterGame from './LawHunterGame'; 
import GapHunterGame from './GapHunterGame'; 
import TrapscanReactorGame from './TrapscanReactorGame'; 
import TrapscanReactorProGame from './TrapscanReactorProGame'; // Import PRO+
import { retroAudio } from '../../services/retroAudioService';
import { useQuestionState } from '../../contexts/QuestionContext';
import { filterQuestionsByMode, RetroGameType, GAME_CONFIGS } from './retroUtils';

interface RetroArcadeHubProps {
    onExit: () => void;
}

// Speaker Icons for internal use
const SpeakerIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 2.485.586 4.821 1.633 6.871.192.366 1.02.929 1.375.929h2.368l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
        <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
    </svg>
);

const MuteIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 2.485.586 4.821 1.633 6.871.192.366 1.02.929 1.375.929h2.368l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06l-1.72 1.72-1.72-1.72z" />
    </svg>
);

const RetroArcadeHub: React.FC<RetroArcadeHubProps> = ({ onExit }) => {
    const allQuestions = useQuestionState();
    const [selectedGame, setSelectedGame] = useState<RetroGameType | null>(null);
    const [crtEnabled, setCrtEnabled] = useState(false);
    const [audioSettings, setAudioSettings] = useState(retroAudio.getSettings());
    const [counts, setCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        // Play Intro Sound on mount
        retroAudio.play('COIN');
        
        // Calculate counts for badges
        const newCounts: Record<string, number> = {};
        GAME_CONFIGS.forEach(game => {
             const pool = filterQuestionsByMode(allQuestions, game.mode);
             newCounts[game.id] = pool.length;
        });
        setCounts(newCounts);
    }, [allQuestions]);

    const toggleAudio = () => {
        const newState = !audioSettings.enabled;
        retroAudio.setEnabled(newState);
        setAudioSettings(prev => ({ ...prev, enabled: newState }));
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        retroAudio.setVolume(val);
        setAudioSettings(prev => ({ ...prev, volume: val }));
    };

    // RENDERIZAÇÃO DO JOGO SELECIONADO
    if (selectedGame) {
        if (selectedGame === 'trapscan_pro') {
             return (
                <TrapscanReactorProGame 
                    onExit={() => { setSelectedGame(null); retroAudio.play('SELECT'); }}
                    crtEffect={crtEnabled}
                />
             );
        }

        if (selectedGame === 'trapscan_reactor') {
             return (
                <TrapscanReactorGame 
                    onExit={() => { setSelectedGame(null); retroAudio.play('SELECT'); }}
                    crtEffect={crtEnabled}
                />
             );
        }

        if (selectedGame === 'law_hunter') {
            return (
                <LawHunterGame 
                    onExit={() => { setSelectedGame(null); retroAudio.play('SELECT'); }}
                    crtEffect={crtEnabled}
                />
            );
        }
        
        if (selectedGame === 'gap_hunter') {
            return (
                <GapHunterGame 
                    onExit={() => { setSelectedGame(null); retroAudio.play('SELECT'); }}
                    crtEffect={crtEnabled}
                />
            );
        }
        
        // Padrão para os outros jogos
        return (
            <RetroGameRunner 
                gameType={selectedGame} 
                onExit={() => { 
                    setSelectedGame(null); 
                    retroAudio.play('SELECT'); 
                }} 
                crtEffect={crtEnabled}
            />
        );
    }

    return (
        <div className={`min-h-full p-6 md:p-8 animate-fade-in pb-32 bg-[#050a14] relative overflow-hidden font-mono ${crtEnabled ? 'contrast-125' : ''}`}>
            
            {/* CRT Scanline Overlay */}
            {crtEnabled && (
                <div className="fixed inset-0 pointer-events-none z-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAuLDAsMCwwLjEpIi8+CjxwYXRoIGQ9Ik0wIDNMNCAzIiBzdHJva2U9InJnYmEoMCwwLDAsMC4yKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-40"></div>
            )}
            
            <header className="mb-10 text-center relative z-10">
                <div className="inline-flex items-center justify-center p-4 bg-slate-900 border-2 border-slate-700 rounded-full mb-4 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                    <JoystickIcon className="w-10 h-10 text-purple-400" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 tracking-tighter uppercase mb-2 drop-shadow-md" style={{ textShadow: '4px 4px 0px #000' }}>
                    RETRO ARCADE
                </h1>
                <p className="text-slate-400 font-bold text-sm md:text-base max-w-md mx-auto uppercase tracking-widest">
                    Insert Coin to Learn
                </p>
                
                <div className="absolute top-0 left-0">
                    <button onClick={onExit} className="p-3 bg-slate-900 border-2 border-slate-700 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="absolute top-0 right-0 flex items-center gap-2 bg-slate-900 border-2 border-slate-700 rounded-xl p-1">
                     <button 
                        onClick={toggleAudio}
                        className={`p-2 rounded-lg transition-colors ${audioSettings.enabled ? 'text-green-400' : 'text-red-500'}`}
                        title={audioSettings.enabled ? "Mute SFX" : "Unmute SFX"}
                    >
                        {audioSettings.enabled ? <SpeakerIcon className="w-4 h-4"/> : <MuteIcon className="w-4 h-4"/>}
                    </button>
                    {audioSettings.enabled && (
                        <input 
                            type="range" 
                            min="0" max="1" step="0.1" 
                            value={audioSettings.volume} 
                            onChange={handleVolume}
                            className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    )}
                    <div className="w-px h-6 bg-slate-700 mx-1"></div>
                    <button 
                        onClick={() => setCrtEnabled(!crtEnabled)} 
                        className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${crtEnabled ? 'text-green-400' : 'text-slate-500'}`}
                    >
                        CRT
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                {GAME_CONFIGS.map(game => {
                    const count = counts[game.id] || 0;
                    return (
                        <button
                            key={game.id}
                            onClick={() => {
                                retroAudio.play('START');
                                setSelectedGame(game.id);
                            }}
                            onMouseEnter={() => retroAudio.play('SELECT')}
                            className={`group relative p-6 rounded-xl border-4 bg-slate-900 transition-all hover:scale-105 active:scale-95 flex flex-col items-center text-center h-full ${game.border} hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]`}
                        >
                            {/* Pixel Corners */}
                            <div className="absolute top-0 left-0 w-2 h-2 bg-slate-900 -translate-x-1 -translate-y-1"></div>
                            <div className="absolute top-0 right-0 w-2 h-2 bg-slate-900 translate-x-1 -translate-y-1"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 bg-slate-900 -translate-x-1 translate-y-1"></div>
                            <div className="absolute bottom-0 right-0 w-2 h-2 bg-slate-900 translate-x-1 translate-y-1"></div>

                            {/* Special Badge for New Games */}
                            {(game.id === 'trapscan_pro' || game.id === 'trapscan_reactor' || game.id === 'law_hunter' || game.id === 'gap_hunter') && (
                                <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                    NEW
                                </div>
                            )}

                            <div className={`p-4 rounded-full mb-4 ${game.bg} ${game.color} animate-pulse`}>
                                {game.icon}
                            </div>
                            
                            <div className={`inline-block px-2 py-0.5 rounded mb-2 text-[10px] font-black uppercase border ${game.bg} ${game.color} ${game.border}`}>
                                {game.label}
                            </div>

                            <h3 className={`text-xl font-black uppercase tracking-widest mb-2 ${game.color} drop-shadow-sm`}>
                                {game.title}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase mb-4">
                                {game.desc}
                            </p>
                            
                            <div className="mt-auto w-full space-y-2">
                                <div className="text-[10px] font-mono text-slate-500">
                                    DISPONÍVEIS: <span className="text-white font-bold">{count}</span>
                                </div>
                                <div className={`w-full py-3 bg-slate-800 border-2 border-slate-700 ${game.color} text-xs font-black uppercase rounded hover:bg-slate-700 transition-colors shadow-lg`}>
                                    START GAME
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer Credits */}
            <div className="mt-16 text-center text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] animate-pulse">
                © 198X ESTUDOS CORP • HIGH SCORE: ???
            </div>
        </div>
    );
};

export default RetroArcadeHub;
